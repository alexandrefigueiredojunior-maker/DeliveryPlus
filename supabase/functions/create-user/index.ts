import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('Function chamada: create-user')
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY') ?? '';

    console.log('SUPABASE_URL existe:', !!supabaseUrl);
    console.log('SERVICE_ROLE_KEY existe:', !!serviceRoleKey);

    const supabaseClient = createClient(
      supabaseUrl,
      serviceRoleKey, // Use Service Role for admin tasks
      { auth: { persistSession: false } }
    )

    const body = await req.json()
    const { email, password, role, empresa_id, data } = body
    
    console.log('Dados recebidos:', { 
      email, 
      role, 
      empresa_id, 
      data, 
      password: password ? '********' : 'não fornecida' 
    })

    if (!email || !password || !empresa_id || !role) {
      console.error('Erro de validação: campos obrigatórios ausentes')
      return new Response(JSON.stringify({ error: 'Campos obrigatórios: email, password, empresa_id, role' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 1. Criar usuário no Auth
    console.log('Iniciando criação de usuário Auth...')
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { empresa_id, role, nome: data.nome }
    })

    if (authError) {
      console.error('Erro ao criar usuário Auth:', authError)
      // Traduzir erro comum de usuário já cadastrado
      if (authError.message.includes('User already registered') || authError.message.includes('already exists')) {
        return new Response(JSON.stringify({ error: 'Este e-mail já está em uso por outro usuário.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      throw authError
    }
    
    const userId = authData.user.id
    console.log('Usuário Auth criado com sucesso ID:', userId)

    // 2. Salvar na respectiva tabela (motoboys ou restaurantes)
    const table = role === 'motoboy' ? 'motoboys' : 'restaurantes'
    console.log(`Iniciando inserção na tabela ${table}...`)
    
    const { error: dbError } = await supabaseClient
      .from(table)
      .insert({
        ...data,
        user_id: userId,
        empresa_id
      })

    if (dbError) {
      console.error(`Erro ao inserir na tabela ${table}:`, dbError)
      // Se falhar a inserção no DB, deletar o usuário criado no Auth para evitar inconsistência
      console.log('Deletando usuário Auth para manter consistência...')
      await supabaseClient.auth.admin.deleteUser(userId)
      throw dbError
    }

    console.log('Processo concluído com sucesso!')
    return new Response(JSON.stringify({ success: true, user: authData.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error('Erro geral create-user:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
