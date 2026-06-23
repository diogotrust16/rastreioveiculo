import React, { useState, useMemo } from 'react';
import { useListVehicles, useGetPositionHistory } from '@workspace/api-client-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, ReferenceLine, Legend,
} from 'recharts';
import { format, subHours, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Car, Gauge, Clock, TrendingUp, BarChart2 } from 'lucide-react';

type Position = { id: number; vehicleId: number; latitude: number; longitude: number; speed: number | null; createdAt: string };

const PERIODS = [
  { label: 'Última hora',  value: '1h' },
  { label: 'Últimas 6h',  value: '6h' },
  { label: 'Últimas 24h', value: '24h' },
  { label: 'Hoje',        value: 'today' },
  { label: 'Últimos 7d',  value: '7d' },
];

function getPeriodDates(period: string): { from: string; to: string } {
  const now = new Date();
  let from: Date;
  switch (period) {
    case '1h':    from = subHours(now, 1); break;
    case '6h':    from = subHours(now, 6); break;
    case '24h':   from = subHours(now, 24); break;
    case 'today': from = startOfDay(now);  break;
    case '7d':    from = subDays(now, 7); break;
    default:      from = subHours(now, 24);
  }
  return { from: from.toISOString(), to: now.toISOString() };
}

function formatTime(dateStr: string, period: string) {
  const d = new Date(dateStr);
  if (period === '7d') return format(d, 'dd/MM HH:mm', { locale: ptBR });
  return format(d, 'HH:mm', { locale: ptBR });
}

function StatCard({ label, value, icon: Icon, color = 'text-primary' }: { label: string; value: string; icon: any; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg bg-muted/30 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg px-3 py-2 text-xs shadow-lg">
        <p className="text-muted-foreground mb-1">{label}</p>
        <p className="font-semibold text-primary">{payload[0].value?.toFixed(1)} km/h</p>
      </div>
    );
  }
  return null;
};

