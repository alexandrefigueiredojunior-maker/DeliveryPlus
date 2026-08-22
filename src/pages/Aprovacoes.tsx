import { useEffect, useState } from 'react';
import { useEmpresa } from '../contexts/EmpresaContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import DashboardLayout from '../components/layout/DashboardLayout';
import { SolicitacaoAlteracao } from '../types';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  MapPin, 
  ArrowRight, 
  AlertCircle,
  Loader2,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Aprovacoes() {
  const { empresa } = useEmpresa();
  const { user } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoAlteracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<{[key: string]: string}>({});
  const [showRejectionInput, setShowRejectionInput] = useState<string | null>(null);

  useEffect(() => {
    if (empresa) {
      fetchSolicitacoes();
    }
  }, [empresa]);

  async function fetchSolicitacoes() {
    setLoading(true);
    try {
      const { data: sols, error: solsError } = await supabase
        .from('solicitacoes_alteracoes')
        .select('*')
        .eq('empresa_id', empresa?.id)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false });

      if (solsError) throw solsError;
      
      if (!sols || sols.length === 0) {
        setSolicitacoes([]);
        return;
      }

      // Busca os detalhes de cada entidade manualmente
      const enrichedSols = await Promise.all(sols.map(async (sol: any) => {
        const targetTable = sol.tipo_entidade === 'motoboy' ? 'motoboys' : 'restaurantes';
        const { data: entityData } = await supabase
          .from(targetTable)
          .select('nome, foto_url')
          .eq('id', sol.entidade_id)
          .maybeSingle();
        
        return {
          ...sol,
          [sol.tipo_entidade === 'motoboy' ? 'motoboys' : 'restaurantes']: entityData
        };
      }));

      setSolicitacoes(enrichedSols);
    } catch (error) {
      console.error('Erro ao buscar solicitações:', error);
      setError('Erro ao carregar solicitações.');
    } finally {
      setLoading(false);
    }
  }

  const handleApprove = async (solicitacao: SolicitacaoAlteracao) => {
    if (!user) return;
    setActionLoading(solicitacao.id);
    setError(null);
    try {
      const targetTable = solicitacao.tipo_entidade === 'motoboy' ? 'motoboys' : 'restaurantes';
      
      // 1. Atualiza dados reais
      const { error: updateError } = await supabase
        .from(targetTable)
        .update(solicitacao.dados_novos)
        .eq('id', solicitacao.entidade_id);

      if (updateError) throw updateError;

      // 2. Atualiza solicitação
      const { error: requestError } = await supabase
        .from('solicitacoes_alteracoes')
        .update({
          status: 'aprovada',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id
        })
        .eq('id', solicitacao.id);

      if (requestError) throw requestError;

      setSuccess('Solicitação aprovada com sucesso!');
      await fetchSolicitacoes();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Erro ao aprovar:', err);
      setError(err.message || 'Erro ao aprovar alteração.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (solicitacao: SolicitacaoAlteracao) => {
    if (!user) return;
    const reason = rejectionReason[solicitacao.id];
    if (!reason) {
      alert('Por favor, informe um motivo para a rejeição.');
      return;
    }

    setActionLoading(solicitacao.id);
    setError(null);
    try {
      const { error } = await supabase
        .from('solicitacoes_alteracoes')
        .update({
          status: 'rejeitada',
          motivo_rejeicao: reason,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id
        })
        .eq('id', solicitacao.id);

      if (error) throw error;

      setSuccess('Solicitação rejeitada.');
      await fetchSolicitacoes();
      setShowRejectionInput(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Erro ao rejeitar:', err);
      setError(err.message || 'Erro ao rejeitar alteração.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Aprovações</h2>
        <p className="text-neutral-500 mt-1">Gerencie solicitações de alteração de perfil de motoboys e restaurantes.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-green-700">
          <CheckCircle className="h-5 w-5" />
          {success}
        </div>
      )}

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-4 text-neutral-400">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          <p className="font-medium">Buscando solicitações...</p>
        </div>
      ) : solicitacoes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center">
          <div className="bg-neutral-50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-neutral-300" />
          </div>
          <p className="text-neutral-500 font-bold">Nenhuma solicitação pendente.</p>
          <p className="text-sm text-neutral-400 mt-1">Tudo em dia com os cadastros!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {solicitacoes.map((sol) => {
            const entidade = sol.tipo_entidade === 'motoboy' ? sol.motoboys : sol.restaurantes;
            const camposAlterados = Object.keys(sol.dados_novos).filter(
              key => JSON.stringify(sol.dados_novos[key]) !== JSON.stringify(sol.dados_anteriores[key])
            );

            return (
              <motion.div 
                layout
                key={sol.id} 
                className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex items-center gap-4">
                      {entidade?.foto_url ? (
                        <img src={entidade.foto_url} className="h-16 w-16 rounded-full object-cover border-2 border-neutral-100" />
                      ) : (
                        <div className={`h-16 w-16 rounded-full flex items-center justify-center text-white ${sol.tipo_entidade === 'motoboy' ? 'bg-indigo-500' : 'bg-orange-500'}`}>
                          {sol.tipo_entidade === 'motoboy' ? <User /> : <MapPin />}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-neutral-900">{entidade?.nome || 'Entidade desconhecida'}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${sol.tipo_entidade === 'motoboy' ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'}`}>
                            {sol.tipo_entidade}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-neutral-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Pendente desde: {new Date(sol.created_at).toLocaleDateString()} {new Date(sol.created_at).toLocaleTimeString().slice(0, 5)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleApprove(sol)}
                        disabled={!!actionLoading}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        {actionLoading === sol.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        Aprovar
                      </button>
                      <button 
                        onClick={() => setShowRejectionInput(showRejectionInput === sol.id ? null : sol.id)}
                        disabled={!!actionLoading}
                        className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl font-bold transition-all border border-red-100 active:scale-95 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Rejeitar
                      </button>
                    </div>
                  </div>

                  <div className="mt-8">
                    <h4 className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">Campos Alterados</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {camposAlterados.map(key => (
                        <div key={key} className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                          <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-2">{key.replace('_', ' ')}</p>
                          <div className="flex flex-col gap-2">
                            <div className="text-sm">
                              <span className="text-[10px] font-bold text-red-400 uppercase mr-1">Antigo:</span>
                              <span className="text-neutral-500 font-medium line-through decoration-red-200">{sol.dados_anteriores[key] || '-'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-indigo-600">
                              <ArrowRight className="h-3 w-3" />
                              <div className="text-sm font-bold bg-white px-2 py-1 rounded-lg border border-indigo-100 shadow-sm flex items-center gap-2 overflow-hidden">
                                {key === 'foto_url' && sol.dados_novos[key] && (
                                  <img src={sol.dados_novos[key]} className="h-8 w-8 rounded-lg object-cover" />
                                )}
                                <span className="truncate">{sol.dados_novos[key] || '-'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence>
                    {showRejectionInput === sol.id && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-6 pt-6 border-t border-neutral-100 space-y-4"
                      >
                        <div>
                          <label className="block text-sm font-bold text-neutral-700 mb-1">Motivo da Rejeição</label>
                          <textarea 
                            value={rejectionReason[sol.id] || ''}
                            onChange={(e) => setRejectionReason({...rejectionReason, [sol.id]: e.target.value})}
                            className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-100 focus:border-red-600 transition-all text-sm h-24"
                            placeholder="Explique porque a solicitação está sendo negada..."
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setShowRejectionInput(null)}
                            className="px-4 py-2 text-neutral-500 font-bold text-sm"
                          >
                            Cancelar
                          </button>
                          <button 
                            onClick={() => handleReject(sol)}
                            className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold text-sm active:scale-95 transition-all shadow-sm"
                          >
                            Confirmar Rejeição
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
