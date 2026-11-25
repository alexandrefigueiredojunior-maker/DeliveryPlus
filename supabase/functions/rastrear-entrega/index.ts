import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://rastreio.menujunior.com";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Pragma": "no-cache",
    },
  });

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const validCoordinate = (value: unknown, min: number, max: number) => {
  const number = Number(value);
  return value !== null && value !== undefined && value !== "" &&
    Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Método não permitido" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "").trim();

    // Token aleatório de 32 bytes codificado em base64url.
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return json({ success: true, active: false, reason: "invalid_link" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !serviceKey) {
      console.error("[rastrear-entrega] Configuração do backend ausente.");
      return json({ success: false, error: "Rastreamento temporariamente indisponível." }, 503);
    }

    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tokenHash = await sha256(token);
    const { data: tracking, error: trackingError } = await db
      .from("rastreamento_entregas")
      .select("id, entrega_id, ativo, expira_em, iniciado_em")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (trackingError) throw trackingError;
    if (!tracking) return json({ success: true, active: false, reason: "not_found" });

    const now = new Date();
    const expired = !tracking.expira_em || new Date(tracking.expira_em).getTime() <= now.getTime();

    if (!tracking.ativo || expired) {
      if (tracking.ativo) {
        await db.from("rastreamento_entregas")
          .update({ ativo: false, encerrado_em: now.toISOString(), token_ciphertext: "", updated_at: now.toISOString() })
          .eq("id", tracking.id);
      }
      return json({ success: true, active: false, reason: "expired" });
    }

    const { data: delivery, error: deliveryError } = await db
      .from("entregas")
      .select("id, empresa_id, status, endereco_entrega, latitude_entrega, longitude_entrega, motoboy_id, entregue_em")
      .eq("id", tracking.entrega_id)
      .maybeSingle();

    if (deliveryError) throw deliveryError;
    if (!delivery) {
      await db.from("rastreamento_entregas")
        .update({ ativo: false, encerrado_em: now.toISOString(), token_ciphertext: "", updated_at: now.toISOString() })
        .eq("id", tracking.id);
      return json({ success: true, active: false, reason: "delivery_not_found" });
    }

    const { data: trackingConfig, error: trackingConfigError } = await db
      .from("configuracoes_empresas")
      .select("compartilhar_localizacao_cliente")
      .eq("empresa_id", delivery.empresa_id)
      .maybeSingle();

    if (trackingConfigError) throw trackingConfigError;

    if (trackingConfig?.compartilhar_localizacao_cliente === false) {
      await db.from("rastreamento_entregas")
        .update({
          ativo: false,
          encerrado_em: now.toISOString(),
          token_ciphertext: "",
          updated_at: now.toISOString(),
        })
        .eq("id", tracking.id);

      return json({ success: true, active: false, reason: "sharing_disabled" });
    }

    const deliveryStatus = String(delivery.status || "").toLowerCase();
    const trackingInProgress = ["em_rota", "pagamento_errado"].includes(deliveryStatus);
    if (!trackingInProgress) {
      await db.from("rastreamento_entregas")
        .update({ ativo: false, encerrado_em: now.toISOString(), token_ciphertext: "", updated_at: now.toISOString() })
        .eq("id", tracking.id);
      return json({
        success: true,
        active: false,
        reason: ["entregue", "cancelada", "cancelado", "finalizado"].includes(deliveryStatus)
          ? "finished"
          : "inactive",
      });
    }

    // Uma única entrega por motoboy pode expor a posição em tempo real por vez.
    // A ordem foi definida quando o motoboy iniciou todas as entregas na saída do restaurante.
    if (delivery.motoboy_id) {
      const { data: routeDeliveries, error: routeDeliveriesError } = await db
        .from("entregas")
        .select("id, created_at, updated_at, ordem_rota")
        .eq("motoboy_id", delivery.motoboy_id)
        .in("status", ["em_rota", "pagamento_errado"]);

      if (routeDeliveriesError) throw routeDeliveriesError;

      const routeIds = (routeDeliveries || []).map((item: any) => item.id);
      if (routeIds.length > 1) {
        const { data: routeTokens, error: routeTokensError } = await db
          .from("rastreamento_entregas")
          .select("entrega_id, iniciado_em")
          .eq("ativo", true)
          .gt("expira_em", now.toISOString())
          .in("entrega_id", routeIds);

        if (routeTokensError) throw routeTokensError;

        const startedAtByDelivery = new Map<string, number>();
        for (const routeToken of routeTokens || []) {
          const startedAt = new Date(routeToken.iniciado_em || "").getTime();
          if (Number.isFinite(startedAt)) {
            startedAtByDelivery.set(routeToken.entrega_id, startedAt);
          }
        }

        const orderedRoute = (routeDeliveries || [])
          .map((routeDelivery: any) => {
            const fallbackStart = new Date(
              routeDelivery.updated_at || routeDelivery.created_at || 0
            ).getTime();
            return {
              id: routeDelivery.id,
              order: routeDelivery.ordem_rota == null ? null : Number(routeDelivery.ordem_rota),
              startedAt: startedAtByDelivery.get(routeDelivery.id) ??
                (Number.isFinite(fallbackStart) ? fallbackStart : 0),
            };
          })
          .sort((a: any, b: any) => {
            if (a.order !== null && b.order !== null) return a.order - b.order;
            if (a.order === null && b.order !== null) return -1;
            if (b.order === null && a.order !== null) return 1;
            return a.startedAt - b.startedAt || String(a.id).localeCompare(String(b.id));
          });

        const firstDeliveryId = orderedRoute[0]?.id;
        if (firstDeliveryId && firstDeliveryId !== delivery.id) {
          return json({
            success: true,
            active: true,
            awaiting_turn: true,
            status: "aguardando_sequencia",
            endereco_entrega: delivery.endereco_entrega || "",
            iniciado_em: tracking.iniciado_em || null,
          });
        }
      }
    }

    let location: any = null;
    if (delivery.motoboy_id) {
      const { data, error } = await db
        .from("localizacoes_motoboys")
        .select("latitude, longitude, ultima_localizacao_em, updated_at")
        .eq("motoboy_id", delivery.motoboy_id)
        .maybeSingle();
      if (error) throw error;
      location = data;
    }

    const latitude = validCoordinate(location?.latitude, -90, 90);
    const longitude = validCoordinate(location?.longitude, -180, 180);
    const destinationLatitude = validCoordinate(delivery.latitude_entrega, -90, 90);
    const destinationLongitude = validCoordinate(delivery.longitude_entrega, -180, 180);

    return json({
      success: true,
      active: true,
      status: "em_rota",
      endereco_entrega: delivery.endereco_entrega || "",
      iniciado_em: tracking.iniciado_em || null,
      localizacao_motoboy: latitude !== null && longitude !== null
        ? {
            latitude,
            longitude,
            atualizada_em: location?.ultima_localizacao_em || location?.updated_at || null,
          }
        : null,
      destino: destinationLatitude !== null && destinationLongitude !== null
        ? { latitude: destinationLatitude, longitude: destinationLongitude }
        : null,
      localizacao_desatualizada: location?.ultima_localizacao_em
        ? now.getTime() - new Date(location.ultima_localizacao_em).getTime() > 90_000
        : true,
    });
  } catch (error) {
    console.error("[rastrear-entrega] Erro ao consultar rastreamento:", error);
    return json({ success: false, error: "Não foi possível consultar o rastreamento." }, 500);
  }
});
