import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bike, Clock3, MapPin, Navigation, PackageCheck, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Coordinate = { latitude: number; longitude: number };
type TrackingResponse = {
  success: boolean;
  active: boolean;
  status?: string;
  endereco_entrega?: string;
  iniciado_em?: string | null;
  localizacao_motoboy?: (Coordinate & { atualizada_em?: string | null }) | null;
  destino?: Coordinate | null;
  localizacao_desatualizada?: boolean;
  reason?: string;
};

const motoboyIcon = L.divIcon({
  className: 'tracking-marker',
  html: '<div style="width:42px;height:42px;border-radius:50%;background:#ea580c;border:3px solid white;box-shadow:0 3px 12px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;font-size:22px">🏍️</div>',
  iconSize: [42, 42],
  iconAnchor: [21, 21],
});

const destinationIcon = L.divIcon({
  className: 'tracking-destination-marker',
  html: '<div style="font-size:30px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">📍</div>',
  iconSize: [30, 34],
  iconAnchor: [15, 32],
});

function FitTrackingMap({ current, destination }: { current: Coordinate | null; destination: Coordinate | null }) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [];
    if (current) points.push([current.latitude, current.longitude]);
    if (destination) points.push([destination.latitude, destination.longitude]);
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView(points[0], 16, { animate: true });
    }
  }, [current?.latitude, current?.longitude, destination?.latitude, destination?.longitude, map]);

  return null;
}

const formatUpdateTime = (value?: string | null) => {
  if (!value) return 'Aguardando primeira localização';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Localização recebida';
  return `Última atualização às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

export default function PublicTrackingPage() {
  const { token = '' } = useParams();
  const [tracking, setTracking] = useState<TrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);
  const endedRef = useRef(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadTracking = useCallback(async () => {
    if (!token || endedRef.current) return;
    try {
      const { data, error: functionError } = await supabase.functions.invoke('rastrear-entrega', {
        body: { token },
      });
      if (functionError) throw functionError;
      const result = data as TrackingResponse;
      if (!result?.success) throw new Error('Não foi possível consultar o rastreamento.');
      if (!result.active) {
        endedRef.current = true;
        setEnded(true);
        setTracking(null);
        setError(null);
        return;
      }
      setTracking(result);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      console.error('[Rastreamento público] Falha ao atualizar:', err);
      setError('Não foi possível atualizar a localização neste momento.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    void loadTracking();
    const interval = window.setInterval(() => void loadTracking(), 5000);
    return () => window.clearInterval(interval);
  }, [loadTracking]);

  const current = useMemo<Coordinate | null>(() => {
    const point = tracking?.localizacao_motoboy;
    return point ? { latitude: Number(point.latitude), longitude: Number(point.longitude) } : null;
  }, [tracking?.localizacao_motoboy]);

  const destination = useMemo<Coordinate | null>(() => {
    const point = tracking?.destino;
    return point ? { latitude: Number(point.latitude), longitude: Number(point.longitude) } : null;
  }, [tracking?.destino]);

  if (loading && !tracking && !ended) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-orange-200 border-t-orange-600 animate-spin" />
          <p className="font-semibold text-stone-800">Carregando rastreamento...</p>
        </div>
      </main>
    );
  }

  if (ended || (!tracking && error)) {
    return (
      <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <section className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100">
            <PackageCheck className="h-8 w-8 text-stone-600" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">
            {ended ? 'Rastreamento encerrado' : 'Rastreamento indisponível'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            {ended
              ? 'Esta entrega foi finalizada ou o prazo do link expirou.'
              : error}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-sm">
            <Bike className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">MenuJunior</p>
            <h1 className="text-xl font-bold text-stone-900 sm:text-2xl">Seu pedido está a caminho</h1>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Ao vivo
          </span>
        </header>

        <section className="mb-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Endereço de entrega</p>
              <p className="mt-1 break-words text-sm font-semibold leading-6 text-stone-900">
                {tracking?.endereco_entrega || 'Endereço não informado'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 text-xs text-stone-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" />
              {formatUpdateTime(tracking?.localizacao_motoboy?.atualizada_em)}
            </span>
            {lastRefresh && <span>Consulta atualizada às {lastRefresh.toLocaleTimeString('pt-BR')}</span>}
          </div>
          {tracking?.localizacao_desatualizada && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
              A localização do entregador ainda não foi atualizada. O mapa será atualizado assim que o GPS enviar uma nova posição.
            </p>
          )}
          {error && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</p>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-bold text-stone-800">
              <Navigation className="h-4 w-4 text-orange-600" />
              Localização do entregador
            </div>
            <button
              type="button"
              onClick={() => void loadTracking()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </button>
          </div>
          <div className="h-[360px] w-full sm:h-[480px]">
            <MapContainer
              center={current ? [current.latitude, current.longitude] : [-14.235, -51.9253]}
              zoom={current ? 15 : 4}
              scrollWheelZoom={false}
              className="h-full w-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitTrackingMap current={current} destination={destination} />
              {current && (
                <Marker position={[current.latitude, current.longitude]} icon={motoboyIcon}>
                  <Popup>Entregador</Popup>
                </Marker>
              )}
              {destination && (
                <Marker position={[destination.latitude, destination.longitude]} icon={destinationIcon}>
                  <Popup>Endereço de entrega</Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
          {!current && (
            <p className="border-t border-stone-100 px-4 py-3 text-xs text-stone-500">
              Aguardando o primeiro sinal de GPS do entregador.
            </p>
          )}
          {current && !destination && (
            <p className="border-t border-stone-100 px-4 py-3 text-xs text-stone-500">
              O endereço está informado acima. O destino ainda não possui coordenadas para aparecer como marcador no mapa.
            </p>
          )}
        </section>

        <p className="mt-4 text-center text-[11px] text-stone-400">
          Este link é temporário e deixa de funcionar quando a entrega é encerrada.
        </p>
      </div>
    </main>
  );
}
