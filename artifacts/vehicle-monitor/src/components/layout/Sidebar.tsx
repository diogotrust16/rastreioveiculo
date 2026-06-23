import React from 'react';
import { Link, useLocation } from 'wouter';
import { Map, LayoutDashboard, Car, AlertTriangle, Users, Target, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/tracking', label: 'Rastreamento', icon: Map },
  { href: '/vehicles', label: 'Veículos', icon: Car },
  { href: '/alerts', label: 'Alertas', icon: AlertTriangle },
  { href: '/geofences', label: 'Geocercas', icon: Target },
  { href: '/clients', label: 'Clientes', icon: Users },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <div className="flex items-center gap-2 text-primary">
          <Target className="w-6 h-6" />
          <span className="font-bold text-lg tracking-wider text-foreground">FLEET<span className="text-primary">WATCH</span></span>
        </div>
      </div>
      <nav className="flex-1 py-6 px-3 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sair</span>
        </button>
      </div>
    </aside>
  );
}
