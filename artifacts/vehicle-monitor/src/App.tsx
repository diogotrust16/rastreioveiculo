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
import Reports from "@/pages/reports";
import NotFound from "@/pages/not-found";

const ALERT_LABELS: Record<string, string> = {
  SPEED_LIMIT:   'Limite de Velocidade',
  GEOFENCE_EXIT: 'Saída de Geocerca',
  IGNITION_ON:   'Ignição Ligada',
  IGNITION_OFF:  'Ignição Desligada',
  SIGNAL_LOST:   'Sinal Perdido',
};

function playAlertBeep() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.start(now);
    osc.stop(now + 0.35);

    osc.onended = () => ctx.close();
  } catch {
    // silently ignore if AudioContext is blocked
  }
}

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
      playAlertBeep();
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
        <Route path="/reports" component={Reports} />
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
