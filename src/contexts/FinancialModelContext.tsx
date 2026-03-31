import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Assumptions, DEFAULT_ASSUMPTIONS, Scenario, Year, YEARS,
  ProjectionData, PeriodPreset, DataSource, DateRange, getFilteredYears,
} from '@/lib/financialData';
import { PnlNode } from '@/lib/pnlData';
import { computeFullModel, FullModelOutput } from '@/engine/calculationsEngine';
import { getFocalYear, getRangeDataSource, YearDataSource } from '@/lib/periodResolution';
import { useAssumptionsPersistence } from '@/hooks/useAssumptionsPersistence';

interface FinancialModelContextType {
  assumptions: Assumptions;
  scenario: Scenario;
  selectedYear: Year;
  selectedPeriod: PeriodPreset;
  dataSource: DataSource;
  projections: ProjectionData;
  model: FullModelOutput;
  pnlTree: PnlNode[];
  dateRange: DateRange | undefined;
  filteredYears: Year[];
  focalYear: Year;
  rangeDataSource: YearDataSource;
  setAssumptions: (a: Assumptions | ((prev: Assumptions) => Assumptions)) => void;
  updateAssumption: <K extends keyof Assumptions>(key: K, value: Assumptions[K]) => void;
  setScenario: (s: Scenario) => void;
  setSelectedYear: (y: Year) => void;
  setSelectedPeriod: (p: PeriodPreset) => void;
  setDataSource: (d: DataSource) => void;
  setDateRange: (r: DateRange | undefined) => void;
  resetAssumptions: () => void;
}

const FinancialModelContext = createContext<FinancialModelContextType | null>(null);

