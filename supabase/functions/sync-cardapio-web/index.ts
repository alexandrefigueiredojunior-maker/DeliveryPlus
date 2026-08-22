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

    // 1. Buscar todos os restaurantes com integração ativa
    const { data: restaurantes, error: resError } = await supabaseClient
      .from('restaurantes')
      .select('*, empresas(*)')
      .eq('cardapio_web_active', true)

    if (resError) throw resError;

    const results = [];

    for (const restaurante of restaurantes) {
      try {
        const baseUrl = restaurante.cardapio_web_base_url || 'https://api.cardapioweb.com/v1';
        const apiKey = restaurante.cardapio_web_api_key;
        const storeId = restaurante.cardapio_web_store_id;

        if (!apiKey || !storeId) continue;

        // 2. Buscar pedidos no Cardápio Web
        // Nota: Assumindo endpoint fictício/padrão based on docs comuns de Open Delivery/Cardápio Web
        // Geralmente é GET /orders ou similar
        const cwResponse = await fetch(`${baseUrl}/orders?storeId=${storeId}`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (!cwResponse.ok) {
          console.error(`Erro ao buscar pedidos para restaurante ${restaurante.nome}:`, await cwResponse.text());
          continue;
        }

        const orders = await cwResponse.json();
        
        // 3. Processar cada pedido
        for (const order of orders) {
          // Verificar se já existe no nosso sistema (pelo número do pedido)
          const orderNum = order.displayId || order.orderId || order.id;
          
          const { data: existing } = await supabaseClient
            .from('entregas')
            .select('id')
            .eq('numero', orderNum.toString())
            .eq('restaurante_id', restaurante.id)
            .maybeSingle();

          if (existing) continue; // Já processado

          // Transformar para nosso formato (reaproveitando lógica de detecção de Open Delivery se aplicável)
          const deliveryData = order.delivery || {};
          const address = deliveryData.deliveryAddress || {};
          const customer = order.customer || {};
          const payments = order.payments?.methods || [];

          const payload = {
            empresa_id: restaurante.empresa_id,
            restaurante_id: restaurante.id,
            numero: orderNum.toString(),
            cliente_nome: customer.name,
            cliente_telefone: customer.phone?.number,
            endereco_entrega: address.formattedAddress || (address.street ? `${address.street}, ${address.number} - ${address.neighborhood}` : 'Endereço não informado'),
            latitude_entrega: address.coordinates?.latitude,
            longitude_entrega: address.coordinates?.longitude,
            forma_pagamento: payments[0]?.method || 'Não informado',
            valor: parseFloat((order.total?.subTotal || order.orderAmount || 0).toFixed(2)),
            status: 'aguardando_despacho',
            observacao: order.notes || order.additionalInfo
          };

          // 4. Criar a entrega
          const { data: newEntrega, error: insertError } = await supabaseClient
            .from('entregas')
            .insert(payload)
            .select()
            .single();

          if (insertError) {
            console.error('Erro ao inserir entrega:', insertError);
            continue;
          }

          // 5. Histórico
          await supabaseClient
            .from('historico_status_entregas')
            .insert([
              {
                entrega_id: newEntrega.id,
                empresa_id: restaurante.empresa_id,
                restaurante_id: restaurante.id,
                status: 'aguardando_despacho',
                descricao: 'Pedido importado via API externa Cardápio Web'
              }
            ]);
            
          results.push({ restaurante: restaurante.nome, numero: orderNum, status: 'criado' });
        }
      } catch (err) {
        console.error(`Erro processando restaurante ${restaurante.nome}:`, err);
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
