import React, { useState } from 'react';
import { useListGeofences, useListVehicles, useCreateGeofence, useDeleteGeofence, getListGeofencesQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Circle, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, MapPin, Shield } from 'lucide-react';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

type Geofence = { id: number; vehicleId: number; vehiclePlate?: string | null; name: string; latitude: number; longitude: number; radius: number; createdAt: string };

function ClickPicker({ picking, onPick }: { picking: boolean; onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => { if (picking) onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

export default function Geofences() {
  const qc = useQueryClient();
  const { data: geofences = [], isLoading } = useListGeofences();
  const { data: vehicles = [] } = useListVehicles();
  const createMut = useCreateGeofence();
  const deleteMut = useDeleteGeofence();

  const [dialog, setDialog] = useState(false);
  const [picking, setPicking] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ vehicleId: '', name: '', latitude: '', longitude: '', radius: '500' });

  function handlePick(lat: number, lng: number) {
    setForm(f => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
    setPicking(false);
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
    setForm({ vehicleId: '', name: '', latitude: '', longitude: '', radius: '500' });
  }

  async function handleDelete() {
    if (deleteId !== null) {
      await deleteMut.mutateAsync({ id: deleteId });
      qc.invalidateQueries({ queryKey: getListGeofencesQueryKey() });
      setDeleteId(null);
    }
  }

  const geofenceList = geofences as Geofence[];
  const mapCenter: [number, number] = geofenceList.length > 0 ? [geofenceList[0].latitude, geofenceList[0].longitude] : [-23.5505, -46.6333];

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-card flex flex-col overflow-hidden shrink-0">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-sm">Geofences</h2>
            <p className="text-xs text-muted-foreground">{geofenceList.length} configured</p>
          </div>
          <Button size="sm" onClick={() => setDialog(true)} className="gap-1.5 text-xs"><Plus className="w-3.5 h-3.5" /> Add</Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading...</div>
          ) : geofenceList.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No geofences yet</p>
            </div>
          ) : geofenceList.map((g, i) => (
            <div key={g.id} className="px-4 py-3 border-b border-border/50 hover:bg-muted/20 transition-colors group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <p className="font-medium text-sm">{g.name}</p>
                </div>
                <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive -mt-1 -mr-2" onClick={() => setDeleteId(g.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> {g.vehiclePlate ?? 'Unknown vehicle'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Radius: {g.radius}m · {g.latitude.toFixed(4)}, {g.longitude.toFixed(4)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {picking && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm shadow-lg">
            Click on the map to place the geofence center
          </div>
        )}
        <MapContainer center={mapCenter} zoom={12} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <ClickPicker picking={picking} onPick={handlePick} />
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
                    <p>Vehicle: {g.vehiclePlate ?? '—'}</p>
                    <p>Radius: {g.radius}m</p>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}
        </MapContainer>
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Geofence</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Vehicle</Label>
              <Select value={form.vehicleId} onValueChange={v => setForm(f => ({ ...f, vehicleId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>{(vehicles as any[]).map(v => <SelectItem key={v.id} value={v.id.toString()}>{v.plate} — {v.model}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Warehouse Zone" className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Latitude</Label><Input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="-23.5505" className="mt-1" /></div>
              <div><Label>Longitude</Label><Input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="-46.6333" className="mt-1" /></div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => { setDialog(false); setPicking(true); }} className="w-full gap-2 text-xs">
              <MapPin className="w-3.5 h-3.5" /> Pick on Map
            </Button>
            <div><Label>Radius (meters)</Label><Input type="number" value={form.radius} onChange={e => setForm(f => ({ ...f, radius: e.target.value }))} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.vehicleId || !form.name || !form.latitude || !form.longitude}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Geofence</AlertDialogTitle><AlertDialogDescription>This will remove the geofence permanently.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
