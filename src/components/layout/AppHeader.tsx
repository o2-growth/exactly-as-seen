import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS, Scenario } from '@/lib/financialData';
import { FileDown } from 'lucide-react';

const scenarios: Scenario[] = ['BEAR', 'BASE', 'BULL'];

export default function AppHeader() {
  const { scenario, setScenario, selectedYear, setSelectedYear } = useFinancialModel();

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

      <div className="flex items-center gap-4">
        {/* Scenario Switcher */}
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

        {/* Export Button */}
        <button className="hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:text-foreground hover:border-primary/40 transition-colors opacity-60 cursor-not-allowed">
          <FileDown className="h-3.5 w-3.5" />
          Export PDF
        </button>
      </div>
    </header>
  );
}
