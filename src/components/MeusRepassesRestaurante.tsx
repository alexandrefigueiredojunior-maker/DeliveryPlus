import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Receipt, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Calendar, 
  FileText, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Percent,
  Wallet,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Restaurante } from '../types';

interface MeusRepassesRestauranteProps {
  restaurante: Restaurante;
}

interface LoteRepasseItem {
  id: string;
  restaurante_id: string;
  data_inicio: string;
  data_fim: string;
  valor_pago: number | null;
  valor_total?: number | null;
  status_repasse: string;
  pago_em?: string | null;
  comprovante_url?: string | null;
  created_at: string;
}

interface PagamentoPagbankItem {
  id: string;
  entrega_id?: string | null;
  restaurante_id: string;
  valor_total: number;
  valor_restaurante: number;
  valor_plataforma: number;
  status_pagamento?: string | null;
  status_repasse?: string | null;
  lote_repasse_id?: string | null;
  created_at: string;
}

export default function MeusRepassesRestaurante({ restaurante }: MeusRepassesRestauranteProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lotes, setLotes] = useState<LoteRepasseItem[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoPagbankItem[]>([]);
  const [filtroStatusLote, setFiltroStatusLote] = useState<'todos' | 'Pendente' | 'Pago'>('todos');
  const [expandedLoteId, setExpandedLoteId] = useState<string | null>(null);
  const [tabAtiva, setTabAtiva] = useState<'lotes' | 'transacoes'>('lotes');

  const carregarDadosRepasse = useCallback(async (isSilent = false) => {
    if (!restaurante?.id) return;
    if (!isSilent) setLoading(true);
    setRefreshing(true);

    try {
      // 1. Buscar pagamentos pagbank exclusivamente do restaurante logado
      const { data: dataPagamentos, error: errPagamentos } = await supabase
        .from('pagamentos_pagbank')
        .select('*')
        .eq('restaurante_id', restaurante.id)
        .order('created_at', { ascending: false });

      if (errPagamentos) {
        console.error('Erro ao carregar pagamentos pagbank do restaurante:', errPagamentos);
      } else {
        setPagamentos((dataPagamentos || []).map(p => ({
          ...p,
          valor_total: Number(p.valor_total || 0),
          valor_restaurante: Number(p.valor_restaurante || 0),
          valor_plataforma: Number(p.valor_plataforma || 0),
        })));
      }

      // 2. Buscar lotes de repasse exclusivamente do restaurante logado
      const { data: dataLotes, error: errLotes } = await supabase
        .from('lotes_repasse')
        .select('*')
        .eq('restaurante_id', restaurante.id)
        .order('created_at', { ascending: false });

      if (errLotes) {
        console.error('Erro ao carregar lotes de repasse do restaurante:', errLotes);
      } else {
        setLotes((dataLotes || []).map(l => ({
          ...l,
          valor_pago: l.valor_pago !== null && l.valor_pago !== undefined 
            ? Number(l.valor_pago) 
            : (l.valor_total !== null && l.valor_total !== undefined ? Number(l.valor_total) : 0),
          status_repasse: l.status_repasse || 'Pendente',
        })));
      }
    } catch (error) {
      console.error('Erro inesperado ao carregar dados de repasse:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurante?.id]);

  useEffect(() => {
    carregarDadosRepasse();
  }, [carregarDadosRepasse]);

  // Sincronização em tempo real para pagamentos e lotes do restaurante
  useEffect(() => {
    if (!restaurante?.id) return;

    const channel = supabase
      .channel(`repasses_restaurante_${restaurante.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pagamentos_pagbank',
          filter: `restaurante_id=eq.${restaurante.id}`,
        },
        () => {
          carregarDadosRepasse(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lotes_repasse',
          filter: `restaurante_id=eq.${restaurante.id}`,
        },
        () => {
          carregarDadosRepasse(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurante?.id, carregarDadosRepasse]);

  // Cálculos financeiros a partir dos dados existentes
  const totalBruto = pagamentos.reduce((sum, item) => sum + (item.valor_total || 0), 0);
  const totalTaxas = pagamentos.reduce((sum, item) => sum + (item.valor_plataforma || 0), 0);
  const totalLiquido = pagamentos.reduce((sum, item) => sum + (item.valor_restaurante || 0), 0);

  // Totais dos Lotes
  const totalLotesPendentes = lotes
    .filter(l => (l.status_repasse || '').toLowerCase() === 'pendente')
    .reduce((sum, l) => sum + (l.valor_pago || 0), 0);

  const totalLotesPagos = lotes
    .filter(l => (l.status_repasse || '').toLowerCase() === 'pago')
    .reduce((sum, l) => sum + (l.valor_pago || 0), 0);

  // Formatação de datas
  const formatarDataBr = (dataIso?: string | null): string => {
    if (!dataIso) return '-';
    try {
      const clean = dataIso.split('T')[0];
      const parts = clean.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dataIso;
    } catch {
      return dataIso || '-';
    }
  };

  const formatarPeriodo = (inicio?: string | null, fim?: string | null): string => {
    if (!inicio && !fim) return 'Período não informado';
    const inicioStr = formatarDataBr(inicio);
    const fimStr = formatarDataBr(fim);
    if (inicioStr === fimStr || !fimStr) return inicioStr;
    return `${inicioStr} até ${fimStr}`;
  };

  const formatarDataHoraBrasilia = (dataIso?: string | null): string => {
    if (!dataIso) return '-';
    try {
      const d = new Date(dataIso);
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return dataIso;
    }
  };

  // Filtragem dos lotes
  const lotesFiltrados = lotes.filter(l => {
    if (filtroStatusLote === 'todos') return true;
    return (l.status_repasse || '').toLowerCase() === filtroStatusLote.toLowerCase();
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-orange-50 text-orange-600 rounded-2xl">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-neutral-900 tracking-tight">Meus Repasses</h1>
              <p className="text-xs font-semibold text-neutral-500">
                Acompanhe o extrato dos pagamentos e o histórico de lotes de repasse
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => carregarDadosRepasse(true)}
          disabled={refreshing}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs rounded-xl transition-all active:scale-95 disabled:opacity-50"
          title="Atualizar dados"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin text-orange-600' : ''} />
          <span>{refreshing ? 'Atualizando...' : 'Atualizar'}</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-neutral-200/80 text-center space-y-3 shadow-xs">
          <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Carregando extrato de repasses...
          </p>
        </div>
      ) : (
        <>
          {/* DESTAQUE PRINCIPAL: VALOR LÍQUIDO E RESUMO FINANCEIRO */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Card Destaque: Total Líquido (A Receber / Faturamento Líquido) */}
            <div className="lg:col-span-2 bg-gradient-to-br from-neutral-900 to-neutral-850 text-white p-6 md:p-8 rounded-3xl shadow-xl relative overflow-hidden flex flex-col justify-between border border-neutral-800">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-5 text-white pointer-events-none">
                <DollarSign size={220} />
              </div>

              <div className="space-y-4 relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-black uppercase tracking-wider">
                  <Wallet size={13} />
                  <span>Valor Líquido do Restaurante</span>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                    Total a Receber (Líquido)
                  </p>
                  <p className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white mt-1">
                    R$ {totalLiquido.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Sub-métricas de Bruto e Taxas */}
              <div className="grid grid-cols-2 gap-3 pt-6 mt-6 border-t border-neutral-800 relative z-10">
                <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                    <ArrowUpRight size={13} className="text-blue-400" />
                    <span>Total Bruto</span>
                  </div>
                  <p className="text-base sm:text-lg font-black text-white">
                    R$ {totalBruto.toFixed(2)}
                  </p>
                </div>

                <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                    <Percent size={13} className="text-rose-400" />
                    <span>Taxas / Plataforma</span>
                  </div>
                  <p className="text-base sm:text-lg font-black text-rose-300">
                    R$ {totalTaxas.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Cards Laterais: Status dos Lotes (Pendente e Pago) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {/* Lotes Pendentes */}
              <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    <Clock size={12} />
                    Lotes Pendentes
                  </span>
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                    <Clock size={16} />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-black text-neutral-900">
                    R$ {totalLotesPendentes.toFixed(2)}
                  </p>
                  <p className="text-[11px] font-bold text-neutral-400 mt-0.5">
                    {lotes.filter(l => (l.status_repasse || '').toLowerCase() === 'pendente').length} lote(s) aguardando liquidação
                  </p>
                </div>
              </div>

              {/* Lotes Pagos */}
              <div className="bg-white p-5 rounded-3xl border border-neutral-200/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                    <CheckCircle2 size={12} />
                    Lotes Pagos
                  </span>
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-2xl font-black text-emerald-700">
                    R$ {totalLotesPagos.toFixed(2)}
                  </p>
                  <p className="text-[11px] font-bold text-neutral-400 mt-0.5">
                    {lotes.filter(l => (l.status_repasse || '').toLowerCase() === 'pago').length} lote(s) já repassados
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CHAVES PIX / CONTA CADASTRADA */}
          {(restaurante.pix_chave || restaurante.pix_cpf || restaurante.pagbank_conta) && (
            <div className="bg-neutral-50 border border-neutral-200/80 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-neutral-500" />
                <span className="font-extrabold text-neutral-700">Dados bancários para repasse:</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 font-semibold text-neutral-600">
                {restaurante.pix_nome_completo && (
                  <span><strong className="text-neutral-900">Titular:</strong> {restaurante.pix_nome_completo}</span>
                )}
                {restaurante.pix_cpf && (
                  <span><strong className="text-neutral-900">CPF/CNPJ:</strong> {restaurante.pix_cpf}</span>
                )}
                {restaurante.pix_chave && (
                  <span><strong className="text-neutral-900">Chave Pix:</strong> {restaurante.pix_chave}</span>
                )}
                {restaurante.pagbank_conta && (
                  <span><strong className="text-neutral-900">Conta PagBank:</strong> {restaurante.pagbank_conta}{restaurante.pagbank_digito ? `-${restaurante.pagbank_digito}` : ''}</span>
                )}
              </div>
            </div>
          )}

          {/* NAVEGAÇÃO DE ABAS: HISTÓRICO DE LOTES VS TRANSAÇÕES DETALHADAS */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTabAtiva('lotes')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    tabAtiva === 'lotes'
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200/80'
                  }`}
                >
                  Histórico de Lotes ({lotes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTabAtiva('transacoes')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    tabAtiva === 'transacoes'
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'bg-white hover:bg-neutral-100 text-neutral-600 border border-neutral-200/80'
                  }`}
                >
                  Extrato de Transações ({pagamentos.length})
                </button>
              </div>

              {tabAtiva === 'lotes' && (
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  {(['todos', 'Pendente', 'Pago'] as const).map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFiltroStatusLote(status)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase transition-all ${
                        filtroStatusLote === status
                          ? 'bg-orange-600 text-white font-black'
                          : 'bg-white hover:bg-neutral-100 text-neutral-500 border border-neutral-200/80'
                      }`}
                    >
                      {status === 'todos' ? 'Todos' : status}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ABA 1: LISTA DE LOTES */}
            {tabAtiva === 'lotes' && (
              <div className="space-y-3">
                {lotesFiltrados.length === 0 ? (
                  <div className="bg-white p-10 rounded-3xl border border-neutral-200/80 text-center space-y-2 shadow-xs">
                    <Receipt className="h-10 w-10 text-neutral-300 mx-auto" />
                    <h3 className="font-bold text-sm text-neutral-800">Nenhum lote de repasse encontrado</h3>
                    <p className="text-neutral-500 text-xs">
                      {filtroStatusLote !== 'todos'
                        ? `Não há lotes com status "${filtroStatusLote}".`
                        : 'Os lotes de repasse fechados pela administração aparecerão aqui.'}
                    </p>
                  </div>
                ) : (
                  lotesFiltrados.map(lote => {
                    const isPago = (lote.status_repasse || '').toLowerCase() === 'pago';
                    const isExpanded = expandedLoteId === lote.id;
                    const pagamentosDoLote = pagamentos.filter(p => p.lote_repasse_id === lote.id);

                    return (
                      <div
                        key={lote.id}
                        className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs hover:border-neutral-300 transition-all overflow-hidden"
                      >
                        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  isPago
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {isPago ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                                {lote.status_repasse || 'Pendente'}
                              </span>

                              <span className="text-xs font-bold text-neutral-400">
                                Criado em {formatarDataBr(lote.created_at)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-neutral-800">
                              <Calendar size={14} className="text-orange-500 shrink-0" />
                              <p className="font-extrabold text-sm sm:text-base">
                                {formatarPeriodo(lote.data_inicio, lote.data_fim)}
                              </p>
                            </div>

                            {/* Data do pagamento quando existir */}
                            {lote.pago_em && (
                              <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                <CheckCircle2 size={12} />
                                Pago em: {formatarDataHoraBrasilia(lote.pago_em)}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                            <div className="text-left sm:text-right">
                              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                                Valor do Repasse
                              </p>
                              <p className="text-xl sm:text-2xl font-black text-neutral-900">
                                R$ {(lote.valor_pago || 0).toFixed(2)}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {lote.comprovante_url && (
                                <a
                                  href={lote.comprovante_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl transition-all"
                                  title="Ver comprovante"
                                >
                                  <ExternalLink size={16} />
                                </a>
                              )}

                              {pagamentosDoLote.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setExpandedLoteId(isExpanded ? null : lote.id)}
                                  className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl transition-all"
                                  title={isExpanded ? 'Recolher detalhes' : 'Ver transações do lote'}
                                >
                                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Detalhes expandidos das transações vinculadas ao lote */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="bg-neutral-50 border-t border-neutral-200/80 p-4 space-y-2"
                            >
                              <p className="text-xs font-black uppercase tracking-wider text-neutral-600">
                                Transações vinculadas a este lote ({pagamentosDoLote.length}):
                              </p>
                              <div className="divide-y divide-neutral-200/60 text-xs">
                                {pagamentosDoLote.map(t => (
                                  <div key={t.id} className="py-2 flex items-center justify-between">
                                    <div>
                                      <span className="font-bold text-neutral-800">
                                        Data: {formatarDataHoraBrasilia(t.created_at)}
                                      </span>
                                      <span className="text-[10px] text-neutral-500 ml-2">
                                        (Bruto: R$ {t.valor_total.toFixed(2)} | Taxa: R$ {t.valor_plataforma.toFixed(2)})
                                      </span>
                                    </div>
                                    <span className="font-black text-emerald-700">
                                      Líquido: R$ {t.valor_restaurante.toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ABA 2: EXTRATO COMPLETO DE TRANSAÇÕES */}
            {tabAtiva === 'transacoes' && (
              <div className="space-y-2">
                {pagamentos.length === 0 ? (
                  <div className="bg-white p-10 rounded-3xl border border-neutral-200/80 text-center space-y-2 shadow-xs">
                    <FileText className="h-10 w-10 text-neutral-300 mx-auto" />
                    <h3 className="font-bold text-sm text-neutral-800">Nenhuma transação registrada</h3>
                    <p className="text-neutral-500 text-xs">
                      Os pagamentos efetuados via PagBank serão listados aqui assim que aprovados.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase font-black tracking-wider text-[10px]">
                          <tr>
                            <th className="px-4 py-3">Data / Hora</th>
                            <th className="px-4 py-3">Valor Bruto</th>
                            <th className="px-4 py-3">Taxa Plataforma</th>
                            <th className="px-4 py-3 text-right">Valor Líquido</th>
                            <th className="px-4 py-3 text-center">Status Repasse</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                          {pagamentos.map(p => {
                            const isRepassado = p.status_repasse === 'Pago' || !!p.lote_repasse_id;
                            return (
                              <tr key={p.id} className="hover:bg-neutral-50/70 transition-colors">
                                <td className="px-4 py-3 font-bold text-neutral-800 whitespace-nowrap">
                                  {formatarDataHoraBrasilia(p.created_at)}
                                </td>
                                <td className="px-4 py-3 font-semibold text-neutral-700 whitespace-nowrap">
                                  R$ {p.valor_total.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 font-semibold text-rose-600 whitespace-nowrap">
                                  R$ {p.valor_plataforma.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 font-black text-emerald-700 text-right whitespace-nowrap">
                                  R$ {p.valor_restaurante.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                      isRepassado
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}
                                  >
                                    {p.status_repasse || (p.lote_repasse_id ? 'Vinculado a Lote' : 'Pendente')}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
