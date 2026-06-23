import React, { useState, useEffect, useRef } from 'react';
import { useListVehicles, useGetLivePositions, useGetPositionHistory, getGetLivePositionsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/hooks/use-socket';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Clock, Zap, Wifi, WifiOff, History, Crosshair, Navigation } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
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
  useEffect(() => { if (position) map.flyTo(position, 14, { duration: 1.5 }); }, [position, map]);
  return null;
}

type LivePos = { vehicleId: number; plate: string; model: string; status: string; latitude: number; longitude: number; speed?: number | null; ignition?: boolean | null; updatedAt: string };

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
  const selectedVehicleRef = useRef<number | null>(null);
  const autoFollowRef = useRef(false);
  selectedVehicleRef.current = selectedVehicle;
  autoFollowRef.current = autoFollow;

  const [histVehicle, setHistVehicle] = useState('');
  const [histFrom, setHistFrom] = useState('');
  const [histTo, setHistTo] = useState('');
  const [histEnabled, setHistEnabled] = useState(false);
  const { data: history = [] } = useGetPositionHistory(
    { vehicleId: parseInt(histVehicle) || 0, from: histFrom || undefined, to: histTo || undefined },
    { query: { enabled: histEnabled && !!histVehicle } as any }
  );

  useEffect(() => {
    const map = new Map<number, LivePos>();
    (livePositions as LivePos[]).forEach(p => map.set(p.vehicleId, p));
    setPositions(map);
  }, [livePositions]);

  useEffect(() => {
    if (!socket) return;
    socket.on('vehicle:position', (data: LivePos) => {
      setPositions(prev => new Map(prev).set(data.vehicleId, data));
      qc.invalidateQueries({ queryKey: getGetLivePositionsQueryKey() });
      if (autoFollowRef.current && selectedVehicleRef.current === data.vehicleId) {
        setFlyTo([data.latitude, data.longitude]);
      }
    });
    return () => { socket.off('vehicle:position'); };
  }, [socket, qc]);

  const liveList = Array.from(positions.values());
  const selected = selectedVehicle ? positions.get(selectedVehicle) : null;

  const historyPoints: [number, number][] = (history as any[]).map(p => [p.latitude, p.longitude]);
  const mapCenter: [number, number] = liveList.length > 0 ? [liveList[0].latitude, liveList[0].longitude] : [-23.5505, -46.6333];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
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
                onClick={() => { setSelectedVehicle(v.vehicleId); setFlyTo([v.latitude, v.longitude]); }}
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
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {Math.round(v.speed)} km/h</span>
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

        {selected && mode === 'live' && (
          <div className="p-4 border-t border-border bg-muted/20 text-xs space-y-2">
            <p className="font-semibold text-sm">{selected.plate}</p>
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground block">Velocidade</span><span className="font-medium">{selected.speed != null ? `${Math.round(selected.speed)} km/h` : '—'}</span></div>
              <div><span className="text-muted-foreground block">Ignição</span><span className="font-medium">{selected.ignition != null ? (selected.ignition ? 'Ligada' : 'Desligada') : '—'}</span></div>
              <div><span className="text-muted-foreground block">Lat</span><span className="font-mono">{selected.latitude.toFixed(5)}</span></div>
              <div><span className="text-muted-foreground block">Lng</span><span className="font-mono">{selected.longitude.toFixed(5)}</span></div>
            </div>
            <p className="text-muted-foreground">{formatDistanceToNow(new Date(selected.updatedAt), { addSuffix: true, locale: ptBR })}</p>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-7 text-xs gap-1.5"
                onClick={() => setFlyTo([selected.latitude, selected.longitude])}
              >
                <Crosshair className="w-3 h-3" /> Centralizar
              </Button>
              <Button
                size="sm"
                variant={autoFollow ? 'default' : 'outline'}
                className="flex-1 h-7 text-xs gap-1.5"
                onClick={() => setAutoFollow(v => !v)}
              >
                <Navigation className="w-3 h-3" /> {autoFollow ? 'Seguindo' : 'Seguir'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 relative">
        <MapContainer center={mapCenter} zoom={11} style={{ width: '100%', height: '100%' }} className="z-0">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapFlyTo position={flyTo} />
          {mode === 'live' && liveList.map(v => (
            <Marker key={v.vehicleId} position={[v.latitude, v.longitude]} icon={v.status === 'ONLINE' ? onlineIcon : offlineIcon}>
              <Popup>
                <div className="text-xs min-w-32">
                  <p className="font-bold text-sm">{v.plate}</p>
                  <p className="text-gray-500">{v.model}</p>
                  <p>Status: <strong>{v.status === 'ONLINE' ? 'Online' : 'Offline'}</strong></p>
                  {v.speed != null && <p>Velocidade: <strong>{Math.round(v.speed)} km/h</strong></p>}
                  {v.ignition != null && <p>Ignição: <strong>{v.ignition ? 'Ligada' : 'Desligada'}</strong></p>}
                </div>
              </Popup>
            </Marker>
          ))}
          {mode === 'history' && historyPoints.length > 0 && (
            <>
              <Polyline positions={historyPoints} color="#3b82f6" weight={3} opacity={0.8} />
              <Marker position={historyPoints[0]}>
                <Popup><span className="text-xs font-medium">Início</span></Popup>
              </Marker>
              <Marker position={historyPoints[historyPoints.length - 1]}>
                <Popup><span className="text-xs font-medium">Fim</span></Popup>
              </Marker>
            </>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
