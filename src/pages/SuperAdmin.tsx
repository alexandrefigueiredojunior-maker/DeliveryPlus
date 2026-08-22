import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  Building2, 
  ArrowLeftRight, 
  Plus, 
  X, 
  Filter, 
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  Search,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Receipt,
  Calendar,
  CreditCard,
  CalendarCheck,
  AlertTriangle,
  Layers,
  FileText,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface EmpresaRecord {
  id: string;
  nome: string;
  telefone?: string | null;
  ativo?: boolean;
  logo_url?: string | null;
  created_at: string;
}

interface LoteRepasseItem {
  id: string;
  data_inicio: string;
  data_fim: string;
  valor_pago: number | null;
  status_repasse: string | null;
  pago_em: string | null;
  comprovante_url: string | null;
  created_at: string;
}

interface RestauranteRepasse {
  restaurante_id: string;
  restaurante_nome: string;
  restaurante_telefone?: string | null;
  empresa_id: string;
  empresa_nome: string;
  empresa_logo_url?: string | null;
  pagbank_ativo: boolean;
  pagbank_recipient_id?: string | null;
  taxa_comissao?: number | null;
  lote_id?: string | null;
  lote_data_inicio?: string | null;
  lote_data_fim?: string | null;
  lote_valor_pago?: number | null;
  lote_status_repasse?: string | null;
  lote_pago_em?: string | null;
  lote_comprovante_url?: string | null;
  lote_created_at?: string | null;
  lotes?: LoteRepasseItem[];
}

interface PagamentoPagbankRecord {
  id: string;
  entrega_id?: string | null;
  restaurante_id?: string | null;
  empresa_id?: string | null;
  valor_total?: number | null;
  valor_restaurante?: number | null;
  valor_plataforma?: number | null;
  status_pagamento?: string | null;
  status_repasse?: string | null;
  lote_repasse_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  payload?: any;
  empresa_nome?: string;
  empresa_logo_url?: string | null;
  restaurante_nome?: string;
  lote_codigo?: string | null;
}

interface ResultadoFechamento {
  tipo: 'sucesso' | 'sem_pagamentos' | 'ja_fechado' | 'acesso_negado' | 'erro';
  mensagem: string;
  detalhes?: {
    data_ciclo?: string;
    quantidade_pagamentos?: number;
    valor_total?: number;
    lotes_criados?: number | string;
  };
}

interface ResultadoGeracaoArquivo {
  tipo: 'sucesso' | 'aviso' | 'erro';
  mensagem: string;
  arquivo_nome?: string;
  quantidade_lotes?: number;
  valor_total?: number;
  lotes_incluidos?: any[];
  lotes_incompletos?: any[];
}