export function FinancialModelProvider({ children }: { children: React.ReactNode }) {
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [scenario, setScenario] = useState<Scenario>('BASE');
  const [selectedYear, setSelectedYear] = useState<Year>(2025);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>('all');
  const [dataSource, setDataSource] = useState<DataSource>('model');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  // Persistence: auto-load from Supabase/localStorage on mount, auto-save on change
  const { saveAssumptions, loadSnapshots } = useAssumptionsPersistence();
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    loadSnapshots().then(saved => {
      if (saved) {
        // One-time fix: restore accidentally changed caasAssessoria values
        const fixed = { ...saved };
        let needsFix = false;
        if (fixed.subProductClients?.caasAssessoria?.[2025] === 5) {
          fixed.subProductClients.caasAssessoria[2025] = 21;
          needsFix = true;
        }
        if (fixed.subProductClients?.caasAssessoria?.[2026] === 19) {
          fixed.subProductClients.caasAssessoria[2026] = 78;
          needsFix = true;
        }
        if (needsFix && fixed.monthlyClientOverrides?.caasAssessoria) {
          delete fixed.monthlyClientOverrides.caasAssessoria[2025];
          delete fixed.monthlyClientOverrides.caasAssessoria[2026];
        }
        if (needsFix) {
          localStorage.removeItem('o2_assumptions');
        }

        // Migrate old squadConfig field names to new ones
        if (fixed.squadConfig) {
          const sc = fixed.squadConfig as Record<string, unknown>;
          const oldFields = ['diretorSalary', 'cfoOperacaoSalary', 'analistaSalary', 'numAnalistas',
            'saasSquadImpl', 'saasSquadImplSalary', 'saasSquadAnalista', 'saasSquadAnalistaSalary',
            'saasSquadLider', 'saasSquadLiderSalary', 'sparePerAnalyst'];
          const hasOldFields = oldFields.some(f => f in sc);
          if (hasOldFields) {
            fixed.squadConfig = { ...DEFAULT_ASSUMPTIONS.squadConfig! };
            localStorage.removeItem('o2_assumptions');
          }
        }

        // Ensure all default subProductClients keys exist (e.g. tax keys added later)
        if (fixed.subProductClients) {
          fixed.subProductClients = {
            ...DEFAULT_ASSUMPTIONS.subProductClients,
            ...fixed.subProductClients,
          };
        }

        // Ensure all default ticket keys exist
        if (fixed.tickets) {
          fixed.tickets = {
            ...DEFAULT_ASSUMPTIONS.tickets,
            ...fixed.tickets,
          };
        }

        // Ensure taxClients exists
        if (!fixed.taxClients) {
          fixed.taxClients = { ...DEFAULT_ASSUMPTIONS.taxClients };
        }

        // Ensure cacPerProduct has all keys
        if (fixed.cacPerProduct) {
          fixed.cacPerProduct = {
            ...DEFAULT_ASSUMPTIONS.cacPerProduct,
            ...fixed.cacPerProduct,
          };
        }

        // Migrate legacy cap table from separate localStorage keys
        if (!fixed.capTable) {
          try {
            const capRaw = localStorage.getItem('o2-cap-table');
            const sharesRaw = localStorage.getItem('o2-total-shares');
            if (capRaw) {
              fixed.capTable = {
                shareholders: JSON.parse(capRaw),
                totalShares: sharesRaw ? Number(sharesRaw) || 1_000_000 : 1_000_000,
              };
            }
          } catch {}
        }

        // Migrate legacy PnL config from separate localStorage keys
        if (!fixed.pnlConfig) {
          try {
            const labelsRaw = localStorage.getItem('o2_coa_labels');
            const hiddenRaw = localStorage.getItem('o2_coa_hidden');
            if (labelsRaw || hiddenRaw) {
              fixed.pnlConfig = {
                customLabels: labelsRaw ? JSON.parse(labelsRaw) : {},
                hiddenItems: hiddenRaw ? JSON.parse(hiddenRaw) : [],
              };
            }
          } catch {}
        }

        setAssumptions(fixed);
      }
    });
  }, [loadSnapshots]);

  // Debounced auto-save: save 2s after last change
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!hasLoaded.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveAssumptions(assumptions, scenario);
    }, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [assumptions, scenario, saveAssumptions]);

  // Compute full model from engine
  const model = useMemo(
    () => computeFullModel(assumptions, scenario),
    [assumptions, scenario]
  );

  // Derive projections from engine output (backwards-compatible interface)
  const projections: ProjectionData = useMemo(() => {
    const p: ProjectionData = {
      grossRevenue: {} as Record<Year, number>,
      netRevenue: {} as Record<Year, number>,
      grossProfit: {} as Record<Year, number>,
      ebitda: {} as Record<Year, number>,
      netIncome: {} as Record<Year, number>,
      operatingCashFlow: {} as Record<Year, number>,
      totalClients: {} as Record<Year, number>,
      grossMargins: {} as Record<Year, number>,
      netMargins: {} as Record<Year, number>,
    };
    for (const y of YEARS) {
      const yr = model.years[y];
      p.grossRevenue[y] = yr.grossRevenue;
      p.netRevenue[y] = yr.netRevenue;
      p.grossProfit[y] = yr.grossProfit;
      p.ebitda[y] = yr.ebitda;
      p.netIncome[y] = yr.netIncome;
      p.operatingCashFlow[y] = yr.finalResult;
      p.totalClients[y] = yr.totalClients;
      p.grossMargins[y] = yr.grossMarginPct;
      p.netMargins[y] = yr.netMarginPct;
    }
    return p;
  }, [model]);

  const pnlTree = model.pnlTree;

  const filteredYears = useMemo(() => getFilteredYears(dateRange), [dateRange]);
  const focalYear = useMemo(() => getFocalYear(filteredYears), [filteredYears]);
  const rangeDataSource = useMemo(() => getRangeDataSource(filteredYears), [filteredYears]);

  useEffect(() => {
    setSelectedYear(focalYear);
  }, [focalYear]);

  const updateAssumption = useCallback(<K extends keyof Assumptions>(key: K, value: Assumptions[K]) => {
    setAssumptions(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetAssumptions = useCallback(() => {
    setAssumptions(DEFAULT_ASSUMPTIONS);
  }, []);

  return (
    <FinancialModelContext.Provider value={{
      assumptions, scenario, selectedYear, selectedPeriod, dataSource, projections, model, pnlTree,
      dateRange, filteredYears, focalYear, rangeDataSource,
      setAssumptions, updateAssumption, setScenario, setSelectedYear, setSelectedPeriod, setDataSource, setDateRange, resetAssumptions,
    }}>
      {children}
    </FinancialModelContext.Provider>
  );
}

export function useFinancialModel() {
  const ctx = useContext(FinancialModelContext);
  if (!ctx) throw new Error('useFinancialModel must be used within FinancialModelProvider');
  return ctx;
}
