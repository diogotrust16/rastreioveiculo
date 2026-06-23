import React, { useState } from 'react';
import { useListAlerts, useMarkAlertRead, getListAlertsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Zap, MapPin, WifiOff, CheckCheck, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ALERT_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  SPEED_LIMIT:   { icon: <Zap className="w-3.5 h-3.5" />,     label: 'Limite de Velocidade', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  GEOFENCE_EXIT: { icon: <MapPin className="w-3.5 h-3.5" />,   label: 'Saída de Geocerca',    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  IGNITION_ON:   { icon: <Zap className="w-3.5 h-3.5" />,     label: 'Ignição Ligada',       color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  IGNITION_OFF:  { icon: <Zap className="w-3.5 h-3.5" />,     label: 'Ignição Desligada',    color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  SIGNAL_LOST:   { icon: <WifiOff className="w-3.5 h-3.5" />, label: 'Sinal Perdido',        color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

export default function Alerts() {
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data: alerts = [], isLoading } = useListAlerts({ unreadOnly });
  const markRead = useMarkAlertRead();

  async function handleMarkRead(id: number) {
    await markRead.mutateAsync({ id });
    qc.invalidateQueries({ queryKey: getListAlertsQueryKey() });
  }

  const unreadCount = (alerts as any[]).filter(a => !a.read).length;

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alertas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {unreadCount > 0
              ? `${unreadCount} alerta${unreadCount > 1 ? 's' : ''} não lido${unreadCount > 1 ? 's' : ''}`
              : 'Todos os alertas lidos'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant={unreadOnly ? 'default' : 'outline'} size="sm" onClick={() => setUnreadOnly(!unreadOnly)} className="gap-2">
            <Bell className="w-3.5 h-3.5" />
            {unreadOnly ? 'Exibindo Não Lidos' : 'Mostrar Não Lidos'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center p-8 text-muted-foreground">Carregando alertas...</div>
        ) : (alerts as any[]).length === 0 ? (
          <div className="text-center p-12 text-muted-foreground">
            <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Nenhum alerta encontrado</p>
          </div>
        ) : (
          (alerts as any[]).map(alert => {
            const meta = ALERT_META[alert.type] ?? { icon: <AlertTriangle className="w-3.5 h-3.5" />, label: alert.type, color: 'text-muted-foreground' };
            return (
              <div
                key={alert.id}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                  !alert.read
                    ? 'bg-card border-primary/20 shadow-sm'
                    : 'bg-card/50 border-border/50 opacity-60'
                }`}
              >
                <div className={`mt-0.5 flex items-center justify-center rounded-lg border p-2 ${meta.color}`}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className={`text-xs ${meta.color}`}>{meta.label}</Badge>
                    {!alert.read && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
                  </div>
                  <p className="text-sm font-medium">{alert.message}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="font-mono">{alert.vehiclePlate ?? '—'}</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: ptBR })}</span>
                  </div>
                </div>
                {!alert.read && (
                  <Button size="sm" variant="ghost" onClick={() => handleMarkRead(alert.id)} className="shrink-0 gap-1.5 text-xs">
                    <CheckCheck className="w-3.5 h-3.5" /> Marcar como Lido
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
