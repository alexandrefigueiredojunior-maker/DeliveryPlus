import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Buscar restaurantes com Anota AI ativo
    const { data: restaurantes, error: resError } = await supabaseClient
      .from('restaurantes')
      .select('*')
      .eq('anota_ai_active', true)

    if (resError) throw resError;

    const results = [];

    for (const restaurante of restaurantes) {
      try {
        const clientId = restaurante.anota_ai_client_id;
        const clientSecret = restaurante.anota_ai_client_secret;

        if (!clientId || !clientSecret) continue;

        // 2. Autenticação - Gerar Token
        // Nota: URL base e endpoint de auth baseados na documentação Anota AI
        const authResponse = await fetch('https://api.anota.ai/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId,
            clientSecret
          })
        });

        if (!authResponse.ok) {
          console.error(`Erro auth Anota AI (${restaurante.nome}):`, await authResponse.text());
          continue;
        }

        const authData = await authResponse.json();
        const token = authData.accessToken;

        // 3. Buscar Pedidos (Sync)
        // Buscando pedidos pendentes/novos
        const ordersResponse = await fetch('https://api.anota.ai/v1/orders?status=new', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!ordersResponse.ok) {
           console.error(`Erro buscar pedidos Anota AI (${restaurante.nome}):`, await ordersResponse.text());
           continue;
        }

        const orders = await ordersResponse.json();

        // 4. Processar Pedidos
        for (const order of orders) {
          const orderNum = order.id || order.shortId;

          // Verificar duplicidade
          const { data: existing } = await supabaseClient
            .from('entregas')
            .select('id')
            .eq('numero', orderNum.toString())
            .eq('restaurante_id', restaurante.id)
            .maybeSingle();

          if (existing) continue;

          // Mapeamento de payload Anota AI -> DeliveryPlus
          const customer = order.customer || {};
          const address = order.address || {};
          const payment = order.payment || {};

          const payload = {
            empresa_id: restaurante.empresa_id,
            restaurante_id: restaurante.id,
            numero: orderNum.toString(),
            cliente_nome: customer.name || 'Cliente Anota AI',
            cliente_telefone: customer.phone,
            endereco_entrega: address.formattedAddress || `${address.street}, ${address.number} - ${address.neighborhood}`,
            latitude_entrega: address.coordinates?.lat,
            longitude_entrega: address.coordinates?.lng,
            forma_pagamento: payment.method || 'Anota AI',
            valor: parseFloat((order.total || 0).toFixed(2)),
            status: 'aguardando_despacho',
            observacao: order.notes || ''
          };

          const { data: newEntrega, error: insertError } = await supabaseClient
            .from('entregas')
            .insert(payload)
            .select()
            .single();

          if (insertError) {
            console.error('Erro ao inserir entrega Anota AI:', insertError);
            continue;
          }

          // Histórico
          await supabaseClient
            .from('historico_status_entregas')
            .insert([
              {
                entrega_id: newEntrega.id,
                empresa_id: restaurante.empresa_id,
                restaurante_id: restaurante.id,
                status: 'aguardando_despacho',
                descricao: 'Pedido importado via integração oficial Anota AI'
              }
            ]);

          results.push({ restaurante: restaurante.nome, numero: orderNum, status: 'criado' });
        }

      } catch (err) {
        console.error(`Erro processando Anota AI para ${restaurante.nome}:`, err);
      }
    }

    return new Response(JSON.stringify({
      sucesso: true,
      processados: results.length,
      detalhes: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
