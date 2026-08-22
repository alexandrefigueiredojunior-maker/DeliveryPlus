import { supabase } from '../lib/supabase';

export interface ActiveMotoboyInfo {
  id: string;
  nome: string;
  count: number;
}

/**
 * Busca motoboys que possuem entregas ativas (aceita, coletada, em_rota) para este restaurante
 * e que ainda não atingiram o limite de entregas por motoboy da empresa.
 */
export const fetchActiveMotoboysForRestaurante = async (
  restauranteId: string,
  empresa: { limite_entregas_por_motoboy?: number } | null
): Promise<ActiveMotoboyInfo[]> => {
  try {
    const { data: activeDeliveries, error } = await supabase
      .from('entregas')
      .select('motoboy_id')
      .eq('restaurante_id', restauranteId)
      .in('status', ['aceita', 'coletada', 'em_rota'])
      .not('motoboy_id', 'is', null);

    if (error || !activeDeliveries || activeDeliveries.length === 0) {
      return [];
    }

    const motoboyIds = Array.from(new Set(activeDeliveries.map((d: any) => d.motoboy_id)));

    const { data: motoboysData, error: mbError } = await supabase
      .rpc('listar_motoboys_para_restaurante');

    if (mbError || !motoboysData) {
      return [];
    }

    const filteredMotoboys = motoboysData.filter((m: any) => motoboyIds.includes(m.id));

    const motoboyCounts: { [key: string]: { id: string; nome: string; count: number } } = {};

    activeDeliveries.forEach((d: any) => {
      const mbInfo = filteredMotoboys.find((m: any) => m.id === d.motoboy_id);
      if (d.motoboy_id && mbInfo) {
        if (!motoboyCounts[d.motoboy_id]) {
          motoboyCounts[d.motoboy_id] = {
            id: d.motoboy_id,
            nome: mbInfo.nome,
            count: 0
          };
        }
        motoboyCounts[d.motoboy_id].count++;
      }
    });

    const countsArray = Object.values(motoboyCounts);
    const limit = empresa?.limite_entregas_por_motoboy || 1;

    return countsArray.filter(m => m.count < limit);
  } catch (err) {
    console.error('Erro ao buscar motoboys ativos para agrupamento:', err);
    return [];
  }
};

/**
 * Executa o despacho de uma entrega existente
 */
export const despacharEntregaExistente = async ({
  entregaId,
  empresaId,
  restauranteId,
  motoboyId,
  modoDistribuicao,
}: {
  entregaId: string;
  empresaId: string;
  restauranteId: string;
  motoboyId?: string | null;
  modoDistribuicao?: string;
}) => {
  if (motoboyId) {
    // 1. Enviar para o mesmo motoboy (Agrupamento)
    const { error: updateError } = await supabase
      .from('entregas')
      .update({
        status: 'aceita',
        motoboy_id: motoboyId
      })
      .eq('id', entregaId);

    if (updateError) throw updateError;

    await supabase.from('historico_status_entregas').insert({
      entrega_id: entregaId,
      empresa_id: empresaId,
      restaurante_id: restauranteId,
      motoboy_id: motoboyId,
      status: 'aceita',
      descricao: 'Solicitou mesmo motoboy (Agrupamento)'
    });

    return { success: true, status: 'aceita', motoboyId };
  } else {
    // 2. Distribuição Automática ou Manual conforme modoDistribuicao
    if (modoDistribuicao === 'manual') {
      const { error: updateError } = await supabase
        .from('entregas')
        .update({
          status: 'aguardando_despacho',
          motoboy_id: null
        })
        .eq('id', entregaId);

      if (updateError) throw updateError;

      await supabase.from('historico_status_entregas').insert({
        entrega_id: entregaId,
        empresa_id: empresaId,
        restaurante_id: restauranteId,
        status: 'aguardando_despacho',
        descricao: 'Aguardando despacho manual'
      });

      return { success: true, status: 'aguardando_despacho', isManual: true };
    } else {
      // 'todos_online' ou 'raio_progressivo'
      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('entregas')
        .update({
          status: 'pendente',
          motoboy_id: null,
          ultima_tentativa_distribuicao_em: nowIso
        })
        .eq('id', entregaId);

      if (updateError) throw updateError;

      await supabase.from('historico_status_entregas').insert({
        entrega_id: entregaId,
        empresa_id: empresaId,
        restaurante_id: restauranteId,
        status: 'pendente',
        descricao: 'Motoboy solicitado pelo restaurante'
      });

      return { success: true, status: 'pendente' };
    }
  }
};
