import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "https://delivery-plus.iota.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const integrationSecret = Deno.env.get("MENUJUNIOR_CLIENT_SECRET") || "";

    if (action === "exchange") {
      if (!integrationSecret || req.headers.get("x-integration-secret") !== integrationSecret) {
        return json({ error: "Cliente não autorizado" }, 401);
      }
      const code = String(body.code || "").trim();
      if (code.length < 20) return json({ error: "Código inválido" }, 400);
      const { data: row, error } = await db.from("menujunior_oauth_codes")
        .select("id, restaurante_id, empresa_id, expires_at, consumed_at")
        .eq("code_hash", await sha256(code)).maybeSingle();
      if (error || !row || row.consumed_at || new Date(row.expires_at).getTime() < Date.now()) {
        return json({ error: "Código expirado ou já utilizado" }, 400);
      }

      const webhookToken = randomToken();
      const { error: consumeError } = await db.from("menujunior_oauth_codes")
        .update({ consumed_at: new Date().toISOString() }).eq("id", row.id).is("consumed_at", null);
      if (consumeError) return json({ error: "Não foi possível consumir o código" }, 500);

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

    if (action !== "start") return json({ error: "Ação inválida" }, 400);
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (!bearer) return json({ error: "Autenticação necessária" }, 401);
    const authClient = createClient(url, anonKey);
    const { data: authData, error: authError } = await authClient.auth.getUser(bearer);
    if (authError || !authData.user) return json({ error: "Sessão inválida" }, 401);

    const restaurantId = String(body.restaurante_id || "");
    const { data: restaurant } = await db.from("restaurantes").select("id, empresa_id")
      .eq("id", restaurantId).maybeSingle();
    if (!restaurant) return json({ error: "Restaurante não encontrado" }, 404);
    const { data: memberships } = await db.from("usuarios_empresas")
      .select("perfil, empresa_id, restaurante_id, status")
      .eq("user_id", authData.user.id).eq("status", "ativo");
    const allowed = (memberships || []).some((m: any) =>
      m.perfil === "super_admin" ||
      (m.perfil === "empresa_admin" && m.empresa_id === restaurant.empresa_id) ||
      m.restaurante_id === restaurant.id
    );
    if (!allowed) return json({ error: "Sem permissão para conectar este restaurante" }, 403);

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
