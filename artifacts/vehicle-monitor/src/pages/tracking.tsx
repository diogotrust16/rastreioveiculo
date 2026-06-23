import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useListVehicles, useGetLivePositions, useGetPositionHistory, getGetLivePositionsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/hooks/use-socket';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Clock, Zap, Wifi, WifiOff, History, Crosshair, Navigation, Route, Trash2 } from 'lucide-react';
import { formatDistanceToNow, format, subHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const onlineIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const offlineIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

function MapFlyTo({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (position) map.flyTo(position, 15, { duration: 1.2 }); }, [position, map]);
  return null;
}

type LivePos = {
  vehicleId: number; plate: string; model: string; status: string;
  latitude: number; longitude: number; speed?: number | null;
  ignition?: boolean | null; updatedAt: string;
};

type TrailPoint = { lat: number; lng: number; speed: number | null };

// Speed → color for trail segments
function speedColor(speedMs: number | null): string {
  if (speedMs == null || speedMs < 0) return '#94a3b8';
  const kmh = speedMs * 3.6;
  if (kmh < 20)  return '#22c55e';   // green — slow
  if (kmh < 60)  return '#3b82f6';   // blue — normal
  if (kmh < 100) return '#f59e0b';   // amber — fast
  return '#ef4444';                   // red — very fast
}

const MAX_TRAIL_POINTS = 1000;

