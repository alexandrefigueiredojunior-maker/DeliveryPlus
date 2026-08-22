import { useState, useEffect, FormEvent } from 'react';
import { X, Loader2, ShoppingBag, User, DollarSign, FileText, Camera, ExternalLink, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Entrega, Restaurante, Motoboy } from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useEmpresa } from '../../contexts/EmpresaContext';
import AddressAutocomplete from '../common/AddressAutocomplete';
import ChatEntrega from '../chat/ChatEntrega';

interface EntregaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Entrega>) => Promise<void>;
  entrega?: Entrega | null;
  loading: boolean;
}

export default function EntregaModal({ isOpen, onClose, onSave, entrega, loading }: EntregaModalProps) {
  const { empresa } = useEmpresa();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [isIfood, setIsIfood] = useState(false);
  const [ifoodLocalizador, setIfoodLocalizador] = useState('');
  const [formData, setFormData] = useState<Partial<Entrega>>({
    restaurante_id: '',
    motoboy_id: '',
    endereco_entrega: '',
    latitude_entrega: null,
    longitude_entrega: null,
    valor: null,
    observacao: '',
    status: 'pendente',
    numero: undefined
  });

  useEffect(() => {
    async function fetchConfig() {
      if (isOpen && empresa && !entrega) {
        const { data } = await supabase
          .from('configuracoes_empresas')
          .select('modo_distribuicao')
          .eq('empresa_id', empresa.id)
          .maybeSingle();
        
        if (data?.modo_distribuicao === 'manual') {
          setFormData(prev => ({ ...prev, status: 'aguardando_despacho' }));
        }
      }
    }
    fetchConfig();

    if (isOpen && empresa) {
      fetchData();
      if (entrega) {
        setFormData({
          restaurante_id: entrega.restaurante_id,
          motoboy_id: entrega.motoboy_id || '',
          endereco_entrega: entrega.endereco_entrega,
          latitude_entrega: entrega.latitude_entrega || null,
          longitude_entrega: entrega.longitude_entrega || null,
          valor: entrega.valor,
          observacao: entrega.observacao || '',
          status: entrega.status,
          numero: entrega.numero
        });
        setIsIfood(!!entrega.ifood_localizador);
        setIfoodLocalizador(entrega.ifood_localizador || '');
      } else {
        setFormData({
          restaurante_id: '',
          motoboy_id: '',
          endereco_entrega: '',
          latitude_entrega: null,
          longitude_entrega: null,
          valor: null,
          observacao: '',
          status: 'pendente', // Default fallback, will be updated by fetchConfig if manual
          numero: undefined
        });
        setIsIfood(false);
        setIfoodLocalizador('');
      }
    }
  }, [isOpen, empresa, entrega]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Link real distance formula
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
    // Only auto-calculate for NEW deliveries
    if (entrega || !empresa) return;

    const restaurante = restaurantes.find(r => r.id === formData.restaurante_id);
    if (!restaurante) return;

    let novoValor = 0;
    let dist = 0;

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
        
        novoValor = dist * (empresa.valor_por_km || 0);
        if (novoValor < (empresa.valor_minimo_entrega || 0)) {
          novoValor = empresa.valor_minimo_entrega || 0;
        }
      }
    }

    console.log('CÁLCULO VALOR ENTREGA (ADMIN):', {
      modelo: empresa.modelo_cobranca_entrega,
      distancia_km: dist.toFixed(2),
      valor_fixo: empresa.valor_fixo_entrega,
      valor_por_km: empresa.valor_por_km,
      valor_minimo: empresa.valor_minimo_entrega,
      valor_final: novoValor.toFixed(2)
    });

    setFormData(prev => ({ ...prev, valor: parseFloat(novoValor.toFixed(2)) }));
  }, [formData.restaurante_id, formData.latitude_entrega, formData.longitude_entrega, empresa, entrega, restaurantes]);

  async function fetchData() {
    try {
      const [restRes, motoRes] = await Promise.all([
        supabase.from('restaurantes').select('id, nome, latitude, longitude').eq('empresa_id', empresa?.id).eq('status', 'ativo').order('nome'),
        supabase.from('motoboys').select('id, nome').eq('empresa_id', empresa?.id).eq('status', 'ativo').order('nome')
      ]);

      setRestaurantes(restRes.data || []);
      setMotoboys(motoRes.data || []);
    } catch (error) {
      console.error('Erro ao carregar dados para o modal:', error);
    }
  }

  const handleAddressChange = (address: string, lat?: number, lng?: number) => {
    setFormData(prev => ({
      ...prev,
      endereco_entrega: address,
      latitude_entrega: lat || null,
      longitude_entrega: lng || null
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isIfood && !ifoodLocalizador.trim()) {
      alert('Por favor, informe o localizador do pedido iFood.');
      return;
    }
    // Preparar dados para salvar
    const dataToSave: Partial<Entrega> = {
      ...formData,
      ifood_localizador: isIfood ? ifoodLocalizador.trim() : null
    };
    if (!dataToSave.motoboy_id) delete dataToSave.motoboy_id;
    
    await onSave(dataToSave);
  };

  const selectedRestaurante = restaurantes.find(r => r.id === formData.restaurante_id);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <h3 className="text-lg font-bold text-neutral-900">
                {entrega ? 'Editar Entrega' : 'Nova Entrega'}
              </h3>
              <div className="flex items-center gap-2">
                {entrega && empresa?.permitir_chat_entrega && ['aceita', 'coletada', 'em_rota'].includes(entrega.status) && (
                  <button 
                    type="button"
                    onClick={() => setIsChatOpen(true)}
                    className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                    title="Abrir Chat"
                  >
                    <MessageSquare size={18} />
                  </button>
                )}
                <button onClick={onClose} className="p-1 hover:bg-neutral-200 rounded-full transition-colors">
                  <X className="h-5 w-5 text-neutral-500" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Número do Pedido</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-neutral-400 font-bold">#</span>
                    <input
                      required
                      type="number"
                      placeholder="123"
                      className="w-full pl-8 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all font-mono"
                      value={formData.numero || ''}
                      onChange={(e) => setFormData({ ...formData, numero: e.target.value ? parseInt(e.target.value) : undefined })}
                    />
                  </div>
                </div>

                {/* Opção Pedido iFood */}
                <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-neutral-800">Pedido iFood?</span>
                      <p className="text-[10px] text-neutral-500">Ative se esta entrega veio do iFood</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
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
                      <label className="block text-[11px] font-bold text-neutral-600">
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
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Restaurante</label>
                  <div className="relative">
                    <ShoppingBag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <select
                      required
                      className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all bg-white"
                      value={formData.restaurante_id || ''}
                      onChange={(e) => setFormData({ ...formData, restaurante_id: e.target.value })}
                    >
                      <option value="">Selecione um restaurante</option>
                      {restaurantes.map(r => (
                        <option key={r.id} value={r.id}>{r.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Motoboy (Opcional)</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                    <select
                      className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all bg-white"
                      value={formData.motoboy_id || ''}
                      onChange={(e) => setFormData({ ...formData, motoboy_id: e.target.value })}
                    >
                      <option value="">Aguardando motoboy</option>
                      {motoboys.map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Endereço de Entrega</label>
                  <AddressAutocomplete
                    value={formData.endereco_entrega || ''}
                    onChange={handleAddressChange}
                    locationBias={selectedRestaurante?.latitude && selectedRestaurante?.longitude ? {
                      lat: selectedRestaurante.latitude,
                      lng: selectedRestaurante.longitude
                    } : undefined}
                  />
                  {!formData.latitude_entrega && formData.endereco_entrega && (
                    <p className="mt-1 text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                      ⚠️ Endereço sem coordenadas. Selecione uma sugestão para marcar no mapa.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Valor da Entrega (R$)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                      <input
                        type="number"
                        step="0.01"
                        readOnly={!entrega}
                        placeholder="0.00"
                        className={`w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all ${!entrega ? 'bg-neutral-100 text-neutral-500 cursor-not-allowed' : ''}`}
                        value={formData.valor === null ? '' : formData.valor}
                        onChange={(e) => !entrega ? null : setFormData({ ...formData, valor: e.target.value ? parseFloat(e.target.value) : null })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Observações</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 h-4 w-4 text-neutral-400" />
                    <textarea
                      rows={2}
                      placeholder="Ex: Tocar campainha, deixar na portaria..."
                      className="w-full pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none transition-all resize-none"
                      value={formData.observacao || ''}
                      onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                    />
                  </div>
                </div>

                {/* Comprovante de Entrega do Motoboy */}
                {entrega && (entrega.observacao_motoboy || entrega.comprovante_entrega_url) && (
                  <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 space-y-3">
                    <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                      <Camera size={12} /> Comprovante de Entrega
                    </h4>
                    
                    {entrega.observacao_motoboy && (
                      <div className="space-y-1">
                        <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none">Observação do Motoboy</p>
                        <p className="text-sm text-neutral-700 font-medium italic">"{entrega.observacao_motoboy}"</p>
                      </div>
                    )}
                    
                    {entrega.comprovante_entrega_url && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none">Foto Comprovante</p>
                        <div className="relative aspect-video rounded-xl overflow-hidden border border-white shadow-sm cursor-pointer group">
                          <img 
                            src={entrega.comprovante_entrega_url} 
                            alt="Comprovante" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                            onClick={(e) => {
                              e.preventDefault();
                              window.open(entrega.comprovante_entrega_url, '_blank');
                            }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                            <ExternalLink size={20} className="text-white opacity-0 group-hover:opacity-100 transition-all" />
                          </div>
                        </div>
                        {entrega.comprovante_entrega_em && (
                          <p className="text-[8px] text-neutral-400 font-bold uppercase text-right">
                            Enviado em: {new Date(entrega.comprovante_entrega_em).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-6 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-[2] flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-xl transition-all shadow-sm disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    entrega ? 'Salvar Alterações' : 'Criar Entrega'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {isChatOpen && entrega && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChatOpen(false)}
              className="fixed inset-0 bg-black/60 z-[9998] backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: '100%', scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: '100%', scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 top-10 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:h-[600px] z-[9999] bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden"
            >
              <ChatEntrega 
                entrega={entrega}
                remetenteTipo="empresa"
                remetenteNome={empresa?.nome || 'Central'}
                onClose={() => setIsChatOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
