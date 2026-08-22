import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface OrderRequest {
  api_key: string;
  restaurante_id: string;
  numero: string;
  cliente_nome?: string;
  cliente_telefone?: string;
  endereco_entrega: string;
  latitude_entrega?: number;
  longitude_entrega?: number;
  forma_pagamento?: string;
  observacao?: string;
  valor_pedido?: number;
}

// Adaptadores para diferentes plataformas
function transformPayload(body: any, source: string): { data: OrderRequest, detectedSource: string } {
  let finalSource = source;
  let data: OrderRequest;

  // Detecção automática de Cardápio Web
  if (source === 'cardapio_web' || body.pedido_id || body.id_pedido) {
    finalSource = 'cardapio_web';
    data = {
      api_key: body.api_key || body.token,
      restaurante_id: body.restaurante_id || body.loja_id || body.id_loja,
      numero: (body.pedido_id || body.id_pedido || body.numero_pedido)?.toString(),
      cliente_nome: body.nome_cliente || body.cliente?.nome,
      cliente_telefone: body.whatsapp || body.celular || body.cliente?.telefone,
      endereco_entrega: body.endereco_completo || body.endereco?.logradouro,
      latitude_entrega: body.lat || body.latitude,
      longitude_entrega: body.lng || body.longitude,
      forma_pagamento: body.pagamento || body.forma_pagamento,
      valor_pedido: body.valor_total || body.total,
      observacao: body.obs || body.observacao
    };
  } else if (source === 'open_delivery' || body.orderId || body.merchant || body.eventType) {
    finalSource = 'open_delivery';
    
    // Se for um evento que contém o pedido (ex: ORDER_NEW)
    const order = body.order || body;
    const delivery = order.delivery || {};
    const address = delivery.deliveryAddress || {};
    const customer = order.customer || {};
    const payments = order.payments?.methods || [];
    
    data = {
      api_key: order.api_key || order.merchant?.id, 
      restaurante_id: order.restaurante_id || order.merchant?.id,
      numero: order.displayId || order.orderId || order.id,
      cliente_nome: customer.name,
      cliente_telefone: customer.phone?.number,
      endereco_entrega: address.formattedAddress || (address.street ? `${address.street}, ${address.number} - ${address.neighborhood}` : undefined),
      latitude_entrega: address.coordinates?.latitude,
      longitude_entrega: address.coordinates?.longitude,
      forma_pagamento: payments[0]?.method,
      valor_pedido: order.total?.subTotal || order.orderAmount,
      observacao: order.notes || order.additionalInfo
    };
  } else if (source === 'anota_ai' || body.order_id || (body.order && body.order.id)) {
    finalSource = 'anota_ai';
    const order = body.order || body;
    data = {
      api_key: order.api_key || body.api_key || order.token,
      restaurante_id: order.restaurante_id || body.restaurante_id || order.merchant_id,
      numero: (order.order_id || order.id || order.shortId || order.displayId)?.toString(),
      cliente_nome: order.customer?.name || order.nome_cliente,
      cliente_telefone: order.customer?.phone || order.telefone_cliente,
      endereco_entrega: order.address?.formatted_address || order.delivery_address || (order.address?.street ? `${order.address.street}, ${order.address.number}` : undefined),
      latitude_entrega: order.address?.coordinates?.lat || order.address?.lat,
      longitude_entrega: order.address?.coordinates?.lng || order.address?.lng,
      forma_pagamento: order.payment?.method || order.forma_pagamento,
      valor_pedido: order.total_amount || order.total || order.orderAmount,
      observacao: order.notes || order.observacao
    };
  } else if (source === 'saipos') {
    data = {
      api_key: body.api_key,
      restaurante_id: body.restaurante_id,
      numero: body.codigoDisplay || body.id,
      cliente_nome: body.cliente?.nome,
      cliente_telefone: body.cliente?.telefone,
      endereco_entrega: `${body.endereco?.logradouro}, ${body.endereco?.numero} - ${body.endereco?.bairro}`,
      latitude_entrega: body.endereco?.latitude,
      longitude_entrega: body.endereco?.longitude,
      forma_pagamento: body.pagamentos?.[0]?.nome,
      valor_pedido: body.valorTotal,
      observacao: body.observacao
    };
  } else if (source === 'goomer') {
    data = {
      api_key: body.api_key,
      restaurante_id: body.restaurante_id,
      numero: body.shortId || body.id,
      cliente_nome: body.customer?.name,
      cliente_telefone: body.customer?.phone,
      endereco_entrega: body.deliveryAddress?.formattedAddress,
      latitude_entrega: body.deliveryAddress?.latitude,
      longitude_entrega: body.deliveryAddress?.longitude,
      forma_pagamento: body.payment?.type,
      valor_pedido: body.total,
      observacao: body.comments
    };
  } else {
    data = body as OrderRequest;
  }

  return { data, detectedSource: finalSource };
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url);
    const source = url.searchParams.get('source') || req.headers.get('x-source') || 'generic';
    const body = await req.json();

    const { data, detectedSource } = transformPayload(body, source);

    const { 
      api_key, 
      restaurante_id, 
      numero, 
      cliente_nome, 
      cliente_telefone, 
      endereco_entrega,
      latitude_entrega,
      longitude_entrega,
      forma_pagamento,
      observacao,
      valor_pedido
    } = data;

    if (!api_key) {
      throw new Error('api_key é obrigatória')
    }

    // 1. Validar api_key da empresa
    const { data: empresa, error: empresaError } = await supabaseClient
      .from('empresas')
      .select('*')
      .eq('api_key', api_key)
      .single()

    if (empresaError || !empresa) {
      return new Response(JSON.stringify({ error: 'api_key inválida' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    if (!empresa.permite_pedidos_externos) {
      return new Response(JSON.stringify({ error: 'Esta empresa não permite pedidos externos' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 2. Buscar restaurante e validar se pertence à organização
    const { data: restaurante, error: restauranteError } = await supabaseClient
      .from('restaurantes')
      .select('*')
      .eq('id', restaurante_id)
      .eq('empresa_id', empresa.id)
      .single()

    if (restauranteError || !restaurante) {
      return new Response(JSON.stringify({ error: 'Restaurante não encontrado ou não pertence a esta organização' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // 3. Calcular valor da entrega
    let valorEntrega = empresa.valor_fixo_entrega || 0
    if (empresa.modelo_cobranca_entrega === 'km' && restaurante.latitude && restaurante.longitude && latitude_entrega && longitude_entrega) {
      const distancia = calculateDistance(
        restaurante.latitude,
        restaurante.longitude,
        latitude_entrega,
        longitude_entrega
      )
      valorEntrega = (empresa.valor_por_km || 0) * distancia
      
      // Aplicar valor mínimo se existir
      if (empresa.valor_minimo_entrega && valorEntrega < empresa.valor_minimo_entrega) {
        valorEntrega = empresa.valor_minimo_entrega
      }
    }

    // 4. Buscar configurações de distribuição
    const { data: configDist } = await supabaseClient
      .from('configuracoes_empresas')
      .select('modo_distribuicao')
      .eq('empresa_id', empresa.id)
      .maybeSingle()

    const initialStatus = configDist?.modo_distribuicao === 'manual' ? 'aguardando_despacho' : 'pendente'

    // 5. Criar a entrega
    const { data: entrega, error: entregaError } = await supabaseClient
      .from('entregas')
      .insert({
        empresa_id: empresa.id,
        restaurante_id: restaurante.id,
        numero,
        cliente_nome,
        cliente_telefone,
        endereco_entrega,
        latitude_entrega,
        longitude_entrega,
        forma_pagamento,
        observacao,
        valor: parseFloat(valorEntrega.toFixed(2)),
        status: initialStatus
      })
      .select('id, numero')
      .single()

    if (entregaError) {
      console.error('Erro ao criar entrega:', entregaError)
      throw new Error(`Erro ao criar entrega: ${entregaError.message}`)
    }

    // 6. Criar histórico
    await supabaseClient
      .from('historico_status_entregas')
      .insert([
        {
          entrega_id: entrega.id,
          empresa_id: empresa.id,
          restaurante_id: restaurante.id,
          status: initialStatus,
          descricao: initialStatus === 'aguardando_despacho' 
            ? `Pedido recebido via integração (${detectedSource}) - Aguardando despacho manual`
            : `Pedido recebido via integração (${detectedSource}) - Buscando motoboy`
        }
      ])

    return new Response(JSON.stringify({
      sucesso: true,
      entrega_id: entrega.id,
      numero: entrega.numero
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
