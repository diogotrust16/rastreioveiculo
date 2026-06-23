import React, { useState } from 'react';
import {
  useListClients, useCreateClient, useUpdateClient, useDeleteClient,
  getListClientsQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Building2, Car, Search } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Client = { id: number; name: string; document?: string | null; phone?: string | null; vehicleCount?: number | null; createdAt: string };
const emptyForm = { name: '', document: '', phone: '' };

export default function Clients() {
  const qc = useQueryClient();
  const { data: clients = [], isLoading } = useListClients();
  const createMut = useCreateClient();
  const updateMut = useUpdateClient();
  const deleteMut = useDeleteClient();

  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const filtered = (clients as Client[]).filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.document ?? '').includes(search) ||
    (c.phone ?? '').includes(search)
  );

  function openCreate() { setForm(emptyForm); setDialog('create'); }
  function openEdit(c: Client) { setEditing(c); setForm({ name: c.name, document: c.document ?? '', phone: c.phone ?? '' }); setDialog('edit'); }

  async function handleSave() {
    const payload = { name: form.name, document: form.document || null, phone: form.phone || null };
    if (dialog === 'create') {
      await createMut.mutateAsync({ data: payload });
    } else if (dialog === 'edit' && editing) {
      await updateMut.mutateAsync({ id: editing.id, data: payload });
    }
    qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
    setDialog(null);
  }

  async function handleDelete() {
    if (deleteId !== null) {
      await deleteMut.mutateAsync({ id: deleteId });
      qc.invalidateQueries({ queryKey: getListClientsQueryKey() });
      setDeleteId(null);
    }
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">{(clients as Client[]).length} clientes no total</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Adicionar Cliente</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar clientes..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 text-center p-8 text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-3 text-center p-12 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Nenhum cliente encontrado</p>
          </div>
        ) : filtered.map(c => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors group">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            <h3 className="font-semibold text-base mb-1">{c.name}</h3>
            {c.document && <p className="text-xs text-muted-foreground mb-0.5">CNPJ: {c.document}</p>}
            {c.phone && <p className="text-xs text-muted-foreground mb-2">{c.phone}</p>}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
              <Car className="w-3.5 h-3.5" />
              <span>{c.vehicleCount ?? 0} veículo{(c.vehicleCount ?? 0) !== 1 ? 's' : ''}</span>
              <span className="ml-auto">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: ptBR })}</span>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog === 'create' ? 'Adicionar Cliente' : 'Editar Cliente'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Razão Social</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="LogiTrans Ltda" className="mt-1" /></div>
            <div><Label>CNPJ</Label><Input value={form.document} onChange={e => setForm(f => ({ ...f, document: e.target.value }))} placeholder="12.345.678/0001-99" className="mt-1" /></div>
            <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 3456-7890" className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>Isso irá excluir permanentemente o cliente. Os veículos vinculados a ele ficarão sem cliente.</AlertDialogDescription>
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