export default function Tracking() {
  const qc = useQueryClient();
  const { socket } = useSocket();
  const { data: vehicles = [] } = useListVehicles();
  const { data: livePositions = [], isLoading } = useGetLivePositions();

  const [mode, setMode] = useState<'live' | 'history'>('live');
  const [selectedVehicle, setSelectedVehicle] = useState<number | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [positions, setPositions] = useState<Map<number, LivePos>>(new Map());
  const [autoFollow, setAutoFollow] = useState(false);
  const [showTrail, setShowTrail] = useState(true);

  // Trail: accumulated live positions per vehicle
  const [trails, setTrails] = useState<Map<number, TrailPoint[]>>(new Map());

  const selectedVehicleRef = useRef<number | null>(null);
  const autoFollowRef = useRef(false);
  const showTrailRef = useRef(true);
  selectedVehicleRef.current = selectedVehicle;
  autoFollowRef.current = autoFollow;
  showTrailRef.current = showTrail;

  // History mode state
  const [histVehicle, setHistVehicle] = useState('');
  const [histFrom, setHistFrom] = useState('');
  const [histTo, setHistTo] = useState('');
  const [histEnabled, setHistEnabled] = useState(false);
  const { data: history = [] } = useGetPositionHistory(
    { vehicleId: parseInt(histVehicle) || 0, from: histFrom || undefined, to: histTo || undefined },
    { query: { enabled: histEnabled && !!histVehicle } as any }
  );

  // Seed trail with last 1h of history when vehicle is selected
  const [seedVehicle, setSeedVehicle] = useState<number | null>(null);
  const seedFrom = subHours(new Date(), 1).toISOString();
  const { data: seedHistory = [] } = useGetPositionHistory(
    { vehicleId: seedVehicle ?? 0, from: seedFrom },
    { query: { enabled: !!seedVehicle } as any }
  );

  useEffect(() => {
    if (!seedVehicle || !(seedHistory as any[]).length) return;
    const points: TrailPoint[] = (seedHistory as any[]).map((p: any) => ({
      lat: p.latitude, lng: p.longitude, speed: p.speed,
    }));
    setTrails(prev => {
      const next = new Map(prev);
      next.set(seedVehicle, points.slice(-MAX_TRAIL_POINTS));
      return next;
    });
  }, [seedHistory, seedVehicle]);

  // Sync live positions on first load
  useEffect(() => {
    const map = new Map<number, LivePos>();
    (livePositions as LivePos[]).forEach(p => map.set(p.vehicleId, p));
    setPositions(map);
  }, [livePositions]);

  // Socket: update live positions + grow trails
  useEffect(() => {
    if (!socket) return;
    socket.on('vehicle:position', (data: LivePos) => {
      setPositions(prev => new Map(prev).set(data.vehicleId, data));
      qc.invalidateQueries({ queryKey: getGetLivePositionsQueryKey() });

      if (autoFollowRef.current && selectedVehicleRef.current === data.vehicleId) {
        setFlyTo([data.latitude, data.longitude]);
      }

      // Append to trail
      setTrails(prev => {
        const existing = prev.get(data.vehicleId) ?? [];
        const next = [...existing, { lat: data.latitude, lng: data.longitude, speed: data.speed ?? null }];
        const trimmed = next.length > MAX_TRAIL_POINTS ? next.slice(-MAX_TRAIL_POINTS) : next;
        const m = new Map(prev);
        m.set(data.vehicleId, trimmed);
        return m;
      });
    });
    return () => { socket.off('vehicle:position'); };
  }, [socket, qc]);

  function selectVehicle(id: number, lat: number, lng: number) {
    setSelectedVehicle(id);
    setFlyTo([lat, lng]);
    // Seed trail with last 1h history
    setSeedVehicle(id);
  }

  function clearTrail() {
    if (selectedVehicle !== null) {
      setTrails(prev => { const m = new Map(prev); m.delete(selectedVehicle); return m; });
    }
  }

  const liveList = Array.from(positions.values());
  const selected = selectedVehicle ? positions.get(selectedVehicle) : null;
  const selectedTrail = selectedVehicle ? (trails.get(selectedVehicle) ?? []) : [];

  // Build colored trail segments
  const trailSegments: { positions: [number, number][]; color: string }[] = [];
  if (showTrail && selectedTrail.length > 1) {
    for (let i = 0; i < selectedTrail.length - 1; i++) {
      const a = selectedTrail[i];
      const b = selectedTrail[i + 1];
      trailSegments.push({
        positions: [[a.lat, a.lng], [b.lat, b.lng]],
        color: speedColor(b.speed),
      });
    }
  }

  const historyPoints: [number, number][] = (history as any[]).map(p => [p.latitude, p.longitude]);
  const mapCenter: [number, number] = liveList.length > 0
    ? [liveList[0].latitude, liveList[0].longitude]
    : [-15.77, -47.93];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-card flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex gap-2 mb-3">
            <Button size="sm" variant={mode === 'live' ? 'default' : 'outline'} onClick={() => setMode('live')} className="flex-1 gap-1.5 text-xs">
              <Wifi className="w-3.5 h-3.5" /> Ao Vivo
            </Button>
            <Button size="sm" variant={mode === 'history' ? 'default' : 'outline'} onClick={() => setMode('history')} className="flex-1 gap-1.5 text-xs">
              <History className="w-3.5 h-3.5" /> Histórico
            </Button>
          </div>
          {mode === 'history' && (
            <div className="space-y-2 text-xs">
              <Select value={histVehicle} onValueChange={setHistVehicle}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecionar veículo" /></SelectTrigger>
                <SelectContent>
                  {(vehicles as any[]).map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.plate} — {v.model}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="datetime-local" value={histFrom} onChange={e => setHistFrom(e.target.value)} className="h-8 text-xs" />
              <Input type="datetime-local" value={histTo} onChange={e => setHistTo(e.target.value)} className="h-8 text-xs" />
              <Button size="sm" className="w-full h-8 text-xs" onClick={() => setHistEnabled(true)} disabled={!histVehicle}>Exibir Rota</Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {mode === 'live' && (
            isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
            ) : liveList.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Nenhuma posição ativa</div>
            ) : liveList.map(v => (
              <button
                key={v.vehicleId}
                onClick={() => selectVehicle(v.vehicleId, v.latitude, v.longitude)}
                className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors ${selectedVehicle === v.vehicleId ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-semibold text-sm">{v.plate}</span>
                  <Badge variant="outline" className={`text-xs ${v.status === 'ONLINE' ? 'text-emerald-400 border-emerald-500/30' : 'text-muted-foreground'}`}>
                    {v.status === 'ONLINE' ? <Wifi className="w-2.5 h-2.5 mr-1" /> : <WifiOff className="w-2.5 h-2.5 mr-1" />}
                    {v.status === 'ONLINE' ? 'Online' : 'Offline'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{v.model}</p>
                {v.speed != null && (
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {Math.round((v.speed ?? 0) * 3.6)} km/h</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(v.updatedAt), { addSuffix: true, locale: ptBR })}</span>
                  </div>
                )}
              </button>
            ))
          )}
          {mode === 'history' && histEnabled && (history as any[]).length > 0 && (
            <div className="p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">{(history as any[]).length} posições</p>
              <p>{format(new Date((history as any[])[0].createdAt), 'dd/MM/yyyy HH:mm')} → {format(new Date((history as any[])[(history as any[]).length - 1].createdAt), 'HH:mm')}</p>
            </div>
          )}
        </div>

        {/* Selected vehicle info + controls */}
        {selected && mode === 'live' && (
          <div className="p-4 border-t border-border bg-muted/20 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">{selected.plate}</p>
              <Badge variant="outline" className="text-[10px]">
                {selectedTrail.length} pts
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground block">Velocidade</span>
                <span className="font-medium">{selected.speed != null ? `${Math.round((selected.speed ?? 0) * 3.6)} km/h` : '—'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Ignição</span>
                <span className="font-medium">{selected.ignition != null ? (selected.ignition ? 'Ligada' : 'Desligada') : '—'}</span>
              </div>
              <div><span className="text-muted-foreground block">Lat</span><span className="font-mono">{selected.latitude.toFixed(5)}</span></div>
              <div><span className="text-muted-foreground block">Lng</span><span className="font-mono">{selected.longitude.toFixed(5)}</span></div>
            </div>
            <p className="text-muted-foreground">{formatDistanceToNow(new Date(selected.updatedAt), { addSuffix: true, locale: ptBR })}</p>

            <div className="flex gap-1.5 pt-1 flex-wrap">
              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={() => setFlyTo([selected.latitude, selected.longitude])}>
                <Crosshair className="w-3 h-3" /> Centralizar
              </Button>
              <Button size="sm" variant={autoFollow ? 'default' : 'outline'} className="flex-1 h-7 text-xs gap-1" onClick={() => setAutoFollow(v => !v)}>
                <Navigation className="w-3 h-3" /> {autoFollow ? 'Seguindo' : 'Seguir'}
              </Button>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant={showTrail ? 'default' : 'outline'} className="flex-1 h-7 text-xs gap-1" onClick={() => setShowTrail(v => !v)}>
                <Route className="w-3 h-3" /> {showTrail ? 'Trajeto on' : 'Trajeto off'}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={clearTrail} title="Limpar trajeto">
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>

            {/* Speed legend */}
            {showTrail && selectedTrail.length > 1 && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] text-muted-foreground">Cor:</span>
                {[{ color: '#22c55e', label: '<20' }, { color: '#3b82f6', label: '20–60' }, { color: '#f59e0b', label: '60–100' }, { color: '#ef4444', label: '>100' }].map(s => (
                  <div key={s.color} className="flex items-center gap-0.5">
                    <div className="w-3 h-1.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-[9px] text-muted-foreground">{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer center={mapCenter} zoom={14} style={{ width: '100%', height: '100%' }} className="z-0">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapFlyTo position={flyTo} />

          {/* Live mode */}
          {mode === 'live' && (
            <>
              {/* Colored trail segments */}
              {trailSegments.map((seg, i) => (
                <Polyline key={i} positions={seg.positions} color={seg.color} weight={4} opacity={0.85} />
              ))}

              {/* Trail start dot */}
              {showTrail && selectedTrail.length > 0 && (
                <CircleMarker
                  center={[selectedTrail[0].lat, selectedTrail[0].lng]}
                  radius={5}
                  pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 1, weight: 2 }}
                >
                  <Popup><span className="text-xs font-medium">Início do trajeto</span></Popup>
                </CircleMarker>
              )}

              {/* Vehicle markers */}
              {liveList.map(v => (
                <Marker
                  key={v.vehicleId}
                  position={[v.latitude, v.longitude]}
                  icon={v.status === 'ONLINE' ? onlineIcon : offlineIcon}
                  eventHandlers={{ click: () => selectVehicle(v.vehicleId, v.latitude, v.longitude) }}
                >
                  <Popup>
                    <div className="text-xs min-w-32">
                      <p className="font-bold text-sm">{v.plate}</p>
                      <p className="text-gray-500">{v.model}</p>
                      <p>Status: <strong>{v.status === 'ONLINE' ? 'Online' : 'Offline'}</strong></p>
                      {v.speed != null && <p>Velocidade: <strong>{Math.round((v.speed ?? 0) * 3.6)} km/h</strong></p>}
                      {v.ignition != null && <p>Ignição: <strong>{v.ignition ? 'Ligada' : 'Desligada'}</strong></p>}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </>
          )}

          {/* History mode */}
          {mode === 'history' && historyPoints.length > 0 && (
            <>
              <Polyline positions={historyPoints} color="#3b82f6" weight={3} opacity={0.85} />
              <CircleMarker center={historyPoints[0]} radius={6} pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1 }}>
                <Popup><span className="text-xs font-medium">Início</span></Popup>
              </CircleMarker>
              <CircleMarker center={historyPoints[historyPoints.length - 1]} radius={6} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }}>
                <Popup><span className="text-xs font-medium">Fim</span></Popup>
              </CircleMarker>
            </>
          )}
        </MapContainer>

        {/* Map overlay: trail stats */}
        {mode === 'live' && showTrail && selectedTrail.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-card/90 backdrop-blur border border-border rounded-xl px-4 py-2 flex items-center gap-4 text-xs shadow-lg">
            <span className="text-muted-foreground">Trajeto ao vivo</span>
            <span className="font-semibold">{selectedTrail.length} pontos</span>
            {selected?.speed != null && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: speedColor(selected.speed) }} />
                {Math.round((selected.speed ?? 0) * 3.6)} km/h
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
