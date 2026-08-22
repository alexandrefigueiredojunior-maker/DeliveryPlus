import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Motoboy, Restaurante, BloqueioMotoboyRestaurante } from '../../types';
import { X, ShieldAlert, Loader2, Save, Store, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BloqueioRestauranteModalProps {
  isOpen: boolean;
  onClose: () => void;
  motoboy: Motoboy | null;
}

export default function BloqueioRestauranteModal({ isOpen, onClose, motoboy }: BloqueioRestauranteModalProps) {
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [bloqueios, setBloqueios] = useState<Record<string, string>>({}); // restaurante_id -> motivo
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && motoboy) {
      fetchData();
    }
  }, [isOpen, motoboy]);

  async function fetchData() {
    if (!motoboy) return;
    setLoading(true);
    try {
      const [restRes, bloqRes] = await Promise.all([
        supabase
          .from('restaurantes')
          .select('*')
          .eq('empresa_id', motoboy.empresa_id)
          .order('nome'),
        supabase
          .from('bloqueios_motoboy_restaurante')
          .select('*')
          .eq('motoboy_id', motoboy.id)
      ]);

      if (restRes.error) throw restRes.error;
      if (bloqRes.error) throw bloqRes.error;

      setRestaurantes(restRes.data || []);
      
      const bloqMap: Record<string, string> = {};
      bloqRes.data?.forEach((b: BloqueioMotoboyRestaurante) => {
        bloqMap[b.restaurante_id] = b.motivo || '';
      });
      setBloqueios(bloqMap);
    } catch (error) {
      console.error('Erro ao buscar dados de bloqueio:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleToggleBloqueio = async (restauranteId: string) => {
    if (!motoboy) return;
    
    const isCurrentlyBlocked = !!bloqueios[restauranteId];
    
    setSaving(true);
    try {
      if (isCurrentlyBlocked) {
        const { error } = await supabase
          .from('bloqueios_motoboy_restaurante')
          .delete()
          .eq('motoboy_id', motoboy.id)
          .eq('restaurante_id', restauranteId);
        
        if (error) throw error;
        
        const newBloqueios = { ...bloqueios };
        delete newBloqueios[restauranteId];
        setBloqueios(newBloqueios);
      } else {
        const { error } = await supabase
          .from('bloqueios_motoboy_restaurante')
          .insert({
            empresa_id: motoboy.empresa_id,
            motoboy_id: motoboy.id,
            restaurante_id: restauranteId,
            motivo: 'Bloqueado pelo painel da empresa'
          });
        
        if (error) throw error;
        
        setBloqueios({ ...bloqueios, [restauranteId]: 'Bloqueado pelo painel da empresa' });
      }
    } catch (error) {
      console.error('Erro ao alterar bloqueio:', error);
      alert('Erro ao processar bloqueio.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMotivo = async (restauranteId: string, motivo: string) => {
    if (!motoboy || !bloqueios[restauranteId]) return;

    try {
      const { error } = await supabase
        .from('bloqueios_motoboy_restaurante')
        .update({ motivo })
        .eq('motoboy_id', motoboy.id)
        .eq('restaurante_id', restauranteId);
      
      if (error) throw error;
      setBloqueios({ ...bloqueios, [restauranteId]: motivo });
    } catch (error) {
      console.error('Erro ao atualizar motivo:', error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-indigo-500/10 border border-neutral-100"
          >
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-2xl">
                  <ShieldAlert className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-neutral-900 tracking-tight">Bloqueios por Restaurante</h2>
                  <p className="text-xs text-neutral-500 font-bold uppercase tracking-wider">{motoboy?.nome}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-400 hover:text-neutral-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                  <p className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Carregando restaurantes...</p>
                </div>
              ) : restaurantes.length === 0 ? (
                <div className="text-center py-20 bg-neutral-50 rounded-3xl border border-dashed border-neutral-200">
                  <Store className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-500 font-bold">Nenhum restaurante cadastrado.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-4">
                    <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-900 font-medium leading-snug">
                      Selecione para quais restaurantes este motoboy <span className="font-black underline">não poderá</span> aceitar entregas.
                    </p>
                  </div>

                  <div className="grid gap-3">
                    {restaurantes.map((restaurante) => {
                      const isBlocked = !!bloqueios[restaurante.id];
                      return (
                        <div 
                          key={restaurante.id}
                          className={`p-4 rounded-2xl border-2 transition-all duration-300 ${
                            isBlocked 
                              ? 'border-red-200 bg-red-50/30' 
                              : 'border-neutral-100 bg-white hover:border-neutral-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className={`p-2.5 rounded-xl ${isBlocked ? 'bg-red-100 text-red-600' : 'bg-neutral-100 text-neutral-400'}`}>
                                <Store className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className={`font-black text-sm ${isBlocked ? 'text-red-900' : 'text-neutral-900'}`}>
                                  {restaurante.nome}
                                </h3>
                                <p className="text-xs text-neutral-500 truncate max-w-[200px] sm:max-w-xs">{restaurante.endereco}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleToggleBloqueio(restaurante.id)}
                              disabled={saving}
                              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
                                isBlocked
                                  ? 'bg-white text-red-600 border border-red-200 hover:bg-white'
                                  : 'bg-neutral-900 text-white hover:bg-neutral-800'
                              }`}
                            >
                              {isBlocked ? 'Bloqueado' : 'Bloquear'}
                            </button>
                          </div>
                          
                          {isBlocked && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-4 pt-4 border-t border-red-100"
                            >
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-red-600 uppercase tracking-widest ml-1">Motivo do bloqueio</label>
                                <input 
                                  type="text"
                                  placeholder="Digite o motivo..."
                                  className="w-full bg-white border border-red-100 rounded-xl px-4 py-2 text-sm text-red-900 outline-none focus:border-red-300"
                                  value={bloqueios[restaurante.id]}
                                  onChange={(e) => setBloqueios({ ...bloqueios, [restaurante.id]: e.target.value })}
                                  onBlur={(e) => handleUpdateMotivo(restaurante.id, e.target.value)}
                                />
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-neutral-100 bg-neutral-50/50 flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-neutral-900 text-white rounded-xl font-bold transition-all hover:bg-neutral-800"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
