import React, { useState } from 'react';
import {
  useListVehicles, useListClients,
  useCreateVehicle, useUpdateVehicle, useDeleteVehicle,
  getListVehiclesQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Wifi, WifiOff, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Vehicle = {
  id: number; plate: string; model: string; imei: string;
  status: 'ONLINE' | 'OFFLINE'; clientId?: number | null; clientName?: string | null;
  speedLimit?: number | null;
  lastPosition?: { latitude: number; longitude: number; speed?: number | null; createdAt: string } | null;
  createdAt: string;
};

const emptyForm = { plate: '', model: '', imei: '', clientId: '', speedLimit: '80' };

export default function Vehicles() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { data: vehicles = [], isLoading } = useListVehicles();
  const { data: clients = [] } = useListClients();
  const createMut = useCreateVehicle();
  const updateMut = useUpdateVehicle();
  const deleteMut = useDeleteVehicle();

  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const filtered = (vehicles as Vehicle[]).filter(v =>
    v.plate.toLowerCase().includes(search.toLowerCase()) ||
    v.model.toLowerCase().includes(search.toLowerCase()) ||
    v.imei.includes(search)
  );

  function openCreate() { setForm(emptyForm); setDialog('create'); }
  function openEdit(v: Vehicle) { setEditing(v); setForm({ plate: v.plate, model: v.model, imei: v.imei, clientId: v.clientId?.toString() ?? '', speedLimit: (v.speedLimit ?? 80).toString() }); setDialog('edit'); }

  async function handleSave() {
    const clientId = form.clientId && form.clientId !== '__none__' ? parseInt(form.clientId) : undefined;
    const speedLimit = parseInt(form.speedLimit) || 80;
    const payload = { plate: form.plate, model: form.model, imei: form.imei, clientId, speedLimit };
    if (dialog === 'create') {
      await createMut.mutateAsync({ data: payload });
    } else if (dialog === 'edit' && editing) {
      await updateMut.mutateAsync({ id: editing.id, data: payload });
    }
    qc.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
    setDialog(null);
  }

  async function handleDelete() {
    if (deleteId !== null) {
      await deleteMut.mutateAsync({ id: deleteId });
      qc.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
      setDeleteId(null);
    }
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Veículos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin ? 'Gerencie a sua frota monitorada.' : 'Visualize os veículos da sua frota.'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Adicionar Veículo</Button>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por placa, modelo ou IMEI..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando veículos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhum veículo encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Placa</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Modelo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">IMEI</th>
                {isAdmin && <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>}
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Lim. Vel.</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Última Atividade</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => (
                <tr key={v.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/5'}`}>
                  <td className="px-4 py-3 font-mono font-semibold">{v.plate}</td>
                  <td className="px-4 py-3">{v.model}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{v.imei}</td>
                  {isAdmin && <td className="px-4 py-3 text-muted-foreground">{v.clientName ?? '—'}</td>}
                  <td className="px-4 py-3 text-sm font-medium">{v.speedLimit ?? 80} <span className="text-xs text-muted-foreground">km/h</span></td>
                  <td className="px-4 py-3">
                    <Badge variant={v.status === 'ONLINE' ? 'default' : 'secondary'} className={`gap-1.5 ${v.status === 'ONLINE' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>
                      {v.status === 'ONLINE' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      {v.status === 'ONLINE' ? 'Online' : 'Offline'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {v.lastPosition ? formatDistanceToNow(new Date(v.lastPosition.createdAt), { addSuffix: true, locale: ptBR }) : '—'}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(v)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(v.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isAdmin && (
        <>
          <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }}>
            <DialogContent>
              <DialogHeader><DialogTitle>{dialog === 'create' ? 'Adicionar Veículo' : 'Editar Veículo'}</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div><Label>Placa</Label><Input value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} placeholder="ABC-1234" className="mt-1" /></div>
                <div><Label>Modelo</Label><Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} placeholder="Volvo FH 460" className="mt-1" /></div>
                <div><Label>IMEI</Label><Input value={form.imei} onChange={e => setForm(f => ({ ...f, imei: e.target.value }))} placeholder="123456789012345" className="mt-1" /></div>
                <div>
                  <Label>Cliente (opcional)</Label>
                  <Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Sem cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem cliente</SelectItem>
                      {(clients as {id: number; name: string}[]).map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Limite de velocidade (km/h)</Label>
                  <Input
                    type="number"
                    min={10}
                    max={200}
                    value={form.speedLimit}
                    onChange={e => setForm(f => ({ ...f, speedLimit: e.target.value }))}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Alerta disparado quando o veículo ultrapassar este limite</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={!form.plate || !form.model || !form.imei}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir Veículo</AlertDialogTitle>
                <AlertDialogDescription>Isso irá excluir permanentemente o veículo e todos os seus dados. Esta ação não pode ser desfeita.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
