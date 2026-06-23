import React, { useState } from 'react';
import { useListGeofences, useListVehicles, useCreateGeofence, useDeleteGeofence, useGetLivePositions, getListGeofencesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, MapPin, Shield, Crosshair } from 'lucide-react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const vehicleIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

type Geofence = { id: number; vehicleId: number; vehiclePlate?: string | null; name: string; latitude: number; longitude: number; radius: number; createdAt: string };
type LivePos = { vehicleId: number; plate: string; model: string; status: string; latitude: number; longitude: number };

function ClickPicker({ picking, onPick }: { picking: boolean; onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => { if (picking) onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function FlyToCenter({ center }: { center: [number, number] | null }) {
  const map = useMap();
  React.useEffect(() => {
    if (center) map.flyTo(center, 14, { duration: 1 });
  }, [center, map]);
  return null;
}

export default function Geofences() {
  const qc = useQueryClient();
  const { data: geofences = [], isLoading } = useListGeofences();
  const { data: vehicles = [] } = useListVehicles();
  const { data: livePositions = [] } = useGetLivePositions();
  const createMut = useCreateGeofence();
  const deleteMut = useDeleteGeofence();

  const [dialog, setDialog] = useState(false);
  const [picking, setPicking] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [focusCenter, setFocusCenter] = useState<[number, number] | null>(null);
  const [form, setForm] = useState({ vehicleId: '', name: '', latitude: '', longitude: '', radius: '500' });

  const geofenceList = geofences as Geofence[];
  const liveList = livePositions as LivePos[];

  // Prefer live vehicle positions → existing geofences → fallback
  const defaultCenter: [number, number] = (() => {
    const online = liveList.find(v => v.status === 'ONLINE') ?? liveList[0];
    if (online) return [online.latitude, online.longitude];
    if (geofenceList.length > 0) return [geofenceList[0].latitude, geofenceList[0].longitude];
    return [-15.77, -47.93]; // Brasília as neutral fallback
  })();

  function handlePick(lat: number, lng: number) {
    setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
    setPicking(false);
    setDialog(true); // reopen dialog automatically
  }

  function startPicking() {
    setDialog(false);
    setPicking(true);
  }

  function centerOnVehicle(v: LivePos) {
    setFocusCenter([v.latitude, v.longitude]);
    setForm(f => ({ ...f, latitude: v.latitude.toFixed(6), longitude: v.longitude.toFixed(6) }));
  }

  async function handleSave() {
    await createMut.mutateAsync({
      data: {
        vehicleId: parseInt(form.vehicleId),
        name: form.name,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        radius: parseFloat(form.radius),
      }
    });
    qc.invalidateQueries({ queryKey: getListGeofencesQueryKey() });
    setDialog(false);
    setFocusCenter(null);
    setForm({ vehicleId: '', name: '', latitude: '', longitude: '', radius: '500' });
  }

  async function handleDelete() {
    if (deleteId !== null) {
      await deleteMut.mutateAsync({ id: deleteId });
      qc.invalidateQueries({ queryKey: getListGeofencesQueryKey() });
      setDeleteId(null);
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className="w-80 border-r border-border bg-card flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm">Geocercas</h2>
            <p className="text-xs text-muted-foreground">{geofenceList.length} configuradas</p>
          </div>
          <Button size="sm" onClick={() => setDialog(true)} className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </Button>
        </div>

        {/* Live vehicles — quick centering */}
        {liveList.length > 0 && (
          <div className="px-4 py-2 border-b border-border/50 bg-muted/10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Veículos online</p>
            <div className="space-y-1">
              {liveList.filter(v => v.status === 'ONLINE').map(v => (
                <button
                  key={v.vehicleId}
                  onClick={() => setFocusCenter([v.latitude, v.longitude])}
                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 transition-colors text-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="font-mono font-semibold">{v.plate}</span>
                  <span className="text-muted-foreground truncate">{v.model}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
          ) : geofenceList.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">Nenhuma geocerca cadastrada</p>
              <p className="text-xs mt-1">Clique em "Adicionar" para criar uma</p>
            </div>
          ) : geofenceList.map((g, i) => (
            <div key={g.id} className="px-4 py-3 border-b border-border/50 hover:bg-muted/20 transition-colors group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <p className="font-medium text-sm">{g.name}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm" variant="ghost"
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-muted-foreground"
                    onClick={() => setFocusCenter([g.latitude, g.longitude])}
                    title="Centralizar no mapa"
                  >
                    <Crosshair className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(g.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {g.vehiclePlate ?? 'Veículo desconhecido'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Raio: {g.radius}m · {g.latitude.toFixed(4)}, {g.longitude.toFixed(4)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative" style={{ isolation: 'isolate' }}>
        {picking && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm shadow-lg flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Clique no mapa para definir o centro da geocerca
          </div>
        )}
        <MapContainer center={defaultCenter} zoom={14} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <ClickPicker picking={picking} onPick={handlePick} />
          <FlyToCenter center={focusCenter} />

          {/* Live vehicle markers */}
          {liveList.filter(v => v.status === 'ONLINE').map(v => (
            <Marker key={v.vehicleId} position={[v.latitude, v.longitude]} icon={vehicleIcon}>
              <Popup>
                <div className="text-xs">
                  <p className="font-bold">{v.plate}</p>
                  <p className="text-gray-500">{v.model}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Geofence circles */}
          {geofenceList.map((g, i) => (
            <React.Fragment key={g.id}>
              <Circle
                center={[g.latitude, g.longitude]}
                radius={g.radius}
                pathOptions={{ color: COLORS[i % COLORS.length], fillColor: COLORS[i % COLORS.length], fillOpacity: 0.15, weight: 2 }}
              />
              <Marker position={[g.latitude, g.longitude]}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold">{g.name}</p>
                    <p>Veículo: {g.vehiclePlate ?? '—'}</p>
                    <p>Raio: {g.radius}m</p>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}
        </MapContainer>
      </div>

      {/* New geofence dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Geocerca</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Veículo</Label>
              <Select value={form.vehicleId} onValueChange={v => setForm(f => ({ ...f, vehicleId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar veículo" /></SelectTrigger>
                <SelectContent>
                  {(vehicles as any[]).map(v => (
                    <SelectItem key={v.id} value={v.id.toString()}>{v.plate} — {v.model}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Depósito Central" className="mt-1" />
            </div>

            {/* Quick-fill from online vehicles */}
            {liveList.filter(v => v.status === 'ONLINE').length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Usar posição de veículo online</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {liveList.filter(v => v.status === 'ONLINE').map(v => (
                    <Button key={v.vehicleId} size="sm" variant="outline" className="h-6 text-xs px-2 gap-1"
                      onClick={() => centerOnVehicle(v)}>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      {v.plate}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Latitude</Label>
                <Input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="-10.6820" className="mt-1 font-mono text-sm" />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="-48.4001" className="mt-1 font-mono text-sm" />
              </div>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={startPicking} className="w-full gap-2 text-xs">
              <MapPin className="w-3.5 h-3.5" /> Clicar no mapa para definir coordenadas
            </Button>

            <div>
              <Label>Raio (metros)</Label>
              <Input type="number" value={form.radius} onChange={e => setForm(f => ({ ...f, radius: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.vehicleId || !form.name || !form.latitude || !form.longitude || createMut.isPending}>
              {createMut.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Geocerca</AlertDialogTitle>
            <AlertDialogDescription>Isso removerá a geocerca permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
