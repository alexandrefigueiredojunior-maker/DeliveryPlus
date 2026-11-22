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
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AddressAutocomplete from '../components/common/AddressAutocomplete';
import { ChamarMotoboyModal } from '../components/restaurante/ChamarMotoboyModal';
import { despacharEntregaExistente } from '../utils/despachoUtils';

// Fix for Leaflet default icon issues in React
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom icons
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

function MapAutoCenter({ 
  restaurante, 
  entregasAtivas, 
  motoboyLocations,
  mostrarMapaMotoboysSemEntrega,
  mapMotoboys
}: { 
  restaurante: any; 
  entregasAtivas: any[]; 
  motoboyLocations: any[];
  mostrarMapaMotoboysSemEntrega?: boolean;
  mapMotoboys?: any[];
}) {
  const map = useMap();

  useEffect(() => {
    const allPoints: [number, number][] = [];

    // 1. Restaurante
    if (restaurante?.latitude && restaurante?.longitude) {
      const rLat = Number(restaurante.latitude);
      const rLng = Number(restaurante.longitude);
      if (!isNaN(rLat) && !isNaN(rLng) && rLat !== 0 && rLng !== 0) {
        allPoints.push([rLat, rLng]);
      }
    }

    // 2. Clientes das entregas ativas (aceita, coletada, em_rota, pagamento_errado)
    const activeDeliveries = entregasAtivas.filter(e => 
      ['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(e.status) &&
      e.latitude_entrega && e.longitude_entrega
    );

    activeDeliveries.forEach(del => {
      const dLat = Number(del.latitude_entrega);
      const dLng = Number(del.longitude_entrega);
      if (!isNaN(dLat) && !isNaN(dLng) && dLat !== 0 && dLng !== 0) {
        allPoints.push([dLat, dLng]);
      }
    });

    // 3. Motoboys
    if (mostrarMapaMotoboysSemEntrega) {
      const onlineIds = new Set((mapMotoboys || []).map((m: any) => m.id));
      motoboyLocations.forEach(mLoc => {
        const isOnline = onlineIds.has(mLoc.motoboy_id);
        const hasActiveDelivery = activeDeliveries.some(e => e.motoboy_id === mLoc.motoboy_id);
        if (isOnline || hasActiveDelivery) {
          const mLat = Number(mLoc.latitude);
          const mLng = Number(mLoc.longitude);
          if (!isNaN(mLat) && !isNaN(mLng) && mLat !== 0 && mLng !== 0) {
            allPoints.push([mLat, mLng]);
          }
        }
      });
    } else {
      activeDeliveries.forEach(del => {
        if (['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(del.status) && del.motoboy_id) {
          const mLoc = motoboyLocations.find(l => l.motoboy_id === del.motoboy_id);
          if (mLoc) {
            const mLat = Number(mLoc.latitude);
            const mLng = Number(mLoc.longitude);
            if (!isNaN(mLat) && !isNaN(mLng) && mLat !== 0 && mLng !== 0) {
              allPoints.push([mLat, mLng]);
            }
          }
        }
      });
    }

    if (allPoints.length > 0) {
      try {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      } catch (err) {
        console.error('Error fitting bounds in RestauranteApp map:', err);
      }
    }
  }, [restaurante, entregasAtivas, motoboyLocations, mostrarMapaMotoboysSemEntrega, mapMotoboys, map]);

  return null;
}

const getPeriodDates = (period: string, customStart?: string, customEnd?: string) => {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  if (period === 'hoje') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'ontem') {
    start.setDate(now.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(now.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'semana') {
    const day = now.getDay(); // 0 is Sunday
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'mes') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'personalizado') {
    if (customStart) {
      const parts = customStart.split('-');
      if (parts.length === 3) {
        start.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    }

    if (customEnd) {
      const parts = customEnd.split('-');
      if (parts.length === 3) {
        end.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
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
  
  const isToday = date.getDate() === now.getDate() &&
                  date.getMonth() === now.getMonth() &&
                  date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  if (isToday) {
    return timeStr;
  } else {
    const dayStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${dayStr} às ${timeStr}`;
  }
};

export default function RestauranteApp() {
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
        console.error("Erro ao desbloquear áudio:", err);
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
  const [mapMotoboys, setMapMotoboys] = useState<any[]>([]);
  const [motoboyLocations, setMotoboyLocations] = useState<any[]>([]);
  const [loadingMotoboys, setLoadingMotoboys] = useState(false);
  const [entregaParaDespacho, setEntregaParaDespacho] = useState<string | null>(null);
  const [isChamarMotoboyModalOpen, setIsChamarMotoboyModalOpen] = useState(false);
  const [entregaParaChamarMotoboy, setEntregaParaChamarMotoboy] = useState<string | null>(null);

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

  // Sincronização em tempo real focada nos detalhes do pedido aberto
  useEffect(() => {
    if (selectedEntrega?.id) {
      const currentId = selectedEntrega.id;
      fetchHistory(currentId);
      carregarValoresFinais(currentId);

      const channel = supabase
        .channel(`detalhes_entrega_${currentId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'historico_status_entregas',
          filter: `entrega_id=eq.${currentId}`
        }, () => {
          fetchHistory(currentId);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'entregas',
          filter: `id=eq.${currentId}`
        }, () => {
          carregarValoresFinais(currentId);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pagamentos_pagbank',
          filter: `entrega_id=eq.${currentId}`
        }, () => {
          carregarValoresFinais(currentId);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setHistoricoStatus([]);
      setFinanceSelectedState(null);
    }
  }, [selectedEntrega?.id]);

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

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Autocalcular valor na edição
  useEffect(() => {
    if (!isEditingPedido || !empresa || !restaurante) return;

    let novoValor = 0;
    let dist = 0;

    if (empresa.modelo_cobranca_entrega === 'fixo') {
      novoValor = empresa.valor_fixo_entrega || 0;
    } else if (empresa.modelo_cobranca_entrega === 'km') {
      if (restaurante.latitude && restaurante.longitude && pedidoEditForm.latitude_entrega && pedidoEditForm.longitude_entrega) {
        dist = calculateDistance(
          Number(restaurante.latitude),
          Number(restaurante.longitude),
          pedidoEditForm.latitude_entrega,
          pedidoEditForm.longitude_entrega
        );
        
        novoValor = dist * (empresa.valor_por_km || 0);
        if (novoValor < (empresa.valor_minimo_entrega || 0)) {
          novoValor = empresa.valor_minimo_entrega || 0;
        }
      }
    }

    setPedidoEditForm(prev => ({ ...prev, valor: novoValor.toFixed(2).replace('.', ',') }));
  }, [isEditingPedido, pedidoEditForm.latitude_entrega, pedidoEditForm.longitude_entrega, empresa, restaurante]);

  // Filtros Histórico
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

  useEffect(() => {
    if (user) {
      fetchRestauranteProfile(user.id);
    }
  }, [user]);

  // Redireciona dispositivo móvel para a rota mobile dedicada
  useEffect(() => {
    if (window.innerWidth < 768) {
      navigate('/app-restaurante-mobile', { replace: true });
    }
  }, [navigate]);

  // Efeito para buscar permissões da empresa vinculada
  useEffect(() => {
    if (!restaurante?.empresa_id) return;

    const fetchEmpresaPermissoesX = async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', restaurante.empresa_id)
        .maybeSingle();

      if (data) {
        const permit = data.restaurante_pode_editar_pedido === true;
        setPodeEditarPedido(permit);
      } else {
        setPodeEditarPedido(false);
      }
    };

    fetchEmpresaPermissoesX();
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
        nome: restaurante.nome || '',
        telefone: restaurante.telefone || '',
        endereco: restaurante.endereco || '',
        foto_url: restaurante.foto_url || '',
        pix_nome_completo: restaurante.pix_nome_completo || '',
        pix_cpf: restaurante.pix_cpf || '',
        pix_chave: restaurante.pix_chave || '',
        pagbank_conta: restaurante.pagbank_conta || '',
        pagbank_digito: restaurante.pagbank_digito || ''
      });

      // Realtime geral para a listagem do restaurante
      const subscription = supabase
        .channel(`realtime_restaurante_geral_${restaurante.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'entregas',
          filter: `restaurante_id=eq.${restaurante.id}`
        }, () => {
          fetchEntregas();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pagamentos_pagbank',
          filter: `restaurante_id=eq.${restaurante.id}`
        }, () => {
          fetchEntregas();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'configuracoes_empresas',
          filter: `empresa_id=eq.${restaurante.empresa_id}`
        }, (payload) => {
          if (payload.new) {
            setConfigDistribuicao(payload.new as any);
          }
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [restaurante, filters]);

  useEffect(() => {
    let locationSubscription: any = null;

    if (selectedEntrega && selectedEntrega.motoboy_id && ['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(selectedEntrega.status)) {
      const setupTracking = async () => {
        setLoadingLocation(true);
        try {
          const { data: initialLoc } = await supabase
            .from('localizacoes_motoboys')
            .select('latitude, longitude, ultima_localizacao_em, updated_at')
            .eq('motoboy_id', selectedEntrega.motoboy_id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (initialLoc) {
            setMotoboyLocation({
              lat: initialLoc.latitude,
              lng: initialLoc.longitude,
              ultima_localizacao_em: initialLoc.ultima_localizacao_em || initialLoc.updated_at
            });
          }

          locationSubscription = supabase
            .channel(`motoboy_track_${selectedEntrega.motoboy_id}`)
            .on('postgres_changes', {
              event: 'INSERT',
              schema: 'public',
              table: 'localizacoes_motoboys',
              filter: `motoboy_id=eq.${selectedEntrega.motoboy_id}`
            }, (payload) => {
              setMotoboyLocation({
                lat: payload.new.latitude,
                lng: payload.new.longitude,
                ultima_localizacao_em: payload.new.ultima_localizacao_em || payload.new.updated_at
              });
            })
            .on('postgres_changes', {
              event: 'UPDATE',
              schema: 'public',
              table: 'localizacoes_motoboys',
              filter: `motoboy_id=eq.${selectedEntrega.motoboy_id}`
            }, (payload) => {
              setMotoboyLocation({
                lat: payload.new.latitude,
                lng: payload.new.longitude,
                ultima_localizacao_em: payload.new.ultima_localizacao_em || payload.new.updated_at
              });
            })
            .subscribe();

        } catch (err) {
          console.error('Erro ao configurar rastreamento:', err);
        } finally {
          setLoadingLocation(false);
        }
      };

      setupTracking();
    } else {
      setMotoboyLocation(null);
    }

    return () => {
      if (locationSubscription) {
        locationSubscription.unsubscribe();
      }
    };
  }, [selectedEntrega]);

  const fetchRestauranteProfile = async (userId: string) => {
    try {
      setLoadingProfile(true);
      
      const { data: restauranteData, error: restauranteError } = await supabase
        .from('restaurantes')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (restauranteError) throw restauranteError;
      if (!restauranteData) {
        setRestaurante(null);
        setLoadingProfile(false);
        return;
      }
      
      const profile = { ...restauranteData };
      setRestaurante(profile);

      const { data: empresaData } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', restauranteData.empresa_id)
        .maybeSingle();
      
      if (empresaData) {
        setEmpresa(empresaData);

        const { data: configData, error: configError } = await supabase
          .from('configuracoes_empresas')
          .select('*')
          .eq('empresa_id', restauranteData.empresa_id)
          .maybeSingle();
        
        if (configError) console.error(configError);

        console.log("CONFIG RAW:", configData);
        console.log("CONFIG STATE:", configDistribuicao);
        console.log("VALOR DO CAMPO:", configData?.mostrar_mapa_motoboys_sem_entrega);
        console.log("EMPRESA CONSULTADA:", restauranteData.empresa_id);

        if (!configData) {
          setConfigDistribuicao({ 
            empresa_id: restauranteData.empresa_id, 
            modo_distribuicao: 'todos_online' 
          });
        } else {
          setConfigDistribuicao(configData);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar perfil do restaurante:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (empresa) {
      checkBusinessHours();
    }
  }, [empresa]);

  useEffect(() => {
    if (restaurante) {
      const channel = supabase
        .channel(`restaurant_chats_${restaurante.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_entregas',
            filter: `restaurante_id=eq.${restaurante.id}`
          },
          (payload) => {
            const newMessage = payload.new as any;
            if (newMessage.remetente_tipo !== 'restaurante') {
              if (!(isChatOpen && selectedEntrega?.id === newMessage.entrega_id)) {
                playNotificationSound();
                setChatNotification({
                  show: true,
                  message: `Nova mensagem em Pedido #${newMessage.entrega_id.slice(0, 4)}`,
                  entregaId: newMessage.entrega_id
                });
                setTimeout(() => setChatNotification(null), 5000);
              }
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [restaurante, isChatOpen, selectedEntrega?.id]);

  const playNotificationSound = () => {
    if (chatAudioRef.current && canPlayAudio) {
      chatAudioRef.current.currentTime = 0;
      chatAudioRef.current.play().catch(e => console.log('Audio play blocked', e));
    }
  };

  const checkBusinessHours = () => {
    if (!empresa?.funcionamento_ativo) {
      setBusinessStatus({ open: true });
      return;
    }

    try {
      const now = new Date();
      const spTime = now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
      const spDate = new Date(spTime);
      
      const dayOfWeek = spDate.getDay(); 
      const currentMinutes = spDate.getHours() * 60 + spDate.getMinutes();

      const diasPermitidos = empresa.funcionamento_dias_semana || [1, 2, 3, 4, 5, 6, 0];
      if (!diasPermitidos.includes(dayOfWeek)) {
        setBusinessStatus({ 
          open: false, 
          message: 'Hoje a empresa não está realizando entregas.' 
        });
        return;
      }

      if (empresa.funcionamento_inicio && empresa.funcionamento_fim) {
        const [hInicio, mInicio] = empresa.funcionamento_inicio.split(':').map(Number);
        const [hFim, mFim] = empresa.funcionamento_fim.split(':').map(Number);
        
        const startMinutes = hInicio * 60 + mInicio;
        const endMinutes = hFim * 60 + mFim;

        let isOpen = false;
        if (startMinutes < endMinutes) {
          isOpen = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        } else {
          isOpen = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
        }

        if (!isOpen) {
          setBusinessStatus({ 
            open: false, 
            message: `Estamos fora do horário de atendimento (${empresa.funcionamento_inicio} às ${empresa.funcionamento_fim}).` 
          });
          return;
        }
      }

      setBusinessStatus({ open: true });
    } catch (err) {
      console.error('Erro ao validar horário de funcionamento:', err);
      setBusinessStatus({ open: true });
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

      let query = supabase
        .from('entregas')
        .select('*')
        .eq('restaurante_id', restaurante.id);

      if (filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      } else {
        query = query.in('status', ['entregue', 'cancelada']);
      }

      const { start, end } = getPeriodDates(filters.periodo, filters.dataInicio, filters.dataFim);
      query = query.gte('created_at', start.toISOString());
      query = query.lte('created_at', end.toISOString());

      if (filters.numero) {
        query = query.ilike('numero', `%${filters.numero}%`);
      }

      if (filters.acerto !== 'todos') {
        query = query.eq('acertada', filters.acerto === 'acertada');
      }

      const { data: historico, error: errorHistorico } = await query
        .order('created_at', { ascending: false })
        .limit(filters.numero || filters.dataInicio ? 200 : 50);

      if (errorHistorico) throw errorHistorico;

      const motoboyIds = Array.from(new Set([
        ...(ativas || []).map(e => e.motoboy_id).filter(Boolean),
        ...(historico || []).map(e => e.motoboy_id).filter(Boolean)
      ]));

      let motoboysMap: Record<string, any> = {};
      if (motoboyIds.length > 0) {
        const { data: activeMotoboys, error: rpcError } = await supabase.rpc('listar_motoboys_para_restaurante');
        
        if (rpcError) {
          console.error(rpcError);
        } else if (activeMotoboys) {
          activeMotoboys.forEach((m: any) => {
            motoboysMap[m.id] = m;
          });
        }

        const remainingIds = motoboyIds.filter(id => !motoboysMap[id]);
        
        if (remainingIds.length > 0) {
          const { data: motoboysData, error: mbError } = await supabase
            .from('motoboys_publico')
            .select('id, nome, telefone, foto_url')
            .in('id', remainingIds);

          if (!mbError && motoboysData) {
            motoboysData.forEach(m => {
              motoboysMap[m.id] = m;
            });
          }
        }
      }

      const mergeMotoboy = (entrega: any) => {
        if (entrega.motoboy_id) {
          const motoboy = motoboysMap[entrega.motoboy_id];
          return { ...entrega, motoboy };
        }
        return { ...entrega, motoboy: null };
      };

      setEntregasAtivas((ativas || []).map(mergeMotoboy));
      setHistoricoEntregas((historico || []).map(mergeMotoboy));

      try {
        const activeIds = [
          ...(ativas || []).map(e => e.id),
          ...(historico || []).map(e => e.id)
        ];
        if (activeIds.length > 0) {
          const { data: payData, error: payError } = await supabase
            .from('pagamentos_pagbank')
            .select('*')
            .in('entrega_id', activeIds);
          if (!payError && payData) {
            setPagamentosPagbank(payData);
          }
        } else {
          setPagamentosPagbank([]);
        }
      } catch (payErr) {
        console.error(payErr);
      }

    } catch (err) {
      console.error('Erro ao buscar entregas:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkPendingRequest = async () => {
    if (!restaurante) return;
    try {
      const { data } = await supabase
        .from('solicitacoes_alteracoes')
        .select('*')
        .eq('entidade_id', restaurante.id)
        .eq('tipo_entidade', 'restaurante')
        .eq('status', 'pendente')
        .maybeSingle();
      
      setHasPendingRequest(!!data);
    } catch (err) {
      console.error('Erro ao verificar solicitações pendentes:', err);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !restaurante) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${restaurante.id}_${Date.now()}.${fileExt}`;
      const filePath = `restaurantes/${restaurante.empresa_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('imagens')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('imagens')
        .getPublicUrl(filePath);

      setEditData(prev => ({ ...prev, foto_url: publicUrl }));
    } catch (error) {
      console.error('Erro no upload:', error);
      alert('Erro ao carregar imagem.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!restaurante || !user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('solicitacoes_alteracoes')
        .insert({
          empresa_id: restaurante.empresa_id,
          tipo_entidade: 'restaurante',
          entidade_id: restaurante.id,
          user_id: user.id,
          dados_anteriores: {
            nome: restaurante.nome,
            telefone: restaurante.telefone,
            endereco: restaurante.endereco,
            foto_url: restaurante.foto_url,
            pix_nome_completo: restaurante.pix_nome_completo || '',
            pix_cpf: restaurante.pix_cpf || '',
            pix_chave: restaurante.pix_chave || '',
            pagbank_conta: restaurante.pagbank_conta || '',
            pagbank_digito: restaurante.pagbank_digito || ''
          },
          dados_novos: editData,
          status: 'pendente'
        });

      if (error) throw error;
      
      setHasPendingRequest(true);
      setView('entregas');
      alert('Sua solicitação de alteração foi enviada para aprovação.');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditPedido = (entrega: Entrega) => {
    setSelectedEntrega(entrega);
    setPedidoEditForm({
      numero: entrega.numero || '',
      cliente_nome: entrega.cliente_nome || '',
      cliente_telefone: entrega.cliente_telefone || '',
      endereco_entrega: entrega.endereco_entrega || '',
      latitude_entrega: entrega.latitude_entrega || null,
      longitude_entrega: entrega.longitude_entrega || null,
      valor: entrega.valor?.toString() || '',
      observacao: entrega.observacao || '',
      forma_pagamento: entrega.forma_pagamento || '',
      is_ifood: !!entrega.ifood_localizador,
      ifood_localizador: entrega.ifood_localizador || ''
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
        alert('Selecione um endereço da lista para calcular o valor por KM.');
        return;
      }
      if (!restaurante?.latitude || !restaurante?.longitude) {
        alert('Não foi possível calcular a distância. O restaurante não possui coordenadas configuradas.');
        return;
      }
      if (parseFloat(pedidoEditForm.valor.replace(',', '.')) <= 0) {
        alert('O valor da entrega não pôde ser calculated. Verifique o endereço selecionado.');
        return;
      }
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('entregas')
        .update({
          numero: pedidoEditForm.numero,
          cliente_nome: pedidoEditForm.cliente_nome,
          cliente_telefone: pedidoEditForm.cliente_telefone,
          endereco_entrega: pedidoEditForm.endereco_entrega,
          latitude_entrega: pedidoEditForm.latitude_entrega,
          longitude_entrega: pedidoEditForm.longitude_entrega,
          valor: parseFloat(pedidoEditForm.valor.replace(',', '.')),
          observacao: pedidoEditForm.observacao,
          forma_pagamento: pedidoEditForm.forma_pagamento,
          ifood_localizador: pedidoEditForm.is_ifood ? pedidoEditForm.ifood_localizador.trim() : null
        })
        .eq('id', selectedEntrega.id)
        .eq('restaurante_id', restaurante?.id);

      if (error) throw error;
      
      const updatedEntrega = {
        ...selectedEntrega,
        ...pedidoEditForm,
        valor: parseFloat(pedidoEditForm.valor),
        ifood_localizador: pedidoEditForm.is_ifood ? pedidoEditForm.ifood_localizador.trim() : null
      };
      
      setSelectedEntrega(updatedEntrega);
      setEntregasAtivas(prev => prev.map(e => e.id === updatedEntrega.id ? updatedEntrega : e));
      setIsEditingPedido(false);
      alert('Pedido atualizado com sucesso!');
    } catch (err) {
      console.error('Erro ao editar pedido:', err);
      alert('Erro ao salvar alterações del pedido.');
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
      
      const uniqueMotoboys: any[] = [];
      const seenIds = new Set();
      if (data) {
        data.forEach((m: any) => {
          if (m && m.id && !seenIds.has(m.id)) {
            seenIds.add(m.id);
            uniqueMotoboys.push(m);
          }
        });
      }
      setOnlineMotoboys(uniqueMotoboys);
    } catch (err: any) {
      console.error('Erro em carregarMotoboysOnline:', err);
    } finally {
      setLoadingMotoboys(false);
    }
  };

  useEffect(() => {
    if (!restaurante) return;
    carregarMotoboysOnline();
    const interval = setInterval(() => {
      carregarMotoboysOnline();
    }, 15000);
    return () => clearInterval(interval);
  }, [restaurante?.id, isSelecaoMotoboyOpen]);

  useEffect(() => {
    if (!restaurante?.empresa_id) return;

    const fetchInitialLocations = async () => {
      try {
        const mostrar_mapa_motoboys_sem_entrega = !!configDistribuicao?.mostrar_mapa_motoboys_sem_entrega;
        console.log("Configuração mapa motoboys:", mostrar_mapa_motoboys_sem_entrega);

        console.log("AUTH USER", (await supabase.auth.getUser()).data.user);
        console.log("RESTAURANTE", restaurante);
        console.log("EMPRESA DO RESTAURANTE", restaurante?.empresa_id);

        // 1. Buscar localizações da empresa na tabela localizacoes_motoboys
        const { data: locData, error: locError } = await supabase
          .from('localizacoes_motoboys')
          .select(`
            id,
            motoboy_id,
            latitude,
            longitude,
            ultima_localizacao_em,
            updated_at
          `)
          .eq('empresa_id', restaurante.empresa_id)
          .order('updated_at', { ascending: false });

        console.log("ERRO LOCALIZACOES:", locError);
        console.log("RETORNO LOCALIZACOES:", locData);
        console.log("EMPRESA CONSULTADA:", restaurante.empresa_id);

        if (locError) throw locError;

        console.log("Localizações encontradas:", locData || []);

        // 2. Buscar motoboys online via RPC oficial (listar_motoboys_para_restaurante)
        const { data: motoboysRpcData, error: mbError } = await supabase.rpc('listar_motoboys_para_restaurante');

        if (mbError) console.error("Erro ao carregar motoboys para mapa:", mbError);

        const motoboys = motoboysRpcData || [];
        console.log("Motoboys carregados para mapa:", motoboys);
        setMapMotoboys(motoboys);

        const latestLocationsMap: Record<string, any> = {};
        (locData || []).forEach((item: any) => {
          if (!item.motoboy_id) return;
          const lat = Number(item.latitude);
          const lng = Number(item.longitude);
          if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

          const existing = latestLocationsMap[item.motoboy_id];
          if (!existing || new Date(item.updated_at) > new Date(existing.updated_at)) {
            latestLocationsMap[item.motoboy_id] = {
              id: item.id,
              motoboy_id: item.motoboy_id,
              latitude: lat,
              longitude: lng,
              ultima_localizacao_em: item.ultima_localizacao_em || item.updated_at,
              updated_at: item.updated_at,
              tipo: 'motoboy'
            };
          }
        });

        // Resolve names/avatar from motoboys_publico or motoboys
        const mIds = Object.keys(latestLocationsMap);
        if (mIds.length > 0) {
          if (motoboys) {
            motoboys.forEach((mb: any) => {
              if (latestLocationsMap[mb.id]) {
                latestLocationsMap[mb.id].motoboy_name = mb.nome;
                latestLocationsMap[mb.id].foto_url = mb.foto_url;
              }
            });
          }

          const remainingIds = mIds.filter(id => !latestLocationsMap[id].motoboy_name);
          if (remainingIds.length > 0) {
            const { data: mData } = await supabase
              .from('motoboys_publico')
              .select('id, nome, foto_url')
              .in('id', remainingIds);
            if (mData) {
              mData.forEach((m: any) => {
                if (latestLocationsMap[m.id]) {
                  latestLocationsMap[m.id].motoboy_name = m.nome;
                  latestLocationsMap[m.id].foto_url = m.foto_url;
                }
              });
            }
          }
        }

        setMotoboyLocations(Object.values(latestLocationsMap));
      } catch (err: any) {
        console.error('Erro ao carregar localizações na dashboard do restaurante:', err);
      }
    };

    fetchInitialLocations();

    const channel = supabase
      .channel('realtime_restaurant_map_locations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'localizacoes_motoboys',
          filter: `empresa_id=eq.${restaurante.empresa_id}`
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newLoc = payload.new as any;
            if (!newLoc.motoboy_id) return;

            setMotoboyLocations(prev => {
              const cached = prev.find(loc => loc.motoboy_id === newLoc.motoboy_id);
              const filtered = prev.filter(loc => loc.motoboy_id !== newLoc.motoboy_id);
              
              const newLat = Number(newLoc.latitude);
              const newLng = Number(newLoc.longitude);
              
              if (isNaN(newLat) || isNaN(newLng) || newLat === 0 || newLng === 0) {
                return prev;
              }

              if (cached) {
                return [...filtered, {
                  ...cached,
                  latitude: newLat,
                  longitude: newLng,
                  ultima_localizacao_em: newLoc.ultima_localizacao_em || newLoc.updated_at,
                  updated_at: newLoc.updated_at
                }];
              } else {
                supabase
                  .from('motoboys_publico')
                  .select('nome, foto_url')
                  .eq('id', newLoc.motoboy_id)
                  .single()
                  .then(({ data }) => {
                    setMotoboyLocations(current => {
                      const other = current.filter(loc => loc.motoboy_id !== newLoc.motoboy_id);
                      return [...other, {
                        id: newLoc.id,
                        motoboy_id: newLoc.motoboy_id,
                        latitude: newLat,
                        longitude: newLng,
                        ultima_localizacao_em: newLoc.ultima_localizacao_em || newLoc.updated_at,
                        updated_at: newLoc.updated_at,
                        motoboy_name: data?.nome || 'Motoboy',
                        foto_url: data?.foto_url,
                        tipo: 'motoboy'
                      }];
                    });
                  });

                return [...filtered, {
                  id: newLoc.id,
                  motoboy_id: newLoc.motoboy_id,
                  latitude: newLat,
                  longitude: newLng,
                  ultima_localizacao_em: newLoc.ultima_localizacao_em || newLoc.updated_at,
                  updated_at: newLoc.updated_at,
                  motoboy_name: 'Motoboy',
                  tipo: 'motoboy'
                }];
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurante?.empresa_id, configDistribuicao?.mostrar_mapa_motoboys_sem_entrega]);

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

      if (selectedEntrega?.id === entregaId) {
        setSelectedEntrega({ ...selectedEntrega, status: 'pendente' });
      }
      
      fetchEntregas();
    } catch (err) {
      console.error('Erro ao chamar motoboy:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMotoboyManual = async (motoboyId: string) => {
    if (!restaurante || !entregaParaDespacho) return;

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('entregas')
        .update({ 
          status: 'aceita',
          motoboy_id: motoboyId
        })
        .eq('id', entregaParaDespacho)
        .eq('restaurante_id', restaurante.id);

      if (updateError) throw updateError;

      await supabase
        .from('historico_status_entregas')
        .insert({
          entrega_id: entregaParaDespacho,
          empresa_id: restaurante.empresa_id,
          restaurante_id: restaurante.id,
          status: 'aceita',
          descricao: `Motoboy escolhido manualmente: ${onlineMotoboys.find(m => m.id === motoboyId)?.nome}`
        });

      if (selectedEntrega?.id === entregaParaDespacho) {
        setSelectedEntrega({ ...selectedEntrega, status: 'aceita', motoboy_id: motoboyId });
      }
      
      setIsSelecaoMotoboyOpen(false);
      setEntregaParaDespacho(null);
      fetchEntregas();
      alert('Motoboy vinculado com sucesso!');
    } catch (err) {
      console.error('Erro ao vincular motoboy:', err);
      alert('Erro ao vincular motoboy.');
    } finally {
      setLoading(false);
    }
  };

const handleEstornarCartaoRestaurante = async (entregaId: string) => {
  if (!window.confirm('ATENÇÃO: Deseja realmente APAGAR os registros de cartão deste pedido e reabri-lo em rota para o motoboy tentar passar novamente?')) return;
  
  setLoading(true);
  try {
    // 1. Elimina os registros de cartão que foram passados errados nessa entrega
    const { error: deleteError } = await supabase
      .from('pagamentos_pagbank')
      .delete()
      .eq('entrega_id', entregaId);

    if (deleteError) throw deleteError;

    // 2. Volta o status para "Em Rota", mantém o motoboy_id e LIMPA as marcas de finalização
    const { error: updateError } = await supabase
      .from('entregas')
      .update({
        status: 'em_rota',
        pagamento_status: 'pendente',
        entregue_em: null,            // 🌟 Remove o horário de finalizado para o app reabrir a rota
        valor_pago_dinheiro: 0        // Zera o dinheiro caso tenha sido lançado junto por erro
      })
      .eq('id', entregaId);

    if (updateError) throw updateError;

    alert('Registros de cartão limpos! O pedido foi reaberto e voltou para a aba "Minhas Rotas" do mesmo entregador.');
    
    carregarValoresFinais(entregaId);
    fetchEntregas();
  } catch (err) {
    console.error('Erro ao estornar cartão no painel:', err);
    alert('Erro ao processar o estorno no sistema.');
  } finally {
    setLoading(false);
  }
};

  const handleCancelPedido = async (entregaId: string) => {
    if (!window.confirm('Tem certeza que deseja cancelar esta entrega?')) return;
    
    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('entregas')
        .update({ status: 'cancelada' })
        .eq('id', entregaId)
        .eq('restaurante_id', restaurante?.id);

      if (updateError) throw updateError;

      await supabase
        .from('historico_status_entregas')
        .insert({
          entrega_id: entregaId,
          empresa_id: restaurante?.empresa_id,
          restaurante_id: restaurante?.id,
          status: 'cancelada',
          descricao: 'Pedido cancelado pelo restaurante'
        });

      setSelectedEntrega(null);
      fetchEntregas();
      alert('Pedido cancelado com sucesso.');
    } catch (err) {
      console.error('Erro ao cancelar pedido:', err);
      alert('Erro ao cancelar pedido.');
    } finally {
      setLoading(false);
    }
  };

  const getCanCancel = (entrega: Entrega) => {
    if (entrega.status === 'entregue' || entrega.status === 'cancelada') return false;
    
    const limitMinutes = empresa?.tempo_limite_cancelamento_restaurante_minutos ?? 5;
    const createdAt = new Date(entrega.created_at).getTime();
    const now = new Date().getTime();
    const diffMinutes = (now - createdAt) / (1000 * 60);
    
    return diffMinutes <= limitMinutes;
  };

  const handleToggleAcerto = async (entrega: Entrega) => {
    if (!restaurante || !user) return;
    
    setLoading(true);
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
        .eq('restaurante_id', restaurante.id);

      if (error) throw error;
      
      setHistoricoEntregas(prev => prev.map(e => 
        e.id === entrega.id 
          ? { ...e, acertada: isSettling, acertada_em: isSettling ? new Date().toISOString() : null } 
          : e
      ));

      if (selectedEntrega?.id === entrega.id) {
        setSelectedEntrega({ ...selectedEntrega, acertada: isSettling, acertada_em: isSettling ? new Date().toISOString() : null });
      }
      
    } catch (err: any) {
      console.error(err);
      alert('Erro ao atualizar acerto da entrega.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (historicoEntregas.length === 0) {
      alert('Nenhuma entrega para exportar');
      return;
    }

    setIsExporting(true);
    try {
      const data: any[][] = [
        [
          'Código/Número do Pedido',
          'Cliente',
          'Telefone do Cliente',
          'Endereço de Entrega',
          'Status',
          'Motoboy',
          'Telefone do Motoboy',
          'Valor (R$)',
          'Acertada',
          'Data do Acerto',
          'Observação',
          'Data de Criação'
        ]
      ];

      historicoEntregas.forEach(entrega => {
        const mb = (entrega as any).motoboy;
        data.push([
          entrega.numero || '',
          entrega.cliente_nome || 'Cliente não informado',
          entrega.cliente_telefone || '',
          entrega.endereco_entrega || '',
          getStatusLabel(entrega.status),
          mb?.nome || 'Motoboy não encontrado',
          mb?.telefone || '',
          Number(entrega.valor || 0),
          entrega.acertada ? 'SIM' : 'NÃO',
          entrega.acertada_em ? new Date(entrega.acertada_em).toLocaleString('pt-BR') : '',
          (entrega.observacao || ''),
          new Date(entrega.created_at).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(data);
      const wscols = [
        { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 40 },
        { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 15 },
        { wch: 10 }, { wch: 20 }, { wch: 30 }, { wch: 20 },
      ];
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Histórico de Entregas");

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `relatorio-restaurante-entregas-${dateStr}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar relatório.');
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aguardando_despacho': return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'pendente': return 'bg-sky-50 text-sky-700 border border-sky-200';
      case 'aceita': return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      case 'coletada': return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'em_rota': return 'bg-blue-600 text-white shadow-xs';
      case 'pagamento_errado': return 'bg-red-600 text-white animate-pulse shadow-xs';
      case 'entregue': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'cancelada': return 'bg-rose-50 text-rose-700 border border-rose-200';
      default: return 'bg-neutral-100 text-neutral-600 border border-neutral-200';
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
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-50 text-red-500">
            <AlertCircle size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-neutral-900">Acesso Negado</h1>
            <p className="text-neutral-500">Este usuário não está vinculado a um restaurante ou ainda não foi aprovado.</p>
          </div>
          <button 
            onClick={() => signOut()} 
            className="w-full py-4 bg-orange-500 text-white font-bold rounded-2xl shadow-lg shadow-orange-100 active:scale-95 transition-transform"
          >
            Sair e tentar outro e-mail
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-neutral-50 text-neutral-900 font-sans ${view === 'entregas' ? 'h-screen overflow-hidden' : 'min-h-screen pb-24'}`}>
      <header className="h-13 md:h-14 bg-orange-600 text-white px-3 md:px-5 sticky top-0 z-50 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMenuOpen(true)} 
            className="p-1.5 hover:bg-white/10 rounded-xl transition-colors active:scale-90 text-white"
            title="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="flex items-center gap-2.5">
            {restaurante.foto_url ? (
              <img src={restaurante.foto_url} className="h-7 w-7 rounded-lg object-cover border border-white/20 shadow-xs" alt="logo" />
            ) : (
              <div className="h-7 w-7 rounded-lg bg-white/15 flex items-center justify-center text-white font-black text-xs border border-white/20">
                {restaurante.nome.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-100 opacity-90 leading-tight">
                {empresa?.nome || 'PAINEL DELIVERY'}
              </span>
              <span className="text-xs md:text-sm font-extrabold text-white leading-tight tracking-tight">
                {restaurante.nome}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setView('integracoes')} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors active:scale-95 flex items-center gap-1.5 text-white bg-white/10 border border-white/10 px-2.5 py-1">
            <Link2 className="h-4 w-4" /><span className="text-xs font-bold hidden sm:inline">Integrações</span>
          </button>
          <button 
            onClick={() => setView('configuracoes')} 
            className="p-1.5 hover:bg-white/10 rounded-xl transition-colors active:scale-95 flex items-center gap-1.5 text-white bg-white/10 border border-white/10 px-2.5 py-1 rounded-xl"
          >
            <Settings className="h-4 w-4" />
            <span className="text-xs font-bold hidden sm:inline">Configurações</span>
          </button>
        </div>
      </header>

      {view === 'entregas' ? (
        <div className="flex h-[calc(100vh-52px)] w-full overflow-hidden bg-neutral-50 animate-in fade-in duration-300">
          {/* SIDEBAR LATERAL ESQUERDA (Lista de Pedidos e Métricas) */}
          <div className="w-[350px] md:w-[380px] h-full bg-white border-r border-neutral-200/80 flex flex-col shrink-0">
            {/* TOPO DA SIDEBAR */}
            <div className="p-3.5 border-b border-neutral-200/80 space-y-3 shrink-0 bg-white">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-black text-sm uppercase tracking-wider text-neutral-900">Entregas</h2>
                  <p className="text-[11px] font-bold text-neutral-500 mt-0.5">
                    {entregasAtivas.length} ativas   •   {onlineMotoboys.length} motoboy{onlineMotoboys.length === 1 ? '' : 's'} online
                  </p>
                </div>
                <button 
                  onClick={() => {
                    if (!businessStatus.open || !configDistribuicao) return;
                    setIsNovoPedidoOpen(true);
                  }}
                  disabled={!businessStatus.open || !configDistribuicao}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-tight shadow-sm active:scale-95 transition-all shrink-0 ${
                    !businessStatus.open || !configDistribuicao ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed shadow-none' : 'bg-neutral-900 hover:bg-black text-white'
                  }`}
                >
                  {!configDistribuicao && <Loader2 size={12} className="animate-spin" />}
                  <Plus size={14} /> Nova Entrega
                </button>
              </div>

              {!businessStatus.open && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-amber-100 border border-amber-200 p-2 rounded-xl flex items-start gap-2 shadow-sm"
                >
                  <Clock className="text-amber-700 h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-extrabold text-amber-900 uppercase tracking-tight text-[10px]">Sistema em Pausa</h3>
                    <p className="text-amber-700 text-[9px] font-medium leading-relaxed mt-0.5">
                      {businessStatus.message}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Contadores KPI */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-neutral-50/90 p-2.5 rounded-xl border border-neutral-200/80 flex items-center justify-between">
                  <div>
                    <p className="text-xl font-black text-neutral-900 leading-none">{entregasAtivas.length}</p>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">Entregas ativas</p>
                  </div>
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                    <Package size={16} />
                  </div>
                </div>

                <div className="bg-neutral-50/90 p-2.5 rounded-xl border border-neutral-200/80 flex items-center justify-between">
                  <div>
                    <p className="text-xl font-black text-orange-600 leading-none">{onlineMotoboys.length}</p>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">Motoboys online</p>
                  </div>
                  <div className="p-2 bg-orange-50 text-orange-600 rounded-lg shrink-0">
                    <Bike size={16} />
                  </div>
                </div>
              </div>
            </div>

            {/* CORPO DA SIDEBAR */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-neutral-50/70 pb-20">
              {loading && entregasAtivas.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-neutral-400 gap-2">
                  <Loader2 className="animate-spin h-5 w-5 text-orange-500" />
                  <p className="text-[11px] font-bold uppercase tracking-widest">Sincronizando...</p>
                </div>
              ) : entregasAtivas.length === 0 ? (
                <div className="text-center py-8 px-4 bg-white rounded-xl border border-neutral-200/80 shadow-xs">
                  <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <Package className="h-5 w-5 text-neutral-400" />
                  </div>
                  <h3 className="font-bold text-sm text-neutral-800">Nenhuma entrega ativa</h3>
                  <p className="text-neutral-500 text-xs mt-1 leading-relaxed">As novas entregas criadas aparecerão aqui em tempo real.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                {entregasAtivas.map(entrega => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={entrega.id} 
                    onClick={() => setSelectedEntrega(entrega)}
                    className="bg-white p-3 rounded-xl border border-neutral-200/80 shadow-xs hover:border-neutral-300 hover:shadow-md transition-all cursor-pointer space-y-2 relative group"
                  >
                    {/* Top Header line */}
                    <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="bg-neutral-900 text-white font-mono text-[11px] font-black px-2 py-0.5 rounded-md tracking-tight shrink-0">
                          #{entrega.numero}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-neutral-400 flex items-center gap-1 shrink-0">
                          <Clock size={11} />
                          {new Date(entrega.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {podeEditarPedido && !['entregue', 'cancelada'].includes(entrega.status) && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditPedido(entrega);
                            }}
                            className="p-1 text-neutral-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                            title="Editar Pedido"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {getCanCancel(entrega) && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelPedido(entrega.id);
                            }}
                            className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Cancelar Pedido"
                          >
                            <XCircle size={12} />
                          </button>
                        )}
                        <div className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-tight ${getStatusColor(entrega.status)}`}>
                          {getStatusLabel(entrega.status)}
                        </div>
                      </div>
                    </div>

                    {/* Pagamento errado alert */}
                    {entrega.status === 'pagamento_errado' && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-red-700 text-xs flex items-center gap-2">
                        <AlertCircle size={14} className="text-red-500 shrink-0" />
                        <span className="font-bold text-[11px]">Pagamento estornado - Refazer cobrança</span>
                      </div>
                    )}

                    {/* Address Line */}
                    <div className="space-y-1">
                      <div className="flex items-start gap-1.5">
                        <MapPin size={14} className="text-orange-500 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="font-extrabold text-neutral-800 text-xs leading-snug break-words">
                            {entrega.endereco_entrega}
                          </p>
                          {(!entrega.latitude_entrega || !entrega.longitude_entrega) && (
                            <p className="flex items-center gap-1 text-[9px] font-bold text-amber-600 uppercase mt-0.5">
                              <AlertCircle size={10} /> Sem coordenadas no mapa
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Client & Value */}
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-100/60">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User size={13} className="text-neutral-400 shrink-0" />
                        <span className="text-xs font-bold text-neutral-700 truncate">
                          {entrega.cliente_nome ? entrega.cliente_nome.split(' ')[0] : 'Cliente'}
                        </span>
                      </div>
                      <span className="font-black text-xs text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded-md">
                        R$ {entrega.valor?.toFixed(2)}
                      </span>
                    </div>

                    {/* Footer Action */}
                    {entrega.status === 'aguardando_despacho' ? (
                      <div className="pt-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleChamarMotoboy(entrega.id);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-extrabold text-xs uppercase tracking-wider shadow-xs active:scale-[0.99] transition-all"
                        >
                          <Bike className="h-4 w-4" /> CHAMAR MOTOBOY
                        </button>
                      </div>
                    ) : (entrega.status !== 'pendente' && entrega.motoboy_id) ? (
                      <div className="pt-1.5 flex items-center justify-between bg-neutral-50 p-2 rounded-lg border border-neutral-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-neutral-200 overflow-hidden shrink-0 border border-neutral-300">
                            {(entrega as any).motoboy?.foto_url ? (
                              <img src={(entrega as any).motoboy.foto_url} className="w-full h-full object-cover" />
                            ) : (
                              <User size={14} className="m-auto text-neutral-500" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider leading-none">Motoboy</p>
                            <p className="font-bold text-neutral-800 text-xs truncate mt-0.5">
                              {(entrega as any).motoboy?.nome || 'Motoboy'}
                            </p>
                          </div>
                        </div>
                        {(entrega as any).motoboy?.telefone && (
                          <a 
                            href={`tel:${(entrega as any).motoboy.telefone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-md transition-colors"
                            title="Ligar para Motoboy"
                          >
                            <Phone size={13} />
                          </a>
                        )}
                      </div>
                    ) : (entrega.status !== 'cancelada' && entrega.status !== 'entregue') && (
                      <div className="pt-1.5 flex items-center justify-center gap-1.5 bg-sky-50 text-sky-700 py-1.5 px-2 rounded-lg border border-sky-100">
                        <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                        <span className="text-[10px] font-black uppercase tracking-wider">
                          BUSCANDO MOTOBOY...
                        </span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
            </div>
          </div>

          {/* ÁREA DA DIREITA (Mapa em Tela Cheia) */}
          <div className="flex-1 h-full relative bg-neutral-100">
            {/* Indicadores Flutuantes Sobre o Mapa */}
            <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-neutral-200/80 shadow-md flex items-center gap-3 text-xs font-black pointer-events-auto">
              <div className="flex items-center gap-1.5 text-neutral-800">
                <Bike size={14} className="text-orange-500" />
                <span>{onlineMotoboys.length} online</span>
              </div>
              <div className="w-px h-3 bg-neutral-200" />
              <div className="flex items-center gap-1.5 text-neutral-800">
                <Package size={14} className="text-indigo-600" />
                <span>{entregasAtivas.length} entregas</span>
              </div>
            </div>
            {configDistribuicao?.mostrar_mapa_motoboys_restaurante ? (
              <div className="w-full h-full relative z-10 animate-in fade-in duration-500">
                {restaurante?.latitude && restaurante?.longitude ? (
                  <MapContainer 
                    center={[restaurante.latitude, restaurante.longitude]} 
                    zoom={14} 
                    className="w-full h-full"
                    zoomControl={true}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <Marker position={[restaurante.latitude, restaurante.longitude]} icon={restauranteIcon}>
                      <Popup>
                        <div className="font-bold text-neutral-800 text-xs p-1">
                          <p className="font-black">Seu Restaurante</p>
                          <p className="text-[10px] text-neutral-450 font-semibold">{restaurante.nome}</p>
                        </div>
                      </Popup>
                    </Marker>
                    <MapAutoCenter 
                      restaurante={restaurante}
                      entregasAtivas={entregasAtivas}
                      motoboyLocations={motoboyLocations}
                      mostrarMapaMotoboysSemEntrega={!!configDistribuicao?.mostrar_mapa_motoboys_sem_entrega}
                      mapMotoboys={mapMotoboys}
                    />

                    {/* Marcadores dos Clientes (Entregas com status: aceita, coletada, em_rota, pagamento_errado) */}
                    {entregasAtivas
                      .filter(e => ['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(e.status) && e.latitude_entrega && e.longitude_entrega)
                      .map(e => {
                        const lat = Number(e.latitude_entrega);
                        const lng = Number(e.longitude_entrega);
                        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

                        return (
                          <Marker 
                            key={`client-${e.id}`} 
                            position={[lat, lng]} 
                            icon={deliveryIcon}
                          >
                            <Popup>
                              <div className="p-1 text-xs space-y-1">
                                <p className="font-bold text-neutral-800">Cliente (Pedido #{e.numero})</p>
                                <p className="font-semibold text-neutral-600">Nome: {e.cliente_nome || 'Não informado'}</p>
                                <p className="text-[10px] text-neutral-500 leading-tight">Endereço: {e.endereco_entrega}</p>
                                <span className="inline-block px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-md bg-indigo-50 text-indigo-600 border border-indigo-150 mt-1">
                                  {e.status}
                                </span>
                              </div>
                            </Popup>
                          </Marker>
                        );
                      })
                    }

                    {/* Marcadores dos Motoboys */}
                    {(() => {
                      const mostrarSemEntrega = !!configDistribuicao?.mostrar_mapa_motoboys_sem_entrega;

                      if (mostrarSemEntrega) {
                        const activeDeliveriesWithMotoboy = entregasAtivas.filter(
                          e => ['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(e.status) && e.motoboy_id
                        );

                        const onlineIds = new Set((mapMotoboys || []).map((m: any) => m.id));

                        const motoboysToShowLoc = motoboyLocations.filter(loc => {
                          const isOnline = onlineIds.has(loc.motoboy_id);
                          const hasActiveDelivery = activeDeliveriesWithMotoboy.some(e => e.motoboy_id === loc.motoboy_id);
                          return isOnline || hasActiveDelivery;
                        });

                        return motoboysToShowLoc.map(mLoc => {
                          const lat = Number(mLoc.latitude);
                          const lng = Number(mLoc.longitude);
                          if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

                          const activeDelivery = activeDeliveriesWithMotoboy.find(e => e.motoboy_id === mLoc.motoboy_id);
                          const motoboyObj = (mapMotoboys || []).find((m: any) => m.id === mLoc.motoboy_id);
                          const nomeMotoboy = mLoc.motoboy_name || motoboyObj?.nome || 'Entregador';

                          return (
                            <Marker 
                              key={`motoboy-loc-${mLoc.motoboy_id}`} 
                              position={[lat, lng]} 
                              icon={motoboyIcon}
                            >
                              <Popup>
                                <div className="p-1 text-xs space-y-1">
                                  <p className="font-black text-neutral-800">{nomeMotoboy}</p>
                                  {activeDelivery ? (
                                    <p className="text-[9px] text-neutral-400 font-bold uppercase">
                                      Pedido #{activeDelivery.numero} ({activeDelivery.status})
                                    </p>
                                  ) : (
                                    <p className="text-[9px] text-emerald-600 font-bold uppercase">
                                      Online (Sem entrega em andamento)
                                    </p>
                                  )}
                                  {(() => {
                                    const timeInfo = formatLocationTime(mLoc.ultima_localizacao_em || mLoc.updated_at);
                                    return (
                                      <p className={`text-[10px] font-bold ${timeInfo.isOutdated ? 'text-red-600' : 'text-emerald-600'}`}>
                                        {timeInfo.isOutdated ? '⚠️ Localização desatualizada' : timeInfo.text}
                                      </p>
                                    );
                                  })()}
                                </div>
                              </Popup>
                            </Marker>
                          );
                        });
                      } else {
                        return entregasAtivas
                          .filter(e => ['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(e.status) && e.motoboy_id)
                          .map(e => {
                            const mLoc = motoboyLocations.find(l => l.motoboy_id === e.motoboy_id);
                            if (!mLoc) return null;
                            
                            const lat = Number(mLoc.latitude);
                            const lng = Number(mLoc.longitude);
                            if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

                            return (
                              <Marker 
                                key={`active-motoboy-${e.id}`} 
                                position={[lat, lng]} 
                                icon={motoboyIcon}
                              >
                                <Popup>
                                  <div className="p-1 text-xs space-y-1">
                                    <p className="font-black text-neutral-800">{mLoc.motoboy_name || 'Entregador em Rota'}</p>
                                    <p className="text-[9px] text-neutral-400 font-bold uppercase">Pedido #{e.numero} ({e.status})</p>
                                    {(() => {
                                      const timeInfo = formatLocationTime(mLoc.ultima_localizacao_em || mLoc.updated_at);
                                      return (
                                        <p className={`text-[10px] font-bold ${timeInfo.isOutdated ? 'text-red-600' : 'text-emerald-600'}`}>
                                          {timeInfo.isOutdated ? '⚠️ Localização desatualizada' : timeInfo.text}
                                        </p>
                                      );
                                    })()}
                                  </div>
                                </Popup>
                              </Marker>
                            );
                          });
                      }
                    })()}

                    {/* Desenhar Linhas: Restaurante -> Motoboy -> Cliente */}
                    {(() => {
                      const rLat = Number(restaurante.latitude);
                      const rLng = Number(restaurante.longitude);
                      const hasRestaurante = !isNaN(rLat) && !isNaN(rLng) && rLat !== 0 && rLng !== 0;

                      if (!hasRestaurante) return null;

                      return entregasAtivas
                        .filter(e => ['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(e.status))
                        .map(e => {
                          const cLat = e.latitude_entrega ? Number(e.latitude_entrega) : null;
                          const cLng = e.longitude_entrega ? Number(e.longitude_entrega) : null;
                          const hasCliente = cLat !== null && cLng !== null && !isNaN(cLat) && !isNaN(cLng) && cLat !== 0 && cLng !== 0;

                          const mLoc = e.motoboy_id ? motoboyLocations.find(l => l.motoboy_id === e.motoboy_id) : null;
                          const mLat = mLoc ? Number(mLoc.latitude) : null;
                          const mLng = mLoc ? Number(mLoc.longitude) : null;
                          const hasMotoboy = mLat !== null && mLng !== null && !isNaN(mLat) && !isNaN(mLng) && mLat !== 0 && mLng !== 0;

                          const segments: [number, number][] = [[rLat, rLng]];
                          
                          if (hasMotoboy) {
                            segments.push([mLat!, mLng!]);
                          }
                          
                          if (hasCliente) {
                            segments.push([cLat!, cLng!]);
                          }

                          if (segments.length < 2) return null;

                          // Dynamic nice coloring to differentiate routes
                          const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#a855f7', '#06b6d4'];
                          const numStr = String(e.numero ?? '');
                          const colorIndex = Math.abs(numStr ? numStr.charCodeAt(0) + numStr.charCodeAt(numStr.length - 1) : 0) % colors.length;
                          const routeColor = colors[colorIndex];

                          return (
                            <Polyline
                              key={`route-line-${e.id}`}
                              positions={segments}
                              color={routeColor}
                              weight={3}
                              dashArray="5, 10"
                            />
                          );
                        });
                    })()}
                  </MapContainer>
                ) : (
                  <div className="w-full h-full bg-neutral-50 flex flex-col items-center justify-center p-6 text-center gap-2">
                    <p className="text-neutral-550 font-black text-xs uppercase tracking-wider">Localização do restaurante não configurada</p>
                    <p className="text-[10px] text-neutral-400 max-w-xs font-semibold leading-normal font-sans">Configure a latitude e longitude do restaurante nas configurações para exibir os motoboys ao redor.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full bg-neutral-50 flex flex-col items-center justify-center p-6 text-center gap-2 font-sans">
                <p className="text-neutral-550 font-black text-xs uppercase tracking-wider leading-none">Mapa de Motoboys Desativado</p>
                <p className="text-[10px] text-neutral-400 max-w-xs font-semibold leading-normal mt-1">Ative a exibição do mapa de motoboys nas configurações do restaurante para visualizar os entregadores em tempo real.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <main className="p-4 space-y-6">
          {!businessStatus.open && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-amber-100 border border-amber-200 p-4 rounded-[28px] flex items-start gap-3 shadow-sm"
            >
              <div className="bg-amber-200 p-2 rounded-xl">
                <Clock className="text-amber-700 h-5 w-5" />
              </div>
              <div>
                <h3 className="font-black text-amber-900 uppercase tracking-tight text-sm">Sistema em Pausa</h3>
                <p className="text-amber-700 text-xs font-medium leading-relaxed mt-0.5">
                  {businessStatus.message}
                </p>
              </div>
            </motion.div>
          )}

        {view === 'historico' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div>
                <h2 className="font-black text-2xl uppercase tracking-tighter">Histórico</h2>
                <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest">Entregas Finalizadas</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`p-3 rounded-2xl transition-all shadow-sm flex items-center gap-2 text-xs font-black uppercase tracking-tight ${
                    isFilterOpen ? 'bg-orange-500 text-white' : 'bg-white text-neutral-400 border border-neutral-100'
                  }`}
                >
                  <Filter size={16} /> {isFilterOpen ? 'Fechar' : 'Filtros'}
                </button>
                <button 
                  onClick={handleExportExcel}
                  disabled={isExporting || historicoEntregas.length === 0}
                  className="bg-neutral-900 text-white p-3 rounded-2xl font-black text-xs shadow-xl active:scale-95 transition-all uppercase tracking-tight disabled:opacity-50 flex items-center gap-2"
                >
                  {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} 
                  Excel
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-emerald-50/60 border border-emerald-100 p-4 rounded-3xl space-y-2 relative overflow-hidden shadow-xs">
                <div className="absolute right-2 top-2 text-emerald-300 opacity-80">
                  <DollarSign size={18} />
                </div>
                <p className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wider leading-none">Total Vendido</p>
                <p className="font-black text-emerald-800 text-xl tracking-tight">
                  R$ {historicoEntregas.reduce((acc, curr) => acc + (curr.valor_pedido || 0), 0).toFixed(2)}
                </p>
              </div>

              <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-3xl space-y-2 relative overflow-hidden shadow-xs">
                <div className="absolute right-2 top-2 text-neutral-300 opacity-80">
                  <Package size={18} />
                </div>
                <p className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-wider leading-none">Total de Pedidos</p>
                <p className="font-black text-neutral-800 text-xl tracking-tight">
                  {historicoEntregas.length}
                </p>
              </div>

              <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-3xl space-y-2 relative overflow-hidden shadow-xs">
                <div className="absolute right-2 top-2 text-blue-350 opacity-80">
                  <CheckCircle2 size={18} />
                </div>
                <p className="text-[10px] text-blue-600 font-extrabold uppercase tracking-wider leading-none">Pedidos Entregues</p>
                <p className="font-black text-blue-800 text-xl tracking-tight">
                  {historicoEntregas.filter(e => e.status === 'entregue').length}
                </p>
              </div>

              <div className="bg-orange-50/50 border border-orange-100 p-4 rounded-3xl space-y-2 relative overflow-hidden shadow-xs">
                <div className="absolute right-2 top-2 text-orange-400 opacity-60">
                  <TrendingUp size={18} />
                </div>
                <p className="text-[10px] text-orange-600 font-extrabold uppercase tracking-wider leading-none">Ticket Médio</p>
                <p className="font-black text-orange-850 text-xl tracking-tight">
                  R$ {(() => {
                    const totalV = historicoEntregas.reduce((acc, curr) => acc + (curr.valor_pedido || 0), 0);
                    const totalP = historicoEntregas.length;
                    return totalP > 0 ? (totalV / totalP) : 0;
                  })().toFixed(2)}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-neutral-100 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg">
                    <Calendar size={14} />
                  </div>
                  <h3 className="font-extrabold text-neutral-900 text-xs uppercase tracking-wider">Período de Filtragem</h3>
                </div>
              </div>

              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { id: 'hoje', label: 'Hoje' },
                  { id: 'ontem', label: 'Ontem' },
                  { id: 'semana', label: 'Esta Semana' },
                  { id: 'mes', label: 'Este Mês' },
                  { id: 'personalizado', label: 'Personalizado' },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    type="button"
                    onClick={() => setFilters(prev => ({ ...prev, periodo: btn.id }))}
                    className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                      filters.periodo === btn.id
                        ? 'bg-orange-600 text-white border-orange-600 shadow-sm shadow-orange-100'
                        : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border-neutral-200'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {filters.periodo === 'personalizado' && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Data Inicial</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-xs text-neutral-800 outline-none focus:border-orange-500 transition-all font-sans"
                      value={filters.dataInicio}
                      onChange={(e) => setFilters(prev => ({ ...prev, dataInicio: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Data Final</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-xs text-neutral-800 outline-none focus:border-orange-500 transition-all font-sans"
                      value={filters.dataFim}
                      onChange={(e) => setFilters(prev => ({ ...prev, dataFim: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm space-y-4"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Status</label>
                      <select 
                        value={filters.status}
                        onChange={e => setFilters({...filters, status: e.target.value})}
                        className="w-full h-10 px-3 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100"
                      >
                        <option value="todos">Todos</option>
                        <option value="pendente">Pendente</option>
                        <option value="aceita">Aceita</option>
                        <option value="coletada">Coletada</option>
                        <option value="em_rota">Em rota</option>
                        <option value="entregue">Entregue</option>
                        <option value="cancelada">Cancelada</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Buscar Número</label>
                      <div className="relative">
                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-300" />
                        <input 
                          type="text"
                          placeholder="Ex: #4582"
                          value={filters.numero}
                          onChange={e => setFilters({...filters, numero: e.target.value})}
                          className="w-full h-10 pl-8 pr-3 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Data Início</label>
                      <input 
                        type="date"
                        value={filters.dataInicio}
                        onChange={e => setFilters({...filters, dataInicio: e.target.value})}
                        className="w-full h-10 px-3 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Data Fim</label>
                      <input 
                        type="date"
                        value={filters.dataFim}
                        onChange={e => setFilters({...filters, dataFim: e.target.value})}
                        className="w-full h-10 px-3 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Acerto</label>
                    <select
                      className="w-full h-10 px-3 bg-neutral-50 border border-neutral-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-100"
                      value={filters.acerto}
                      onChange={(e) => setFilters({...filters, acerto: e.target.value})}
                    >
                      <option value="todos">Todos os Acertos</option>
                      <option value="pendente">Pendentes</option>
                      <option value="acertada">Acertadas</option>
                    </select>
                  </div>

                  <button 
                    onClick={() => setFilters({ period: 'hoje', status: 'todos', dataInicio: '', dataFim: '', numero: '', acerto: 'todos' })}
                    className="w-full h-10 bg-neutral-50 text-neutral-400 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 hover:bg-neutral-100 transition-colors"
                  >
                    <Eraser size={14} /> Limpar Filtros
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {historicoEntregas.length === 0 ? (
              <div className="text-center py-16 px-8 bg-white rounded-[32px] border border-neutral-100 shadow-sm text-neutral-400">
                <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest">Nenhuma entrega encontrada</p>
                {(filters.status !== 'todos' || filters.periodo !== 'hoje' || filters.dataInicio || filters.dataFim || filters.numero) && (
                  <p className="text-[10px] uppercase font-medium mt-2">Tente ajustar os filtros acima</p>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                {historicoEntregas.map(entrega => (
                  <div 
                    key={entrega.id} 
                    onClick={() => setSelectedEntrega(entrega)}
                    className="bg-white p-4 rounded-2xl border border-neutral-50 shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        entrega.status === 'entregue' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'
                      }`}>
                        {entrega.status === 'entregue' ? <CheckCircle2 size={20} /> : <X size={20} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-sm text-neutral-800 leading-none">Pedido #{entrega.numero}</p>
                          {(entrega as any).motoboy && (
                            <span className="text-[8px] font-bold bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                              {(entrega as any).motoboy.nome.split(' ')[0]}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-neutral-400 mt-1 truncate max-w-[150px]">
                          {new Date(entrega.created_at).toLocaleDateString()} • {entrega.endereco_entrega}
                        </p>
                        {entrega.status === 'entregue' && (
                          <div className={`flex items-center gap-1 mt-1 text-[8px] font-black uppercase tracking-wider ${entrega.acertada ? 'text-green-600' : 'text-amber-600'}`}>
                            {entrega.acertada ? (
                              <>
                                <CheckCircle2 size={10} />
                                Acertada {entrega.acertada_em && `em ${new Date(entrega.acertada_em).toLocaleDateString()}`}
                              </>
                            ) : (
                              <>
                                <AlertCircle size={10} />
                                Pendente de acerto
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {entrega.status === 'entregue' && !entrega.acertada && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleAcerto(entrega);
                          }}
                          className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl transition-all border border-amber-100 active:scale-95 flex items-center gap-1"
                          title="Marcar como acertada"
                        >
                          <DollarSign size={12} />
                          <span className="text-[9px] font-black uppercase tracking-tight">Acertar</span>
                        </button>
                      )}
                      <p className="font-black text-neutral-900 text-sm">R$ {entrega.valor?.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'integracoes' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-2xl font-black text-neutral-900">Integrações</h2>
              <p className="text-sm text-neutral-500 mt-1">Conecte serviços externos ao seu restaurante.</p>
            </div>
            <div className="bg-white border border-neutral-200 rounded-3xl p-6 flex items-center gap-4 shadow-sm">
              <div className="h-14 w-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0"><Link2 size={26} /></div>
              <div className="min-w-0">
                <h3 className="font-black text-neutral-900">MenuJunior</h3>
                <p className="text-sm text-neutral-500 mt-1">Envie automaticamente os pedidos do MenuJunior para a fila de entregas deste restaurante.</p>
                <button type="button" onClick={async () => {
                  if (!restaurante?.id) return alert('Restaurante não identificado.');
                  const { data, error } = await supabase.functions.invoke(import.meta.env.VITE_MENUJUNIOR_CONNECT_FUNCTION || 'menujunior-connect', { body: { action: 'start', restaurante_id: restaurante.id } });
                  if (error || !data?.authorization_url) return alert(data?.error || error?.message || 'Não foi possível iniciar a conexão.');
                  window.location.assign(data.authorization_url);
                }} className="inline-flex mt-4 items-center gap-2 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 transition-colors">
                  <Link2 size={16} /> Conectar MenuJunior
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'configuracoes' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative">
                <div className="h-36 w-36 rounded-[40px] overflow-hidden border-8 border-white shadow-2xl bg-neutral-100 ring-1 ring-neutral-200">
                  {isUploading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10 font-bold text-white text-[10px] uppercase">Enviando...</div>
                  ) : editData.foto_url ? (
                    <img src={editData.foto_url} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-neutral-300"><User className="h-16 w-16" /></div>
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 bg-neutral-900 text-white p-3 rounded-2xl shadow-xl cursor-pointer active:scale-90 transition-transform hover:bg-orange-500">
                  <Camera size={20} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>
              <div className="text-center">
                <h3 className="font-black text-xl text-neutral-900">{restaurante.nome}</h3>
                <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest">{restaurante.email}</p>
              </div>
            </div>

            {hasPendingRequest && (
              <div className="bg-amber-50 border-2 border-amber-100 p-5 rounded-3xl flex flex-col gap-2 text-amber-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-1 opacity-5"><Clock size={100} /></div>
                <div className="flex items-center gap-2">
                  <Clock size={18} className="shrink-0" />
                  <p className="font-black uppercase text-xs tracking-tight">Solicitação em análise</p>
                </div>
                <p className="text-xs font-semibold leading-relaxed">Você possui uma solicitação de alteração de dados aguardando a aprovação da administração. Novos pedidos podem ser feitos normalmente.</p>
              </div>
            )}

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-2">Nome do Estabelecimento</label>
                <input 
                  type="text" 
                  value={editData.nome}
                  onChange={e => setEditData({...editData, nome: e.target.value})}
                  placeholder="Nome do seu restaurante"
                  className="w-full px-5 py-4 bg-white border border-neutral-100 rounded-2xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 font-bold transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-2">Telefone</label>
                <input 
                  type="text" 
                  value={editData.telefone}
                  onChange={e => setEditData({...editData, telefone: e.target.value})}
                  placeholder="(00) 00000-0000"
                  className="w-full px-5 py-4 bg-white border border-neutral-100 rounded-2xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 font-bold transition-all"
                />
              </div>

              <div className="space-y-1.5 font-bold">
                <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-2">Endereço Completo</label>
                <textarea 
                  value={editData.endereco}
                  onChange={e => setEditData({...editData, endereco: e.target.value})}
                  placeholder="Rua, número, complemento e bairro"
                  className="w-full px-5 py-4 bg-white border border-neutral-100 rounded-2xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 font-bold transition-all h-28 resize-none shadow-sm"
                />
              </div>

              {/* Informações Pix para Repasse (Apenas quando PagBank estiver ativo) */}
              {configDistribuicao?.pagbank_ativo && (
                <div className="border-t border-neutral-100/80 pt-5 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-1.5 w-1.5 bg-orange-500 rounded-full animate-pulse" />
                    <p className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-widest">Informações de Repasse (Conta Pix)</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-2">Nome Completo do Titular</label>
                      <input 
                        type="text" 
                        value={editData.pix_nome_completo}
                        onChange={e => setEditData({...editData, pix_nome_completo: e.target.value})}
                        placeholder="Nome completo do titular da conta"
                        className="w-full px-5 py-4 bg-white border border-neutral-100 rounded-2xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 font-bold transition-all shadow-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-2">CPF do Titular</label>
                      <input 
                        type="text" 
                        value={editData.pix_cpf}
                        onChange={e => setEditData({...editData, pix_cpf: e.target.value})}
                        placeholder="000.000.000-00"
                        className="w-full px-5 py-4 bg-white border border-neutral-100 rounded-2xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 font-bold transition-all shadow-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-2">Chave Pix Aleatória</label>
                      <input 
                        type="text" 
                        value={editData.pix_chave}
                        onChange={e => setEditData({...editData, pix_chave: e.target.value})}
                        placeholder="Chave Pix para recebimento"
                        className="w-full px-5 py-4 bg-white border border-neutral-100 rounded-2xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 font-bold transition-all shadow-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-2">Conta PagBank</label>
                      <input 
                        type="text" 
                        value={editData.pagbank_conta}
                        onChange={e => setEditData({...editData, pagbank_conta: e.target.value})}
                        placeholder="Número da conta PagBank"
                        className="w-full px-5 py-4 bg-white border border-neutral-100 rounded-2xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 font-bold transition-all shadow-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-2">Dígito da conta</label>
                      <input 
                        type="text" 
                        value={editData.pagbank_digito}
                        onChange={e => setEditData({...editData, pagbank_digito: e.target.value})}
                        placeholder="Dígito da conta"
                        className="w-full px-5 py-4 bg-white border border-neutral-100 rounded-2xl outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-500 font-bold transition-all shadow-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Alertas Sonoros Switch */}
              <div className="border-t border-neutral-100/80 pt-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 bg-orange-500 rounded-full animate-pulse" />
                  <p className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-widest">Alertas e Notificações</p>
                </div>

                <div className="bg-neutral-50/50 border border-neutral-100 rounded-3xl p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${canPlayAudio ? 'bg-orange-100 text-orange-600' : 'bg-neutral-200 text-neutral-400'} transition-all`}>
                      {canPlayAudio ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    </div>
                    <div>
                      <p className="font-extrabold text-neutral-800 text-sm">Permitir Alertas Sonoros</p>
                      <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-tight mt-0.5">
                        {canPlayAudio ? 'Alertas sonoros ativos para mensagens' : 'Silenciado - ative para receber alertas'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={toggleAlertasSonoros}
                    type="button"
                    className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 focus:outline-none shrink-0 ${canPlayAudio ? 'bg-orange-500' : 'bg-neutral-300'}`}
                  >
                    <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-200 ${canPlayAudio ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={handleSaveProfile}
                  disabled={isSaving || isUploading}
                  className="w-full h-16 bg-neutral-900 text-white font-black rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xl shadow-xl disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                  Solicitar Alteração
                </button>
              </div>
            </div>
          </div>
        )}


        {view === 'repasses' && isPagbankAtivo && (
          <MeusRepassesRestaurante restaurante={restaurante} />
        )}
      </main>)}

      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-neutral-200/80 px-4 py-2 flex justify-around items-center z-50 shadow-lg">
        <button 
          onClick={() => setView('entregas')} 
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
            view === 'entregas' ? 'text-orange-600 bg-orange-50 font-black' : 'text-neutral-400 hover:text-neutral-600 font-semibold'
          }`}
        >
          <Package className="h-5 w-5" />
          <span className="text-[10px] uppercase tracking-wider">Entregas</span>
        </button>
        <button 
          onClick={() => setView('historico')} 
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
            view === 'historico' ? 'text-orange-600 bg-orange-50 font-black' : 'text-neutral-400 hover:text-neutral-600 font-semibold'
          }`}
        >
          <History className="h-5 w-5" />
          <span className="text-[10px] uppercase tracking-wider">Histórico</span>
        </button>
        {isPagbankAtivo && (
          <button 
            onClick={() => setView('repasses')} 
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
              view === 'repasses' ? 'text-orange-600 bg-orange-50 font-black' : 'text-neutral-400 hover:text-neutral-600 font-semibold'
            }`}
          >
            <Receipt className="h-5 w-5" />
            <span className="text-[10px] uppercase tracking-wider">Repasses</span>
          </button>
        )}
        <button
          onClick={() => setView('integracoes')}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${view === 'integracoes' ? 'text-orange-600 bg-orange-50 font-black' : 'text-neutral-400 hover:text-neutral-600 font-semibold'}`}
        >
          <Link2 className="h-5 w-5" />
          <span className="text-[10px] uppercase tracking-wider">Integrações</span>
        </button>
        <button 
          onClick={() => setView('configuracoes')} 
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
            view === 'configuracoes' ? 'text-orange-600 bg-orange-50 font-black' : 'text-neutral-400 hover:text-neutral-600 font-semibold'
          }`}
        >
          <Settings className="h-5 w-5" />
          <span className="text-[10px] uppercase tracking-wider">Perfil</span>
        </button>
      </div>

      <AnimatePresence>
        {selectedEntrega && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEntrega(null)}
              className="fixed inset-0 bg-black/40 z-[100] backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white z-[110] rounded-t-[40px] max-h-[90vh] overflow-y-auto shadow-2xl safe-m-bottom"
            >
              <div className="sticky top-0 bg-white/80 backdrop-blur-md px-6 py-4 border-b border-neutral-100 flex items-center justify-between z-10">
                <div>
                  <h3 className="font-black text-lg uppercase tracking-tighter">Pedido #{selectedEntrega.numero}</h3>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">{getStatusLabel(selectedEntrega.status)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {empresa?.permitir_chat_entrega && ['aceita', 'coletada', 'em_rota'].includes(selectedEntrega.status) && (
                    <button 
                      onClick={() => setIsChatOpen(true)}
                      className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center transition-colors active:scale-90"
                      title="Abrir Chat"
                    >
                      <MessageSquare size={18} />
                    </button>
                  )}
                  {podeEditarPedido && !['entregue', 'cancelada'].includes(selectedEntrega.status) && !isEditingPedido && (
                    <button 
                      onClick={() => handleEditPedido(selectedEntrega)}
                      className="w-10 h-10 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center transition-colors active:scale-90"
                      title="Editar Pedido"
                    >
                      <Pencil size={18} />
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setSelectedEntrega(null);
                      setIsEditingPedido(false);
                    }}
                    className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-400"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {isEditingPedido ? (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Código/Número do Pedido</label>
                      <input 
                        type="text"
                        value={pedidoEditForm.numero}
                        onChange={e => setPedidoEditForm({...pedidoEditForm, numero: e.target.value})}
                        className="w-full h-12 px-4 bg-neutral-50 border border-neutral-100 rounded-2xl outline-none font-bold"
                      />
                    </div>

                    {/* Opção Pedido iFood */}
                    <div className="p-3.5 bg-neutral-50 border border-neutral-100 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-neutral-800">Pedido iFood?</span>
                          <p className="text-[10px] text-neutral-500 font-medium">Ative se esta entrega veio do iFood</p>
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
                          <div className="w-10 h-5 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                        </label>
                      </div>

                      {pedidoEditForm.is_ifood && (
                        <div className="space-y-1 pt-1 animate-in fade-in duration-200">
                          <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest ml-1">
                            Localizador do pedido iFood *
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="80083230"
                            value={pedidoEditForm.ifood_localizador}
                            onChange={(e) => setPedidoEditForm(p => ({ ...p, ifood_localizador: e.target.value.replace(/\D/g, '') }))}
                            className="w-full h-10 px-3 bg-white border border-neutral-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-mono text-xs font-bold text-neutral-900"
                          />
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Nome do Cliente</label>
                        <input 
                          type="text"
                          value={pedidoEditForm.cliente_nome}
                          onChange={e => setPedidoEditForm({...pedidoEditForm, cliente_nome: e.target.value})}
                          className="w-full h-12 px-4 bg-neutral-50 border border-neutral-100 rounded-2xl outline-none font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Telefone</label>
                        <input 
                          type="text"
                          value={pedidoEditForm.cliente_telefone}
                          onChange={e => setPedidoEditForm({...pedidoEditForm, cliente_telefone: e.target.value})}
                          className="w-full h-12 px-4 bg-neutral-50 border border-neutral-100 rounded-2xl outline-none font-bold"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Endereço de Entrega</label>
                      <AddressAutocomplete 
                        value={pedidoEditForm.endereco_entrega}
                        onChange={(address, lat, lng) => {
                          setPedidoEditForm(prev => ({
                            ...prev, 
                            endereco_entrega: address,
                            latitude_entrega: lat || null,
                            longitude_entrega: lng || null
                          }));
                        }}
                        className="!h-14 !py-0 !rounded-2xl"
                        locationBias={restaurante.latitude && restaurante.longitude ? { 
                          lat: restaurante.latitude, 
                          lng: restaurante.longitude 
                        } : undefined}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Valor da Entrega (R$)</label>
                      <input 
                        type="text"
                        readOnly
                        placeholder="0,00"
                        value={pedidoEditForm.valor}
                        className="w-full h-12 px-4 bg-neutral-100 border border-neutral-100 rounded-2xl outline-none font-bold text-neutral-500 cursor-not-allowed"
                      />
                      <p className="text-[8px] text-neutral-400 font-bold uppercase ml-1 italic">Calculado automaticamente</p>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Forma de Pagamento *</label>
                      
                      {!(empresa?.aceita_pagamento_pix || empresa?.aceita_pagamento_credito || empresa?.aceita_pagamento_debito || empresa?.aceita_pagamento_dinheiro || empresa?.aceita_pedido_ja_pago) ? (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                          <p className="text-[10px] text-red-600 font-bold uppercase text-center">Nenhuma forma de pagamento liberada.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
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
                              onClick={() => setPedidoEditForm({ ...pedidoEditForm, forma_pagamento: p.label })}
                              className={`py-3 rounded-xl border-2 transition-all text-[10px] font-black uppercase text-center ${
                                pedidoEditForm.forma_pagamento === p.label
                                  ? 'border-orange-500 bg-orange-50 text-orange-600'
                                  : 'border-neutral-100 bg-neutral-50 text-neutral-400 hover:border-neutral-200'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Observação</label>
                      <textarea 
                        value={pedidoEditForm.observacao}
                        onChange={e => setPedidoEditForm({...pedidoEditForm, observacao: e.target.value})}
                        className="w-full h-20 p-4 bg-neutral-50 border border-neutral-100 rounded-2xl outline-none font-bold resize-none"
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={() => setIsEditingPedido(false)}
                        className="flex-1 h-16 bg-neutral-100 text-neutral-500 font-black rounded-3xl uppercase text-xs tracking-widest"
                      >
                        Cancelar
                      </button>
                      <button 
                        onClick={handleSavePedidoEdit}
                        disabled={isSaving}
                        className="flex-2 h-16 bg-orange-500 text-white font-black rounded-3xl uppercase text-xs tracking-widest shadow-lg shadow-orange-100 flex items-center justify-center gap-2"
                      >
                        {isSaving ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                        Salvar Alterações
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Detalhes do Pedido */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-neutral-50 p-4 rounded-3xl space-y-1">
                        <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Cliente</label>
                        <p className="font-bold text-sm">{selectedEntrega.cliente_nome || 'N/A'}</p>
                        <p className="text-xs text-neutral-500 font-medium">{selectedEntrega.cliente_telefone || 'Sem telefone'}</p>
                      </div>
                      <div className="bg-neutral-50 p-4 rounded-3xl space-y-1">
                        <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Valor do Pedido</label>
                        <p className="font-black text-orange-600 text-lg">R$ {(selectedEntrega.valor_pedido || selectedEntrega.valor || 0).toFixed(2)}</p>
                      </div>
                    </div>

                    {/* Resumo Financeiro Dinâmico do Pagamento */}
                    {(() => {
                      const liveValorPedido = financeSelectedState && financeSelectedState.id === selectedEntrega.id
                        ? financeSelectedState.valor_pedido
                        : (selectedEntrega.valor_pedido || selectedEntrega.valor || 0);

                      const liveTotalPagbank = financeSelectedState && financeSelectedState.id === selectedEntrega.id
                        ? financeSelectedState.total_pagbank
                        : getPagbankTotalForEntrega(selectedEntrega.id);

                      const liveValorPagoDinheiro = financeSelectedState && financeSelectedState.id === selectedEntrega.id
                        ? financeSelectedState.valor_pago_dinheiro
                        : (selectedEntrega.valor_pago_dinheiro || 0);

                      const liveSaldoRestante = financeSelectedState && financeSelectedState.id === selectedEntrega.id
                        ? financeSelectedState.saldo_restante
                        : Math.max(0, liveValorPedido - liveTotalPagbank - liveValorPagoDinheiro);

                      const livePagamentoStatus = financeSelectedState && financeSelectedState.id === selectedEntrega.id
                        ? financeSelectedState.pagamento_status
                        : selectedEntrega.pagamento_status;

                      return (
                        <>
                          <div className="bg-neutral-50 p-5 rounded-[24px] border border-neutral-100 space-y-3">
                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest border-b border-neutral-200/60 pb-1.5 flex justify-between items-center">
                              <span>Resumo Financeiro de Pagamento</span>
                              {livePagamentoStatus === 'pago_parcial' && (
                                <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md uppercase tracking-tight">
                                  🟡 Pago Parcial
                                </span>
                              )}
                            </p>
                            <div className="space-y-2 text-xs font-semibold text-neutral-600">
                              <div className="flex justify-between items-center">
                                <span>Total do Pedido:</span>
                                <span className="font-extrabold text-neutral-900">R$ {liveValorPedido.toFixed(2)}</span>
                              </div>
                              {configDistribuicao?.pagbank_ativo && (
                                <div className="flex justify-between items-center">
                                  <span>Recebido via Cartão (PagBank):</span>
                                  <span className="font-extrabold text-indigo-600">R$ {liveTotalPagbank.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between items-center">
                                <span>Recebido em Dinheiro (com o motoboy):</span>
                                <span className="font-extrabold text-emerald-600">R$ {liveValorPagoDinheiro.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center border-t border-dashed border-neutral-200/60 pt-2 font-black text-sm">
                                <span className="text-neutral-800">Saldo Restante:</span>
                                <span className={`${liveSaldoRestante <= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  R$ {liveSaldoRestante.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {configDistribuicao?.pagbank_ativo && liveTotalPagbank > 0 && (
                            <button
                              type="button"
                              onClick={() => handleEstornarCartaoRestaurante(selectedEntrega.id)}
                              className="w-full mt-2 py-3 bg-red-50 hover:bg-red-100 active:scale-95 transition-all text-xs font-black text-red-600 uppercase tracking-widest rounded-2xl border border-red-200 flex items-center justify-center gap-2"
                            >
                              <XCircle size={14} /> Corrigir / Estornar Valor do Cartão
                            </button>
                          )}
                        </>
                      );
                    })()}

                    <div className="bg-neutral-50 p-4 rounded-3xl space-y-1">
                      <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                        <MapPin size={10} /> Endereço de Entrega
                      </p>
                      <p className="font-bold text-sm leading-tight">{selectedEntrega.endereco_entrega}</p>
                    </div>

                    {selectedEntrega.status === 'entregue' && (
                      <div className={`p-4 rounded-3xl border-2 flex items-center justify-between shadow-sm ${selectedEntrega.acertada ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${selectedEntrega.acertada ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'}`}>
                            {selectedEntrega.acertada ? <CheckCircle2 size={24} /> : <DollarSign size={24} />}
                          </div>
                          <div>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${selectedEntrega.acertada ? 'text-green-600' : 'text-amber-600'}`}>
                              Status do Acerto
                            </p>
                            <p className={`font-black text-sm uppercase ${selectedEntrega.acertada ? 'text-green-700' : 'text-amber-700'}`}>
                              {selectedEntrega.acertada ? 'Entrega Acertada' : 'Pendente de Acerto'}
                            </p>
                            {selectedEntrega.acertada_em && (
                              <p className="text-[9px] font-bold text-green-600 uppercase mt-0.5">
                                Acertado em: {new Date(selectedEntrega.acertada_em).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        {!selectedEntrega.acertada && (
                          <button 
                            onClick={() => handleToggleAcerto(selectedEntrega)}
                            className="bg-amber-600 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-200 active:scale-95 transition-all"
                          >
                            Marcar como acertada
                          </button>
                        )}
                      </div>
                    )}

                    {selectedEntrega.observacao && (
                      <div className="bg-orange-50/50 p-4 rounded-3xl space-y-1 border border-orange-100/50">
                        <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest">Observação</p>
                        <p className="text-xs text-orange-900 font-medium leading-relaxed italic">"{selectedEntrega.observacao}"</p>
                      </div>
                    )}

                    {selectedEntrega.motoboy && (
                      <div className="p-4 rounded-3xl border border-neutral-100 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-neutral-100 overflow-hidden shrink-0 border-2 border-white shadow-md">
                          {selectedEntrega.motoboy.foto_url ? (
                            <img src={selectedEntrega.motoboy.foto_url} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-300 bg-neutral-50">
                              <User size={24} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Motoboy Responsável</p>
                          <p className="font-bold text-neutral-900">{selectedEntrega.motoboy.nome}</p>
                          {selectedEntrega.motoboy.telefone && (
                            <a 
                              href={`tel:${selectedEntrega.motoboy.telefone}`} 
                              className="text-xs font-black text-orange-500 mt-1 flex items-center gap-1 hover:underline"
                            >
                              <Phone size={10} /> {selectedEntrega.motoboy.telefone}
                            </a>
                          )}
                          {['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(selectedEntrega.status) && motoboyLocation && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${formatLocationTime(motoboyLocation.ultima_localizacao_em).isOutdated ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                              <span className={`text-[10px] font-extrabold ${formatLocationTime(motoboyLocation.ultima_localizacao_em).isOutdated ? 'text-red-600' : 'text-emerald-600'}`}>
                                {formatLocationTime(motoboyLocation.ultima_localizacao_em).text}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Comprovante de Entrega do Motoboy */}
                    {(selectedEntrega.observacao_motoboy || selectedEntrega.comprovante_entrega_url) && (
                      <div className="p-4 rounded-3xl border border-indigo-100 bg-indigo-50/30 space-y-3">
                        <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                          <Camera size={12} /> Comprovante de Entrega
                        </h4>
                        
                        {selectedEntrega.observacao_motoboy && (
                          <div className="space-y-1">
                            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none">Observação do Motoboy</p>
                            <p className="text-xs text-neutral-700 font-medium italic">"{selectedEntrega.observacao_motoboy}"</p>
                          </div>
                        )}
                        
                        {selectedEntrega.comprovante_entrega_url && (
                          <div className="space-y-2">
                            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none">Foto Comprovante</p>
                            <div className="relative aspect-video rounded-2xl overflow-hidden border border-white shadow-sm cursor-pointer group">
                              <img 
                                src={selectedEntrega.comprovante_entrega_url} 
                                alt="Comprovante" 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                                onClick={() => window.open(selectedEntrega.comprovante_entrega_url, '_blank')}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                                <ExternalLink size={20} className="text-white opacity-0 group-hover:opacity-100 transition-all" />
                              </div>
                            </div>
                            {selectedEntrega.comprovante_entrega_em && (
                              <p className="text-[8px] text-neutral-400 font-bold uppercase text-right">
                                Enviado em: {new Date(selectedEntrega.comprovante_entrega_em).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Linha do Tempo/Histórico da Entrega */}
                    <div className="space-y-4 pt-4 border-t border-neutral-100">
                      <h4 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                        <History size={12} className="text-orange-500" /> Histórico da Entrega
                      </h4>
                      
                      {loadingHistorico ? (
                        <div className="flex items-center gap-2 py-4">
                          <Loader2 size={16} className="animate-spin text-orange-500" />
                          <span className="text-[10px] font-bold text-neutral-400 uppercase">Carregando eventos...</span>
                        </div>
                      ) : historicoStatus.length === 0 ? (
                        <div className="p-4 bg-neutral-50 rounded-2xl text-center">
                          <p className="text-[10px] font-bold text-neutral-400 uppercase">Nenhum evento registrado</p>
                        </div>
                      ) : (
                        <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-neutral-100">
                          {historicoStatus.map((step, idx) => {
                            const isLast = idx === historicoStatus.length - 1;
                            
                            return (
                              <div key={`${step.id || idx}-${idx}`} className="relative group">
                                <div className={`absolute left-[-23px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 transition-all ${isLast ? 'bg-orange-500 scale-125' : 'bg-neutral-300'}`} />
                                <div className="flex flex-col">
                                  <p className={`text-[11px] font-black leading-none uppercase tracking-tighter ${isLast ? 'text-neutral-900' : 'text-neutral-500'}`}>
                                    {step.descricao}
                                  </p>
                                  <p className="text-[9px] font-bold text-neutral-400 mt-1 uppercase">
                                    {formatTimelineDate(step.created_at)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {!isEditingPedido && (
                      <div className="pt-2">
                        {selectedEntrega.status === 'aguardando_despacho' && (
                          <div className="pt-2">
                            <button
                              onClick={() => handleChamarMotoboy(selectedEntrega.id)}
                              className="w-full h-16 bg-orange-500 text-white font-black rounded-3xl uppercase text-xs tracking-widest shadow-lg shadow-orange-100 flex items-center justify-center gap-3 active:scale-95 transition-all"
                            >
                              <Bike className="h-6 w-6" /> Chamar Motoboy
                            </button>
                          </div>
                        )}

                        {getCanCancel(selectedEntrega) ? (
                          <button
                            onClick={() => handleCancelPedido(selectedEntrega.id)}
                            className="w-full h-14 bg-red-50 text-red-600 font-black rounded-3xl uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 border border-red-100 active:scale-95 transition-all"
                          >
                            <XCircle size={14} /> Cancelar Pedido
                          </button>
                        ) : !['entregue', 'cancelada'].includes(selectedEntrega.status) && (
                          <div className="w-full p-4 bg-neutral-50 rounded-3xl text-center border border-neutral-100">
                            <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-tight">
                              Prazo para cancelamento expirado
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="h-4" />
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-md"
            />
            <motion.div 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-white z-[70] shadow-2xl p-6 flex flex-col"
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
                  onClick={() => { setView('integracoes'); setIsMenuOpen(false); }}
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

      <NovoPedidoModal 
        isOpen={isNovoPedidoOpen}
        onClose={() => setIsNovoPedidoOpen(false)}
        restaurante={restaurante}
        empresa={empresa}
        configDistribuicao={configDistribuicao}
        onSuccess={() => {
          fetchEntregas();
          setView('entregas');
        }}
      />

      <audio 
        ref={chatAudioRef}
        src="https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3"
        preload="auto"
      />

      <AnimatePresence>
        {chatNotification?.show && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-4 right-4 z-[200] bg-indigo-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <MessageSquare size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80 leading-none">Chat</p>
                <p className="text-sm font-bold uppercase tracking-tight">{chatNotification.message}</p>
              </div>
            </div>
            <button 
              onClick={() => {
                const ent = entregasAtivas.find(e => e.id === chatNotification.entregaId);
                if (ent) {
                  setSelectedEntrega(ent);
                  setIsChatOpen(true);
                }
                setChatNotification(null);
              }}
              className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
            >
              Abrir
            </button>
          </motion.div>
        )}
        
      </AnimatePresence>

      <AnimatePresence>
        {isChatOpen && selectedEntrega && (
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
                entrega={selectedEntrega}
                remetenteTipo="restaurante"
                remetenteNome={restaurante?.nome || 'Restaurante'}
                onClose={() => setIsChatOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSelecaoMotoboyOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsSelecaoMotoboyOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[80vh]"
            >
              <div className="p-6 bg-orange-500 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-black text-xl uppercase tracking-tighter">Escolha o Motoboy</h3>
                  <p className="text-[10px] uppercase font-bold opacity-80 tracking-widest">Apenas motoboys online</p>
                </div>
                <button onClick={() => setIsSelecaoMotoboyOpen(false)} className="p-2 bg-white/10 rounded-xl">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMotoboys ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-4 text-neutral-400">
                    <Loader2 className="animate-spin" />
                    <p className="text-xs font-bold uppercase tracking-widest">Buscando motoboys...</p>
                  </div>
                ) : onlineMotoboys.length === 0 ? (
                  <div className="text-center py-12 px-6">
                    <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-neutral-100">
                      <Bike className="text-neutral-200" />
                    </div>
                    <p className="text-neutral-500 font-bold text-sm italic">Nenhum motoboy online no momento.</p>
                  </div>
                ) : (
                  onlineMotoboys.map(motoboy => (
                    <button
                      key={motoboy.id}
                      type="button"
                      onClick={() => handleSelectMotoboyManual(motoboy.id)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border border-neutral-100 shadow-sm hover:border-orange-200 hover:bg-orange-50 transition-all active:scale-[0.98] text-left group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-neutral-100 overflow-hidden border border-neutral-100 shrink-0">
                        {motoboy.foto_url ? (
                          <img src={motoboy.foto_url} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-orange-50 text-orange-500">
                            <User size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-neutral-900 group-hover:text-orange-600 transition-colors truncate">{motoboy.nome}</p>
                        <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">{motoboy.telefone || 'Sem telefone'}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center text-neutral-300 group-hover:bg-orange-500 group-hover:text-white transition-all shadow-sm">
                        <ChevronRight size={20} />
                      </div>
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