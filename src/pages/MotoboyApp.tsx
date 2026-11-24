import { useEffect, useState, ChangeEvent, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Entrega, Motoboy, HistoricoEntrega } from '../types';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { 
  Package, 
  MapPin, 
  CheckCircle, 
  Navigation, 
  LogOut, 
  Box,
  AlertCircle,
  Truck,
  User,
  History,
  Loader2,
  Menu,
  X,
  Settings,
  ChevronRight,
  Phone,
  Camera,
  Save,
  Circle,
  Clock,
  Ban,
  ExternalLink,
  DollarSign,
  MessageSquare,
  CreditCard
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import ChatEntrega from '../components/chat/ChatEntrega';

export default function MotoboyApp() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any | null>(null);
  const [motoboy, setMotoboy] = useState<Motoboy | null>(null);
  const [empresaLocal, setEmpresaLocal] = useState<any>(null);
  const [pagbankAtivo, setPagbankAtivo] = useState(false);
  const [limiteEntregas, setLimiteEntregas] = useState<number | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [bloqueios, setBloqueios] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [tab, setTab] = useState<'disponiveis' | 'minhas' | 'historico'>('disponiveis');
  const [view, setView] = useState<'entregas' | 'configuracoes'>('entregas');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedEntrega, setSelectedEntrega] = useState<Entrega | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chatAudioRef = useRef<HTMLAudioElement | null>(null);
  const [canPlayAudioChat, setCanPlayAudioChat] = useState(false);
  const [chatNotification, setChatNotification] = useState<{ show: boolean, message: string, entregaId: string } | null>(null);
  const alertIntervalRef = useRef<any>(null);
  const motoboyRef = useRef<Motoboy | null>(null);
  const menuJuniorStartSyncCompletedRef = useRef<Set<string>>(new Set());
  const menuJuniorStartSyncInFlightRef = useRef<Set<string>>(new Set());
  const menuJuniorStartSyncLastAttemptRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    motoboyRef.current = motoboy;
  }, [motoboy]);

  // Estados Edição Perfil
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editData, setEditData] = useState({
    nome: '',
    telefone: '',
    foto_url: ''
  });

  const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);
  const [selectedEntregaForObs, setSelectedEntregaForObs] = useState<Entrega | null>(null);
  const [obsText, setObsText] = useState('');
  const [obsPhoto, setObsPhoto] = useState<File | null>(null);
  const [obsPhotoPreview, setObsPhotoPreview] = useState<string | null>(null);
  const [isSavingObs, setIsSavingObs] = useState(false);

  // States of Mercado Pago card payment modal
  const [isCobrarModalOpen, setIsCobrarModalOpen] = useState(false);
  const [cobrarEntrega, setCobrarEntrega] = useState<Entrega | null>(null);
  const [valorCobrarInput, setValorCobrarInput] = useState<string>('');
  const [valorPagoState, setValorPagoState] = useState<number>(0);
  const [isEnviandoCobranca, setIsEnviandoCobranca] = useState(false);
  const [cobrancaStatus, setCobrancaStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isRecebendoDinheiro, setIsRecebendoDinheiro] = useState(false);

  // States of Date Filters for Histórico
  const [filterType, setFilterType] = useState<'hoje' | 'ontem' | 'semana' | 'mes' | 'personalizado'>('hoje');
  const [startDateInput, setStartDateInput] = useState<string>('');
  const [endDateInput, setEndDateInput] = useState<string>('');

  // Map of status history for each delivery ID
  const [historicoStatusMap, setHistoricoStatusMap] = useState<Record<string, HistoricoEntrega[]>>({});
  const [pagamentosPagbank, setPagamentosPagbank] = useState<any[]>([]);
  const [saldosRestantes, setSaldosRestantes] = useState<Record<string, number>>({});
  const [totalPedido, setTotalPedido] = useState(0);
  const [saldoPendente, setSaldoPendente] = useState(0);
  const [configDistribuicao, setConfigDistribuicao] = useState<{
    modo_distribuicao?: 'todos_online' | 'raio_progressivo' | 'manual';
    raio_inicial_km?: number;
    raio_incremento_km?: number;
    tempo_expansao_minutos?: number;
  } | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isGpsChecking, setIsGpsChecking] = useState<boolean>(true);
  const lastDbLocationUpdateRef = useRef<number>(0);
  const lastSentCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const entregasRef = useRef<Entrega[]>(entregas);
  const gpsErrorStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    entregasRef.current = entregas;
  }, [entregas]);
  const [nowTick, setNowTick] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        const currentUser = data?.user;
        if (error || !currentUser) {
          navigate('/app-motoboy/login');
        } else {
          setUser(currentUser);
        }
      } catch (err) {
        console.error('Erro ao verificar auth:', err);
        navigate('/app-motoboy/login');
      }
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    // Sincronizar totalPedido e saldoPendente com a entrega ativa
    const activeDeliv = entregas.find(e => e.motoboy_id === motoboy?.id && ['em_rota', 'pagamento_errado'].includes(e.status?.toLowerCase() || ''))
      || entregas.find(e => e.motoboy_id === motoboy?.id && ['coletada', 'aceita'].includes(e.status?.toLowerCase() || ''))
      || entregas.find(e => e.motoboy_id === motoboy?.id)
      || entregas[0];

    if (activeDeliv) {
      const valorPed = activeDeliv.valor_pedido || 0;
      setTotalPedido(valorPed);
      const s = saldosRestantes[activeDeliv.id] !== undefined ? saldosRestantes[activeDeliv.id] : getSaldoRestante(activeDeliv);
      setSaldoPendente(s);
    }
  }, [entregas, saldosRestantes, motoboy?.id]);

  useEffect(() => {
    if (user) {
      fetchMotoboyProfile(user.id);
    }
  }, [user]);

  useEffect(() => {
    if (motoboy) {
      const channel = supabase
        .channel(`motoboy_chats_${motoboy.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_entregas',
            filter: `motoboy_id=eq.${motoboy.id}`
          },
          (payload) => {
            const newMessage = payload.new as any;
            if (newMessage.remetente_tipo !== 'motoboy') {
              if (!(isChatOpen && selectedEntrega?.id === newMessage.entrega_id)) {
                playChatNotificationSound();
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
  }, [motoboy, isChatOpen, selectedEntrega?.id]);

  const playChatNotificationSound = () => {
    if (chatAudioRef.current && canPlayAudioChat) {
      chatAudioRef.current.currentTime = 0;
      chatAudioRef.current.play().catch(e => console.log('Audio play blocked', e));
    }
  };

  const openChatForEntregaId = async (entregaId: string) => {
    if (!entregaId) return;
    let ent = entregas.find(e => e.id === entregaId);
    if (!ent) {
      try {
        const { data } = await supabase
          .from('entregas')
          .select('*, restaurantes (nome), motoboys (nome)')
          .eq('id', entregaId)
          .maybeSingle();
        if (data) ent = data as any;
      } catch (err) {
        console.error('Erro ao buscar entrega do chat:', err);
      }
    }
    if (ent) {
      setSelectedEntrega(ent);
      setView('entregas');
      setTab('minhas');
      setIsChatOpen(true);
    }
  };

  useEffect(() => {
    if (motoboy) {
      fetchEntregas();
      carregarValoresFinais();
      fetchBloqueios();
      fetchEmpresaLocal(motoboy.empresa_id);
      checkPendingRequest();
      setEditData({
        nome: motoboy.nome || '',
        telefone: motoboy.telefone || '',
        foto_url: motoboy.foto_url || ''
      });
      
      const subscription = supabase
        .channel(`realtime_motoboy_${motoboy.id}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'entregas'
        }, (payload: any) => {
          if (payload.eventType === 'UPDATE') {
            const newRecord = payload.new as any;
            if (newRecord && newRecord.status === 'pagamento_errado') {
              setIsCobrarModalOpen(false);
              setCobrancaStatus(null);
              setIsEnviandoCobranca(false);
              
              setEntregas(prev => prev.map(e => e.id === newRecord.id ? { ...e, ...newRecord, pago: false } : e));
              
              if (motoboy) {
                supabase
                  .from('motoboys')
                  .update({ entrega_ativa_id: null })
                  .eq('id', motoboy.id)
                  .then(() => {
                    setMotoboy(prev => prev ? { ...prev, entrega_ativa_id: null } : null);
                  });
              }

              try {
                navigator.vibrate?.([200, 100, 200]);
              } catch (vibErr) {
                console.warn('Vibration not supported or blocked:', vibErr);
              }
            }
          }
          fetchEntregas();
          carregarValoresFinais();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'pagamentos_pagbank'
        }, () => {
          fetchEntregas();
          carregarValoresFinais();
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'motoboys',
          filter: `id=eq.${motoboy.id}`
        }, (payload) => {
          setMotoboy(payload.new as Motoboy);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'bloqueios_motoboy_restaurante',
          filter: `motoboy_id=eq.${motoboy.id}`
        }, () => {
          fetchBloqueios();
          fetchEntregas();
          carregarValoresFinais();
        })
        .subscribe();

      // 🚀 REDE DE SEGURANÇA ULTRA-RÁPIDA (5 SEGUNDOS):
      const cronometroSeguranca = setInterval(() => {
        console.log("Sincronização de segurança de 5s executada.");
        fetchEntregas();
        carregarValoresFinais();
      }, 5000); // 5000 ms = 5 segundos

      return () => {
        subscription.unsubscribe();
        stopAlertSound();
        clearInterval(cronometroSeguranca); // Limpa o cronômetro ao fechar a tela
      };
    }
  }, [motoboy?.id]);

  useEffect(() => {
    if (!motoboy || !motoboy.id) return;
    let watchId: number | null = null;
    if (navigator.geolocation) {
      setIsGpsChecking(true);
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          if (gpsErrorStartTimeRef.current !== null) {
            console.log("GPS recuperado");
            gpsErrorStartTimeRef.current = null;
          }
          setCurrentCoords({ latitude, longitude });
          setGeoError(null);
          setIsGpsChecking(false);

          if (motoboy.status !== 'offline') {
            const hasActiveDelivery = entregasRef.current.some(e => e.motoboy_id === motoboy.id && ['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(e.status));
            const intervalMs = hasActiveDelivery ? 5000 : 30000;
            const now = Date.now();

            const lastSent = lastSentCoordsRef.current;
            const movedMeters = lastSent
              ? calculateDistance(lastSent.latitude, lastSent.longitude, latitude, longitude)
              : Infinity;

            const timeElapsed = now - lastDbLocationUpdateRef.current;
            const shouldSend = movedMeters >= 20 || timeElapsed >= intervalMs;

            if (shouldSend) {
              lastDbLocationUpdateRef.current = now;
              lastSentCoordsRef.current = { latitude, longitude };
              try {
                const { data, error } = await supabase
                  .from('localizacoes_motoboys')
                  .upsert({
                    empresa_id: motoboy.empresa_id,
                    motoboy_id: motoboy.id,
                    latitude,
                    longitude,
                    ultima_localizacao_em: new Date().toISOString(),
                  }, { onConflict: 'motoboy_id' });

                console.log('Resultado do upsert:', data);

                if (error) {
                  console.error('Erro do upsert localizacoes_motoboys:', error);
                } else {
                  console.log('Upsert realizado com sucesso.');
                }
              } catch (err) {
                console.error('GPS update error:', err);
              }
            }
          }
        },
        async (error) => {
          console.error('GPS error:', error);
          const msg = error.code === error.PERMISSION_DENIED
            ? 'Permissão de localização negada. O GPS é obrigatório para receber entregas.'
            : 'Erro ao obter sua localização. Verifique o GPS.';
          setGeoError(msg);
          setCurrentCoords(null);
          setIsGpsChecking(false);

          if (gpsErrorStartTimeRef.current === null) {
            gpsErrorStartTimeRef.current = Date.now();
            console.log("GPS indisponível");
          }

          const secondsWithoutGps = Math.floor((Date.now() - gpsErrorStartTimeRef.current) / 1000);
          console.log(`Tempo sem GPS: ${secondsWithoutGps} segundos`);

          const active = entregasRef.current.some(e => e.motoboy_id === motoboy.id && ['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(e.status));
          if (motoboy.status !== 'offline' && !active) {
            if (Date.now() - gpsErrorStartTimeRef.current >= 120000) {
              console.log("Motoboy colocado offline por ausência prolongada de GPS");
              try {
                await supabase.from('motoboys').update({ status: 'offline' }).eq('id', motoboy.id);
                setMotoboy(prev => prev ? { ...prev, status: 'offline' as any } : prev);
                gpsErrorStartTimeRef.current = null;
              } catch (uErr) {
                console.error('Erro ao colocar motoboy offline por GPS indisponível:', uErr);
              }
            }
          }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
    } else {
      setGeoError('Navegador sem suporte a geolocalização.');
      setIsGpsChecking(false);
      setCurrentCoords(null);

      if (gpsErrorStartTimeRef.current === null) {
        gpsErrorStartTimeRef.current = Date.now();
        console.log("GPS indisponível");
      }

      const secondsWithoutGps = Math.floor((Date.now() - gpsErrorStartTimeRef.current) / 1000);
      console.log(`Tempo sem GPS: ${secondsWithoutGps} segundos`);

      const active = entregasRef.current.some(e => e.motoboy_id === motoboy.id && ['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(e.status));
      if (motoboy.status !== 'offline' && !active) {
        if (Date.now() - gpsErrorStartTimeRef.current >= 120000) {
          console.log("Motoboy colocado offline por ausência prolongada de GPS");
          supabase.from('motoboys').update({ status: 'offline' }).eq('id', motoboy.id);
          setMotoboy(prev => prev ? { ...prev, status: 'offline' as any } : prev);
          gpsErrorStartTimeRef.current = null;
        }
      }
    }
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [motoboy?.id, motoboy?.status]);

  // Efeito complementar: monitoramento contínuo e resiliente da ausência prolongada de GPS (2 minutos)
  useEffect(() => {
    if (!motoboy || !motoboy.id || motoboy.status === 'offline') {
      gpsErrorStartTimeRef.current = null;
      return;
    }

    const interval = setInterval(async () => {
      const isUnavailable = geoError || !currentCoords;
      if (isUnavailable) {
        if (gpsErrorStartTimeRef.current === null) {
          gpsErrorStartTimeRef.current = Date.now();
          console.log("GPS indisponível");
        }

        const tempoSemGpsMs = Date.now() - gpsErrorStartTimeRef.current;
        const secondsWithoutGps = Math.floor(tempoSemGpsMs / 1000);
        console.log(`Tempo sem GPS: ${secondsWithoutGps} segundos`);

        const active = entregasRef.current.some(e => e.motoboy_id === motoboy.id && ['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(e.status));

        if (!active && tempoSemGpsMs >= 120000) {
          console.log("Motoboy colocado offline por ausência prolongada de GPS");
          try {
            await supabase.from('motoboys').update({ status: 'offline' }).eq('id', motoboy.id);
            setMotoboy(prev => prev ? { ...prev, status: 'offline' as any } : prev);
            gpsErrorStartTimeRef.current = null;
          } catch (uErr) {
            console.error('Erro ao colocar motoboy offline por GPS indisponível:', uErr);
          }
        }
      } else {
        if (gpsErrorStartTimeRef.current !== null) {
          console.log("GPS recuperado");
          gpsErrorStartTimeRef.current = null;
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [motoboy?.id, motoboy?.status, geoError, currentCoords]);

  // 🔔 Integração de Push Notifications com Firebase e Capacitor
  useEffect(() => {
    if (!motoboy || !motoboy.id) return;

    if (!Capacitor.isNativePlatform()) {
      console.log('Push Notifications: Plataforma não nativa (Web). Registro de push ignorado.');
      return;
    }

    let isSubscribed = true;
    const activeListeners: any[] = [];

    const setupPush = async () => {
      try {
        // Solicitar/verificar permissões de notificação
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.warn('Permissão para notificações não concedida pelo usuário.');
          return;
        }

        // Registrar para receber push notifications do FCM
        await PushNotifications.register();

        // Ouvinte de sucesso no registro de Token FCM
        const regL = await PushNotifications.addListener('registration', async (token) => {
          if (!isSubscribed) return;
          console.log('Token FCM recebido com sucesso:', token.value);
          
          const currentMotoboy = motoboyRef.current;
          if (currentMotoboy && currentMotoboy.fcm_token === token.value) {
            console.log('FCM Token já está atualizado.');
            return;
          }

          try {
            const { error: updateError } = await supabase
              .from("motoboys")
              .update({
                fcm_token: token.value
              })
              .eq("id", currentMotoboy.id);

            if (updateError) {
              console.error("========== ERRO SUPABASE ==========");
              console.error(JSON.stringify(updateError, null, 2));
              console.error("===================================");
            } else {
              console.log('FCM Token salvo com sucesso na tabela motoboys!');
              if (motoboyRef.current) {
                motoboyRef.current.fcm_token = token.value;
              }
            }
          } catch (dbErr) {
            console.error('Falha ao tentar se conectar ao Supabase para atualizar FCM Token:', dbErr);
          }
        });
        activeListeners.push(regL);

        // Ouvinte de falha no registro
        const errL = await PushNotifications.addListener('registrationError', (err) => {
          console.error('Erro no registro do token FCM do Capacitor:', err.error);
        });
        activeListeners.push(errL);

        // Ouvinte de recepção de notificações com o app em primeiro plano (foreground)
        const notifL = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Notificação Push recebida em primeiro plano:', notification);
          const data = notification.data || (notification as any).extra || {};
          if (data && data.type === 'chat' && data.entrega_id) {
            playChatNotificationSound();
            const titleText = notification.title || 'Nova mensagem';
            const bodyText = notification.body || 'Você recebeu uma mensagem.';
            setChatNotification({
              show: true,
              message: `${titleText}: ${bodyText}`,
              entregaId: data.entrega_id
            });
            setTimeout(() => setChatNotification(null), 6000);
          }
        });
        activeListeners.push(notifL);

        // Ouvinte de clique na notificação push (abrir app e ir para o chat da entrega)
        const actionL = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('Notificação Push clicada:', action);
          const data = action.notification?.data || (action.notification as any)?.extra || {};
          if (data && data.type === 'chat' && data.entrega_id) {
            openChatForEntregaId(data.entrega_id);
          }
        });
        activeListeners.push(actionL);

      } catch (err) {
        console.error('Exceção capturada ao inicializar Push Notifications:', err);
      }
    };

    setupPush();

    return () => {
      isSubscribed = false;
      activeListeners.forEach(l => {
        try {
          l.remove();
        } catch (e) {
          console.error('Erro ao remover listener de push:', e);
        }
      });
    };
  }, [motoboy?.id]);

  const startAlertSound = (isUserEvent = false) => {
    if (isUserEvent) {
      setAudioUnlocked(true);
      setAudioEnabled(true);
    }
    if (alertIntervalRef.current) return;
    const play = () => {
      if (!audioRef.current) {
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      }
      audioRef.current.play().catch(() => setAudioEnabled(false));
    };
    play();
    alertIntervalRef.current = setInterval(play, 3000);
  };

  const stopAlertSound = () => {
    if (alertIntervalRef.current) {
      clearInterval(alertIntervalRef.current);
      alertIntervalRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const checkPendingRequest = async () => {
    if (!motoboy) return;
    const { data } = await supabase
      .from('solicitacoes_alteracoes')
      .select('*')
      .eq('entidade_id', motoboy.id)
      .eq('tipo_entidade', 'motoboy')
      .eq('status', 'pendente')
      .maybeSingle();
    setHasPendingRequest(!!data);
  };

  const fetchMotoboyProfile = async (userId: string) => {
    try {
      setLoadingProfile(true);
      const { data, error } = await supabase
        .from('motoboys')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      setMotoboy(data);
    } catch (err) {
      setError('Erro ao carregar seu perfil.');
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchEmpresaLocal = async (empresaId: string) => {
    console.log("MOTOBOY LOGADO:", motoboy);
    console.log("EMPRESA ID DO MOTOBOY:", motoboy?.empresa_id);

    if (!empresaId) {
      setLoadingConfig(false);
      return;
    }
    try {
      setLoadingConfig(true);
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .eq('id', empresaId)
        .maybeSingle();
      
      console.log('CONFIG MOTOBOY CARREGADA:', data);
      console.log('Valor cheguei_somente_no_restaurante no MotoboyApp:', data?.cheguei_somente_no_restaurante);

      if (error) throw error;
      if (data) {
        setEmpresaLocal(data);
        setLimiteEntregas(data.limite_entregas_por_motoboy ?? 1);

        // Fetch configuracoes_empresas
        console.log("===== buscarEmpresaLocal =====");
        console.log("empresaId:", empresaId);

        const { data: configData, error: configError } = await supabase
          .from("configuracoes_empresas")
          .select("*")
          .eq("empresa_id", empresaId);

        console.log("Quantidade de registros:", configData?.length);
        console.log("Todos os registros:", configData);
        console.log("CONFIGURAÇÃO COMPLETA:", JSON.stringify(configData, null, 2));

        const singleConfig = Array.isArray(configData) ? configData[0] : configData;

        if (!configError && singleConfig) {
          setPagbankAtivo(!!singleConfig.pagbank_ativo);
          setConfigDistribuicao(singleConfig);
          console.log("MODO DISTRIBUICAO CARREGADO:", singleConfig?.modo_distribuicao);
        } else {
          setPagbankAtivo(false);
          setConfigDistribuicao(null);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar empresa local:', err);
      setLimiteEntregas(1);
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchEntregas = async () => {
    if (!motoboy) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('entregas')
        .select(`
          *,
          restaurantes:restaurante_id (
            id,
            nome,
            endereco,
            latitude,
            longitude
          )
        `)
        .eq('empresa_id', motoboy.empresa_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEntregas(data || []);

      // Recupera sincronizações de início de corrida que falharam anteriormente.
      // O fetch é executado periodicamente; limita tentativas a uma por entrega a cada 30s.
      const startedMenuJuniorDeliveries = (data || []).filter((item: any) =>
        item.origem_integracao === 'menujunior' &&
        item.status === 'em_rota' &&
        Boolean(item.origem_pedido_id)
      );

      for (const delivery of startedMenuJuniorDeliveries) {
        const deliveryId = String(delivery.id);
        if (
          menuJuniorStartSyncCompletedRef.current.has(deliveryId) ||
          menuJuniorStartSyncInFlightRef.current.has(deliveryId)
        ) continue;

        const lastAttempt = menuJuniorStartSyncLastAttemptRef.current.get(deliveryId) || 0;
        if (Date.now() - lastAttempt < 30000) continue;

        menuJuniorStartSyncInFlightRef.current.add(deliveryId);
        menuJuniorStartSyncLastAttemptRef.current.set(deliveryId, Date.now());

        void (async () => {
          try {
            const { data: syncData, error: syncError } = await supabase.functions.invoke('menujunior-connect', {
              body: {
                action: 'delivery_status',
                delivery_id: delivery.id,
                origem_pedido_id: delivery.origem_pedido_id,
              },
            });

            let responseBody: any = null;
            if (syncError) {
              const responseContext = (syncError as any).context;
              if (responseContext && typeof responseContext.clone === 'function') {
                responseBody = await responseContext.clone().json().catch(() => null);
              }
            }

            if (syncError || syncData?.success !== true) {
              console.warn('[MENUJUNIOR] Retentativa de sincronização do início falhou:', {
                message: syncError?.message,
                response: responseBody || syncData,
                deliveryId,
                sourceOrderId: delivery.origem_pedido_id,
              });
              return;
            }

            if (['em_entrega', 'entregue'].includes(String(syncData.menujunior_status || ''))) {
              menuJuniorStartSyncCompletedRef.current.add(deliveryId);
            }
            console.log('[MENUJUNIOR] Retentativa de sincronização do início:', syncData);
          } catch (syncRetryError) {
            console.warn('[MENUJUNIOR] Erro na retentativa de início:', syncRetryError);
          } finally {
            menuJuniorStartSyncInFlightRef.current.delete(deliveryId);
          }
        })();
      }

      try {
        const activeIds = data?.map(e => e.id) || [];
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
        console.error('Erro ao buscar pagamentos_pagbank:', payErr);
      }

      try {
        const { data: histData, error: histError } = await supabase
          .from('historico_status_entregas')
          .select('*')
          .eq('motoboy_id', motoboy.id)
          .order('created_at', { ascending: true });

        if (histError) throw histError;

        if (histData) {
          const map: Record<string, HistoricoEntrega[]> = {};
          histData.forEach((item) => {
            if (!map[item.entrega_id]) {
              map[item.entrega_id] = [];
            }
            map[item.entrega_id].push(item);
          });
          setHistoricoStatusMap(map);
        }
      } catch (histErr) {
        console.error('Erro ao buscar historico de status de entregas:', histErr);
      }
      await carregarValoresFinais();
    } catch (err) {
      setError('Erro ao buscar entregas.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBloqueios = async () => {
    if (!motoboy) return;
    try {
      const { data, error } = await supabase
        .from('bloqueios_motoboy_restaurante')
        .select('restaurante_id')
        .eq('motoboy_id', motoboy.id);
      
      if (error) throw error;
      setBloqueios(data?.map(b => b.restaurante_id) || []);
    } catch (err) {
      console.error('Erro ao buscar bloqueios:', err);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatEventTime = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const isToday = date.getFullYear() === now.getFullYear() &&
                    date.getMonth() === now.getMonth() &&
                    date.getDate() === now.getDate();
                    
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
    };
    
    const dateOptions: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    };
    
    if (isToday) {
      return date.toLocaleTimeString('pt-BR', timeOptions);
    } else {
      return date.toLocaleString('pt-BR', dateOptions);
    }
  };

  interface TimelineItem {
    id: string;
    label: string;
    timeStr: string;
    timestamp: Date;
  }

  const getEntregaTimeline = (entrega: Entrega): TimelineItem[] => {
    const events: { label: string; date: Date; key: string }[] = [];
    
    const addEvent = (key: string, label: string, dateStr: string | null | undefined) => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      events.push({ key, label, date: d });
    };

    // 1. Prioritize field values on Entrega structure for standard events
    addEvent('aceita_em', 'Pedido aceito', entrega.aceita_em);
    addEvent('motoboy_chegou_em', 'Chegou no restaurante', entrega.motoboy_chegou_em);
    addEvent('entregue_em', 'Entregue', entrega.entregue_em);
    addEvent('comprovante_em', 'Comprovante salvo', entrega.comprovante_entrega_em);

    // 2. Add records from "historico_status_entregas"
    const dbEvents = historicoStatusMap[entrega.id] || [];
    dbEvents.forEach((hist) => {
      let label = hist.descricao || hist.status;
      const statusLower = hist.status?.toLowerCase();
      if (statusLower === 'aceita') {
        label = 'Pedido aceito';
      } else if (statusLower === 'motoboy_chegou') {
        label = 'Chegou no restaurante';
      } else if (statusLower === 'coletada') {
        label = 'Coletado';
      } else if (statusLower === 'em_rota') {
        label = 'Em rota';
      } else if (statusLower === 'entregue') {
        label = 'Entregue';
      } else if (statusLower === 'cancelada') {
        label = 'Entrega cancelada';
      }
      addEvent(`hist_${hist.id}_${hist.status}`, label, hist.created_at);
    });

    // Sort all events chronologically
    events.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Deduplicate sequentially by label to avoid repeated entries
    const uniqueEvents: { label: string; date: Date; key: string }[] = [];
    const seenLabels = new Set<string>();

    events.forEach((ev) => {
      const normLabel = ev.label.toLowerCase().trim();
      if (!seenLabels.has(normLabel)) {
        seenLabels.add(normLabel);
        uniqueEvents.push(ev);
      }
    });

    return uniqueEvents.map((ev, index) => ({
      id: `${entrega.id}_${ev.key}_${index}`,
      label: ev.label,
      timeStr: formatEventTime(ev.date.toISOString()),
      timestamp: ev.date
    }));
  };

  const registrarHistorico = async (entrega: Entrega, status: string, descricao: string) => {
    if (!motoboy) return;
    console.log('Registrando histórico:', descricao);
    try {
      const { error } = await supabase.from('historico_status_entregas').insert({
        entrega_id: entrega.id,
        empresa_id: motoboy.empresa_id,
        restaurante_id: entrega.restaurante_id,
        motoboy_id: motoboy.id,
        status: status,
        descricao: descricao,
        created_at: new Date().toISOString()
      });
      if (error) {
        console.error('Erro ao inserir histórico:', error);
      } else {
        console.log('Histórico registrado com sucesso:', descricao);
      }
    } catch (err) {
      console.error('Exceção ao inserir histórico:', err);
    }
  };

  const getMapsUrl = (lat?: number | string | null, lng?: number | string | null, address?: string | null) => {
    if (lat && lng) {
      return `https://www.google.com/maps?q=${lat},${lng}`;
    }
    if (address) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    }
    return null;
  };

  const openInMaps = (lat?: number | string | null, lng?: number | string | null, address?: string | null) => {
    const url = getMapsUrl(lat, lng, address);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const handleOpenIfoodConfirm = (entrega: Entrega) => {
    const orderId = entrega.ifood_order_id;
    if (!orderId || !orderId.trim()) return;

    const url = `https://confirmacao-entrega-propria.ifood.com.br/pedido/${orderId.trim()}/codigo-cliente`;

    console.log('[IFOOD] Abrindo confirmação de entrega');
    console.log('[IFOOD] orderId:', orderId);
    console.log('[IFOOD] URL:', url);

    window.open(url, '_blank');
  };

  const handleAction = async (entregaId: string, nextStatus: string) => {
    console.log(`[STATUS] Mudando para: ${nextStatus} (Entrega ID: ${entregaId})`);
    try {
      if (!motoboy) return;
      const entregaRef = entregas.find(e => e.id === entregaId);
      if (!entregaRef) {
        console.error('[STATUS] Entrega não encontrada na lista local:', entregaId);
        return;
      }

      console.log(`[STATUS] Status atual: ${entregaRef.status}, Tentando mudar para: ${nextStatus}`);

      const limite = Number(limiteEntregas ?? 1);
      const { count: entregasAtivasCount, error: countError } = await supabase
        .from('entregas')
        .select('*', { count: 'exact', head: true })
        .eq('motoboy_id', motoboy.id)
        .in('status', ['aceita', 'coletada', 'em_rota', 'pagamento_errado']);

      if (countError) {
        console.error('[STATUS] Erro ao contar entregas ativas:', countError);
        throw countError;
      }

      const entregasAtivas = entregasAtivasCount || 0;
      if (nextStatus === 'aceita' && entregasAtivas >= limite) {
        await supabase.from('motoboys').update({ status: 'offline' }).eq('id', motoboy.id);
        setMotoboy(prev => prev ? { ...prev, status: 'offline' as any } : prev);
        alert(`Você atingiu o limite de ${limite} entregas simultâneas.`);
        return;
      }

      // Validações de proximidade
      if (nextStatus === 'entregue' && empresaLocal?.finalizar_somente_no_endereco) {
        if (!entregaRef?.latitude_entrega || !entregaRef?.longitude_entrega) {
          alert('Endereço sem coordenadas, não é possível validar localização.');
          return;
        }
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
        });
        const { latitude: latAtual, longitude: lngAtual } = position.coords;
        const distancia = calculateDistance(latAtual, lngAtual, Number(entregaRef.latitude_entrega), Number(entregaRef.longitude_entrega));
        if (distancia > 100) {
          alert('Você precisa estar próximo ao endereço do cliente para finalizar esta entrega.');
          return;
        }
      }

      if (nextStatus === 'coletada' && empresaLocal?.cheguei_somente_no_restaurante) {
        if (!entregaRef?.restaurantes?.latitude || !entregaRef?.restaurantes?.longitude) {
          alert('Restaurante sem coordenadas, não é possível validar localização.');
          return;
        }
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
        });
        const { latitude: latAtual, longitude: lngAtual } = position.coords;
        const distancia = calculateDistance(latAtual, lngAtual, Number(entregaRef.restaurantes.latitude), Number(entregaRef.restaurantes.longitude));
        if (distancia > 100) {
          alert(`Você precisa estar próximo ao restaurante para marcar chegada. Distância atual: ${distancia.toFixed(0)}m`);
          return;
        }
      }

      const updateData: any = { status: nextStatus };
      let descricaoHistorico = '';
      
      if (nextStatus === 'aceita') {
        descricaoHistorico = 'Motoboy aceitou';
        const { data: bloqueioExistente } = await supabase
          .from('bloqueios_motoboy_restaurante')
          .select('*')
          .eq('motoboy_id', motoboy.id)
          .eq('restaurante_id', entregaRef.restaurante_id)
          .maybeSingle();

        if (bloqueioExistente) {
          alert('Você não pode aceitar entregas deste restaurante.');
          fetchBloqueios();
          return;
        }

        updateData.motoboy_id = motoboy.id;
        const now = new Date();
        const tempoMaximo = empresaLocal?.tempo_maximo_coleta_minutos || 15;
        updateData.aceita_em = now.toISOString();
        updateData.coleta_expira_em = new Date(now.getTime() + tempoMaximo * 60000).toISOString();
      }

      if (nextStatus === 'coletada') {
        descricaoHistorico = 'Motoboy chegou no restaurante';
        updateData.coleta_expira_em = null;
        updateData.motoboy_chegou_em = new Date().toISOString();
      }
      if (nextStatus === 'em_rota') {
        descricaoHistorico = 'Saiu para entrega';
      }
      if (nextStatus === 'entregue') {
        descricaoHistorico = 'Entrega finalizada';
        updateData.entregue_em = new Date().toISOString();
      }
      if (nextStatus === 'pendente') {
        updateData.motoboy_id = null;
        updateData.aceita_em = null;
        updateData.coleta_expira_em = null;
        updateData.ultima_tentativa_distribuicao_em = new Date().toISOString();
      }
      if (nextStatus === 'cancelada') {
        descricaoHistorico = 'Entrega cancelada';
      }

      console.log('[STATUS] Executando update na tabela entregas:', updateData);
      const { data, error: updateError } = await supabase
        .from('entregas')
        .update(updateData)
        .eq('id', entregaId)
        .select();

      console.log('[DEBUG UPDATE] data:', data);
      console.log('[DEBUG UPDATE] error:', updateError);

      if (updateError) {
        console.error('[STATUS] Erro ao atualizar a tabela entregas:', updateError);
        throw updateError;
      }
      console.log('[STATUS] Tabela entregas atualizada com sucesso!');

      // Tenta registrar histórico, mas sem bloquear fluxos
      try {
        if (descricaoHistorico) {
          await registrarHistorico(entregaRef, nextStatus, descricaoHistorico);
        }
      } catch (histErr) {
        console.warn('[STATUS] Falha silenciosa ao registrar histórico:', histErr);
      }

      // Gera o link público ao iniciar a corrida e encerra o link ao finalizar/cancelar.
      if (['em_rota', 'entregue', 'cancelada'].includes(nextStatus)) {
        try {
          const { data: syncData, error: syncError } = await supabase.functions.invoke('menujunior-connect', {
            body: {
              action: 'delivery_status',
              delivery_id: entregaRef.id,
              origem_pedido_id: (entregaRef as any).origem_pedido_id || null,
            },
          });

          let syncErrorBody: any = null;
          if (syncError) {
            const responseContext = (syncError as any).context;
            if (responseContext && typeof responseContext.clone === 'function') {
              syncErrorBody = await responseContext.clone().json().catch(() => null);
            }
          }

          if (syncError || syncData?.success !== true) {
            const detail = syncErrorBody?.error || syncData?.error || syncError?.message || 'Falha desconhecida';
            console.error('[RASTREAMENTO] Falha ao sincronizar rastreamento/status:', {
              message: syncError?.message,
              response: syncErrorBody || syncData,
              deliveryId: entregaRef.id,
            });
            alert(
              nextStatus === 'em_rota'
                ? 'A corrida foi iniciada, mas não foi possível gerar ou sincronizar o link de rastreamento. '
                : 'Não foi possível encerrar/sincronizar o rastreamento desta entrega. ' +
                  `Detalhe: ${detail}`
            );
          } else {
            console.log('[RASTREAMENTO] Atualização sincronizada:', syncData);
          }
        } catch (syncErr) {
          console.error('[RASTREAMENTO] Erro na sincronização:', syncErr);
          alert(
            nextStatus === 'em_rota'
              ? 'A corrida foi iniciada, mas não foi possível gerar o link de rastreamento.'
              : 'Não foi possível encerrar o rastreamento desta entrega.'
          );
        }
      }

      let novoTotalAtivas = entregasAtivas;
      if (nextStatus === 'aceita') novoTotalAtivas = entregasAtivas + 1;
      if (['entregue', 'cancelada'].includes(nextStatus)) novoTotalAtivas = Math.max(entregasAtivas - 1, 0);

      const hasGps = currentCoords && !geoError;
      const novoStatusMotoboy = (novoTotalAtivas >= limite || !hasGps) ? 'offline' : 'ativo';
      await supabase.from('motoboys').update({ status: novoStatusMotoboy }).eq('id', motoboy.id);
      setMotoboy(prev => prev ? { ...prev, status: novoStatusMotoboy as any } : prev);

      fetchEntregas();
    } catch (err: any) {
      console.error('[STATUS] Erro crítico no handleAction:', err);
      alert(`Erro ao atualizar o status da entrega: ${err.message || 'Erro desconhecido'}`);
    }
  };

  const handleObsPhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setObsPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setObsPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveObservation = async () => {
    if (!selectedEntregaForObs || !motoboy) return;
    
    setIsSavingObs(true);
    try {
      let photoUrl = selectedEntregaForObs.comprovante_entrega_url;

      if (obsPhoto) {
        const fileExt = obsPhoto.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `comprovantes/${motoboy.empresa_id}/${selectedEntregaForObs.id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('imagens')
          .upload(filePath, obsPhoto);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('imagens')
          .getPublicUrl(filePath);
        
        photoUrl = publicUrl;
      }

      const { error: updateError } = await supabase
        .from('entregas')
        .update({
          observacao_motoboy: obsText,
          comprovante_entrega_url: photoUrl,
          comprovante_entrega_em: new Date().toISOString()
        })
        .eq('id', selectedEntregaForObs.id);

      if (updateError) throw updateError;

      alert('Observação salva com sucesso!');
      setIsObservationModalOpen(false);
      setObsText('');
      setObsPhoto(null);
      setObsPhotoPreview(null);
      fetchEntregas();
    } catch (err) {
      console.error('Erro ao salvar observação:', err);
      alert('Erro ao salvar observação.');
    } finally {
      setIsSavingObs(false);
    }
  };

  const handleOpenCobrarCartao = (entrega: Entrega) => {
    const valorPedido = entrega.valor_pedido || 0;
    if (!valorPedido || valorPedido <= 0) {
      alert("Valor do pedido não informado");
      return;
    }
    setCobrarEntrega(entrega);
    const total = valorPedido;
    const pagoLocal = parseFloat(localStorage.getItem(`mp_pago:${entrega.id}`) || '0');
    setValorPagoState(pagoLocal);
    const restante = Math.max(0, total - pagoLocal);
    setValorCobrarInput(restante.toFixed(2));
    setCobrancaStatus(null);
    setIsCobrarModalOpen(true);
  };

  const handleEnviarCobranca = async () => {
    if (!cobrarEntrega) return;
    
    const valorPedido = cobrarEntrega.valor_pedido || 0;
    if (!valorPedido || valorPedido <= 0) {
      alert("Valor do pedido não informado");
      return;
    }

    const total = valorPedido;
    const pagoLocal = parseFloat(localStorage.getItem(`mp_pago:${cobrarEntrega.id}`) || '0');
    const restante = parseFloat((total - pagoLocal).toFixed(2));
    
    const valInput = parseFloat(valorCobrarInput.replace(',', '.'));
    
    if (isNaN(valInput) || valInput <= 0) {
      alert("O valor a cobrar deve ser maior que zero.");
      return;
    }
    
    if (valInput > restante) {
      alert(`O valor a cobrar (R$ ${valInput.toFixed(2)}) não pode ser maior que o saldo restante (R$ ${restante.toFixed(2)}).`);
      return;
    }

    setIsEnviandoCobranca(true);
    setCobrancaStatus(null);
    
    try {
      const payload = {
        restaurante_id: cobrarEntrega.restaurante_id,
        valor: valInput,
        amount: valInput,
        value: valInput,
        descricao: `Cobrança do pedido #${cobrarEntrega.numero || cobrarEntrega.id.slice(0, 5)}`,
        external_reference: cobrarEntrega.id
      };

      console.log("DEBUG [Mercado Pago Motoboy]: Chamando 'mercado-pago-create-order' com payload:", payload);
      
      const { data, error } = await supabase.functions.invoke('mercado-pago-create-order', {
        body: payload
      });

      console.log("DEBUG [Mercado Pago Motoboy - Resposta]:", { data, error });

      if (error) {
        throw new Error(error.message || 'Erro desconhecido na comunicação com a Edge Function.');
      }

      if (data?.error || data?.status === 'error') {
        throw new Error(data?.error || data?.message || 'Erro reportado pelo Mercado Pago.');
      }

      // Success! Update local storage payment
      const novoPago = parseFloat((pagoLocal + valInput).toFixed(2));
      localStorage.setItem(`mp_pago:${cobrarEntrega.id}`, novoPago.toString());
      setValorPagoState(novoPago);
      
      // Update input to new remaining balance
      const novoRestante = Math.max(0, parseFloat((total - novoPago).toFixed(2)));
      setValorCobrarInput(novoRestante.toFixed(2));

      setCobrancaStatus({
        success: true,
        message: "Cobrança enviada para a maquininha"
      });
      
      alert("Cobrança enviada para a maquininha!");
    } catch (err: any) {
      console.error("DEBUG [Mercado Pago Motoboy - Erro]:", err);
      setCobrancaStatus({
        success: false,
        message: err.message || "Falha ao enviar cobrança."
      });
      alert(`Erro ao enviar cobrança: ${err.message || 'Verifique o console para mais detalhes.'}`);
    } finally {
      setIsEnviandoCobranca(false);
    }
  };

  const handleArrived = async (entregaId: string) => {
    if (!motoboy) return;
    try {
      const entregaRef = entregas.find(e => e.id === entregaId);
      if (!entregaRef) return;

      // Registrar no histórico "Chegou no restaurante" usando a nova função
      await registrarHistorico(entregaRef, 'motoboy_chegou', 'Motoboy chegou no restaurante');
      
      // Opcional: registrar na entrega se houver campo
      await supabase.from('entregas').update({
        motoboy_chegou_em: new Date().toISOString()
      }).eq('id', entregaId);

      alert('Chegada registrada com sucesso!');
      fetchEntregas();
    } catch (err) {
      console.error('Erro ao registrar chegada:', err);
    }
  };

  const carregarValoresFinais = async () => {
    if (!motoboy) return;
    try {
      const { data: entData, error: entError } = await supabase
        .from('entregas')
        .select('id, valor_pedido, valor_pago_dinheiro, status, motoboy_id')
        .eq('empresa_id', motoboy.empresa_id);
      
      if (entError) throw entError;

      const novosSaldos: Record<string, number> = {};

      for (const entrega of entData || []) {
        const { data: payData, error: payError } = await supabase
          .from('pagamentos_pagbank')
          .select('valor_total')
          .eq('entrega_id', entrega.id);

        if (!payError && payData) {
          const totalPagbank = payData.reduce((sum, item) => sum + (item.valor_total || 0), 0);
          const valorPedido = entrega.valor_pedido || 0;
          const valorPagoDinheiro = entrega.valor_pago_dinheiro || 0;
          const saldoRestante = valorPedido - totalPagbank - valorPagoDinheiro;
          novosSaldos[entrega.id] = Math.max(saldoRestante, 0);
        }
      }

      setSaldosRestantes(novosSaldos);

      // Encontrar a entrega ativa do motoboy logado para atualizar totalPedido e saldoPendente
      const activeEnt = entData?.find(e => e.motoboy_id === motoboy.id && ['em_rota', 'pagamento_errado'].includes(e.status?.toLowerCase() || ''))
        || entData?.find(e => e.motoboy_id === motoboy.id && ['aceita', 'coletada'].includes(e.status?.toLowerCase() || ''))
        || entData?.find(e => e.motoboy_id === motoboy.id)
        || entData?.[0];

      if (activeEnt) {
        const valorPed = activeEnt.valor_pedido || 0;
        setTotalPedido(valorPed);
        setSaldoPendente(novosSaldos[activeEnt.id] !== undefined ? novosSaldos[activeEnt.id] : valorPed);
      }
    } catch (err) {
      console.error('Erro em carregarValoresFinais:', err);
    }
  };

  const getSaldoRestante = (entrega: Entrega) => {
    if (saldosRestantes[entrega.id] !== undefined) {
      return saldosRestantes[entrega.id];
    }
    const valorPedido = entrega.valor_pedido || 0;
    const valorPagoDinheiro = entrega.valor_pago_dinheiro || 0;
    const listPagbank = pagamentosPagbank.filter(p => p.entrega_id === entrega.id);
    const totalPagbank = listPagbank.reduce((sum, item) => sum + (item.valor_total || 0), 0);
    const saldoRestante = valorPedido - totalPagbank - valorPagoDinheiro;
    return Math.max(saldoRestante, 0);
  };

  const handleReceberDinheiro = async (entrega: Entrega, saldoRestante: number) => {
    if (!motoboy || isRecebendoDinheiro) return;
    try {
      setIsRecebendoDinheiro(true);
      const { error: errorEntrega } = await supabase
        .from('entregas')
        .update({
          valor_pago_dinheiro: (entrega.valor_pago_dinheiro || 0) + saldoRestante,
          status: 'entregue',
          pagamento_status: 'pago',
          entregue_em: new Date().toISOString()
        })
        .eq('id', entrega.id);

      if (errorEntrega) throw errorEntrega;

      try {
        await registrarHistorico(entrega, 'entregue', 'Entrega finalizada (Pago em Dinheiro)');
      } catch (histErr) {
        console.warn('Erro ao registrar histórico de dinheiro:', histErr);
      }

      const entregasAtivas = entregas.filter(e => e.motoboy_id === motoboy.id && ['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(e.status)).length;
      const novoTotalAtivas = Math.max(entregasAtivas - 1, 0);
      const limite = limiteEntregas || 1;
      const hasGps = currentCoords && !geoError;
      const novoStatusMotoboy = (novoTotalAtivas >= limite || !hasGps) ? 'offline' : 'ativo';

      const { error: errorMotoboy } = await supabase
        .from('motoboys')
        .update({ 
          entrega_ativa_id: null,
          status: novoStatusMotoboy
        })
        .eq('id', motoboy.id);

      if (errorMotoboy) throw errorMotoboy;

      setMotoboy(prev => prev ? { 
        ...prev, 
        entrega_ativa_id: null,
        status: novoStatusMotoboy as any
      } : null);

      alert('Pagamento em dinheiro recebido e entrega finalizada com sucesso!');
      await fetchEntregas();
    } catch (err: any) {
      console.error('Erro ao receber dinheiro:', err);
      alert('Erro ao processar recebimento em dinheiro.');
    } finally {
      setIsRecebendoDinheiro(false);
    }
  };

  const handleIniciarCobrancaMaquininha = async (entregaId: string) => {
    if (!motoboy) return;
    try {
      const { error } = await supabase
        .from('motoboys')
        .update({ entrega_ativa_id: entregaId })
        .eq('id', motoboy.id);

      if (error) throw error;
      setMotoboy(prev => prev ? { ...prev, entrega_ativa_id: entregaId } : null);
    } catch (err: any) {
      console.error('Erro ao iniciar cobrança:', err);
      alert('Erro ao iniciar cobrança na maquininha.');
    }
  };

  const handleCancelarCobrancaMaquininha = async () => {
    if (!motoboy) return;
    try {
      const { error } = await supabase
        .from('motoboys')
        .update({ entrega_ativa_id: null })
        .eq('id', motoboy.id);

      if (error) throw error;
      setMotoboy(prev => prev ? { ...prev, entrega_ativa_id: null } : null);
    } catch (err: any) {
      console.error('Erro ao cancelar cobrança:', err);
      alert('Erro ao cancelar cobrança na maquininha.');
    }
  };

  const toggleStatus = async () => {
    if (!motoboy || !user) return;
    if (!motoboy.ativo) {
      alert('Sua conta está desativada pela empresa.');
      return;
    }

    if (motoboy.status === 'offline') {
      // Tentando ficar Online
      if (!navigator.geolocation) {
        alert('Seu dispositivo não possui suporte a geolocalização. O GPS é obrigatório para receber entregas.');
        return;
      }

      // Tenta obter posição atual para validar GPS antes de mudar o status
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentCoords({ latitude, longitude });
          setGeoError(null);
          lastSentCoordsRef.current = { latitude, longitude };
          lastDbLocationUpdateRef.current = Date.now();

          try {
            const { data, error } = await supabase
              .from('localizacoes_motoboys')
              .upsert({
                empresa_id: motoboy.empresa_id,
                motoboy_id: motoboy.id,
                latitude,
                longitude,
                ultima_localizacao_em: new Date().toISOString(),
              }, { onConflict: 'motoboy_id' });

            console.log('Resultado do upsert:', data);

            if (error) {
              console.error('Erro do upsert localizacoes_motoboys:', error);
            } else {
              console.log('Upsert realizado com sucesso.');
            }

            const { error: updateError } = await supabase.from('motoboys').update({ status: 'ativo' }).eq('id', motoboy.id);
            if (updateError) throw updateError;
            setMotoboy({ ...motoboy, status: 'ativo' as any });

            // 🚨 MÁGICA DO SEGUNDO PLANO:
            try {
              const pkgName = '@capawesome/capacitor-background-task';
              // @ts-ignore
              const { BackgroundTask } = await import(/* @vite-ignore */ pkgName);
              await BackgroundTask.beforeExit(async () => {
                console.log("App minimizado! Mantendo conexão ativa...");
              });
            } catch (bgErr) {
              console.warn("Background Task não suportada no navegador Web puro (PC).");
            }
          } catch (err) {
            alert('Não foi possível alterar seu status.');
          }
        },
        (err) => {
          console.error("Erro de GPS ao tentar ficar online:", err);
          const msg = err.code === err.PERMISSION_DENIED
            ? 'Permissão de localização negada. O GPS é obrigatório para receber entregas.'
            : 'Sinal de GPS indisponível. Ative a localização no seu dispositivo para ficar online.';
          setGeoError(msg);
          alert('O GPS é obrigatório para receber entregas. Por favor, ative a localização no seu dispositivo para ficar online.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      // Ficando Offline
      try {
        const { error } = await supabase.from('motoboys').update({ status: 'offline' }).eq('id', motoboy.id);
        if (error) throw error;
        setMotoboy({ ...motoboy, status: 'offline' as any });
      } catch (err) {
        alert('Não foi possível alterar seu status.');
      }
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !motoboy) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${motoboy.id}_${Date.now()}.${fileExt}`;
      const filePath = `motoboys/${motoboy.empresa_id}/${fileName}`;
      await supabase.storage.from('imagens').upload(filePath, file, { upsert: true });
      const { data: { publicUrl } } = supabase.storage.from('imagens').getPublicUrl(filePath);
      setEditData(prev => ({ ...prev, foto_url: publicUrl }));
    } catch (error) {
      alert('Erro ao carregar imagem.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!motoboy || !user) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from('solicitacoes_alteracoes').insert({
        empresa_id: motoboy.empresa_id,
        tipo_entidade: 'motoboy',
        entidade_id: motoboy.id,
        user_id: user.id,
        dados_anteriores: { nome: motoboy.nome, telefone: motoboy.telefone, foto_url: motoboy.foto_url },
        dados_novos: { nome: editData.nome, telefone: editData.telefone, foto_url: editData.foto_url },
        status: 'pendente'
      });
      if (error) throw error;
      setHasPendingRequest(true);
      setView('entregas');
      alert('Sua solicitação enviada para aprovação.');
    } catch (err) {
      alert('Erro ao solicitar alteração.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/app-motoboy/login');
  };

  useEffect(() => {
    if (tab !== 'minhas' || !entregas.length) return;

    const checkExpirations = async () => {
      const now = new Date();
      const expiradas = entregas.filter(e => 
        e.status === 'aceita' && 
        e.motoboy_id === motoboy?.id && 
        e.coleta_expira_em && 
        new Date(e.coleta_expira_em) < now
      );

      if (expiradas.length > 0) {
        console.log('Detectadas entregas expiradas:', expiradas.map(e => e.numero));
        for (const entrega of expiradas) {
          await supabase
            .from('entregas')
            .update({
              status: 'pendente',
              motoboy_id: null,
              aceita_em: null,
              coleta_expira_em: null,
              ultima_tentativa_distribuicao_em: new Date().toISOString()
            })
            .eq('id', entrega.id);
        }
        alert('Tempo de coleta expirado. Algumas entregas voltaram para a fila.');
        fetchEntregas();
      }
    };

    const interval = setInterval(checkExpirations, 10000); // Verifica a cada 10s
    return () => clearInterval(interval);
  }, [tab, entregas, motoboy?.id]);

  const ColetaTimerBanner = ({ expiraEm }: { expiraEm: string }) => {
    const [secondsLeft, setSecondsLeft] = useState<number>(0);

    useEffect(() => {
      const calculate = () => {
        const diff = new Date(expiraEm).getTime() - new Date().getTime();
        setSecondsLeft(Math.max(0, Math.floor(diff / 1000)));
      };

      calculate();
      const interval = setInterval(calculate, 1000);
      return () => clearInterval(interval);
    }, [expiraEm]);

    const min = Math.floor(secondsLeft / 60);
    const sec = secondsLeft % 60;
    const formattedTime = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

    // Cor do fundo conforme o tempo restante
    let bgStyle = 'bg-red-500';
    if (secondsLeft > 120) {
      bgStyle = 'bg-emerald-600';
    } else if (secondsLeft >= 60) {
      bgStyle = 'bg-amber-500';
    } else {
      bgStyle = 'bg-red-500';
    }

    const isPulsing = secondsLeft <= 30 && secondsLeft > 0;

    return (
      <div className={`w-full py-3.5 px-4 text-white text-center flex flex-col items-center justify-center space-y-0.5 transition-colors duration-300 ${bgStyle} ${isPulsing ? 'animate-pulse' : ''}`}>
        <div className="flex items-center gap-1.5 justify-center text-white/95 font-black text-xs uppercase tracking-wider">
          <Clock size={15} className="shrink-0" />
          <span>COLETE O PEDIDO EM</span>
        </div>
        <div className="text-3xl font-black tracking-tight tabular-nums text-white my-0.5">
          {formattedTime}
        </div>
        <p className="text-[11px] font-medium text-white/90 leading-tight">
          Se o tempo acabar a entrega será redistribuída para outro motoboy.
        </p>
      </div>
    );
  };

  const disponiveis = motoboy?.status === 'offline' ? [] : entregas.filter(e => {
    if (e.status !== 'pendente' || e.motoboy_id || bloqueios.includes(e.restaurante_id)) {
      return false;
    }

    const modo = configDistribuicao?.modo_distribuicao || 'todos_online';

    if (modo === 'manual') {
      console.log("Entrou em MANUAL", {
        entregaId: e.id,
        modo_distribuicao: modo,
      });
      return false;
    }

    if (modo === 'raio_progressivo') {
      const ultimaTentativa = e.ultima_tentativa_distribuicao_em || e.created_at;
      const refTime = ultimaTentativa ? new Date(ultimaTentativa).getTime() : Date.now();
      const elapsedMinutes = Math.max(0, (nowTick - refTime) / 60000);

      console.log("RAIO PROGRESSIVO ATIVO", {
        entrega_id: e.id,
        entregaId: e.id,
        modo,
        currentCoords,
        restauranteLat: e.restaurantes?.latitude,
        restauranteLng: e.restaurantes?.longitude,
        raioInicial: configDistribuicao?.raio_inicial_km,
        incremento: configDistribuicao?.raio_incremento_km,
        tempoExpansao: configDistribuicao?.tempo_expansao_minutos,
        ultima_tentativa_distribuicao_em: ultimaTentativa,
        minutos_decorridos: elapsedMinutes
      });
      console.log("Entrou em RAIO_PROGRESSIVO");

      if (!currentCoords || !e.restaurantes?.latitude || !e.restaurantes?.longitude) {
        console.log({
          entrega_id: e.id,
          entregaId: e.id,
          modo_distribuicao: modo,
          motoboyLat: currentCoords?.latitude ?? null,
          motoboyLng: currentCoords?.longitude ?? null,
          restauranteLat: e.restaurantes?.latitude ?? null,
          restauranteLng: e.restaurantes?.longitude ?? null,
          distKm: null,
          raioInicial: configDistribuicao?.raio_inicial_km ?? 3,
          incremento: configDistribuicao?.raio_incremento_km ?? 2,
          tempoExpansao: configDistribuicao?.tempo_expansao_minutos ?? 1,
          ultima_tentativa_distribuicao_em: ultimaTentativa,
          minutos_decorridos: elapsedMinutes,
          minutosDecorridos: elapsedMinutes,
          raio_atual_calculado: null,
          raioAtual: null,
          resultadoComparacao: true,
          motivo: 'Sem coordenadas para calcular raio'
        });
        return true;
      }
      const rLat = Number(e.restaurantes.latitude);
      const rLng = Number(e.restaurantes.longitude);
      if (isNaN(rLat) || isNaN(rLng) || rLat === 0 || rLng === 0) {
        console.log({
          entrega_id: e.id,
          entregaId: e.id,
          modo_distribuicao: modo,
          motoboyLat: currentCoords.latitude,
          motoboyLng: currentCoords.longitude,
          restauranteLat: rLat,
          restauranteLng: rLng,
          distKm: null,
          raioInicial: configDistribuicao?.raio_inicial_km ?? 3,
          incremento: configDistribuicao?.raio_incremento_km ?? 2,
          tempoExpansao: configDistribuicao?.tempo_expansao_minutos ?? 1,
          ultima_tentativa_distribuicao_em: ultimaTentativa,
          minutos_decorridos: elapsedMinutes,
          minutosDecorridos: elapsedMinutes,
          raio_atual_calculado: null,
          raioAtual: null,
          resultadoComparacao: true,
          motivo: 'Coordenadas do restaurante invalidas/zeradas'
        });
        return true;
      }

      const distMeters = calculateDistance(currentCoords.latitude, currentCoords.longitude, rLat, rLng);
      const distKm = distMeters / 1000;

      const raioInicial = configDistribuicao?.raio_inicial_km ?? 3;
      const incremento = configDistribuicao?.raio_incremento_km ?? 2;
      const tempoExpansao = configDistribuicao?.tempo_expansao_minutos ?? 1;

      const steps = tempoExpansao > 0 ? Math.floor(elapsedMinutes / tempoExpansao) : 0;
      const currentRadiusKm = raioInicial + (steps * incremento);

      const resultado = distKm <= currentRadiusKm;

      console.log({
        entrega_id: e.id,
        entregaId: e.id,
        modo_distribuicao: modo,
        motoboyLat: currentCoords.latitude,
        motoboyLng: currentCoords.longitude,
        restauranteLat: rLat,
        restauranteLng: rLng,
        distKm,
        raioInicial,
        incremento,
        tempoExpansao,
        ultima_tentativa_distribuicao_em: ultimaTentativa,
        minutos_decorridos: elapsedMinutes,
        minutosDecorridos: elapsedMinutes,
        raio_atual_calculado: currentRadiusKm,
        raioAtual: currentRadiusKm,
        resultadoComparacao: resultado
      });

      return resultado;
    }

    console.log("Entrou em TODOS_ONLINE", {
      entregaId: e.id,
      modo_distribuicao: modo,
    });
    return true; // todos_online
  });
  const minhas = entregas.filter(e => e.motoboy_id === motoboy?.id && ['pendente', 'aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(e.status));
  const historico = entregas.filter(e => e.motoboy_id === motoboy?.id && ['entregue', 'cancelada'].includes(e.status));

  // Period filtering helper
  const isWithinPeriod = (created_at: string) => {
    if (!created_at) return false;
    const d = new Date(created_at);
    if (isNaN(d.getTime())) return false;

    const now = new Date();
    const dYear = d.getFullYear();
    const dMonth = d.getMonth();
    const dDate = d.getDate();

    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    const nowDate = now.getDate();

    if (filterType === 'hoje') {
      return dYear === nowYear && dMonth === nowMonth && dDate === nowDate;
    }

    if (filterType === 'ontem') {
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      return dYear === yesterday.getFullYear() && 
             dMonth === yesterday.getMonth() && 
             dDate === yesterday.getDate();
    }

    if (filterType === 'semana') {
      const sunday = new Date();
      sunday.setHours(0, 0, 0, 0);
      const day = sunday.getDay(); // 0 is Sunday
      sunday.setDate(now.getDate() - day);
      const startOfWeek = sunday;
      const checkDate = new Date(d);
      return checkDate >= startOfWeek;
    }

    if (filterType === 'mes') {
      return dYear === nowYear && dMonth === nowMonth;
    }

    if (filterType === 'personalizado') {
      if (!startDateInput) return true;
      const start = new Date(startDateInput + 'T00:00:00');
      let end = new Date();
      end.setHours(23, 59, 59, 999);
      if (endDateInput) {
        end = new Date(endDateInput + 'T23:59:59.999');
      }
      return d >= start && d <= end;
    }

    return true;
  };

  const filteredHistorico = historico.filter(e => isWithinPeriod(e.created_at));

  // Stats calculation for historical dashboard
  const totalGanhos = filteredHistorico
    .filter(e => e.status === 'entregue')
    .reduce((acc, curr) => acc + (curr.valor || 0), 0);

  const totalEntregas = filteredHistorico.length;
  const entregasConcluidas = filteredHistorico.filter(e => e.status === 'entregue').length;
  const ticketMedio = entregasConcluidas > 0 ? (totalGanhos / entregasConcluidas) : 0;

  useEffect(() => {
    if (disponiveis.length > 0 && motoboy?.status === 'ativo' && view === 'entregas') {
      startAlertSound();
    } else {
      stopAlertSound();
    }
    return () => stopAlertSound();
  }, [disponiveis.length, motoboy?.status, view]);

  if (loadingProfile || loadingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 font-sans">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest">
            {loadingProfile ? 'Carregando perfil...' : 'Carregando configurações...'}
          </p>
        </div>
      </div>
    );
  }

  if (!motoboy) return <div className="p-8 text-center"><p>Perfil não encontrado.</p></div>;
  if (!motoboy.ativo) return <div className="p-8 text-center flex flex-col items-center gap-4"><Ban className="h-12 w-12 text-red-500"/><h1 className="text-xl font-bold">Conta Desativada</h1><button onClick={handleSignOut} className="px-4 py-2 bg-neutral-900 text-white rounded-lg">Sair</button></div>;

  const activeEntregas = tab === 'disponiveis' ? disponiveis : tab === 'minhas' ? minhas : filteredHistorico;

  return (
    <div className="min-h-screen bg-neutral-50 pb-24 font-sans select-none overflow-x-hidden">
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMenuOpen(false)} className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm" />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="fixed inset-y-0 left-0 w-[80%] max-w-xs bg-white z-[70] shadow-2xl flex flex-col pt-safe">
              <div className="p-6 bg-indigo-600 text-white">
                <div className="flex justify-between items-start mb-6">
                  <div className="relative">
                    {motoboy?.foto_url ? <img src={motoboy.foto_url} className="h-16 w-16 rounded-full object-cover border-2 border-white/20" /> : <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/20"><User className="h-8 w-8 text-white" /></div>}
                  </div>
                  <button onClick={() => setIsMenuOpen(false)} className="p-1"><X className="h-6 w-6" /></button>
                </div>
                <h2 className="font-bold text-xl truncate">{motoboy?.nome}</h2>
                <p className="text-xs opacity-80 uppercase font-bold mt-1">{motoboy?.status === 'offline' ? 'Offline' : 'Online'}</p>
              </div>
              <nav className="flex-1 p-4 flex flex-col gap-1">
                <button onClick={() => { setView('entregas'); setTab('disponiveis'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl font-bold ${tab === 'disponiveis' && view === 'entregas' ? 'bg-indigo-50 text-indigo-600' : 'text-neutral-600'}`}><Box className="h-5 w-5" />Disponíveis</button>
                <button onClick={() => { setView('entregas'); setTab('minhas'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl font-bold ${tab === 'minhas' && view === 'entregas' ? 'bg-indigo-50 text-indigo-600' : 'text-neutral-600'}`}><Truck className="h-5 w-5" />Minhas Rotas</button>
                <button onClick={() => { setView('entregas'); setTab('historico'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl font-bold ${tab === 'historico' && view === 'entregas' ? 'bg-indigo-50 text-indigo-600' : 'text-neutral-600'}`}><History className="h-5 w-5" />Histórico</button>
                <div className="h-px bg-neutral-100 my-2" />
                <button onClick={() => { setView('configuracoes'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl font-bold ${view === 'configuracoes' ? 'bg-indigo-50 text-indigo-600' : 'text-neutral-600'}`}><Settings className="h-5 w-5" />Perfil</button>
                <button onClick={handleSignOut} className="w-full flex items-center gap-4 px-4 py-4 rounded-xl font-bold text-red-500 mt-auto"><LogOut className="h-5 w-5" />Sair</button>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-50 bg-indigo-600 text-white px-4 py-3 shadow-md flex justify-between items-center pt-safe">
        <button onClick={() => setIsMenuOpen(true)} className="p-2"><Menu className="h-6 w-6" /></button>
        <button onClick={toggleStatus} className={`relative flex items-center h-8 w-32 rounded-full p-1 ${motoboy?.status === 'offline' ? 'bg-neutral-400' : 'bg-green-500'}`}>
          <motion.div layout className={`absolute h-6 w-[55%] bg-white rounded-full flex items-center justify-center shadow-sm ${motoboy?.status === 'offline' ? 'left-1' : 'right-1'}`}>
            <span className={`text-[9px] font-black uppercase ${motoboy?.status === 'offline' ? 'text-neutral-500' : 'text-green-600'}`}>{motoboy?.status === 'offline' ? 'Offline' : 'Online'}</span>
          </motion.div>
        </button>
        <button onClick={handleSignOut} className="p-2"><LogOut className="h-5 w-5" /></button>
      </header>

      <main className="p-4 space-y-4">
        {hasPendingRequest && <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-800 text-xs font-bold"><Clock className="h-5 w-5" />Solicitação de perfil pendente</div>}
        {geoError && <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-800 text-xs font-bold"><AlertCircle className="h-5 w-5" />{geoError}</div>}

        {view === 'entregas' ? (
          <>
            {tab === 'historico' && (
              <div className="space-y-4 mb-6">
                {/* Cards Panel */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Total de Ganhos */}
                  <div className="bg-emerald-50/60 border border-emerald-100 p-4 rounded-3xl space-y-2 relative overflow-hidden shadow-xs">
                    <div className="absolute right-2 top-2 text-emerald-200 opacity-80">
                      <DollarSign size={20} />
                    </div>
                    <p className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wider leading-none">Total de Ganhos</p>
                    <p className="font-black text-emerald-800 text-xl tracking-tight">R$ {totalGanhos.toFixed(2)}</p>
                  </div>

                  {/* Total de Entregas */}
                  <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-3xl space-y-2 relative overflow-hidden shadow-xs">
                    <div className="absolute right-2 top-2 text-neutral-200 opacity-80">
                      <Package size={20} />
                    </div>
                    <p className="text-[10px] text-neutral-500 font-extrabold uppercase tracking-wider leading-none">Total de Entregas</p>
                    <p className="font-black text-neutral-800 text-xl tracking-tight">{totalEntregas}</p>
                  </div>

                  {/* Entregas Concluídas */}
                  <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-3xl space-y-2 relative overflow-hidden shadow-xs">
                    <div className="absolute right-2 top-2 text-blue-200 opacity-80">
                      <CheckCircle size={20} />
                    </div>
                    <p className="text-[10px] text-blue-600 font-extrabold uppercase tracking-wider leading-none">Concluídas</p>
                    <p className="font-black text-blue-800 text-xl tracking-tight">{entregasConcluidas}</p>
                  </div>

                  {/* Ticket Médio */}
                  <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-3xl space-y-2 relative overflow-hidden shadow-xs">
                    <div className="absolute right-2 top-2 text-indigo-400 opacity-60">
                      <Truck size={20} />
                    </div>
                    <p className="text-[10px] text-indigo-600 font-extrabold uppercase tracking-wider leading-none">Ticket Médio</p>
                    <p className="font-black text-indigo-800 text-xl tracking-tight">R$ {ticketMedio.toFixed(2)}</p>
                  </div>
                </div>

                {/* Filtros Container */}
                <div className="bg-white rounded-3xl border border-neutral-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                        <History size={14} />
                      </div>
                      <h3 className="font-extrabold text-neutral-900 text-xs uppercase tracking-wider">Período do Histórico</h3>
                    </div>
                  </div>

                  {/* Buttons Grid for standard presets */}
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
                        onClick={() => setFilterType(btn.id as any)}
                        className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                          filterType === btn.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-100'
                            : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-600 border-neutral-200'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom dates input */}
                  {filterType === 'personalizado' && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Data Inicial</label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-xs text-neutral-800 outline-none focus:border-indigo-500 transition-all font-sans"
                          value={startDateInput}
                          onChange={(e) => setStartDateInput(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest ml-1">Data Final</label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl font-bold text-xs text-neutral-800 outline-none focus:border-indigo-500 transition-all font-sans"
                          value={endDateInput}
                          onChange={(e) => setEndDateInput(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-px bg-neutral-200 my-4" />
              </div>
            )}

            <AnimatePresence mode="popLayout">
            {activeEntregas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-neutral-400 gap-4">
                <Package className="h-12 w-12 opacity-20" />
                <p className="text-sm font-bold">Nenhuma entrega aqui.</p>
              </div>
            ) : (
              activeEntregas.map((entrega) => {
                const statusEntrega = entrega.status?.toLowerCase() || '';
                const hasOrderId = !!(entrega.ifood_order_id && entrega.ifood_order_id.trim() !== '');
                const isEntregaIniciada = ['em_rota', 'pagamento_errado', 'entregue'].includes(statusEntrega);
                const showIfoodButton = hasOrderId && isEntregaIniciada;

                console.log('[IFOOD BUTTON] status da entrega:', statusEntrega);
                console.log('[IFOOD BUTTON] orderId:', entrega.ifood_order_id);
                console.log('[IFOOD BUTTON] entrega iniciada:', isEntregaIniciada);
                console.log('[IFOOD BUTTON] mostrar botão:', showIfoodButton);

                return (
                  <motion.div
                    key={entrega.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden active:border-indigo-200 transition-colors"
                  >
                  {entrega.status === 'aceita' && entrega.coleta_expira_em && (
                    <ColetaTimerBanner expiraEm={entrega.coleta_expira_em} />
                  )}

                  <div className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg uppercase">
                            #{entrega.numero_externo || entrega.numero || 'S/N'}
                          </span>
                          {entrega.ifood_localizador && (
                            <span className="text-[10px] font-black text-red-600 bg-red-50 border border-red-100 px-2 rounded-lg uppercase">
                              iFood #{entrega.ifood_localizador}
                            </span>
                          )}
                          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                            entrega.status?.toLowerCase() === 'pendente' ? 'bg-amber-100 text-amber-700' :
                            entrega.status?.toLowerCase() === 'entregue' ? 'bg-green-100 text-green-700' :
                            entrega.status?.toLowerCase() === 'pagamento_errado' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {entrega.status?.toLowerCase() === 'pagamento_errado' ? 'Pagamento Estornado' : entrega.status}
                          </span>
                          {empresaLocal?.permitir_chat_entrega && ['aceita', 'coletada', 'em_rota', 'pagamento_errado'].includes(entrega.status) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEntrega(entrega);
                                setIsChatOpen(true);
                              }}
                              className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg active:scale-95 transition-all"
                              title="Abrir Chat"
                            >
                              <MessageSquare size={14} />
                            </button>
                          )}
                        </div>
                      <h3 className="font-extrabold text-neutral-900 line-clamp-1 text-lg">{entrega.restaurantes?.nome || 'Restaurante não informado'}</h3>
                    </div>
                    {entrega.valor && (
                      <div className="text-right bg-neutral-50 px-3 py-1.5 rounded-xl border border-neutral-100">
                        <p className="text-[9px] text-neutral-400 uppercase font-black leading-tight">Ganho</p>
                        <p className="font-black text-neutral-900 text-lg">R$ {entrega.valor.toFixed(2)}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 pt-1">
                    <button 
                      onClick={() => openInMaps(entrega.restaurantes?.latitude, entrega.restaurantes?.longitude, entrega.restaurantes?.endereco)}
                      className="w-full h-auto text-left flex items-start gap-4 p-3 bg-neutral-50 rounded-xl border border-neutral-100 active:scale-[0.98] transition-transform"
                    >
                      <div className="bg-white p-2 rounded-lg shrink-0 shadow-sm">
                        <MapPin className="h-4 w-4 text-orange-500" />
                      </div>
                      <div className="text-sm flex-1">
                        <div className="flex justify-between items-center">
                          <p className="text-neutral-400 text-[10px] font-black uppercase leading-tight tracking-wider mb-0.5">Retirada (Restaurante)</p>
                          <ExternalLink size={10} className="text-neutral-300" />
                        </div>
                        <p className="text-neutral-900 font-extrabold leading-snug">{entrega.restaurantes?.nome || 'Restaurante não informado'}</p>
                        <p className="text-neutral-500 text-xs mt-0.5">{entrega.restaurantes?.endereco || 'Endereço não disponível'}</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => openInMaps(entrega.latitude_entrega, entrega.longitude_entrega, entrega.endereco_entrega)}
                      className="w-full h-auto text-left flex items-start gap-4 p-3 bg-indigo-50/30 rounded-xl border border-indigo-100/50 active:scale-[0.98] transition-transform"
                    >
                      <div className="bg-white p-2 rounded-lg shrink-0 shadow-sm">
                        <Navigation className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div className="text-sm flex-1">
                        <div className="flex justify-between items-center">
                          <p className="text-neutral-400 text-[10px] font-black uppercase leading-tight tracking-wider mb-0.5">Entrega (Cliente)</p>
                          <ExternalLink size={10} className="text-indigo-300" />
                        </div>
                        <p className="text-neutral-900 font-extrabold leading-snug">{entrega.cliente_nome || 'Cliente não informado'}</p>
                        <p className="text-neutral-500 text-xs mt-1">{entrega.endereco_entrega}</p>
                      </div>
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                        <div className="bg-white p-2 rounded-lg shrink-0 shadow-sm">
                          <DollarSign className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="text-sm flex-1">
                          <p className="text-neutral-400 text-[10px] font-black uppercase leading-tight tracking-wider mb-0.5">Pagamento</p>
                          <p className="text-neutral-900 font-extrabold leading-tight truncate">{entrega.forma_pagamento || 'Não informado'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                        <div className="bg-white p-2 rounded-lg shrink-0 shadow-sm">
                          <CreditCard className="h-4 w-4 text-indigo-600" />
                        </div>
                        <div className="text-sm flex-1">
                          <p className="text-neutral-400 text-[10px] font-black uppercase leading-tight tracking-wider mb-0.5">Valor do Pedido</p>
                          <p className="text-neutral-900 font-extrabold leading-tight">
                            {entrega.valor_pedido ? `R$ ${entrega.valor_pedido.toFixed(2)}` : 'Não informado'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {tab === 'historico' && (
                      <div className="bg-neutral-50 rounded-2xl border border-neutral-100 p-4 space-y-3">
                        <p className="text-neutral-400 text-[10px] font-black uppercase leading-tight tracking-wider mb-1">Linha do Tempo</p>
                        <div className="relative border-l-2 border-indigo-100 pl-4 space-y-3.5 ml-2 py-0.5">
                          {getEntregaTimeline(entrega).map((ev) => (
                            <div key={ev.id} className="relative flex items-center justify-between text-xs font-bold text-neutral-700">
                              <div className="absolute -left-[22px] top-1.5 w-2 h-2 rounded-full bg-indigo-600 border border-white" />
                              <span className="leading-tight">{ev.label}</span>
                              <span className="text-neutral-500 font-mono text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded-md shrink-0 ml-2">{ev.timeStr}</span>
                            </div>
                          ))}
                          {getEntregaTimeline(entrega).length === 0 && (
                            <p className="text-neutral-400 text-[11px] font-semibold italic">Nenhum status recebido</p>
                          )}
                        </div>
                      </div>
                    )}


                  </div>

                  {/* Ações */}
                  <div className="pt-2 space-y-2">
                    {/* iFood Confirmação */}
                    {showIfoodButton ? (
                      <button 
                        type="button"
                        onClick={() => handleOpenIfoodConfirm(entrega)}
                        className="w-full h-14 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2.5 transition-all shadow-md shadow-red-100 text-base"
                      >
                        <ExternalLink size={18} />
                        Confirmar Pedido iFood
                      </button>
                    ) : (
                      isEntregaIniciada && entrega.ifood_localizador && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs font-bold flex items-center justify-between">
                          <span>iFood: #{entrega.ifood_localizador}</span>
                          <span className="text-[11px] font-medium text-red-500 animate-pulse">Preparando confirmação iFood...</span>
                        </div>
                      )
                    )}
                    {entrega.status?.toLowerCase() === 'pendente' && (
                      <button 
                        onClick={() => handleAction(entrega.id, 'aceita')}
                        className="w-full h-16 bg-indigo-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xl shadow-lg shadow-indigo-100"
                      >
                        Aceitar Rota
                      </button>
                    )}

                    {entrega.status?.toLowerCase() === 'aceita' && (
                      <button 
                        onClick={() => handleAction(entrega.id, 'coletada')}
                        className="w-full h-16 bg-neutral-900 text-white font-black rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xl border-4 border-white shadow-lg"
                      >
                        Cheguei no Restaurante
                      </button>
                    )}

                    {entrega.status?.toLowerCase() === 'coletada' && (
                      <button 
                        onClick={() => handleAction(entrega.id, 'em_rota')}
                        className="w-full h-16 bg-indigo-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xl shadow-lg shadow-indigo-100"
                      >
                        Iniciar Entrega
                      </button>
                    )}

                    {['em_rota', 'pagamento_errado'].includes(entrega.status?.toLowerCase() || '') && (
                      <div className="flex flex-col gap-2">
                        {entrega.status?.toLowerCase() === 'pagamento_errado' && (
                          <div className="bg-red-50 border-2 border-red-500 rounded-3xl p-4 text-red-800 animate-pulse mb-3 space-y-1 text-left shadow-lg">
                            <div className="flex items-center gap-2 text-red-600 mb-1.5">
                              <span className="text-sm font-black uppercase tracking-widest block">
                                🚨 Transação Estornada!
                              </span>
                            </div>
                            <p className="text-xs font-black leading-snug">
                              O valor anterior foi totalmente devolvido ao cliente. Passe o cartão novamente com o valor correto para finalizar a entrega com sucesso.
                            </p>
                          </div>
                        )}

                        {/* Resumo Financeiro da Cobrança */}
                        {pagbankAtivo && (
                          <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 mb-2 space-y-1.5 text-left">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">Resumo Financeiro</p>
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-neutral-600">Total do Pedido:</span>
                              <span className="font-extrabold text-neutral-800">R$ {totalPedido.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-neutral-600">Saldo Pendente:</span>
                              <span className="font-black text-rose-600">R$ {saldoPendente.toFixed(2)}</span>
                            </div>
                          </div>
                        )}

                        {pagbankAtivo && (
                          <>
                            {getSaldoRestante(entrega) > 0 && (
                              <button
                                type="button"
                                disabled={isRecebendoDinheiro}
                                onClick={() => handleReceberDinheiro(entrega, getSaldoRestante(entrega))}
                                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 disabled:bg-neutral-300 active:scale-95 transition-all text-xs font-black text-white uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 mb-2"
                              >
                                {isRecebendoDinheiro ? 'Processando...' : `[ Receber R$ ${getSaldoRestante(entrega).toFixed(2)} em Dinheiro ]`}
                              </button>
                            )}

                            {motoboy.entrega_ativa_id === entrega.id ? (
                              <button
                                type="button"
                                onClick={() => handleCancelarCobrancaMaquininha()}
                                className="w-full h-12 bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all text-xs font-black text-white uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2"
                              >
                                🟡 Aguardando Cartão... [ Cancelar ]
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleIniciarCobrancaMaquininha(entrega.id)}
                                className="w-full h-12 bg-indigo-50 hover:bg-indigo-100 active:scale-95 transition-all text-xs font-black text-indigo-700 uppercase tracking-widest rounded-2xl border border-indigo-200 flex items-center justify-center gap-2"
                              >
                                [ Iniciar Cobrança na Maquininha ]
                              </button>
                            )}
                          </>
                        )}

                        {empresaLocal?.permitir_observacao_entrega_motoboy && (
                          <button 
                            onClick={() => {
                              setSelectedEntregaForObs(entrega);
                              setObsText(entrega.observacao_motoboy || '');
                              setIsObservationModalOpen(true);
                            }}
                            className="w-full h-12 bg-white text-indigo-600 font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all border-2 border-indigo-100"
                          >
                            <Camera size={18} /> Adicionar Observação / Foto
                          </button>
                        )}
                        <button 
                          onClick={() => handleAction(entrega.id, 'entregue')}
                          className="w-full h-16 bg-green-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all text-xl shadow-lg shadow-green-100"
                        >
                          Finalizar Entrega
                        </button>
                      </div>
                    )}
                  </div>
                  </div>
                </motion.div>
              );
            })
            )}
          </AnimatePresence>
          </>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="relative h-24 w-24 rounded-full overflow-hidden border-4 border-white shadow-xl bg-neutral-200">
                {isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : editData.foto_url ? <img src={editData.foto_url} className="h-full w-full object-cover" /> : <User className="h-10 w-10 text-neutral-400" />}
                <label className="absolute inset-0 cursor-pointer"><input type="file" className="hidden" onChange={handleFileUpload}/></label>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6 shadow-sm border space-y-4">
              <input value={editData.nome} onChange={e => setEditData({...editData, nome: e.target.value})} className="w-full p-4 bg-neutral-50 rounded-xl" placeholder="Nome" />
              <input value={editData.telefone} onChange={e => setEditData({...editData, telefone: e.target.value})} className="w-full p-4 bg-neutral-50 rounded-xl" placeholder="Telefone" />
              <button onClick={handleSaveProfile} disabled={isSaving} className="w-full h-14 bg-neutral-900 text-white font-black rounded-xl">{isSaving ? 'Salvando...' : 'Salvar Alterações'}</button>
            </div>
          </div>
        )}
      </main>

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
                remetenteTipo="motoboy"
                remetenteNome={motoboy?.nome || 'Motoboy'}
                onClose={() => setIsChatOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                if (chatNotification.entregaId) {
                  openChatForEntregaId(chatNotification.entregaId);
                }
                setChatNotification(null);
              }}
              className="bg-white text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
            >
              Abrir
            </button>
          </motion.div>
        )}
        
        {!canPlayAudioChat && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => {
              setCanPlayAudioChat(true);
              if (chatAudioRef.current) {
                chatAudioRef.current.play().then(() => {
                  chatAudioRef.current?.pause();
                  chatAudioRef.current!.currentTime = 0;
                }).catch(() => {});
              }
            }}
            className="fixed bottom-24 right-4 z-[90] bg-amber-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2"
          >
            <MessageSquare size={14} /> Ativar Sons de Chat
          </motion.button>
        )}
      </AnimatePresence>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t p-2 pb-6 flex justify-around items-center z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => { setView('entregas'); setTab('disponiveis'); }} 
          className={`flex-1 flex flex-col items-center gap-1 ${tab === 'disponiveis' && view === 'entregas' ? 'text-indigo-600' : 'text-neutral-400'}`}
        >
          <Box size={24}/>
          <span className="text-[10px] font-bold uppercase tracking-tight">Disponíveis</span>
        </button>
        <button 
          onClick={() => { setView('entregas'); setTab('minhas'); }} 
          className={`flex-1 flex flex-col items-center gap-1 ${tab === 'minhas' && view === 'entregas' ? 'text-indigo-600' : 'text-neutral-400'}`}
        >
          <Truck size={24}/>
          <span className="text-[10px] font-bold uppercase tracking-tight">Minhas Rotas</span>
        </button>
      </footer>

      {/* Modal de Observação */}
      <AnimatePresence>
        {isObservationModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsObservationModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b flex justify-between items-center bg-white sticky top-0 z-10">
                <h3 className="font-black text-neutral-900 uppercase tracking-widest text-sm">Comprovante de Entrega</h3>
                <button onClick={() => setIsObservationModalOpen(false)} className="p-2 bg-neutral-100 rounded-full">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 pb-24">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Observação</label>
                  <textarea
                    value={obsText}
                    onChange={(e) => setObsText(e.target.value)}
                    placeholder="Ex: Entregue na portaria para o porteiro João"
                    className="w-full p-4 bg-neutral-50 border border-neutral-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all min-h-[120px] font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Foto do Comprovante</label>
                  <div className="grid grid-cols-1 gap-4">
                    {obsPhotoPreview ? (
                      <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-indigo-100 shadow-sm">
                        <img src={obsPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          onClick={() => { setObsPhoto(null); setObsPhotoPreview(null); }}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full shadow-lg"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="aspect-video rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-all">
                        <div className="p-4 bg-white rounded-2xl shadow-sm">
                          <Camera size={32} className="text-indigo-600" />
                        </div>
                        <div className="text-center">
                          <p className="text-xs font-black text-neutral-900 uppercase">Tirar Foto ou Enviar</p>
                          <p className="text-[10px] text-neutral-400 font-bold uppercase mt-1">Clique para abrir a câmera</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleObsPhotoChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-neutral-50 border-t sticky bottom-0 z-10 flex gap-3">
                <button
                  onClick={() => setIsObservationModalOpen(false)}
                  className="flex-1 h-14 bg-white text-neutral-500 font-black rounded-2xl uppercase text-[10px] tracking-widest border border-neutral-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveObservation}
                  disabled={isSavingObs}
                  className="flex-[2] h-14 bg-indigo-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                  {isSavingObs ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Salvar Comprovante
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal de Cobrança Mercado Pago */}
        {isCobrarModalOpen && cobrarEntrega && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b flex justify-between items-center bg-indigo-50/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-2xl">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-neutral-900 text-base leading-tight">Cobrar Cliente (Cartão)</h2>
                    <p className="text-[10px] uppercase font-black text-indigo-600 tracking-wider">Pedido #{cobrarEntrega.numero || 'S/N'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCobrarModalOpen(false)}
                  className="p-2 hover:bg-neutral-100 rounded-full text-neutral-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                    <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">Total do Pedido</p>
                    <p className="font-black text-neutral-800 text-base">R$ {(cobrarEntrega.valor_pedido || 0).toFixed(2)}</p>
                  </div>

                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
                    <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">Valor Já Pago</p>
                    <p className="font-black text-green-600 text-base">R$ {valorPagoState.toFixed(2)}</p>
                  </div>
                </div>

                <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100/50 text-center">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none mb-1.5">Saldo Restante</p>
                  <p className="font-black text-indigo-900 text-2xl">R$ {Math.max(0, (cobrarEntrega.valor_pedido || 0) - valorPagoState).toFixed(2)}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest ml-1">Valor a Cobrar (R$)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                      <span className="text-neutral-400 font-bold text-sm">R$</span>
                    </div>
                    <input
                      type="text"
                      className="w-full pl-12 pr-5 py-4 bg-neutral-50 border border-neutral-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 rounded-2xl outline-none transition-all font-black text-neutral-900 text-lg"
                      value={valorCobrarInput}
                      onChange={(e) => setValorCobrarInput(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <p className="text-[9px] text-neutral-400 font-bold uppercase ml-2 leading-tight">Valor que será enviado e processado pela maquininha física vinculada.</p>
                </div>

                {cobrancaStatus && (
                  <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                    cobrancaStatus.success 
                      ? 'bg-green-50 border-green-100 text-green-800' 
                      : 'bg-red-50 border-red-100 text-red-800'
                  }`}>
                    {cobrancaStatus.success ? (
                      <CheckCircle size={18} className="text-green-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                    )}
                    <p className="text-xs font-bold leading-tight uppercase">{cobrancaStatus.message}</p>
                  </div>
                )}
              </div>

              <div className="p-6 bg-neutral-50 border-t flex gap-3">
                <button
                  onClick={() => setIsCobrarModalOpen(false)}
                  className="flex-1 h-14 bg-white text-neutral-500 font-black rounded-2xl uppercase text-[10px] tracking-widest border border-neutral-200 active:scale-98 transition-transform"
                >
                  Fechar
                </button>
                <button
                  onClick={handleEnviarCobranca}
                  disabled={isEnviandoCobranca || Math.max(0, (cobrarEntrega.valor_pedido || 0) - valorPagoState) <= 0}
                  className="flex-[2] h-14 bg-indigo-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-98 transition-transform"
                >
                  {isEnviandoCobranca ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                  Enviar para maquininha
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
