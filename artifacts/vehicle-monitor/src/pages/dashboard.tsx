import React from 'react';
import { 
  useGetDashboardStats, 
  useGetRecentAlerts, 
  useGetLivePositions 
} from '@workspace/api-client-react';
import { AlertTriangle, Car, Users, Activity, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSocket } from '@/hooks/use-socket';
import { Badge } from '@/components/ui/badge';
import LiveMap from '@/components/maps/LiveMap';

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: alerts, isLoading: alertsLoading } = useGetRecentAlerts();
  const { data: positions = [] } = useGetLivePositions();

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-primary">Painel do Sistema</h1>
          <p className="text-muted-foreground text-sm">Visão geral em tempo real das operações da frota.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse mr-2" />
            Sistema Ativo
          </Badge>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Car className="w-5 h-5 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Total de Veículos</p>
          </div>
          <p className="text-3xl font-bold">{statsLoading ? '-' : stats?.totalVehicles}</p>
        </div>
        <div className="bg-card border border-primary/20 rounded-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-primary/10 rounded-bl-full transition-transform group-hover:scale-110" />
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <Activity className="w-5 h-5 text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Online</p>
          </div>
          <p className="text-3xl font-bold text-primary relative z-10">{statsLoading ? '-' : stats?.onlineVehicles}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">Total de Clientes</p>
          </div>
          <p className="text-3xl font-bold">{statsLoading ? '-' : stats?.totalClients}</p>
        </div>
        <div className="bg-card border border-destructive/20 rounded-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-24 h-24 bg-destructive/10 rounded-bl-full transition-transform group-hover:scale-110" />
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <p className="text-sm font-medium text-muted-foreground">Alertas não lidos</p>
          </div>
          <p className="text-3xl font-bold text-destructive relative z-10">{statsLoading ? '-' : stats?.unreadAlerts}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border flex justify-between items-center bg-secondary/30">
            <h2 className="font-semibold tracking-wide">Mapa ao Vivo</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-mono text-primary/80">AO VIVO</span>
            </div>
          </div>
          <div className="flex-1 bg-secondary/50 relative">
            <LiveMap positions={positions} />
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border bg-secondary/30 flex justify-between items-center">
            <h2 className="font-semibold tracking-wide">Alertas Recentes</h2>
            <Badge variant="secondary" className="font-mono text-xs">{alerts?.length || 0}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {alertsLoading ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
            ) : alerts?.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center">
                <CheckCircle2 className="w-12 h-12 text-primary/30 mb-3" />
                <p className="text-muted-foreground">Nenhum alerta recente</p>
              </div>
            ) : (
              alerts?.map((alert) => (
                <div key={alert.id} className={`p-3 rounded-lg border ${alert.read ? 'bg-secondary/20 border-border' : 'bg-destructive/5 border-destructive/20'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant={alert.read ? 'outline' : 'destructive'} className="text-[10px] px-1.5 py-0">
                      {alert.type.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{alert.vehiclePlate}</p>
                  <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
