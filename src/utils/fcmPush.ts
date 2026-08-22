import { supabase } from '../lib/supabase';

export interface ChatPushPayload {
  message: {
    id?: string;
    entrega_id: string;
    empresa_id?: string;
    restaurante_id: string;
    motoboy_id: string | null;
    remetente_id?: string;
    remetente_tipo: string;
    remetente_nome?: string;
    mensagem?: string;
  };
  restauranteNome?: string;
}

/**
 * Envia notificação push FCM para o motoboy quando uma nova mensagem no chat é criada.
 */
export async function enviarPushNotificacaoChat({ message, restauranteNome }: ChatPushPayload) {
  // 1. Log: Nova mensagem detectada
  console.log('Nova mensagem detectada', message);

  try {
    // Evitar notificações duplicadas: enviar apenas para o destinatário
    // Se o remetente for o próprio motoboy, não envia para ele mesmo
    if (message.remetente_tipo === 'motoboy') {
      console.log('Remetente é o próprio motoboy. Notificação push ignorada para evitar duplicidade.');
      return;
    }

    if (!message.motoboy_id) {
      console.log('A entrega ainda não possui um motoboy atribuído.');
      return;
    }

    // 2. Log: Destinatário encontrado
    console.log('Destinatário encontrado', {
      motoboy_id: message.motoboy_id,
      remetente_tipo: message.remetente_tipo,
    });

    // 3. Buscar Token FCM na tabela motoboys
    const { data: motoboyData, error: mbErr } = await supabase
      .from('motoboys')
      .select('fcm_token, nome')
      .eq('id', message.motoboy_id)
      .maybeSingle();

    if (mbErr) {
      console.error('Erro ao buscar motoboy no banco:', mbErr);
    }

    const fcmToken = motoboyData?.fcm_token;

    if (!fcmToken) {
      // 5. Log: Erro ao enviar push (token ausente)
      console.error('Erro ao enviar push', 'Token FCM não encontrado para o motoboy ' + message.motoboy_id);
      return;
    }

    // 3. Log: Token FCM encontrado
    console.log('Token FCM encontrado', { fcm_token: fcmToken });

    // Definir Título e Corpo conforme remetente
    const title = 'Nova mensagem';
    let body = 'Nova mensagem recebida.';

    if (message.remetente_tipo === 'cliente') {
      body = 'Cliente enviou uma mensagem.';
    } else {
      // Restaurante ou empresa
      let nomeRest = restauranteNome || message.remetente_nome || 'Restaurante';
      if (!restauranteNome && message.restaurante_id) {
        const { data: restData } = await supabase
          .from('restaurantes')
          .select('nome')
          .eq('id', message.restaurante_id)
          .maybeSingle();
        if (restData?.nome) {
          nomeRest = restData.nome;
        }
      }
      body = `Restaurante ${nomeRest} enviou uma mensagem.`;
    }

    const payload = {
      type: 'chat',
      entrega_id: message.entrega_id,
      restaurante_id: message.restaurante_id,
      motoboy_id: message.motoboy_id,
    };

    const bodyPayload = {
      token: fcmToken,
      title,
      body,
      data: payload,
      message,
    };

    console.log("Chamando Edge notify-new-delivery", bodyPayload);

    const { data, error } = await supabase.functions.invoke('notify-new-delivery', {
      body: bodyPayload,
    });

    console.log("Retorno da Edge notify-new-delivery", { data, error });

    if (error) {
      console.warn('Alerta ao invocar Edge Function notify-new-delivery:', error);
    }

    // 4. Log: Push enviada
    console.log('Push enviada', {
      token: fcmToken,
      title,
      body,
      payload,
    });

  } catch (err) {
    // 5. Log: Erro ao enviar push
    console.error('Erro ao enviar push', err);
  }
}
