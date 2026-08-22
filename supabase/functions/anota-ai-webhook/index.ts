import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  // 1. Manusear OPTIONS para CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  // Log de Debug (Headers)
  const headersObj: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headersObj[key] = value;
  });
  console.log('--- NOVO WEBHOOK ANOTA AI ---');
  console.log('Headers recebidos:', JSON.stringify(headersObj));

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json();
    console.log('--- NOVO WEBHOOK ANOTA AI ---');
    console.log('Chaves do Payload:', Object.keys(body).join(', '));
    console.log('Body completo:', JSON.stringify(body));

    // 2. Extrair informações básicas do evento e dados
    const eventType = body.type || body.event || 'ORDER_NEW';
    const orderData = body.order || body.data || body;
    
    // Identificação flexível do ID Externo do Restaurante
    const externalStoreId = 
      body.merchantId || body.storeId || 
      body.externalId || body.external_id || 
      body.restaurantExternalId || body.merchantExternalId || body.idExternoRestaurante ||
      orderData.merchantId || orderData.store_id || orderData.externalId;

    // 3. TENTAR ENCONTRAR O TOKEN DE SEGURANÇA
    const tokenRecebido = 
      req.headers.get('token-externo') || 
      req.headers.get('x-token') || 
      req.headers.get('x-api-key') ||
      req.headers.get('Authorization')?.replace('Bearer ', '') ||
      body.token_externo ||
      body.api_key ||
      body.token;

    console.log(`Token detectado: ${tokenRecebido ? 'Presente (final ' + tokenRecebido.slice(-4) + ')' : 'Ausente'}`);
    console.log(`ID Externo detectado: ${externalStoreId || 'Ausente'}`);

    // 4. Localizar o restaurante
    let restaurante = null;

    if (tokenRecebido) {
      // Prioridade 1: Buscar pelo Token (Secret ou API Key)
      const { data: resBySecret } = await supabaseClient
        .from('restaurantes')
        .select('*, empresas(*)')
        .or(`anota_ai_client_secret.eq."${tokenRecebido}",anota_ai_client_id.eq."${tokenRecebido}"`)
        .eq('anota_ai_active', true)
        .maybeSingle();
      
      if (resBySecret) {
        restaurante = resBySecret;
        console.log(`Restaurante identificado pelo Token: ${restaurante.nome} (ID: ${restaurante.id})`);
      } else {
        // Tentar buscar pela empresa se o token for o api_key da empresa
        const { data: empresaByToken } = await supabaseClient
          .from('empresas')
          .select('id, nome')
          .eq('api_key', tokenRecebido)
          .maybeSingle();

        if (empresaByToken) {
          console.log(`Empresa identificada pelo Token: ${empresaByToken.nome}`);
          // Se identificamos a empresa, precisamos de um externalStoreId para saber qual restaurante dela
          if (externalStoreId) {
            const { data: resByEmpresa } = await supabaseClient
              .from('restaurantes')
              .select('*')
              .eq('empresa_id', empresaByToken.id)
              .eq('anota_ai_external_id', externalStoreId.toString())
              .eq('anota_ai_active', true)
              .maybeSingle();
            
            if (resByEmpresa) {
              restaurante = { ...resByEmpresa, empresas: empresaByToken };
              console.log(`Restaurante identificado via Empresa + ID Externo: ${restaurante.nome}`);
            }
          }
        }
      }
    }

    if (!restaurante && externalStoreId) {
      // Prioridade 3: Buscar apenas pelo ID Externo (se não houver token ou token não achou nada)
      const { data: resById } = await supabaseClient
        .from('restaurantes')
        .select('*, empresas(*)')
        .eq('anota_ai_external_id', externalStoreId.toString())
        .eq('anota_ai_active', true)
        .maybeSingle();
      
      if (resById) {
        restaurante = resById;
        console.log(`Restaurante identificado apenas pelo ID Externo: ${restaurante.nome}`);
        
        // Se encontramos pelo ID mas existe um secret cadastrado, validamos o token
        if (restaurante.anota_ai_client_secret && restaurante.anota_ai_client_secret !== tokenRecebido) {
             console.warn(`Token INVÁLIDO para o restaurante: ${restaurante.nome}`);
             return new Response(JSON.stringify({ error: 'Falha na autenticação do webhook' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
             });
        }
      }
    }

    if (!restaurante) {
      console.error('Falha na identificação do restaurante: Critérios não atendidos ou dados insuficientes');
      
      const isPing = ['ping', 'test', 'check'].includes(eventType.toLowerCase());
      if (isPing) {
        return new Response(JSON.stringify({ sucesso: true, mensagem: 'Ping recebido, mas loja não identificada no sistema' }));
      }

      // Se não identificamos o restaurante, ignoramos como sucesso se não for um pedido para não sujar logs do Anota AI
      const isActuallyOrder = !!(orderData.customer || orderData.items || orderData.id);
      if (!isActuallyOrder) {
        return new Response(JSON.stringify({ 
          sucesso: true, 
          ignorado: true, 
          motivo: 'Webhook de evento não identificado e sem dados de pedido' 
        }));
      }

      return new Response(JSON.stringify({ error: 'Restaurante não identificado ou inativo' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 5. Filtrar eventos que não são pedidos (ex: atualizações de cardápio, itens, etc)
    const orderEvents = [
      'ORDER_NEW', 'order.new', 'order.created', 'CREATED',
      'ORDER_CANCELLED', 'order.cancelled', 'CANCELLED', 'order.cancel',
      'ORDER_UPDATED', 'order.updated', 'UPDATED'
    ];

    if (!orderEvents.map(e => e.toUpperCase()).includes(eventType.toUpperCase()) && !body._id) {
       console.log(`Evento ignorado: ${eventType}`);
       return new Response(JSON.stringify({ 
         sucesso: true, 
         ignorado: true, 
         motivo: `O evento '${eventType}' não é um evento de pedido processável` 
       }), {
         status: 200,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    }

    // 6. Dados do Pedido
    const orderNum = (orderData.id || orderData.shortId || orderData.numero || orderData.orderId || body._id)?.toString();
    
    // Verificar se temos dados mínimos de um pedido para criação
    const customer = orderData.customer || {};
    const address = orderData.address || {};
    const payment = orderData.payment || {};
    
    const isNewOrder = ['ORDER_NEW', 'order.new', 'order.created', 'CREATED'].includes(eventType.toUpperCase());
    const isCancelledOrder = ['ORDER_CANCELLED', 'order.cancelled', 'CANCELLED', 'order.cancel'].includes(eventType.toUpperCase());

    if (isNewOrder) {
      if (!orderNum || !customer.name || (!address.formattedAddress && !address.street)) {
        console.log('Evento de novo pedido recebido mas faltam dados essenciais:', { 
          orderNum, 
          customerName: !!customer.name, 
          address: !!(address.formattedAddress || address.street) 
        });
        return new Response(JSON.stringify({ 
          sucesso: true, 
          ignorado: true, 
          motivo: "Dados de pedido incompletos para criação de entrega" 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verificar duplicidade
      const { data: existing } = await supabaseClient
        .from('entregas')
        .select('id')
        .eq('numero', orderNum)
        .eq('restaurante_id', restaurante.id)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ sucesso: true, mensagem: 'Pedido já processado como entrega' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Mapeamento final do payload
      const payload = {
        empresa_id: restaurante.empresa_id,
        restaurante_id: restaurante.id,
        numero: orderNum,
        cliente_nome: customer.name || 'Cliente Anota AI',
        cliente_telefone: customer.phone || 'Não informado',
        endereco_entrega: address.formattedAddress || `${address.street || ''}, ${address.number || ''} - ${address.neighborhood || ''}`,
        latitude_entrega: address.coordinates?.lat || address.lat,
        longitude_entrega: address.coordinates?.lng || address.lng,
        forma_pagamento: payment.method || 'Anota AI',
        valor: parseFloat((orderData.total || orderData.total_amount || 0).toFixed(2)),
        status: 'aguardando_despacho',
        observacao: orderData.notes || orderData.observacao || ''
      };

      const { data: newEntrega, error: insertError } = await supabaseClient
        .from('entregas')
        .insert(payload)
        .select()
        .single();

      if (insertError) throw insertError;

      // Criar Histórico
      await supabaseClient.from('historico_status_entregas').insert([
        {
          entrega_id: newEntrega.id,
          empresa_id: restaurante.empresa_id,
          restaurante_id: restaurante.id,
          status: 'aguardando_despacho',
          descricao: 'Pedido criado automaticamente via Webhook Anota AI'
        }
      ]);

      return new Response(JSON.stringify({ 
        sucesso: true, 
        acao: 'entrega_criada', 
        id: newEntrega.id,
        numero: orderNum
      }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } 

    if (isCancelledOrder) {
      const { data: entrega, error: getError } = await supabaseClient
        .from('entregas')
        .select('id, status')
        .eq('numero', orderNum)
        .eq('restaurante_id', restaurante.id)
        .maybeSingle();
          
      if (!getError && entrega) {
        if (entrega.status !== 'cancelada' && entrega.status !== 'entregue') {
          await supabaseClient
            .from('entregas')
            .update({ status: 'cancelada' })
            .eq('id', entrega.id);
                
          await supabaseClient.from('historico_status_entregas').insert({
            entrega_id: entrega.id,
            empresa_id: restaurante.empresa_id,
            restaurante_id: restaurante.id,
            status: 'cancelada',
            descricao: 'Entrega cancelada via Webhook Anota AI (Pedido Cancelado)'
          });
            
          return new Response(JSON.stringify({ sucesso: true, acao: 'entrega_cancelada', id: entrega.id }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      return new Response(JSON.stringify({ 
        sucesso: true, 
        mensagem: 'Pedido de cancelamento recebido mas entrega não pôde ser cancelada ou não existe' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Se for outros status (ex: pronto, em produção)
    return new Response(JSON.stringify({ sucesso: true, mensagem: `Evento '${eventType}' processado sem alterações no sistema logístico` }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Erro crítico no processamento do webhook Anota AI:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
