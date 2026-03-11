import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { useVersionHistory } from '@/contexts/VersionHistoryContext';
import { YEARS, Scenario, PeriodPreset, DataSource } from '@/lib/financialData';
import { FileDown } from 'lucide-react';

const scenarios: Scenario[] = ['BEAR', 'BASE', 'BULL'];

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: '3y', label: '3 Anos' },
  { value: '5y', label: '5 Anos' },
  { value: 'historical', label: 'Historico' },
  { value: 'projected', label: 'Projetado' },
];

const DATA_SOURCE_OPTIONS: { value: DataSource; label: string }[] = [
  { value: 'model', label: 'Modelo' },
  { value: 'actual', label: 'Realizado' },
  { value: 'blended', label: 'Combinado' },
];

export default function AppHeader() {
  const { scenario, setScenario, selectedYear, setSelectedYear, selectedPeriod, setSelectedPeriod, dataSource, setDataSource } = useFinancialModel();
  const { currentVersion } = useVersionHistory();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-card/90 backdrop-blur-md border-b border-border">
      <div className="md:hidden">
        <h1 className="text-lg font-bold text-foreground">
          O2 <span className="text-primary">Inc</span>
        </h1>
      </div>

      <div className="hidden md:block">
        <p className="text-sm text-muted-foreground">Dashboard Financeiro</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* Version badge */}
        <span className="hidden md:inline-flex items-center px-2 py-1 text-[10px] font-bold bg-primary/20 text-primary rounded-md border border-primary/30">
          v{currentVersion}
        </span>

        {/* Scenario toggle */}
        <div className="flex items-center bg-secondary rounded-lg p-0.5 border border-border">
          {scenarios.map((s) => (
            <button
              key={s}
              onClick={() => setScenario(s)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                scenario === s
                  ? s === 'BULL'
                    ? 'bg-success text-success-foreground'
                    : s === 'BEAR'
                    ? 'bg-destructive text-destructive-foreground'
                    : 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Year Selector */}
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value) as typeof selectedYear)}
          className="bg-secondary border border-border text-foreground text-xs font-medium rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary outline-none"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Period dropdown */}
        <div className="hidden md:flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-medium">Periodo</span>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as PeriodPreset)}
            className="bg-secondary border border-border text-foreground text-xs font-medium rounded-lg px-3 py-2 focus:ring-1 focus:ring-primary outline-none"
          >
            {PERIOD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Data Source toggle */}
        <div className="hidden md:flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-medium">Fonte</span>
          <div className="flex items-center bg-secondary rounded-lg p-0.5 border border-border">
            {DATA_SOURCE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setDataSource(o.value)}
                className={`px-2.5 py-1.5 text-[10px] font-semibold rounded-md transition-all duration-200 ${
                  dataSource === o.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Export Button */}
        <button className="hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:text-foreground hover:border-primary/40 transition-colors opacity-60 cursor-not-allowed">
          <FileDown className="h-3.5 w-3.5" />
          Export PDF
        </button>
      </div>
    </header>
  );
}
