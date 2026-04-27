import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, BarChart3, Droplets, SlidersHorizontal, Landmark, TrendingUp, Clock, X, Receipt, Calculator, Eye, EyeOff, LogOut, User } from 'lucide-react';
import o2Logo from '@/assets/O2_Inc_Logo.png';
import { getBackendClientSafe } from '@/lib/supabase-safe';

const HIDDEN_NAV_KEY = 'o2_hidden_nav';

function getHiddenNav(): string[] {
  try {
    const stored = localStorage.getItem(HIDDEN_NAV_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

const navItems = [
  { to: '/', icon: Home, label: 'Overview', hideable: false },
  { to: '/assumptions', icon: SlidersHorizontal, label: 'Assumptions', hideable: false },
  { to: '/premissas', icon: Receipt, label: 'Premissas Tributárias', hideable: true },
  { to: '/simulador-tributario', icon: Calculator, label: 'Simulador Tributário', hideable: true },
  { to: '/pnl', icon: BarChart3, label: 'P&L', hideable: false },
  { to: '/cashflow', icon: Droplets, label: 'Cash Flow', hideable: false },
  { to: '/debt', icon: Landmark, label: 'Debt & Finance', hideable: false },
  { to: '/valuation', icon: TrendingUp, label: 'Valuation & Cap Table', hideable: false },
  { to: '/history', icon: Clock, label: 'Version History', hideable: false },
];

interface AppSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function AppSidebar({ mobileOpen, onMobileClose }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [hiddenRoutes, setHiddenRoutes] = useState<string[]>(getHiddenNav);
  const [editMode, setEditMode] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getBackendClientSafe();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const handleSignOut = async () => {
    const supabase = getBackendClientSafe();
    if (!supabase) return;
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  };

  const toggleRoute = (to: string) => {
    setHiddenRoutes(prev => {
      const next = prev.includes(to) ? prev.filter(r => r !== to) : [...prev, to];
      localStorage.setItem(HIDDEN_NAV_KEY, JSON.stringify(next));
      return next;
    });
  };

  const visibleItems = editMode ? navItems : navItems.filter(item => !hiddenRoutes.includes(item.to));
  const hasHideableItems = navItems.some(item => item.hideable);

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
        {visibleItems.map(({ to, icon: Icon, label, hideable }) => {
          const isActive = location.pathname === to;
          const isHidden = hiddenRoutes.includes(to);
          return (
            <div key={to} className="flex items-center gap-1">
              <NavLink
                to={to}
                onClick={onMobileClose}
                className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isHidden && editMode
                    ? 'opacity-40 line-through text-sidebar-foreground'
                    : isActive
                    ? 'bg-sidebar-accent text-primary border border-primary/20'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
                {label}
              </NavLink>
              {editMode && hideable && (
                <button
                  onClick={() => toggleRoute(to)}
                  className={`p-1.5 rounded-md transition-colors ${isHidden ? 'text-muted-foreground hover:text-foreground' : 'text-primary hover:text-primary/80'}`}
                  title={isHidden ? 'Mostrar' : 'Esconder'}
                >
                  {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          );
        })}
        {hasHideableItems && (
          <button
            onClick={() => setEditMode(!editMode)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all w-full ${
              editMode ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {editMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {editMode ? 'Concluir' : 'Gerenciar abas'}
          </button>
        )}
      </nav>

      <div className="mt-auto px-2 py-3 border-t border-sidebar-border space-y-3">
        {userEmail && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-sidebar-accent/30 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
              <User className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-sidebar-foreground truncate" title={userEmail}>
                {userEmail}
              </p>
              <p className="text-[9px] text-muted-foreground">conectado</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-md text-muted-foreground opacity-60 hover:opacity-100 hover:text-foreground hover:bg-sidebar-accent transition-all"
              title="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground leading-relaxed px-2">
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
