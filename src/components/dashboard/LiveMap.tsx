import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import { formatLocationTime } from '../../lib/location';
import { useAuth } from '../../contexts/AuthContext';
import { useEmpresa } from '../../contexts/EmpresaContext';
import { Loader2, AlertCircle } from 'lucide-react';

// Corrigindo o problema dos ícones do Leaflet no React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface StaticLocation {
  id: string;
  nome: string;
  endereco: string;
  latitude: number;
  longitude: number;
  foto_url?: string | null;
  tipo: 'restaurante';
}

interface DeliveryLocation {
  id: string;
  endereco_entrega: string;
  latitude_entrega: number;
  longitude_entrega: number;
  restaurante_id: string;
  motoboy_id?: string | null;
  status: string;
  cliente_nome?: string | null;
  tipo: 'entrega';
}

interface MotoboyLocation {
  id: string;
  motoboy_id: string;
  latitude: number;
  longitude: number;
  ultima_localizacao_em?: string | null;
  updated_at: string;
  motoboy_name?: string;
  foto_url?: string | null;
  tipo: 'motoboy';
}

function MapAutoCenter({ locations, restaurants, deliveries }: { locations: MotoboyLocation[], restaurants: StaticLocation[], deliveries: DeliveryLocation[] }) {
  const map = useMap();

  useEffect(() => {
    const allPoints: [number, number][] = [];

    locations.forEach(loc => {
      const lat = Number(loc.latitude);
      const lng = Number(loc.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        allPoints.push([lat, lng]);
      }
    });

    restaurants.forEach(res => {
      const lat = Number(res.latitude);
      const lng = Number(res.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        allPoints.push([lat, lng]);
      }
    });

    deliveries.forEach(del => {
      const lat = Number(del.latitude_entrega);
      const lng = Number(del.longitude_entrega);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        allPoints.push([lat, lng]);
      }
    });

    if (allPoints.length > 0) {
      try {
        const bounds = L.latLngBounds(allPoints);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      } catch (err) {
        console.error('Error fitting bounds:', err);
      }
    }
  }, [locations, restaurants, deliveries, map]);

  return null;
}

