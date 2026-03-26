import { NavLink, useLocation } from 'react-router-dom';
import { Home, BarChart3, Droplets, SlidersHorizontal, Landmark, TrendingUp, Clock, X } from 'lucide-react';
import o2Logo from '@/assets/O2_Inc_Logo.png';

const navItems = [
  { to: '/', icon: Home, label: 'Overview' },
  { to: '/assumptions', icon: SlidersHorizontal, label: 'Assumptions' },
  { to: '/pnl', icon: BarChart3, label: 'P&L' },
  { to: '/cashflow', icon: Droplets, label: 'Cash Flow' },
  { to: '/debt', icon: Landmark, label: 'Debt & Finance' },
  { to: '/valuation', icon: TrendingUp, label: 'Valuation & Cap Table' },
  { to: '/history', icon: Clock, label: 'Version History' },
];

interface AppSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function AppSidebar({ mobileOpen, onMobileClose }: AppSidebarProps) {
  const location = useLocation();

  const sidebarContent = (
    <>
      <div className="mb-8 px-2 flex items-center justify-between">
        <div>
          <img src={o2Logo} alt="O2 Inc" className="h-10 w-auto" />
          <p className="text-xs text-muted-foreground mt-1">Financial Model 2025–2030</p>
        </div>
        <button
          onClick={onMobileClose}
          className="md:hidden p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onMobileClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-sidebar-accent text-primary border border-primary/20'
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
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 min-h-screen bg-sidebar border-r border-sidebar-border p-4">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <aside className="relative flex flex-col w-72 max-w-[80vw] h-full bg-sidebar border-r border-sidebar-border p-4 animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
