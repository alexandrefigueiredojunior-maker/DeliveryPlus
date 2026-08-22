import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('ANON_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ success: false, error: 'Configuração do servidor de autenticação ausente.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Service role client para operações administrativas
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // 1. Verificar autorização do chamador (deve ser Super Admin)
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Acesso não autorizado. Token ausente.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    });

    const { data: isSuperAdmin, error: superAdminError } = await supabaseUser.rpc('is_super_admin');

    if (superAdminError || isSuperAdmin !== true) {
      console.error('Acesso negado para criação de empresa. superAdminError:', superAdminError);
      return new Response(JSON.stringify({ success: false, error: 'Acesso negado. Apenas Super Admins podem criar empresas.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Parse do corpo da requisição
    const body = await req.json();
    const { nome, telefone, email, password } = body;

    if (!nome || !nome.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'O nome da empresa é obrigatório.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!email || !email.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'O e-mail do administrador é obrigatório.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!password || !password.trim()) {
      return new Response(JSON.stringify({ success: false, error: 'A senha inicial é obrigatória.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // ETAPA 1 — CRIAR EMPRESA
    console.log('Iniciando inserção na tabela empresas...');
    const { data: empresaData, error: empresaError } = await supabaseAdmin
      .from('empresas')
      .insert({
        nome: nome.trim(),
        telefone: telefone?.trim() || null,
        ativo: true
      })
      .select('id')
      .single();

    if (empresaError || !empresaData) {
      console.error('Erro ao criar empresa:', empresaError);
      return new Response(JSON.stringify({ success: false, error: empresaError?.message || 'Erro ao salvar a empresa.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const empresaId = empresaData.id;
    console.log('Empresa criada com ID:', empresaId);

    // ETAPA 2 — CRIAR USUÁRIO AUTH
    console.log('Iniciando criação de conta do administrador no Auth...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      email_confirm: true,
      user_metadata: {
        empresa_id: empresaId,
        role: 'dono',
        nome: nome.trim()
      }
    });

    if (authError || !authData?.user) {
      console.error('Erro ao criar conta Auth:', authError);
      // Rollback: excluir a empresa criada para não deixar registro órfão
      console.log('Desfazendo criação da empresa devido à falha no Auth...');
      await supabaseAdmin.from('empresas').delete().eq('id', empresaId);

      let msgError = authError?.message || 'Erro ao criar conta de usuário administrador.';
      if (msgError.includes('User already registered') || msgError.includes('already exists')) {
        msgError = 'Este e-mail de administrador já está em uso por outro usuário.';
      }

      return new Response(JSON.stringify({ success: false, error: msgError }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const userId = authData.user.id;
    console.log('Usuário Auth criado com ID:', userId);

    // ETAPA 3 — CRIAR VÍNCULO EM usuarios_empresas
    console.log('Criando vínculo em usuarios_empresas...');
    const { error: vinculoError } = await supabaseAdmin
      .from('usuarios_empresas')
      .insert({
        user_id: userId,
        empresa_id: empresaId,
        tipo: 'dono'
      });

    if (vinculoError) {
      console.error('Erro ao criar vínculo:', vinculoError);
      // Rollback: excluir usuário Auth e empresa para evitar registros órfãos
      console.log('Desfazendo usuário Auth e empresa devido à falha no vínculo...');
      await supabaseAdmin.auth.admin.deleteUser(userId);
      await supabaseAdmin.from('empresas').delete().eq('id', empresaId);

      return new Response(JSON.stringify({ success: false, error: vinculoError.message || 'Erro ao vincular o administrador à empresa.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log('Empresa e administrador vinculados com sucesso!');
    return new Response(JSON.stringify({
      success: true,
      empresa_id: empresaId,
      user_id: userId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err: any) {
    console.error('Erro inesperado em create-company:', err);
    return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
