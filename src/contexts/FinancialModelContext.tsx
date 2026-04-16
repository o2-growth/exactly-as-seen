import React, { createContext, useContext, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Assumptions, DEFAULT_ASSUMPTIONS, Scenario, Year, YEARS,
  ProjectionData, PeriodPreset, DataSource, DateRange, getFilteredYears,
  CAAS_KEYS, SAAS_KEYS, EDUCATION_KEYS, EXPANSAO_KEYS, TAX_KEYS, ALL_SUBPRODUCT_KEYS,
  TicketKey,
} from '@/lib/financialData';
import { PnlNode } from '@/lib/pnlData';
import { computeFullModel, FullModelOutput } from '@/engine/calculationsEngine';
import { computeProductAnnualRevenue } from '@/lib/revenueCalc';
import { calculateTaxForRevenue, sumTaxResults, compositionFromConfig } from '@/lib/taxCalc';
import { getSubProductTaxRate } from '@/lib/financialData';
import { getFocalYear, getRangeDataSource, YearDataSource } from '@/lib/periodResolution';
import { useAssumptionsPersistence } from '@/hooks/useAssumptionsPersistence';
import { useHistoricalClients } from '@/hooks/useHistoricalClients';
import { isProductMrr } from '@/lib/financialData';

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
  saveNow: (a: Assumptions) => void;
  dataReady: boolean;
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
  const loadStarted = useRef(false);
  const hasLoaded = useRef(false);
  const [assumptionsLoaded, setAssumptionsLoaded] = useState(false);

  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;
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

        // Migration: reset subProductTaxRates to pick up corrected defaults (32% presumido, ISS by category)
        // Old configs had wrong rates: CaaS ISS 0% / base 8%/12%, Expansão mix 80/20, Education ISS 5%
        if (fixed.subProductTaxRates) {
          const anyOld = Object.values(fixed.subProductTaxRates).some(
            (cfg: any) => cfg?.tipoReceita === 'produto_saas' || cfg?.tipoReceita === 'expansao_misto' || cfg?.tipoReceita === 'mrr_saas' || cfg?.iss === 0
          );
          if (anyOld) {
            delete fixed.subProductTaxRates;
            localStorage.removeItem('o2_assumptions');
          }
        }

        // Migration: convert old decimal presumido values (0.32) to percentage (32)
        // AND migrate legacy mixServicoPct to taxSlices array
        if (fixed.subProductTaxRates) {
          for (const [key, cfg] of Object.entries(fixed.subProductTaxRates)) {
            const c = cfg as any;
            if (c.presumidoIRPJ !== undefined && c.presumidoIRPJ < 1) {
              c.presumidoIRPJ = c.presumidoIRPJ * 100;
            }
            if (c.presumidoCSLL !== undefined && c.presumidoCSLL < 1) {
              c.presumidoCSLL = c.presumidoCSLL * 100;
            }
            // Migrate legacy mixServicoPct → taxSlices
            if (c.perfilTributario === 'mix' && c.mixServicoPct !== undefined && !c.taxSlices?.length) {
              const servPct = c.mixServicoPct;
              c.taxSlices = [
                { profileKey: 'servico', pct: servPct },
                { profileKey: 'ebook', pct: 100 - servPct },
              ];
              delete c.mixServicoPct;
            }
          }
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

        // Merge with defaults so that newly-added fields (marketingPercent,
        // receitasFinanceirasPercent, etc.) get default values when loading
        // old saved data that doesn't have them yet.
        setAssumptions({ ...DEFAULT_ASSUMPTIONS, ...fixed });
      }
      // Mark as loaded AFTER state is set — prevents debounce from saving defaults
      hasLoaded.current = true;
      setAssumptionsLoaded(true);
    });
  }, [loadSnapshots]);

  // Debounced auto-save: save 2s after last change
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const latestAssumptions = useRef(assumptions);
  const latestScenario = useRef(scenario);
  latestAssumptions.current = assumptions;
  latestScenario.current = scenario;

  useEffect(() => {
    if (!hasLoaded.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveAssumptions(assumptions, scenario);
    }, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [assumptions, scenario, saveAssumptions]);

  // Save immediately when user closes/leaves the page (prevents data loss)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasLoaded.current) {
        // Synchronous localStorage save (Supabase can't be awaited here)
        try { localStorage.setItem('o2_assumptions', JSON.stringify(latestAssumptions.current)); } catch {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Historical data from Supabase (real Oxy values)
  const { data: historicalData, loading: historicalLoading } = useHistoricalClients();
  const dataReady = assumptionsLoaded && !historicalLoading;

  // Compute full model from engine
  const model = useMemo(
    () => computeFullModel(assumptions, scenario),
    [assumptions, scenario]
  );

  // Patch pnlTree revenue nodes using the SHARED computeProductAnnualRevenue function.
  // ONLY when historicalData is loaded from Supabase. Without Supabase data, the function
  // falls back to clients × ticket which produces HIGHER values than the engine raw
  // (because it uses monthlyNewClientOverrides which compound differently).
  // When Supabase is empty, the engine's own values are closer to reality.
  const pnlTree = useMemo(() => {
    const tree = model.pnlTree;

    // Guard: only patch if Supabase data is available
    const hasHistData = Object.keys(historicalData).length > 0;
    if (!hasHistData) return tree;

    const buGroups: Array<{ code: string; keys: readonly string[] }> = [
      { code: '1.1', keys: CAAS_KEYS },
      { code: '1.2', keys: SAAS_KEYS },
      { code: '1.3', keys: EDUCATION_KEYS },
      { code: '1.5', keys: EXPANSAO_KEYS },
      { code: '1.6', keys: TAX_KEYS },
    ];

    const node1 = tree.find(n => n.code === '1');
    if (node1) {
      for (const y of YEARS) {
        // 2025 fully realized — engine already set real Oxy values. Skip.
        // 2026+ recomputed from assumptions so user edits reflect in P&L.
        if (y <= 2025) continue;

        let total = 0;
        for (const bu of buGroups) {
          const buTotal = bu.keys.reduce((sum, key) =>
            sum + computeProductAnnualRevenue(key, y, assumptions, historicalData), 0);
          const buNode = node1.children?.find(c => c.code === bu.code);
          if (buNode) buNode.annual[y] = buTotal / 1000;
          total += buTotal;
        }
        node1.annual[y] = total / 1000;
      }
    }

    // Patch tax nodes (TAX, 10.01, 10.02, 10.03) — recompute IRPJ/CSLL/Adicional
    // on the SAME per-product revenue used above, ensuring P&L tax matches revenue.
    const taxNode = tree.find(n => n.code === 'TAX');
    if (taxNode) {
      for (const y of YEARS) {
        // 2025 fully realized — engine set real Oxy Provisão. Skip.
        // 2026+ recomputed so user edits to revenue affect tax.
        if (y <= 2025) continue;

        // Compute per-product tax using the shared taxCalc.ts
        const productTaxResults = ALL_SUBPRODUCT_KEYS.map(key => {
          const revenue = computeProductAnnualRevenue(key, y, assumptions, historicalData);
          const cfg = getSubProductTaxRate(key as TicketKey, assumptions);
          const composition = compositionFromConfig(cfg);
          return calculateTaxForRevenue(revenue, composition);
        });
        const aggregated = sumTaxResults(productTaxResults);

        // Override tax node values (in R$ thousands, negative = expense)
        taxNode.annual[y] = -(aggregated.irpj + aggregated.adicionalIrpj + aggregated.csll) / 1000;
        const irpjNode = taxNode.children?.find(c => c.code === '10.01');
        const adicNode = taxNode.children?.find(c => c.code === '10.03');
        const csllNode = taxNode.children?.find(c => c.code === '10.02');
        if (irpjNode) irpjNode.annual[y] = -aggregated.irpj / 1000;
        if (adicNode) adicNode.annual[y] = -aggregated.adicionalIrpj / 1000;
        if (csllNode) csllNode.annual[y] = -aggregated.csll / 1000;
      }
    }

    // Patch financial result nodes (8R, 8D, OR, DNO) — use percentage-based formula
    // on the patched revenue total, matching what the engine computes.
    const getYearPct = (val: number | Record<Year, number> | undefined, yr: Year, fb: number): number => {
      if (val === undefined || val === null) return fb;
      if (typeof val === 'number') return val;
      return (val as Record<Year, number>)[yr] ?? fb;
    };

    const finNodes = {
      '8D': tree.find(n => n.code === '8D'),   // Despesas Financeiras
      'OR': tree.find(n => n.code === 'OR'),     // Outras Receitas
      'DNO': tree.find(n => n.code === 'DNO'),   // Despesas Não Operacionais
    };
    // Find Receitas Financeiras node (8R)
    const recFinNode = tree.find(n => n.code === '8R');

    for (const y of YEARS) {
      // 2025 fully realized — engine set real Oxy financial values. Skip.
      // 2026+ use percentage formula based on patched revenue.
      if (y <= 2025) continue;

      const revenueTotal = node1?.annual[y] ?? 0; // already patched above (R$ thousands)
      const recFinRate = getYearPct(assumptions.receitasFinanceirasPercent, y, 0.5) / 100;
      const despFinRate = getYearPct(assumptions.despesasFinanceirasPercent, y, 1.5) / 100;
      const outrasRecRate = getYearPct(assumptions.outrasReceitasPercent, y, 0) / 100;
      const despNaoOpRate = getYearPct(assumptions.despesasNaoOperacionaisPercent, y, 0) / 100;

      if (recFinNode) recFinNode.annual[y] = revenueTotal * recFinRate;
      if (finNodes['8D']) finNodes['8D'].annual[y] = -(revenueTotal * despFinRate);
      if (finNodes['OR']) finNodes['OR'].annual[y] = revenueTotal * outrasRecRate;
      if (finNodes['DNO']) finNodes['DNO'].annual[y] = -(revenueTotal * despNaoOpRate);
    }

    return tree;
  }, [model, assumptions, historicalData]);

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

  // Force-save to localStorage + Supabase immediately (bypasses debounce)
  const saveNow = useCallback((a: Assumptions) => {
    clearTimeout(saveTimer.current);
    saveAssumptions(a, scenario);
  }, [saveAssumptions, scenario]);

  return (
    <FinancialModelContext.Provider value={{
      assumptions, scenario, selectedYear, selectedPeriod, dataSource, projections, model, pnlTree,
      dateRange, filteredYears, focalYear, rangeDataSource, dataReady,
      setAssumptions, updateAssumption, setScenario, setSelectedYear, setSelectedPeriod, setDataSource, setDateRange, resetAssumptions, saveNow,
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
