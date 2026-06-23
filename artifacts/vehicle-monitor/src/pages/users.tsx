import React, { useState } from 'react';
import {
  useListUsers, useCreateUser, useUpdateUser, useDeleteUser,
  useListClients,
  getListUsersQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Search, ShieldCheck, User as UserIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type User = {
  id: number; name: string; email: string;
  role: 'ADMIN' | 'CLIENT'; clientId?: number | null; createdAt: string;
};

type Client = { id: number; name: string };

const emptyForm = { name: '', email: '', password: '', role: 'CLIENT' as 'ADMIN' | 'CLIENT', clientId: '' };

export default function Users() {
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useListUsers();
  const { data: clients = [] } = useListClients();
  const createMut = useCreateUser();
  const updateMut = useUpdateUser();
  const deleteMut = useDeleteUser();

  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const filtered = (users as User[]).filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    setForm(emptyForm);
    setError('');
    setDialog('create');
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, clientId: u.clientId?.toString() ?? '' });
    setError('');
    setDialog('edit');
  }

  async function handleSave() {
    setError('');
    const clientId = form.clientId && form.clientId !== '__none__' ? parseInt(form.clientId) : null;
    const payload = {
      name: form.name,
      email: form.email,
      role: form.role,
      clientId,
      ...(form.password ? { password: form.password } : {}),
    };

    try {
      if (dialog === 'create') {
        if (!form.password) { setError('Senha é obrigatória para novos usuários.'); return; }
        await createMut.mutateAsync({ data: { ...payload, password: form.password } });
      } else if (dialog === 'edit' && editing) {
        await updateMut.mutateAsync({ id: editing.id, data: payload });
      }
      qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setDialog(null);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? 'Erro ao salvar usuário.');
    }
  }

  async function handleDelete() {
    if (deleteId !== null) {
      await deleteMut.mutateAsync({ id: deleteId });
      qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
      setDeleteId(null);
    }
  }

  const clientList = clients as Client[];

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie os usuários do sistema.</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Adicionar Usuário</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar por nome ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando usuários...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhum usuário encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">E-mail</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Perfil</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente vinculado</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Criado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const linkedClient = clientList.find(c => c.id === u.clientId);
                return (
                  <tr key={u.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/5'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                          {u.role === 'ADMIN'
                            ? <ShieldCheck className="w-4 h-4 text-primary" />
                            : <UserIcon className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <span className="font-medium">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}
                        className={u.role === 'ADMIN'
                          ? 'bg-primary/15 text-primary border-primary/20'
                          : 'bg-muted text-muted-foreground'}>
                        {u.role === 'ADMIN' ? 'Admin' : 'Cliente'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{linkedClient?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true, locale: ptBR })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(u)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(u.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === 'create' ? 'Adicionar Usuário' : 'Editar Usuário'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="João Silva" className="mt-1" /></div>
            <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="joao@empresa.com.br" className="mt-1" /></div>
            <div>
              <Label>{dialog === 'create' ? 'Senha' : 'Nova senha (deixe em branco para manter)'}</Label>
              <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={dialog === 'create' ? 'Mínimo 6 caracteres' : 'Opcional'} className="mt-1" />
            </div>
            <div>
              <Label>Perfil</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as 'ADMIN' | 'CLIENT' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLIENT">Cliente</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === 'CLIENT' && (
              <div>
                <Label>Empresa cliente (opcional)</Label>
                <Select value={form.clientId || '__none__'} onValueChange={v => setForm(f => ({ ...f, clientId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Sem empresa" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem empresa</SelectItem>
                    {clientList.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.email || createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>Isso irá excluir permanentemente este usuário. Ele não conseguirá mais fazer login no sistema.</AlertDialogDescription>
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
