import { NavLink, useLocation } from 'react-router-dom';
import { Home, BarChart3, Droplets, SlidersHorizontal, Users, Landmark, Clock } from 'lucide-react';

const navItems = [
  { to: '/', icon: Home, label: 'Overview' },
  { to: '/pnl', icon: BarChart3, label: 'P&L' },
  { to: '/cashflow', icon: Droplets, label: 'Cash Flow' },
  { to: '/assumptions', icon: SlidersHorizontal, label: 'Assumptions' },
  { to: '/clients', icon: Users, label: 'Clients & Growth' },
  { to: '/debt', icon: Landmark, label: 'Debt & Finance' },
  { to: '/history', icon: Clock, label: 'Version History' },
];

export default function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-sidebar border-r border-sidebar-border p-4">
      <div className="mb-8 px-2">
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          O2 <span className="text-primary">Inc</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Financial Model 2025–2030</p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary-foreground border border-primary/20'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      <div className="mt-auto px-2 py-4 border-t border-sidebar-border">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Valores em R$ mil (000's)<br />
          Projeções estimadas · Modelo v7
        </p>
      </div>
    </aside>
  );
}
