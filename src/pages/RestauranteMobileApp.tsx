import { useEffect, useState, ChangeEvent, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { formatLocationTime } from '../lib/location';
import { Entrega, Restaurante, HistoricoEntrega } from '../types';
import { 
  Package, 
  MapPin, 
  LogOut, 
  Menu, 
  X, 
  User, 
  Plus,
  Settings,
  Phone,
  Camera,
  Save,
  Clock,
  Loader2,
  AlertCircle,
  History,
  CheckCircle2,
  ChevronRight,
  UserCircle,
  Download,
  Filter,
  Search,
  Eraser,
  Navigation,
  Pencil,
  DollarSign,
  XCircle,
  ExternalLink,
  MessageSquare,
  Bike,
  TrendingUp,
  Calendar,
  Volume2,
  VolumeX,
  Building2,
  Receipt,
  Link2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import NovoPedidoModal from '../components/restaurante/NovoPedidoModal';
import ChatEntrega from '../components/chat/ChatEntrega';
import InstallPWA from '../components/common/InstallPWA';
import MeusRepassesRestaurante from '../components/MeusRepassesRestaurante';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AddressAutocomplete from '../components/common/AddressAutocomplete';
import { ChamarMotoboyModal } from '../components/restaurante/ChamarMotoboyModal';
import { despacharEntregaExistente } from '../utils/despachoUtils';

// Leaflet markers fix
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const motoboyIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

const deliveryIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1673/1673188.png',
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

const restauranteIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448609.png',
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
}

const getPeriodDates = (period: string, customStart?: string, customEnd?: string) => {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  if (period === 'hoje') {
    start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
  } else if (period === 'ontem') {
    start.setDate(now.getDate() - 1); start.setHours(0, 0, 0, 0);
    end.setDate(now.getDate() - 1); end.setHours(23, 59, 59, 999);
  } else if (period === 'semana') {
    const day = now.getDay(); start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
  } else if (period === 'mes') {
    start.setDate(1); start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
  } else if (period === 'personalizado') {
    if (customStart) {
      const parts = customStart.split('-');
      if (parts.length === 3) start.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(now.getDate() - 30); start.setHours(0, 0, 0, 0);
    }
    if (customEnd) {
      const parts = customEnd.split('-');
      if (parts.length === 3) end.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      end.setHours(23, 59, 59, 999);
    } else {
      end.setHours(23, 59, 59, 999);
    }
  }
  return { start, end };
};

const formatTimelineDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return timeStr;
  return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às ${timeStr}`;
};

export default function RestauranteMobileApp() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [restaurante, setRestaurante] = useState<Restaurante | null>(null);
  const [empresa, setEmpresa] = useState<any | null>(null);
  const [entregasAtivas, setEntregasAtivas] = useState<Entrega[]>([]);
  const [historicoEntregas, setHistoricoEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [view, setView] = useState<'entregas' | 'historico' | 'configuracoes' | 'repasses' | 'integracoes'>('entregas');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [businessStatus, setBusinessStatus] = useState<{ open: boolean; message?: string }>({ open: true });
  const [isNovoPedidoOpen, setIsNovoPedidoOpen] = useState(false);
  const [isChamarMotoboyModalOpen, setIsChamarMotoboyModalOpen] = useState(false);
  const [entregaParaChamarMotoboy, setEntregaParaChamarMotoboy] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [podeEditarPedido, setPodeEditarPedido] = useState<boolean | null>(null);
  const [selectedEntrega, setSelectedEntrega] = useState<any | null>(null);
  const [historicoStatus, setHistoricoStatus] = useState<HistoricoEntrega[]>([]);
  const [pagamentosPagbank, setPagamentosPagbank] = useState<any[]>([]);
  const [financeSelectedState, setFinanceSelectedState] = useState<{
    id: string;
    valor_pedido: number;
    valor_pago_dinheiro: number;
    total_pagbank: number;
    pagamento_status: string;
    status: string;
    saldo_restante: number;
  } | null>(null);

  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [chatNotification, setChatNotification] = useState<{ show: boolean, message: string, entregaId: string } | null>(null);
  const chatAudioRef = useRef<HTMLAudioElement | null>(null);
  const [canPlayAudio, setCanPlayAudio] = useState(() => localStorage.getItem('permitir_alertas_sonoros') === 'true');

  const toggleAlertasSonoros = async () => {
    if (canPlayAudio) {
      setCanPlayAudio(false);
      localStorage.setItem('permitir_alertas_sonoros', 'false');
    } else {
      try {
        // Áudio mudo de 1ms base64 para desbloquear autoplay do navegador e webview
        const silentAudio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
        await silentAudio.play();
        
        if (chatAudioRef.current) {
          await chatAudioRef.current.play();
          chatAudioRef.current.pause();
          chatAudioRef.current.currentTime = 0;
        }
        
        setCanPlayAudio(true);
        localStorage.setItem('permitir_alertas_sonoros', 'true');
      } catch (err) {
        console.error("Erro ao desbloquear áudio no mobile:", err);
        // Fallback para play normal
        if (chatAudioRef.current) {
          chatAudioRef.current.play().then(() => {
            chatAudioRef.current?.pause();
            chatAudioRef.current!.currentTime = 0;
            setCanPlayAudio(true);
            localStorage.setItem('permitir_alertas_sonoros', 'true');
          }).catch(e => console.log('Erro no autoplay:', e));
        }
      }
    }
  };
  const [configDistribuicao, setConfigDistribuicao] = useState<any | null>(null);
  const [isSelecaoMotoboyOpen, setIsSelecaoMotoboyOpen] = useState(false);
  const [onlineMotoboys, setOnlineMotoboys] = useState<any[]>([]);
  const [loadingMotoboys, setLoadingMotoboys] = useState(false);
  const [entregaParaDespacho, setEntregaParaDespacho] = useState<string | null>(null);

  const [motoboyLocation, setMotoboyLocation] = useState<{lat: number, lng: number, ultima_localizacao_em?: string | null} | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [isEditingPedido, setIsEditingPedido] = useState(false);
  const [pedidoEditForm, setPedidoEditForm] = useState({
    numero: '',
    cliente_nome: '',
    cliente_telefone: '',
    endereco_entrega: '',
    latitude_entrega: null as number | null,
    longitude_entrega: null as number | null,
    valor: '',
    observacao: '',
    forma_pagamento: '',
    is_ifood: false,
    ifood_localizador: ''
  });

  const [filters, setFilters] = useState({
    periodo: 'hoje',
    status: 'todos',
    dataInicio: '',
    dataFim: '',
    numero: '',
    acerto: 'todos'
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [editData, setEditData] = useState({
    nome: '',
    telefone: '',
    endereco: '',
    foto_url: '',
    pix_nome_completo: '',
    pix_cpf: '',
    pix_chave: '',
    pagbank_conta: '',
    pagbank_digito: ''
  });

  const getPagbankTotalForEntrega = (entregaId: string) => {
    return pagamentosPagbank
      .filter(p => p.entrega_id === entregaId)
      .reduce((sum, item) => sum + (item.valor_total || 0), 0);
  };

  const carregarValoresFinais = async (targetId?: string) => {
    const idParaCarregar = targetId || selectedEntrega?.id;
    if (!idParaCarregar) return;
    try {
      const { data: entregaData, error: entregaError } = await supabase
        .from('entregas')
        .select('id, valor_pedido, valor_pago_dinheiro, pagamento_status, status, valor')
        .eq('id', idParaCarregar)
        .maybeSingle();

      if (entregaError) throw entregaError;
      if (!entregaData) return;

      const { data: payData, error: payError } = await supabase
        .from('pagamentos_pagbank')
        .select('valor_total')
        .eq('entrega_id', idParaCarregar);

      if (payError) throw payError;

      const totalPagbank = (payData || []).reduce((sum, item) => sum + (item.valor_total || 0), 0);
      const valorPedido = entregaData.valor_pedido || entregaData.valor || 0;
      const valorPagoDinheiro = entregaData.valor_pago_dinheiro || 0;
      const saldoRestante = Math.max(0, valorPedido - totalPagbank - valorPagoDinheiro);

      setFinanceSelectedState({
        id: idParaCarregar,
        valor_pedido: valorPedido,
        valor_pago_dinheiro: valorPagoDinheiro,
        total_pagbank: totalPagbank,
        pagamento_status: entregaData.pagamento_status || 'pendente',
        status: entregaData.status || 'pendente',
        saldo_restante: saldoRestante
      });

      setSelectedEntrega(prev => prev && prev.id === idParaCarregar ? { 
        ...prev, 
        status: entregaData.status,
        pagamento_status: entregaData.pagamento_status,
        valor_pago_dinheiro: entregaData.valor_pago_dinheiro,
        valor_pedido: entregaData.valor_pedido
      } : prev);

    } catch (err) {
      console.error('Erro em carregarValoresFinais:', err);
    }
  };

  const fetchHistory = async (entregaId: string) => {
    setLoadingHistorico(true);
    try {
      const { data, error } = await supabase
        .from('historico_status_entregas')
        .select('*')
        .eq('entrega_id', entregaId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setHistoricoStatus(data || []);
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    } finally {
      setLoadingHistorico(false);
    }
  };

  useEffect(() => {
    if (selectedEntrega?.id) {
      const currentId = selectedEntrega.id;
      fetchHistory(currentId);
      carregarValoresFinais(currentId);

      const channel = supabase
        .channel(`detalhes_entrega_mobile_${currentId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'historico_status_entregas', filter: `entrega_id=eq.${currentId}` }, () => { fetchHistory(currentId); })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'entregas', filter: `id=eq.${currentId}` }, () => { carregarValoresFinais(currentId); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos_pagbank', filter: `entrega_id=eq.${currentId}` }, () => { carregarValoresFinais(currentId); })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    } else {
      setHistoricoStatus([]);
      setFinanceSelectedState(null);
    }
  }, [selectedEntrega?.id]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  useEffect(() => {
    if (!isEditingPedido || !empresa || !restaurante) return;
    let novoValor = 0;
    let dist = 0;
    if (empresa.modelo_cobranca_entrega === 'fixo') {
      novoValor = empresa.valor_fixo_entrega || 0;
    } else if (empresa.modelo_cobranca_entrega === 'km') {
      if (restaurante.latitude && restaurante.longitude && pedidoEditForm.latitude_entrega && pedidoEditForm.longitude_entrega) {
        dist = calculateDistance(Number(restaurante.latitude), Number(restaurante.longitude), pedidoEditForm.latitude_entrega, pedidoEditForm.longitude_entrega);
        novoValor = dist * (empresa.valor_por_km || 0);
        if (novoValor < (empresa.valor_minimo_entrega || 0)) {
          novoValor = empresa.valor_minimo_entrega || 0;
        }
      }
    }
    setPedidoEditForm(prev => ({ ...prev, valor: novoValor.toFixed(2).replace('.', ',') }));
  }, [isEditingPedido, pedidoEditForm.latitude_entrega, pedidoEditForm.longitude_entrega]);

  useEffect(() => {
    if (user) fetchRestauranteProfile(user.id);
  }, [user]);

  // Redireciona dispositivo desktop para a rota desktop dedicada
  useEffect(() => {
    if (window.innerWidth >= 768) {
      navigate('/app-restaurante', { replace: true });
    }
  }, [navigate]);

  // Ativacao do cordova-plugin-background-mode (webview background)
  useEffect(() => {
    const win = window as any;
    if (win.cordova?.plugins?.backgroundMode) {
      try {
        win.cordova.plugins.backgroundMode.enable();
        win.cordova.plugins.backgroundMode.setDefaults({ 
          title: 'DeliveryJunior', 
          text: 'Monitorando novos pedidos...' 
        });
      } catch (err) {
        console.error('Erro ao ativar backgroundMode:', err);
      }
    }
  }, []);

  useEffect(() => {
    if (!restaurante?.empresa_id) return;
    const fetchEmpresaPermissoes = async () => {
      const { data } = await supabase.from('empresas').select('*').eq('id', restaurante.empresa_id).maybeSingle();
      setPodeEditarPedido(data?.restaurante_pode_editar_pedido === true);
    };
    fetchEmpresaPermissoes();
  }, [restaurante?.id, restaurante?.empresa_id]);

  const isPagbankAtivo = configDistribuicao?.pagbank_ativo === true;

  // Se o PagBank não estiver ativo e a tela selecionada for repasses, volta para entregas
  useEffect(() => {
    if (!loadingProfile && !isPagbankAtivo && view === 'repasses') {
      setView('entregas');
    }
  }, [isPagbankAtivo, view, loadingProfile]);

  useEffect(() => {
    if (restaurante) {
      fetchEntregas();
      carregarMotoboysOnline();
      checkPendingRequest();
      setEditData({
        nome: restaurante.nome || '', telefone: restaurante.telefone || '', endereco: restaurante.endereco || '', foto_url: restaurante.foto_url || '',
        pix_nome_completo: restaurante.pix_nome_completo || '', pix_cpf: restaurante.pix_cpf || '', pix_chave: restaurante.pix_chave || '',
        pagbank_conta: restaurante.pagbank_conta || '', pagbank_digito: restaurante.pagbank_digito || ''
      });

      const subscription = supabase
        .channel(`realtime_restaurante_mobile_geral_${restaurante.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas', filter: `restaurante_id=eq.${restaurante.id}` }, () => { fetchEntregas(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos_pagbank', filter: `restaurante_id=eq.${restaurante.id}` }, () => { fetchEntregas(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracoes_empresas', filter: `empresa_id=eq.${restaurante.empresa_id}` }, (payload) => {
          if (payload.new) {
            setConfigDistribuicao(payload.new as any);
          }
        })
        .subscribe();

      return () => { subscription.unsubscribe(); };
    }
  }, [restaurante, filters]);

  useEffect(() => {
    let locationSubscription: any = null;
    if (selectedEntrega && selectedEntrega.motoboy_id && ['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(selectedEntrega.status)) {
      const setupTracking = async () => {
        setLoadingLocation(true);
        try {
          const { data: initialLoc } = await supabase.from('localizacoes_motoboys').select('latitude, longitude, ultima_localizacao_em, updated_at').eq('motoboy_id', selectedEntrega.motoboy_id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
          if (initialLoc) setMotoboyLocation({ lat: initialLoc.latitude, lng: initialLoc.longitude, ultima_localizacao_em: initialLoc.ultima_localizacao_em || initialLoc.updated_at });

          locationSubscription = supabase
            .channel(`motoboy_track_mobile_${selectedEntrega.motoboy_id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'localizacoes_motoboys', filter: `motoboy_id=eq.${selectedEntrega.motoboy_id}` }, (payload) => { setMotoboyLocation({ lat: payload.new.latitude, lng: payload.new.longitude, ultima_localizacao_em: payload.new.ultima_localizacao_em || payload.new.updated_at }); })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'localizacoes_motoboys', filter: `motoboy_id=eq.${selectedEntrega.motoboy_id}` }, (payload) => { setMotoboyLocation({ lat: payload.new.latitude, lng: payload.new.longitude, ultima_localizacao_em: payload.new.ultima_localizacao_em || payload.new.updated_at }); })
            .subscribe();
        } catch (err) {
          console.error(err);
        } finally {
          setLoadingLocation(false);
        }
      };
      setupTracking();
    } else {
      setMotoboyLocation(null);
    }
    return () => { if (locationSubscription) locationSubscription.unsubscribe(); };
  }, [selectedEntrega]);

  const fetchRestauranteProfile = async (userId: string) => {
    try {
      setLoadingProfile(true);
      const { data: rData, error: rError } = await supabase.from('restaurantes').select('*').eq('user_id', userId).maybeSingle();
      if (rError) throw rError;
      if (!rData) return;
      setRestaurante(rData);

      const { data: empData } = await supabase.from('empresas').select('*').eq('id', rData.empresa_id).maybeSingle();
      if (empData) {
        setEmpresa(empData);
        const { data: configData } = await supabase.from('configuracoes_empresas').select('*').eq('empresa_id', rData.empresa_id).maybeSingle();
        setConfigDistribuicao(configData || { empresa_id: rData.empresa_id, modo_distribuicao: 'todos_online' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (empresa) checkBusinessHours();
  }, [empresa]);

  useEffect(() => {
    if (restaurante) {
      const channel = supabase
        .channel(`restaurant_chats_mobile_${restaurante.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_entregas', filter: `restaurante_id=eq.${restaurante.id}` }, (payload) => {
          const newMessage = payload.new as any;
          if (newMessage.remetente_tipo !== 'restaurante') {
            if (!(isChatOpen && selectedEntrega?.id === newMessage.entrega_id)) {
              if (chatAudioRef.current && canPlayAudio) chatAudioRef.current.play().catch(e => console.log(e));
              setChatNotification({ show: true, message: `Nova mensagem em Pedido #${newMessage.entrega_id.slice(0, 4)}`, entregaId: newMessage.entrega_id });
              setTimeout(() => setChatNotification(null), 5000);
            }
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [restaurante, isChatOpen, selectedEntrega?.id, canPlayAudio]);

  const checkBusinessHours = () => {
    if (!empresa?.funcionamento_ativo) {
      setBusinessStatus({ open: true }); return;
    }
    try {
      const now = new Date();
      const spDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const dayOfWeek = spDate.getDay();
      const currentMinutes = spDate.getHours() * 60 + spDate.getMinutes();
      const diasPermitidos = empresa.funcionamento_dias_semana || [1, 2, 3, 4, 5, 6, 0];

      if (!diasPermitidos.includes(dayOfWeek)) {
        setBusinessStatus({ open: false, message: 'Hoje a empresa não está realizando entregas.' }); return;
      }
      if (empresa.funcionamento_inicio && empresa.funcionamento_fim) {
        const [hInicio, mInicio] = empresa.funcionamento_inicio.split(':').map(Number);
        const [hFim, mFim] = empresa.funcionamento_fim.split(':').map(Number);
        const startMinutes = hInicio * 60 + mInicio;
        const endMinutes = hFim * 60 + mFim;
        let isOpen = startMinutes < endMinutes ? (currentMinutes >= startMinutes && currentMinutes <= endMinutes) : (currentMinutes >= startMinutes || currentMinutes <= endMinutes);
        if (!isOpen) {
          setBusinessStatus({ open: false, message: `Estamos fora do horário de atendimento (${empresa.funcionamento_inicio} às ${empresa.funcionamento_fim}).` }); return;
        }
      }
      setBusinessStatus({ open: true });
    } catch (err) {
      console.error(err); setBusinessStatus({ open: true });
    }
  };

  const fetchEntregas = async () => {
    if (!restaurante) return;
    carregarMotoboysOnline();
    try {
      setLoading(true);
      const { data: ativas, error: errorAtivas } = await supabase
        .from('entregas')
        .select('*')
        .eq('restaurante_id', restaurante.id)
        .in('status', ['aguardando_despacho', 'pendente', 'aceita', 'coletada', 'em_rota', 'pagamento_errado'])
        .order('created_at', { ascending: false });

      if (errorAtivas) throw errorAtivas;

      let query = supabase.from('entregas').select('*').eq('restaurante_id', restaurante.id);
      if (filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      } else {
        query = query.in('status', ['entregue', 'cancelada']);
      }

      const { start, end } = getPeriodDates(filters.periodo, filters.dataInicio, filters.dataFim);
      query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());

      if (filters.numero) query = query.ilike('numero', `%${filters.numero}%`);
      if (filters.acerto !== 'todos') query = query.eq('acertada', filters.acerto === 'acertada');

      const { data: historico, error: errorHistorico } = await query
        .order('created_at', { ascending: false })
        .limit(filters.numero || filters.dataInicio ? 100 : 30);

      if (errorHistorico) throw errorHistorico;

      const motoboyIds = Array.from(new Set([
        ...(ativas || []).map(e => e.motoboy_id).filter(Boolean),
        ...(historico || []).map(e => e.motoboy_id).filter(Boolean)
      ]));

      let motoboysMap: Record<string, any> = {};
      if (motoboyIds.length > 0) {
        const { data: activeMotoboys } = await supabase.rpc('listar_motoboys_para_restaurante');
        if (activeMotoboys) {
          activeMotoboys.forEach((m: any) => { motoboysMap[m.id] = m; });
        }
        const remainingIds = motoboyIds.filter(id => !motoboysMap[id]);
        if (remainingIds.length > 0) {
          const { data: mData } = await supabase.from('motoboys_publico').select('id, nome, telefone, foto_url').in('id', remainingIds);
          if (mData) {
            mData.forEach(m => { motoboysMap[m.id] = m; });
          }
        }
      }

      const mergeMotoboy = (ent: any) => {
        if (ent.motoboy_id) {
          return { ...ent, motoboy: motoboysMap[ent.motoboy_id] };
        }
        return { ...ent, motoboy: null };
      };

      setEntregasAtivas((ativas || []).map(mergeMotoboy));
      setHistoricoEntregas((historico || []).map(mergeMotoboy));

      const activeIds = [...(ativas || []).map(e => e.id), ...(historico || []).map(e => e.id)];
      if (activeIds.length > 0) {
        const { data: payData } = await supabase.from('pagamentos_pagbank').select('*').in('entrega_id', activeIds);
        setPagamentosPagbank(payData || []);
      } else {
        setPagamentosPagbank([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkPendingRequest = async () => {
    if (!restaurante) return;
    const { data } = await supabase.from('solicitacoes_alteracoes').select('*').eq('entidade_id', restaurante.id).eq('tipo_entidade', 'restaurante').eq('status', 'pendente').maybeSingle();
    setHasPendingRequest(!!data);
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !restaurante) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${restaurante.id}_${Date.now()}.${fileExt}`;
      const filePath = `restaurantes/${restaurante.empresa_id}/${fileName}`;
      await supabase.storage.from('imagens').upload(filePath, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('imagens').getPublicUrl(filePath);
      setEditData(prev => ({ ...prev, foto_url: publicUrl }));
    } catch (error) {
      console.error(error); alert('Erro no upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!restaurante || !user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('solicitacoes_alteracoes').insert({
        empresa_id: restaurante.empresa_id, tipo_entidade: 'restaurante', entidade_id: restaurante.id, user_id: user.id,
        dados_anteriores: {
          nome: restaurante.nome, telefone: restaurante.telefone, endereco: restaurante.endereco, foto_url: restaurante.foto_url,
          pix_nome_completo: restaurante.pix_nome_completo || '', pix_cpf: restaurante.pix_cpf || '', pix_chave: restaurante.pix_chave || '',
          pagbank_conta: restaurante.pagbank_conta || '', pagbank_digito: restaurante.pagbank_digito || ''
        },
        dados_novos: editData, status: 'pendente'
      });
      if (error) throw error;
      setHasPendingRequest(true); setView('entregas');
      alert('Sua solicitação de alteração foi enviada para aprovação.');
    } catch (err) {
      console.error(err); alert('Erro ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditPedido = (entrega: Entrega) => {
    setSelectedEntrega(entrega);
    setPedidoEditForm({
      numero: entrega.numero || '', cliente_nome: entrega.cliente_nome || '', cliente_telefone: entrega.cliente_telefone || '',
      endereco_entrega: entrega.endereco_entrega || '', latitude_entrega: entrega.latitude_entrega || null, longitude_entrega: entrega.longitude_entrega || null,
      valor: entrega.valor?.toString() || '', observacao: entrega.observacao || '', forma_pagamento: entrega.forma_pagamento || '',
      is_ifood: !!entrega.ifood_localizador, ifood_localizador: entrega.ifood_localizador || ''
    });
    setIsEditingPedido(true);
  };

  const handleSavePedidoEdit = async () => {
    if (!selectedEntrega) return;
    if (pedidoEditForm.is_ifood && !pedidoEditForm.ifood_localizador.trim()) {
      alert('Por favor, informe o localizador do pedido iFood.');
      return;
    }
    if (empresa?.modelo_cobranca_entrega === 'km') {
      if (!pedidoEditForm.latitude_entrega || !pedidoEditForm.longitude_entrega) {
        alert('Selecione um endereço para calcular por KM.'); return;
      }
      if (!restaurante?.latitude || !restaurante?.longitude) {
        alert('O restaurante não possui coordenadas.'); return;
      }
      if (parseFloat(pedidoEditForm.valor.replace(',', '.')) <= 0) {
        alert('Erro no cálculo de distância.'); return;
      }
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('entregas')
        .update({
          numero: pedidoEditForm.numero, cliente_nome: pedidoEditForm.cliente_nome, cliente_telefone: pedidoEditForm.cliente_telefone,
          endereco_entrega: pedidoEditForm.endereco_entrega, latitude_entrega: pedidoEditForm.latitude_entrega, longitude_entrega: pedidoEditForm.longitude_entrega,
          valor: parseFloat(pedidoEditForm.valor.replace(',', '.')), observacao: pedidoEditForm.observacao, forma_pagamento: pedidoEditForm.forma_pagamento,
          ifood_localizador: pedidoEditForm.is_ifood ? pedidoEditForm.ifood_localizador.trim() : null
        })
        .eq('id', selectedEntrega.id);

      if (error) throw error;
      const updated = {
        ...selectedEntrega,
        ...pedidoEditForm,
        valor: parseFloat(pedidoEditForm.valor.replace(',', '.')),
        ifood_localizador: pedidoEditForm.is_ifood ? pedidoEditForm.ifood_localizador.trim() : null
      };
      setSelectedEntrega(updated);
      setEntregasAtivas(prev => prev.map(e => e.id === updated.id ? updated : e));
      setIsEditingPedido(false);
      alert('Pedido atualizado!');
    } catch (err) {
      console.error(err); alert('Erro ao editar pedido.');
    } finally {
      setIsSaving(false);
    }
  };

  const carregarMotoboysOnline = async () => {
    if (!restaurante) return;
    setLoadingMotoboys(true);
    try {
      const { data, error } = await supabase.rpc('listar_motoboys_para_restaurante');
      if (error) throw error;
      const unique: any[] = [];
      const seen = new Set();
      if (data) {
        data.forEach((m: any) => {
          if (m && m.id && !seen.has(m.id)) {
            seen.add(m.id); unique.push(m);
          }
        });
      }
      setOnlineMotoboys(unique);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMotoboys(false);
    }
  };

  const handleChamarMotoboy = async (entregaId: string) => {
    if (!restaurante) return;

    // Rule 1: Check empresa.permitir_agrupar_entregas_mesmo_motoboy
    if (empresa?.permitir_agrupar_entregas_mesmo_motoboy) {
      setEntregaParaChamarMotoboy(entregaId);
      setIsChamarMotoboyModalOpen(true);
      return;
    }

    // Rule 2: If permitir_mesmo_motoboy = false:
    if (configDistribuicao?.modo_distribuicao === 'manual') {
      setEntregaParaDespacho(entregaId);
      setIsSelecaoMotoboyOpen(true);
      carregarMotoboysOnline();
      return;
    }

    setLoading(true);
    try {
      await despacharEntregaExistente({
        entregaId,
        empresaId: restaurante.empresa_id,
        restauranteId: restaurante.id,
        motoboyId: null,
        modoDistribuicao: configDistribuicao?.modo_distribuicao || 'todos_online',
      });

      if (selectedEntrega?.id === entregaId) setSelectedEntrega({ ...selectedEntrega, status: 'pendente' });
      fetchEntregas();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMotoboyManual = async (motoboyId: string) => {
    if (!restaurante || !entregaParaDespacho) return;
    setLoading(true);
    try {
      await supabase.from('entregas').update({ status: 'aceita', motoboy_id: motoboyId }).eq('id', entregaParaDespacho);
      await supabase.from('historico_status_entregas').insert({ entrega_id: entregaParaDespacho, empresa_id: restaurante.empresa_id, restaurante_id: restaurante.id, status: 'aceita', descricao: `Motoboy escolhido manualmente: ${onlineMotoboys.find(m => m.id === motoboyId)?.nome}` });
      if (selectedEntrega?.id === entregaParaDespacho) setSelectedEntrega({ ...selectedEntrega, status: 'aceita', motoboy_id: motoboyId });
      setIsSelecaoMotoboyOpen(false); setEntregaParaDespacho(null); fetchEntregas(); alert('Motoboy vinculado!');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEstornarCartaoRestaurante = async (entregaId: string) => {
    if (!window.confirm('Deseja estornar os dados de faturamento do cartão reabrindo a entrega?')) return;
    setLoading(true);
    try {
      await supabase.from('pagamentos_pagbank').delete().eq('entrega_id', entregaId);
      await supabase.from('entregas').update({ status: 'em_rota', pagamento_status: 'pendente', entregue_em: null, valor_pago_dinheiro: 0 }).eq('id', entregaId);
      alert('Cobrança de cartão limpa e entrega reaberta!');
      carregarValoresFinais(entregaId); fetchEntregas();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPedido = async (entregaId: string) => {
    if (!window.confirm('Deseja cancelar o pedido?')) return;
    setLoading(true);
    try {
      await supabase.from('entregas').update({ status: 'cancelada' }).eq('id', entregaId);
      await supabase.from('historico_status_entregas').insert({ entrega_id: entregaId, empresa_id: restaurante?.empresa_id, restaurante_id: restaurante?.id, status: 'cancelada', descricao: 'Pedido cancelado pelo restaurante' });
      setSelectedEntrega(null); fetchEntregas(); alert('Cancelado com sucesso.');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getCanCancel = (ent: Entrega) => {
    if (ent.status === 'entregue' || ent.status === 'cancelada') return false;
    const limit = empresa?.tempo_limite_cancelamento_restaurante_minutos ?? 5;
    return (new Date().getTime() - new Date(ent.created_at).getTime()) / 60000 <= limit;
  };

  const handleToggleAcerto = async (ent: Entrega) => {
    if (!restaurante || !user) return;
    setLoading(true);
    try {
      const isSettling = !ent.acertada;
      await supabase.from('entregas').update({ acertada: isSettling, acertada_em: isSettling ? new Date().toISOString() : null, acertada_por: isSettling ? user.id : null }).eq('id', ent.id);
      setHistoricoEntregas(prev => prev.map(e => e.id === ent.id ? { ...e, acertada: isSettling, acertada_em: isSettling ? new Date().toISOString() : null } : e));
      if (selectedEntrega?.id === ent.id) setSelectedEntrega({ ...selectedEntrega, acertada: isSettling, acertada_em: isSettling ? new Date().toISOString() : null });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (historicoEntregas.length === 0) { alert('Nada para exportar'); return; }
    try {
      const data = [['Pedido', 'Cliente', 'Telefone', 'Endereço', 'Status', 'Motoboy', 'Valor', 'Acertada', 'Criado Em']];
      historicoEntregas.forEach(e => {
        data.push([
          e.numero || '', e.cliente_nome || '', e.cliente_telefone || '', e.endereco_entrega || '', getStatusLabel(e.status),
          (e as any).motoboy?.nome || '', Number(e.valor || 0), e.acertada ? 'SIM' : 'NÃO', new Date(e.created_at).toLocaleString()
        ]);
      });
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Histórico");
      XLSX.writeFile(wb, `relatorio-restaurante-mobile-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aguardando_despacho': return 'bg-neutral-500 text-white';
      case 'pendente': return 'bg-neutral-200 text-neutral-600';
      case 'aceita': return 'bg-blue-50 text-blue-600';
      case 'coletada': return 'bg-purple-50 text-purple-600';
      case 'em_rota': return 'bg-blue-500 text-white';
      case 'pagamento_errado': return 'bg-red-500 text-white animate-pulse';
      case 'entregue': return 'bg-green-50 text-green-600';
      case 'cancelada': return 'bg-red-50 text-red-600';
      default: return 'bg-neutral-50 text-neutral-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'aguardando_despacho': return 'Aguardando Despacho';
      case 'pendente': return 'Buscando Motoboy';
      case 'aceita': return 'Motoboy Aceitou';
      case 'coletada': return 'Pedido Coletado';
      case 'em_rota': return 'Em Rota de Entrega';
      case 'pagamento_errado': return 'Pagamento Estornado';
      case 'entregue': return 'Finalizada';
      case 'cancelada': return 'Cancelada';
      default: return status;
    }
  };

  if (loadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-500">
        <Loader2 className="h-10 w-10 animate-spin text-white" />
      </div>
    );
  }

  if (!restaurante) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6 text-center">
        <div className="max-w-xs space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-50 text-red-500 rounded-full"><AlertCircle size={40} /></div>
          <h1 className="text-2xl font-black text-neutral-900">Acesso Negado</h1>
          <p className="text-neutral-500">Acesso ainda não concedido ou usuário não vinculado.</p>
          <button onClick={() => signOut()} className="w-full py-4 bg-orange-500 text-white font-bold rounded-2xl">Sair</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-50 text-neutral-900 min-h-screen pb-24 font-sans select-none flex flex-col">
      <header className="h-16 bg-orange-500 text-white p-4 sticky top-0 z-50 flex items-center justify-between shadow-md shrink-0">
        <button onClick={() => setIsMenuOpen(true)} className="p-2 hover:bg-white/10 rounded-xl"><Menu className="h-6 w-6" /></button>
        <div className="text-center">
          <h1 className="font-extrabold text-sm tracking-tight">Painel Mobile</h1>
          <p className="text-[9px] text-orange-100 font-black uppercase tracking-widest">{restaurante.nome}</p>
        </div>
        <button onClick={() => setView('configuracoes')} className="p-2">
          {restaurante.foto_url ? <img src={restaurante.foto_url} className="h-7 w-7 rounded-full object-cover border border-white/20" /> : <UserCircle className="h-7 w-7" />}
        </button>
      </header>

      {view === 'entregas' ? (
        <div className="flex-1 w-full relative">
          {!selectedEntrega ? (
            /* LISTA INTEIRA NO MOBILE (REMOVIDO MAPA FIXO) */
            <div className="w-full flex flex-col bg-white">
              <div className="p-4 border-b border-neutral-100 space-y-3 bg-white shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-black text-base uppercase tracking-tight text-neutral-900">Entregas do Dia</h2>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">{entregasAtivas.length} pedidas • {onlineMotoboys.length} motoboys online</p>
                  </div>
                  <button 
                    onClick={() => { if (businessStatus.open && configDistribuicao) setIsNovoPedidoOpen(true); }}
                    disabled={!businessStatus.open || !configDistribuicao}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
                  >
                    <Plus size={11} /> Novo Pedido
                  </button>
                </div>

                {!businessStatus.open && (
                  <div className="bg-amber-100 text-amber-800 p-3 rounded-2xl flex gap-2 text-xs border border-amber-200">
                    <Clock size={16} className="shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-black uppercase tracking-tight text-[10px]">Funcionamento Pausado</p>
                      <p className="text-[10px] opacity-90 leading-tight mt-0.5">{businessStatus.message}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 space-y-3 bg-neutral-50/50">
                {loading && entregasAtivas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-neutral-400 gap-2">
                    <Loader2 className="animate-spin text-orange-500" />
                    <p className="text-[10px] uppercase font-black tracking-widest">Atualizando...</p>
                  </div>
                ) : entregasAtivas.length === 0 ? (
                  <div className="text-center py-10 px-6 bg-white rounded-3xl border border-neutral-100 shadow-sm">
                    <Package className="h-6 w-6 text-neutral-350 mx-auto mb-2" />
                    <p className="font-bold text-neutral-700 text-xs italic">Sem entregas ativas para hoje</p>
                  </div>
                ) : (
                  entregasAtivas.map(entrega => (
                    <div 
                      key={entrega.id} 
                      onClick={() => setSelectedEntrega(entrega)}
                      className="bg-white p-3.5 rounded-3xl border border-neutral-100 shadow-sm active:scale-[0.98] transition-transform space-y-3 cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="bg-neutral-900 text-white text-[9px] font-black px-2 py-0.5 rounded-md uppercase">#{entrega.numero}</span>
                          <span className="text-[10px] text-neutral-400 font-bold ml-2">{new Date(entrega.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${getStatusColor(entrega.status)}`}>
                          {getStatusLabel(entrega.status)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-bold text-neutral-800 leading-tight flex items-start gap-1">
                          <MapPin size={12} className="text-neutral-400 mt-0.5 shrink-0" />
                          <span>{entrega.endereco_entrega}</span>
                        </p>
                        <hr className="border-neutral-100" />
                        <div className="flex justify-between items-center text-xs">
                          <p className="font-extrabold text-neutral-600 flex items-center gap-1">
                            <UserCircle size={14} className="text-neutral-400" />
                            {entrega.cliente_nome || 'Cliente'}
                          </p>
                          <p className="font-black text-orange-600">R$ {entrega.valor?.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* MAPA TELA CHEIA (AO CLICAR) COM VOLTAR */
            <div className="absolute inset-x-0 top-0 bottom-0 z-40 bg-neutral-100 flex flex-col h-[calc(100vh-64px)]">
              {/* Header de Controle */}
              <div className="absolute top-4 inset-x-4 z-[400] flex justify-between items-center pointer-events-none">
                <button 
                  onClick={() => { setSelectedEntrega(null); setIsEditingPedido(false); }}
                  className="pointer-events-auto flex items-center gap-1.5 px-4 py-2.5 bg-neutral-900 text-white rounded-full text-[10px] font-black uppercase tracking-wide shadow-xl active:scale-95"
                >
                  <ChevronRight size={14} className="rotate-180" /> Voltar para a Lista
                </button>
                <div className={`pointer-events-auto px-3.5 py-2.5 rounded-full text-[9px] font-black uppercase shadow-lg ${getStatusColor(selectedEntrega.status)}`}>
                  {getStatusLabel(selectedEntrega.status)}
                </div>
              </div>

              {/* Leaflet Map Frame */}
              <div className="flex-1 w-full relative z-10 bg-neutral-200">
                {restaurante.latitude && restaurante.longitude ? (
                  <>
                    <MapContainer 
                      center={selectedEntrega.latitude_entrega && selectedEntrega.longitude_entrega 
                        ? [selectedEntrega.latitude_entrega, selectedEntrega.longitude_entrega]
                        : [restaurante.latitude, restaurante.longitude]} 
                      zoom={14} 
                      className="w-full h-full"
                      zoomControl={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <Marker position={[restaurante.latitude, restaurante.longitude]} icon={restauranteIcon}>
                        <Popup><p className="font-black text-xs">Sua Loja</p></Popup>
                      </Marker>
                      {selectedEntrega.latitude_entrega && selectedEntrega.longitude_entrega && (
                        <Marker position={[selectedEntrega.latitude_entrega, selectedEntrega.longitude_entrega]} icon={deliveryIcon}>
                          <Popup><p className="font-extrabold text-xs">Destino Pedido</p></Popup>
                        </Marker>
                      )}
                      {['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(selectedEntrega.status) && motoboyLocation && (
                        <>
                          <Marker position={[motoboyLocation.lat, motoboyLocation.lng]} icon={motoboyIcon}>
                            <Popup>
                              <div className="p-1 text-xs space-y-1">
                                <p className="font-black text-neutral-800">Motoboy</p>
                                {(() => {
                                  const timeInfo = formatLocationTime(motoboyLocation.ultima_localizacao_em);
                                  return (
                                    <p className={`text-[10px] font-bold ${timeInfo.isOutdated ? 'text-red-600' : 'text-emerald-600'}`}>
                                      {timeInfo.isOutdated ? '⚠️ Localização desatualizada' : timeInfo.text}
                                    </p>
                                  );
                                })()}
                              </div>
                            </Popup>
                          </Marker>
                          <MapUpdater center={[motoboyLocation.lat, motoboyLocation.lng]} />
                        </>
                      )}
                    </MapContainer>
                    {['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(selectedEntrega.status) && motoboyLocation && (
                      <div className="absolute top-3 left-3 z-[400] bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md border border-neutral-100 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${formatLocationTime(motoboyLocation.ultima_localizacao_em).isOutdated ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                        <span className={`text-[11px] font-bold ${formatLocationTime(motoboyLocation.ultima_localizacao_em).isOutdated ? 'text-red-600' : 'text-neutral-800'}`}>
                          {formatLocationTime(motoboyLocation.ultima_localizacao_em).text}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-8 text-neutral-450 font-bold uppercase text-[10px]">Sem GPS Loja</div>
                )}
              </div>

              {/* Painel do Pedido Flutuante no final */}
              <div className="bg-white rounded-t-[36px] border-t border-neutral-100 shadow-2xl relative z-40 max-h-[42vh] flex flex-col shrink-0 pb-6 overflow-hidden">
                <div className="px-5 py-4 border-b border-neutral-50 flex justify-between items-center shrink-0">
                  <div>
                    <h3 className="font-black text-neutral-900 text-sm">Pedido #{selectedEntrega.numero}</h3>
                    <p className="text-[8px] text-neutral-400 font-extrabold uppercase mt-0.5">{selectedEntrega.endereco_entrega}</p>
                  </div>
                  <div className="flex gap-2">
                    {empresa?.permitir_chat_entrega && ['aceita', 'coletada', 'em_rota'].includes(selectedEntrega.status) && (
                      <button onClick={() => setIsChatOpen(true)} className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center"><MessageSquare size={16} /></button>
                    )}
                    {podeEditarPedido && !['entregue', 'cancelada'].includes(selectedEntrega.status) && !isEditingPedido && (
                      <button onClick={() => handleEditPedido(selectedEntrega)} className="w-10 h-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center"><Pencil size={15} /></button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {isEditingPedido ? (
                    <div className="space-y-4">
                      {/* Campo Novo Pedido Formulário Compacto */}
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-neutral-450 uppercase">Número do Pedido</label>
                        <input type="text" value={pedidoEditForm.numero} onChange={e => setPedidoEditForm({...pedidoEditForm, numero: e.target.value})} className="w-full h-11 px-4 bg-neutral-50 border border-neutral-100 rounded-xl font-bold text-xs" />
                      </div>

                      {/* Opção Pedido iFood */}
                      <div className="p-3 bg-neutral-50 border border-neutral-100 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-neutral-800">Pedido iFood?</span>
                            <p className="text-[9px] text-neutral-500 font-medium">Veio do iFood?</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={pedidoEditForm.is_ifood}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setPedidoEditForm(p => ({
                                  ...p,
                                  is_ifood: checked,
                                  ifood_localizador: checked ? p.ifood_localizador : ''
                                }));
                              }}
                            />
                            <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                          </label>
                        </div>

                        {pedidoEditForm.is_ifood && (
                          <div className="space-y-1 pt-1 animate-in fade-in duration-200">
                            <label className="text-[8px] font-black text-neutral-450 uppercase">
                              Localizador do pedido iFood *
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="80083230"
                              value={pedidoEditForm.ifood_localizador}
                              onChange={(e) => setPedidoEditForm(p => ({ ...p, ifood_localizador: e.target.value.replace(/\D/g, '') }))}
                              className="w-full h-9 px-3 bg-white border border-neutral-200 rounded-lg font-mono text-xs font-bold text-neutral-900"
                            />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black text-neutral-450 uppercase">Endereço de Entrega</label>
                        <AddressAutocomplete 
                          value={pedidoEditForm.endereco_entrega}
                          onChange={(addr, lat, lng) => setPedidoEditForm(p => ({ ...p, endereco_entrega: addr, latitude_entrega: lat || null, longitude_entrega: lng || null }))}
                          className="!h-11 !rounded-xl !text-xs"
                          locationBias={restaurante.latitude && restaurante.longitude ? { lat: restaurante.latitude, lng: restaurante.longitude } : undefined}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 pb-2">
                        <button onClick={() => setIsEditingPedido(false)} className="h-10 bg-neutral-100 font-black rounded-xl text-[10px] uppercase">Cancelar</button>
                        <button onClick={handleSavePedidoEdit} disabled={isSaving} className="h-10 bg-orange-500 text-white font-black rounded-xl text-[10px] uppercase hover:bg-orange-600">Salvar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="bg-neutral-50 p-3 rounded-2xl">
                          <p className="text-[8px] text-neutral-400 font-black uppercase">Cliente</p>
                          <p className="font-extrabold text-[11px] truncate mt-0.5">{selectedEntrega.cliente_nome || 'N/A'}</p>
                          <p className="text-[10px] text-neutral-500 font-medium">{selectedEntrega.cliente_telefone || 'Sem telefone'}</p>
                        </div>
                        <div className="bg-neutral-50 p-3 rounded-2xl">
                          <p className="text-[8px] text-neutral-400 font-black uppercase font-sans">Valor</p>
                          <p className="font-black text-orange-600 text-xs mt-0.5">R$ {(selectedEntrega.valor_pedido || selectedEntrega.valor || 0).toFixed(2)}</p>
                          <p className="text-[8px] text-neutral-400 font-bold uppercase">{selectedEntrega.forma_pagamento || 'PIX'}</p>
                        </div>
                      </div>

                      {/* Caixa Financeira */}
                      {(() => {
                        const liveValorPedido = financeSelectedState && financeSelectedState.id === selectedEntrega.id ? financeSelectedState.valor_pedido : (selectedEntrega.valor_pedido || selectedEntrega.valor || 0);
                        const liveTotalPagbank = financeSelectedState && financeSelectedState.id === selectedEntrega.id ? financeSelectedState.total_pagbank : getPagbankTotalForEntrega(selectedEntrega.id);
                        const liveValorPagoDinheiro = financeSelectedState && financeSelectedState.id === selectedEntrega.id ? financeSelectedState.valor_pago_dinheiro : (selectedEntrega.valor_pago_dinheiro || 0);
                        const liveSaldo = financeSelectedState && financeSelectedState.id === selectedEntrega.id ? financeSelectedState.saldo_restante : Math.max(0, liveValorPedido - liveTotalPagbank - liveValorPagoDinheiro);
                        return (
                          <div className="bg-neutral-50 p-3.5 rounded-2xl border border-neutral-100 text-[10px] space-y-1.5 font-bold">
                            <div className="flex justify-between">
                              <span className="text-neutral-400 uppercase">Total:</span>
                              <span className="text-neutral-900 font-extrabold">R$ {liveValorPedido.toFixed(2)}</span>
                            </div>
                            {liveValorPagoDinheiro > 0 && <div className="flex justify-between">
                              <span className="text-neutral-400 uppercase">Dinheiro:</span>
                              <span className="text-emerald-600 font-extrabold">R$ {liveValorPagoDinheiro.toFixed(2)}</span>
                            </div>}
                            {liveTotalPagbank > 0 && <div className="flex justify-between">
                              <span className="text-neutral-400 uppercase">Cartão:</span>
                              <span className="text-indigo-600 font-extrabold">R$ {liveTotalPagbank.toFixed(2)}</span>
                            </div>}
                            {liveSaldo > 0 && <div className="flex justify-between border-t border-dashed border-neutral-200 pt-1">
                              <span className="text-neutral-700 uppercase font-black">Saldo Restante:</span>
                              <span className="text-rose-600 font-black">R$ {liveSaldo.toFixed(2)}</span>
                            </div>}
                          </div>
                        );
                      })()}

                      {selectedEntrega.motoboy && (
                        <div className="bg-neutral-50 p-3.5 rounded-2xl flex items-center gap-3">
                          <Bike size={18} className="text-neutral-400 shrink-0" />
                          <div>
                            <p className="text-[8px] text-neutral-400 font-black uppercase">Motoboy Escolhido</p>
                            <p className="font-extrabold text-[11px] mt-0.5">{selectedEntrega.motoboy.nome}</p>
                            {selectedEntrega.motoboy.telefone && (
                              <a href={`tel:${selectedEntrega.motoboy.telefone}`} className="font-black text-[9px] text-orange-500 flex items-center gap-1 mt-0.5 hover:underline">
                                <Phone size={8} /> {selectedEntrega.motoboy.telefone}
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2 pt-2 select-none">
                        {selectedEntrega.status === 'aguardando_despacho' && (
                          <button
                            onClick={() => handleChamarMotoboy(selectedEntrega.id)}
                            className="w-full h-11 bg-orange-500 hover:bg-orange-600 text-white font-black rounded-xl uppercase text-[10px] tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
                          >
                            <Bike className="h-4.5 w-4.5" /> Chamar Motoboy
                          </button>
                        )}
                        {getCanCancel(selectedEntrega) && (
                          <button
                            onClick={() => handleCancelPedido(selectedEntrega.id)}
                            className="w-full h-10 bg-red-50 text-red-600 font-black rounded-xl uppercase text-[9px] tracking-wider flex items-center justify-center gap-1.5 border border-red-100 active:scale-95"
                          >
                            <XCircle size={12} /> Cancelar Pedido
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : view === 'historico' ? (
        /* HISTÓRICO VIEW COMPACTA */
        <main className="p-4 space-y-4 flex-1">
          <div className="p-4 bg-white rounded-3xl border border-neutral-100 shadow-sm space-y-3">
            <h2 className="font-black text-sm uppercase tracking-tight text-neutral-900">Histórico de Pedidos</h2>
            
            <div className="flex gap-2 flex-wrap">
              {['hoje', 'ontem', 'semana', 'mes'].map((p) => (
                <button 
                  key={p} 
                  onClick={() => setFilters({ ...filters, periodo: p })}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-colors ${filters.periodo === p ? 'bg-orange-50 border-orange-500 text-orange-600' : 'bg-neutral-50 border-neutral-100 text-neutral-400'}`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={handleExportExcel} className="flex-1 h-10 bg-emerald-50 border border-emerald-100 text-emerald-600 font-black rounded-xl text-[10px] uppercase flex items-center justify-center gap-1">
                <Download size={12} /> Planilha Excel
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {historicoEntregas.length === 0 ? (
              <p className="text-center py-10 text-neutral-400 text-xs font-bold uppercase italic">Nenhum pedido finalizado resolvido</p>
            ) : (
              historicoEntregas.map(e => (
                <div 
                  key={e.id}
                  onClick={() => setSelectedEntrega(e)}
                  className="bg-white p-3.5 rounded-2xl border border-neutral-100 shadow-sm flex justify-between items-center"
                >
                  <div>
                    <span className="text-[10px] font-black text-neutral-800">Pedido #{e.numero}</span>
                    <p className="text-[9px] text-neutral-400 font-bold mt-0.5">{new Date(e.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-xs text-orange-600 font-mono">R$ {e.valor?.toFixed(2)}</span>
                    <p className={`text-[8px] font-black uppercase mt-1 ${e.status === 'entregue' ? 'text-green-600 bg-green-50 px-1 py-0.5 rounded' : 'text-red-600 bg-red-50 px-1 py-0.5 rounded'}`}>
                      {getStatusLabel(e.status)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      ) : view === 'integracoes' ? (
        <main className="p-4 space-y-4 flex-1">
          <div>
            <h2 className="text-lg font-black text-neutral-900">Integrações</h2>
            <p className="text-xs text-neutral-500 mt-1">Conecte serviços externos ao seu restaurante.</p>
          </div>
          <div className="p-5 bg-white rounded-3xl border border-neutral-100 shadow-sm flex items-start gap-3">
            <div className="h-11 w-11 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0"><Link2 size={22} /></div>
            <div>
              <h3 className="font-black text-sm text-neutral-900">MenuJunior</h3>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">Envie automaticamente os pedidos do MenuJunior para a fila de entregas deste restaurante.</p>
              <button type="button" onClick={async () => {
                if (!restaurante?.id) return alert('Restaurante não identificado.');
                const { data, error } = await supabase.functions.invoke('menujunior-connect-preview', { body: { action: 'start', restaurante_id: restaurante.id } });
                if (error || !data?.authorization_url) return alert(data?.error || error?.message || 'Não foi possível iniciar a conexão.');
                window.location.assign(data.authorization_url);
              }} className="inline-flex mt-4 items-center gap-2 rounded-xl bg-neutral-900 px-4 py-3 text-xs font-bold text-white">
                <Link2 size={15} /> Conectar MenuJunior
              </button>
            </div>
          </div>
        </main>
      ) : (
        /* CONFIGURAÇÕES VIEW COMPACTA */
        <main className="p-4 space-y-4 flex-1">
          <div className="p-5 bg-white rounded-3xl border border-neutral-100 shadow-sm space-y-4">
            <h2 className="font-black text-sm uppercase tracking-tight text-neutral-900">Configurações do Restaurante</h2>
            
            <div className="space-y-1">
              <label className="text-[8px] font-black text-neutral-450 uppercase">Nome Comercial</label>
              <input type="text" value={editData.nome} onChange={e => setEditData({...editData, nome: e.target.value})} className="w-full h-11 px-4 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-extrabold" />
            </div>

            <div className="space-y-1">
              <label className="text-[8px] font-black text-neutral-450 uppercase">Telefone de Contato</label>
              <input type="text" value={editData.telefone} onChange={e => setEditData({...editData, telefone: e.target.value})} className="w-full h-11 px-4 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-extrabold" />
            </div>

            {configDistribuicao?.pagbank_ativo && (
              <div className="pt-2 border-t border-neutral-100 space-y-3">
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Informações de Repasse (Conta Pix)</p>
                
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-neutral-450 uppercase">Nome Completo do Titular</label>
                  <input type="text" value={editData.pix_nome_completo} onChange={e => setEditData({...editData, pix_nome_completo: e.target.value})} placeholder="Nome do titular" className="w-full h-11 px-4 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-extrabold" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-neutral-450 uppercase">CPF do Titular</label>
                    <input type="text" value={editData.pix_cpf} onChange={e => setEditData({...editData, pix_cpf: e.target.value})} placeholder="000.000.000-00" className="w-full h-11 px-4 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-extrabold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-neutral-450 uppercase">Chave Pix</label>
                    <input type="text" value={editData.pix_chave} onChange={e => setEditData({...editData, pix_chave: e.target.value})} placeholder="Chave Pix" className="w-full h-11 px-4 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-extrabold" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-neutral-450 uppercase">Conta PagBank</label>
                    <input type="text" value={editData.pagbank_conta} onChange={e => setEditData({...editData, pagbank_conta: e.target.value})} placeholder="Número da conta" className="w-full h-11 px-4 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-extrabold" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-neutral-450 uppercase">Dígito da conta</label>
                    <input type="text" value={editData.pagbank_digito} onChange={e => setEditData({...editData, pagbank_digito: e.target.value})} placeholder="Dígito" className="w-full h-11 px-4 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-extrabold" />
                  </div>
                </div>
              </div>
            )}

            {/* Alternar Alertas Sonoros para Celular */}
            <div className="pt-3 border-t border-neutral-100/85">
              <div className="flex items-center justify-between gap-3 p-3 bg-neutral-50 border border-neutral-100 rounded-2xl">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${canPlayAudio ? 'bg-orange-100 text-orange-600' : 'bg-neutral-200 text-neutral-400'}`}>
                    {canPlayAudio ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  </div>
                  <div>
                    <p className="font-extrabold text-neutral-800 text-[11px]">Alertas Sonoros</p>
                    <p className="text-[9px] text-neutral-450 font-bold leading-normal">
                      {canPlayAudio ? 'Som ativado para mensagens' : 'Silenciado'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleAlertasSonoros}
                  type="button"
                  className={`w-11 h-6.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none shrink-0 ${canPlayAudio ? 'bg-orange-500' : 'bg-neutral-300'}`}
                >
                  <div className={`bg-white w-5.5 h-5.5 rounded-full shadow-sm transform transition-transform duration-200 ${canPlayAudio ? 'translate-x-4.5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <button onClick={handleSaveProfile} disabled={isSaving} className="w-full h-12 bg-neutral-900 text-white font-black rounded-xl text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 mt-2 transition-transform active:scale-95 shadow-lg">
              {isSaving ? <Loader2 className="animate-spin text-white" size={14} /> : <Save size={13} />} Solicitar Alteração Perfil
            </button>
          </div>
        </main>
      )}



      {view === 'repasses' && isPagbankAtivo && (
        <main className="p-4 space-y-4">
          <MeusRepassesRestaurante restaurante={restaurante} />
        </main>
      )}

      {/* Navegador flutuante inferior do celular */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-neutral-100 px-4 py-3 flex justify-around items-center z-50 shadow-lg select-none">
        <button onClick={() => { setView('entregas'); setSelectedEntrega(null); }} className={`flex flex-col items-center gap-1 transition-all ${view === 'entregas' ? 'text-orange-500 scale-105 font-black' : 'text-neutral-300 font-semibold'}`}>
          <Package className="h-5 w-5" />
          <span className="text-[8px] uppercase">Ativas</span>
        </button>
        <button onClick={() => { setView('historico'); setSelectedEntrega(null); }} className={`flex flex-col items-center gap-1 transition-all ${view === 'historico' ? 'text-orange-500 scale-105 font-black' : 'text-neutral-300 font-semibold'}`}>
          <History className="h-5 w-5" />
          <span className="text-[8px] uppercase">Histórico</span>
        </button>
        {isPagbankAtivo && (
          <button onClick={() => { setView('repasses'); setSelectedEntrega(null); }} className={`flex flex-col items-center gap-1 transition-all ${view === 'repasses' ? 'text-orange-500 scale-105 font-black' : 'text-neutral-300 font-semibold'}`}>
            <Receipt className="h-5 w-5" />
            <span className="text-[8px] uppercase">Repasses</span>
          </button>
        )}
        <button onClick={() => { setView('integracoes'); setSelectedEntrega(null); }} className={`flex flex-col items-center gap-1 transition-all ${view === 'integracoes' ? 'text-orange-500 scale-105 font-black' : 'text-neutral-300 font-semibold'}`}>
          <Link2 className="h-5 w-5" />
          <span className="text-[8px] uppercase">Integrações</span>
        </button>
        <button onClick={() => { setView('configuracoes'); setSelectedEntrega(null); }} className={`flex flex-col items-center gap-1 transition-all ${view === 'configuracoes' ? 'text-orange-500 scale-105 font-black' : 'text-neutral-300 font-semibold'}`}>
          <Settings className="h-5 w-5" />
          <span className="text-[8px] uppercase">Ajustes</span>
        </button>
      </footer>

      {/* Menu Lateral Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-md"
            />
            <motion.div 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-white z-[210] shadow-2xl p-6 flex flex-col select-none"
            >
              {/* TOP HEADER: GESTORA COMPANY IDENTITY */}
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-100">
                <div className="flex items-center gap-3 min-w-0">
                  {(empresa?.logo_url || empresa?.foto_url || empresa?.logo) ? (
                    <img 
                      src={empresa.logo_url || empresa.foto_url || empresa.logo} 
                      className="w-10 h-10 rounded-xl object-cover border border-neutral-200/80 shadow-xs shrink-0" 
                      alt={empresa?.nome || 'Empresa Gestora'} 
                    />
                  ) : (
                    <div className="w-10 h-10 bg-orange-600 text-white font-black text-lg rounded-xl flex items-center justify-center shadow-xs shrink-0">
                      {empresa?.nome ? empresa.nome.charAt(0).toUpperCase() : <Building2 size={22} />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-neutral-900 uppercase tracking-tight truncate">
                      {empresa?.nome || 'EMPRESA GESTORA'}
                    </h2>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      Gestão de Entregas
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setIsMenuOpen(false)} 
                  className="p-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-neutral-500 transition-colors shrink-0"
                  title="Fechar menu"
                >
                  <X size={18} />
                </button>
              </div>

              {/* MENU ITEMS */}
              <div className="flex-1 space-y-1.5">
                <button 
                  onClick={() => { setView('entregas'); setIsMenuOpen(false); }} 
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-black transition-all uppercase text-xs tracking-wider ${view === 'entregas' ? 'bg-orange-50 text-orange-600 shadow-xs' : 'text-neutral-600 hover:bg-neutral-50'}`}
                >
                  <Package size={18} /> Entregas Ativas
                </button>
                <button 
                  onClick={() => { setView('historico'); setIsMenuOpen(false); }} 
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-black transition-all uppercase text-xs tracking-wider ${view === 'historico' ? 'bg-orange-50 text-orange-600 shadow-xs' : 'text-neutral-600 hover:bg-neutral-50'}`}
                >
                  <History size={18} /> Histórico/Relatórios
                </button>
                {isPagbankAtivo && (
                  <button 
                    onClick={() => { setView('repasses'); setIsMenuOpen(false); }} 
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-black transition-all uppercase text-xs tracking-wider ${view === 'repasses' ? 'bg-orange-50 text-orange-600 shadow-xs' : 'text-neutral-600 hover:bg-neutral-50'}`}
                  >
                    <Receipt size={18} /> Meus Repasses
                  </button>
                )}
                <button
                  onClick={() => { setView('integracoes'); setIsMenuOpen(false); setSelectedEntrega(null); }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-black transition-all uppercase text-xs tracking-wider ${view === 'integracoes' ? 'bg-orange-50 text-orange-600 shadow-xs' : 'text-neutral-600 hover:bg-neutral-50'}`}
                >
                  <Link2 size={18} /> Integrações
                </button>
                <button 
                  onClick={() => { setView('configuracoes'); setIsMenuOpen(false); }} 
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-black transition-all uppercase text-xs tracking-wider ${view === 'configuracoes' ? 'bg-orange-50 text-orange-600 shadow-xs' : 'text-neutral-600 hover:bg-neutral-50'}`}
                >
                  <Settings size={18} /> Configurações
                </button>
                
                <div className="py-4"><hr className="border-neutral-100" /></div>
                
                <button 
                  onClick={() => signOut()} 
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl font-black text-red-600 uppercase text-xs tracking-wider bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <LogOut size={18} /> Encerrar Sessão
                </button>
              </div>

              {/* BOTTOM FOOTER: LOGGED-IN RESTAURANT IDENTITY */}
              <div className="mt-auto pt-4 border-t border-neutral-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden shrink-0 flex items-center justify-center">
                  {restaurante.foto_url ? (
                    <img src={restaurante.foto_url} className="w-full h-full object-cover" alt={restaurante.nome} />
                  ) : (
                    <span className="font-black text-xs text-neutral-600">
                      {restaurante.nome ? restaurante.nome.charAt(0).toUpperCase() : 'R'}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-black text-xs text-neutral-900 truncate uppercase leading-tight">{restaurante.nome}</p>
                  <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest leading-tight mt-0.5">Painel v1.0.4</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Detalhes de Histórico no Fundo (Slide modal padrão para visualização limpa) */}
      <AnimatePresence>
        {selectedEntrega && view !== 'entregas' && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedEntrega(null)} className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-xs" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25 }} className="fixed bottom-0 inset-x-0 bg-white z-[110] rounded-t-[36px] max-h-[85vh] overflow-y-auto p-6 flex flex-col pb-12 select-none">
              <div className="flex justify-between items-center mb-4 shrink-0">
                <div>
                  <h4 className="font-extrabold text-neutral-900 text-sm">Pedido #{selectedEntrega.numero}</h4>
                  <p className="text-[8px] text-neutral-400 font-bold uppercase">{selectedEntrega.endereco_entrega}</p>
                </div>
                <button onClick={() => setSelectedEntrega(null)} className="p-2 bg-neutral-100 text-neutral-400 rounded-full"><X size={16} /></button>
              </div>

              <div className="space-y-4">
                <div className="bg-neutral-50 p-4 rounded-2xl flex justify-between items-center text-xs">
                  <div>
                    <p className="text-[8px] text-neutral-400 font-extrabold uppercase">Cliente</p>
                    <p className="font-black text-neutral-800">{selectedEntrega.cliente_nome || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[8px] text-neutral-400 font-extrabold uppercase">Valor</p>
                    <p className="font-black text-orange-600">R$ {selectedEntrega.valor?.toFixed(2)}</p>
                  </div>
                </div>

                <div className="p-4 bg-neutral-50 rounded-2xl text-[10px] space-y-1 font-bold">
                  <div className="flex justify-between">
                    <span className="text-neutral-400 font-black uppercase">Pagamento:</span>
                    <span className="text-neutral-900">{selectedEntrega.forma_pagamento || 'PIX'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400 font-black uppercase">Acerto:</span>
                    <span className={selectedEntrega.acertada ? 'text-green-600 font-extrabold' : 'text-amber-600 font-extrabold'}>{selectedEntrega.acertada ? 'SIM, RECONCILIADO' : 'NÃO RECONCILIADO'}</span>
                  </div>
                  {selectedEntrega.entregue_em && <div className="flex justify-between">
                    <span className="text-neutral-400 font-black uppercase">Entregue em:</span>
                    <span>{new Date(selectedEntrega.entregue_em).toLocaleString()}</span>
                  </div>}
                </div>

                {selectedEntrega.status === 'entregue' && !selectedEntrega.acertada && (
                  <button onClick={() => handleToggleAcerto(selectedEntrega)} className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] uppercase rounded-xl tracking-wider shadow-md">
                    Marcar como Acertado
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <NovoPedidoModal isOpen={isNovoPedidoOpen} onClose={() => setIsNovoPedidoOpen(false)} restaurante={restaurante} empresa={empresa} configDistribuicao={configDistribuicao} onSuccess={() => { fetchEntregas(); setView('entregas'); }} />
      <audio ref={chatAudioRef} src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3" preload="auto" />

      <AnimatePresence>
        {chatNotification?.show && (
          <div className="fixed top-18 inset-x-4 z-[500] bg-indigo-600 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase truncate">{chatNotification.message}</span>
            <button 
              onClick={() => {
                const ent = entregasAtivas.find(e => e.id === chatNotification.entregaId);
                if (ent) { setSelectedEntrega(ent); setIsChatOpen(true); }
                setChatNotification(null);
              }}
              className="bg-white text-indigo-600 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase shrink-0"
            >
              Abrir
            </button>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isChatOpen && selectedEntrega && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsChatOpen(false)} className="fixed inset-0 bg-black/50 z-[9998] backdrop-blur-xs" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="fixed inset-x-0 bottom-0 top-12 z-[9999] bg-white rounded-t-[32px] overflow-hidden flex flex-col shadow-2xl">
              <ChatEntrega entrega={selectedEntrega} remetenteTipo="restaurante" remetenteNome={restaurante?.nome || 'Restaurante'} onClose={() => setIsChatOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSelecaoMotoboyOpen && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSelecaoMotoboyOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-xs" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[75vh]">
              <div className="p-5 bg-orange-500 text-white flex justify-between items-center">
                <div>
                  <h4 className="font-black text-base uppercase tracking-tight">Motoboys Disponíveis</h4>
                  <p className="text-[9px] uppercase font-bold opacity-85">Selecione para despachar</p>
                </div>
                <button onClick={() => setIsSelecaoMotoboyOpen(false)} className="p-1.5 bg-white/15 rounded-lg"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loadingMotoboys ? (
                  <p className="text-center py-8 text-neutral-400 text-xs font-bold uppercase animate-pulse">Buscando...</p>
                ) : onlineMotoboys.length === 0 ? (
                  <p className="text-center py-8 text-neutral-400 text-xs font-bold uppercase italic">Nenhum motoboy online</p>
                ) : (
                  onlineMotoboys.map(m => (
                    <button key={m.id} onClick={() => handleSelectMotoboyManual(m.id)} className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white border border-neutral-100 hover:bg-orange-50 text-left transition-colors">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-100 shrink-0 border border-neutral-150">
                        {m.foto_url ? <img src={m.foto_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-orange-500 bg-orange-50"><User size={20} /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-neutral-800 text-xs truncate">{m.nome}</p>
                        <p className="text-[9px] text-neutral-400 font-bold uppercase">{m.telefone || 'Sem telefone'}</p>
                      </div>
                      <ChevronRight size={16} className="text-neutral-300" />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ChamarMotoboyModal
        isOpen={isChamarMotoboyModalOpen}
        onClose={() => {
          setIsChamarMotoboyModalOpen(false);
          setEntregaParaChamarMotoboy(null);
        }}
        entregaId={entregaParaChamarMotoboy}
        numeroEntrega={entregasAtivas.find(e => e.id === entregaParaChamarMotoboy)?.numero}
        restaurante={restaurante}
        empresa={empresa}
        configDistribuicao={configDistribuicao}
        onSuccess={() => {
          fetchEntregas();
        }}
        onOpenManualSelection={(entregaId) => {
          setEntregaParaDespacho(entregaId);
          setIsSelecaoMotoboyOpen(true);
          carregarMotoboysOnline();
        }}
      />

      <InstallPWA />
    </div>
  );
}
