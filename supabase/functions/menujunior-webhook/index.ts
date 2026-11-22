import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://menujunior.com",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });


function formatDeliveryAddress(rawAddress: unknown): string {
  let address: any = rawAddress;

  if (typeof address === "string") {
    const trimmed = address.trim();
    if (!trimmed) return "";
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        address = parsed;
      } else {
        return trimmed;
      }
    } catch {
      return trimmed;
    }
  }

  if (!address || typeof address !== "object" || Array.isArray(address)) {
    return address == null ? "" : String(address);
  }

  const street = String(address.logradouro || address.rua || address.endereco || "").trim();
  const number = String(address.numero || "").trim();
  const complement = String(address.complemento || "").trim();
  const neighborhood = String(address.bairro || "").trim();
  const city = String(address.cidade || address.localidade || "").trim();
  const state = String(address.estado || address.uf || "").trim().toUpperCase();
  const zip = String(address.cep || "").trim();
  const reference = String(address.referencia || "").trim();

  const parts = [
    [street, number].filter(Boolean).join(", "),
    complement,
    neighborhood,
    [city, state].filter(Boolean).join(" - "),
    zip ? `CEP ${zip}` : "",
    reference ? `Referência: ${reference}` : "",
  ].filter(Boolean);

  return parts.join(", ");
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!token || token.length < 32) return json({ error: "Token ausente ou inválido" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) return json({ error: "Backend não configurado" }, 500);
    const db = createClient(supabaseUrl, serviceKey);

    const tokenHash = await sha256(token);
    const { data: integration, error: integrationError } = await db
      .from("integracoes_menujunior")
      .select("id, restaurante_id, empresa_id")
      .eq("token_hash", tokenHash)
      .eq("ativo", true)
      .maybeSingle();

    if (integrationError || !integration) return json({ error: "Integração não autorizada" }, 401);

    const event = await req.json();
    const orderId = String(event.order_id || "").trim();
    const eventType = String(event.event || "").trim();
    if (!orderId || !["order.preparing", "order.ready", "order.cancelled"].includes(eventType)) {
      return json({ error: "Evento ou order_id inválido" }, 400);
    }

    // Os dados do pedido são enviados no evento assinado pelo token da integração.
    const payload = event.order || {};
    if (String(payload.tipo_entrega || "delivery") !== "delivery") {
      return json({ success: true, ignored: true, reason: "Tipo de pedido não é delivery" });
    }

    const { data: restaurant, error: restaurantError } = await db
      .from("restaurantes")
      .select("id, empresa_id, latitude, longitude")
      .eq("id", integration.restaurante_id)
      .eq("empresa_id", integration.empresa_id)
      .maybeSingle();
    if (restaurantError || !restaurant) return json({ error: "Restaurante da integração não encontrado" }, 404);

    if (eventType === "order.preparing") {
      const { data: existing } = await db
        .from("entregas")
        .select("id")
        .eq("restaurante_id", integration.restaurante_id)
        .eq("origem_integracao", "menujunior")
        .eq("origem_pedido_id", orderId)
        .maybeSingle();

      if (existing) return json({ success: true, duplicate: true, entrega_id: existing.id });

      const { data: company } = await db
        .from("empresas")
        .select("valor_fixo_entrega, modelo_cobranca_entrega, valor_por_km, valor_minimo_entrega")
        .eq("id", integration.empresa_id)
        .single();

      const { data: delivery, error: insertError } = await db
        .from("entregas")
        .insert({
          empresa_id: integration.empresa_id,
          restaurante_id: integration.restaurante_id,
          numero_externo: String(payload.codigo_pedido || orderId),
          valor_pedido: Number(payload.valor_total || 0),
          cliente_nome: payload.cliente_nome || "Cliente",
          cliente_telefone: payload.cliente_telefone || null,
          endereco_entrega: formatDeliveryAddress(payload.endereco_entrega),
          latitude_entrega: payload.latitude_entrega || null,
          longitude_entrega: payload.longitude_entrega || null,
          forma_pagamento: payload.forma_pagamento || null,
          observacao: payload.observacao || null,
          valor: Number(company?.valor_fixo_entrega || 0),
          status: "aguardando_despacho",
          origem_integracao: "menujunior",
          origem_pedido_id: orderId,
        })
        .select("id")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          const { data: duplicate } = await db.from("entregas").select("id")
            .eq("restaurante_id", integration.restaurante_id)
            .eq("origem_integracao", "menujunior").eq("origem_pedido_id", orderId).maybeSingle();
          if (duplicate) return json({ success: true, duplicate: true, entrega_id: duplicate.id });
        }
        console.error("Falha ao criar entrega MenuJunior:", insertError);
        return json({ error: "Não foi possível criar a entrega" }, 500);
      }

      await db.from("historico_status_entregas").insert({
        entrega_id: delivery.id,
        empresa_id: integration.empresa_id,
        restaurante_id: integration.restaurante_id,
        status: "aguardando_despacho",
        descricao: "Pedido recebido do MenuJunior; aguardando ficar pronto",
      });
      await db.from("integracoes_menujunior").update({ ultimo_evento_em: new Date().toISOString() }).eq("id", integration.id);
      return json({ success: true, entrega_id: delivery.id, status: "aguardando_despacho" }, 201);
    }

    const { data: delivery } = await db.from("entregas").select("id, status")
      .eq("restaurante_id", integration.restaurante_id)
      .eq("origem_integracao", "menujunior").eq("origem_pedido_id", orderId).maybeSingle();

    if (!delivery) return json({ success: true, ignored: true, reason: "Entrega ainda não criada" });

    if (eventType === "order.cancelled") {
      if (["aguardando_despacho", "pendente"].includes(delivery.status)) {
        await db.from("entregas").update({ status: "cancelada", motoboy_id: null }).eq("id", delivery.id);
        await db.from("historico_status_entregas").insert({
          entrega_id: delivery.id, empresa_id: integration.empresa_id,
          restaurante_id: integration.restaurante_id, status: "cancelada",
          descricao: "Pedido cancelado no MenuJunior",
        });
      }
      return json({ success: true, cancelled: ["aguardando_despacho", "pendente"].includes(delivery.status) });
    }

    if (delivery.status === "aguardando_despacho") {
      const { data: config } = await db.from("configuracoes_empresas")
        .select("modo_distribuicao").eq("empresa_id", integration.empresa_id).maybeSingle();
      if (config?.modo_distribuicao !== "manual") {
        await db.from("entregas").update({
          status: "pendente", motoboy_id: null, ultima_tentativa_distribuicao_em: new Date().toISOString(),
        }).eq("id", delivery.id);
        await db.from("historico_status_entregas").insert({
          entrega_id: delivery.id, empresa_id: integration.empresa_id,
          restaurante_id: integration.restaurante_id, status: "pendente",
          descricao: "Pedido pronto no MenuJunior; liberado para distribuição",
        });
      }
    }

    await db.from("integracoes_menujunior").update({ ultimo_evento_em: new Date().toISOString() }).eq("id", integration.id);
    return json({ success: true, status: delivery.status === "aguardando_despacho" ? "liberado_ou_manual" : delivery.status });
  } catch (error) {
    console.error("Erro na integração MenuJunior:", error);
    return json({ error: "Erro interno ao processar evento" }, 500);
  }
});
