import { useState, useEffect } from 'react';
import { useVersionHistory } from '@/contexts/VersionHistoryContext';
import { FileDown, Sun, Moon, Menu } from 'lucide-react';
import PeriodFilter from './PeriodFilter';

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('o2_theme') === 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('o2_theme', dark ? 'dark' : 'light');
  }, [dark]);

  return { dark, toggle: () => setDark(d => !d) };
}



interface AppHeaderProps {
  onMenuToggle?: () => void;
}

export default function AppHeader({ onMenuToggle }: AppHeaderProps) {
  const { currentVersion } = useVersionHistory();
  const { dark, toggle: toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-3 md:px-6 py-3 bg-card/90 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-2 md:hidden">
        <button
          onClick={onMenuToggle}
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-foreground">
          O2 <span className="text-primary">Inc</span>
        </h1>
      </div>

      <div className="hidden md:block">
        <p className="text-sm text-muted-foreground">Dashboard Financeiro</p>
      </div>

      <div className="flex items-center gap-2 md:gap-3 flex-wrap">
        <span className="hidden md:inline-flex items-center px-2 py-1 text-[10px] font-bold bg-primary/20 text-primary rounded-md border border-primary/30">
          v{currentVersion}
        </span>

        <span className="inline-flex items-center px-2 md:px-3 py-1.5 text-[10px] md:text-xs font-semibold rounded-md bg-primary text-primary-foreground">
          BASE
        </span>

        <div className="hidden sm:block">
          <PeriodFilter />
        </div>

        <div className="hidden lg:flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-medium">Fonte</span>
          <span className="inline-flex items-center rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[10px] font-semibold text-primary">
            Modelo
          </span>
        </div>

        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          title={dark ? 'Modo claro' : 'Modo escuro'}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:text-foreground hover:border-primary/40 transition-colors opacity-60 cursor-not-allowed">
          <FileDown className="h-3.5 w-3.5" />
          Export PDF
        </button>
      </div>
    </header>
  );
}
