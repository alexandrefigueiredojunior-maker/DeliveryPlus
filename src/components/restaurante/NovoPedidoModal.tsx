import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Restaurante } from '../../types';
import { X, Save, Loader2, MapPin, Package, DollarSign, User, Phone, Info, UserCheck, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AddressAutocomplete from '../common/AddressAutocomplete';
import { fetchActiveMotoboysForRestaurante, ActiveMotoboyInfo } from '../../utils/despachoUtils';
import { OpcoesDespachoSelector } from './OpcoesDespachoSelector';

interface NovoPedidoModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurante: Restaurante;
  empresa: any;
  configDistribuicao?: any;
  onSuccess: () => void;
}

export default function NovoPedidoModal({ isOpen, onClose, restaurante, empresa, configDistribuicao, onSuccess }: NovoPedidoModalProps) {
  const [loading, setLoading] = useState(false);
  const [activeMotoboys, setActiveMotoboys] = useState<any[]>([]);
  const [businessStatus, setBusinessStatus] = useState<{ open: boolean; message?: string }>({ open: true });
  const [isIfood, setIsIfood] = useState(false);
  const [ifoodLocalizador, setIfoodLocalizador] = useState('');
  const [formData, setFormData] = useState({
    numero: '',
    endereco_entrega: '',
    valor: '',
    valor_pedido: '',
    observacao: '',
    cliente_nome: '',
    cliente_telefone: '',
    forma_pagamento: '',
    latitude_entrega: null as number | null,
    longitude_entrega: null as number | null,
    motoboy_id: null as string | null
  });

  const isMandatoryPayment = !!(formData.forma_pagamento && 
    (formData.forma_pagamento.toLowerCase().includes('dinheiro') || 
     formData.forma_pagamento.toLowerCase().includes('cartão') || 
     formData.forma_pagamento.toLowerCase().includes('credito') || 
     formData.forma_pagamento.toLowerCase().includes('crédito') || 
     formData.forma_pagamento.toLowerCase().includes('debito') || 
     formData.forma_pagamento.toLowerCase().includes('débito') || 
     formData.forma_pagamento.toLowerCase().includes('entrega')));

  const parseValorPedido = (valStr: string): number | null => {
    if (!valStr) return null;
    const normalized = valStr.replace(/\s/g, '').replace('R$', '');
    let parsed = 0;
    if (normalized.includes(',') && normalized.includes('.')) {
      if (normalized.indexOf(',') < normalized.indexOf('.')) {
        parsed = parseFloat(normalized.replace(/,/g, ''));
      } else {
        parsed = parseFloat(normalized.replace(/\./g, '').replace(',', '.'));
      }
    } else if (normalized.includes(',')) {
      parsed = parseFloat(normalized.replace(',', '.'));
    } else {
      parsed = parseFloat(normalized);
    }
    return isNaN(parsed) ? null : parsed;
  };

  useEffect(() => {
    console.log('DEBUG: NovoPedidoModal Opened', {
      isOpen,
      permitir: empresa?.permitir_agrupar_entregas_mesmo_motoboy,
      restauranteId: restaurante?.id,
      empresaId: empresa?.id,
      modo_distribuicao: configDistribuicao?.modo_distribuicao
    });

    if (isOpen && empresa?.permitir_agrupar_entregas_mesmo_motoboy && restaurante) {
      fetchActiveMotoboys();
    } else if (isOpen) {
      console.log('DEBUG: fetchActiveMotoboys skipped', {
        permitir: empresa?.permitir_agrupar_entregas_mesmo_motoboy,
        restaurante: !!restaurante
      });
    }

    if (isOpen && empresa) {
      checkBusinessHours();
    }
  }, [isOpen, empresa, restaurante]);

  const checkBusinessHours = () => {
    if (!empresa?.funcionamento_ativo) {
      setBusinessStatus({ open: true });
      return;
    }

    try {
      const now = new Date();
      // Obter horário atual em SP (Brasil)
      const spTime = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
      const spDate = new Date(spTime);
      
      const dayOfWeek = spDate.getDay(); // 0 = Domingo, 1 = Segunda, etc.
      const currentMinutes = spDate.getHours() * 60 + spDate.getMinutes();

      // Verificar dia da semana
      const diasPermitidos = empresa.funcionamento_dias_semana || [1, 2, 3, 4, 5, 6, 0];
      if (!diasPermitidos.includes(dayOfWeek)) {
        setBusinessStatus({ 
          open: false, 
          message: 'Hoje a empresa não está realizando entregas. Verifique os dias de funcionamento.' 
        });
        return;
      }

      // Verificar horário
      if (empresa.funcionamento_inicio && empresa.funcionamento_fim) {
        const [hInicio, mInicio] = empresa.funcionamento_inicio.split(':').map(Number);
        const [hFim, mFim] = empresa.funcionamento_fim.split(':').map(Number);
        
        const startMinutes = hInicio * 60 + mInicio;
        const endMinutes = hFim * 60 + mFim;

        let isOpen = false;
        if (startMinutes < endMinutes) {
          // Horário normal (mesmo dia)
          isOpen = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        } else {
          // Horário que passa da meia-noite
          isOpen = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
        }

        if (!isOpen) {
          setBusinessStatus({ 
            open: false, 
            message: `Fora do horário de funcionamento. Solicitações disponíveis das ${empresa.funcionamento_inicio} às ${empresa.funcionamento_fim}.` 
          });
          return;
        }
      }

      setBusinessStatus({ open: true });
    } catch (err) {
      console.error('Erro ao validar horário de funcionamento:', err);
      setBusinessStatus({ open: true }); // Por segurança, se der erro no cálculo, permite abrir (ou poderia bloquear)
    }
  };

  const fetchActiveMotoboys = async () => {
    if (!restaurante?.id) return;
    const list = await fetchActiveMotoboysForRestaurante(restaurante.id, empresa);
    setActiveMotoboys(list);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    if (!isOpen || !empresa || !restaurante) return;

    let novoValor = 0;
    let dist = 0;

    console.log('RESTAURANTE COORDS:', { lat: restaurante.latitude, lng: restaurante.longitude });
    console.log('DELIVERY COORDS:', { lat: formData.latitude_entrega, lng: formData.longitude_entrega });

    if (empresa.modelo_cobranca_entrega === 'fixo') {
      novoValor = empresa.valor_fixo_entrega || 0;
    } else if (empresa.modelo_cobranca_entrega === 'km') {
      if (restaurante.latitude && restaurante.longitude && formData.latitude_entrega && formData.longitude_entrega) {
        dist = calculateDistance(
          Number(restaurante.latitude),
          Number(restaurante.longitude),
          formData.latitude_entrega,
          formData.longitude_entrega
        );
        
        console.log('DISTÂNCIA CALCULADA (KM):', dist);
        console.log('VALOR POR KM:', empresa.valor_por_km);
        
        novoValor = dist * (empresa.valor_por_km || 0);
        if (novoValor < (empresa.valor_minimo_entrega || 0)) {
          novoValor = empresa.valor_minimo_entrega || 0;
        }
      } else {
        console.warn('CÁLCULO KM IGNORADO: Coordenadas ausentes.');
      }
    }

    console.log('RESULTADO CÁLCULO:', {
      modelo: empresa.modelo_cobranca_entrega,
      distanciaKm: dist.toFixed(2),
      valor_por_km: empresa.valor_por_km,
      valor_minimo: empresa.valor_minimo_entrega,
      valor_final: novoValor.toFixed(2)
    });

    setFormData(prev => ({ ...prev, valor: novoValor.toFixed(2).replace('.', ',') }));
  }, [isOpen, formData.latitude_entrega, formData.longitude_entrega, empresa, restaurante]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessStatus.open) {
      alert(businessStatus.message || 'Empresa fora do horário de funcionamento.');
      return;
    }
    
    if (!formData.numero || !formData.endereco_entrega || !formData.valor || !formData.forma_pagamento) {
      alert('Por favor, preencha os campos obrigatórios.');
      return;
    }

    if (isIfood && !ifoodLocalizador.trim()) {
      alert('Por favor, informe o localizador do pedido iFood.');
      return;
    }

    const valPedParsed = parseValorPedido(formData.valor_pedido);

    if (isMandatoryPayment) {
      if (valPedParsed === null || valPedParsed <= 0) {
        alert('O valor do pedido é obrigatório e deve ser maior que zero para a forma de pagamento selecionada (dinheiro, cartão ou pagamento na entrega).');
        return;
      }
    }

    // Validação de coordenadas para modelo KM
    if (empresa?.modelo_cobranca_entrega === 'km') {
      console.log('VALIDANDO KM ANTES DE CRIAR:', {
        lat: formData.latitude_entrega,
        lon: formData.longitude_entrega
      });

      if (!formData.latitude_entrega || !formData.longitude_entrega) {
        alert('Selecione um endereço da lista para calcular o valor por KM.');
        return;
      }
      if (!restaurante.latitude || !restaurante.longitude) {
        alert('Não foi possível calcular a distância. O restaurante não possui coordenadas configuradas. Verifique com o administrador.');
        return;
      }
      if (parseFloat(formData.valor.replace(',', '.')) <= 0) {
        alert('O valor da entrega não pôde ser calculado. Verifique as configurações de valor por KM.');
        return;
      }
    }

    setLoading(true);
    try {
        const initialStatus = 'aguardando_despacho';
        
        const { data, error } = await supabase
        .from('entregas')
        .insert({
          empresa_id: restaurante.empresa_id,
          restaurante_id: restaurante.id,
          motoboy_id: formData.motoboy_id,
          numero: formData.numero,
          endereco_entrega: formData.endereco_entrega,
          latitude_entrega: formData.latitude_entrega,
          longitude_entrega: formData.longitude_entrega,
          valor: parseFloat(formData.valor.replace(',', '.')),
          valor_pedido: valPedParsed,
          observacao: formData.observacao,
          cliente_nome: formData.cliente_nome,
          cliente_telefone: formData.cliente_telefone,
          forma_pagamento: formData.forma_pagamento,
          ifood_localizador: isIfood ? ifoodLocalizador.trim() : null,
          status: initialStatus,
          created_at: new Date().toISOString(),
          ultima_tentativa_distribuicao_em: new Date().toISOString()
        })
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        const novaEntrega = data[0];
        console.log('REGISTRANDO EVENTOS INICIAIS PARA:', novaEntrega.id);

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
        
        try {
          // Inserir "Pedido criado"
          await supabase.from('historico_status_entregas').insert({
            entrega_id: novaEntrega.id,
            empresa_id: restaurante.empresa_id,
            restaurante_id: restaurante.id,
            status: 'criado',
            descricao: 'Pedido criado'
          });

          // Inserir "Solicitou mesmo motoboy" se selecionado (agrupamento)
          if (formData.motoboy_id) {
            await supabase.from('historico_status_entregas').insert({
              entrega_id: novaEntrega.id,
              empresa_id: restaurante.empresa_id,
              restaurante_id: restaurante.id,
              motoboy_id: formData.motoboy_id,
              status: 'aceita', // Se já vinculou motoboy no agrupamento, cai direto em aceita
              descricao: 'Solicitou mesmo motoboy (Agrupamento)'
            });
            
            // ATUALIZAR STATUS DA ENTREGA PARA ACEITA SE HOUVER MOTOBOY VINCULADO NO ATO DA CRIAÇÃO
            await supabase.from('entregas').update({ status: 'aceita' }).eq('id', novaEntrega.id);
          } else {
            // Fluxo normal sem motoboy pré-fixado
            const descricaoInicial = configDistribuicao?.modo_distribuicao === 'manual' ? 'Aguardando despacho manual' : 'Solicitou motoboy';

            await supabase.from('historico_status_entregas').insert({
              entrega_id: novaEntrega.id,
              empresa_id: restaurante.empresa_id,
              restaurante_id: restaurante.id,
              status: initialStatus,
              descricao: descricaoInicial
            });
          }
          console.log('EVENTOS INICIAIS REGISTRADOS COM SUCESSO');
        } catch (histError) {
          console.error('ERRO AO INSERIR HISTÓRICO INICIAL:', histError);
        }
      }

      onSuccess();
      onClose();
      setIsIfood(false);
      setIfoodLocalizador('');
      setFormData({
        numero: '',
        endereco_entrega: '',
        valor: '',
        valor_pedido: '',
        observacao: '',
        cliente_nome: '',
        cliente_telefone: '',
        forma_pagamento: '',
        latitude_entrega: null,
        longitude_entrega: null,
        motoboy_id: null
      });
    } catch (err: any) {
      console.error('Erro ao criar entrega:', err);
      alert('Erro ao criar entrega: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddressChange = (address: string, lat?: number, lng?: number) => {
    console.log('ENDEREÇO SELECIONADO:', { address, lat, lng });
    
    setFormData(prev => {
      const updated = {
        ...prev,
        endereco_entrega: address,
        latitude_entrega: lat || null,
        longitude_entrega: lng || null
      };
      console.log('FORMDATA ATUALIZADO:', updated);
      return updated;
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-[780px] max-h-[92vh] md:max-h-[85vh] bg-white rounded-2xl md:rounded-3xl shadow-2xl border border-neutral-100 z-[115] overflow-hidden flex flex-col relative my-auto"
          >
            <form onSubmit={handleSubmit} className="flex flex-col h-full overflow-hidden">
              {/* Cabeçalho Fixo */}
              <div className="px-5 py-4 md:px-7 md:py-4 border-b border-neutral-100 flex items-center justify-between bg-white shrink-0">
                <div>
                  <h2 className="text-base md:text-lg font-black text-neutral-900 uppercase tracking-tight flex items-center gap-2">
                    <Package className="text-indigo-600" size={20} />
                    NOVO PEDIDO
                  </h2>
                  <p className="text-[11px] text-neutral-500 font-medium">Criar uma nova entrega</p>
                </div>
                <button 
                  type="button"
                  onClick={onClose}
                  className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-all active:scale-95"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Conteúdo com Scroll */}
              <div className="flex-1 overflow-y-auto px-5 py-5 md:px-7 md:py-6 space-y-6">
                {!businessStatus.open && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                    <div>
                      <h3 className="text-xs font-bold text-amber-900 uppercase tracking-tight">Atenção: Sistema Indisponível</h3>
                      <p className="text-xs text-amber-700 mt-0.5 font-medium leading-relaxed">
                        {businessStatus.message}
                      </p>
                    </div>
                  </div>
                )}

                {/* 1. DADOS DO PEDIDO */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-neutral-100">
                    <div className="p-1 bg-indigo-50 text-indigo-600 rounded-md">
                      <Package size={14} />
                    </div>
                    <h3 className="text-[11px] font-black text-neutral-800 uppercase tracking-wider">
                      1. Dados do Pedido
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                        Código do Pedido *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: #4582"
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-sm"
                        value={formData.numero}
                        onChange={e => setFormData({ ...formData, numero: e.target.value })}
                      />
                    </div>

                    {/* Opção Pedido iFood */}
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-neutral-800">Pedido iFood?</span>
                          <p className="text-[10px] text-neutral-500 font-medium">Ative se esta entrega veio do iFood</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isIfood}
                            onChange={(e) => {
                              setIsIfood(e.target.checked);
                              if (!e.target.checked) setIfoodLocalizador('');
                            }}
                          />
                          <div className="w-10 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                        </label>
                      </div>

                      {isIfood && (
                        <div className="space-y-1 pt-1 animate-in fade-in duration-200">
                          <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest ml-1">
                            Localizador do pedido iFood *
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="80083230"
                            value={ifoodLocalizador}
                            onChange={(e) => setIfoodLocalizador(e.target.value.replace(/\D/g, ''))}
                            className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-lg outline-none focus:ring-2 focus:ring-red-500 font-mono text-xs font-bold text-neutral-900"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. ENTREGA */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-neutral-100">
                    <div className="p-1 bg-indigo-50 text-indigo-600 rounded-md">
                      <MapPin size={14} />
                    </div>
                    <h3 className="text-[11px] font-black text-neutral-800 uppercase tracking-wider">
                      2. Entrega
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                        Endereço de Entrega *
                      </label>
                      <AddressAutocomplete
                        value={formData.endereco_entrega}
                        onChange={handleAddressChange}
                        locationBias={restaurante.latitude && restaurante.longitude ? { 
                          lat: restaurante.latitude, 
                          lng: restaurante.longitude 
                        } : undefined}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                          <Phone size={10} /> Tel. Cliente
                        </label>
                        <input
                          type="text"
                          placeholder="(11) 99999-9999"
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-sm"
                          value={formData.cliente_telefone}
                          onChange={e => setFormData({ ...formData, cliente_telefone: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                          <User size={10} /> Nome do Cliente
                        </label>
                        <input
                          type="text"
                          placeholder="Nome do cliente"
                          className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-sm"
                          value={formData.cliente_nome}
                          onChange={e => setFormData({ ...formData, cliente_nome: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                        <Info size={10} /> Observação
                      </label>
                      <textarea
                        placeholder="Ex: Tocar campainha, apartamento 302..."
                        className="w-full px-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-sm h-20 resize-none"
                        value={formData.observacao}
                        onChange={e => setFormData({ ...formData, observacao: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. DESPACHO */}
                {empresa?.permitir_agrupar_entregas_mesmo_motoboy && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-1 border-b border-neutral-100">
                      <div className="p-1 bg-indigo-50 text-indigo-600 rounded-md">
                        <UserCheck size={14} />
                      </div>
                      <h3 className="text-[11px] font-black text-neutral-800 uppercase tracking-wider">
                        3. Despacho
                      </h3>
                    </div>

                    <OpcoesDespachoSelector
                      modoDistribuicao={configDistribuicao?.modo_distribuicao}
                      activeMotoboys={activeMotoboys}
                      opcao={formData.motoboy_id ? 'mesmo_motoboy' : 'automatica'}
                      onChangeOpcao={(op) => {
                        if (op === 'automatica') {
                          setFormData({ ...formData, motoboy_id: null });
                        } else if (activeMotoboys.length > 0) {
                          setFormData({ ...formData, motoboy_id: activeMotoboys[0].id });
                        }
                      }}
                      selectedMotoboyId={formData.motoboy_id}
                      onChangeMotoboyId={(id) => setFormData({ ...formData, motoboy_id: id })}
                    />
                  </div>
                )}

                {/* 4. VALORES E PAGAMENTO */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pb-1 border-b border-neutral-100">
                    <div className="p-1 bg-indigo-50 text-indigo-600 rounded-md">
                      <DollarSign size={14} />
                    </div>
                    <h3 className="text-[11px] font-black text-neutral-800 uppercase tracking-wider">
                      {empresa?.permitir_agrupar_entregas_mesmo_motoboy ? '4. Valores e Pagamento' : '3. Valores e Pagamento'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                        Valor da Entrega R$ *
                      </label>
                      <input
                        type="text"
                        readOnly
                        placeholder="0,00"
                        className="w-full px-4 py-3 bg-neutral-100 border border-neutral-200 rounded-xl outline-none font-bold text-neutral-600 text-sm cursor-not-allowed"
                        value={formData.valor}
                      />
                      <p className="text-[9px] text-neutral-400 font-bold uppercase ml-1 mt-0.5 italic leading-none">Calculado automaticamente</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                        Valor do Pedido R$ {isMandatoryPayment ? '*' : ''}
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 45,90"
                        required={isMandatoryPayment}
                        className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-bold text-sm"
                        value={formData.valor_pedido}
                        onChange={e => setFormData({ ...formData, valor_pedido: e.target.value })}
                      />
                      <p className="text-[9px] text-neutral-400 font-bold uppercase ml-1 mt-0.5 italic leading-none">
                        {isMandatoryPayment 
                          ? 'Obrigatório para dinheiro/cartão' 
                          : 'Total que o cliente deve pagar'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                      Forma de Pagamento *
                    </label>
                    
                    {!(empresa?.aceita_pagamento_pix || empresa?.aceita_pagamento_credito || empresa?.aceita_pagamento_debito || empresa?.aceita_pagamento_dinheiro || empresa?.aceita_pedido_ja_pago) ? (
                      <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                        <p className="text-xs text-red-600 font-bold uppercase text-center">Nenhuma forma de pagamento liberada pela empresa.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        {[
                          { id: 'pix', label: 'PIX', active: empresa?.aceita_pagamento_pix },
                          { id: 'credito', label: 'Cartão de Crédito', active: empresa?.aceita_pagamento_credito },
                          { id: 'debito', label: 'Cartão de Débito', active: empresa?.aceita_pagamento_debito },
                          { id: 'dinheiro', label: 'Dinheiro', active: empresa?.aceita_pagamento_dinheiro },
                          { id: 'ja_pago', label: 'Pedido já pago', active: empresa?.aceita_pedido_ja_pago },
                        ].filter(p => p.active).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, forma_pagamento: p.label })}
                            className={`py-2.5 px-2.5 rounded-xl border-2 transition-all text-[11px] font-extrabold uppercase text-center truncate ${
                              formData.forma_pagamento === p.label
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm'
                                : 'border-neutral-100 bg-neutral-50 text-neutral-500 hover:border-neutral-200'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Rodapé Fixo */}
              <div className="px-5 py-3.5 md:px-7 md:py-4 border-t border-neutral-100 bg-neutral-50/90 backdrop-blur-sm flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-neutral-200 text-neutral-600 hover:bg-neutral-100 font-bold text-xs md:text-sm transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !businessStatus.open}
                  className={`px-6 py-2.5 text-white font-extrabold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all text-xs md:text-sm shadow-md disabled:opacity-50 ${
                    !businessStatus.open ? 'bg-neutral-400' : 'bg-neutral-900 hover:bg-black shadow-neutral-200'
                  }`}
                >
                  {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Criar Pedido
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
