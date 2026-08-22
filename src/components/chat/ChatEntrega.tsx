import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { ChatMessage, Entrega } from '../../types';
import { Send, User, Store, Shield, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { enviarPushNotificacaoChat } from '../../utils/fcmPush';

interface ChatEntregaProps {
  entrega: Entrega;
  remetenteTipo: 'empresa' | 'restaurante' | 'motoboy';
  remetenteNome: string;
  onClose?: () => void;
}

export default function ChatEntrega({ entrega, remetenteTipo, remetenteNome, onClose }: ChatEntregaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
    const channel = subscribeToMessages();
    markMessagesAsRead();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [entrega.id]);

  useEffect(() => {
    scrollToBottom();
    if (messages.some(m => !m.lida && m.remetente_tipo !== remetenteTipo)) {
      markMessagesAsRead();
    }
  }, [messages]);

  const markMessagesAsRead = async () => {
    try {
      await supabase
        .from('chat_entregas')
        .update({ lida: true })
        .eq('entrega_id', entrega.id)
        .neq('remetente_tipo', remetenteTipo)
        .eq('lida', false);
    } catch (err) {
      console.error('Erro ao marcar mensagens como lidas:', err);
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_entregas')
        .select('*')
        .eq('entrega_id', entrega.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Erro ao buscar mensagens:', err);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`chat_entrega:${entrega.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_entregas',
          filter: `entrega_id=eq.${entrega.id}`
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages((prev) => {
            // Evitar duplicatas (idempotência)
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return channel;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const { data, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = data?.user;
      if (!user) throw new Error('Usuário não autenticado');

      const messageData = {
        entrega_id: entrega.id,
        empresa_id: entrega.empresa_id,
        restaurante_id: entrega.restaurante_id,
        motoboy_id: entrega.motoboy_id,
        remetente_id: user.id,
        remetente_tipo: remetenteTipo,
        remetente_nome: remetenteNome,
        mensagem: newMessage.trim(),
      };

      const { data: insertedMsg, error } = await supabase
        .from('chat_entregas')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;
      setNewMessage('');

      // Enviar notificação push FCM para o destinatário (motoboy)
      if (insertedMsg) {
        enviarPushNotificacaoChat({
          message: insertedMsg,
          restauranteNome: entrega.restaurantes?.nome || remetenteNome
        });
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setSending(false);
    }
  };

  const getRemetenteIcon = (tipo: string) => {
    switch (tipo) {
      case 'empresa': return <Shield size={12} />;
      case 'restaurante': return <Store size={12} />;
      case 'motoboy': return <User size={12} />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-2xl overflow-hidden border border-neutral-200">
      {/* Header */}
      <div className="bg-neutral-900 px-4 py-2.5 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-white/20 p-1.5 rounded-lg">
            <User size={16} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-xs leading-tight">Chat da Entrega #{String(entrega?.numero || '')}</h3>
            <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">
              {entrega.motoboys?.nome || 'Aguardando Motoboy'}
            </p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-3 bg-neutral-50/50"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin text-neutral-400" size={20} />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="bg-white p-3 rounded-xl mb-2 shadow-xs border border-neutral-100">
              <User size={20} className="text-neutral-300" />
            </div>
            <p className="text-xs font-bold text-neutral-400 uppercase tracking-tight">Sem mensagens ainda</p>
            <p className="text-[10px] text-neutral-400 mt-0.5 uppercase font-bold px-2">
              Inicie uma conversa com o motoboy ou empresa para tirar dúvidas.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.remetente_tipo === remetenteTipo;
            return (
              <div 
                key={m.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                {!isMe && (
                  <div className="flex items-center gap-1 mb-0.5 ml-1">
                    <span className="text-[8px] font-black text-neutral-400 border border-neutral-200 px-1 rounded flex items-center gap-1 uppercase">
                      {getRemetenteIcon(m.remetente_tipo)} {m.remetente_tipo}
                    </span>
                    <span className="text-[9px] font-black text-neutral-500 uppercase tracking-tighter">
                      {m.remetente_nome}
                    </span>
                  </div>
                )}
                <div 
                  className={`max-w-[80%] p-2.5 rounded-xl text-xs font-medium shadow-xs leading-relaxed ${
                    isMe 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-white text-neutral-800 border border-neutral-100 rounded-tl-none'
                  }`}
                >
                  {m.mensagem}
                </div>
                <span className="text-[8px] font-bold text-neutral-400 mt-0.5 uppercase mx-1">
                  {format(new Date(m.created_at), 'HH:mm', { locale: ptBR })}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="p-2.5 bg-white border-t border-neutral-100 shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input 
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-semibold focus:border-indigo-500 outline-none transition-all"
            disabled={sending}
          />
          <button 
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-neutral-900 text-white px-3 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center shrink-0"
          >
            {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
