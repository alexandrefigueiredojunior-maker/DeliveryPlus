import { useEffect, useState, Fragment } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../../lib/supabase';
import { formatLocationTime } from '../../lib/location';
import { useAuth } from '../../contexts/AuthContext';
import { useEmpresa } from '../../contexts/EmpresaContext';
import { Loader2, AlertCircle, Bike } from 'lucide-react';

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

interface ActiveMotoboy {
  motoboy_id: string;
  motoboy_name: string;
  latitude: number;
  longitude: number;
  delivery_id: string;
  delivery_status: string;
  endereco_entrega: string;
  latitude_entrega: number | null;
  longitude_entrega: number | null;
  ultima_localizacao_em?: string | null;
  updated_at: string;
  foto_url?: string | null;
}

function MapAutoCenter({ data }: { data: ActiveMotoboy[] }) {
  const map = useMap();

  useEffect(() => {
    const allPoints: [number, number][] = [];
    data.forEach(item => {
      const lat = Number(item.latitude);
      const lng = Number(item.longitude);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        allPoints.push([lat, lng]);
      }
      
      if (item.latitude_entrega && item.longitude_entrega) {
        const dLat = Number(item.latitude_entrega);
        const dLng = Number(item.longitude_entrega);
        if (!isNaN(dLat) && !isNaN(dLng) && dLat !== 0 && dLng !== 0) {
          allPoints.push([dLat, dLng]);
        }
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
  }, [data, map]);

  return null;
}

const STATUS_LABELS: Record<string, string> = {
  aceita: 'Aceita',
  coletada: 'Coletada',
  em_rota: 'Em Rota'
};

export default function ActiveMotoboysMap() {
  const { empresa } = useEmpresa();
  const [data, setData] = useState<ActiveMotoboy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper para criar ícones customizados (apenas motoboys para este mapa)
  const createMotoboyIcon = (motoboyData: any) => {
    const setting = empresa?.tipo_icone_motoboy_mapa || 'emoji';
    const fotoUrl = motoboyData.foto_url;
    
    if (setting === 'foto' && fotoUrl) {
      return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="
          width: 42px; 
          height: 42px; 
          border-radius: 50%; 
          border: 3px solid #6366f1; 
          box-shadow: 0 4px 10px rgba(0,0,0,0.3); 
          overflow: hidden;
          background-color: white;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <img src="${fotoUrl}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
          <span style="display: none; font-size: 20px;">🏍️</span>
        </div>`,
        iconSize: [42, 42],
        iconAnchor: [21, 21],
        popupAnchor: [0, -21]
      });
    }

    return L.divIcon({
      className: 'custom-div-icon-emoji',
      html: `<div style="
        font-size: 32px; 
        filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));
        cursor: pointer;
      ">🏍️</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -15]
    });
  };

  const createDeliveryIcon = () => {
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
  };

  useEffect(() => {
    if (!empresa) return;

    fetchActiveData();

    // Inscrição Realtime para Localizações
    const locationChannel = supabase
      .channel('active_locations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'localizacoes_motoboys',
          filter: `empresa_id=eq.${empresa.id}`
        },
        () => {
          // Quando houver mudança na localização, atualizamos tudo para simplificar o join de status
          fetchActiveData();
        }
      )
      .subscribe();

    // Inscrição Realtime para Entregas (para refletir mudanças de status)
    const deliveryChannel = supabase
      .channel('active_deliveries')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'entregas',
          filter: `empresa_id=eq.${empresa.id}`
        },
        () => {
          fetchActiveData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(locationChannel);
      supabase.removeChannel(deliveryChannel);
    };
  }, [empresa]);

  async function fetchActiveData() {
    try {
      // 1. Buscar entregas ativas com dados dos motoboys (incluindo foto)
      const { data: activeDeliveries, error: deliveriesError } = await supabase
        .from('entregas')
        .select('id, motoboy_id, status, endereco_entrega, latitude_entrega, longitude_entrega, motoboys(nome, foto_url)')
        .eq('empresa_id', empresa?.id)
        .in('status', ['aceita', 'coletada', 'em_rota'])
        .not('motoboy_id', 'is', null);

      if (deliveriesError) throw deliveriesError;

      if (!activeDeliveries || activeDeliveries.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      const motoboyIds = activeDeliveries.map(d => d.motoboy_id);
      
      // 2. Buscar localizações desses motoboys
      const { data: locations, error: locationsError } = await supabase
        .from('localizacoes_motoboys')
        .select('*')
        .eq('empresa_id', empresa?.id)
        .in('motoboy_id', motoboyIds);

      if (locationsError) throw locationsError;

      // 3. Cruzar os dados
      const combined: ActiveMotoboy[] = locations.map(loc => {
        const delivery = activeDeliveries.find(d => d.motoboy_id === loc.motoboy_id);
        const motoboyInfo = delivery?.motoboys as any;
        return {
          motoboy_id: loc.motoboy_id,
          motoboy_name: motoboyInfo?.nome || 'Motoboy',
          foto_url: motoboyInfo?.foto_url,
          latitude: loc.latitude,
          longitude: loc.longitude,
          delivery_id: delivery?.id || '',
          delivery_status: delivery?.status || 'Desconhecido',
          endereco_entrega: delivery?.endereco_entrega || '',
          latitude_entrega: delivery?.latitude_entrega || null,
          longitude_entrega: delivery?.longitude_entrega || null,
          ultima_localizacao_em: loc.ultima_localizacao_em || loc.updated_at,
          updated_at: loc.updated_at
        };
      });

      setData(combined);
    } catch (err: any) {
      console.error('Erro ao carregar mapa ativo:', err);
      setError('Erro ao sincronizar motoboys em rota.');
    } finally {
      setLoading(false);
    }
  }

  const defaultCenter: [number, number] = [-23.55052, -46.633308];

  if (loading && data.length === 0) {
    return (
      <div className="h-[300px] w-full bg-neutral-50 rounded-xl flex items-center justify-center border border-neutral-100 italic text-neutral-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Sincronizando entregas ativas...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[300px] w-full bg-red-50 rounded-xl flex flex-col items-center justify-center border border-red-100 p-4 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
        <p className="text-red-700 font-medium">{error}</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-[300px] w-full bg-neutral-50 rounded-xl flex flex-col items-center justify-center border border-neutral-100 p-6 text-center">
        <Bike className="h-8 w-8 text-neutral-300 mb-2" />
        <p className="text-neutral-500 font-medium">Nenhum motoboy em rota no momento.</p>
        <p className="text-xs text-neutral-400 mt-1">Acompanhe apenas os motoboys com entregas ativas aqui.</p>
      </div>
    );
  }

  const firstValidItem = data.find(item => typeof item.latitude === 'number' && typeof item.longitude === 'number' && !isNaN(item.latitude) && !isNaN(item.longitude) && item.latitude !== 0 && item.longitude !== 0);
  const centerCoord: [number, number] = firstValidItem ? [firstValidItem.latitude, firstValidItem.longitude] : defaultCenter;

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
        <MapAutoCenter data={data} />
        
        {data.filter(item => {
          const lat = Number(item.latitude);
          const lng = Number(item.longitude);
          return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
        }).map((item, index) => {
          const mKey = item.motoboy_id || `moto-idx-${index}`;
          const dKey = item.delivery_id || `del-idx-${index}`;
          const latDelivery = item.latitude_entrega ? Number(item.latitude_entrega) : null;
          const lngDelivery = item.longitude_entrega ? Number(item.longitude_entrega) : null;
          const hasDeliveryCoords = latDelivery !== null && lngDelivery !== null && !isNaN(latDelivery) && !isNaN(lngDelivery) && latDelivery !== 0 && lngDelivery !== 0;

          return (
            <Fragment key={`group-${mKey}-${dKey}`}>
              {/* Marcador Motoboy */}
              <Marker 
                position={[item.latitude, item.longitude]}
                icon={createMotoboyIcon(item)}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold text-neutral-900 border-b border-neutral-100 pb-1 mb-1">
                      {item.motoboy_name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <p className="text-xs font-semibold text-indigo-700 uppercase">
                        {STATUS_LABELS[item.delivery_status] || item.delivery_status}
                      </p>
                    </div>
                    {(() => {
                      const timeInfo = formatLocationTime(item.ultima_localizacao_em || item.updated_at);
                      return (
                        <p className={`text-[10px] font-bold mt-2 ${timeInfo.isOutdated ? 'text-red-600' : 'text-emerald-600'}`}>
                          {timeInfo.isOutdated ? '⚠️ Localização desatualizada' : timeInfo.text}
                        </p>
                      );
                    })()}
                  </div>
                </Popup>
              </Marker>

              {/* Marcador Destino de Entrega (se houver coordenadas) */}
              {hasDeliveryCoords && latDelivery !== null && lngDelivery !== null && (
                <Marker
                  position={[latDelivery, lngDelivery]}
                  icon={createDeliveryIcon()}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-bold text-neutral-900 border-b border-neutral-100 pb-1 mb-1">
                        Destino (Cliente)
                      </p>
                      <p className="text-[10px] text-neutral-500 italic mb-1 uppercase">Entregador: {item.motoboy_name}</p>
                      <p className="text-xs text-neutral-500 leading-tight">
                        {item.endereco_entrega}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
