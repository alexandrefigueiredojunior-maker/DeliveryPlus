import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://delivery-plus-iota.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-integration-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

const randomToken = (bytes = 32) => {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};
const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");

const fromBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

const trackingEncryptionKey = async (secret: string) => {
  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
};

const encryptTrackingToken = async (token: string, secret: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await trackingEncryptionKey(secret);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(token)
  );
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
};

const decryptTrackingToken = async (value: string, secret: string) => {
  const [ivPart, encryptedPart] = value.split(".");
  if (!ivPart || !encryptedPart) throw new Error("Token de rastreamento criptografado inválido.");
  const key = await trackingEncryptionKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(encryptedPart)
  );
  return new TextDecoder().decode(decrypted);
};

async function ensureTrackingUrl(db: any, deliveryId: string, serviceKey: string) {
  const now = new Date().toISOString();
  const { error: expireError } = await db
    .from("rastreamento_entregas")
    .update({ ativo: false, encerrado_em: now, token_ciphertext: "", updated_at: now })
    .eq("entrega_id", deliveryId)
    .eq("ativo", true)
    .lte("expira_em", now);
  if (expireError) throw expireError;

  const readActive = async () => {
    const { data, error } = await db
      .from("rastreamento_entregas")
      .select("id, token_hash, token_ciphertext, expira_em")
      .eq("entrega_id", deliveryId)
      .eq("ativo", true)
      .gt("expira_em", new Date().toISOString())
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const current = await readActive();
  if (current?.token_ciphertext) {
    try {
      const token = await decryptTrackingToken(current.token_ciphertext, serviceKey);
      if (await sha256(token) === current.token_hash) {
        return `https://rastreio.menujunior.com/rastreio/${token}`;
      }
    } catch (error) {
      console.warn("[menujunior-connect] Token ativo precisou ser renovado:", error);
    }
    const nowExpired = new Date().toISOString();
    await db.from("rastreamento_entregas")
      .update({ ativo: false, encerrado_em: nowExpired, token_ciphertext: "", updated_at: nowExpired })
      .eq("id", current.id);
  }

  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const encryptedToken = await encryptTrackingToken(token, serviceKey);
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const { error: insertError } = await db.from("rastreamento_entregas").insert({
    entrega_id: deliveryId,
    token_hash: tokenHash,
    token_ciphertext: encryptedToken,
    ativo: true,
    expira_em: expiresAt,
    iniciado_em: now,
    updated_at: now,
  });

  if (insertError) {
    // Duas chamadas simultâneas podem disputar o único token ativo. Reutiliza o vencedor.
    if (insertError.code === "23505") {
      const winner = await readActive();
      if (winner?.token_ciphertext) {
        const winnerToken = await decryptTrackingToken(winner.token_ciphertext, serviceKey);
        if (await sha256(winnerToken) === winner.token_hash) {
          return `https://rastreio.menujunior.com/rastreio/${winnerToken}`;
        }
      }
    }
    throw insertError;
  }

  return `https://rastreio.menujunior.com/rastreio/${token}`;
}

async function finishTracking(db: any, deliveryId: string) {
  const now = new Date().toISOString();
  const { error } = await db.from("rastreamento_entregas")
    .update({ ativo: false, encerrado_em: now, token_ciphertext: "", updated_at: now })
    .eq("entrega_id", deliveryId)
    .eq("ativo", true);
  if (error) throw error;
}


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !serviceKey || !anonKey) return json({ error: "Backend não configurado" }, 500);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const db = createClient(url, serviceKey);

    const secretActions = ["exchange", "revoke", "remote_status"];
    if (secretActions.includes(action)) {
      const providedSecret = req.headers.get("x-integration-secret") || "";
      const { data: secretConfig, error: secretConfigError } = await db
        .from("menujunior_integration_secrets")
        .select("client_secret_hash")
        .eq("id", true)
        .maybeSingle();
      if (secretConfigError || !secretConfig || !providedSecret ||
          await sha256(providedSecret) !== secretConfig.client_secret_hash) {
        return json({ error: "Cliente não autorizado" }, 401);
      }
    }

    if (action === "revoke" || action === "remote_status") {
      const restaurantId = String(body.restaurante_id || "").trim();
      if (!restaurantId) return json({ error: "Restaurante não informado" }, 400);

      const { data: integration, error: integrationError } = await db
        .from("integracoes_menujunior")
        .select("id, ativo, conectado_em, ultimo_evento_em")
        .eq("restaurante_id", restaurantId)
        .maybeSingle();

      if (integrationError) {
        console.error("[menujunior-connect] Falha ao consultar integração:", integrationError.message);
        return json({ error: "Não foi possível consultar a integração" }, 500);
      }

      if (action === "remote_status") {
        return json({
          success: true,
          connected: integration?.ativo === true,
          connected_at: integration?.conectado_em || null,
          last_event_at: integration?.ultimo_evento_em || null,
        });
      }

      if (integration?.id) {
        const { error: revokeError } = await db
          .from("integracoes_menujunior")
          .update({ ativo: false, updated_at: new Date().toISOString() })
          .eq("id", integration.id);
        if (revokeError) {
          console.error("[menujunior-connect] Falha ao revogar integração:", revokeError.message);
          return json({ error: "Não foi possível revogar a conexão" }, 500);
        }
      }

      return json({ success: true, disconnected: true });
    }

    if (action === "exchange") {
      const providedSecret = req.headers.get("x-integration-secret") || "";
      const code = String(body.code || "").trim();
      if (code.length < 20) return json({ error: "Código inválido" }, 400);
      const { data: row, error } = await db.from("menujunior_oauth_codes")
        .select("id, restaurante_id, empresa_id, expires_at, consumed_at")
        .eq("code_hash", await sha256(code)).maybeSingle();
      if (error || !row || row.consumed_at || new Date(row.expires_at).getTime() < Date.now()) {
        return json({ error: "Código expirado ou já utilizado" }, 400);
      }

      const webhookToken = randomToken();
      const { data: consumed, error: consumeError } = await db.from("menujunior_oauth_codes")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", row.id).is("consumed_at", null).select("id").maybeSingle();
      if (consumeError || !consumed) return json({ error: "Código já utilizado ou indisponível" }, 400);

      const { error: saveError } = await db.from("integracoes_menujunior").upsert({
        restaurante_id: row.restaurante_id,
        empresa_id: row.empresa_id,
        token_hash: await sha256(webhookToken),
        ativo: true,
        conectado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "restaurante_id" });
      if (saveError) return json({ error: "Não foi possível concluir a conexão" }, 500);

      return json({
        success: true,
        webhook_url: url + "/functions/v1/menujunior-webhook",
        access_token: webhookToken,
        deliveryplus_restaurant_id: row.restaurante_id,
      });
    }

    if (action !== "start" && action !== "status" && action !== "disconnect" && action !== "delivery_status") return json({ error: "Ação inválida" }, 400);
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!bearer) return json({ error: "Autenticação necessária" }, 401);
    const authClient = createClient(url, anonKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(bearer);
    if (authError || !authData.user) return json({ error: "Sessão inválida" }, 401);

    if (action === "delivery_status") {
      const rawDeliveryId = String(body.delivery_id ?? body.deliveryId ?? "").trim();
      const sourceOrderId = String(body.origem_pedido_id ?? body.source_order_id ?? "").trim();
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const deliveryId = uuidPattern.test(rawDeliveryId) ? rawDeliveryId : "";
      const validSourceOrderId = uuidPattern.test(sourceOrderId) ? sourceOrderId : "";

      if (!deliveryId && !validSourceOrderId) {
        return json({ error: "Não recebi um ID de entrega válido do aplicativo do motoboy." }, 400);
      }

      const { data: motoboy, error: motoboyError } = await db
        .from("motoboys")
        .select("id, empresa_id")
        .eq("user_id", authData.user.id)
        .maybeSingle();
      if (motoboyError || !motoboy) return json({ error: "Motoboy não autorizado" }, 403);

      let delivery: any = null;
      let deliveryError: any = null;

      if (deliveryId) {
        const result = await db
          .from("entregas")
          .select("id, restaurante_id, motoboy_id, status, origem_integracao, origem_pedido_id")
          .eq("id", deliveryId)
          .eq("motoboy_id", motoboy.id)
          .maybeSingle();
        delivery = result.data;
        deliveryError = result.error;
      }

      if (!delivery && validSourceOrderId) {
        const result = await db
          .from("entregas")
          .select("id, restaurante_id, motoboy_id, status, origem_integracao, origem_pedido_id")
          .eq("origem_integracao", "menujunior")
          .eq("origem_pedido_id", validSourceOrderId)
          .eq("motoboy_id", motoboy.id)
          .maybeSingle();
        delivery = result.data;
        deliveryError = result.error;
      }

      if (deliveryError) {
        console.error("[menujunior-connect] Erro ao localizar entrega:", deliveryError.message);
        return json({ error: "Erro ao localizar a entrega no DeliveryPlus." }, 500);
      }
      if (!delivery) return json({ error: "Entrega não encontrada para este motoboy." }, 404);
      if (!["em_rota", "entregue", "cancelada"].includes(String(delivery.status || ""))) {
        return json({ error: "A entrega ainda não iniciou ou não está em um status que encerra o rastreamento." }, 409);
      }

      let trackingUrl: string | null = null;
      if (delivery.status === "em_rota") {
        trackingUrl = await ensureTrackingUrl(db, delivery.id, serviceKey);
      } else {
        await finishTracking(db, delivery.id);
      }

      // O link é gerado para qualquer entrega. A sincronização com o pedido original
      // do MenuJunior só ocorre quando a origem da entrega é o MenuJunior.
      if (delivery.origem_integracao !== "menujunior" || !delivery.origem_pedido_id) {
        return json({
          success: true,
          ignored: true,
          reason: "Entrega sem pedido de origem no MenuJunior",
          tracking_url: trackingUrl,
          tracking_active: Boolean(trackingUrl),
        });
      }

      const targetStatus = delivery.status === "em_rota"
        ? "em_entrega"
        : delivery.status === "entregue"
          ? "entregue"
          : "encerrar_rastreamento";
      const { data: integration, error: integrationError } = await db
        .from("integracoes_menujunior")
        .select("id, token_hash, ativo")
        .eq("restaurante_id", delivery.restaurante_id)
        .eq("ativo", true)
        .maybeSingle();

      if (integrationError) {
        console.error("[menujunior-connect] Falha ao consultar token da integração:", integrationError.message);
        return json({ error: "Não foi possível consultar a integração" }, 500);
      }
      if (!integration?.token_hash) {
        return json({
          success: true,
          ignored: true,
          reason: "MenuJunior não conectado para este restaurante",
          tracking_url: trackingUrl,
          tracking_active: Boolean(trackingUrl),
        });
      }

      const callbackResponse = await fetch("https://menujunior.com/api/integracoes/deliveryplus/order-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${integration.token_hash}`,
        },
        body: JSON.stringify({
          deliveryplus_restaurante_id: delivery.restaurante_id,
          origem_pedido_id: delivery.origem_pedido_id,
          status: targetStatus,
          tracking_url: trackingUrl,
        }),
      });
      const callbackBody: any = await callbackResponse.json().catch(() => ({}));
      if (!callbackResponse.ok || callbackBody?.success !== true) {
        console.error("[menujunior-connect] MenuJunior rejeitou atualização de status:", callbackResponse.status, callbackBody);
        return json({
          success: false,
          error: callbackBody?.error || "MenuJunior não confirmou a atualização do pedido",
          tracking_url: trackingUrl,
          tracking_active: Boolean(trackingUrl),
        }, 502);
      }

      await db.from("integracoes_menujunior")
        .update({ ultimo_evento_em: new Date().toISOString() })
        .eq("id", integration.id);

      return json({
        success: true,
        deliveryplus_status: delivery.status,
        menujunior_status: callbackBody.status,
        codigo_pedido: callbackBody.codigo_pedido,
        tracking_url: trackingUrl,
        tracking_active: Boolean(trackingUrl),
      });
    }

    const restaurantId = String(body.restaurante_id || "");
    const { data: restaurant } = await db.from("restaurantes").select("id, empresa_id")
      .eq("id", restaurantId).maybeSingle();
    if (!restaurant) return json({ error: "Restaurante não encontrado" }, 404);
    const { data: memberships, error: membershipError } = await db.from("usuarios_empresas")
      .select("tipo, empresa_id, user_id")
      .eq("user_id", authData.user.id);
    if (membershipError) return json({ error: "Não foi possível validar o vínculo do usuário" }, 500);
    const allowed = (memberships || []).some((m: any) =>
      (m.empresa_id === restaurant.empresa_id && ["dono", "admin"].includes(m.tipo)) ||
      m.tipo === "super_admin"
    );
    const { data: directRestaurant } = await db.from("restaurantes").select("id")
      .eq("id", restaurant.id).eq("user_id", authData.user.id).maybeSingle();
    if (!allowed && !directRestaurant) return json({ error: "Sem permissão para conectar este restaurante" }, 403);

    if (action === "disconnect") {
      const { data: integration, error: integrationError } = await db
        .from("integracoes_menujunior")
        .select("id")
        .eq("restaurante_id", restaurant.id)
        .maybeSingle();

      if (integrationError) {
        console.error("[menujunior-connect] Falha ao consultar integração para revogar:", integrationError.message);
        return json({ error: "Não foi possível consultar a conexão" }, 500);
      }

      if (integration?.id) {
        const { error: revokeError } = await db
          .from("integracoes_menujunior")
          .update({ ativo: false, updated_at: new Date().toISOString() })
          .eq("id", integration.id);
        if (revokeError) {
          console.error("[menujunior-connect] Falha ao desconectar:", revokeError.message);
          return json({ error: "Não foi possível desconectar o restaurante" }, 500);
        }
      }

      return json({ success: true, disconnected: true });
    }

    if (action === "status") {
      const { data: integration, error: integrationError } = await db
        .from("integracoes_menujunior")
        .select("ativo, conectado_em, ultimo_evento_em")
        .eq("restaurante_id", restaurant.id)
        .maybeSingle();

      if (integrationError) {
        console.error("[menujunior-connect] Falha ao consultar status:", integrationError.message);
        return json({ error: "Não foi possível consultar o status da integração" }, 500);
      }

      return json({
        success: true,
        connected: integration?.ativo === true,
        connected_at: integration?.conectado_em || null,
        last_event_at: integration?.ultimo_evento_em || null,
      });
    }

    const code = randomToken(24);
    const { error: insertError } = await db.from("menujunior_oauth_codes").insert({
      code_hash: await sha256(code),
      restaurante_id: restaurant.id,
      empresa_id: restaurant.empresa_id,
      redirect_uri: "https://menujunior.com/integracao-deliveryplus",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
    if (insertError) return json({ error: "Não foi possível iniciar a autorização" }, 500);

    return json({
      success: true,
      authorization_url: "https://menujunior.com/integracao-deliveryplus?code=" + encodeURIComponent(code),
    });
  } catch (error) {
    console.error("[menujunior-connect]", error);
    return json({ error: "Falha ao processar autorização" }, 500);
  }
});