const getAvatarColors = (name: string) => {
  const colors = [
    { bg: 'bg-orange-100 text-orange-700 border-orange-200/80' },
    { bg: 'bg-indigo-100 text-indigo-700 border-indigo-200/80' },
    { bg: 'bg-emerald-100 text-emerald-700 border-emerald-200/80' },
    { bg: 'bg-blue-100 text-blue-700 border-blue-200/80' },
    { bg: 'bg-purple-100 text-purple-700 border-purple-200/80' },
    { bg: 'bg-rose-100 text-rose-700 border-rose-200/80' },
    { bg: 'bg-amber-100 text-amber-700 border-amber-200/80' },
    { bg: 'bg-teal-100 text-teal-700 border-teal-200/80' },
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export default function SuperAdmin() {
  const navigate = useNavigate();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [activeTab, setActiveTab] = useState<'empresas' | 'repasses' | 'transacoes'>('empresas');

  // Filtros e Pesquisa de Empresas
  const [pesquisaEmpresa, setPesquisaEmpresa] = useState('');
  const [filtroStatusEmpresa, setFiltroStatusEmpresa] = useState<'todas' | 'ativas' | 'bloqueadas'>('todas');

  // Modal de bloqueio/ativação
  const [empresaParaAlterar, setEmpresaParaAlterar] = useState<EmpresaRecord | null>(null);
  const [loadingToggleStatus, setLoadingToggleStatus] = useState(false);

  // Modal "+ Nova empresa"
  const [isNovaEmpresaModalOpen, setIsNovaEmpresaModalOpen] = useState(false);
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [telefoneEmpresa, setTelefoneEmpresa] = useState('');
  const [emailAdmin, setEmailAdmin] = useState('');
  const [senhaAdmin, setSenhaAdmin] = useState('');
  const [showSenhaAdmin, setShowSenhaAdmin] = useState(false);

  const [empresas, setEmpresas] = useState<EmpresaRecord[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState<string | null>(null);

  const resetModalForm = () => {
    setNomeEmpresa('');
    setTelefoneEmpresa('');
    setEmailAdmin('');
    setSenhaAdmin('');
    setShowSenhaAdmin(false);
    setModalError(null);
  };

  // Filtros e Dados de Repasses
  const [filtroEmpresa, setFiltroEmpresa] = useState('');
  const [filtroRestaurante, setFiltroRestaurante] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');

  // Fechamento de ciclo manual
  const [dataCicloInput, setDataCicloInput] = useState<string>(() => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(now);
    let d = '', m = '', y = '';
    parts.forEach((p) => {
      if (p.type === 'day') d = p.value;
      if (p.type === 'month') m = p.value;
      if (p.type === 'year') y = p.value;
    });
    return `${y}-${m}-${d}`;
  });
  const [fechandoCiclo, setFechandoCiclo] = useState(false);
  const [resultadoFechamento, setResultadoFechamento] = useState<ResultadoFechamento | null>(null);

  // Geração de Arquivo PagBank
  const [gerandoArquivoPagbank, setGerandoArquivoPagbank] = useState(false);
  const [resultadoGeracaoPagbank, setResultadoGeracaoPagbank] = useState<ResultadoGeracaoArquivo | null>(null);

  // Modal Transações do Restaurante
  const [selectedRestauranteParaModal, setSelectedRestauranteParaModal] = useState<RestauranteRepasse | null>(null);
  const [transacoesModalList, setTransacoesModalList] = useState<PagamentoPagbankRecord[]>([]);
  const [loadingTransacoesModal, setLoadingTransacoesModal] = useState(false);

  // Modal Lotes de Repasse do Restaurante
  const [restauranteLotesModal, setRestauranteLotesModal] = useState<RestauranteRepasse | null>(null);
  const [lotesModalList, setLotesModalList] = useState<LoteRepasseItem[]>([]);
  const [loadingLotesModal, setLoadingLotesModal] = useState(false);

  const [modalFiltroPeriodo, setModalFiltroPeriodo] = useState('');
  const [modalFiltroDataInicio, setModalFiltroDataInicio] = useState('');
  const [modalFiltroDataFim, setModalFiltroDataFim] = useState('');
  const [modalFiltroStatusPagamento, setModalFiltroStatusPagamento] = useState('');
  const [modalFiltroStatusRepasse, setModalFiltroStatusRepasse] = useState('');
  const [modalFiltroCodigo, setModalFiltroCodigo] = useState('');

  // Aba "Transações"
  const [todasTransacoes, setTodasTransacoes] = useState<PagamentoPagbankRecord[]>([]);
  const [loadingTodasTransacoes, setLoadingTodasTransacoes] = useState(false);

  const [filtroTransacaoEmpresa, setFiltroTransacaoEmpresa] = useState('');
  const [filtroTransacaoRestaurante, setFiltroTransacaoRestaurante] = useState('');
  const [filtroTransacaoPeriodo, setFiltroTransacaoPeriodo] = useState('');
  const [filtroTransacaoDataInicio, setFiltroTransacaoDataInicio] = useState('');
  const [filtroTransacaoDataFim, setFiltroTransacaoDataFim] = useState('');
  const [filtroTransacaoStatusPagamento, setFiltroTransacaoStatusPagamento] = useState('');
  const [filtroTransacaoStatusRepasse, setFiltroTransacaoStatusRepasse] = useState('');
  const [filtroTransacaoCodigo, setFiltroTransacaoCodigo] = useState('');

  /**
   * Converte o período selecionado no fuso de Brasília (America/Sao_Paulo / UTC-3)
   * para os limites em UTC (ISO strings) prontos para consultas no Supabase.
   * - Limite inferior (inicioUtcIso): inclusivo (>=)
   * - Limite superior (fimUtcIso): exclusivo (<)
   */
  const getIntervaloUtcBrasilia = (periodoKey: string, dataReferencia: Date = new Date()) => {
    if (!periodoKey) return null;

    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(dataReferencia);
    const partMap: Record<string, string> = {};
    parts.forEach((p) => {
      partMap[p.type] = p.value;
    });

    const anoBr = parseInt(partMap.year, 10);
    const mesBr = parseInt(partMap.month, 10) - 1; // 0-indexed
    const diaBr = parseInt(partMap.day, 10);

    let inicioUtc: Date;
    let fimUtc: Date;

    if (periodoKey === 'hoje') {
      // Início: 00:00:00 BRT -> UTC: 03:00:00.000Z
      inicioUtc = new Date(Date.UTC(anoBr, mesBr, diaBr, 3, 0, 0, 0));
      // Fim exclusivo: 00:00:00 BRT do dia seguinte -> UTC: 03:00:00.000Z do dia seguinte
      fimUtc = new Date(Date.UTC(anoBr, mesBr, diaBr + 1, 3, 0, 0, 0));
    } else if (periodoKey === 'semana') {
      // Segunda-feira da semana atual em Brasília
      const dataBrRef = new Date(Date.UTC(anoBr, mesBr, diaBr));
      const dayOfWeek = dataBrRef.getUTCDay(); // 0 (Dom) a 6 (Sáb)
      const diffParaSegunda = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const diaSegunda = diaBr - diffParaSegunda;

      inicioUtc = new Date(Date.UTC(anoBr, mesBr, diaSegunda, 3, 0, 0, 0));
      fimUtc = new Date(Date.UTC(anoBr, mesBr, diaSegunda + 7, 3, 0, 0, 0));
    } else if (periodoKey === 'mes') {
      // Este mês em Brasília
      inicioUtc = new Date(Date.UTC(anoBr, mesBr, 1, 3, 0, 0, 0));
      fimUtc = new Date(Date.UTC(anoBr, mesBr + 1, 1, 3, 0, 0, 0));
    } else {
      return null;
    }

    return {
      inicioUtcIso: inicioUtc.toISOString(),
      fimUtcIso: fimUtc.toISOString(),
    };
  };

  /**
   * Formata o período em horário de Brasília para exibição na interface
   */
  const formatarPeriodoExibicaoBrasilia = (periodoKey: string, dataReferencia: Date = new Date()): string => {
    const intervalo = getIntervaloUtcBrasilia(periodoKey, dataReferencia);
    if (!intervalo) return '-';

    const formatOptions: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    };

    const inicioBrStr = new Intl.DateTimeFormat('pt-BR', formatOptions).format(new Date(intervalo.inicioUtcIso));
    const fimBrData = new Date(new Date(intervalo.fimUtcIso).getTime() - 1);
    const fimBrStr = new Intl.DateTimeFormat('pt-BR', formatOptions).format(fimBrData);

    if (periodoKey === 'hoje' || inicioBrStr === fimBrStr) {
      return inicioBrStr;
    }

    return `${inicioBrStr} a ${fimBrStr}`;
  };

  const formatarDataIsoParaBr = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [yyyy, mm, dd] = parts;
      return `${dd}/${mm}/${yyyy}`;
    }
    return dateStr;
  };

  const formatarPeriodoLote = (dataInicio?: string | null, dataFim?: string | null): string => {
    if (!dataInicio && !dataFim) return '-';
    const inicio = formatarDataIsoParaBr(dataInicio);
    const fim = formatarDataIsoParaBr(dataFim);
    if (inicio && fim) {
      return `${inicio} - ${fim}`;
    }
    return inicio || fim || '-';
  };

  const formatarDataRepasse = (pagoEmStr?: string | null): string => {
    if (!pagoEmStr) return '-';
    try {
      const date = new Date(pagoEmStr);
      const diaMesAno = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);

      const horaMinuto = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(date);

      return `${diaMesAno} ${horaMinuto}`;
    } catch (e) {
      return formatarDataIsoParaBr(pagoEmStr);
    }
  };

  const getIntervaloUtcCustom = (dataInicioStr?: string, dataFimStr?: string) => {
    if (!dataInicioStr && !dataFimStr) return null;

    let startUtc: Date | null = null;
    let endUtc: Date | null = null;

    if (dataInicioStr) {
      const parts = dataInicioStr.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        startUtc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 3, 0, 0, 0));
      }
    }

    if (dataFimStr) {
      const parts = dataFimStr.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN)) {
        endUtc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1, 3, 0, 0, 0));
      }
    }

    return { startUtc, endUtc };
  };

  const formatarDataHoraBrasilia = (dateStr?: string) => {
    if (!dateStr) return { data: '-', hora: '-' };
    try {
      const d = new Date(dateStr);
      const dataFormatted = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d);

      const horaFormatted = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(d);

      return { data: dataFormatted, hora: horaFormatted };
    } catch {
      return { data: dateStr, hora: '-' };
    }
  };

  const formatarMoeda = (valor?: number | null) => {
    if (valor === null || valor === undefined || isNaN(valor)) return 'R$ 0,00';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  /**
   * Formata a data do lote no fuso de Brasília (America/Sao_Paulo) no formato DDMMAA (6 dígitos).
   */
  const formatarCodigoLoteData = (dateInput?: string | Date | null): string | null => {
    if (!dateInput) return null;
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return null;

      const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });

      const parts = formatter.formatToParts(d);
      let day = '';
      let month = '';
      let year = '';

      parts.forEach((p) => {
        if (p.type === 'day') day = p.value.padStart(2, '0');
        if (p.type === 'month') month = p.value.padStart(2, '0');
        if (p.type === 'year') year = p.value.padStart(2, '0');
      });

      if (day && month && year) {
        return `${day}${month}${year}`;
      }

      return null;
    } catch {
      return null;
    }
  };

  const renderStatusPagamentoBadge = (status?: string | null) => {
    const s = (status || '').toUpperCase();
    if (s === 'PAID' || s === 'PAGO' || s === 'APROVADO' || s === 'AUTHORIZED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Pago
        </span>
      );
    }
    if (s === 'REFUNDED' || s === 'ESTORNADO' || s === 'CANCELLED' || s === 'CANCELED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 text-[10px] font-bold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          {s === 'REFUNDED' || s === 'ESTORNADO' ? 'Estornado' : 'Cancelado'}
        </span>
      );
    }
    if (s === 'WAITING' || s === 'PENDENTE' || s === 'IN_ANALYSIS') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 text-[10px] font-bold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Pendente
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 text-[10px] font-bold uppercase tracking-wider">
        {status || '-'}
      </span>
    );
  };

  const renderStatusRepasseBadge = (status?: string | null) => {
    const s = (status || '').toLowerCase();
    if (s === 'pago' || s === 'concluido' || s === 'enviado') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Pago
        </span>
      );
    }
    if (s === 'processando' || s === 'em_andamento') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-[10px] font-bold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          Processando
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 text-[10px] font-bold uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {status || 'Pendente'}
      </span>
    );
  };

  const fetchTransacoesRestaurante = async (restauranteId: string) => {
    setLoadingTransacoesModal(true);
    try {
      const { data, error } = await supabase
        .from('pagamentos_pagbank')
        .select('*')
        .eq('restaurante_id', restauranteId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar transações do restaurante:', error);
        setTransacoesModalList([]);
      } else {
        const txs = data || [];
        const loteIds = Array.from(new Set(txs.map((t) => t.lote_repasse_id).filter(Boolean))) as string[];
        const loteMap = new Map<string, any>();

        if (loteIds.length > 0) {
          const { data: lotesData } = await supabase
            .from('lotes_repasse')
            .select('id, created_at, data_inicio')
            .in('id', loteIds);

          (lotesData || []).forEach((l) => loteMap.set(l.id, l));
        }

        const enriched: PagamentoPagbankRecord[] = txs.map((t) => {
          let codigoLote: string | null = null;
          if (t.lote_repasse_id) {
            const lote = loteMap.get(t.lote_repasse_id);
            const loteData = lote?.created_at || lote?.data_inicio || t.created_at;
            codigoLote = formatarCodigoLoteData(loteData);
          }

          return {
            ...t,
            lote_codigo: codigoLote,
          };
        });

        setTransacoesModalList(enriched);
      }
    } catch (err) {
      console.error('Erro ao carregar transações do restaurante:', err);
      setTransacoesModalList([]);
    } finally {
      setLoadingTransacoesModal(false);
    }
  };

  const fetchLotesRestauranteModal = async (restauranteId: string) => {
    setLoadingLotesModal(true);
    try {
      const { data: lotesData, error: lotesErr } = await supabase
        .from('lotes_repasse')
        .select('id, restaurante_id, data_inicio, data_fim, valor_pago, status_repasse, pago_em, comprovante_url, created_at')
        .eq('restaurante_id', restauranteId)
        .order('created_at', { ascending: false });

      if (lotesErr) {
        console.error('Erro ao buscar lotes do restaurante para modal:', lotesErr);
        setLotesModalList([]);
      } else {
        const formatados: LoteRepasseItem[] = (lotesData || []).map((lote) => ({
          id: lote.id,
          data_inicio: lote.data_inicio,
          data_fim: lote.data_fim,
          valor_pago: lote.valor_pago !== null && lote.valor_pago !== undefined ? Number(lote.valor_pago) : null,
          status_repasse: lote.status_repasse || 'Pendente',
          pago_em: lote.pago_em || null,
          comprovante_url: lote.comprovante_url || null,
          created_at: lote.created_at,
        }));
        setLotesModalList(formatados);
      }
    } catch (err) {
      console.error('Erro ao buscar lotes do restaurante:', err);
      setLotesModalList([]);
    } finally {
      setLoadingLotesModal(false);
    }
  };

  const handleAbrirModalLotesRestaurante = (rest: RestauranteRepasse) => {
    setRestauranteLotesModal(rest);
    // Inicializa imediatamente com os lotes já em memória caso existam, e atualiza via Supabase
    if (rest.lotes && rest.lotes.length > 0) {
      setLotesModalList(rest.lotes);
    } else {
      setLotesModalList([]);
    }
    fetchLotesRestauranteModal(rest.restaurante_id);
  };

  const handleAbrirModalRestaurante = (rest: RestauranteRepasse) => {
    setSelectedRestauranteParaModal(rest);
    setModalFiltroPeriodo('');
    setModalFiltroDataInicio('');
    setModalFiltroDataFim('');
    setModalFiltroStatusPagamento('');
    setModalFiltroStatusRepasse('');
    setModalFiltroCodigo('');
    fetchTransacoesRestaurante(rest.restaurante_id);
  };

  const fetchTodasTransacoes = async () => {
    setLoadingTodasTransacoes(true);
    try {
      const { data: txs, error: txErr } = await supabase
        .from('pagamentos_pagbank')
        .select('*')
        .order('created_at', { ascending: false });

      if (txErr) {
        console.error('Erro ao buscar todas as transações PagBank:', txErr);
        setTodasTransacoes([]);
        return;
      }

      const empIds = Array.from(new Set((txs || []).map((t) => t.empresa_id).filter(Boolean)));
      const restIds = Array.from(new Set((txs || []).map((t) => t.restaurante_id).filter(Boolean)));
      const loteIds = Array.from(new Set((txs || []).map((t) => t.lote_repasse_id).filter(Boolean))) as string[];

      const empMap = new Map<string, any>();
      const restMap = new Map<string, any>();
      const loteMap = new Map<string, any>();

      if (empIds.length > 0) {
        const { data: empData } = await supabase.from('empresas').select('id, nome, logo_url').in('id', empIds);
        (empData || []).forEach((e) => empMap.set(e.id, e));
      }

      if (restIds.length > 0) {
        const { data: restData } = await supabase.from('restaurantes').select('id, nome, telefone').in('id', restIds);
        (restData || []).forEach((r) => restMap.set(r.id, r));
      }

      if (loteIds.length > 0) {
        const { data: lotesData } = await supabase
          .from('lotes_repasse')
          .select('id, created_at, data_inicio')
          .in('id', loteIds);

        (lotesData || []).forEach((l) => loteMap.set(l.id, l));
      }

      const enriched: PagamentoPagbankRecord[] = (txs || []).map((t) => {
        const emp = empMap.get(t.empresa_id);
        const rest = restMap.get(t.restaurante_id);

        let codigoLote: string | null = null;
        if (t.lote_repasse_id) {
          const lote = loteMap.get(t.lote_repasse_id);
          const loteData = lote?.created_at || lote?.data_inicio || t.created_at;
          codigoLote = formatarCodigoLoteData(loteData);
        }

        return {
          ...t,
          empresa_nome: emp?.nome || 'Empresa Desconhecida',
          empresa_logo_url: emp?.logo_url || null,
          restaurante_nome: rest?.nome || 'Restaurante Desconhecido',
          lote_codigo: codigoLote,
        };
      });

      setTodasTransacoes(enriched);
    } catch (err) {
      console.error('Erro ao carregar todas as transações:', err);
      setTodasTransacoes([]);
    } finally {
      setLoadingTodasTransacoes(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin && activeTab === 'transacoes') {
      fetchTodasTransacoes();
    }
  }, [activeTab, isSuperAdmin]);

  const transacoesModalExibidas = React.useMemo(() => {
    return transacoesModalList.filter((tx) => {
      // 1. Período / Data
      if (modalFiltroPeriodo && modalFiltroPeriodo !== 'custom') {
        const intervalo = getIntervaloUtcBrasilia(modalFiltroPeriodo);
        if (intervalo) {
          const txDate = new Date(tx.created_at).getTime();
          const start = new Date(intervalo.inicioUtcIso).getTime();
          const end = new Date(intervalo.fimUtcIso).getTime();
          if (txDate < start || txDate >= end) return false;
        }
      } else if (modalFiltroDataInicio || modalFiltroDataFim) {
        const custom = getIntervaloUtcCustom(modalFiltroDataInicio, modalFiltroDataFim);
        if (custom) {
          const txDate = new Date(tx.created_at).getTime();
          if (custom.startUtc && txDate < custom.startUtc.getTime()) return false;
          if (custom.endUtc && txDate >= custom.endUtc.getTime()) return false;
        }
      }

      // 2. Status Pagamento
      if (modalFiltroStatusPagamento) {
        const statusTx = (tx.status_pagamento || '').toLowerCase();
        const statusFiltro = modalFiltroStatusPagamento.toLowerCase();
        if (statusFiltro === 'pago') {
          if (!['paid', 'pago', 'aprovado', 'authorized'].includes(statusTx)) return false;
        } else if (statusFiltro === 'estornado') {
          if (!['refunded', 'estornado', 'cancelled', 'canceled'].includes(statusTx)) return false;
        } else if (statusFiltro === 'pendente') {
          if (!['waiting', 'pendente', 'in_analysis'].includes(statusTx)) return false;
        } else {
          if (statusTx !== statusFiltro) return false;
        }
      }

      // 3. Status Repasse
      if (modalFiltroStatusRepasse) {
        const repasseTx = (tx.status_repasse || 'pendente').toLowerCase();
        if (repasseTx !== modalFiltroStatusRepasse.toLowerCase()) return false;
      }

      // 4. Código Transação / ID
      if (modalFiltroCodigo.trim()) {
        const search = modalFiltroCodigo.trim().toLowerCase();
        const matchId = (tx.id || '').toLowerCase().includes(search);
        const matchEntrega = (tx.entrega_id || '').toLowerCase().includes(search);
        const matchLote = (tx.lote_repasse_id || '').toLowerCase().includes(search);
        const matchLoteCodigo = (tx.lote_codigo || '').toLowerCase().includes(search);
        const matchPayloadId = tx.payload?.id ? String(tx.payload.id).toLowerCase().includes(search) : false;
        if (!matchId && !matchEntrega && !matchLote && !matchLoteCodigo && !matchPayloadId) return false;
      }

      return true;
    });
  }, [
    transacoesModalList,
    modalFiltroPeriodo,
    modalFiltroDataInicio,
    modalFiltroDataFim,
    modalFiltroStatusPagamento,
    modalFiltroStatusRepasse,
    modalFiltroCodigo,
  ]);

  const todasTransacoesExibidas = React.useMemo(() => {
    return todasTransacoes.filter((tx) => {
      // 1. Empresa
      if (filtroTransacaoEmpresa && tx.empresa_id !== filtroTransacaoEmpresa) {
        return false;
      }

      // 2. Restaurante
      if (filtroTransacaoRestaurante && tx.restaurante_id !== filtroTransacaoRestaurante) {
        return false;
      }

      // 3. Período / Data
      if (filtroTransacaoPeriodo && filtroTransacaoPeriodo !== 'custom') {
        const intervalo = getIntervaloUtcBrasilia(filtroTransacaoPeriodo);
        if (intervalo) {
          const txDate = new Date(tx.created_at).getTime();
          const start = new Date(intervalo.inicioUtcIso).getTime();
          const end = new Date(intervalo.fimUtcIso).getTime();
          if (txDate < start || txDate >= end) return false;
        }
      } else if (filtroTransacaoDataInicio || filtroTransacaoDataFim) {
        const custom = getIntervaloUtcCustom(filtroTransacaoDataInicio, filtroTransacaoDataFim);
        if (custom) {
          const txDate = new Date(tx.created_at).getTime();
          if (custom.startUtc && txDate < custom.startUtc.getTime()) return false;
          if (custom.endUtc && txDate >= custom.endUtc.getTime()) return false;
        }
      }

      // 4. Status Pagamento
      if (filtroTransacaoStatusPagamento) {
        const statusTx = (tx.status_pagamento || '').toLowerCase();
        const statusFiltro = filtroTransacaoStatusPagamento.toLowerCase();
        if (statusFiltro === 'pago') {
          if (!['paid', 'pago', 'aprovado', 'authorized'].includes(statusTx)) return false;
        } else if (statusFiltro === 'estornado') {
          if (!['refunded', 'estornado', 'cancelled', 'canceled'].includes(statusTx)) return false;
        } else if (statusFiltro === 'pendente') {
          if (!['waiting', 'pendente', 'in_analysis'].includes(statusTx)) return false;
        } else {
          if (statusTx !== statusFiltro) return false;
        }
      }

      // 5. Status Repasse
      if (filtroTransacaoStatusRepasse) {
        const repasseTx = (tx.status_repasse || 'pendente').toLowerCase();
        if (repasseTx !== filtroTransacaoStatusRepasse.toLowerCase()) return false;
      }

      // 6. Código da transação
      if (filtroTransacaoCodigo.trim()) {
        const search = filtroTransacaoCodigo.trim().toLowerCase();
        const matchId = (tx.id || '').toLowerCase().includes(search);
        const matchEntrega = (tx.entrega_id || '').toLowerCase().includes(search);
        const matchLote = (tx.lote_repasse_id || '').toLowerCase().includes(search);
        const matchLoteCodigo = (tx.lote_codigo || '').toLowerCase().includes(search);
        const matchPayloadId = tx.payload?.id ? String(tx.payload.id).toLowerCase().includes(search) : false;
        if (!matchId && !matchEntrega && !matchLote && !matchLoteCodigo && !matchPayloadId) return false;
      }

      return true;
    });
  }, [
    todasTransacoes,
    filtroTransacaoEmpresa,
    filtroTransacaoRestaurante,
    filtroTransacaoPeriodo,
    filtroTransacaoDataInicio,
    filtroTransacaoDataFim,
    filtroTransacaoStatusPagamento,
    filtroTransacaoStatusRepasse,
    filtroTransacaoCodigo,
  ]);

  const [repassesRestaurantes, setRepassesRestaurantes] = useState<RestauranteRepasse[]>([]);
  const [loadingRepasses, setLoadingRepasses] = useState(false);

  const fetchRepassesRestaurantes = async () => {
    setLoadingRepasses(true);
    try {
      // 1. Buscar empresas com pagbank_ativo = true em configuracoes_empresas
      const { data: configs, error: configError } = await supabase
        .from('configuracoes_empresas')
        .select('empresa_id, pagbank_ativo')
        .eq('pagbank_ativo', true);

      if (configError) {
        console.error('Erro ao buscar configuracoes_empresas:', configError);
        setRepassesRestaurantes([]);
        return;
      }

      if (!configs || configs.length === 0) {
        setRepassesRestaurantes([]);
        return;
      }

      const empresaIds = configs.map((c) => c.empresa_id).filter(Boolean);

      if (empresaIds.length === 0) {
        setRepassesRestaurantes([]);
        return;
      }

      // 2. Buscar TODOS os restaurantes dessas empresas
      const { data: restaurantesData, error: restaurantesError } = await supabase
        .from('restaurantes')
        .select('id, nome, telefone, ativo, empresa_id, empresas(id, nome, logo_url, ativo)')
        .or('ativo.is.null,ativo.eq.true')
        .in('empresa_id', empresaIds);

      if (restaurantesError) {
        console.error('Erro ao buscar restaurantes elegíveis:', restaurantesError);
        setRepassesRestaurantes([]);
        return;
      }

      const restauranteIds = (restaurantesData || []).map((r: any) => r.id);

      // 3. Buscar dados de integracoes_pagbank se existirem (sem filtrar restaurantes que não possuem)
      const integracaoMap = new Map<string, any>();
      if (restauranteIds.length > 0) {
        const { data: integracoes } = await supabase
          .from('integracoes_pagbank')
          .select('id, restaurante_id, pagbank_recipient_id, taxa_comissao')
          .in('restaurante_id', restauranteIds);

        if (integracoes) {
          integracoes.forEach((item) => {
            if (item.restaurante_id) {
              integracaoMap.set(item.restaurante_id, item);
            }
          });
        }
      }

      // 4. Buscar lotes_repasse para estes restaurantes com as colunas reais
      const lotesPorRestauranteMap = new Map<string, any[]>();

      // TESTE 1: Leitura direta de todos os lotes
      const { data: debugTodosLotes, error: debugTodosLotesError } =
        await supabase
          .from('lotes_repasse')
          .select('id, restaurante_id, data_inicio, data_fim, valor_pago, status_repasse, created_at')
          .limit(10);

      console.log("DEBUG LEITURA DIRETA LOTES", {
        data: debugTodosLotes,
        error: debugTodosLotesError,
        quantidade: debugTodosLotes?.length ?? 0
      });

      // TESTE 2: Leitura específica do restaurante
      const debugRestauranteId = '90ea40aa-3952-4661-a8df-dcaaa36ad36a';

      const { data: debugLoteRestaurante, error: debugLoteRestauranteError } =
        await supabase
          .from('lotes_repasse')
          .select('id, restaurante_id, data_inicio, data_fim, valor_pago, status_repasse, created_at')
          .eq('restaurante_id', debugRestauranteId);

      console.log("DEBUG LOTE RESTAURANTE ESPECIFICO", {
        data: debugLoteRestaurante,
        error: debugLoteRestauranteError,
        quantidade: debugLoteRestaurante?.length ?? 0
      });

      if (restauranteIds.length > 0) {
        const { data: lotesData, error: lotesErr } = await supabase
          .from('lotes_repasse')
          .select('id, restaurante_id, data_inicio, data_fim, valor_pago, status_repasse, pago_em, comprovante_url, created_at')
          .in('restaurante_id', restauranteIds)
          .order('created_at', { ascending: false });

        console.log("DEBUG LOTES REPASSE SUPABASE", {
          data: lotesData,
          error: lotesErr,
          quantidade: lotesData?.length ?? 0
        });

        if (lotesErr) {
          console.error('Erro ao buscar lotes_repasse:', lotesErr);
        } else if (lotesData) {
          lotesData.forEach((lote) => {
            if (lote.restaurante_id) {
              const arr = lotesPorRestauranteMap.get(lote.restaurante_id) || [];
              arr.push(lote);
              lotesPorRestauranteMap.set(lote.restaurante_id, arr);
            }
          });
        }

        console.log("DEBUG MAPA LOTES", {
          restauranteIds,
          lotesPorRestaurante: Array.from(lotesPorRestauranteMap.entries())
        });
      }

      // 5. Mapear para RestauranteRepasse
      const listaElegivel: RestauranteRepasse[] = [];
      (restaurantesData || []).forEach((rest: any) => {
        const pagbank = integracaoMap.get(rest.id);
        const emp = Array.isArray(rest.empresas) ? rest.empresas[0] : rest.empresas;
        const rawLotes = lotesPorRestauranteMap.get(rest.id) || [];

        const lotesFormatados: LoteRepasseItem[] = rawLotes.map((lote) => {
          return {
            id: lote.id,
            data_inicio: lote.data_inicio,
            data_fim: lote.data_fim,
            valor_pago: lote.valor_pago !== null && lote.valor_pago !== undefined ? Number(lote.valor_pago) : null,
            status_repasse: lote.status_repasse || 'Pendente',
            pago_em: lote.pago_em || null,
            comprovante_url: lote.comprovante_url || null,
            created_at: lote.created_at,
          };
        });

        const loteMaisRecente = lotesFormatados.length > 0 ? lotesFormatados[0] : null;

        const dadosFinais: RestauranteRepasse = {
          restaurante_id: rest.id,
          restaurante_nome: rest.nome,
          restaurante_telefone: rest.telefone || null,
          empresa_id: rest.empresa_id,
          empresa_nome: emp?.nome || 'Empresa Desconhecida',
          empresa_logo_url: emp?.logo_url || null,
          pagbank_ativo: true,
          pagbank_recipient_id: pagbank?.pagbank_recipient_id || null,
          taxa_comissao: pagbank?.taxa_comissao ?? null,
          lote_id: loteMaisRecente?.id || null,
          lote_data_inicio: loteMaisRecente?.data_inicio || null,
          lote_data_fim: loteMaisRecente?.data_fim || null,
          lote_valor_pago: loteMaisRecente?.valor_pago ?? null,
          lote_status_repasse: loteMaisRecente?.status_repasse || null,
          lote_pago_em: loteMaisRecente?.pago_em || null,
          lote_comprovante_url: loteMaisRecente?.comprovante_url || null,
          lote_created_at: loteMaisRecente?.created_at || null,
          lotes: lotesFormatados,
        };

        listaElegivel.push(dadosFinais);
      });

      console.log("REPASSES FINAIS", listaElegivel);
      setRepassesRestaurantes(listaElegivel);
    } catch (err) {
      console.error('Erro ao carregar restaurantes para repasses:', err);
      setRepassesRestaurantes([]);
    } finally {
      setLoadingRepasses(false);
    }
  };

  const formatarDataCicloParaISO = (val: string): string => {
    if (!val) return '';
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      const [d, m, y] = trimmed.split('/');
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return trimmed;
  };

  const processarRespostaFechamento = (data: any, error: any, dataCicloEnviada: string): ResultadoFechamento => {
    // Se data or dataObj contém resposta estruturada da Edge
    const responseObj = data || {};

    if (error) {
      const errorStr = (error.message || JSON.stringify(error)).toLowerCase();
      const statusNum = error.status || error.statusCode || error.code;
      const isAuth =
        statusNum === 401 ||
        statusNum === 403 ||
        errorStr.includes('401') ||
        errorStr.includes('403') ||
        errorStr.includes('unauthorized') ||
        errorStr.includes('forbidden') ||
        errorStr.includes('acesso negado') ||
        errorStr.includes('autorização') ||
        errorStr.includes('autorizacao') ||
        errorStr.includes('super admin');

      if (isAuth && !responseObj.erro) {
        return {
          tipo: 'acesso_negado',
          mensagem: 'Acesso negado. Verifique se você está logado como Super Admin.',
        };
      }
    }

    if (responseObj && Object.keys(responseObj).length > 0) {
      const status = (responseObj.status || responseObj.code || '').toString().toLowerCase();
      const msg = (responseObj.mensagem || responseObj.message || responseObj.erro || responseObj.error || responseObj.details || '').toString();
      const msgLower = msg.toLowerCase();
      const etapaStr = responseObj.etapa ? ` (Etapa: ${responseObj.etapa})` : '';

      if (
        msgLower.includes('401') ||
        msgLower.includes('403') ||
        msgLower.includes('unauthorized') ||
        msgLower.includes('forbidden') ||
        msgLower.includes('acesso negado') ||
        msgLower.includes('autorização') ||
        msgLower.includes('autorizacao')
      ) {
        return {
          tipo: 'acesso_negado',
          mensagem: `Acesso negado. Verifique se você está logado como Super Admin.${etapaStr}`,
        };
      }

      if (
        status === 'ja_fechado' ||
        status === 'lote_existente' ||
        status === 'already_closed' ||
        msgLower.includes('já foi fechado') ||
        msgLower.includes('ja foi fechado') ||
        msgLower.includes('já existe') ||
        msgLower.includes('ja existe') ||
        msgLower.includes('ciclo já') ||
        msgLower.includes('ciclo ja')
      ) {
        return {
          tipo: 'ja_fechado',
          mensagem: `Este ciclo já foi fechado.${etapaStr}`,
        };
      }

      if (
        status === 'sem_pagamentos' ||
        status === 'no_payments' ||
        status === 'nenhum_pagamento' ||
        msgLower.includes('sem pagamentos') ||
        msgLower.includes('sem_pagamentos') ||
        msgLower.includes('nenhum pagamento') ||
        msgLower.includes('nenhum pagamento aprovado')
      ) {
        return {
          tipo: 'sem_pagamentos',
          mensagem: `Nenhum pagamento aprovado pendente encontrado para este ciclo.${etapaStr}`,
        };
      }

      const isSucesso = responseObj.sucesso === true || responseObj.success === true || status === 'sucesso' || status === 'success' || status === 'ok';

      if (isSucesso) {
        const qtdPag = responseObj.quantidade_pagamentos ?? responseObj.qtd_pagamentos ?? responseObj.quantidade ?? 0;
        const valTotal = responseObj.valor_total ?? responseObj.total ?? 0;
        let lotes = responseObj.lotes_criados ?? responseObj.qtd_lotes ?? responseObj.lotes ?? 0;
        if (Array.isArray(lotes)) {
          lotes = lotes.length;
        }

        let dataExibicao = responseObj.data_ciclo || dataCicloEnviada;
        if (dataExibicao && dataExibicao.includes('-')) {
          const [yyyy, mm, dd] = dataExibicao.split('-');
          if (yyyy && mm && dd) {
            dataExibicao = `${dd}/${mm}/${yyyy}`;
          }
        }

        return {
          tipo: 'sucesso',
          mensagem: responseObj.mensagem || 'Ciclo fechado com sucesso.',
          detalhes: {
            data_ciclo: dataExibicao,
            quantidade_pagamentos: Number(qtdPag),
            valor_total: Number(valTotal),
            lotes_criados: Number(lotes),
          },
        };
      }

      if (responseObj.erro || responseObj.mensagem || responseObj.message || responseObj.error) {
        return {
          tipo: 'erro',
          mensagem: `${responseObj.erro || responseObj.mensagem || responseObj.message || responseObj.error}${etapaStr}`,
        };
      }
    }

    if (error) {
      return {
        tipo: 'erro',
        mensagem: error.message || 'Erro ao processar fechamento do ciclo.',
      };
    }

    return {
      tipo: 'erro',
      mensagem: 'Não foi possível fechar o ciclo.',
    };
  };

  const handleFecharCicloManual = async () => {
    if (!dataCicloInput) return;

    const dataCicloFormatted = formatarDataCicloParaISO(dataCicloInput);
    setFechandoCiclo(true);
    setResultadoFechamento(null);

    try {
      const { data, error } = await supabase.functions.invoke('Fechamento_CicloPB', {
        body: {
          data_ciclo: dataCicloFormatted,
        },
      });

      let responsePayload = data;
      if (error && error.context && typeof error.context.json === 'function') {
        try {
          const jsonBody = await error.context.json();
          if (jsonBody) {
            responsePayload = jsonBody;
          }
        } catch (e) {
          console.error('Erro ao ler JSON de error.context:', e);
        }
      }

      const res = processarRespostaFechamento(responsePayload, error, dataCicloFormatted);
      setResultadoFechamento(res);

      if (res.tipo === 'sucesso') {
        fetchRepassesRestaurantes();
      }
    } catch (err: any) {
      console.error('Erro ao chamar Fechamento_CicloPB:', err);
      setResultadoFechamento({
        tipo: 'erro',
        mensagem: err?.message || 'Erro inesperado ao fechar ciclo.',
      });
    } finally {
      setFechandoCiclo(false);
    }
  };

  const handleGerarArquivoPagbank = async () => {
    if (gerandoArquivoPagbank) return;
    setGerandoArquivoPagbank(true);
    setResultadoGeracaoPagbank(null);

    try {
      const { data, error } = await supabase.functions.invoke('Fechamento_CicloPB', {
        body: {
          acao: 'gerar_remessa_xlsx',
          gerar_remessa: true,
          gerar_arquivo: true,
          data_ciclo: dataCicloInput || undefined,
          restaurante_id: filtroRestaurante || undefined,
        },
      });

      if (error) {
        let msg = error.message || 'Erro ao gerar arquivo PagBank.';
        if (error.context) {
          try {
            if (typeof error.context.text === 'function') {
              const raw = await error.context.text();
              try {
                const parsed = JSON.parse(raw);
                msg = parsed.erro || parsed.mensagem || parsed.error || parsed.message || raw;
              } catch {
                if (raw) msg = raw;
              }
            } else if (typeof error.context.json === 'function') {
              const jsonBody = await error.context.json();
              msg = jsonBody.erro || jsonBody.mensagem || jsonBody.error || jsonBody.message || msg;
            }
          } catch {}
        }
        throw new Error(msg);
      }

      if (!data) {
        throw new Error('Nenhum dado retornado pela Edge Function.');
      }

      let blobToDownload: Blob | null = null;
      let fileName = `remessa_pagbank_${dataCicloInput || new Date().toISOString().split('T')[0]}.xlsx`;

      if (data instanceof Blob) {
        // Verifica se o Blob retornado é na verdade um JSON de erro
        if (data.type && data.type.includes('application/json')) {
          const text = await data.text();
          try {
            const json = JSON.parse(text);
            if (json.sucesso === false || json.erro || json.error) {
              throw new Error(json.erro || json.mensagem || json.error || 'Erro retornado pela Edge Function.');
            }
          } catch (e: any) {
            if (e.message && !e.message.includes('Unexpected token')) {
              throw e;
            }
          }
        }
        blobToDownload = data;
      } else if (typeof data === 'object' && data !== null) {
        // Se a Edge Function retornou JSON de erro
        if (data.sucesso === false || data.erro || data.error) {
          throw new Error(data.erro || data.mensagem || data.error || 'Erro ao processar arquivo.');
        }

        // Se retornou base64
        if (data.arquivo_base64) {
          const byteCharacters = atob(data.arquivo_base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          blobToDownload = new Blob([byteArray], {
            type: data.mime_type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          if (data.arquivo_nome) {
            fileName = data.arquivo_nome;
          }
        }
      }

      if (!blobToDownload) {
        blobToDownload = new Blob([data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
      }

      // Download automático do arquivo
      const url = window.URL.createObjectURL(blobToDownload);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setResultadoGeracaoPagbank({
        tipo: 'sucesso',
        mensagem: `Arquivo PagBank (${fileName}) gerado e baixado com sucesso!`,
        arquivo_nome: fileName,
      });
    } catch (err: any) {
      console.error('Erro ao gerar arquivo PagBank:', err);
      setResultadoGeracaoPagbank({
        tipo: 'erro',
        mensagem: err?.message || 'Erro inesperado ao gerar arquivo de pagamentos.',
      });
    } finally {
      setGerandoArquivoPagbank(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin && activeTab === 'repasses') {
      fetchRepassesRestaurantes();
    }
  }, [activeTab, isSuperAdmin]);

  // Lista de empresas elegíveis (possui pelo menos um restaurante com PagBank ativo)
  const empresasElegiveis = React.useMemo(() => {
    const map = new Map<string, { id: string; nome: string }>();
    repassesRestaurantes.forEach((item) => {
      if (!map.has(item.empresa_id)) {
        map.set(item.empresa_id, { id: item.empresa_id, nome: item.empresa_nome });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [repassesRestaurantes]);

  // Lista de restaurantes elegíveis (filtrados por empresa se selecionada)
  const restaurantesElegiveis = React.useMemo(() => {
    let list = repassesRestaurantes;
    if (filtroEmpresa) {
      list = list.filter((item) => item.empresa_id === filtroEmpresa);
    }
    return list.sort((a, b) => a.restaurante_nome.localeCompare(b.restaurante_nome));
  }, [repassesRestaurantes, filtroEmpresa]);

  const loteMatchesPeriodo = (lote: LoteRepasseItem, periodoKey: string): boolean => {
    if (!periodoKey) return true;
    const intervalo = getIntervaloUtcBrasilia(periodoKey);
    if (!intervalo) return true;

    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
    const startPeriodIso = formatter.format(new Date(intervalo.inicioUtcIso));
    const endPeriodIso = formatter.format(new Date(new Date(intervalo.fimUtcIso).getTime() - 1));

    const loteInicio = lote.data_inicio ? lote.data_inicio.split('T')[0] : '';
    const loteFim = lote.data_fim ? lote.data_fim.split('T')[0] : '';
    const loteCreated = lote.created_at ? formatter.format(new Date(lote.created_at)) : '';

    if (loteInicio && loteFim) {
      return loteInicio <= endPeriodIso && loteFim >= startPeriodIso;
    }
    if (loteCreated) {
      return loteCreated >= startPeriodIso && loteCreated <= endPeriodIso;
    }
    return true;
  };

  const loteMatchesStatus = (lote: LoteRepasseItem, statusFiltro: string): boolean => {
    if (!statusFiltro) return true;
    const st = (lote.status_repasse || 'pendente').toLowerCase();
    return st === statusFiltro.toLowerCase();
  };

  // Restaurantes para exibição na tabela
  const repassesExibidos = React.useMemo(() => {
    const list: Array<RestauranteRepasse & { loteExibicao?: LoteRepasseItem | null }> = [];

    repassesRestaurantes.forEach((item) => {
      if (filtroEmpresa && item.empresa_id !== filtroEmpresa) return;
      if (filtroRestaurante && item.restaurante_id !== filtroRestaurante) return;

      const lotes = item.lotes || [];

      if (filtroPeriodo || filtroStatus) {
        const lotesFiltrados = lotes.filter((lote) => {
          const matchP = loteMatchesPeriodo(lote, filtroPeriodo);
          const matchS = loteMatchesStatus(lote, filtroStatus);
          return matchP && matchS;
        });

        if (lotesFiltrados.length > 0) {
          list.push({
            ...item,
            loteExibicao: lotesFiltrados[0],
          });
        }
      } else {
        list.push({
          ...item,
          loteExibicao: lotes.length > 0 ? lotes[0] : null,
        });
      }
    });

    return list;
  }, [repassesRestaurantes, filtroEmpresa, filtroRestaurante, filtroPeriodo, filtroStatus]);

  const fetchEmpresas = async () => {
    setLoadingEmpresas(true);
    try {
      let query = supabase
        .from('empresas')
        .select('*')
        .order('created_at', { ascending: false });

      if (pesquisaEmpresa.trim()) {
        query = query.ilike('nome', `%${pesquisaEmpresa.trim()}%`);
      }

      if (filtroStatusEmpresa === 'ativas') {
        query = query.or('ativo.is.null,ativo.eq.true');
      } else if (filtroStatusEmpresa === 'bloqueadas') {
        query = query.eq('ativo', false);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar empresas:', error);
      } else {
        setEmpresas(data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar empresas:', err);
    } finally {
      setLoadingEmpresas(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin && activeTab === 'empresas') {
      fetchEmpresas();
    }
  }, [pesquisaEmpresa, filtroStatusEmpresa, activeTab, isSuperAdmin]);

  const checkSuperAdminAccess = async () => {
    setCheckingAuth(true);
    setAuthError(null);

    try {
      // 1. Verificar se existe uma sessão do Supabase
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        setAuthError(sessionError.message || 'Erro ao verificar a sessão de usuário.');
        setCheckingAuth(false);
        return;
      }

      const session = sessionData?.session;
      if (!session) {
        // Se NÃO estiver logado: Redirecionar imediatamente para /login
        navigate('/login', { replace: true });
        return;
      }

      // 2. Se estiver logado: Executar supabase.rpc('is_super_admin')
      const { data, error } = await supabase.rpc('is_super_admin');

      if (error) {
        setAuthError(error.message || 'Ocorreu um erro ao verificar permissão de Super Admin.');
        setCheckingAuth(false);
        return;
      }

      // 3. Verificar se data === true ou false
      if (data === true) {
        // Permitir acesso normalmente à página /super-admin
        setIsSuperAdmin(true);
        setCheckingAuth(false);
        fetchEmpresas();
      } else {
        // Se data === false: Não permitir acesso ao Super Admin. Redirecionar para o painel normal
        navigate('/', { replace: true });
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Erro inesperado durante a verificação de acesso.');
      setCheckingAuth(false);
    }
  };

  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  const handleCriarEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeEmpresa.trim() || !emailAdmin.trim() || !senhaAdmin.trim() || submitting) return;

    setSubmitting(true);
    setModalError(null);

    try {
      const { data, error } = await supabase.functions.invoke('create-company', {
        body: {
          nome: nomeEmpresa.trim(),
          telefone: telefoneEmpresa.trim() || null,
          email: emailAdmin.trim(),
          password: senhaAdmin.trim()
        }
      });

      if (error) {
        console.error('Erro na função create-company:', error);
        setModalError(error.message || 'Erro ao comunicar com o servidor.');
        setSubmitting(false);
        return;
      }

      if (!data?.success) {
        setModalError(data?.error || 'Não foi possível criar a empresa.');
        setSubmitting(false);
        return;
      }

      // Sucesso
      resetModalForm();
      setIsNovaEmpresaModalOpen(false);
      setSucessoMsg('Empresa criada com sucesso.');
      setTimeout(() => {
        setSucessoMsg(null);
      }, 4000);

      await fetchEmpresas();
    } catch (err: any) {
      console.error('Erro inesperado ao criar empresa:', err);
      setModalError(err?.message || 'Erro inesperado ao criar a empresa.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDataCriacao = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const handleToggleStatus = async () => {
    if (!empresaParaAlterar || loadingToggleStatus) return;
    setLoadingToggleStatus(true);

    const novoAtivo = empresaParaAlterar.ativo === false ? true : false;

    try {
      const { error } = await supabase
        .from('empresas')
        .update({ ativo: novoAtivo })
        .eq('id', empresaParaAlterar.id);

      if (error) {
        console.error('Erro ao alterar status da empresa:', error);
        setSucessoMsg(`Erro ao alterar status da empresa: ${error.message}`);
        setTimeout(() => setSucessoMsg(null), 5000);
      } else {
        setSucessoMsg(
          novoAtivo
            ? `Empresa "${empresaParaAlterar.nome}" ativada com sucesso!`
            : `Empresa "${empresaParaAlterar.nome}" bloqueada com sucesso!`
        );
        setTimeout(() => setSucessoMsg(null), 4000);
        setEmpresaParaAlterar(null);
        await fetchEmpresas();
      }
    } catch (err: any) {
      console.error('Erro ao alternar status da empresa:', err);
      setSucessoMsg(err?.message || 'Erro inesperado ao alterar status.');
      setTimeout(() => setSucessoMsg(null), 5000);
    } finally {
      setLoadingToggleStatus(false);
    }
  };

  const empresasExibidas = empresas.filter((emp) => {
    const matchNome = !pesquisaEmpresa.trim() || emp.nome.toLowerCase().includes(pesquisaEmpresa.trim().toLowerCase());
    const isAtivo = emp.ativo !== false;
    const matchStatus =
      filtroStatusEmpresa === 'todas' ||
      (filtroStatusEmpresa === 'ativas' && isAtivo) ||
      (filtroStatusEmpresa === 'bloqueadas' && !isAtivo);
    return matchNome && matchStatus;
  });

  // Render de Carregamento
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 bg-white p-8 rounded-2xl border border-neutral-200/80 shadow-xs max-w-sm w-full text-center">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
          <p className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
            Verificando permissões...
          </p>
        </div>
      </div>
    );
  }

  // Render de Erro
  if (authError) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-6 sm:p-8 rounded-2xl border border-neutral-200/80 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto shrink-0">
            <AlertCircle size={24} />
          </div>

          <div>
            <h2 className="text-base font-black text-neutral-900 tracking-tight">
              Erro ao verificar acesso
            </h2>
            <p className="text-xs text-neutral-500 font-medium mt-1">
              {authError}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              onClick={() => checkSuperAdminAccess()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 text-neutral-700 font-bold text-xs hover:bg-neutral-50 transition-colors"
            >
              <RefreshCw size={14} />
              Tentar novamente
            </button>

            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition-colors"
            >
              <ArrowLeft size={14} />
              Voltar para o Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      {/* Topo da página / Header Integrado */}
      <header className="bg-white border-b border-neutral-200/80 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-xl font-black tracking-tight text-neutral-900">
                Delivery<span className="text-orange-600">Plus</span>
              </h1>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mt-0.5">
                Painel administrativo
              </p>
            </div>
          </div>

          {/* Menu simples para alternar entre Empresas, Repasses e Transações */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-neutral-100">
            <button
              onClick={() => setActiveTab('empresas')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'empresas'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-900'
              }`}
            >
              <Building2 size={15} />
              Empresas
            </button>

            <button
              onClick={() => setActiveTab('repasses')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'repasses'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-900'
              }`}
            >
              <ArrowLeftRight size={15} />
              Repasses
            </button>

            <button
              onClick={() => setActiveTab('transacoes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'transacoes'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-neutral-100/80 text-neutral-600 hover:bg-neutral-200/80 hover:text-neutral-900'
              }`}
            >
              <Receipt size={15} />
              Transações
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ABA: EMPRESAS */}
        {activeTab === 'empresas' && (
          <div className="space-y-6">
            {sucessoMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-200/80 text-emerald-800 rounded-2xl flex items-center gap-3 text-xs font-bold shadow-xs">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <span>{sucessoMsg}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-neutral-900 tracking-tight">Empresas</h2>
                <p className="text-xs text-neutral-500 font-medium mt-0.5">
                  Gerencie as empresas cadastradas no DeliveryPlus.
                </p>
              </div>

              <button
                onClick={() => {
                  resetModalForm();
                  setIsNovaEmpresaModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-[0.98]"
              >
                <Plus size={16} />
                + Nova empresa
              </button>
            </div>

            {/* Área de Filtro e Pesquisa */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Pesquisar empresa..."
                  value={pesquisaEmpresa}
                  onChange={(e) => setPesquisaEmpresa(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl pl-9 pr-3.5 py-2.5 font-semibold placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 sm:w-64">
                <label className="text-[10px] font-bold uppercase text-neutral-500 whitespace-nowrap">
                  Status:
                </label>
                <select
                  value={filtroStatusEmpresa}
                  onChange={(e) => setFiltroStatusEmpresa(e.target.value as any)}
                  className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2.5 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                >
                  <option value="todas">Todas</option>
                  <option value="ativas">Ativas</option>
                  <option value="bloqueadas">Bloqueadas</option>
                </select>
              </div>
            </div>

            {/* Área/lista para as empresas */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
              {loadingEmpresas ? (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-orange-600 animate-spin mb-2" />
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    Carregando empresas...
                  </p>
                </div>
              ) : empresasExibidas.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                  <div className="w-12 h-12 bg-neutral-100 text-neutral-400 rounded-2xl flex items-center justify-center mb-3">
                    <Building2 size={24} />
                  </div>
                  <p className="text-xs font-extrabold text-neutral-800 uppercase tracking-wider">
                    Nenhuma empresa encontrada.
                  </p>
                  {(pesquisaEmpresa || filtroStatusEmpresa !== 'todas') && (
                    <p className="text-xs text-neutral-400 mt-1">
                      Tente alterar os termos de pesquisa ou o filtro de status.
                    </p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-50 border-b border-neutral-200/80 text-neutral-500 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Empresa</th>
                        <th className="py-3 px-4">Telefone</th>
                        <th className="py-3 px-4">Data de criação</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
                      {empresasExibidas.map((emp) => {
                        const initial = emp.nome ? emp.nome.trim().charAt(0).toUpperCase() : 'E';
                        const color = getAvatarColors(emp.nome);
                        const isAtiva = emp.ativo !== false;

                        return (
                          <tr
                            key={emp.id}
                            className={`hover:bg-neutral-50/60 transition-colors ${!isAtiva ? 'bg-neutral-50/40 opacity-80' : ''}`}
                          >
                            <td className="py-3.5 px-4 font-bold text-neutral-900 flex items-center gap-3">
                              {emp.logo_url ? (
                                <img
                                  src={emp.logo_url}
                                  alt={emp.nome}
                                  className="w-9 h-9 rounded-xl object-cover border border-neutral-200/80 shrink-0 shadow-2xs bg-white"
                                />
                              ) : (
                                <div className={`w-9 h-9 rounded-xl ${color.bg} border font-black text-xs flex items-center justify-center shrink-0 shadow-2xs`}>
                                  {initial}
                                </div>
                              )}
                              <span className={!isAtiva ? 'line-through text-neutral-500' : ''}>{emp.nome}</span>
                            </td>
                            <td className="py-3.5 px-4">{emp.telefone || '-'}</td>
                            <td className="py-3.5 px-4 text-neutral-500">{formatDataCriacao(emp.created_at)}</td>
                            <td className="py-3.5 px-4">
                              {isAtiva ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-bold uppercase tracking-wider">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Ativa
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200/80 text-[10px] font-bold uppercase tracking-wider">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                  Bloqueada
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              {isAtiva ? (
                                <button
                                  onClick={() => setEmpresaParaAlterar(emp)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs transition-colors active:scale-95"
                                >
                                  <Lock size={13} />
                                  Bloquear
                                </button>
                              ) : (
                                <button
                                  onClick={() => setEmpresaParaAlterar(emp)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold text-xs transition-colors active:scale-95"
                                >
                                  <Unlock size={13} />
                                  Ativar
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA: REPASSES */}
        {activeTab === 'repasses' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-neutral-900 tracking-tight">Repasses</h2>
              <p className="text-xs text-neutral-500 font-medium mt-0.5">
                Acompanhe os valores das vendas e os repasses dos restaurantes.
              </p>
            </div>

            {/* Filtros simples */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-700 uppercase tracking-wider">
                <Filter size={14} className="text-neutral-400" />
                Filtros
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Filtro Empresa */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                    Empresa
                  </label>
                  <select
                    value={filtroEmpresa}
                    onChange={(e) => {
                      const selectedEmp = e.target.value;
                      setFiltroEmpresa(selectedEmp);
                      if (selectedEmp && filtroRestaurante) {
                        const pertence = repassesRestaurantes.some(
                          (r) => r.empresa_id === selectedEmp && r.restaurante_id === filtroRestaurante
                        );
                        if (!pertence) {
                          setFiltroRestaurante('');
                        }
                      }
                    }}
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  >
                    <option value="">Todas as empresas</option>
                    {empresasElegiveis.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro Restaurante */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                    Restaurante
                  </label>
                  <select
                    value={filtroRestaurante}
                    onChange={(e) => setFiltroRestaurante(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  >
                    <option value="">Todos os restaurantes</option>
                    {restaurantesElegiveis.map((rest) => (
                      <option key={rest.restaurante_id} value={rest.restaurante_id}>
                        {rest.restaurante_nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filtro Período */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                    Período
                  </label>
                  <select
                    value={filtroPeriodo}
                    onChange={(e) => setFiltroPeriodo(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  >
                    <option value="">Todos os períodos</option>
                    <option value="hoje">Hoje</option>
                    <option value="semana">Esta semana</option>
                    <option value="mes">Este mês</option>
                  </select>
                </div>

                {/* Filtro Status */}
                <div>
                  <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">
                    Status
                  </label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  >
                    <option value="">Todos os status</option>
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Fechamento de ciclo manual */}
            <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-orange-600 shrink-0">
                    <CalendarCheck size={18} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                      Fechamento de Ciclo
                    </h3>
                    <p className="text-[11px] text-neutral-500 font-medium">
                      Selecione a data do ciclo para fechar os repasses dos pagamentos aprovados.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-neutral-700 whitespace-nowrap">
                      Data do ciclo:
                    </label>
                    <input
                      type="date"
                      value={dataCicloInput}
                      onChange={(e) => setDataCicloInput(e.target.value)}
                      className="bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleFecharCicloManual}
                    disabled={fechandoCiclo || !dataCicloInput}
                    className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {fechandoCiclo ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Fechando ciclo...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        <span>Fechar ciclo</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleGerarArquivoPagbank}
                    disabled={gerandoArquivoPagbank}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    title="Gera planilha Excel (.xlsx) com todos os lotes pendentes de repasse"
                  >
                    {gerandoArquivoPagbank ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Gerando arquivo...</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet size={14} />
                        <span>Gerar Arquivo PagBank (.xlsx)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Mensagem / Resultado do Fechamento */}
              {resultadoFechamento && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-medium transition-all ${
                    resultadoFechamento.tipo === 'sucesso'
                      ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                      : resultadoFechamento.tipo === 'sem_pagamentos' || resultadoFechamento.tipo === 'ja_fechado'
                      ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                      : 'bg-rose-50/90 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {resultadoFechamento.tipo === 'sucesso' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : resultadoFechamento.tipo === 'sem_pagamentos' || resultadoFechamento.tipo === 'ja_fechado' ? (
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1 space-y-1.5">
                      <p className="font-bold text-xs sm:text-sm">
                        {resultadoFechamento.mensagem}
                      </p>

                      {resultadoFechamento.tipo === 'sucesso' && resultadoFechamento.detalhes && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 mt-1 border-t border-emerald-200/80 text-emerald-800 font-semibold text-xs">
                          <div>
                            <span className="block text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                              Data do ciclo
                            </span>
                            <span className="text-emerald-950 font-bold">
                              {resultadoFechamento.detalhes.data_ciclo || '-'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                              Qtd. Pagamentos
                            </span>
                            <span className="text-emerald-950 font-bold">
                              {resultadoFechamento.detalhes.quantidade_pagamentos ?? 0}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                              Valor total
                            </span>
                            <span className="text-emerald-950 font-bold">
                              {formatarMoeda(resultadoFechamento.detalhes.valor_total ?? 0)}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                              Lotes criados
                            </span>
                            <span className="text-emerald-950 font-bold">
                              {resultadoFechamento.detalhes.lotes_criados ?? 0}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Mensagem / Resultado da Geração do Arquivo PagBank */}
              {resultadoGeracaoPagbank && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-medium transition-all ${
                    resultadoGeracaoPagbank.tipo === 'sucesso'
                      ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                      : resultadoGeracaoPagbank.tipo === 'aviso'
                      ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                      : 'bg-rose-50/90 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {resultadoGeracaoPagbank.tipo === 'sucesso' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : resultadoGeracaoPagbank.tipo === 'aviso' ? (
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1 space-y-1">
                      <p className="font-bold text-xs sm:text-sm">
                        {resultadoGeracaoPagbank.mensagem}
                      </p>
                      {resultadoGeracaoPagbank.tipo === 'sucesso' && resultadoGeracaoPagbank.arquivo_nome && (
                        <p className="text-[11px] opacity-80">
                          Arquivo baixado: <span className="font-mono font-semibold">{resultadoGeracaoPagbank.arquivo_nome}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tabela de Repasses */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200/80 text-neutral-500 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Empresa</th>
                      <th className="py-3 px-4">Restaurante</th>
                      <th className="py-3 px-4">Período</th>
                      <th className="py-3 px-4">Valor</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Data do repasse</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
                    {loadingRepasses ? (
                      <tr>
                        <td colSpan={6} className="py-12 px-4 text-center">
                          <div className="flex items-center justify-center gap-2 text-neutral-500 font-semibold text-xs">
                            <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
                            <span>Carregando restaurantes elegíveis...</span>
                          </div>
                        </td>
                      </tr>
                    ) : repassesExibidos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 px-4 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-12 h-12 bg-neutral-100 text-neutral-400 rounded-2xl flex items-center justify-center mb-3">
                              <ArrowLeftRight size={22} />
                            </div>
                            <p className="text-xs font-extrabold text-neutral-800 uppercase tracking-wider">
                              Nenhum repasse encontrado
                            </p>
                            <p className="text-xs text-neutral-400 mt-1">
                              Não há restaurantes com integração PagBank ativa para os filtros selecionados.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      repassesExibidos.map((item) => {
                        const color = getAvatarColors(item.empresa_nome);
                        const initial = item.empresa_nome ? item.empresa_nome.trim().charAt(0).toUpperCase() : 'E';

                        // Padronização unificada da fonte do lote (loteExibicao > lotes[0] > campos diretos do item)
                        const lote = item.loteExibicao || (item.lotes && item.lotes.length > 0 ? item.lotes[0] : null);
                        const dataInicio = lote?.data_inicio ?? item.lote_data_inicio;
                        const dataFim = lote?.data_fim ?? item.lote_data_fim;
                        const valorPago = lote?.valor_pago ?? item.lote_valor_pago;
                        const statusRepasse = lote?.status_repasse ?? item.lote_status_repasse;
                        const pagoEm = lote?.pago_em ?? item.lote_pago_em;
                        const temLote = Boolean(lote?.id || item.lote_id || dataInicio || dataFim || valorPago !== null);

                        const isPago = (statusRepasse || '').toLowerCase() === 'pago';

                        console.log("LOTE RENDERIZADO", lote);

                        return (
                          <tr key={item.restaurante_id} className="hover:bg-neutral-50/60 transition-colors">
                            {/* EMPRESA */}
                            <td className="py-3.5 px-4 font-bold text-neutral-900">
                              <div className="flex items-center gap-3">
                                {item.empresa_logo_url ? (
                                  <img
                                    src={item.empresa_logo_url}
                                    alt={item.empresa_nome}
                                    className="w-9 h-9 rounded-xl object-cover border border-neutral-200/80 shrink-0 shadow-2xs bg-white"
                                  />
                                ) : (
                                  <div className={`w-9 h-9 rounded-xl ${color.bg} border font-black text-xs flex items-center justify-center shrink-0 shadow-2xs`}>
                                    {initial}
                                  </div>
                                )}
                                <span>{item.empresa_nome}</span>
                              </div>
                            </td>

                            {/* RESTAURANTE (Clicável para abrir modal de lotes) */}
                            <td className="py-3.5 px-4 font-bold text-neutral-800">
                              <button
                                type="button"
                                onClick={() => handleAbrirModalLotesRestaurante(item)}
                                className="text-left group inline-flex flex-col focus:outline-none"
                                title="Clique para ver todos os lotes de repasse deste restaurante"
                              >
                                <span className="text-orange-600 hover:text-orange-700 hover:underline transition-colors font-extrabold flex items-center gap-1.5 cursor-pointer">
                                  {item.restaurante_nome}
                                </span>
                                {item.restaurante_telefone && (
                                  <span className="text-[11px] font-normal text-neutral-400 mt-0.5">
                                    {item.restaurante_telefone}
                                  </span>
                                )}
                              </button>
                            </td>

                            {/* PERÍODO */}
                            <td className="py-3.5 px-4 text-neutral-700 font-medium whitespace-nowrap">
                              {temLote ? formatarPeriodoLote(dataInicio, dataFim) : '-'}
                            </td>

                            {/* VALOR */}
                            <td className="py-3.5 px-4 font-bold text-neutral-900 whitespace-nowrap">
                              {temLote && valorPago !== null && valorPago !== undefined ? formatarMoeda(valorPago) : '-'}
                            </td>

                            {/* STATUS */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {temLote && statusRepasse ? renderStatusRepasseBadge(statusRepasse) : <span className="text-neutral-400 font-medium">-</span>}
                            </td>

                            {/* DATA DO REPASSE */}
                            <td className="py-3.5 px-4 text-neutral-700 font-medium whitespace-nowrap">
                              {temLote && isPago && pagoEm ? formatarDataRepasse(pagoEm) : '-'}
                            </td>

                            {/* AÇÕES */}
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => handleAbrirModalRestaurante(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs transition-colors"
                              >
                                <Receipt size={14} className="text-orange-600" />
                                Ver transações
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ABA: TRANSAÇÕES */}
        {activeTab === 'transacoes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-neutral-900 tracking-tight">Transações PagBank</h2>
                <p className="text-xs text-neutral-500 font-medium mt-0.5">
                  Histórico completo de pagamentos e repasses processados
                </p>
              </div>

              <button
                onClick={fetchTodasTransacoes}
                disabled={loadingTodasTransacoes}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-neutral-200/80 text-neutral-700 font-bold text-xs hover:bg-neutral-50 shadow-2xs transition-colors self-start sm:self-auto disabled:opacity-50"
              >
                <RefreshCw size={14} className={loadingTodasTransacoes ? 'animate-spin text-orange-600' : ''} />
                Atualizar
              </button>
            </div>

            {/* Painel de Filtros Integrados */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-xs font-extrabold text-neutral-900 uppercase tracking-wider pb-2 border-b border-neutral-100">
                <Filter size={15} className="text-orange-600" />
                <span>Filtros das Transações</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                {/* Empresa */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                    Empresa
                  </label>
                  <select
                    value={filtroTransacaoEmpresa}
                    onChange={(e) => {
                      setFiltroTransacaoEmpresa(e.target.value);
                      setFiltroTransacaoRestaurante('');
                    }}
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  >
                    <option value="">Todas as empresas</option>
                    {empresasElegiveis.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nome}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Restaurante */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                    Restaurante
                  </label>
                  <select
                    value={filtroTransacaoRestaurante}
                    onChange={(e) => setFiltroTransacaoRestaurante(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  >
                    <option value="">Todos os restaurantes</option>
                    {repassesRestaurantes
                      .filter((r) => !filtroTransacaoEmpresa || r.empresa_id === filtroTransacaoEmpresa)
                      .map((r) => (
                        <option key={r.restaurante_id} value={r.restaurante_id}>
                          {r.restaurante_nome}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Período */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                    Período
                  </label>
                  <select
                    value={filtroTransacaoPeriodo}
                    onChange={(e) => {
                      setFiltroTransacaoPeriodo(e.target.value);
                      if (e.target.value !== 'custom') {
                        setFiltroTransacaoDataInicio('');
                        setFiltroTransacaoDataFim('');
                      }
                    }}
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  >
                    <option value="">Todo o período</option>
                    <option value="hoje">Hoje</option>
                    <option value="semana">Esta semana</option>
                    <option value="mes">Este mês</option>
                    <option value="custom">Data personalizada</option>
                  </select>
                </div>

                {/* Status Pagamento */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                    Pagamento
                  </label>
                  <select
                    value={filtroTransacaoStatusPagamento}
                    onChange={(e) => setFiltroTransacaoStatusPagamento(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  >
                    <option value="">Todos os status</option>
                    <option value="pago">Pago</option>
                    <option value="pendente">Pendente</option>
                    <option value="estornado">Estornado</option>
                  </select>
                </div>

                {/* Status Repasse */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                    Repasse
                  </label>
                  <select
                    value={filtroTransacaoStatusRepasse}
                    onChange={(e) => setFiltroTransacaoStatusRepasse(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                  >
                    <option value="">Todos os status</option>
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                    <option value="processando">Processando</option>
                  </select>
                </div>

                {/* Código / Busca */}
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                    Código / ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Buscar por código..."
                      value={filtroTransacaoCodigo}
                      onChange={(e) => setFiltroTransacaoCodigo(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl pl-8 pr-3 py-2 font-semibold placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    />
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  </div>
                </div>
              </div>

              {/* Datas customizadas se selecionado */}
              {filtroTransacaoPeriodo === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-100">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                      Data Inicial
                    </label>
                    <input
                      type="date"
                      value={filtroTransacaoDataInicio}
                      onChange={(e) => setFiltroTransacaoDataInicio(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                      Data Final
                    </label>
                    <input
                      type="date"
                      value={filtroTransacaoDataFim}
                      onChange={(e) => setFiltroTransacaoDataFim(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Tabela Geral de Transações */}
            <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 border-b border-neutral-200/80 text-neutral-500 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Data / Hora</th>
                      <th className="py-3 px-4">Empresa</th>
                      <th className="py-3 px-4">Restaurante</th>
                      <th className="py-3 px-4">Valor total</th>
                      <th className="py-3 px-4">Valor restaurante</th>
                      <th className="py-3 px-4">Valor plataforma</th>
                      <th className="py-3 px-4">Status pagamento</th>
                      <th className="py-3 px-4">Status repasse</th>
                      <th className="py-3 px-4">Código transação</th>
                      <th className="py-3 px-4">ID Entrega</th>
                      <th className="py-3 px-4">Lote repasse</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
                    {loadingTodasTransacoes ? (
                      <tr>
                        <td colSpan={11} className="py-12 px-4 text-center">
                          <div className="flex items-center justify-center gap-2 text-neutral-500 font-semibold text-xs">
                            <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
                            <span>Carregando transações...</span>
                          </div>
                        </td>
                      </tr>
                    ) : todasTransacoesExibidas.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 px-4 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-12 h-12 bg-neutral-100 text-neutral-400 rounded-2xl flex items-center justify-center mb-3">
                              <Receipt size={22} />
                            </div>
                            <p className="text-xs font-extrabold text-neutral-800 uppercase tracking-wider">
                              Nenhuma transação encontrada
                            </p>
                            <p className="text-xs text-neutral-400 mt-1">
                              Não existem registros de pagamento PagBank correspondentes aos filtros aplicados.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      todasTransacoesExibidas.map((tx) => {
                        const dh = formatarDataHoraBrasilia(tx.created_at);
                        const codTx = tx.payload?.id || tx.id;

                        return (
                          <tr key={tx.id} className="hover:bg-neutral-50/60 transition-colors">
                            {/* DATA / HORA */}
                            <td className="py-3.5 px-4 font-semibold text-neutral-900 whitespace-nowrap">
                              <div>{dh.data}</div>
                              <div className="text-[10px] text-neutral-400">{dh.hora}</div>
                            </td>

                            {/* EMPRESA */}
                            <td className="py-3.5 px-4 font-bold text-neutral-900 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                {tx.empresa_logo_url ? (
                                  <img
                                    src={tx.empresa_logo_url}
                                    alt={tx.empresa_nome || ''}
                                    className="w-6 h-6 rounded-lg object-cover border border-neutral-200 shrink-0 bg-white"
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-lg bg-orange-100 text-orange-700 font-black text-[10px] flex items-center justify-center shrink-0">
                                    {(tx.empresa_nome || 'E').charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span>{tx.empresa_nome}</span>
                              </div>
                            </td>

                            {/* RESTAURANTE */}
                            <td className="py-3.5 px-4 font-bold text-neutral-800 whitespace-nowrap">
                              {tx.restaurante_nome}
                            </td>

                            {/* VALOR TOTAL */}
                            <td className="py-3.5 px-4 font-extrabold text-neutral-900 whitespace-nowrap">
                              {formatarMoeda(tx.valor_total)}
                            </td>

                            {/* VALOR RESTAURANTE */}
                            <td className="py-3.5 px-4 font-semibold text-emerald-700 whitespace-nowrap">
                              {formatarMoeda(tx.valor_restaurante)}
                            </td>

                            {/* VALOR PLATAFORMA */}
                            <td className="py-3.5 px-4 font-semibold text-blue-700 whitespace-nowrap">
                              {formatarMoeda(tx.valor_plataforma)}
                            </td>

                            {/* STATUS PAGAMENTO */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {renderStatusPagamentoBadge(tx.status_pagamento)}
                            </td>

                            {/* STATUS REPASSE */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {renderStatusRepasseBadge(tx.status_repasse)}
                            </td>

                            {/* CÓDIGO TRANSAÇÃO */}
                            <td className="py-3.5 px-4 text-neutral-600 font-mono text-[11px] whitespace-nowrap">
                              {codTx}
                            </td>

                            {/* ID ENTREGA */}
                            <td className="py-3.5 px-4 text-neutral-600 font-mono text-[11px] whitespace-nowrap">
                              {tx.entrega_id || '-'}
                            </td>

                            {/* LOTE REPASSE */}
                            <td className="py-3.5 px-4 text-neutral-600 font-mono text-[11px] whitespace-nowrap">
                              {tx.lote_repasse_id
                                ? tx.lote_codigo || formatarCodigoLoteData(tx.created_at) || tx.lote_repasse_id
                                : '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Lotes de Repasse do Restaurante */}
      <AnimatePresence>
        {restauranteLotesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRestauranteLotesModal(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-100 max-h-[90vh] flex flex-col"
            >
              {/* Cabeçalho do Modal */}
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-3">
                  {restauranteLotesModal.empresa_logo_url ? (
                    <img
                      src={restauranteLotesModal.empresa_logo_url}
                      alt={restauranteLotesModal.empresa_nome}
                      className="w-10 h-10 rounded-xl object-cover border border-neutral-200 shrink-0 bg-white"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 font-black text-sm flex items-center justify-center shrink-0 border border-orange-200">
                      {restauranteLotesModal.empresa_nome.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <h3 className="font-extrabold text-neutral-900 text-base tracking-tight flex items-center gap-2">
                      <span>Lotes de repasse — {restauranteLotesModal.restaurante_nome}</span>
                    </h3>
                    <p className="text-xs text-neutral-500 font-medium">
                      Histórico completo de lotes de repasse ({restauranteLotesModal.empresa_nome})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchLotesRestauranteModal(restauranteLotesModal.restaurante_id)}
                    disabled={loadingLotesModal}
                    className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-xl transition-colors disabled:opacity-50"
                    title="Atualizar lotes"
                  >
                    <RefreshCw size={16} className={loadingLotesModal ? 'animate-spin text-orange-600' : ''} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRestauranteLotesModal(null)}
                    className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 rounded-xl transition-colors"
                    title="Fechar modal"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Tabela de Lotes */}
              <div className="p-6 overflow-y-auto space-y-4">
                <div className="bg-white rounded-xl border border-neutral-200/80 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 border-b border-neutral-200/80 text-neutral-500 font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Período</th>
                          <th className="py-3 px-4 text-right">Valor</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Pago em</th>
                          <th className="py-3 px-4 text-center">Comprovante</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
                        {loadingLotesModal ? (
                          <tr>
                            <td colSpan={5} className="py-12 px-4 text-center">
                              <div className="flex items-center justify-center gap-2 text-neutral-500 font-semibold text-xs">
                                <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
                                <span>Carregando lotes de repasse...</span>
                              </div>
                            </td>
                          </tr>
                        ) : lotesModalList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 px-4 text-center">
                              <div className="flex flex-col items-center justify-center">
                                <div className="w-10 h-10 bg-neutral-100 text-neutral-400 rounded-xl flex items-center justify-center mb-2">
                                  <Layers size={20} />
                                </div>
                                <p className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                                  Nenhum lote de repasse encontrado
                                </p>
                                <p className="text-xs text-neutral-400 mt-0.5">
                                  Nenhum lote de repasse encontrado para este restaurante.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          lotesModalList.map((lote) => {
                            const isPago = (lote.status_repasse || '').toLowerCase() === 'pago';
                            return (
                              <tr key={lote.id} className="hover:bg-neutral-50/60 transition-colors">
                                {/* PERÍODO */}
                                <td className="py-3 px-4 font-semibold text-neutral-900 whitespace-nowrap">
                                  {formatarPeriodoLote(lote.data_inicio, lote.data_fim)}
                                </td>

                                {/* VALOR */}
                                <td className="py-3 px-4 font-bold text-neutral-900 whitespace-nowrap text-right">
                                  {lote.valor_pago !== null && lote.valor_pago !== undefined ? formatarMoeda(lote.valor_pago) : '-'}
                                </td>

                                {/* STATUS */}
                                <td className="py-3 px-4 whitespace-nowrap">
                                  {lote.status_repasse ? renderStatusRepasseBadge(lote.status_repasse) : <span className="text-neutral-400 font-medium">-</span>}
                                </td>

                                {/* PAGO EM */}
                                <td className="py-3 px-4 text-neutral-700 font-medium whitespace-nowrap">
                                  {isPago && lote.pago_em ? formatarDataRepasse(lote.pago_em) : '-'}
                                </td>

                                {/* COMPROVANTE */}
                                <td className="py-3 px-4 text-center whitespace-nowrap">
                                  {lote.comprovante_url ? (
                                    <a
                                      href={lote.comprovante_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition-colors"
                                    >
                                      <FileText size={13} />
                                      Ver comprovante
                                    </a>
                                  ) : (
                                    <span className="text-neutral-400 font-medium">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Rodapé do Modal */}
              <div className="px-6 py-3.5 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between shrink-0">
                <span className="text-xs text-neutral-500 font-semibold">
                  Total de lotes: <strong className="text-neutral-800">{lotesModalList.length}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setRestauranteLotesModal(null)}
                  className="px-4 py-2 rounded-xl bg-neutral-200/80 hover:bg-neutral-300 text-neutral-700 font-bold text-xs transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Transações do Restaurante */}
      <AnimatePresence>
        {selectedRestauranteParaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedRestauranteParaModal(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-100 max-h-[90vh] flex flex-col"
            >
              {/* Cabeçalho do Modal */}
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-3">
                  {selectedRestauranteParaModal.empresa_logo_url ? (
                    <img
                      src={selectedRestauranteParaModal.empresa_logo_url}
                      alt={selectedRestauranteParaModal.empresa_nome}
                      className="w-10 h-10 rounded-xl object-cover border border-neutral-200 shrink-0 bg-white"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 font-black text-sm flex items-center justify-center shrink-0 border border-orange-200">
                      {selectedRestauranteParaModal.empresa_nome.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <h3 className="font-extrabold text-neutral-900 text-base tracking-tight flex items-center gap-2">
                      <span>{selectedRestauranteParaModal.restaurante_nome}</span>
                      <span className="text-xs font-normal text-neutral-400">
                        ({selectedRestauranteParaModal.empresa_nome})
                      </span>
                    </h3>
                    <p className="text-xs text-neutral-500 font-medium">
                      Transações PagBank do restaurante
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRestauranteParaModal(null)}
                  className="p-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 rounded-xl transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Corpo do Modal (com Scroll) */}
              <div className="p-6 overflow-y-auto space-y-5">
                {/* Filtros Internos do Modal */}
                <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-neutral-800 uppercase tracking-wider">
                      <Filter size={14} className="text-orange-600" />
                      <span>Filtrar Transações</span>
                    </div>

                    <button
                      onClick={() => fetchTransacoesRestaurante(selectedRestauranteParaModal.restaurante_id)}
                      disabled={loadingTransacoesModal}
                      className="p-1 text-neutral-500 hover:text-neutral-900 transition-colors"
                      title="Atualizar transações"
                    >
                      <RefreshCw size={14} className={loadingTransacoesModal ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Período */}
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                        Período
                      </label>
                      <select
                        value={modalFiltroPeriodo}
                        onChange={(e) => {
                          setModalFiltroPeriodo(e.target.value);
                          if (e.target.value !== 'custom') {
                            setModalFiltroDataInicio('');
                            setModalFiltroDataFim('');
                          }
                        }}
                        className="w-full bg-white border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                      >
                        <option value="">Todo o período</option>
                        <option value="hoje">Hoje</option>
                        <option value="semana">Esta semana</option>
                        <option value="mes">Este mês</option>
                        <option value="custom">Data personalizada</option>
                      </select>
                    </div>

                    {/* Status Pagamento */}
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                        Status Pagamento
                      </label>
                      <select
                        value={modalFiltroStatusPagamento}
                        onChange={(e) => setModalFiltroStatusPagamento(e.target.value)}
                        className="w-full bg-white border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                      >
                        <option value="">Todos os status</option>
                        <option value="pago">Pago</option>
                        <option value="pendente">Pendente</option>
                        <option value="estornado">Estornado</option>
                      </select>
                    </div>

                    {/* Status Repasse */}
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                        Status Repasse
                      </label>
                      <select
                        value={modalFiltroStatusRepasse}
                        onChange={(e) => setModalFiltroStatusRepasse(e.target.value)}
                        className="w-full bg-white border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                      >
                        <option value="">Todos os status</option>
                        <option value="pendente">Pendente</option>
                        <option value="pago">Pago</option>
                        <option value="processando">Processando</option>
                      </select>
                    </div>

                    {/* Buscador de Código */}
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                        Código / ID
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Buscar código..."
                          value={modalFiltroCodigo}
                          onChange={(e) => setModalFiltroCodigo(e.target.value)}
                          className="w-full bg-white border border-neutral-200 text-neutral-900 text-xs rounded-xl pl-8 pr-3 py-2 font-semibold placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                        />
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                      </div>
                    </div>
                  </div>

                  {modalFiltroPeriodo === 'custom' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-200/60">
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                          Data Inicial
                        </label>
                        <input
                          type="date"
                          value={modalFiltroDataInicio}
                          onChange={(e) => setModalFiltroDataInicio(e.target.value)}
                          className="w-full bg-white border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1">
                          Data Final
                        </label>
                        <input
                          type="date"
                          value={modalFiltroDataFim}
                          onChange={(e) => setModalFiltroDataFim(e.target.value)}
                          className="w-full bg-white border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Tabela do Modal */}
                <div className="bg-white rounded-xl border border-neutral-200/80 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-neutral-50 border-b border-neutral-200/80 text-neutral-500 font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Data / Hora</th>
                          <th className="py-3 px-4">Valor total</th>
                          <th className="py-3 px-4">Valor restaurante</th>
                          <th className="py-3 px-4">Valor plataforma</th>
                          <th className="py-3 px-4">Status pagamento</th>
                          <th className="py-3 px-4">Status repasse</th>
                          <th className="py-3 px-4">Código transação</th>
                          <th className="py-3 px-4">ID Entrega</th>
                          <th className="py-3 px-4">Lote repasse</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 font-medium text-neutral-700">
                        {loadingTransacoesModal ? (
                          <tr>
                            <td colSpan={9} className="py-12 px-4 text-center">
                              <div className="flex items-center justify-center gap-2 text-neutral-500 font-semibold text-xs">
                                <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
                                <span>Carregando transações do restaurante...</span>
                              </div>
                            </td>
                          </tr>
                        ) : transacoesModalExibidas.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 px-4 text-center">
                              <div className="flex flex-col items-center justify-center">
                                <div className="w-10 h-10 bg-neutral-100 text-neutral-400 rounded-xl flex items-center justify-center mb-2">
                                  <Receipt size={20} />
                                </div>
                                <p className="text-xs font-bold text-neutral-800 uppercase tracking-wider">
                                  Nenhuma transação encontrada
                                </p>
                                <p className="text-xs text-neutral-400 mt-0.5">
                                  Este restaurante não possui pagamentos para os filtros informados.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          transacoesModalExibidas.map((tx) => {
                            const dh = formatarDataHoraBrasilia(tx.created_at);
                            const codTx = tx.payload?.id || tx.id;

                            return (
                              <tr key={tx.id} className="hover:bg-neutral-50/60 transition-colors">
                                {/* DATA / HORA */}
                                <td className="py-3 px-4 font-semibold text-neutral-900 whitespace-nowrap">
                                  <div>{dh.data}</div>
                                  <div className="text-[10px] text-neutral-400">{dh.hora}</div>
                                </td>

                                {/* VALOR TOTAL */}
                                <td className="py-3 px-4 font-extrabold text-neutral-900 whitespace-nowrap">
                                  {formatarMoeda(tx.valor_total)}
                                </td>

                                {/* VALOR RESTAURANTE */}
                                <td className="py-3 px-4 font-semibold text-emerald-700 whitespace-nowrap">
                                  {formatarMoeda(tx.valor_restaurante)}
                                </td>

                                {/* VALOR PLATAFORMA */}
                                <td className="py-3 px-4 font-semibold text-blue-700 whitespace-nowrap">
                                  {formatarMoeda(tx.valor_plataforma)}
                                </td>

                                {/* STATUS PAGAMENTO */}
                                <td className="py-3 px-4 whitespace-nowrap">
                                  {renderStatusPagamentoBadge(tx.status_pagamento)}
                                </td>

                                {/* STATUS REPASSE */}
                                <td className="py-3 px-4 whitespace-nowrap">
                                  {renderStatusRepasseBadge(tx.status_repasse)}
                                </td>

                                {/* CÓDIGO TRANSAÇÃO */}
                                <td className="py-3 px-4 text-neutral-600 font-mono text-[11px] whitespace-nowrap">
                                  {codTx}
                                </td>

                                {/* ID ENTREGA */}
                                <td className="py-3 px-4 text-neutral-600 font-mono text-[11px] whitespace-nowrap">
                                  {tx.entrega_id || '-'}
                                </td>

                                {/* LOTE REPASSE */}
                                <td className="py-3 px-4 text-neutral-600 font-mono text-[11px] whitespace-nowrap">
                                  {tx.lote_repasse_id
                                    ? tx.lote_codigo || formatarCodigoLoteData(tx.created_at) || tx.lote_repasse_id
                                    : '-'}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Rodapé do Modal */}
              <div className="px-6 py-3 border-t border-neutral-100 flex items-center justify-between shrink-0 bg-neutral-50">
                <span className="text-xs text-neutral-500 font-medium">
                  {transacoesModalExibidas.length} transação(ões) encontrada(s)
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedRestauranteParaModal(null)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal "+ Nova Empresa" */}
      <AnimatePresence>
        {isNovaEmpresaModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                resetModalForm();
                setIsNovaEmpresaModalOpen(false);
              }}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-100"
            >
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center shrink-0">
                    <Building2 size={18} />
                  </div>
                  <h3 className="font-extrabold text-neutral-900 text-sm tracking-tight">
                    Nova empresa
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    resetModalForm();
                    setIsNovaEmpresaModalOpen(false);
                  }}
                  className="p-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-500 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCriarEmpresa} className="p-5 space-y-4">
                {modalError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 text-xs font-medium">
                    <AlertCircle size={16} className="shrink-0 text-red-600" />
                    <span>{modalError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Nome da empresa <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={submitting}
                    placeholder="Nome da empresa"
                    value={nomeEmpresa}
                    onChange={(e) => setNomeEmpresa(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3.5 py-2.5 font-semibold placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    disabled={submitting}
                    placeholder="(00) 00000-0000"
                    value={telefoneEmpresa}
                    onChange={(e) => setTelefoneEmpresa(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3.5 py-2.5 font-semibold placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    E-mail do administrador <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    disabled={submitting}
                    placeholder="admin@empresa.com"
                    value={emailAdmin}
                    onChange={(e) => setEmailAdmin(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl px-3.5 py-2.5 font-semibold placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1">
                    Senha inicial <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showSenhaAdmin ? 'text' : 'password'}
                      required
                      disabled={submitting}
                      placeholder="Senha de acesso inicial"
                      value={senhaAdmin}
                      onChange={(e) => setSenhaAdmin(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 text-neutral-900 text-xs rounded-xl pl-3.5 pr-10 py-2.5 font-semibold placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenhaAdmin(!showSenhaAdmin)}
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1 transition-colors"
                    >
                      {showSenhaAdmin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      resetModalForm();
                      setIsNovaEmpresaModalOpen(false);
                    }}
                    className="px-4 py-2 rounded-xl border border-neutral-200 text-neutral-600 font-bold text-xs hover:bg-neutral-50 transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-bold text-xs shadow-xs transition-all"
                  >
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    Criar empresa
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal de confirmação Bloquear/Ativar Empresa */}
        {empresaParaAlterar && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !loadingToggleStatus && setEmpresaParaAlterar(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-neutral-100 p-5 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  empresaParaAlterar.ativo !== false 
                    ? 'bg-red-100 text-red-600' 
                    : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {empresaParaAlterar.ativo !== false ? <Lock size={20} /> : <Unlock size={20} />}
                </div>
                <div>
                  <h3 className="font-extrabold text-neutral-900 text-sm tracking-tight">
                    {empresaParaAlterar.ativo !== false ? 'Bloquear empresa' : 'Ativar empresa'}
                  </h3>
                  <p className="text-xs text-neutral-500 font-medium">
                    Confirmar alteração de status
                  </p>
                </div>
              </div>

              <p className="text-xs text-neutral-600 leading-relaxed">
                {empresaParaAlterar.ativo !== false 
                  ? `Tem certeza que deseja bloquear a empresa "${empresaParaAlterar.nome}"?` 
                  : `Tem certeza que deseja ativar a empresa "${empresaParaAlterar.nome}"?`}
              </p>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={loadingToggleStatus}
                  onClick={() => setEmpresaParaAlterar(null)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-neutral-600 font-bold text-xs hover:bg-neutral-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={loadingToggleStatus}
                  onClick={handleToggleStatus}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50 ${
                    empresaParaAlterar.ativo !== false
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {loadingToggleStatus && <Loader2 size={14} className="animate-spin" />}
                  {empresaParaAlterar.ativo !== false ? 'Sim, bloquear' : 'Sim, ativar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
