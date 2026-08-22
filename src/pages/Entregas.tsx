import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useEmpresa } from '../contexts/EmpresaContext';
import { supabase } from '../lib/supabase';
import DashboardLayout from '../components/layout/DashboardLayout';
import EntregaModal from '../components/entregas/EntregaModal';
import { Entrega } from '../types';
import { ShoppingBag, Plus, Search, AlertCircle, MapPin, Edit2, Bike, Download, Loader2, CheckCircle2, XCircle, DollarSign, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';

const STATUS_LABELS = {
  aguardando_despacho: { label: 'Aguardando Despacho', color: 'bg-neutral-100 text-neutral-600' },
  pendente: { label: 'Pendente', color: 'bg-amber-100 text-amber-800' },
  aceita: { label: 'Aceita', color: 'bg-blue-100 text-blue-800' },
  coletada: { label: 'Coletada', color: 'bg-purple-100 text-purple-800' },
  em_rota: { label: 'Em Rota', color: 'bg-indigo-100 text-indigo-800' },
  entregue: { label: 'Entregue', color: 'bg-green-100 text-green-800' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
};

export default function Entregas() {
  const { empresa } = useEmpresa();
  const { user } = useAuth();
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [motoboys, setMotoboys] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [motoboyFilter, setMotoboyFilter] = useState('todos');
  const [acertoFilter, setAcertoFilter] = useState('todos');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntrega, setSelectedEntrega] = useState<Entrega | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (empresa) {
      fetchEntregas();
      fetchMotoboys();
    }
  }, [empresa]);

  async function fetchMotoboys() {
    try {
      const { data } = await supabase
        .from('motoboys')
        .select('id, nome')
        .eq('empresa_id', empresa?.id)
        .order('nome');
      setMotoboys(data || []);
    } catch (err) {
      console.error('Erro motoboys filter:', err);
    }
  }

  async function fetchEntregas() {
    setLoading(true);
    try {
      // Usando joins para buscar nomes de restaurantes e motoboys
      const { data, error } = await supabase
        .from('entregas')
        .select(`
          *,
          restaurantes (nome),
          motoboys (nome)
        `)
        .eq('empresa_id', empresa?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntregas(data || []);
    } catch (error) {
      console.error('Erro ao buscar entregas:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenCreate = () => {
    setSelectedEntrega(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (entrega: Entrega) => {
    setSelectedEntrega(entrega);
    setIsModalOpen(true);
  };

  const handleSaveEntrega = async (data: Partial<Entrega>) => {
    if (!empresa) return;
    setActionLoading(true);
    setError(null);

    try {
      if (selectedEntrega) {
        // Update
        const { error } = await supabase
          .from('entregas')
          .update(data)
          .eq('id', selectedEntrega.id)
          .eq('empresa_id', empresa.id);

        if (error) throw error;
      } else {
        // Create
        // Buscar modo de distribuição para definir status inicial
        const { data: config } = await supabase
          .from('configuracoes_empresas')
          .select('modo_distribuicao')
          .eq('empresa_id', empresa.id)
          .maybeSingle();

        const statusInicial = config?.modo_distribuicao === 'manual' ? 'aguardando_despacho' : (data.status || 'pendente');

        const nowIso = new Date().toISOString();
        const { data: insertedData, error } = await supabase
          .from('entregas')
          .insert({
            ...data,
            empresa_id: empresa.id,
            status: statusInicial,
            created_at: nowIso,
            ultima_tentativa_distribuicao_em: nowIso
          })
          .select();

        if (error) throw error;

        if (insertedData && insertedData.length > 0) {
          const novaEntrega = insertedData[0];
          if (novaEntrega.ifood_localizador) {
            console.log('[IFOOD] Pedido iFood detectado.');
            console.log('[IFOOD] Localizador:', novaEntrega.ifood_localizador);
            console.log('[IFOOD] Entrega criada:', novaEntrega.id);
            console.log('[IFOOD] Chamando prepare-ifood-delivery...');

            try {
              const { data: edgeData, error: edgeError } = await supabase.functions.invoke('prepare-ifood-delivery', {
                body: {
                  entrega_id: novaEntrega.id
                }
              });

              if (edgeError) {
                console.error('[IFOOD] Erro ao chamar prepare-ifood-delivery:', edgeError);
              } else {
                console.log('[IFOOD] Retorno da Edge:', edgeData);
              }
            } catch (ifoodErr) {
              console.error('[IFOOD] Erro ao chamar prepare-ifood-delivery:', ifoodErr);
            }
          } else {
            console.log('[IFOOD] Pedido normal. Edge não será chamada.');
          }
        }
      }

      await fetchEntregas();
      setIsModalOpen(false);
    } catch (err: any) {
      console.error('Save error:', err);
      setError('Erro ao salvar entrega. Verifique os campos.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: Entrega['status']) => {
    if (!empresa) return;
    
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'pendente') {
        updateData.motoboy_id = null;
        updateData.ultima_tentativa_distribuicao_em = new Date().toISOString();
      }

      const { error } = await supabase
        .from('entregas')
        .update(updateData)
        .eq('id', id)
        .eq('empresa_id', empresa.id);

      if (error) throw error;
      await fetchEntregas();
    } catch (err: any) {
      console.error('Update status error:', err);
    }
  };

  const handleToggleAcerto = async (entrega: Entrega) => {
    if (!empresa || !user) return;
    
    setActionLoading(true);
    try {
      const isSettling = !entrega.acertada;
      const { error } = await supabase
        .from('entregas')
        .update({ 
          acertada: isSettling,
          acertada_em: isSettling ? new Date().toISOString() : null,
          acertada_por: isSettling ? user.id : null
        })
        .eq('id', entrega.id)
        .eq('empresa_id', empresa.id);

      if (error) throw error;
      await fetchEntregas();
    } catch (err: any) {
      console.error('Toggle acerto error:', err);
      setError('Erro ao atualizar acerto da entrega.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('todos');
    setMotoboyFilter('todos');
    setAcertoFilter('todos');
    setDateStart('');
    setDateEnd('');
  };

  const filteredEntregas = entregas.filter(e => {
    const matchesSearch = 
      e.endereco_entrega.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.restaurantes?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.motoboys?.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.numero.toString().includes(searchTerm);

    const matchesStatus = statusFilter === 'todos' || e.status === statusFilter;
    const matchesMotoboy = motoboyFilter === 'todos' || e.motoboy_id === motoboyFilter;
    
    const matchesAcerto = acertoFilter === 'todos' || 
      (acertoFilter === 'acertada' && e.acertada) || 
      (acertoFilter === 'pendente' && !e.acertada);
    
    let matchesDate = true;
    if (dateStart || dateEnd) {
      const entregaDate = new Date(e.created_at);
      entregaDate.setHours(0, 0, 0, 0);

      if (dateStart) {
        const start = new Date(dateStart);
        start.setHours(0, 0, 0, 0);
        if (entregaDate < start) matchesDate = false;
      }

      if (dateEnd) {
        const end = new Date(dateEnd);
        end.setHours(0, 0, 0, 0);
        if (entregaDate > end) matchesDate = false;
      }
    }

    return matchesSearch && matchesStatus && matchesMotoboy && matchesAcerto && matchesDate;
  });

  const handleDownloadReport = () => {
    if (filteredEntregas.length === 0) {
      setError('Nenhuma entrega para exportar');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setReportLoading(true);
    try {
      // Ordenar por data mais recente primeiro
      const sortedEntregas = [...filteredEntregas].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Preparar dados para o Excel
      const companyName = empresa?.nome || 'Logística';
      const exportTime = new Date().toLocaleString('pt-BR');

      const data: any[][] = [
        [`RELATÓRIO DE ENTREGAS - ${companyName}`],
        [`Exportado em: ${exportTime}`],
        [], // Linha em branco
        [
          'Código do pedido',
          'Restaurante',
          'Motoboy',
          'Endereço de entrega',
          'Status',
          'Acertada',
          'Data do Acerto',
          'Valor (R$)',
          'Observação',
          'Data de criação'
        ]
      ];

      sortedEntregas.forEach(e => {
        data.push([
          `#${e.numero}`,
          e.restaurantes?.nome || '',
          e.motoboys?.nome || '',
          e.endereco_entrega,
          STATUS_LABELS[e.status]?.label || e.status,
          e.acertada ? 'SIM' : 'NÃO',
          e.acertada_em ? new Date(e.acertada_em).toLocaleString('pt-BR') : '',
          Number(e.valor || 0),
          e.observacao || '',
          new Date(e.created_at).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        ]);
      });

      // Calcular totais
      const totalEntregas = sortedEntregas.length;
      const totalValor = sortedEntregas.reduce((acc, curr) => acc + (curr.valor || 0), 0);

      data.push([]);
      data.push(['TOTAL DE ENTREGAS', totalEntregas]);
      data.push(['VALOR TOTAL (R$)', totalValor]);

      // Gerar Workbook
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // Ajustar larguras das colunas
      const wscols = [
        { wch: 15 }, // Código
        { wch: 25 }, // Restaurante
        { wch: 25 }, // Motoboy
        { wch: 40 }, // Endereço
        { wch: 15 }, // Status
        { wch: 10 }, // Acertada
        { wch: 20 }, // Data Acerto
        { wch: 15 }, // Valor
        { wch: 30 }, // Observação
        { wch: 20 }, // Data Criação
      ];
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Entregas");

      // Salvar arquivo
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('pt-BR').replace(/:/g, 'h').split(' ')[0];
      const filename = `relatorio-entregas-${dateStr}-${timeStr}.xlsx`;

      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
      setError('Erro ao gerar relatório. Tente novamente.');
    } finally {
      setReportLoading(false);
    }
  };

  const totalGanhos = filteredEntregas.reduce((acc, curr) => {
    const v = typeof curr.valor === 'string' ? parseFloat(curr.valor) : (curr.valor || 0);
    return acc + (isNaN(v) ? 0 : v);
  }, 0);

  const totalCorridas = filteredEntregas.length;

  const totalGanhosFormatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(totalGanhos);

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900">Entregas</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Gerencie os pedidos e o fluxo logístico.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleDownloadReport}
            disabled={reportLoading}
            className="flex items-center justify-center gap-1.5 bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 px-3 py-2 rounded-xl font-semibold text-xs transition-colors shadow-xs disabled:opacity-50"
          >
            {reportLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Baixar relatório
          </button>
          <button 
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl font-semibold text-xs transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Nova Entrega
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Seção de Filtros */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-xs mb-4 overflow-hidden">
        <div className="px-3 py-2 bg-neutral-50/50 border-b border-neutral-100 italic text-[10px] text-neutral-500 uppercase tracking-widest font-bold">
          Filtros de Busca
        </div>
        <div className="p-3 md:p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-neutral-500 uppercase">Busca Geral</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Nº, endereço, motoboy..."
                className="w-full pl-8 pr-3 py-1.5 border border-neutral-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-xs bg-neutral-50/30"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-neutral-500 uppercase">Status</label>
            <select
              className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-xs bg-neutral-50/30"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="todos">Todos os Status</option>
              {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-neutral-500 uppercase">Motoboy</label>
            <select
              className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-xs bg-neutral-50/30"
              value={motoboyFilter}
              onChange={(e) => setMotoboyFilter(e.target.value)}
            >
              <option value="todos">Todos os Motoboys</option>
              {motoboys.map(m => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-neutral-500 uppercase">Acerto</label>
            <select
              className="w-full px-2.5 py-1.5 border border-neutral-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-xs bg-neutral-50/30"
              value={acertoFilter}
              onChange={(e) => setAcertoFilter(e.target.value)}
            >
              <option value="todos">Todos os Acertos</option>
              <option value="pendente">Pendentes</option>
              <option value="acertada">Acertadas</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-neutral-500 uppercase">Período (Início/Fim)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                className="w-1/2 px-1.5 py-1.5 border border-neutral-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] bg-neutral-50/30"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
              />
              <input
                type="date"
                className="w-1/2 px-1.5 py-1.5 border border-neutral-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-[11px] bg-neutral-50/30"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1 justify-end">
            <button
              onClick={handleClearFilters}
              className="w-full py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 font-bold text-[10px] rounded-lg transition-all uppercase tracking-wider"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Resumo Financeiro e Operacional */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
        <div className="bg-white p-3.5 md:p-4 rounded-xl border border-neutral-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Total de Ganhos no Período</p>
            <h3 className="text-xl font-black text-neutral-900 mt-0.5">{totalGanhosFormatted}</h3>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100/50">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 md:p-4 rounded-xl border border-neutral-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Total de Entregas</p>
            <h3 className="text-xl font-black text-neutral-900 mt-0.5">{totalCorridas} {totalCorridas === 1 ? 'corrida' : 'corridas'}</h3>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100/50">
            <Bike className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
            </div>
          ) : filteredEntregas.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50">
                  <th className="px-4 py-2.5 text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Restaurante / Endereço</th>
                  <th className="px-4 py-2.5 text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Motoboy</th>
                  <th className="px-4 py-2.5 text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Valor / Acerto</th>
                  <th className="px-4 py-2.5 text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Status</th>
                  <th className="px-4 py-2.5 text-neutral-500 font-bold uppercase tracking-widest text-[10px] text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredEntregas.map((entrega, idx) => (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    key={entrega.id}
                    className="hover:bg-neutral-50/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-xs">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-neutral-900">{entrega.restaurantes?.nome}</span>
                          <span className="text-[9px] bg-neutral-100 text-neutral-600 px-1 py-0.5 rounded font-mono font-bold">
                            #{entrega.numero}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-neutral-500 mt-0.5">
                          <MapPin size={11} className="shrink-0" />
                          <span className="truncate max-w-xs">{entrega.endereco_entrega}</span>
                        </div>
                        {(!entrega.latitude_entrega || !entrega.longitude_entrega) && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 uppercase tracking-tighter mt-0.5">
                            <AlertCircle size={9} />
                            Sem coordenadas
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Bike size={14} className="text-neutral-400 shrink-0" />
                        <span className={entrega.motoboys?.nome ? 'text-neutral-900 font-medium' : 'text-neutral-400 italic'}>
                          {entrega.motoboys?.nome || 'Aguardando...'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-neutral-900">
                      <div className="flex flex-col">
                        <span>{entrega.valor ? `R$ ${entrega.valor.toFixed(2)}` : '--'}</span>
                        {entrega.status === 'entregue' && (
                          <div className={`flex items-center gap-1 mt-0.5 text-[9px] font-bold uppercase tracking-wider ${entrega.acertada ? 'text-green-600' : 'text-amber-600'}`}>
                            {entrega.acertada ? (
                              <>
                                <CheckCircle2 size={10} />
                                Acertada
                              </>
                            ) : (
                              <>
                                <AlertCircle size={10} />
                                Pendente
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${STATUS_LABELS[entrega.status].color}`}>
                        {STATUS_LABELS[entrega.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {entrega.status === 'entregue' && (
                          <button 
                            onClick={() => handleToggleAcerto(entrega)}
                            title={entrega.acertada ? "Desfazer acerto" : "Marcar como acertada"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              entrega.acertada 
                                ? 'text-green-600 bg-green-50 hover:bg-green-100' 
                                : 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                            }`}
                          >
                            {entrega.acertada ? <XCircle size={14} /> : <DollarSign size={14} />}
                          </button>
                        )}
                        <select 
                          className="text-[11px] border border-neutral-200 rounded-lg px-1.5 py-1 bg-white focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
                          value={entrega.status}
                          onChange={(e) => handleUpdateStatus(entrega.id, e.target.value as Entrega['status'])}
                        >
                          {Object.entries(STATUS_LABELS).map(([val, { label }]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                        <button 
                          onClick={() => handleOpenEdit(entrega)}
                          className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center">
              <ShoppingBag className="h-10 w-10 text-neutral-200 mx-auto mb-3" />
              <p className="text-xs text-neutral-500 font-medium">Nenhuma entrega encontrada.</p>
              {searchTerm && <p className="text-[11px] text-neutral-400 mt-0.5">Tente remover os filtros de busca.</p>}
            </div>
          )}
        </div>
      </div>

      <EntregaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEntrega}
        entrega={selectedEntrega}
        loading={actionLoading}
      />
    </DashboardLayout>
  );
}