export default function LiveMap() {
  console.log('🔥 LIVE MAP CARREGOU');
  const { empresa } = useEmpresa();
  const [locations, setLocations] = useState<MotoboyLocation[]>([]);
  const [restaurants, setRestaurants] = useState<StaticLocation[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper para criar ícones customizados
  const createCustomIcon = (tipo: 'motoboy' | 'restaurante' | 'entrega', data: any) => {
    if (tipo === 'entrega') {
      return L.divIcon({
        className: 'custom-div-icon-emoji',
        html: `<div style="
          font-size: 24px; 
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
          cursor: pointer;
        ">📍</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 24],
        popupAnchor: [0, -20]
      });
    }

    const isMotoboy = tipo === 'motoboy';
    const setting = isMotoboy 
      ? (empresa?.tipo_icone_motoboy_mapa || 'emoji') 
      : (empresa?.tipo_icone_restaurante_mapa || 'icone');
    
    const fotoUrl = data.foto_url;
    const useImage = (isMotoboy && setting === 'foto' && fotoUrl) || (!isMotoboy && setting === 'logo' && fotoUrl);

    if (useImage) {
      return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
          width: 40px; 
          height: 40px; 
          border-radius: 50%; 
          border: 3px solid white; 
          box-shadow: 0 4px 10px rgba(0,0,0,0.2); 
          overflow: hidden;
          background-color: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <img src="${fotoUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
          <span style="display: none; font-size: 20px;">${isMotoboy ? '🏍️' : '🏪'}</span>
        </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -20]
      });
    }

    return L.divIcon({
      className: 'custom-div-icon-emoji',
      html: `<div style="
        font-size: 28px; 
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        cursor: pointer;
      ">${isMotoboy ? '🏍️' : '🏪'}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -10]
    });
  };

  useEffect(() => {
    if (!empresa) return;

    fetchInitialLocations();
    fetchRestaurants();
    fetchDeliveries();

    // Inscrição em tempo real para mudanças na localização
    const channel = supabase
      .channel('realtime_locations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'localizacoes_motoboys',
          filter: `empresa_id=eq.${empresa.id}`
        },
        async (payload) => {
          console.log('Location update received:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newLoc = payload.new as MotoboyLocation;
            if (!newLoc.motoboy_id) return;

            setLocations(prev => {
              const cached = prev.find(loc => loc.motoboy_id === newLoc.motoboy_id);
              const filtered = prev.filter(loc => loc.motoboy_id !== newLoc.motoboy_id);
              
              const newLat = Number(newLoc.latitude);
              const newLng = Number(newLoc.longitude);
              
              if (isNaN(newLat) || isNaN(newLng) || newLat === 0 || newLng === 0) {
                return prev; // Ignore invalid location updates
              }

              if (cached) {
                return [...filtered, {
                  ...cached,
                  latitude: newLat,
                  longitude: newLng,
                  ultima_localizacao_em: newLoc.ultima_localizacao_em || newLoc.updated_at,
                  updated_at: newLoc.updated_at
                } as any];
              } else {
                // Background fetch to resolve name and photo
                supabase
                  .from('motoboys')
                  .select('nome, foto_url')
                  .eq('id', newLoc.motoboy_id)
                  .single()
                  .then(({ data }) => {
                    setLocations(current => {
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'entregas',
          filter: `empresa_id=eq.${empresa.id}`
        },
        () => {
          fetchDeliveries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [empresa]);

  async function fetchRestaurants() {
    try {
      const { data, error } = await supabase
        .from('restaurantes')
        .select('*')
        .eq('empresa_id', empresa?.id)
        .eq('status', 'ativo');

      if (error) throw error;
      setRestaurants((data || []).map(r => ({ ...r, tipo: 'restaurante' })));
    } catch (err) {
      console.error('Erro ao buscar restaurantes para o mapa:', err);
    }
  }

  async function fetchDeliveries() {
    try {
      const { data, error } = await supabase
        .from('entregas')
        .select('id, endereco_entrega, latitude_entrega, longitude_entrega, restaurante_id, motoboy_id, status, cliente_nome')
        .eq('empresa_id', empresa?.id)
        .in('status', ['aceita', 'coletada', 'em_rota'])
        .not('latitude_entrega', 'is', null)
        .not('longitude_entrega', 'is', null);

      if (error) throw error;
      setDeliveries((data || []).map(d => ({ ...d, tipo: 'entrega' })) as DeliveryLocation[]);
    } catch (err) {
      console.error('Erro ao buscar entregas para o mapa:', err);
    }
  }

  async function fetchInitialLocations() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('localizacoes_motoboys')
        .select(`
          id,
          motoboy_id,
          latitude,
          longitude,
          ultima_localizacao_em,
          updated_at,
          motoboys(nome, foto_url)
        `)
        .eq('empresa_id', empresa?.id);

      if (error) throw error;

      const latestLocationsMap: Record<string, any> = {};
      (data || []).forEach((item: any) => {
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
            motoboy_name: item.motoboys?.nome,
            foto_url: item.motoboys?.foto_url,
            tipo: 'motoboy'
          };
        }
      });

      const formattedLocations = Object.values(latestLocationsMap);
      setLocations(formattedLocations);
    } catch (err: any) {
      console.error('Erro ao carregar localizações:', err);
      setError('Não foi possível carregar as localizações em tempo real.');
    } finally {
      setLoading(false);
    }
  }

  const defaultCenter: [number, number] = [-23.55052, -46.633308]; // São Paulo como default
  
  const entregas = deliveries;
  const motoboys = locations;
  const localizacoesMotoboys = locations;

  // Diagnostic logs requested by the user
  console.log('EMPRESA ATUAL:', empresa?.id);
  console.log('ENTREGAS:', deliveries);
  console.log('QTD ENTREGAS:', deliveries.length);
  console.log('LOCATIONS:', locations);
  console.log('QTD LOCATIONS:', locations.length);

  console.log('Entregas:', entregas);
  console.log('Motoboys:', motoboys);
  console.log('Localizações:', localizacoesMotoboys);

  deliveries.forEach(delivery => {
    const motoboy = locations.find(
      loc => loc.motoboy_id === delivery.motoboy_id
    );

    console.log('Entrega:', (delivery as any).numero || delivery.id);
    console.log('Motoboy encontrado:', motoboy);
  });

  console.log('Quantidade entregas:', deliveries.length);
  console.log('Quantidade localizações:', locations.length);

  if (loading && locations.length === 0 && restaurants.length === 0 && deliveries.length === 0) {
    return (
      <div className="h-[300px] w-full bg-neutral-50 rounded-xl flex items-center justify-center border border-neutral-100 italic text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Carregando mapa em tempo real...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[300px] w-full bg-red-50 rounded-xl flex flex-col items-center justify-center border border-red-100 p-4 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
        <p className="text-red-700 font-medium">{error}</p>
        <button 
          onClick={() => { fetchInitialLocations(); fetchRestaurants(); fetchDeliveries(); }}
          className="mt-4 text-sm font-bold text-red-600 underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const firstValidLoc = locations.find(loc => typeof loc.latitude === 'number' && typeof loc.longitude === 'number' && !isNaN(loc.latitude) && !isNaN(loc.longitude));
  const firstValidRes = restaurants.find(res => typeof res.latitude === 'number' && typeof res.longitude === 'number' && !isNaN(res.latitude) && !isNaN(res.longitude));
  const centerCoord: [number, number] = firstValidLoc 
    ? [firstValidLoc.latitude, firstValidLoc.longitude] 
    : (firstValidRes ? [firstValidRes.latitude, firstValidRes.longitude] : defaultCenter);

  console.log('🔥 RENDERIZANDO MAPA AO VIVO');
  return (
    <div className="h-[400px] w-full rounded-xl overflow-hidden border border-neutral-200 shadow-sm relative z-0">
      <MapContainer 
        center={centerCoord} 
        zoom={13} 
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapAutoCenter locations={locations} restaurants={restaurants} deliveries={deliveries} />
        
        {/* Marcadores de Restaurantes */}
        {restaurants.filter(res => typeof res.latitude === 'number' && typeof res.longitude === 'number' && !isNaN(res.latitude) && !isNaN(res.longitude) && res.latitude !== 0 && res.longitude !== 0).map((res) => (
          <Marker 
            key={`rest-${res.id}`} 
            position={[res.latitude, res.longitude]}
            icon={createCustomIcon('restaurante', res)}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold text-neutral-900 border-b border-neutral-100 pb-1 mb-1">
                  {res.nome}
                </p>
                <p className="text-xs text-neutral-500 leading-tight">
                  {res.endereco}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Marcadores de Entregas */}
        {deliveries.filter(del => typeof del.latitude_entrega === 'number' && typeof del.longitude_entrega === 'number' && !isNaN(del.latitude_entrega) && !isNaN(del.longitude_entrega) && del.latitude_entrega !== 0 && del.longitude_entrega !== 0).map((del) => (
          <Marker 
            key={`del-${del.id}`} 
            position={[del.latitude_entrega, del.longitude_entrega]}
            icon={createCustomIcon('entrega', del)}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold text-neutral-900 border-b border-neutral-100 pb-1 mb-1">
                  Cliente: {del.cliente_nome || 'Não Informado'}
                </p>
                <p className="text-xs text-neutral-500 leading-tight">
                  {del.endereco_entrega}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Linhas conectando Restaurante -> Motoboy -> Cliente para entregas ativas */}
        {deliveries.filter(del => del.id).map((del) => {
          const res = restaurants.find(r => r.id === del.restaurante_id);
          const moto = del.motoboy_id ? locations.find(l => l.motoboy_id === del.motoboy_id) : null;
          
          const pathPoints: [number, number][] = [];
          
          if (res && typeof res.latitude === 'number' && typeof res.longitude === 'number' && !isNaN(res.latitude) && !isNaN(res.longitude)) {
            pathPoints.push([res.latitude, res.longitude]);
          }
          if (moto && typeof moto.latitude === 'number' && typeof moto.longitude === 'number' && !isNaN(moto.latitude) && !isNaN(moto.longitude)) {
            pathPoints.push([moto.latitude, moto.longitude]);
          }
          if (typeof del.latitude_entrega === 'number' && typeof del.longitude_entrega === 'number' && !isNaN(del.latitude_entrega) && !isNaN(del.longitude_entrega)) {
            pathPoints.push([del.latitude_entrega, del.longitude_entrega]);
          }
          
          if (pathPoints.length >= 2) {
            return (
              <Polyline
                key={`line-${del.id}`}
                positions={pathPoints}
                color="#f97316"
                weight={3}
                opacity={0.8}
                dashArray={moto ? undefined : "5, 10"}
              />
            );
          }
          return null;
        })}

        {/* Marcadores de Motoboys */}
        {locations.filter(loc => typeof loc.latitude === 'number' && typeof loc.longitude === 'number' && !isNaN(loc.latitude) && !isNaN(loc.longitude) && loc.latitude !== 0 && loc.longitude !== 0).map((loc) => (
          <Marker 
            key={`moto-${loc.motoboy_id}`} 
            position={[loc.latitude, loc.longitude]}
            icon={createCustomIcon('motoboy', loc)}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold text-neutral-900 border-b border-neutral-100 pb-1 mb-1">
                  {loc.motoboy_name || 'Motoboy'}
                </p>
                {(() => {
                  const timeInfo = formatLocationTime(loc.ultima_localizacao_em || loc.updated_at);
                  return (
                    <p className={`text-xs font-bold ${timeInfo.isOutdated ? 'text-red-600' : 'text-emerald-600'}`}>
                      {timeInfo.isOutdated ? '⚠️ Localização desatualizada' : timeInfo.text}
                    </p>
                  );
                })()}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
