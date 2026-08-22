import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { supabase } from '../lib/supabase';
import DashboardLayout from '../components/layout/DashboardLayout';
import LiveMap from '../components/dashboard/LiveMap';
import ActiveMotoboysMap from '../components/dashboard/ActiveMotoboysMap';
import { 
  Bike, 
  ShoppingBag, 
  MapPin, 
  TrendingUp, 
  Navigation, 
  X, 
  User, 
  Phone, 
  CreditCard,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Motoboy } from '../types';

export default function Dashboard() {
  const { empresa } = useEmpresa();
  const [stats, setStats] = useState({
    motoboysCount: 0,
    entregasHoje: 0,
    restaurantesAtivos: 0,
    faturamentoHoje: 0,
  });
  const [loading, setLoading] = useState(true);
  const [motoboysAtivos, setMotoboysAtivos] = useState<Motoboy[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingModal, setLoadingModal] = useState(false);

  useEffect(() => {
    if (empresa) {
      fetchStats();

      // Realtime subscription for motoboys status changes
      const channel = supabase
        .channel('dashboard_realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'motoboys',
            filter: `empresa_id=eq.${empresa.id}`,
          },
          () => {
            fetchStats();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [empresa]);

  async function fetchStats() {
    if (!empresa) return;
    setLoading(true);

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString();

      const [motoboysRes, restaurantsRes, entregasRes, faturamentoRes, motoboysAtivosRes] = await Promise.all([
        supabase
          .from('motoboys')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_id', empresa.id)
          .eq('status', 'ativo'),
        supabase
          .from('restaurantes')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_id', empresa.id)
          .eq('status', 'ativo'),
        supabase
          .from('entregas')
          .select('*', { count: 'exact', head: true })
          .eq('empresa_id', empresa.id)
          .gte('created_at', todayStr)
          .lt('created_at', tomorrowStr),
        supabase
          .from('entregas')
          .select('valor')
          .eq('empresa_id', empresa.id)
          .neq('status', 'cancelada')
          .gte('created_at', todayStr)
          .lt('created_at', tomorrowStr),
        supabase
          .from('motoboys')
          .select('*')
          .eq('empresa_id', empresa.id)
          .eq('status', 'ativo')
      ]);

      const totalFaturamento = (faturamentoRes.data || []).reduce((acc, curr) => acc + (curr.valor || 0), 0);

      setStats({
        motoboysCount: motoboysRes.count || 0,
        restaurantesAtivos: restaurantsRes.count || 0,
        entregasHoje: entregasRes.count || 0,
        faturamentoHoje: totalFaturamento,
      });

      setMotoboysAtivos(motoboysAtivosRes.data || []);
    } catch (error) {
      console.error('Erro ao buscar estatísticas do dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const cards = [
    { 
      name: 'Motoboys ativos', 
      value: stats.motoboysCount, 
      icon: Bike, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50',
      clickable: true
    },
    { 
      name: 'Entregas hoje', 
      value: stats.entregasHoje, 
      icon: ShoppingBag, 
      color: 'text-orange-600', 
      bg: 'bg-orange-50' 
    },
    { 
      name: 'Restaurantes parceiros', 
      value: stats.restaurantesAtivos, 
      icon: MapPin, 
      color: 'text-green-600', 
      bg: 'bg-green-50' 
    },
    { 
      name: 'Faturamento Estimado', 
      value: formatCurrency(stats.faturamentoHoje), 
      icon: TrendingUp, 
      color: 'text-purple-600', 
      bg: 'bg-purple-50' 
    },
  ];

  return (
    <DashboardLayout>
      <header className="mb-4">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">Bem-vindo, {empresa?.nome}</h2>
        <p className="text-xs text-neutral-500 mt-0.5">Aqui está o resumo da operação de hoje.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {cards.map((card, idx) => (
          <motion.div
            key={card.name}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => card.clickable && setIsModalOpen(true)}
            className={`bg-white p-4 rounded-xl border border-neutral-200 shadow-xs ${card.clickable ? 'cursor-pointer hover:border-indigo-300 transition-colors bg-white hover:bg-neutral-50' : ''}`}
          >
            <div className={`p-2.5 rounded-lg w-fit ${card.bg} ${card.color} mb-2.5`}>
              <card.icon className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-neutral-500">{card.name}</p>
            <p className="text-xl font-bold mt-0.5 text-neutral-900">{card.value}</p>
            {card.clickable && (
              <p className="text-[10px] font-extrabold text-indigo-600 mt-1.5 uppercase tracking-wider">Ver lista</p>
            )}
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white p-4 md:p-5 rounded-xl border border-neutral-200 shadow-xs flex flex-col">
          <h3 className="font-bold text-sm text-neutral-900 mb-3 flex items-center gap-2">
            <Bike className="h-4 w-4 text-indigo-600" />
            Todos os Motoboys
          </h3>
          <LiveMap />
        </div>

        <div className="bg-white p-4 md:p-5 rounded-xl border border-neutral-200 shadow-xs flex flex-col">
          <h3 className="font-bold text-sm text-neutral-900 mb-3 flex items-center gap-2">
            <Navigation className="h-4 w-4 text-orange-600" />
            Motoboys em Rota
          </h3>
          <ActiveMotoboysMap />
        </div>
      </div>

      {/* Modal Motoboys Ativos */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative z-10 border border-neutral-200"
            >
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-neutral-900">Motoboys Disponíveis</h3>
                  <p className="text-sm text-neutral-500 font-medium">Atualmente online para entregas</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"
                >
                  <X className="h-6 w-6 text-neutral-400" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-neutral-400 gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                    <p className="font-medium">Carregando motoboys...</p>
                  </div>
                ) : motoboysAtivos.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="bg-neutral-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Bike className="h-8 w-8 text-neutral-300" />
                    </div>
                    <p className="text-neutral-500 font-bold">Nenhum motoboy disponível no momento</p>
                    <p className="text-sm text-neutral-400 mt-1">Todos os motoboys estão offline ou inativos.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {motoboysAtivos.map((motoboy) => (
                      <div key={motoboy.id} className="flex items-center gap-4 p-4 rounded-2xl border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-50 transition-colors">
                        {motoboy.foto_url ? (
                          <img 
                            src={motoboy.foto_url} 
                            alt={motoboy.nome} 
                            className="h-14 w-14 rounded-full object-cover border-2 border-white shadow-sm"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 border-2 border-white shadow-sm">
                            <User className="h-6 w-6" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-neutral-900 truncate">{motoboy.nome}</p>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="flex items-center gap-1 text-sm text-neutral-500 font-medium tracking-tight">
                              <Phone className="h-3 w-3" />
                              {motoboy.telefone}
                            </span>
                            <span className="flex items-center gap-1 text-sm text-neutral-500 font-medium tracking-tight">
                              <CreditCard className="h-3 w-3" />
                              {motoboy.placa_veiculo}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-[10px] font-black uppercase text-green-600 tracking-wider">Ativo</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 bg-neutral-50 border-t border-neutral-100 flex justify-end">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 bg-white border border-neutral-200 rounded-xl font-bold text-neutral-700 hover:bg-neutral-100 transition-all active:scale-95 shadow-sm"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

