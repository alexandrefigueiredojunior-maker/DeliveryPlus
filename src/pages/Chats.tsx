import { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import { supabase } from '../lib/supabase';
import { Entrega, ChatMessage } from '../types';
import { Search, Filter, MessageSquare, Clock, User, Store, ArrowRight, Loader2, SearchX } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import ChatEntrega from '../components/chat/ChatEntrega';
import { useEmpresa } from '../contexts/EmpresaContext';

interface ChatSummary {
  entrega: Entrega;
  lastMessage: ChatMessage;
  unreadCount: number;
}

export default function Chats() {
  const { empresa } = useEmpresa();
  const [summaries, setSummaries] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ativos' | 'finalizados'>('ativos');
  const [search, setSearch] = useState('');
  const [selectedEntrega, setSelectedEntrega] = useState<Entrega | null>(null);

  useEffect(() => {
    if (empresa) {
      fetchChats();
      
      const channel = supabase
        .channel('public:chat_entregas_summary')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_entregas', filter: `empresa_id=eq.${empresa.id}` },
          () => fetchChats()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [empresa, filter]);

  const fetchChats = async () => {
    if (!empresa) return;

    try {
      // 1. Buscar todas as mensagens da empresa
      const { data: messages, error: msgError } = await supabase
        .from('chat_entregas')
        .select('*')
        .eq('empresa_id', empresa.id)
        .order('created_at', { ascending: false });

      if (msgError) throw msgError;

      if (!messages || messages.length === 0) {
        setSummaries([]);
        setLoading(false);
        return;
      }

      // 2. Extrair IDs de entrega únicos
      const entregaIds = Array.from(new Set(messages.map(m => m.entrega_id)));

      // 3. Buscar detalhes das entregas
      const statusFilter = filter === 'ativos' 
        ? ['aceita', 'coletada', 'em_rota']
        : ['entregue', 'cancelada'];

      const { data: entregas, error: entError } = await supabase
        .from('entregas')
        .select(`
          *,
          restaurantes (nome),
          motoboys (nome)
        `)
        .in('id', entregaIds)
        .in('status', statusFilter);

      if (entError) throw entError;

      // 4. Montar os resumos
      const newSummaries: ChatSummary[] = (entregas || []).map(entrega => {
        const entregaMessages = messages.filter(m => m.entrega_id === entrega.id);
        const lastMessage = entregaMessages[0];
        const unreadCount = entregaMessages.filter(m => !m.lida && m.remetente_tipo !== 'empresa').length;

        return {
          entrega,
          lastMessage,
          unreadCount
        };
      });

      // Ordenar por data da última mensagem
      newSummaries.sort((a, b) => {
        const dateA = a.lastMessage?.created_at ? new Date(a.lastMessage.created_at).getTime() : 0;
        const dateB = b.lastMessage?.created_at ? new Date(b.lastMessage.created_at).getTime() : 0;
        return dateB - dateA;
      });

      setSummaries(newSummaries);
    } catch (err) {
      console.error('Erro ao buscar chats:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSummaries = summaries.filter(s => {
    if (!s.entrega) return false;
    const numero = String(s.entrega.numero || '').toLowerCase();
    const restauranteNome = String(s.entrega.restaurantes?.nome || '').toLowerCase();
    const motoboyNome = String(s.entrega.motoboys?.nome || '').toLowerCase();
    const searchTerm = search.toLowerCase();
    
    return numero.includes(searchTerm) || 
           restauranteNome.includes(searchTerm) || 
           motoboyNome.includes(searchTerm);
  });

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-neutral-900 uppercase tracking-tight">Chats de Entrega</h1>
            <p className="text-xs text-neutral-500 font-medium">Acompanhe a comunicação em tempo real.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-130px)] min-h-[500px]">
          {/* Lista de Chats */}
          <div className="lg:col-span-4 flex flex-col space-y-3 h-full overflow-hidden">
            <div className="flex bg-neutral-100 p-1 rounded-xl gap-1 shrink-0">
              <button
                onClick={() => setFilter('ativos')}
                className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  filter === 'ativos' ? 'bg-white text-indigo-600 shadow-xs' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                Ativos
              </button>
              <button
                onClick={() => setFilter('finalizados')}
                className={`flex-1 py-1.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all ${
                  filter === 'finalizados' ? 'bg-white text-indigo-600 shadow-xs' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                Finalizados
              </button>
            </div>

            <div className="relative shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por pedido, restaurante..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-neutral-200 rounded-xl focus:border-indigo-500 outline-none font-medium text-xs transition-all shadow-xs"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1.5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-neutral-400">
                  <Loader2 className="animate-spin mb-3" size={24} />
                  <p className="text-xs font-bold uppercase tracking-widest">Carregando conversas...</p>
                </div>
              ) : filteredSummaries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center bg-white rounded-2xl border border-dashed border-neutral-200 p-4">
                  <SearchX className="text-neutral-200 mb-2" size={36} />
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-tight px-2">
                    Nenhuma conversa encontrada {search ? 'para sua busca' : `em ${filter}`}
                  </p>
                </div>
              ) : (
                filteredSummaries.map((s) => (
                  <button
                    key={s.entrega?.id}
                    onClick={() => setSelectedEntrega(s.entrega)}
                    className={`w-full p-3 rounded-xl border transition-all text-left group flex gap-3 ${
                      selectedEntrega?.id === s.entrega?.id
                        ? 'bg-indigo-600 border-indigo-600 shadow-md text-white'
                        : 'bg-white border-neutral-100 hover:border-indigo-200 shadow-xs'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                          selectedEntrega?.id === s.entrega?.id ? 'text-indigo-200' : 'text-indigo-600'
                        }`}>
                          Pedido #{s.entrega?.numero}
                        </span>
                        <span className={`text-[10px] font-bold ${
                          selectedEntrega?.id === s.entrega?.id ? 'text-indigo-200' : 'text-neutral-400'
                        }`}>
                          {s.lastMessage?.created_at ? format(new Date(s.lastMessage.created_at), 'HH:mm', { locale: ptBR }) : ''}
                        </span>
                      </div>
                      <h3 className={`text-xs font-black uppercase tracking-tight truncate ${
                        selectedEntrega?.id === s.entrega?.id ? 'text-white' : 'text-neutral-900'
                      }`}>
                        {s.entrega?.restaurantes?.nome || 'Restaurante'}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <User size={11} className={selectedEntrega?.id === s.entrega?.id ? 'text-indigo-200' : 'text-neutral-400'} />
                        <span className={`text-[10px] font-bold uppercase truncate ${
                          selectedEntrega?.id === s.entrega?.id ? 'text-indigo-100' : 'text-neutral-500'
                        }`}>
                          {s.entrega?.motoboys?.nome || 'Pendente'}
                        </span>
                      </div>
                      <p className={`text-[11px] mt-1.5 line-clamp-1 italic ${
                        selectedEntrega?.id === s.entrega?.id ? 'text-indigo-100' : 'text-neutral-400'
                      }`}>
                        "{s.lastMessage?.mensagem || ''}"
                      </p>
                    </div>
                    {s.unreadCount > 0 && selectedEntrega?.id !== s.entrega?.id && (
                      <div className="bg-red-500 text-white text-[10px] font-black h-4 w-4 rounded-full flex items-center justify-center shrink-0 animate-pulse mt-1">
                        {s.unreadCount}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Visualização do Chat */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden flex flex-col h-full">
            <AnimatePresence mode="wait">
              {selectedEntrega ? (
                <motion.div 
                  key={selectedEntrega.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex-1 h-full flex flex-col overflow-hidden"
                >
                  <ChatEntrega 
                    entrega={selectedEntrega}
                    remetenteTipo="empresa"
                    remetenteNome={empresa?.nome || 'Central'}
                  />
                </motion.div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-300">
                  <div className="bg-neutral-50 p-6 rounded-full mb-4">
                    <MessageSquare size={48} className="opacity-20 text-neutral-500" />
                  </div>
                  <h3 className="text-base font-black text-neutral-400 uppercase tracking-tight">Selecione uma conversa</h3>
                  <p className="text-xs font-medium text-neutral-400 mt-1 max-w-xs">
                    Escolha um pedido ao lado para visualizar o histórico de mensagens e responder.
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
