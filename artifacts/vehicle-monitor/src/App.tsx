import React, { useEffect } from 'react';
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { SocketProvider, useSocket } from "@/hooks/use-socket";
import { toast } from "@/hooks/use-toast";
import { getListAlertsQueryKey } from "@workspace/api-client-react";

import AppLayout from "@/components/layout/AppLayout";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Tracking from "@/pages/tracking";
import Vehicles from "@/pages/vehicles";
import Alerts from "@/pages/alerts";
import Geofences from "@/pages/geofences";
import Clients from "@/pages/clients";
import Users from "@/pages/users";
import NotFound from "@/pages/not-found";

const ALERT_LABELS: Record<string, string> = {
  SPEED_LIMIT:   'Limite de Velocidade',
  GEOFENCE_EXIT: 'Saída de Geocerca',
  IGNITION_ON:   'Ignição Ligada',
  IGNITION_OFF:  'Ignição Desligada',
  SIGNAL_LOST:   'Sinal Perdido',
};

function AlertNotifier() {
  const { socket } = useSocket();
  const qc = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    function handleAlert(data: {
      vehicleId: number;
      vehiclePlate: string;
      type: string;
      message: string;
      createdAt: string;
    }) {
      const label = ALERT_LABELS[data.type] ?? data.type;
      toast({
        title: `🔔 ${label}`,
        description: `${data.vehiclePlate} — ${data.message}`,
      });
      qc.invalidateQueries({ queryKey: getListAlertsQueryKey() });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    }

    socket.on('vehicle:alert', handleAlert);
    return () => { socket.off('vehicle:alert', handleAlert); };
  }, [socket, qc]);

  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  const { isAuthenticated, isAdmin } = useAuth();

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={() => <Redirect to="/dashboard" />} />
        <Route path="/login" component={() => <Redirect to="/dashboard" />} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/tracking" component={Tracking} />
        <Route path="/vehicles" component={Vehicles} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/geofences" component={Geofences} />
        <Route path="/clients" component={isAdmin ? Clients : () => <Redirect to="/dashboard" />} />
        <Route path="/users" component={isAdmin ? Users : () => <Redirect to="/dashboard" />} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AuthProvider>
          <SocketProvider>
            <TooltipProvider>
              <AlertNotifier />
              <Router />
              <Toaster />
            </TooltipProvider>
          </SocketProvider>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