export default function Reports() {
  const { data: vehicles = [] } = useListVehicles();
  const [vehicleId, setVehicleId] = useState('');
  const [period, setPeriod] = useState('24h');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  const vehicleIdNum = vehicleId ? parseInt(vehicleId) : 0;

  // Memoize dates so the query key only changes when period changes,
  // not on every render (which would cause an infinite re-fetch loop).
  const { from, to } = useMemo(() => getPeriodDates(period), [period]);

  const { data: rawPositions = [], isLoading, isFetching } = useGetPositionHistory(
    { vehicleId: vehicleIdNum, from, to },
    { query: { enabled: !!vehicleId, refetchInterval: 60_000, staleTime: 30_000 } }
  );

  const positions = rawPositions as Position[];

  // Build chart data — filter out invalid/negative speeds
  const chartData = positions
    .filter(p => p.speed !== null && p.speed >= 0)
    .map(p => ({
      time: formatTime(p.createdAt, period),
      speed: parseFloat((p.speed! * 3.6).toFixed(1)), // m/s → km/h
      rawTime: p.createdAt,
    }));

  // Downsample if too many points (>500) to keep chart responsive
  const MAX_POINTS = 400;
  const displayData = chartData.length > MAX_POINTS
    ? chartData.filter((_, i) => i % Math.ceil(chartData.length / MAX_POINTS) === 0)
    : chartData;

  // Stats
  const speeds = chartData.map(d => d.speed).filter(s => s > 0);
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;
  const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
  const timeMoving = chartData.filter(d => d.speed > 2).length;
  const timeMovingPct = chartData.length ? Math.round((timeMoving / chartData.length) * 100) : 0;

  const selectedVehicle = (vehicles as any[]).find(v => v.id.toString() === vehicleId);

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto bg-background">
      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold">Relatório de Velocidade</h1>
            <p className="text-sm text-muted-foreground">Histórico de velocidade por veículo e período</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Vehicle selector */}
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Selecionar veículo" />
              </SelectTrigger>
              <SelectContent>
                {(vehicles as any[]).map(v => (
                  <SelectItem key={v.id} value={v.id.toString()}>
                    <span className="font-mono font-semibold">{v.plate}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{v.model}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Period selector */}
            <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
              {PERIODS.map(p => (
                <Button
                  key={p.value}
                  size="sm"
                  variant={period === p.value ? 'default' : 'ghost'}
                  className="h-7 text-xs px-2.5"
                  onClick={() => setPeriod(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {/* Chart type toggle */}
            <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
              <Button size="sm" variant={chartType === 'area' ? 'default' : 'ghost'} className="h-7 w-7 p-0" onClick={() => setChartType('area')} title="Área">
                <TrendingUp className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant={chartType === 'bar' ? 'default' : 'ghost'} className="h-7 w-7 p-0" onClick={() => setChartType('bar')} title="Barras">
                <BarChart2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {!vehicleId ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
            <Car className="w-16 h-16 opacity-20" />
            <p className="text-sm">Selecione um veículo para ver o relatório</p>
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Velocidade máxima" value={maxSpeed > 0 ? `${maxSpeed.toFixed(0)} km/h` : '—'} icon={Gauge} color="text-red-500" />
              <StatCard label="Velocidade média" value={avgSpeed > 0 ? `${avgSpeed.toFixed(0)} km/h` : '—'} icon={TrendingUp} color="text-blue-500" />
              <StatCard label="Em movimento" value={`${timeMovingPct}%`} icon={Clock} color="text-emerald-500" />
              <StatCard label="Registros" value={positions.length.toLocaleString('pt-BR')} icon={BarChart2} color="text-purple-500" />
            </div>

            {/* Chart */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-sm">Velocidade ao longo do tempo</h2>
                  {selectedVehicle && (
                    <Badge variant="outline" className="text-xs font-mono">{selectedVehicle.plate}</Badge>
                  )}
                </div>
                {isFetching && (
                  <span className="text-xs text-muted-foreground animate-pulse">Atualizando...</span>
                )}
              </div>

              {isLoading ? (
                <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">Carregando...</div>
              ) : displayData.length === 0 ? (
                <div className="h-72 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <BarChart2 className="w-10 h-10 opacity-20" />
                  <p className="text-sm">Sem dados de posição para este período</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  {chartType === 'area' ? (
                    <AreaChart data={displayData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} interval="preserveStartEnd" />
                      <YAxis unit=" km/h" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={64} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={80} stroke="hsl(var(--destructive))" strokeDasharray="4 2" label={{ value: '80 km/h', position: 'right', fontSize: 10, fill: 'hsl(var(--destructive))' }} />
                      <Area type="monotone" dataKey="speed" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#speedGrad)" dot={false} activeDot={{ r: 4 }} />
                    </AreaChart>
                  ) : (
                    <BarChart data={displayData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} interval="preserveStartEnd" />
                      <YAxis unit=" km/h" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={64} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={80} stroke="hsl(var(--destructive))" strokeDasharray="4 2" />
                      <Bar dataKey="speed" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} maxBarSize={8} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            {/* Speed distribution */}
            {speeds.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="font-semibold text-sm mb-4">Distribuição de velocidade</h2>
                <div className="grid grid-cols-4 gap-3 text-center">
                  {[
                    { label: 'Parado (0–2)', count: chartData.filter(d => d.speed <= 2).length, color: 'bg-slate-400' },
                    { label: 'Lento (2–40)', count: chartData.filter(d => d.speed > 2 && d.speed <= 40).length, color: 'bg-emerald-500' },
                    { label: 'Normal (40–80)', count: chartData.filter(d => d.speed > 40 && d.speed <= 80).length, color: 'bg-blue-500' },
                    { label: 'Rápido (>80)', count: chartData.filter(d => d.speed > 80).length, color: 'bg-red-500' },
                  ].map(b => {
                    const pct = chartData.length ? Math.round((b.count / chartData.length) * 100) : 0;
                    return (
                      <div key={b.label} className="space-y-1.5">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${b.color} transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-lg font-bold">{pct}%</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">{b.label} km/h</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
