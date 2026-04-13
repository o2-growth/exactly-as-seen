import React, { useState, useRef, useEffect } from 'react';

/** Input with local state buffer — commits on blur/Enter, syncs when not focused */
function MonthlyClientInput({ value, onCommit, className, readOnly }: { value: number; onCommit: (v: number) => void; className?: string; readOnly?: boolean }) {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setLocal(value); }, [value]);
  const commit = () => { focused.current = false; if (local !== value) onCommit(local); };
  if (readOnly) {
    return <span className={className}>{value.toLocaleString('pt-BR')}</span>;
  }
  return (
    <input
      type="number"
      className={className}
      value={local}
      onClick={e => e.stopPropagation()}
      onFocus={() => { focused.current = true; }}
      onChange={e => setLocal(Number(e.target.value) || 0)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
    />
  );
}
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { useVersionHistory } from '@/contexts/VersionHistoryContext';
import { YEARS, Year, Assumptions as AssumptionsType, DEFAULT_ASSUMPTIONS, HEADCOUNT, SUB_PRODUCT_LABELS, SubProductClients, BUTaxConfig, TicketKey as FinTicketKey, SubProductTaxConfig, TaxSlice, CAAS_KEYS, SAAS_KEYS, EDUCATION_KEYS, EXPANSAO_KEYS, TAX_KEYS, ALL_SUBPRODUCT_KEYS, getSubProductTaxRate, getDefaultSubProductTaxConfig, CosConfig, DEFAULT_COS_CONFIG, isProductMrr, computeMixPresumido as computeMixPresumidoFn, TAX_PROFILES, TAX_PROFILE_KEYS, SLICE_PROFILE_KEYS, applyTaxProfile, getEffectivePresumido, getEffectiveTaxRates, getMixTaxSlices, swapOrUpdateMixSliceProfile, updateMixSlicePct, addMixTaxSlice, removeMixTaxSlice } from '@/lib/financialData';
import { TAX_PREMISES, type TaxPremise } from '@/data/taxPremises';
import { MONTHS, getMonthlyClients, getMonthlyHeadcount } from '@/lib/monthlyData';
import { resolveAnnualMetric } from '@/lib/periodResolution';
import { formatCurrency, formatCurrencyFull } from '@/lib/formatters';
import { Lock, Unlock, Save, X, RotateCcw, Scale, Receipt, Landmark, Info, BadgePercent, UserCheck, Pencil, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { debtSchedule, headcountRatios as defaultHeadcountRatios, salaryRanges as defaultSalaryRanges, commissionRate, namedEmployees2025, cacPerClient, selicRates, commercialHeadcountRatios } from '@/data/modelData';
import { namedEmployees as hcNamedEmployees, payrollFaturamento, payrollGrossRevenueRatio, benefitsMonthly, reimbursements } from '@/data/headcountData';
import { historicalCosts, historicalExpenses, historicalExpenseItems, historicalFinancial, HISTORICAL_PERIODS } from '@/data/historicalData';
import { PnlNode } from '@/lib/pnlData';
import { ExpandableMonthTable } from '@/components/assumptions/ExpandableMonthRow';
import { CurrencyInput } from '@/components/assumptions/CurrencyInput';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useHistoricalClients } from '@/hooks/useHistoricalClients';
import { FormulaExplainer } from '@/components/assumptions/FormulaExplainer';
import { explainRevenue, explainClients, explainTaxEffective, explainCOS, explainKPI, explainTicket, explainChurn, explainNovosClientes, explainClientesAtivos, explainFaturamentoBase, explainIncremento, explainRevenueChurn } from '@/lib/formulaExplainer';

type TicketKey = keyof AssumptionsType['tickets'];
type SubProductKey = keyof SubProductClients;

// ─── Excel "Assumptions - DB" row structure ───
interface ClientRow {
  label: string;
  dataKey: SubProductKey | null;
}
interface ClientGroup {
  group: string;
  items: ClientRow[];
}

const CLIENTS_ROWS: ClientGroup[] = [
  {
    group: 'CaaS',
    items: [
      { label: 'Serviços Especializados', dataKey: 'caasAssessoria' },
      { label: 'Enterprise',              dataKey: 'caasEnterprise' },
      { label: 'Corporate',               dataKey: 'caasCorporate' },
      { label: 'Parceiros',               dataKey: 'caasParceiros' },
      { label: 'BPO Financeiro',          dataKey: 'caasSetup' },
    ],
  },
  {
    group: 'SaaS',
    items: [
      { label: 'Oxy',                         dataKey: 'saasOxy' },
      { label: 'Oxy + Gênio',                 dataKey: 'saasOxyGenio' },
      { label: 'Setup',                        dataKey: 'saasSetup' },
      { label: 'Parceiros',                    dataKey: 'saasParceiros' },
      { label: 'Oxy + Gênio + Especialista',  dataKey: 'saasOxyGenioEsp' },
    ],
  },
  {
    group: 'Education',
    items: [
      { label: 'Dono CFO',                dataKey: 'educationDonoCFO' },
      { label: 'Engenheiro de Negócios',   dataKey: 'educationEN' },
      { label: 'Financeiro Raiz',          dataKey: 'educationFR' },
      { label: 'Finance Sales Program',    dataKey: 'educationFSP' },
    ],
  },
  {
    group: 'Expansão',
    items: [
      { label: 'Oxy Hacker', dataKey: 'baas' },
      { label: 'Franquia',                       dataKey: 'baasFranquia' },
      { label: 'Master Franquia',                dataKey: 'baasMasterFranquia' },
    ],
  },
  {
    group: 'Tax',
    items: [
      { label: 'Assessoria Tributária',              dataKey: 'taxAT' },
      { label: 'Gestão Passivo Tributário',          dataKey: 'taxGPT' },
      { label: 'Recuperação Crédito Tributário',     dataKey: 'taxRCT' },
      { label: 'Reforma Tributária',                 dataKey: 'taxRT' },
      { label: 'Diagnóstico Tributário & Compliance', dataKey: 'taxDTC' },
    ],
  },
];

interface TicketRow {
  label: string;
  dataKey: TicketKey | null;
  staticValue: number;
}
interface TicketGroup {
  group: string;
  items: TicketRow[];
}

const TICKETS_ROWS: TicketGroup[] = [
  {
    group: 'CaaS',
    items: [
      { label: 'Serviços Especializados', dataKey: 'caasAssessoria', staticValue: 25000 },
      { label: 'Enterprise',              dataKey: 'caasEnterprise',  staticValue: 6209 },
      { label: 'Corporate',               dataKey: 'caasCorporate',   staticValue: 13573 },
      { label: 'Parceiros',               dataKey: 'caasParceiros',   staticValue: 0 },
      { label: 'BPO Financeiro',          dataKey: 'caasSetup',       staticValue: 15000 },
    ],
  },
  {
    group: 'SaaS',
    items: [
      { label: 'Oxy',                         dataKey: 'saasOxy',      staticValue: 1297 },
      { label: 'Oxy + Gênio',                 dataKey: 'saasOxyGenio', staticValue: 1997 },
      { label: 'Setup',                        dataKey: 'saasSetup',    staticValue: 15000 },
      { label: 'Parceiros',                    dataKey: 'saasParceiros', staticValue: 0 },
      { label: 'Oxy + Gênio + Especialista',  dataKey: 'saasOxyGenioEsp', staticValue: 0 },
    ],
  },
  {
    group: 'Education',
    items: [
      { label: 'Dono CFO',                dataKey: 'educationDonoCFO', staticValue: 3997 },
      { label: 'Engenheiro de Negócios',   dataKey: 'educationEN', staticValue: 7500 },
      { label: 'Financeiro Raiz',          dataKey: 'educationFR', staticValue: 2997 },
      { label: 'Finance Sales Program',    dataKey: 'educationFSP', staticValue: 497 },
    ],
  },
  {
    group: 'Expansão',
    items: [
      { label: 'Oxy Hacker', dataKey: 'baas', staticValue: 229 },
      { label: 'Franquia',                       dataKey: 'baasFranquia',   staticValue: 0 },
      { label: 'Master Franquia',                dataKey: 'baasMasterFranquia',   staticValue: 0 },
    ],
  },
  {
    group: 'Tax',
    items: [
      { label: 'Assessoria Tributária',              dataKey: 'taxAT',  staticValue: 5000 },
      { label: 'Gestão Passivo Tributário',          dataKey: 'taxGPT', staticValue: 3000 },
      { label: 'Recuperação Crédito Tributário',     dataKey: 'taxRCT', staticValue: 4000 },
      { label: 'Reforma Tributária',                 dataKey: 'taxRT',  staticValue: 3500 },
      { label: 'Diagnóstico Tributário & Compliance', dataKey: 'taxDTC', staticValue: 2500 },
    ],
  },
];

function CellInput({ value, editing, onChange }: { value: number; editing: boolean; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      className="w-full bg-secondary border border-primary/30 rounded px-2 py-1 text-right text-sm tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
      value={value}
      onChange={e => onChange(Number(e.target.value) || 0)}
    />
  );
}

// ─── Projection helpers ───

function isHistorical(year: Year, monthIdx: number): boolean {
  if (year < 2026) return true;
  if (year === 2026) return monthIdx < 3; // Jan (0), Feb (1), Mar (2) are historical
  return false;
}

/** Returns the monthly churn rate (as a fraction, e.g. 0.004167 for 5%/12) for a specific month.
 *  If monthlyChurnRates[key][year] is an array of 12 values, returns array[monthIndex] / 100 / 12.
 *  If it's a single number (legacy flat), returns that number / 100 / 12.
 *  Otherwise falls back to the category default. */
function getChurnForMonth(key: SubProductKey, data: AssumptionsType, year: Year, monthIndex: number): number {
  if (data.churnNotApplicable?.[key]) return 0;
  const stored = data.monthlyChurnRates?.[key]?.[year];
  if (stored !== undefined) {
    if (Array.isArray(stored)) {
      return (stored[monthIndex] ?? 0) / 100 / 12;
    }
    return stored / 100 / 12;
  }
  if (key === 'caasAssessoria' || key === 'caasEnterprise' || key === 'caasCorporate' || key === 'caasSetup' || key === 'caasParceiros') {
    return data.churnCaas / 100 / 12;
  }
  if (key === 'saasOxy' || key === 'saasOxyGenio' || key === 'saasSetup' || key === 'saasParceiros' || key === 'saasOxyGenioEsp') {
    return data.churnSaas / 100 / 12;
  }
  if (key === 'educationDonoCFO' || key === 'educationEN' || key === 'educationFR' || key === 'educationFSP') {
    return 0;
  }
  if (key === 'baas' || key === 'baasFranquia' || key === 'baasMasterFranquia') {
    return data.churnBaas / 100 / 12;
  }
  if (key === 'taxAT') {
    return data.churnCaas / 100 / 12; // taxAT is MRR (recurring advisory), uses CaaS churn rate
  }
  if (key === 'taxGPT' || key === 'taxRCT' || key === 'taxRT' || key === 'taxDTC') {
    return 0; // non-MRR tax products — no churn
  }
  return 0;
}

/** Legacy wrapper — returns average monthly churn for a year (used in summary displays) */
function getChurnMonthly(key: SubProductKey, data: AssumptionsType, year?: Year): number {
  const yr = year ?? (2025 as Year);
  const stored = data.monthlyChurnRates?.[key]?.[yr];
  if (stored !== undefined && Array.isArray(stored)) {
    // Average of the 12 monthly rates
    const avg = stored.reduce((s, v) => s + v, 0) / 12;
    return avg / 100 / 12;
  }
  return getChurnForMonth(key, data, yr, 0);
}

// computeProjectedClients removed — display now uses getMonthlyClients directly

// ─── PnL tree helper ───
function findNodeInTree(code: string, nodes: PnlNode[]): PnlNode | undefined {
  for (const n of nodes) {
    if (n.code === code) return n;
    if (n.children) {
      const found = findNodeInTree(code, n.children);
      if (found) return found;
    }
  }
  return undefined;
}

export default function Assumptions() {
  const { assumptions, setAssumptions, resetAssumptions, scenario, projections, model, filteredYears, saveNow } = useFinancialModel();
  const { saveVersion } = useVersionHistory();
  const { data: historicalData, loading: historicalLoading } = useHistoricalClients();

  /** Build period string from year and month index: (2025, 0) => '2025-01' */
  const toPeriod = (year: Year, monthIdx: number): string =>
    `${year}-${String(monthIdx + 1).padStart(2, '0')}`;

  /** Get annual client sum using API data for historical months, engine for projected */
  const getAnnualClientSum = (key: SubProductKey, year: Year): number => {
    const engineMonthly = getMonthlyClients(key, year, data.subProductClients, data.tickets, data.monthlyClientOverrides);

    // Compute "new clients in the year" — same logic for both MRR and non-MRR products.
    // For historical months: max(0, activeCur - activePrev + churnedCur) using API data.
    // For projected months: monthlyNewClientOverrides ?? 0.
    let newInYear = 0;
    for (let i = 0; i < 12; i++) {
      const hist = isHistorical(year, i);
      const hcPeriodCur = toPeriod(year, i);
      const hcEntryCur = hist ? historicalData[key]?.[hcPeriodCur] : undefined;
      if (hist) {
        const activeCur = hcEntryCur ? hcEntryCur.client_count : engineMonthly[i];
        let activePrev = 0;
        if (i > 0) {
          const hcPeriodPrev = toPeriod(year, i - 1);
          const hcEntryPrev = isHistorical(year, i - 1) ? historicalData[key]?.[hcPeriodPrev] : undefined;
          activePrev = hcEntryPrev ? hcEntryPrev.client_count : engineMonthly[i - 1];
        } else if (year > 2025) {
          const prevYr = (year - 1) as Year;
          const decPeriodP = toPeriod(prevYr, 11);
          const decApiP = historicalData[key]?.[decPeriodP];
          if (decApiP && decApiP.client_count > 0) {
            activePrev = decApiP.client_count;
          } else {
            activePrev = Math.round(getMonthlyClients(key, prevYr, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11]);
          }
        }
        let churnedCur = 0;
        if (hcEntryCur) {
          churnedCur = hcEntryCur.churned_clients ?? 0;
        } else {
          churnedCur = Math.round(activePrev * getChurnForMonth(key, data, year, i));
        }
        newInYear += Math.max(0, Math.round(activeCur) - Math.round(activePrev) + churnedCur);
      } else {
        // Projected month: honor user override if set, else compute from engine delta
        // (mirrors the correct pattern used in the Revenue decomposition projection branch)
        const storedNew = data.monthlyNewClientOverrides?.[key]?.[year]?.[i];
        if (storedNew !== null && storedNew !== undefined) {
          newInYear += storedNew;
        } else {
          const activeCur = engineMonthly[i];
          let activePrev = 0;
          if (i > 0) {
            activePrev = engineMonthly[i - 1];
          } else if (year > 2025) {
            const prevYr = (year - 1) as Year;
            const decPeriodP = toPeriod(prevYr, 11);
            const decApiP = historicalData[key]?.[decPeriodP];
            if (decApiP && decApiP.client_count > 0) {
              activePrev = decApiP.client_count;
            } else {
              activePrev = Math.round(getMonthlyClients(key, prevYr, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11]);
            }
          }
          const churnedCur = Math.round(activePrev * getChurnForMonth(key, data, year, i));
          newInYear += Math.max(0, Math.round(activeCur) - Math.round(activePrev) + churnedCur);
        }
      }
    }

    // Non-MRR (one-shot): every client is by definition "new", so unique = new in year
    if (!isProductMrr(key as FinTicketKey)) {
      return Math.round(newInYear);
    }

    // MRR: unique clients = carryover from previous year + new in this year
    // For year === 2025: carryover is 0 (January's client_count is already counted as "new" in the loop above)
    // For year > 2025: carryover = December of previous year's active clients (API or engine)
    let activeAtStart = 0;
    if (year > 2025) {
      const prevYr = (year - 1) as Year;
      const decPeriodP = toPeriod(prevYr, 11);
      const decApiP = historicalData[key]?.[decPeriodP];
      if (decApiP && decApiP.client_count > 0) {
        activeAtStart = decApiP.client_count;
      } else {
        activeAtStart = Math.round(getMonthlyClients(key, prevYr, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11]);
      }
    }

    return Math.round(activeAtStart + newInYear);
  };

  /** Get annual revenue using same faturamentoTotal logic as expanded section */
  const getAnnualRevenue = (key: SubProductKey, year: Year): number => {
    const monthly = getMonthlyClients(key, year, data.subProductClients, data.tickets, data.monthlyClientOverrides);
    const ticketVal = data.tickets[key as TicketKey] ?? 0;
    const hcIsMrr = isProductMrr(key as FinTicketKey);
    const churnApplicable = hcIsMrr && !data.churnNotApplicable?.[key];

    // Previous year December data for month 0 base
    const prevYrMonthly = year > 2025
      ? getMonthlyClients(key, (year - 1) as Year, data.subProductClients, data.tickets, data.monthlyClientOverrides)
      : null;
    const prevDecPeriod = year > 2025 ? toPeriod((year - 1) as Year, 11) : '';
    const prevDecApi = year > 2025 ? historicalData[key]?.[prevDecPeriod] : undefined;

    let prevMonthTotal = 0;
    if (year > 2025) {
      if (prevDecApi && prevDecApi.total_revenue > 0) {
        prevMonthTotal = prevDecApi.total_revenue;
      } else {
        const prevDecClients = prevYrMonthly ? Math.round(prevYrMonthly[11]) : 0;
        const prevDecTk = data.monthlyTickets?.[key]?.[(year - 1) as Year]?.[11] ?? ticketVal;
        prevMonthTotal = prevDecClients * prevDecTk;
      }
    }

    const faturamentoTotal: number[] = [];

    for (let i = 0; i < 12; i++) {
      const hist = isHistorical(year, i);
      const monthTicket = data.monthlyTickets?.[key]?.[year]?.[i] ?? ticketVal;
      const period = toPeriod(year, i);
      const apiEntry = hist ? historicalData[key]?.[period] : undefined;

      // Historical with API data
      if (hist && apiEntry && (!hcIsMrr || (apiEntry.total_revenue > 0 && apiEntry.client_names))) {
        faturamentoTotal.push(apiEntry.total_revenue);
      } else if (!hcIsMrr) {
        // Non-MRR (one-shot): revenue = all clients in this month × ticket.
        // For non-MRR, monthly[i] already contains the correct client count
        // (real Oxy for historical, delta-of-5-MRR for Setup projected, etc.).
        // No delta formula needed — each month's count IS the new clients.
        const storedNew = data.monthlyNewClientOverrides?.[key]?.[year]?.[i];
        const newClients = (storedNew !== null && storedNew !== undefined)
          ? storedNew
          : Math.round(monthly[i]);
        const monthRevenue = newClients * monthTicket;
        if (hist && apiEntry && apiEntry.total_revenue > 0) {
          faturamentoTotal.push(apiEntry.total_revenue);
        } else {
          faturamentoTotal.push(monthRevenue);
        }
      } else {
        // MRR projected: Base + Incremento - Churn
        const base = i === 0 ? prevMonthTotal : faturamentoTotal[i - 1];

        const storedNew = data.monthlyNewClientOverrides?.[key]?.[year]?.[i];
        let prevClients = 0;
        if (i > 0) {
          prevClients = monthly[i - 1];
        } else if (prevDecApi) {
          prevClients = prevDecApi.client_count;
        } else if (prevYrMonthly) {
          prevClients = Math.round(prevYrMonthly[11]);
        }
        let newClients = 0;
        if (storedNew !== null && storedNew !== undefined) {
          newClients = storedNew;
        } else {
          const activeCur = monthly[i];
          const churnRate = getChurnForMonth(key, data, year, i);
          const churned = Math.round(prevClients * churnRate);
          newClients = Math.max(0, Math.round(activeCur) - Math.round(prevClients) + churned);
        }

        const inc = newClients * monthTicket;

        let revChurn = 0;
        if (churnApplicable) {
          const prevTk = i > 0
            ? (data.monthlyTickets?.[key]?.[year]?.[i - 1] ?? ticketVal)
            : (year > 2025 ? (data.monthlyTickets?.[key]?.[(year - 1) as Year]?.[11] ?? ticketVal) : ticketVal);
          const churnRate = getChurnForMonth(key, data, year, i);
          const logoChurn = Math.round(prevClients * churnRate);
          revChurn = logoChurn * prevTk;
        }

        if (hist && apiEntry && apiEntry.total_revenue > 0) {
          faturamentoTotal.push(apiEntry.total_revenue);
        } else {
          faturamentoTotal.push(base + inc - revChurn);
        }
      }
    }

    return faturamentoTotal.reduce((s, v) => s + v, 0);
  };

  // Use filteredYears for the year selector; fall back to all YEARS if empty
  const activeYears: Year[] = filteredYears.length > 0 ? filteredYears : [...YEARS];

  // editing always true — fields always editable, auto-save handles persistence
  const editing = true;
  const [marketingView, setMarketingView] = useState<'planned' | 'actual'>('planned');
  const [selectedYear, setSelectedYear] = useState<Year>(2025);

  // Auto-select first year in range when current selectedYear is outside the active range
  React.useEffect(() => {
    if (!activeYears.includes(selectedYear)) {
      setSelectedYear(activeYears[0]);
    }
  }, [activeYears, selectedYear]);

  const [showGrowthPct, setShowGrowthPct] = useState(false);
  const [editingClients, setEditingClients] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [showTotalFilter, setShowTotalFilter] = useState(false);
  // Products excluded from totals — default: Setup keys
  const [excludedFromTotal, setExcludedFromTotal] = useState<Record<string, boolean>>(() => ({}));
  const [hcViewMode, setHcViewMode] = useState<'people' | 'cost'>('people');

  const [actualData, setActualData] = useState<Record<string, Record<number, number>>>(() => {
    if (assumptions.actualData && Object.keys(assumptions.actualData).length > 0) {
      return assumptions.actualData;
    }
    const d: Record<string, Record<number, number>> = {};
    (Object.keys(SUB_PRODUCT_LABELS) as SubProductKey[]).forEach(key => {
      d[key] = {};
      YEARS.forEach(y => { d[key][y] = 0; });
    });
    return d;
  });

  // ─── Projection state ───
  type GrowthRates = Record<string, number[]>;

  const [growthRates, setGrowthRates] = useState<Record<Year, GrowthRates>>(() => {
    if (assumptions.growthRates && Object.keys(assumptions.growthRates).length > 0) {
      return assumptions.growthRates as Record<Year, GrowthRates>;
    }
    const init = {} as Record<Year, GrowthRates>;
    for (const y of YEARS) {
      init[y] = {};
      for (const group of CLIENTS_ROWS) {
        for (const row of group.items) {
          const k = row.dataKey ?? row.label;
          init[y][k] = Array(12).fill(0.06);
        }
      }
    }
    return init;
  });

  const [applyAllPct, setApplyAllPct] = useState(() => assumptions.applyAllPct ?? 6);
  // Growth % per product per year: { caasEnterprise: { 2026: 5, 2027: 7 } }
  // When a year is set, it cascades to all future years (until overridden)
  const [rowApplyPct, setRowApplyPct] = useState<Record<string, number | Record<number, number>>>(() => assumptions.rowApplyPct ?? {});

  /** Get growth % for a product and year (cascades: uses closest year <= target) */
  const getGrowthPct = (key: string, year: number): number => {
    const val = rowApplyPct[key];
    if (val === undefined) return 6; // default
    if (typeof val === 'number') return val; // legacy: single number for all years
    // Find the closest year <= target
    const years = Object.keys(val).map(Number).sort();
    let result = 6;
    for (const y of years) {
      if (y <= year) result = val[y];
    }
    return result;
  };

  /** Set growth % for a product + year, cascading to future years */
  const setGrowthForYear = (key: string, year: number, pct: number) => {
    setRowApplyPctPersist(prev => {
      const current = prev[key];
      let yearMap: Record<number, number>;
      if (current === undefined || typeof current === 'number') {
        // Migrate legacy single number
        yearMap = {};
        // Set all years from 2025 to the changed year with the old value
        const oldVal = typeof current === 'number' ? current : 6;
        for (const y of [2025, 2026, 2027, 2028, 2029, 2030]) {
          if (y < year) yearMap[y] = oldVal;
        }
      } else {
        yearMap = { ...(current as Record<number, number>) };
      }
      // Set from this year forward
      for (const y of [2025, 2026, 2027, 2028, 2029, 2030]) {
        if (y >= year) yearMap[y] = pct;
      }
      return { ...prev, [key]: yearMap };
    });
  };
  const [rowTicketGrowthPct, setRowTicketGrowthPct] = useState<Record<string, number>>(() => assumptions.rowTicketGrowthPct ?? {});
  const [rowChurnPct, setRowChurnPct] = useState<Record<string, number>>(() => assumptions.rowChurnPct ?? {});
  const [expandedChurnMonth, setExpandedChurnMonth] = useState<string | null>(null);
  const [expandedRevenueMonth, setExpandedRevenueMonth] = useState<string | null>(null);
  const [expandedRevChurnMonth, setExpandedRevChurnMonth] = useState<string | null>(null);
  // Sync local state from assumptions on mount (after async load)
  const initialSyncDone = React.useRef(false);
  React.useEffect(() => {
    // Only sync once — on the first assumptions change after mount (the async load)
    if (initialSyncDone.current) return;
    // Wait for context to have loaded from storage (assumptions !== DEFAULT_ASSUMPTIONS)
    const hasPersistedGrowth = assumptions.rowApplyPct && Object.keys(assumptions.rowApplyPct).length > 0;
    const hasPersistedTicketGrowth = assumptions.rowTicketGrowthPct && Object.keys(assumptions.rowTicketGrowthPct).length > 0;
    const hasPersistedChurnPct = assumptions.rowChurnPct && Object.keys(assumptions.rowChurnPct).length > 0;
    const hasPersistedActual = assumptions.actualData && Object.keys(assumptions.actualData).length > 0;
    const hasPersistedEmployees = assumptions.hcEmployees && assumptions.hcEmployees.length > 0;

    if (hasPersistedGrowth) setRowApplyPct(assumptions.rowApplyPct!);
    if (hasPersistedTicketGrowth) setRowTicketGrowthPct(assumptions.rowTicketGrowthPct!);
    if (hasPersistedChurnPct) setRowChurnPct(assumptions.rowChurnPct!);
    if (assumptions.applyAllPct !== undefined && assumptions.applyAllPct !== 6) setApplyAllPct(assumptions.applyAllPct);
    if (assumptions.growthRates && Object.keys(assumptions.growthRates).length > 0) {
      setGrowthRates(assumptions.growthRates as Record<Year, GrowthRates>);
    }
    if (hasPersistedActual) setActualData(assumptions.actualData!);
    if (hasPersistedEmployees) setHcEmployees(assumptions.hcEmployees!);

    // Mark done after first real sync attempt
    if (hasPersistedGrowth || hasPersistedTicketGrowth || hasPersistedChurnPct || hasPersistedActual || hasPersistedEmployees) {
      initialSyncDone.current = true;
    }
  }, [assumptions.rowApplyPct, assumptions.rowTicketGrowthPct, assumptions.rowChurnPct, assumptions.applyAllPct, assumptions.growthRates, assumptions.actualData, assumptions.hcEmployees]);

  const [activeTaxCategory, setActiveTaxCategory] = useState<string>('caas');
  const [opExpandedGroups, setOpExpandedGroups] = useState<Record<string, boolean>>({
    custos: false,
    despesas: false,
  });

  // ─── Headcount editable state ───
  const [hcEmployees, setHcEmployees] = useState(() => {
    if (assumptions.hcEmployees?.length) return assumptions.hcEmployees;
    return hcNamedEmployees.map(e => ({ ...e, monthly: { ...e.monthly } }));
  });

  const persistEmployees = (employees: typeof hcEmployees) => {
    queueMicrotask(() => setAssumptions(prev => ({ ...prev, hcEmployees: employees })));
  };

  const updateEmployeeSalary = (empIdx: number, period: string, value: number) => {
    setHcEmployees(prev => {
      const next = [...prev];
      next[empIdx] = { ...next[empIdx], monthly: { ...next[empIdx].monthly, [period]: value } };
      persistEmployees(next);
      return next;
    });
  };

  const updateEmployeeField = (empIdx: number, field: 'name' | 'role' | 'bu' | 'code', value: string) => {
    setHcEmployees(prev => {
      const next = [...prev];
      next[empIdx] = { ...next[empIdx], [field]: value };
      persistEmployees(next);
      return next;
    });
  };

  const addEmployee = () => {
    setHcEmployees(prev => {
      const next = [...prev, {
        name: 'Novo Colaborador',
        role: '',
        code: '',
        bu: 'CaaS',
        monthly: {},
      }];
      persistEmployees(next);
      return next;
    });
  };

  const removeEmployee = (empIdx: number) => {
    setHcEmployees(prev => {
      const next = prev.filter((_, i) => i !== empIdx);
      persistEmployees(next);
      return next;
    });
  };


  const updateSubProduct = (key: SubProductKey, year: Year, val: number) => {
    updateModel(prev => ({
      ...prev,
      subProductClients: {
        ...prev.subProductClients,
        [key]: { ...prev.subProductClients[key], [year]: val },
      },
    }));
  };

  const updateTicket = (key: TicketKey, val: number) => {
    updateModel(prev => ({
      ...prev,
      tickets: { ...prev.tickets, [key]: val },
    }));
  };

  const updateSalary = (role: string, val: number) => {
    updateModel(prev => ({
      ...prev,
      headcountSalaries: { ...prev.headcountSalaries, [role]: val },
    }));
  };

  const updateActual = (key: string, year: Year, val: number) => {
    setActualData(prev => {
      const next = { ...prev, [key]: { ...prev[key], [year]: val } };
      queueMicrotask(() => setAssumptions(p => ({ ...p, actualData: next })));
      return next;
    });
  };

  const data = assumptions;

  // Helper: update assumptions (always writes directly, auto-saved via debounce)
  const updateModel = (updater: (prev: AssumptionsType) => AssumptionsType) => {
    setAssumptions(prev => updater(prev));
  };

  // Persist growth fields to assumptions (auto-saved via debounce)
  // Uses queueMicrotask to avoid "setState during render" React warning
  const persistGrowthField = React.useCallback((field: string, value: any) => {
    queueMicrotask(() => setAssumptions(prev => ({ ...prev, [field]: value })));
  }, [setAssumptions]);

  type RowApplyPctValue = Record<string, number | Record<number, number>>;
  const setRowApplyPctPersist = (valOrFn: RowApplyPctValue | ((prev: RowApplyPctValue) => RowApplyPctValue)) => {
    setRowApplyPct(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      persistGrowthField('rowApplyPct', next);
      return next;
    });
  };

  const setRowTicketGrowthPctPersist = (valOrFn: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
    setRowTicketGrowthPct(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      persistGrowthField('rowTicketGrowthPct', next);
      return next;
    });
  };

  const setRowChurnPctPersist = (valOrFn: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
    setRowChurnPct(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      persistGrowthField('rowChurnPct', next);
      return next;
    });
  };

  const setApplyAllPctPersist = (val: number) => {
    setApplyAllPct(val);
    persistGrowthField('applyAllPct', val);
  };

  const setGrowthRatesPersist = (valOrFn: Record<Year, GrowthRates> | ((prev: Record<Year, GrowthRates>) => Record<Year, GrowthRates>)) => {
    setGrowthRates(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      persistGrowthField('growthRates', next);
      return next;
    });
  };

  // ─── Projection handlers ───

  const handleGrowthChange = (key: SubProductKey, year: Year, monthIdx: number, newPctVal: number) => {
    const newRate = newPctVal / 100;
    setGrowthRatesPersist(prev => {
      const updated = { ...prev };
      const yearRates = { ...updated[year] };
      const arr = [...(yearRates[key] ?? Array(12).fill(0.06))];
      arr[monthIdx] = newRate;
      yearRates[key] = arr;
      updated[year] = yearRates;
      return updated;
    });
  };

  /** Compute active clients array from new clients array.
   *  Ativos(m) = Ativos(m-1) + Novos(m) - Churn(m)
   *  where Churn(m) = floor(Ativos(m-1) * monthlyChurnRate) */
  const computeActiveFromNew = (
    key: SubProductKey,
    year: Year,
    newClientsArr: (number | null)[],
    prevDecActive: number,
    prevAssumptions: AssumptionsType
  ): (number | null)[] => {
    const activeArr: (number | null)[] = Array(12).fill(null);
    let prevActive = prevDecActive;
    for (let m = 0; m < 12; m++) {
      const nc = newClientsArr[m];
      if (nc === null || nc === undefined) {
        activeArr[m] = null;
      } else {
        const churnRate = getChurnForMonth(key, prevAssumptions, year, m);
        const churned = Math.floor(prevActive * churnRate);
        prevActive = Math.max(0, prevActive + nc - churned);
        activeArr[m] = Math.round(prevActive);
      }
    }
    return activeArr;
  };

  /** Get December active clients for the year BEFORE the given year */
  const getPrevDecActive = (key: SubProductKey, year: Year, prev: AssumptionsType): number => {
    if (year === 2025) return 0;
    const prevYr = (year - 1) as Year;
    const decPeriod = toPeriod(prevYr, 11);
    const decApi = historicalData[key]?.[decPeriod];
    if (decApi && decApi.client_count > 0) return decApi.client_count;
    const prevYrMonthly = getMonthlyClients(key, prevYr, prev.subProductClients, prev.tickets, prev.monthlyClientOverrides);
    return Math.round(prevYrMonthly[11]);
  };

  const handleClientChange = (key: SubProductKey, year: Year, monthIdx: number, newCount: number) => {
    // newCount = number of NEW clients for this month
    const rate = getGrowthPct(key, year) / 100;

    setAssumptions(prev => {
      // Work with NEW clients array
      const currentNewOverrides = prev.monthlyNewClientOverrides ?? {};
      const currentManualFlags = prev.manualMonthlyClientOverrideFlags ?? {};
      const newArr = currentNewOverrides[key as TicketKey]?.[year]
        ? [...currentNewOverrides[key as TicketKey]![year]!]
        : Array(12).fill(null);
      const manualFlags = currentManualFlags[key as TicketKey]?.[year]
        ? [...currentManualFlags[key as TicketKey]![year]!]
        : Array(12).fill(false);

      newArr[monthIdx] = newCount;
      manualFlags[monthIdx] = true;

      // Recalculate subsequent non-manual NEW client months using growth %
      // Keep prevVal as FLOAT across iterations so compounding works even
      // with small base values (e.g. 2 * 1.10 = 2.2 → rounded display 2,
      // but internal accumulator keeps 2.2 → 2.42 → 2.66 ...).
      let prevVal = newCount;
      for (let j = monthIdx + 1; j < 12; j++) {
        if (manualFlags[j] && newArr[j] !== null && newArr[j] !== undefined) {
          prevVal = newArr[j]!;
        } else {
          prevVal = Math.max(0, prevVal * (1 + rate));
          newArr[j] = Math.round(prevVal);
        }
      }

      // Compute active clients from new clients
      const prevDecActive = getPrevDecActive(key, year, prev);
      const activeArr = computeActiveFromNew(key, year, newArr, prevDecActive, prev);
      const decValue = activeArr[11] ?? 0;

      // Store new clients + computed active clients
      const newNCO = { ...(prev.monthlyNewClientOverrides ?? {}), [key]: { ...((prev.monthlyNewClientOverrides ?? {})[key as TicketKey] ?? {}), [year]: newArr } };
      const newMO = { ...(prev.monthlyClientOverrides ?? {}), [key]: { ...((prev.monthlyClientOverrides ?? {})[key as TicketKey] ?? {}), [year]: activeArr } };
      const newMF = { ...(prev.manualMonthlyClientOverrideFlags ?? {}), [key]: { ...((prev.manualMonthlyClientOverrideFlags ?? {})[key as TicketKey] ?? {}), [year]: manualFlags } };
      const newSPC = { ...prev.subProductClients, [key]: { ...prev.subProductClients[key], [year]: Math.round(decValue) } };

      // Propagate to future years
      const futureYears = YEARS.filter(y => y > year);
      let lastDecActive = decValue;
      let lastDecNew = newArr[11] ?? newCount;
      for (const fy of futureYears) {
        const futureRate = getGrowthPct(key, fy) / 100;
        const futureNewArr: (number | null)[] = Array(12).fill(null);
        // Float accumulator: preserves compounding precision across iterations
        let prevNew = lastDecNew;
        for (let m = 0; m < 12; m++) {
          prevNew = Math.max(0, prevNew * (1 + futureRate));
          futureNewArr[m] = Math.round(prevNew);
        }
        const futureActiveArr = computeActiveFromNew(key, fy, futureNewArr, lastDecActive, prev);
        const futureDec = futureActiveArr[11] ?? Math.round(lastDecActive);
        (newSPC[key] as Record<number, number>)[fy] = futureDec;
        (newMO[key] as Record<number, (number | null)[]>)[fy] = futureActiveArr;
        (newNCO[key] as Record<number, (number | null)[]>)[fy] = futureNewArr;
        (newMF[key] as Record<number, boolean[]>)[fy] = Array(12).fill(false);
        lastDecActive = futureDec;
        lastDecNew = futureNewArr[11] ?? prevNew;
      }

      return {
        ...prev,
        subProductClients: newSPC,
        monthlyClientOverrides: newMO,
        monthlyNewClientOverrides: newNCO,
        manualMonthlyClientOverrideFlags: newMF,
      };
    });
  };

  const handleApplyAll = () => {
    const rate = applyAllPct / 100;
    const newGrowthRates = { ...growthRates };
    const newClientsAccum: Partial<Record<SubProductKey, Partial<Record<Year, (number | null)[]>>>> = {};
    const activeAccum: Partial<Record<SubProductKey, Partial<Record<Year, (number | null)[]>>>> = {};
    const decTargets: Partial<Record<SubProductKey, Record<number, number>>> = {};

    for (const y of YEARS) {
      const yearRates = { ...newGrowthRates[y] };
      for (const group of CLIENTS_ROWS) {
        for (const row of group.items) {
          if (!row.dataKey) continue;
          const k = row.dataKey;
          const arr = [...(yearRates[k] ?? Array(12).fill(0.06))];
          for (let m = 0; m < 12; m++) {
            if (!isHistorical(y, m)) arr[m] = rate;
          }
          yearRates[k] = arr;

          // Build NEW clients projection with growth %, then compute active
          const existingNew = data.monthlyNewClientOverrides?.[k]?.[y];
          const manualFlags = data.manualMonthlyClientOverrideFlags?.[k]?.[y];
          const base = getMonthlyClients(k, y, data.subProductClients, data.tickets, data.monthlyClientOverrides);

          // Determine previous month's new clients for growth base
          let prevNew = 0;
          if (y > 2025) {
            const prevYrNew = newClientsAccum[k]?.[(y - 1) as Year];
            if (prevYrNew) prevNew = prevYrNew[11] ?? 0;
            else {
              const prevYrExisting = data.monthlyNewClientOverrides?.[k]?.[(y - 1) as Year];
              prevNew = prevYrExisting?.[11] ?? 0;
            }
          }

          const newClientsArr: (number | null)[] = Array(12).fill(null);
          for (let m = 0; m < 12; m++) {
            if (isHistorical(y, m)) {
              // Keep historical — compute from active differences
              const activeCur = Math.round(base[m]);
              const activePrevM = m > 0 ? Math.round(base[m - 1]) : (y > 2025 ? Math.round(getMonthlyClients(k, (y - 1) as Year, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11]) : 0);
              const churnRate = getChurnForMonth(k, data, y, m);
              const churned = Math.floor(activePrevM * churnRate);
              newClientsArr[m] = Math.max(0, activeCur - activePrevM + churned);
              prevNew = newClientsArr[m]!;
            } else if (manualFlags?.[m] && existingNew?.[m] !== null && existingNew?.[m] !== undefined) {
              newClientsArr[m] = existingNew[m]!;
              prevNew = existingNew[m]!;
            } else {
              // Float accumulator: preserves compounding even with small bases
              prevNew = Math.max(0, prevNew * (1 + arr[m]));
              newClientsArr[m] = Math.round(prevNew);
            }
          }
          if (!newClientsAccum[k]) newClientsAccum[k] = {};
          newClientsAccum[k]![y] = newClientsArr;

          // Compute active from new
          const prevDecActive = y === 2025 ? 0 : (decTargets[k]?.[(y - 1)] ?? Math.round(getMonthlyClients(k, (y - 1) as Year, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11]));
          const activeArr = computeActiveFromNew(k, y, newClientsArr, prevDecActive, data);
          if (!activeAccum[k]) activeAccum[k] = {};
          activeAccum[k]![y] = activeArr;
          if (!decTargets[k]) decTargets[k] = {};
          decTargets[k]![y] = activeArr[11] ?? Math.round(base[11]);
        }
      }
      newGrowthRates[y] = yearRates;
    }

    setGrowthRatesPersist(newGrowthRates);

    const applyAllUpdater = (prev: AssumptionsType) => {
      const newSPC = { ...prev.subProductClients };
      const nextManualFlags = { ...(prev.manualMonthlyClientOverrideFlags ?? {}) };
      for (const [k, yearMap] of Object.entries(decTargets)) {
        newSPC[k as SubProductKey] = { ...newSPC[k as SubProductKey], ...yearMap };
        const existingProductFlags = nextManualFlags[k as TicketKey] ?? {};
        const mergedYearFlags = { ...existingProductFlags };
        for (const yearKey of Object.keys(yearMap)) {
          const numericYear = Number(yearKey) as Year;
          mergedYearFlags[numericYear] = Array(12).fill(false);
        }
        nextManualFlags[k as TicketKey] = mergedYearFlags;
      }
      return {
        ...prev,
        subProductClients: newSPC,
        monthlyClientOverrides: {
          ...(prev.monthlyClientOverrides ?? {}),
          ...activeAccum,
        },
        monthlyNewClientOverrides: {
          ...(prev.monthlyNewClientOverrides ?? {}),
          ...newClientsAccum,
        },
        manualMonthlyClientOverrideFlags: nextManualFlags,
      };
    };
    setAssumptions(applyAllUpdater);
  };

  const handleApplyRow = (key: SubProductKey, year: Year) => {
    const yearsToApply = YEARS.filter(y => y >= year);

    // Pre-compute growth arrays — each year uses its own cascaded growth %
    const newGrowthArrays: Record<number, number[]> = {};
    for (const y of yearsToApply) {
      const yearRate = getGrowthPct(key, y) / 100;
      const arr = Array(12).fill(yearRate);
      for (let m = 0; m < 12; m++) {
        if (isHistorical(y, m)) arr[m] = growthRates[y]?.[key]?.[m] ?? 0.06;
      }
      newGrowthArrays[y] = arr;
    }

    // Update growth rates first
    setGrowthRatesPersist(prevGR => {
      const updated = { ...prevGR };
      for (const y of yearsToApply) {
        const yearRates = { ...updated[y as Year] };
        yearRates[key] = newGrowthArrays[y];
        updated[y as Year] = yearRates;
      }
      return updated;
    });

    // Compute NEW clients with growth, then derive active clients
    setAssumptions(prev => {
      const allNewOverrides: Record<number, (number | null)[]> = {};
      const allActiveOverrides: Record<number, (number | null)[]> = {};
      const allDecTargets: Record<number, number> = {};

      // Get previous new client value as growth base
      let prevNew = 0;
      if (year > 2025) {
        const prevYrNew = prev.monthlyNewClientOverrides?.[key as TicketKey]?.[(year - 1) as Year];
        prevNew = prevYrNew?.[11] ?? 0;
      }
      let lastDecActive = getPrevDecActive(key, year, prev);

      for (const y of yearsToApply) {
        const arr = newGrowthArrays[y];
        const isFutureYear = y > year;
        const base = getMonthlyClients(key, y, prev.subProductClients, prev.tickets, prev.monthlyClientOverrides);
        const existingNew = prev.monthlyNewClientOverrides?.[key as TicketKey]?.[y as Year];
        const manualFlags = prev.manualMonthlyClientOverrideFlags?.[key as TicketKey]?.[y as Year];

        const newClientsArr: (number | null)[] = Array(12).fill(null);
        let foundBase = false; // track if we found the first manual base value
        for (let m = 0; m < 12; m++) {
          if (isHistorical(y, m)) {
            // Historical: compute new from active differences
            const activeCur = Math.round(base[m]);
            const activePrevM = m > 0 ? Math.round(base[m - 1]) : lastDecActive;
            const churnRate = getChurnForMonth(key, prev, y, m);
            const churned = Math.floor(activePrevM * churnRate);
            newClientsArr[m] = Math.max(0, activeCur - activePrevM + churned);
            prevNew = newClientsArr[m]!;
          } else if (!isFutureYear && !foundBase && manualFlags?.[m] && existingNew?.[m] !== null && existingNew?.[m] !== undefined) {
            // First projected month with manual value → use as growth base
            newClientsArr[m] = existingNew[m]!;
            prevNew = existingNew[m]!;
            foundBase = true;
          } else {
            // Float accumulator: preserves compounding precision
            prevNew = Math.max(0, prevNew * (1 + arr[m]));
            newClientsArr[m] = Math.round(prevNew);
          }
        }
        allNewOverrides[y] = newClientsArr;

        // Compute active from new
        const activeArr = computeActiveFromNew(key, y, newClientsArr, lastDecActive, prev);
        allActiveOverrides[y] = activeArr;
        allDecTargets[y] = activeArr[11] ?? Math.round(base[11]);
        lastDecActive = allDecTargets[y];
      }

      const newSPC = { ...prev.subProductClients, [key]: { ...prev.subProductClients[key] } };
      const newMO = { ...(prev.monthlyClientOverrides ?? {}), [key]: { ...((prev.monthlyClientOverrides ?? {})[key as TicketKey] ?? {}) } };
      const newNCO = { ...(prev.monthlyNewClientOverrides ?? {}), [key]: { ...((prev.monthlyNewClientOverrides ?? {})[key as TicketKey] ?? {}) } };

      for (const y of yearsToApply) {
        (newSPC[key] as Record<number, number>)[y] = allDecTargets[y];
        (newMO[key] as Record<number, (number | null)[]>)[y] = allActiveOverrides[y];
        (newNCO[key] as Record<number, (number | null)[]>)[y] = allNewOverrides[y];
      }

      return { ...prev, subProductClients: newSPC, monthlyClientOverrides: newMO, monthlyNewClientOverrides: newNCO };
    });
  };

  // ─── Reproject clients when churn changes ───
  // When churn changes, keep existing NEW clients unchanged, recompute ACTIVE from them
  const reprojectWithChurn = (key: SubProductKey, newChurnRates: Record<number, number>) => {
    const yearsToApply = YEARS.filter(y => y >= selectedYear);

    setAssumptions(prev => {
      const allActiveOverrides: Record<number, (number | null)[]> = {};
      const allDecTargets: Record<number, number> = {};

      // Create a modified assumptions with the new churn rates for computeActiveFromNew
      const modifiedPrev = { ...prev, monthlyChurnRates: { ...(prev.monthlyChurnRates ?? {}), [key]: { ...((prev.monthlyChurnRates ?? {})[key] ?? {}), ...newChurnRates } } };

      let lastDecActive = getPrevDecActive(key, selectedYear, prev);

      for (const y of yearsToApply) {
        const existingNew = prev.monthlyNewClientOverrides?.[key as TicketKey]?.[y as Year];
        const base = getMonthlyClients(key, y as Year, prev.subProductClients, prev.tickets, prev.monthlyClientOverrides);

        // If no new client overrides exist, derive from current active
        const newClientsArr: (number | null)[] = existingNew ? [...existingNew] : Array(12).fill(null);
        if (!existingNew) {
          for (let m = 0; m < 12; m++) {
            const activeCur = Math.round(base[m]);
            const activePrevM = m > 0 ? Math.round(base[m - 1]) : lastDecActive;
            const churnRate = getChurnForMonth(key, prev, y as Year, m);
            const churned = Math.floor(activePrevM * churnRate);
            newClientsArr[m] = Math.max(0, activeCur - activePrevM + churned);
          }
        }

        const activeArr = computeActiveFromNew(key, y as Year, newClientsArr, lastDecActive, modifiedPrev);
        allActiveOverrides[y] = activeArr;
        allDecTargets[y] = activeArr[11] ?? Math.round(base[11]);
        lastDecActive = allDecTargets[y];
      }

      const newSPC = { ...prev.subProductClients, [key]: { ...prev.subProductClients[key] } };
      const newMO = { ...(prev.monthlyClientOverrides ?? {}), [key]: { ...((prev.monthlyClientOverrides ?? {})[key as TicketKey] ?? {}) } };
      const newCR = { ...(prev.monthlyChurnRates ?? {}), [key]: { ...((prev.monthlyChurnRates ?? {})[key] ?? {}), ...newChurnRates } };

      for (const y of yearsToApply) {
        (newSPC[key] as Record<number, number>)[y] = allDecTargets[y];
        (newMO[key] as Record<number, (number | null)[]>)[y] = allActiveOverrides[y];
      }

      return { ...prev, subProductClients: newSPC, monthlyClientOverrides: newMO, monthlyChurnRates: newCR };
    });
  };

  // ─── Reproject clients when churn changes (monthly arrays) ───
  const reprojectWithChurnArrays = (key: SubProductKey, newChurnArrays: Record<number, number[]>) => {
    const yearsToApply = YEARS.filter(y => y >= selectedYear);

    setAssumptions(prev => {
      const allActiveOverrides: Record<number, (number | null)[]> = {};
      const allDecTargets: Record<number, number> = {};

      const modifiedPrev = { ...prev, monthlyChurnRates: { ...(prev.monthlyChurnRates ?? {}), [key]: { ...((prev.monthlyChurnRates ?? {})[key] ?? {}), ...newChurnArrays } } };

      let lastDecActive = getPrevDecActive(key, selectedYear, prev);

      for (const y of yearsToApply) {
        const existingNew = prev.monthlyNewClientOverrides?.[key as TicketKey]?.[y as Year];
        const base = getMonthlyClients(key, y as Year, prev.subProductClients, prev.tickets, prev.monthlyClientOverrides);

        const newClientsArr: (number | null)[] = existingNew ? [...existingNew] : Array(12).fill(null);
        if (!existingNew) {
          for (let m = 0; m < 12; m++) {
            const activeCur = Math.round(base[m]);
            const activePrevM = m > 0 ? Math.round(base[m - 1]) : lastDecActive;
            const churnRate = getChurnForMonth(key, prev, y as Year, m);
            const churned = Math.floor(activePrevM * churnRate);
            newClientsArr[m] = Math.max(0, activeCur - activePrevM + churned);
          }
        }

        const activeArr = computeActiveFromNew(key, y as Year, newClientsArr, lastDecActive, modifiedPrev);
        allActiveOverrides[y] = activeArr;
        allDecTargets[y] = activeArr[11] ?? Math.round(base[11]);
        lastDecActive = allDecTargets[y];
      }

      const newSPC = { ...prev.subProductClients, [key]: { ...prev.subProductClients[key] } };
      const newMO = { ...(prev.monthlyClientOverrides ?? {}), [key]: { ...((prev.monthlyClientOverrides ?? {})[key as TicketKey] ?? {}) } };
      const newCR = { ...(prev.monthlyChurnRates ?? {}), [key]: { ...((prev.monthlyChurnRates ?? {})[key] ?? {}), ...newChurnArrays } };

      for (const y of yearsToApply) {
        (newSPC[key] as Record<number, number>)[y] = allDecTargets[y];
        (newMO[key] as Record<number, (number | null)[]>)[y] = allActiveOverrides[y];
      }

      return { ...prev, subProductClients: newSPC, monthlyClientOverrides: newMO, monthlyChurnRates: newCR };
    });
  };

  const handleApplyTicketGrowth = (prodKey: SubProductKey, year: Year) => {
    const pct = rowTicketGrowthPct[prodKey] ?? 0;
    const rate = pct / 100;

    setAssumptions(prevState => {
      const ticketVal = prevState.tickets[prodKey as TicketKey] ?? 0;
      const currentMonthlyTickets = prevState.monthlyTickets ?? {};

      const yearsToApply = YEARS.filter(y => y >= year);
      const allYearOverrides: Record<number, number[]> = {};
      let base = ticketVal as number; // float base

      for (const y of yearsToApply) {
        const yearArr = Array(12).fill(ticketVal);

        // Historical months: use ticketVal (not stale overrides)
        // Base for projection always starts from ticketVal
        base = ticketVal;

        let firstProjected = true;
        for (let m = 0; m < 12; m++) {
          if (isHistorical(y, m)) {
            yearArr[m] = ticketVal;
            base = ticketVal;
            continue;
          }
          if (firstProjected) {
            // First projected month = ticket base (no growth yet)
            yearArr[m] = ticketVal;
            base = ticketVal;
            firstProjected = false;
          } else {
            base = base * (1 + rate);
            yearArr[m] = Math.round(base * 100) / 100;
          }
        }

        allYearOverrides[y] = yearArr;
      }

      return {
        ...prevState,
        monthlyTickets: {
          ...(prevState.monthlyTickets ?? {}),
          [prodKey]: {
            ...((prevState.monthlyTickets ?? {})[prodKey] ?? {}),
            ...allYearOverrides,
          },
        },
      };
    });
  };

  // Used by Marketing tab actual-data table
  const subProductKeys = Object.keys(SUB_PRODUCT_LABELS) as SubProductKey[];

  // CAC and unit economics
  const avgTicketVal = Object.values(data.tickets).reduce((s, v) => s + v, 0) / Object.values(data.tickets).length;
  const avgChurn = (data.churnCaas + data.churnSaas) / 2 / 100;
  const monthlyChurn = avgChurn / 12;
  const ltv = monthlyChurn > 0 ? avgTicketVal / monthlyChurn : avgTicketVal * 1200;
  const avgCac = (cacPerClient.caas + cacPerClient.saas + cacPerClient.education + cacPerClient.baas) / 4;
  const ltvCacRatio = avgCac > 0 ? ltv / avgCac : 0;

  // Monthly headcount rows for selected year
  const monthlyHCRows = getMonthlyHeadcount(selectedYear, data.subProductClients, data.tickets);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-primary">Assumptions</h2>
          <p className="text-xs text-muted-foreground mt-1">Premissas da modelagem financeira. Os valores definidos aqui alimentam o P&L projetado, Cash Flow e demais demonstrações.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-positive bg-positive/10 border border-positive/30 rounded-lg">
            <Save className="h-3.5 w-3.5" /> Auto-save ativo
          </div>
          <button onClick={resetAssumptions} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* Year Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Ano:</span>
        <div className="flex bg-secondary rounded-lg p-0.5 border border-border">
          {activeYears.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                selectedYear === y
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Item 9: KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {(() => {
          // Read from pnlTree (same source as P&L page — includes historical overrides)
          const findNode = (code: string) => model.pnlTree.find(n => n.code === code);
          const gr = findNode('1')?.annual[selectedYear] ?? model.years[selectedYear].grossRevenue;
          const nrNode = findNode('NR');
          const nr = nrNode?.annual[selectedYear] ?? model.years[selectedYear].netRevenue;
          const gpNode = findNode('GP');
          const gp = gpNode?.annual[selectedYear] ?? model.years[selectedYear].grossProfit;
          const ebitdaNode = findNode('EBITDA');
          const ebitda = ebitdaNode?.annual[selectedYear] ?? model.years[selectedYear].ebitda;
          const niNode = findNode('NI');
          const ni = niNode?.annual[selectedYear] ?? model.years[selectedYear].netIncome;
          const gmPct = nr > 0 ? ((gp / nr) * 100).toFixed(1) : '0';
          const emPct = nr > 0 ? ((ebitda / nr) * 100).toFixed(1) : '0';
          const kpiDefs: { label: string; value: string; kpiCode: 'grossRevenue' | 'ebitda' | 'grossMargin' | 'ebitdaMargin' | 'clients' | 'netIncome' }[] = [
            { label: 'Receita Bruta', value: formatCurrency(gr * 1000), kpiCode: 'grossRevenue' },
            { label: 'EBITDA', value: formatCurrency(ebitda * 1000), kpiCode: 'ebitda' },
            { label: 'Margem Bruta', value: `${gmPct}%`, kpiCode: 'grossMargin' },
            { label: 'Margem EBITDA', value: `${emPct}%`, kpiCode: 'ebitdaMargin' },
            { label: 'Clientes', value: model.years[selectedYear].totalClients.toLocaleString('pt-BR'), kpiCode: 'clients' },
            { label: 'Resultado Líq.', value: formatCurrency(ni * 1000), kpiCode: 'netIncome' },
          ];
          return kpiDefs;
        })().map(kpi => (
          <div key={kpi.label} className="gradient-card p-3 space-y-1">
            <div className="flex items-center gap-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
              <FormulaExplainer explanation={explainKPI(kpi.kpiCode, selectedYear, model)} iconSize={11} />
            </div>
            <p className="text-sm font-bold tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Item 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by BU (stacked bar) */}
        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold mb-3">Receita Projetada por BU (R$ mil)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={activeYears.map(y => {
              // Use pnlTree BU nodes (same source as P&L — includes historical overrides)
              const findChild = (parentCode: string, childCode: string) => {
                const parent = model.pnlTree.find(n => n.code === parentCode);
                return parent?.children?.find(c => c.code === childCode)?.annual[y] ?? 0;
              };
              const findParent = (code: string) => model.pnlTree.find(n => n.code === code)?.annual[y] ?? 0;
              return {
                year: y,
                CaaS: findChild('1', '1.1') || model.years[y].caasRevenue,
                SaaS: findChild('1', '1.2') || model.years[y].saasRevenue,
                Education: findChild('1', '1.3') || model.years[y].educationRevenue,
                Expansão: findChild('1', '1.5') || model.years[y].baasRevenue,
                Tax: findChild('1', '1.6') || model.years[y].taxRevenue,
              };
            })}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${(v / 1000).toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => formatCurrency(v * 1000)} labelFormatter={(label, payload) => {
                const total = payload?.reduce((sum: number, p: any) => sum + (p.value || 0), 0) || 0;
                return `${label} — Total: ${formatCurrency(total * 1000)}`;
              }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="CaaS" stackId="a" fill="hsl(var(--primary))" />
              <Bar dataKey="SaaS" stackId="a" fill="hsl(210, 70%, 55%)" />
              <Bar dataKey="Education" stackId="a" fill="hsl(150, 50%, 50%)" />
              <Bar dataKey="Expansão" stackId="a" fill="hsl(40, 70%, 55%)" />
              <Bar dataKey="Tax" stackId="a" fill="hsl(280, 60%, 55%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* Clients by BU (line chart) */}
        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold mb-3">Evolução de Clientes por BU</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={activeYears.map(y => ({
              year: y,
              CaaS: data.caasClients[y],
              SaaS: data.saasClients[y],
              Education: data.educationClients[y],
              Expansão: data.subProductClients?.baas?.[y] ?? 0,
              Tax: data.taxClients[y],
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR')} labelFormatter={(label, payload) => {
                const total = payload?.reduce((sum: number, p: any) => sum + (p.value || 0), 0) || 0;
                return `${label} — Total: ${total.toLocaleString('pt-BR')}`;
              }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="CaaS" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="SaaS" stroke="hsl(210, 70%, 55%)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Education" stroke="hsl(150, 50%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Expansão" stroke="hsl(30, 80%, 55%)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Tax" stroke="hsl(280, 60%, 55%)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Tabs defaultValue="revenue" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="tax">Tax Deductions</TabsTrigger>
          <TabsTrigger value="cos">COS</TabsTrigger>
          <TabsTrigger value="sga">SG&A</TabsTrigger>
          <TabsTrigger value="economic">Econ. & Fin.</TabsTrigger>
        </TabsList>

        {/* ─── BLOCO 1: REVENUE ─── */}
        <TabsContent value="revenue" className="space-y-6 mt-4">

          {/* ── Section 1: Nº de Clientes — Expandable Rows ── */}
          <div className="gradient-card overflow-x-auto">
            <div className="flex items-center gap-2 p-5 pb-3 flex-wrap">
              <h3 className="text-sm font-semibold">Número de Clientes — {selectedYear}</h3>
              <p className="text-[10px] text-muted-foreground ml-2">Clique na linha para expandir e editar</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium min-w-[200px]">Sub-Produto</th>
                  <th className="text-right p-3 text-muted-foreground font-medium min-w-[100px] bg-primary/5">Total {selectedYear}</th>
                  <th className="text-right p-3 text-muted-foreground font-medium min-w-[120px] bg-primary/5">Receita {selectedYear}</th>
                </tr>
              </thead>
              <tbody>
                {CLIENTS_ROWS.map(group => (
                  <React.Fragment key={group.group}>
                    <tr className="bg-secondary/40 border-b border-border/50">
                      <td colSpan={3} className="p-2 text-xs font-bold text-foreground/80 uppercase tracking-wide">
                        {group.group}
                      </td>
                    </tr>
                    {group.items.map(row => {
                      const rowKey = row.dataKey ?? row.label;
                      const isExpanded = expandedProducts[rowKey] ?? false;
                      const growthArr = growthRates[selectedYear]?.[rowKey] ?? Array(12).fill(0.06);
                      const churn = row.dataKey ? getChurnMonthly(row.dataKey, data, selectedYear) : 0;
                      const monthly: number[] = row.dataKey
                        ? getMonthlyClients(row.dataKey, selectedYear, data.subProductClients, data.tickets, data.monthlyClientOverrides).map(v => Math.round(v))
                        : Array(12).fill(0);
                      const ticketVal = row.dataKey ? data.tickets[row.dataKey as TicketKey] ?? 0 : 0;

                      return (
                        <React.Fragment key={`${group.group}-${row.label}`}>
                          <tr
                            className={`border-b border-border/20 transition-colors cursor-pointer ${isExpanded ? 'bg-primary/5' : 'hover:bg-secondary/20'}`}
                            onClick={() => setExpandedProducts(p => ({ ...p, [rowKey]: !p[rowKey] }))}
                          >
                            <td className="p-3 pl-5 font-medium text-sm">
                              <div className="flex items-center gap-2">
                                {row.dataKey ? (
                                  isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : <span className="w-3.5" />}
                                {row.label}
                              </div>
                            </td>
                            <td className="text-right p-3 tabular-nums text-sm bg-primary/5 font-semibold">
                              <div className="flex items-center justify-end gap-1">
                                {row.dataKey ? getAnnualClientSum(row.dataKey as SubProductKey, selectedYear).toLocaleString('pt-BR') : '—'}
                                {row.dataKey && <FormulaExplainer explanation={explainClients(row.dataKey as TicketKey, row.label, selectedYear, data)} iconSize={11} />}
                              </div>
                            </td>
                            <td className="text-right p-3 tabular-nums text-sm bg-primary/5 font-semibold text-emerald-600">
                              <div className="flex items-center justify-end gap-1">
                                {row.dataKey ? (() => {
                                  const rev = getAnnualRevenue(row.dataKey as SubProductKey, selectedYear);
                                  return formatCurrency(rev);
                                })() : '—'}
                                {row.dataKey && <FormulaExplainer explanation={explainRevenue(row.dataKey as TicketKey, row.label, selectedYear, data, model)} iconSize={11} />}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded detail — monthly breakdown with inline edit */}
                          {isExpanded && row.dataKey && (() => {
                            const prodKey = row.dataKey as SubProductKey;
                            const directUpdateClients = (yearToUpdate: Year, val: number) => {
                              setAssumptions(prev => ({
                                ...prev,
                                subProductClients: {
                                  ...prev.subProductClients,
                                  [prodKey]: { ...prev.subProductClients[prodKey], [yearToUpdate]: val },
                                },
                              }));
                            };
                            const directUpdateTicket = (val: number) => {
                              // Update flat ticket AND ALL months (including historical)
                              const updater = (prev: typeof assumptions) => {
                                const newMonthlyTickets = { ...(prev.monthlyTickets ?? {}) };
                                const prevProdTickets = { ...(newMonthlyTickets[prodKey] ?? {}) };
                                for (const y of YEARS.filter(yr => yr >= selectedYear)) {
                                  // Fill ALL 12 months with the new ticket value
                                  prevProdTickets[y] = Array(12).fill(val);
                                }
                                newMonthlyTickets[prodKey] = prevProdTickets;
                                return {
                                  ...prev,
                                  tickets: { ...prev.tickets, [prodKey]: val },
                                  monthlyTickets: newMonthlyTickets,
                                };
                              };
                              setAssumptions(updater);
                            };
                            return (
                            <tr className="border-b border-border/30">
                              <td colSpan={activeYears.length + 2} className="px-5 py-4 bg-secondary/5">
                                <div className="space-y-4">
                                  {/* Annual targets */}
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Clientes ativos em Dezembro</p>
                                    <div className="grid grid-cols-6 gap-2">
                                      {activeYears.map(y => {
                                        const engineMonthlyYr = getMonthlyClients(prodKey as SubProductKey, y, data.subProductClients, data.tickets, data.monthlyClientOverrides);
                                        const decPeriod = toPeriod(y, 11);
                                        const decApi = historicalData[prodKey]?.[decPeriod];
                                        // API e soberana para meses historicos: respeita 0 do Oxy
                                        // em vez de cair no engine seed hardcoded (modelData.ts).
                                        // Para meses projetados (Dec de anos >= 2026, dependendo do
                                        // isHistorical), continua usando engine.
                                        const decClients = (decApi && isHistorical(y, 11))
                                          ? decApi.client_count
                                          : Math.round(engineMonthlyYr[11]);
                                        return (
                                          <div key={y} className={`text-center p-2 rounded ${y === selectedYear ? 'bg-primary/10 border border-primary/30' : 'bg-card border border-border/50'}`}>
                                            <p className="text-[9px] text-muted-foreground font-medium mb-1">{y}</p>
                                            <span className="block w-full text-center text-sm tabular-nums font-bold text-foreground">
                                              {decClients.toLocaleString('pt-BR')}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Clientes Ativos — READ-ONLY calculated: Ativos(m) = Ativos(m-1) + Novos(m) - Churn(m) */}
                                  <div>
                                    <div className="flex items-center gap-1 mb-2">
                                      <p className="text-xs font-semibold text-muted-foreground">
                                        Clientes Ativos — {selectedYear}
                                        {prodKey === 'saasSetup' && <span className="ml-2 text-[9px] text-primary font-normal">(auto: Enterprise + Corporate + Oxy + Oxy+Gênio + Oxy+Gênio+Esp)</span>}
                                      </p>
                                      <FormulaExplainer explanation={explainClientesAtivos(prodKey as FinTicketKey, row.label, selectedYear, data)} iconSize={11} />
                                    </div>
                                    <div className="grid grid-cols-12 gap-1.5">
                                      {(() => {
                                        const isProductNonMrr = !isProductMrr(prodKey as FinTicketKey);
                                        return MONTHS.map((m, i) => {
                                        const hist = isHistorical(selectedYear, i);
                                        const hcPeriod = toPeriod(selectedYear, i);
                                        const hcEntry = hist ? historicalData[prodKey]?.[hcPeriod] : undefined;
                                        // For both MRR and non-MRR: read from Supabase if available, else engine-derived monthly[].
                                        // The old non-MRR branch that used a delta formula is removed — for non-MRR
                                        // (one-shot products), each month's active count = that month's new clients,
                                        // so the direct read already gives the correct value.
                                        const displayClients: number = hcEntry ? hcEntry.client_count : monthly[i];
                                        return (
                                          <div key={m} className={`text-center space-y-1 p-1.5 rounded ${hist ? 'bg-secondary/40' : 'bg-card border border-border/50'}`}>
                                            <p className="text-[9px] text-muted-foreground font-medium">{m}{hist ? ' 🔒' : ''}{hcEntry ? <span className="ml-0.5 text-[8px] text-sky-500 font-semibold" title="Dado real da API">API</span> : ''}</p>
                                            <span className={`block w-full text-center text-xs tabular-nums font-medium ${hcEntry ? 'text-sky-600' : 'text-foreground'}`}>
                                              {Math.round(displayClients).toLocaleString('pt-BR')}
                                            </span>
                                            <p className={`text-[9px] tabular-nums ${hist ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                              {isProductNonMrr ? '—' : (i > 0 && monthly[i - 1] > 0 ? `${(((monthly[i] / monthly[i - 1]) - 1) * 100).toFixed(0)}%` : '—')}
                                            </p>
                                          </div>
                                        );
                                        });
                                      })()}
                                    </div>
                                  </div>

                                  {/* Novos Clientes — EDITABLE: user inputs new clients per month */}
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-1">
                                        <p className="text-xs font-semibold text-emerald-600">
                                          Novos Clientes — {selectedYear}
                                        </p>
                                        <FormulaExplainer explanation={explainNovosClientes(prodKey as FinTicketKey, row.label, selectedYear, data)} iconSize={11} />
                                      </div>
                                      {prodKey !== 'saasSetup' && (
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground">Crescimento:</span>
                                        <input
                                          type="number"
                                          step="0.1"
                                          className="w-14 bg-secondary border border-border rounded px-1.5 py-0.5 text-right text-[10px] text-foreground outline-none focus:ring-1 focus:ring-primary"
                                          value={getGrowthPct(rowKey, selectedYear)}
                                          onClick={e => e.stopPropagation()}
                                          onChange={e => {
                                            const val = Number(e.target.value) || 0;
                                            setGrowthForYear(rowKey, selectedYear, val);
                                          }}
                                          onBlur={() => handleApplyRow(row.dataKey as SubProductKey, selectedYear)}
                                          disabled={false}
                                        />
                                        <span className="text-[10px] text-muted-foreground">% a.m.</span>
                                      </div>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-12 gap-1.5">
                                      {MONTHS.map((m, i) => {
                                        const hist = isHistorical(selectedYear, i);
                                        const hcPeriodCur = toPeriod(selectedYear, i);
                                        const hcEntryCur = hist ? historicalData[prodKey]?.[hcPeriodCur] : undefined;

                                        // For historical months, compute new clients from API data
                                        // For projected months, read from monthlyNewClientOverrides or compute from active diff
                                        //
                                        // IMPORTANT: for non-MRR (one-shot) products, each month is a DIFFERENT
                                        // set of clients (projects that closed that month). There's no accumulation,
                                        // so "novos clientes" = "clientes ativos" = this month's count directly.
                                        // The delta-based formula (activeCur - activePrev + churn) is ONLY correct
                                        // for MRR where clients carry over month-to-month.
                                        const isProductNonMrrNC = !isProductMrr(prodKey as FinTicketKey);
                                        let newClientsDisplay = 0;
                                        if (isProductNonMrrNC) {
                                          // Non-MRR: new clients = this month's real count (all are "new" by definition)
                                          if (hist) {
                                            newClientsDisplay = hcEntryCur ? hcEntryCur.client_count : monthly[i];
                                          } else {
                                            const storedNew = data.monthlyNewClientOverrides?.[prodKey]?.[selectedYear]?.[i];
                                            if (storedNew !== null && storedNew !== undefined) {
                                              newClientsDisplay = storedNew;
                                            } else {
                                              newClientsDisplay = Math.round(monthly[i]);
                                            }
                                          }
                                        } else if (hist) {
                                          // MRR historical: use delta formula
                                          const activeCur = hcEntryCur ? hcEntryCur.client_count : monthly[i];
                                          let activePrev = 0;
                                          if (i > 0) {
                                            const hcPeriodPrev = toPeriod(selectedYear, i - 1);
                                            const hcEntryPrev = isHistorical(selectedYear, i - 1) ? historicalData[prodKey]?.[hcPeriodPrev] : undefined;
                                            activePrev = hcEntryPrev ? hcEntryPrev.client_count : monthly[i - 1];
                                          } else if (selectedYear > 2025) {
                                            const prevYr = (selectedYear - 1) as Year;
                                            const decPeriodPrev = toPeriod(prevYr, 11);
                                            const decApiPrev = historicalData[prodKey]?.[decPeriodPrev];
                                            if (decApiPrev && decApiPrev.client_count > 0) {
                                              activePrev = decApiPrev.client_count;
                                            } else {
                                              const prevYrMonthly = getMonthlyClients(prodKey as SubProductKey, prevYr, data.subProductClients, data.tickets, data.monthlyClientOverrides);
                                              activePrev = Math.round(prevYrMonthly[11]);
                                            }
                                          }
                                          let churnedCur = 0;
                                          if (hcEntryCur) {
                                            churnedCur = hcEntryCur.churned_clients ?? 0;
                                          } else {
                                            const churnRate = getChurnForMonth(prodKey, data, selectedYear, i);
                                            churnedCur = Math.round(activePrev * churnRate);
                                          }
                                          newClientsDisplay = Math.max(0, Math.round(activeCur) - Math.round(activePrev) + churnedCur);
                                        } else {
                                          // MRR projected: read from stored new client overrides or compute from diff
                                          const storedNew = data.monthlyNewClientOverrides?.[prodKey]?.[selectedYear]?.[i];
                                          if (storedNew !== null && storedNew !== undefined) {
                                            newClientsDisplay = storedNew;
                                          } else {
                                            // Fallback: compute from active client differences
                                            const activeCur = monthly[i];
                                            let activePrev = 0;
                                            if (i > 0) {
                                              activePrev = monthly[i - 1];
                                            } else if (selectedYear > 2025) {
                                              const prevYr = (selectedYear - 1) as Year;
                                              const prevYrMonthly = getMonthlyClients(prodKey as SubProductKey, prevYr, data.subProductClients, data.tickets, data.monthlyClientOverrides);
                                              activePrev = Math.round(prevYrMonthly[11]);
                                            }
                                            const churnRate = getChurnForMonth(prodKey, data, selectedYear, i);
                                            const churnedCur = Math.round(activePrev * churnRate);
                                            newClientsDisplay = Math.max(0, Math.round(activeCur) - Math.round(activePrev) + churnedCur);
                                          }
                                        }

                                        return (
                                          <div key={m} className={`text-center space-y-1 p-1.5 rounded ${hist ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/30'}`}>
                                            <p className="text-[9px] text-muted-foreground font-medium">{m}{hist ? ' 🔒' : ''}{hcEntryCur ? <span className="ml-0.5 text-[8px] text-sky-500 font-semibold" title="Dado real da API">API</span> : ''}</p>
                                            {hist ? (
                                              <span className="block w-full text-center text-xs tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                                                {newClientsDisplay > 0 ? `+${newClientsDisplay.toLocaleString('pt-BR')}` : '0'}
                                              </span>
                                            ) : (
                                              <MonthlyClientInput
                                                value={newClientsDisplay}
                                                className="w-full bg-transparent text-center text-xs tabular-nums font-medium outline-none border-b border-transparent hover:border-emerald-400/50 focus:border-emerald-500 transition-colors text-emerald-700 dark:text-emerald-400"
                                                onCommit={v => handleClientChange(row.dataKey as SubProductKey, selectedYear, i, v)}
                                                readOnly={prodKey === 'saasSetup'}
                                              />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="flex items-center gap-6 text-xs mt-1">
                                      <span className="text-emerald-600">
                                        Total novos no ano: <strong>{
                                          MONTHS.reduce((sum, _, i) => {
                                            const hist = isHistorical(selectedYear, i);
                                            const hcPeriodCur = toPeriod(selectedYear, i);
                                            const hcEntryCur = hist ? historicalData[prodKey]?.[hcPeriodCur] : undefined;
                                            if (hist) {
                                              const activeCur = hcEntryCur ? hcEntryCur.client_count : monthly[i];
                                              let activePrev = 0;
                                              if (i > 0) {
                                                const hcPeriodPrev = toPeriod(selectedYear, i - 1);
                                                const hcEntryPrev = isHistorical(selectedYear, i - 1) ? historicalData[prodKey]?.[hcPeriodPrev] : undefined;
                                                activePrev = hcEntryPrev ? hcEntryPrev.client_count : monthly[i - 1];
                                              } else if (selectedYear > 2025) {
                                                const prevYr = (selectedYear - 1) as Year;
                                                const decPeriodP = toPeriod(prevYr, 11);
                                                const decApiP = historicalData[prodKey]?.[decPeriodP];
                                                if (decApiP && decApiP.client_count > 0) { activePrev = decApiP.client_count; }
                                                else { activePrev = Math.round(getMonthlyClients(prodKey as SubProductKey, prevYr, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11]); }
                                              }
                                              let churnedCur = 0;
                                              if (hcEntryCur) { churnedCur = hcEntryCur.churned_clients ?? 0; }
                                              else { churnedCur = Math.round((activePrev) * getChurnForMonth(prodKey, data, selectedYear, i)); }
                                              return sum + Math.max(0, Math.round(activeCur) - Math.round(activePrev) + churnedCur);
                                            } else {
                                              // Projected month: honor override if set, else compute from engine delta
                                              const storedNew = data.monthlyNewClientOverrides?.[prodKey]?.[selectedYear]?.[i];
                                              if (storedNew !== null && storedNew !== undefined) {
                                                return sum + storedNew;
                                              }
                                              const activeCurP = monthly[i];
                                              let activePrevP = 0;
                                              if (i > 0) {
                                                activePrevP = monthly[i - 1];
                                              } else if (selectedYear > 2025) {
                                                const prevYr = (selectedYear - 1) as Year;
                                                const decPeriodP = toPeriod(prevYr, 11);
                                                const decApiP = historicalData[prodKey]?.[decPeriodP];
                                                if (decApiP && decApiP.client_count > 0) { activePrevP = decApiP.client_count; }
                                                else { activePrevP = Math.round(getMonthlyClients(prodKey as SubProductKey, prevYr, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11]); }
                                              }
                                              const churnedCurP = Math.round(activePrevP * getChurnForMonth(prodKey, data, selectedYear, i));
                                              return sum + Math.max(0, Math.round(activeCurP) - Math.round(activePrevP) + churnedCurP);
                                            }
                                          }, 0).toLocaleString('pt-BR')
                                        }</strong>
                                      </span>
                                    </div>
                                  </div>

                                  {/* ─── Logo Churn Section (after Novos Clientes) ─── */}
                                  {(() => {
                                    const isProductNonMrrLC = !isProductMrr(prodKey as FinTicketKey);

                                    if (isProductNonMrrLC) return (
                                      <div className="space-y-2 pt-1">
                                        <div className="flex items-center gap-4">
                                          <p className="text-xs font-semibold text-muted-foreground">Logo Churn — N/A (produto nao-recorrente)</p>
                                        </div>
                                      </div>
                                    );

                                    // ── Compute Logo Churn for each month ──
                                    const logoChurnMonthlyLC: number[] = [];
                                    const churnPctMonthlyArrLC: number[] = [];

                                    for (let i = 0; i < 12; i++) {
                                      const period = toPeriod(selectedYear, i);
                                      const hist = isHistorical(selectedYear, i);

                                      const hcChurnEntry = hist ? historicalData[prodKey]?.[period] : undefined;
                                      const storedArr = data.monthlyChurnRates?.[prodKey as TicketKey]?.[selectedYear];
                                      const hasManualChurn = hist && storedArr && Array.isArray(storedArr) && storedArr[i] !== undefined;

                                      // Compute prevClients and curClients from monthly[] (engine).
                                      // Used both for the delta fallback (when Supabase data absent)
                                      // AND for consistent logoChurn computation.
                                      const prevClientsForChurn = i === 0
                                        ? (selectedYear === 2025 ? 0 : Math.round(getMonthlyClients(prodKey, (selectedYear - 1) as Year, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11]))
                                        : monthly[i - 1];
                                      const curClientsForChurn = monthly[i];

                                      // Determine monthly churn rate (decimal, e.g. 0.05 = 5%)
                                      // Priority:
                                      // 1. Supabase real churn_rate (stored as MONTHLY percent by populate script)
                                      // 2. Manual override (stored as ANNUAL percent by user)
                                      // 3. Delta from monthly[] (when Supabase absent but we have engine data)
                                      // 4. Premise fallback
                                      let churnRate: number;
                                      if (data.churnNotApplicable?.[prodKey]) {
                                        churnRate = 0;
                                      } else if (hcChurnEntry && (hcChurnEntry.churn_rate ?? 0) > 0) {
                                        // Supabase stores monthly % → divide by 100 for decimal (NOT /12)
                                        churnRate = hcChurnEntry.churn_rate / 100;
                                      } else if (hasManualChurn) {
                                        // Manual override stored as ANNUAL % → divide by 100 and by 12
                                        churnRate = storedArr[i] / 100 / 12;
                                      } else if (hist && prevClientsForChurn > 0 && curClientsForChurn < prevClientsForChurn) {
                                        // Delta fallback: when we have engine-derived counts but no Supabase churn,
                                        // compute monthly churn rate from the net drop.
                                        const netChurn = prevClientsForChurn - curClientsForChurn;
                                        churnRate = netChurn / prevClientsForChurn;
                                      } else {
                                        // Final fallback: premise
                                        churnRate = hist
                                          ? getChurnMonthly(prodKey, { ...data, monthlyChurnRates: undefined } as any, selectedYear)
                                          : getChurnForMonth(prodKey, data, selectedYear, i);
                                      }
                                      churnPctMonthlyArrLC.push(Math.round(churnRate * 100 * 100) / 100);

                                      if (data.churnNotApplicable?.[prodKey]) {
                                        logoChurnMonthlyLC.push(0);
                                        continue;
                                      }

                                      let prevPeriodLC: string;
                                      if (i > 0) {
                                        prevPeriodLC = toPeriod(selectedYear, i - 1);
                                      } else {
                                        const prevYr = (selectedYear - 1) as Year;
                                        prevPeriodLC = toPeriod(prevYr, 11);
                                      }

                                      const curEntry = historicalData[prodKey]?.[period];
                                      const prevEntry = historicalData[prodKey]?.[prevPeriodLC];

                                      // Logo churn count priority:
                                      // 1. Set-diff from client_names (most accurate)
                                      // 2. Supabase churned_clients field (if > 0)
                                      // 3. Net delta from monthly[] (when Supabase absent)
                                      // 4. prevClients * churnRate (premise)
                                      if (hist && curEntry?.client_names && prevEntry?.client_names) {
                                        const curNameSet = new Set(curEntry.client_names.map(c => c.name));
                                        const churned = prevEntry.client_names.filter(c => !curNameSet.has(c.name));
                                        logoChurnMonthlyLC.push(churned.length);
                                      } else if (hist && curEntry && (curEntry.churned_clients ?? 0) > 0) {
                                        logoChurnMonthlyLC.push(curEntry.churned_clients ?? 0);
                                      } else if (hist && prevClientsForChurn > 0 && curClientsForChurn < prevClientsForChurn) {
                                        // Delta fallback: net drop in engine-derived client count
                                        logoChurnMonthlyLC.push(prevClientsForChurn - curClientsForChurn);
                                      } else {
                                        const logoChurn = Math.round(prevClientsForChurn * churnRate);
                                        logoChurnMonthlyLC.push(logoChurn);
                                      }
                                    }

                                    const totalLogoChurnLC = logoChurnMonthlyLC.reduce((s, v) => s + v, 0);
                                    const avgActiveClientsLC = monthly.reduce((s, v) => s + v, 0) / 12;
                                    const logoChurnRateAnnualLC = avgActiveClientsLC > 0 ? (totalLogoChurnLC / avgActiveClientsLC) * 100 : 0;

                                    return (
                                      <div className="space-y-2 pt-2">
                                        {/* ── Header with N/A toggle ── */}
                                        <div className="flex items-center gap-3">
                                          <div className="flex items-center gap-1">
                                            <p className="text-xs font-semibold text-negative">Logo Churn — {selectedYear}</p>
                                            <FormulaExplainer explanation={explainChurn(prodKey as FinTicketKey, row.label, selectedYear, data)} iconSize={11} />
                                          </div>
                                          <button
                                            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${data.churnNotApplicable?.[prodKey] ? 'bg-muted text-muted-foreground ring-1 ring-border' : 'bg-secondary/60 text-muted-foreground/60 hover:bg-secondary'}`}
                                            disabled={false}
                                            onClick={e => {
                                              e.stopPropagation();
                                              setAssumptions(prev => ({
                                                ...prev,
                                                churnNotApplicable: {
                                                  ...(prev.churnNotApplicable ?? {}),
                                                  [prodKey]: !(prev.churnNotApplicable?.[prodKey]),
                                                },
                                              }));
                                            }}
                                          >
                                            N/A
                                          </button>
                                        </div>

                                        {data.churnNotApplicable?.[prodKey] ? (
                                          <div className="grid grid-cols-12 gap-1.5">
                                            {MONTHS.map((m) => (
                                              <div key={m} className="text-center p-1.5 rounded bg-muted/30">
                                                <p className="text-[9px] text-muted-foreground font-medium">{m}</p>
                                                <span className="block text-xs tabular-nums font-medium text-muted-foreground mt-1">N/A</span>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <>
                                          {/* ═══ Logo Churn Grid ═══ */}
                                          <div className="space-y-1.5">
                                            <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">Logo Churn — {selectedYear}</p>
                                            <div className="grid grid-cols-12 gap-1.5">
                                              {MONTHS.map((m, i) => {
                                                const hist = isHistorical(selectedYear, i);
                                                const hcChurnPeriod = toPeriod(selectedYear, i);
                                                const hcChurnEntry = hist ? historicalData[prodKey]?.[hcChurnPeriod] : undefined;
                                                const churnMonthKey = `${prodKey}::${hcChurnPeriod}`;
                                                const hasClientNames = hcChurnEntry?.client_names && hcChurnEntry.client_names.length > 0;
                                                const isExpandedCell = expandedChurnMonth === churnMonthKey;
                                                const pctVal = churnPctMonthlyArrLC[i];
                                                const logoVal = logoChurnMonthlyLC[i];

                                                return (
                                                  <div
                                                    key={m}
                                                    className={`text-center p-1.5 rounded transition-all ${
                                                      hist
                                                        ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50'
                                                        : 'bg-red-50/50 dark:bg-red-950/15 border border-red-100 dark:border-red-900/30 border-dashed'
                                                    } ${isExpandedCell ? 'ring-2 ring-sky-400' : ''} ${hasClientNames ? 'cursor-pointer hover:ring-1 hover:ring-sky-300' : ''}`}
                                                    onClick={hasClientNames ? (e) => {
                                                      e.stopPropagation();
                                                      setExpandedChurnMonth(prev => prev === churnMonthKey ? null : churnMonthKey);
                                                    } : undefined}
                                                  >
                                                    <p className="text-[9px] text-muted-foreground font-medium leading-tight">
                                                      {m}
                                                      {hist && <span className="ml-0.5 opacity-60">{'\uD83D\uDD12'}</span>}
                                                      {hcChurnEntry && <span className="ml-0.5 text-[7px] text-sky-500 font-bold" title="Dado real da API">API</span>}
                                                    </p>
                                                    <span
                                                      className={`block text-xs tabular-nums font-bold mt-0.5 leading-tight ${hcChurnEntry ? 'text-sky-600' : 'text-red-600 dark:text-red-400'} ${hist && !hasClientNames ? 'cursor-pointer hover:underline' : ''}`}
                                                      onClick={hist && !hasClientNames ? (e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm(`Editar churn historico de ${m}?`)) {
                                                          const val = window.prompt(`${m} — Novo churn (% anual):`, String(Math.round(pctVal * 12 * 100) / 100));
                                                          if (val !== null) {
                                                            const annualRate = Number(val) || 0;
                                                            setAssumptions(prev => {
                                                              const existing = prev.monthlyChurnRates?.[prodKey as TicketKey]?.[selectedYear];
                                                              const arr = existing && Array.isArray(existing) ? [...existing] : Array(12).fill(annualRate);
                                                              arr[i] = annualRate;
                                                              return {
                                                                ...prev,
                                                                monthlyChurnRates: {
                                                                  ...(prev.monthlyChurnRates ?? {}),
                                                                  [prodKey]: { ...((prev.monthlyChurnRates ?? {})[prodKey as TicketKey] ?? {}), [selectedYear]: arr },
                                                                },
                                                              };
                                                            });
                                                          }
                                                        }
                                                      } : undefined}
                                                    >
                                                      {logoVal > 0
                                                        ? <>{logoVal} <span className="text-[9px] font-normal text-muted-foreground">({pctVal}%)</span></>
                                                        : pctVal > 0 ? <span className="text-[10px] opacity-60">{pctVal}%</span> : '\u2014'}
                                                    </span>
                                                    {hasClientNames && (
                                                      <span className="block text-[7px] text-sky-400 mt-0.5 leading-tight">
                                                        {isExpandedCell ? '\u25B2 detalhes' : '\u25BC detalhes'}
                                                      </span>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>

                                            {/* Expanded churn details panel — below Logo Churn grid */}
                                            {expandedChurnMonth?.startsWith(`${prodKey}::`) && (() => {
                                              const expandedPeriod = expandedChurnMonth.split('::')[1];
                                              const expandedMonthIdx = parseInt(expandedPeriod.split('-')[1], 10) - 1;
                                              const expandedMonthName = MONTHS[expandedMonthIdx] ?? expandedPeriod;
                                              const curEntry = historicalData[prodKey]?.[expandedPeriod];
                                              const curNames = curEntry?.client_names ?? [];

                                              let prevPeriod: string;
                                              if (expandedMonthIdx > 0) {
                                                prevPeriod = toPeriod(selectedYear, expandedMonthIdx - 1);
                                              } else {
                                                const prevYr = (selectedYear - 1) as Year;
                                                prevPeriod = toPeriod(prevYr, 11);
                                              }
                                              const prevEntry = historicalData[prodKey]?.[prevPeriod];
                                              const prevNames = prevEntry?.client_names ?? [];

                                              const prevNameSet = new Set(prevNames.map(c => c.name));
                                              const curNameSet = new Set(curNames.map(c => c.name));

                                              const churnedClients = prevNames.filter(c => !curNameSet.has(c.name));
                                              const newClients = curNames.filter(c => !prevNameSet.has(c.name));

                                              return (
                                                <div className="mt-2 p-3 rounded border border-sky-200 bg-sky-50/50 dark:bg-sky-950/20 dark:border-sky-800 text-xs">
                                                  <div className="flex items-center justify-between mb-2">
                                                    <span className="font-semibold text-sky-700 dark:text-sky-300">
                                                      Detalhes de churn — {expandedMonthName}/{selectedYear}
                                                    </span>
                                                    <button
                                                      className="text-[10px] text-muted-foreground hover:text-foreground"
                                                      onClick={() => setExpandedChurnMonth(null)}
                                                    >
                                                      fechar
                                                    </button>
                                                  </div>
                                                  <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                      <p className="font-semibold text-negative mb-1">
                                                        {churnedClients.length} cliente{churnedClients.length !== 1 ? 's' : ''} {churnedClients.length !== 1 ? 'sairam' : 'saiu'}:
                                                      </p>
                                                      {churnedClients.length === 0 ? (
                                                        <p className="text-muted-foreground italic">Nenhum churn</p>
                                                      ) : (
                                                        <ul className="space-y-0.5">
                                                          {churnedClients.map(c => (
                                                            <li key={c.name} className="flex items-center gap-1">
                                                              <span className="text-negative">{'\u274C'}</span>
                                                              <span>{c.name}</span>
                                                              {c.value > 0 && <span className="text-muted-foreground ml-auto">{formatCurrency(c.value)}</span>}
                                                            </li>
                                                          ))}
                                                        </ul>
                                                      )}
                                                    </div>
                                                    <div>
                                                      <p className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                                                        {newClients.length} cliente{newClients.length !== 1 ? 's' : ''} novo{newClients.length !== 1 ? 's' : ''}:
                                                      </p>
                                                      {newClients.length === 0 ? (
                                                        <p className="text-muted-foreground italic">Nenhum novo</p>
                                                      ) : (
                                                        <ul className="space-y-0.5">
                                                          {newClients.map(c => (
                                                            <li key={c.name} className="flex items-center gap-1">
                                                              <span className="text-emerald-500">{'\u2705'}</span>
                                                              <span>{c.name}</span>
                                                              {c.value > 0 && <span className="text-muted-foreground ml-auto">{formatCurrency(c.value)}</span>}
                                                            </li>
                                                          ))}
                                                        </ul>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })()}
                                          </div>
                                          </>
                                        )}

                                        {/* ── Churn base/growth inputs ── */}
                                        {!data.churnNotApplicable?.[prodKey] && (() => {
                                          const storedChurn = data.monthlyChurnRates?.[prodKey]?.[selectedYear];
                                          const currentChurnFlat: number = storedChurn !== undefined
                                            ? (Array.isArray(storedChurn) ? storedChurn[0] ?? 0 : storedChurn)
                                            : Math.round(getChurnMonthly(prodKey, data, selectedYear) * 12 * 100 * 10) / 10;
                                          return (
                                          <>
                                          <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className="text-[10px] text-muted-foreground">Churn base (flat):</span>
                                            <input
                                              type="number"
                                              step="0.1"
                                              className="w-16 bg-secondary border border-border rounded px-2 py-0.5 text-right text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                                              value={currentChurnFlat}
                                              onClick={e => e.stopPropagation()}
                                              onChange={e => {
                                                const val = Number(e.target.value) || 0;
                                                const yearsToApply = YEARS.filter(yr => yr >= selectedYear);
                                                const newArrays: Record<number, number[]> = {};
                                                for (const y of yearsToApply) {
                                                  newArrays[y] = Array(12).fill(val);
                                                }
                                                reprojectWithChurnArrays(prodKey, newArrays);
                                              }}
                                            />
                                            <span className="text-[10px] text-muted-foreground">% a.a.</span>
                                            <span className="text-muted-foreground/30">|</span>
                                            <span className="text-[10px] text-muted-foreground">Crescimento de churn:</span>
                                            <input
                                              type="number"
                                              step="0.5"
                                              className="w-16 bg-secondary border border-border rounded px-2 py-0.5 text-right text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                                              value={rowChurnPct[prodKey] ?? 0}
                                              onClick={e => e.stopPropagation()}
                                              onChange={e => {
                                                const v = e.target.value;
                                                const num = v === '' || v === '-' ? 0 : Number(v);
                                                setRowChurnPctPersist(prev => ({ ...prev, [prodKey]: isNaN(num) ? 0 : num }));
                                              }}
                                              onBlur={() => {
                                                const growthPct = rowChurnPct[prodKey] ?? 0;
                                                const baseVal = currentChurnFlat as number;
                                                const monthlyIncrement = growthPct / 12;
                                                const yearsToApply = YEARS.filter(yr => yr >= selectedYear);
                                                const newMonthlyChurnArrays: Record<number, number[]> = {};
                                                let currentRate = baseVal;
                                                for (const y of yearsToApply) {
                                                  const yearRates: number[] = [];
                                                  for (let m = 0; m < 12; m++) {
                                                    currentRate = Math.max(0, Math.round((currentRate + monthlyIncrement) * 100) / 100);
                                                    yearRates.push(currentRate);
                                                  }
                                                  newMonthlyChurnArrays[y] = yearRates;
                                                }
                                                reprojectWithChurnArrays(prodKey, newMonthlyChurnArrays);
                                              }}
                                              disabled={false}
                                            />
                                            <span className="text-[10px] text-muted-foreground">% a.a.</span>
                                          </div>
                                          <div className="text-[10px] text-muted-foreground mt-1">
                                            Churn por ano: {YEARS.map(yr => {
                                              const stored = data.monthlyChurnRates?.[prodKey]?.[yr];
                                              if (stored !== undefined && Array.isArray(stored)) {
                                                const first = stored[0] ?? 0;
                                                const last = stored[11] ?? stored[stored.length - 1] ?? 0;
                                                return `${yr}: ${first}\u2192${last}%`;
                                              }
                                              const rate = (typeof stored === 'number' ? stored : null)
                                                ?? Math.round(getChurnMonthly(prodKey, data, yr) * 12 * 100 * 10) / 10;
                                              return `${yr}: ${rate}%`;
                                            }).join(' \u00B7 ')}
                                          </div>
                                          </>
                                          );
                                        })()}

                                        {/* ── Logo Churn Summary ── */}
                                        <div className="flex flex-wrap items-center gap-3 text-xs pt-1 border-t border-red-200/50 dark:border-red-900/30 mt-1">
                                          {data.churnNotApplicable?.[prodKey] ? (
                                            <span className="text-muted-foreground italic">Nao se aplica</span>
                                          ) : (
                                            <span className="text-red-600 dark:text-red-400">
                                              Logo: <strong>{totalLogoChurnLC.toLocaleString('pt-BR')}</strong> churns
                                              <span className="text-[10px] opacity-70 ml-0.5">({logoChurnRateAnnualLC.toFixed(1)}% a.a.)</span>
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}

                                  {/* Novos clientes base (flat) — sets flat NEW clients per month */}
                                  {prodKey !== 'saasSetup' && (
                                    <div className="flex items-center gap-2 text-xs pt-1">
                                      <span className="text-muted-foreground">Novos clientes base (flat):</span>
                                      <input
                                        type="number"
                                        className="w-20 bg-secondary border border-border rounded px-2 py-0.5 text-right text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                                        placeholder="—"
                                        onClick={e => e.stopPropagation()}
                                        onChange={e => {
                                          const flatVal = Number(e.target.value);
                                          if (!flatVal || flatVal <= 0) return;
                                          setAssumptions(prev => {
                                            const key = prodKey as TicketKey;
                                            // Set flat NEW clients for non-historical months
                                            const newClientsArr: (number | null)[] = prev.monthlyNewClientOverrides?.[key]?.[selectedYear]
                                              ? [...prev.monthlyNewClientOverrides[key]![selectedYear]!]
                                              : Array(12).fill(null);
                                            const yearFlags = prev.manualMonthlyClientOverrideFlags?.[key]?.[selectedYear]
                                              ? [...prev.manualMonthlyClientOverrideFlags[key]![selectedYear]!]
                                              : Array(12).fill(false);
                                            for (let m = 0; m < 12; m++) {
                                              if (!isHistorical(selectedYear, m)) {
                                                newClientsArr[m] = flatVal;
                                                yearFlags[m] = true;
                                              }
                                            }

                                            // Compute active from new
                                            const prevDecActive = getPrevDecActive(prodKey as SubProductKey, selectedYear, prev);
                                            const activeArr = computeActiveFromNew(prodKey as SubProductKey, selectedYear, newClientsArr, prevDecActive, prev);
                                            const decActive = activeArr[11] ?? 0;

                                            const newSPC = { ...prev.subProductClients, [prodKey]: { ...prev.subProductClients[prodKey as keyof typeof prev.subProductClients], [selectedYear]: Math.round(decActive) } };
                                            const newMO = { ...(prev.monthlyClientOverrides ?? {}), [key]: { ...((prev.monthlyClientOverrides ?? {})[key] ?? {}), [selectedYear]: activeArr } };
                                            const newNCO = { ...(prev.monthlyNewClientOverrides ?? {}), [key]: { ...((prev.monthlyNewClientOverrides ?? {})[key] ?? {}), [selectedYear]: newClientsArr } };
                                            const newMF = { ...(prev.manualMonthlyClientOverrideFlags ?? {}), [key]: { ...((prev.manualMonthlyClientOverrideFlags ?? {})[key] ?? {}), [selectedYear]: yearFlags } };

                                            // Propagate to future years
                                            let lastDecActive = decActive;
                                            let lastNew = flatVal;
                                            for (const fy of YEARS.filter(y => y > selectedYear)) {
                                              const futRate = getGrowthPct(prodKey, fy) / 100;
                                              const futNewArr: (number | null)[] = Array(12).fill(null);
                                              let prevNew = lastNew;
                                              for (let fm = 0; fm < 12; fm++) {
                                                prevNew = Math.max(0, Math.round(prevNew * (1 + futRate)));
                                                futNewArr[fm] = prevNew;
                                              }
                                              const futActiveArr = computeActiveFromNew(prodKey as SubProductKey, fy, futNewArr, lastDecActive, prev);
                                              const futDec = futActiveArr[11] ?? Math.round(lastDecActive);
                                              (newSPC[prodKey as keyof typeof newSPC] as Record<number, number>)[fy] = futDec;
                                              (newMO[key] as Record<number, (number | null)[]>)[fy] = futActiveArr;
                                              (newNCO[key] as Record<number, (number | null)[]>)[fy] = futNewArr;
                                              (newMF[key] as Record<number, boolean[]>)[fy] = Array(12).fill(false);
                                              lastDecActive = futDec;
                                              lastNew = futNewArr[11] ?? prevNew;
                                            }

                                            return { ...prev, subProductClients: newSPC, monthlyClientOverrides: newMO, monthlyNewClientOverrides: newNCO, manualMonthlyClientOverrideFlags: newMF };
                                          });
                                        }}
                                        disabled={false}
                                      />
                                    </div>
                                  )}

                                  {/* Ticket mensal + summary */}
                                  <div className="space-y-2 pt-1">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-1">
                                        <p className="text-xs font-semibold text-muted-foreground">Ticket (R$/mês) — {selectedYear}</p>
                                        <FormulaExplainer explanation={explainTicket(prodKey as FinTicketKey, row.label, selectedYear, data)} iconSize={11} />
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground">Crescimento:</span>
                                         <input
                                          type="number"
                                          step="0.1"
                                          className="w-14 bg-secondary border border-border rounded px-1.5 py-0.5 text-right text-[10px] text-foreground outline-none focus:ring-1 focus:ring-primary"
                                          value={rowTicketGrowthPct[prodKey] ?? 0}
                                          onClick={e => e.stopPropagation()}
                                          onChange={e => setRowTicketGrowthPctPersist(p => ({ ...p, [prodKey]: Number(e.target.value) || 0 }))}
                                          onBlur={() => handleApplyTicketGrowth(prodKey, selectedYear)}
                                          disabled={false}
                                        />
                                        <span className="text-[10px] text-muted-foreground">% a.m.</span>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-12 gap-1.5">
                                      {MONTHS.map((m, i) => {
                                        const hist = isHistorical(selectedYear, i);
                                        const monthTicket = data.monthlyTickets?.[prodKey]?.[selectedYear]?.[i] ?? ticketVal;
                                        const htPeriod = toPeriod(selectedYear, i);
                                        const htEntry = hist ? historicalData[prodKey]?.[htPeriod] : undefined;
                                        const displayTicket = htEntry ? htEntry.avg_ticket : monthTicket;
                                        return (
                                          <div key={m} className={`text-center space-y-1 p-1.5 rounded ${hist ? 'bg-secondary/40' : 'bg-card border border-border/50'}`}>
                                            <p className="text-[9px] text-muted-foreground font-medium">{m}{hist ? ' 🔒' : ''}{htEntry ? <span className="ml-0.5 text-[8px] text-sky-500 font-semibold" title="Dado real da API">API</span> : ''}</p>
                                            {hist ? (
                                              <span
                                                className={`block w-full text-center text-xs tabular-nums font-medium cursor-pointer hover:text-foreground hover:underline transition-colors ${htEntry ? 'text-sky-600' : 'text-muted-foreground'}`}
                                                title={htEntry ? 'Dado real (API)' : 'Clique para editar dado histórico'}
                                                onClick={() => {
                                                  if (window.confirm(`Editar ticket histórico de ${m}?`)) {
                                                    const val = window.prompt(`${m} — Novo ticket (R$):`, String(Math.round(displayTicket)));
                                                    if (val !== null) {
                                                      const src = assumptions;
                                                      const yearArr = src.monthlyTickets?.[prodKey]?.[selectedYear]
                                                        ? [...src.monthlyTickets[prodKey]![selectedYear]!]
                                                        : Array(12).fill(ticketVal);
                                                      yearArr[i] = Number(val) || 0;
                                                      setAssumptions(prev => ({
                                                        ...prev,
                                                        monthlyTickets: { ...(prev.monthlyTickets ?? {}), [prodKey]: { ...((prev.monthlyTickets ?? {})[prodKey] ?? {}), [selectedYear]: yearArr } },
                                                      }));
                                                    }
                                                  }
                                                }}
                                              >
                                                {formatCurrencyFull(displayTicket)}
                                              </span>
                                            ) : (
                                              <MonthlyClientInput
                                                value={monthTicket}
                                                readOnly={false}
                                                className="w-full bg-transparent text-center text-xs tabular-nums font-medium outline-none border-b border-transparent hover:border-primary/30 focus:border-primary transition-colors text-foreground"
                                                onCommit={v => {
                                                  const src = assumptions;
                                                  const currentMonthlyTickets = src.monthlyTickets ?? {};
                                                  const yearArr = currentMonthlyTickets[prodKey]?.[selectedYear]
                                                    ? [...currentMonthlyTickets[prodKey]![selectedYear]!]
                                                    : Array(12).fill(ticketVal);
                                                  yearArr[i] = v;
                                                  if (i < 11) {
                                                    const decTicket = yearArr[11];
                                                    const remainingSteps = 11 - i;
                                                    for (let j = i + 1; j <= 10; j++) {
                                                      const step = j - i;
                                                      if (v > 0 && decTicket > 0) {
                                                        yearArr[j] = Math.round(v * Math.pow(decTicket / v, step / remainingSteps) * 100) / 100;
                                                      } else {
                                                        yearArr[j] = decTicket;
                                                      }
                                                    }
                                                    yearArr[11] = decTicket;
                                                  }
                                                  const updater = (prev: any) => ({
                                                    ...prev,
                                                    monthlyTickets: {
                                                      ...(prev.monthlyTickets ?? {}),
                                                      [prodKey]: {
                                                        ...((prev.monthlyTickets ?? {})[prodKey] ?? {}),
                                                        [selectedYear]: yearArr,
                                                      },
                                                    },
                                                  });
                                                  if (editing) setAssumptions(updater);
                                                  else setAssumptions(updater);
                                                }}
                                              />
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="flex items-center gap-6 text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">Ticket base (flat):</span>
                                        <input
                                          type="number"
                                          className="w-24 bg-secondary border border-border rounded px-2 py-0.5 text-right text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                                          value={ticketVal}
                                          onClick={e => e.stopPropagation()}
                                          onChange={e => directUpdateTicket(Number(e.target.value) || 0)}
                                          disabled={false}
                                        />
                                      </div>
                                      <span className="text-muted-foreground">Total ano: <strong className="text-foreground">{monthly.reduce((s, v) => s + v, 0).toLocaleString('pt-BR')}</strong></span>
                                      <span className="text-muted-foreground">Dez: <strong className="text-foreground">{monthly[11].toLocaleString('pt-BR')}</strong></span>
                                      {(() => {
                                        if (!isProductMrr(prodKey as FinTicketKey)) return null;
                                        const decTicket = data.monthlyTickets?.[prodKey]?.[selectedYear]?.[11] ?? ticketVal;
                                        return <span className="text-muted-foreground">MRR Dez: <strong className="text-foreground">{formatCurrencyFull(monthly[11] * decTicket)}</strong></span>;
                                      })()}
                                    </div>
                                  </div>

                                  {/* ═══ Revenue: Faturamento Base / Incremento / Revenue Churn / Faturamento Total ═══ */}
                                  {(() => {
                                    const hcIsMrr = isProductMrr(prodKey as FinTicketKey);
                                    const isProductNonMrr = !hcIsMrr;
                                    const churnApplicable = !isProductNonMrr && !data.churnNotApplicable?.[prodKey];

                                    // Previous year December data for month 0 base
                                    const prevYrMonthly = selectedYear > 2025
                                      ? getMonthlyClients(prodKey as SubProductKey, (selectedYear - 1) as Year, data.subProductClients, data.tickets, data.monthlyClientOverrides)
                                      : null;
                                    const prevDecPeriod = selectedYear > 2025 ? toPeriod((selectedYear - 1) as Year, 11) : '';
                                    const prevDecApi = selectedYear > 2025 ? historicalData[prodKey]?.[prevDecPeriod] : undefined;

                                    // Determine previous December total revenue for Faturamento Base[0]
                                    let prevMonthTotal = 0;
                                    if (selectedYear > 2025) {
                                      // Try API total_revenue for Dec of previous year
                                      if (prevDecApi && prevDecApi.total_revenue > 0) {
                                        prevMonthTotal = prevDecApi.total_revenue;
                                      } else {
                                        // Engine: Dec clients * Dec ticket
                                        const prevDecClients = prevYrMonthly ? Math.round(prevYrMonthly[11]) : 0;
                                        const prevDecTk = data.monthlyTickets?.[prodKey]?.[(selectedYear - 1) as Year]?.[11] ?? ticketVal;
                                        prevMonthTotal = prevDecClients * prevDecTk;
                                      }
                                    }

                                    // Build arrays for each month
                                    const faturamentoBase: number[] = [];
                                    const incremento: number[] = [];
                                    const revenueChurnArr: number[] = [];
                                    const faturamentoTotal: number[] = [];

                                    for (let i = 0; i < 12; i++) {
                                      const hist = isHistorical(selectedYear, i);
                                      const monthTicket = data.monthlyTickets?.[prodKey]?.[selectedYear]?.[i] ?? ticketVal;
                                      const period = toPeriod(selectedYear, i);
                                      const apiEntry = hist ? historicalData[prodKey]?.[period] : undefined;

                                      // ── Helper: get previous month's client_names map ──
                                      const getPrevClientNamesMap = (): Map<string, number> => {
                                        let prevPeriodStr: string;
                                        if (i > 0) {
                                          prevPeriodStr = toPeriod(selectedYear, i - 1);
                                        } else if (selectedYear > 2025) {
                                          prevPeriodStr = toPeriod((selectedYear - 1) as Year, 11);
                                        } else {
                                          return new Map();
                                        }
                                        const prevEntry = historicalData[prodKey]?.[prevPeriodStr];
                                        return new Map((prevEntry?.client_names || []).map((c: any) => [c.name, c.value ?? 0]));
                                      };

                                      // ── Historical months: API is authoritative ──
                                      // Non-MRR: trust API for any historical month (including total_revenue === 0)
                                      // MRR: still needs total_revenue > 0 + client_names for per-client decomposition
                                      if (hist && apiEntry && (isProductNonMrr || (apiEntry.total_revenue > 0 && apiEntry.client_names))) {
                                        const curNames = new Map((apiEntry.client_names || []).map((c: any) => [c.name, c.value ?? 0]));
                                        const prevNames = getPrevClientNamesMap();

                                        // Faturamento Base = Faturamento Total do mes anterior (only MRR products)
                                        if (isProductNonMrr) {
                                          faturamentoBase.push(0);
                                        } else if (i === 0) {
                                          faturamentoBase.push(prevMonthTotal);
                                        } else {
                                          faturamentoBase.push(faturamentoTotal[i - 1]);
                                        }

                                        // Non-MRR: all revenue is "incremento", no base/churn
                                        if (isProductNonMrr) {
                                          incremento.push(apiEntry.total_revenue);
                                          revenueChurnArr.push(0);
                                        } else {
                                          // Incremento = novos clientes + upsell dos retidos
                                          let incrementoRevenue = 0;
                                          // Novos: clientes deste mes que nao estavam no anterior
                                          for (const [name, value] of curNames) {
                                            if (!prevNames.has(name)) incrementoRevenue += value;
                                          }
                                          // Upsell: clientes retidos que pagam MAIS (diferenca positiva)
                                          for (const [name, prevValue] of prevNames) {
                                            if (curNames.has(name)) {
                                              const curValue = curNames.get(name) ?? 0;
                                              if (curValue > prevValue) {
                                                incrementoRevenue += (curValue - prevValue);
                                              }
                                            }
                                          }
                                          incremento.push(incrementoRevenue);

                                          // Revenue Churn = churned (quem saiu) + downsell (quem pagou menos)
                                          if (churnApplicable) {
                                            let churnRevenue = 0;
                                            // Churned: clientes que sairam (valor que pagavam)
                                            for (const [name, value] of prevNames) {
                                              if (!curNames.has(name)) churnRevenue += value;
                                            }
                                            // Downsell: clientes retidos que pagam MENOS (diferenca negativa)
                                            for (const [name, prevValue] of prevNames) {
                                              if (curNames.has(name)) {
                                                const curValue = curNames.get(name) ?? 0;
                                                if (curValue < prevValue) {
                                                  churnRevenue += (prevValue - curValue);
                                                }
                                              }
                                            }
                                            revenueChurnArr.push(churnRevenue);
                                          } else {
                                            revenueChurnArr.push(0);
                                          }
                                        }

                                        // Faturamento Total = real API value
                                        faturamentoTotal.push(apiEntry.total_revenue);
                                      } else {
                                        // ── Projected / fallback months ──

                                        // Compute newClients — different logic for MRR vs non-MRR.
                                        let newClients = 0;
                                        if (isProductNonMrr) {
                                          // Non-MRR (one-shot): all clients in this month are "new" by definition.
                                          // monthly[i] already contains the correct count (real from Oxy for historical,
                                          // or delta-of-5-MRR for Setup projected).
                                          const storedNew = data.monthlyNewClientOverrides?.[prodKey]?.[selectedYear]?.[i];
                                          newClients = (storedNew !== null && storedNew !== undefined)
                                            ? storedNew
                                            : Math.round(monthly[i]);
                                        } else {
                                          // MRR: compute delta (new entries = activeCur - activePrev + churned)
                                          const storedNew = data.monthlyNewClientOverrides?.[prodKey]?.[selectedYear]?.[i];
                                          let prevClients = 0;
                                          if (i > 0) {
                                            prevClients = monthly[i - 1];
                                          } else if (prevDecApi) {
                                            prevClients = prevDecApi.client_count;
                                          } else if (prevYrMonthly) {
                                            prevClients = Math.round(prevYrMonthly[11]);
                                          }
                                          if (storedNew !== null && storedNew !== undefined) {
                                            newClients = storedNew;
                                          } else {
                                            const activeCur = monthly[i];
                                            const churnRate = getChurnForMonth(prodKey, data, selectedYear, i);
                                            const churned = Math.round(prevClients * churnRate);
                                            newClients = Math.max(0, Math.round(activeCur) - Math.round(prevClients) + churned);
                                          }
                                        }

                                        if (isProductNonMrr) {
                                          // Non-MRR: revenue = all clients × ticket (no base, no churn)
                                          faturamentoBase.push(0);
                                          const monthRevenue = newClients * monthTicket;
                                          incremento.push(monthRevenue);
                                          revenueChurnArr.push(0);
                                          if (hist && apiEntry && apiEntry.total_revenue > 0) {
                                            faturamentoTotal.push(apiEntry.total_revenue);
                                          } else {
                                            faturamentoTotal.push(monthRevenue);
                                          }
                                        } else {
                                          // Line 1: Faturamento Base = previous month's total
                                          if (i === 0) {
                                            faturamentoBase.push(prevMonthTotal);
                                          } else {
                                            faturamentoBase.push(faturamentoTotal[i - 1]);
                                          }

                                          // Line 2: Incremento = new clients × ticket
                                          incremento.push(newClients * monthTicket);

                                          // Line 3: Revenue Churn = churned clients × previous ticket
                                          if (churnApplicable) {
                                            const prevTk = i > 0
                                              ? (data.monthlyTickets?.[prodKey]?.[selectedYear]?.[i - 1] ?? ticketVal)
                                              : (selectedYear > 2025 ? (data.monthlyTickets?.[prodKey]?.[(selectedYear - 1) as Year]?.[11] ?? ticketVal) : ticketVal);
                                            const churnRate = getChurnForMonth(prodKey, data, selectedYear, i);
                                            const logoChurn = Math.round(prevClients * churnRate);
                                            revenueChurnArr.push(logoChurn * prevTk);
                                          } else {
                                            revenueChurnArr.push(0);
                                          }

                                          // Line 4: Faturamento Total = Base + Incremento - Churn
                                          if (hist && apiEntry && apiEntry.total_revenue > 0) {
                                            faturamentoTotal.push(apiEntry.total_revenue);
                                          } else {
                                            faturamentoTotal.push(faturamentoBase[i] + incremento[i] - revenueChurnArr[i]);
                                          }
                                        }
                                      }
                                    }

                                    const totalRevenueChurn = revenueChurnArr.reduce((s, v) => s + v, 0);
                                    const totalRevYear = faturamentoTotal.reduce((s, v) => s + v, 0);
                                    const revenueChurnRateAnnual = totalRevYear > 0 ? (totalRevenueChurn / totalRevYear) * 100 : 0;

                                    return (
                                      <>
                                        {/* ── 1. Faturamento Base (read-only, gray) — only for MRR products ── */}
                                        {!isProductNonMrr && (
                                        <div className="space-y-2 pt-1">
                                          <div className="flex items-center gap-1">
                                            <p className="text-xs font-semibold text-muted-foreground">Faturamento Base — {selectedYear}</p>
                                            <FormulaExplainer explanation={explainFaturamentoBase(prodKey as FinTicketKey, row.label, selectedYear, data)} iconSize={11} />
                                          </div>
                                          <div className="grid grid-cols-12 gap-1.5">
                                            {MONTHS.map((m, i) => {
                                              const hist = isHistorical(selectedYear, i);
                                              return (
                                                <div key={m} className={`text-center space-y-1 p-1.5 rounded ${hist ? 'bg-secondary/40 opacity-60' : 'bg-secondary/20 border border-border/50'}`}>
                                                  <p className="text-[9px] text-muted-foreground font-medium">{m}{hist ? ' \uD83D\uDD12' : ''}</p>
                                                  <span className="block w-full text-center text-xs tabular-nums font-medium text-muted-foreground">
                                                    {formatCurrencyFull(faturamentoBase[i])}
                                                  </span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                          <div className="flex items-center gap-6 text-xs">
                                            <span className="text-muted-foreground">Total ano: <strong className="text-foreground">{formatCurrencyFull(faturamentoBase.reduce((s, v) => s + v, 0))}</strong></span>
                                          </div>
                                        </div>
                                        )}

                                        {/* ── 2. Incremento (editable for projected, green, drill-down for historical) ── */}
                                        <div className="space-y-2 pt-1">
                                          <div className="flex items-center gap-1">
                                            <p className="text-xs font-semibold text-emerald-600">Incremento — {selectedYear}</p>
                                            <FormulaExplainer explanation={explainIncremento(prodKey as FinTicketKey, row.label, selectedYear, data)} iconSize={11} />
                                          </div>
                                          <div className="grid grid-cols-12 gap-1.5">
                                            {MONTHS.map((m, i) => {
                                              const hist = isHistorical(selectedYear, i);
                                              const revPeriod = toPeriod(selectedYear, i);
                                              const revApiEntry = hist ? historicalData[prodKey]?.[revPeriod] : undefined;
                                              const revHasClientNames = revApiEntry?.client_names && revApiEntry.client_names.length > 0;
                                              const revMonthKey = `${prodKey}::${revPeriod}`;
                                              const isRevExpanded = expandedRevenueMonth === revMonthKey;
                                              return (
                                                <div
                                                  key={m}
                                                  className={`text-center space-y-1 p-1.5 rounded ${
                                                    hist
                                                      ? 'bg-emerald-50 dark:bg-emerald-950/20'
                                                      : 'bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/30'
                                                  } ${isRevExpanded ? 'ring-2 ring-emerald-400' : ''} ${revHasClientNames ? 'cursor-pointer hover:ring-1 hover:ring-emerald-300' : ''}`}
                                                  onClick={revHasClientNames ? (e) => {
                                                    e.stopPropagation();
                                                    setExpandedRevenueMonth(prev => prev === revMonthKey ? null : revMonthKey);
                                                  } : undefined}
                                                >
                                                  <p className="text-[9px] text-muted-foreground font-medium">{m}{hist ? ' \uD83D\uDD12' : ''}</p>
                                                  {hist ? (
                                                    <span className="block w-full text-center text-xs tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                                                      {formatCurrencyFull(incremento[i])}
                                                    </span>
                                                  ) : (
                                                    <CurrencyInput
                                                      value={Math.round(incremento[i])}
                                                      disabled={prodKey === 'saasSetup'}
                                                      className="text-emerald-700 dark:text-emerald-400 !text-xs !text-center !px-0.5 !py-0 !border-emerald-200/30"
                                                      onChange={v => {
                                                        // Back-calculate implied new clients from incremental revenue
                                                        const mTicket = data.monthlyTickets?.[prodKey]?.[selectedYear]?.[i] ?? ticketVal;
                                                        const impliedNew = mTicket > 0 ? Math.round(v / mTicket) : 0;
                                                        handleClientChange(prodKey as SubProductKey, selectedYear, i, impliedNew);
                                                      }}
                                                    />
                                                  )}
                                                  {revHasClientNames && (
                                                    <span className="block text-[7px] text-emerald-400 mt-0.5 leading-tight">
                                                      {isRevExpanded ? '\u25B2 detalhes' : '\u25BC detalhes'}
                                                    </span>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>

                                          {/* Expanded new clients details panel — below Incremento grid */}
                                          {expandedRevenueMonth?.startsWith(`${prodKey}::`) && (() => {
                                            const expandedRevPeriod = expandedRevenueMonth.split('::')[1];
                                            const expandedRevMonthIdx = parseInt(expandedRevPeriod.split('-')[1], 10) - 1;
                                            const expandedRevMonthName = MONTHS[expandedRevMonthIdx] ?? expandedRevPeriod;
                                            const curRevEntry = historicalData[prodKey]?.[expandedRevPeriod];
                                            const curRevNames = curRevEntry?.client_names ?? [];

                                            let prevRevPeriod: string;
                                            if (expandedRevMonthIdx > 0) {
                                              prevRevPeriod = toPeriod(selectedYear, expandedRevMonthIdx - 1);
                                            } else {
                                              const prevYrRev = (selectedYear - 1) as Year;
                                              prevRevPeriod = toPeriod(prevYrRev, 11);
                                            }
                                            const prevRevEntry = historicalData[prodKey]?.[prevRevPeriod];
                                            const prevRevNames = prevRevEntry?.client_names ?? [];

                                            const prevRevNameSet = new Set(prevRevNames.map(c => c.name));
                                            const newRevClients = curRevNames.filter(c => !prevRevNameSet.has(c.name));
                                            const newRevTotal = newRevClients.reduce((sum, c) => sum + (c.value || 0), 0);

                                            return (
                                              <div className="mt-2 p-3 rounded border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800 text-xs">
                                                <div className="flex items-center justify-between mb-2">
                                                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                                    {newRevClients.length} novo{newRevClients.length !== 1 ? 's' : ''} cliente{newRevClients.length !== 1 ? 's' : ''}: {expandedRevMonthName}/{selectedYear}
                                                  </span>
                                                  <button
                                                    className="text-[10px] text-muted-foreground hover:text-foreground"
                                                    onClick={(e) => { e.stopPropagation(); setExpandedRevenueMonth(null); }}
                                                  >
                                                    fechar
                                                  </button>
                                                </div>
                                                {newRevClients.length === 0 ? (
                                                  <p className="text-muted-foreground italic">Nenhum cliente novo neste m{'\u00EA'}s</p>
                                                ) : (
                                                  <ul className="space-y-0.5">
                                                    {newRevClients.map(c => (
                                                      <li key={c.name} className="flex items-center gap-1">
                                                        <span className="text-emerald-500">{'\u2705'}</span>
                                                        <span>{c.name}</span>
                                                        <span className="text-muted-foreground ml-auto">{formatCurrency(c.value)}</span>
                                                      </li>
                                                    ))}
                                                  </ul>
                                                )}
                                                <div className="mt-2 pt-1.5 border-t border-emerald-200 dark:border-emerald-800 flex justify-between">
                                                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">Total:</span>
                                                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(newRevTotal)}</span>
                                                </div>
                                              </div>
                                            );
                                          })()}

                                          <div className="flex items-center gap-6 text-xs">
                                            <span className="text-emerald-600">Total ano: <strong>{formatCurrencyFull(incremento.reduce((s, v) => s + v, 0))}</strong></span>
                                          </div>
                                        </div>

                                        {/* ── 3. Revenue Churn (read-only, red, click-to-expand drill-down) ── */}
                                        {churnApplicable && (
                                          <div className="space-y-2 pt-2">
                                            <div className="space-y-1.5">
                                              <div className="flex items-center gap-1">
                                                <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">Revenue Churn — {selectedYear}</p>
                                                <FormulaExplainer explanation={explainRevenueChurn(prodKey as FinTicketKey, row.label, selectedYear, data)} iconSize={11} />
                                              </div>
                                              <div className="grid grid-cols-12 gap-1.5">
                                                {MONTHS.map((m, i) => {
                                                  const hist = isHistorical(selectedYear, i);
                                                  const hcChurnPeriod = toPeriod(selectedYear, i);
                                                  const hcChurnEntry = hist ? historicalData[prodKey]?.[hcChurnPeriod] : undefined;
                                                  const revVal = revenueChurnArr[i];
                                                  const rcMonthKey = `${prodKey}::${hcChurnPeriod}`;
                                                  const rcHasClientNames = hcChurnEntry?.client_names && hcChurnEntry.client_names.length > 0;
                                                  const isRcExpanded = expandedRevChurnMonth === rcMonthKey;

                                                  return (
                                                    <div
                                                      key={m}
                                                      className={`text-center p-1.5 rounded transition-all ${
                                                        hist
                                                          ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50'
                                                          : 'bg-red-50/50 dark:bg-red-950/15 border border-red-100 dark:border-red-900/30 border-dashed'
                                                      } ${isRcExpanded ? 'ring-2 ring-red-400' : ''} ${rcHasClientNames ? 'cursor-pointer hover:ring-1 hover:ring-red-300' : ''}`}
                                                      onClick={rcHasClientNames ? (e) => {
                                                        e.stopPropagation();
                                                        setExpandedRevChurnMonth(prev => prev === rcMonthKey ? null : rcMonthKey);
                                                      } : undefined}
                                                    >
                                                      <p className="text-[9px] text-muted-foreground font-medium leading-tight">
                                                        {m}
                                                        {hist && <span className="ml-0.5 opacity-60">{'\uD83D\uDD12'}</span>}
                                                        {hcChurnEntry && <span className="ml-0.5 text-[7px] text-sky-500 font-bold" title="Dado real da API">API</span>}
                                                      </p>
                                                      <span className={`block text-xs tabular-nums font-bold mt-0.5 leading-tight ${hcChurnEntry ? 'text-sky-600' : 'text-red-600 dark:text-red-400'}`}>
                                                        {revVal > 0
                                                          ? formatCurrency(revVal)
                                                          : '\u2014'}
                                                      </span>
                                                      {rcHasClientNames && (
                                                        <span className="block text-[7px] text-red-400 mt-0.5 leading-tight">
                                                          {isRcExpanded ? '\u25B2 detalhes' : '\u25BC detalhes'}
                                                        </span>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>

                                              {/* Expanded Revenue Churn details panel — below Revenue Churn grid */}
                                              {expandedRevChurnMonth?.startsWith(`${prodKey}::`) && (() => {
                                                const rcExpandedPeriod = expandedRevChurnMonth.split('::')[1];
                                                const rcExpandedMonthIdx = parseInt(rcExpandedPeriod.split('-')[1], 10) - 1;
                                                const rcExpandedMonthName = MONTHS[rcExpandedMonthIdx] ?? rcExpandedPeriod;
                                                const rcCurEntry = historicalData[prodKey]?.[rcExpandedPeriod];
                                                const rcCurNames = rcCurEntry?.client_names ?? [];

                                                let rcPrevPeriod: string;
                                                if (rcExpandedMonthIdx > 0) {
                                                  rcPrevPeriod = toPeriod(selectedYear, rcExpandedMonthIdx - 1);
                                                } else {
                                                  const rcPrevYr = (selectedYear - 1) as Year;
                                                  rcPrevPeriod = toPeriod(rcPrevYr, 11);
                                                }
                                                const rcPrevEntry = historicalData[prodKey]?.[rcPrevPeriod];
                                                const rcPrevNames = rcPrevEntry?.client_names ?? [];

                                                const rcCurNameMap = new Map(rcCurNames.map(c => [c.name, c.value]));
                                                const rcPrevNameMap = new Map(rcPrevNames.map(c => [c.name, c.value]));

                                                // Churned: in M-1 but NOT in M
                                                const rcChurnedClients = rcPrevNames.filter(c => !rcCurNameMap.has(c.name));
                                                const rcChurnedTotal = rcChurnedClients.reduce((sum, c) => sum + (c.value || 0), 0);

                                                // Downsell: in both M-1 and M, but M value < M-1 value
                                                const rcDownsellClients: { name: string; prevValue: number; curValue: number; diff: number }[] = [];
                                                for (const prev of rcPrevNames) {
                                                  if (rcCurNameMap.has(prev.name)) {
                                                    const curVal = rcCurNameMap.get(prev.name) ?? 0;
                                                    if (curVal < prev.value) {
                                                      rcDownsellClients.push({
                                                        name: prev.name,
                                                        prevValue: prev.value,
                                                        curValue: curVal,
                                                        diff: prev.value - curVal,
                                                      });
                                                    }
                                                  }
                                                }
                                                const rcDownsellTotal = rcDownsellClients.reduce((sum, c) => sum + c.diff, 0);
                                                const rcGrandTotal = rcChurnedTotal + rcDownsellTotal;

                                                return (
                                                  <div className="mt-2 p-3 rounded border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800 text-xs">
                                                    <div className="flex items-center justify-between mb-2">
                                                      <span className="font-semibold text-red-700 dark:text-red-300">
                                                        Revenue Churn — {rcExpandedMonthName}/{selectedYear}
                                                      </span>
                                                      <button
                                                        className="text-[10px] text-muted-foreground hover:text-foreground"
                                                        onClick={(e) => { e.stopPropagation(); setExpandedRevChurnMonth(null); }}
                                                      >
                                                        fechar
                                                      </button>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                      {/* Section 1: Churned (sairam) */}
                                                      <div>
                                                        <p className="font-semibold text-red-600 dark:text-red-400 mb-1">
                                                          Churned (sa{'\u00ED'}ram) — {rcChurnedClients.length} cliente{rcChurnedClients.length !== 1 ? 's' : ''}
                                                        </p>
                                                        {rcChurnedClients.length === 0 ? (
                                                          <p className="text-muted-foreground italic">Nenhum churn</p>
                                                        ) : (
                                                          <ul className="space-y-0.5">
                                                            {rcChurnedClients.map(c => (
                                                              <li key={c.name} className="flex items-center gap-1">
                                                                <span className="text-red-500">{'\u274C'}</span>
                                                                <span>{c.name}</span>
                                                                <span className="text-muted-foreground ml-auto">{formatCurrency(c.value)}</span>
                                                              </li>
                                                            ))}
                                                          </ul>
                                                        )}
                                                      </div>
                                                      {/* Section 2: Downsell (reduziram) */}
                                                      <div>
                                                        <p className="font-semibold text-orange-600 dark:text-orange-400 mb-1">
                                                          Downsell (reduziram) — {rcDownsellClients.length} cliente{rcDownsellClients.length !== 1 ? 's' : ''}
                                                        </p>
                                                        {rcDownsellClients.length === 0 ? (
                                                          <p className="text-muted-foreground italic">Nenhum downsell</p>
                                                        ) : (
                                                          <ul className="space-y-0.5">
                                                            {rcDownsellClients.map(c => (
                                                              <li key={c.name} className="flex items-start gap-1">
                                                                <span className="text-orange-500 shrink-0">{'\u2B07\uFE0F'}</span>
                                                                <span className="truncate">{c.name}</span>
                                                                <span className="text-muted-foreground ml-auto whitespace-nowrap">
                                                                  {formatCurrency(c.prevValue)} {'\u2192'} {formatCurrency(c.curValue)}{' '}
                                                                  <span className="text-red-500">(-{formatCurrency(c.diff)})</span>
                                                                </span>
                                                              </li>
                                                            ))}
                                                          </ul>
                                                        )}
                                                      </div>
                                                    </div>
                                                    <div className="mt-2 pt-1.5 border-t border-red-200 dark:border-red-800 flex justify-between">
                                                      <span className="font-semibold text-red-700 dark:text-red-300">Total Revenue Churn:</span>
                                                      <span className="font-semibold text-red-700 dark:text-red-300">{formatCurrency(rcGrandTotal)}</span>
                                                    </div>
                                                    {(rcChurnedClients.length > 0 && rcDownsellClients.length > 0) && (
                                                      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                                                        <span>Churned: {formatCurrency(rcChurnedTotal)} + Downsell: {formatCurrency(rcDownsellTotal)}</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                            </div>

                                            {/* ── Revenue Churn Summary ── */}
                                            <div className="flex flex-wrap items-center gap-3 text-xs pt-1 border-t border-red-200/50 dark:border-red-900/30 mt-1">
                                              <span className="text-red-600 dark:text-red-400">
                                                Revenue Churn: <strong>{formatCurrency(totalRevenueChurn)}</strong>
                                                <span className="text-[10px] opacity-70 ml-0.5">({revenueChurnRateAnnual.toFixed(1)}% a.a.)</span>
                                              </span>
                                            </div>
                                          </div>
                                        )}

                                        {/* ── 4. Faturamento Total (read-only, bold) ── */}
                                        <div className="space-y-2 pt-1">
                                          <p className="text-xs font-bold text-foreground">Faturamento Total — {selectedYear}</p>
                                          <div className="grid grid-cols-12 gap-1.5">
                                            {MONTHS.map((m, i) => {
                                              const hist = isHistorical(selectedYear, i);
                                              return (
                                                <div key={m} className={`text-center space-y-1 p-1.5 rounded ${hist ? 'bg-secondary/40 opacity-60' : 'bg-accent/20 border border-accent/30'}`}>
                                                  <p className="text-[9px] text-muted-foreground font-medium">{m}{hist ? ' \uD83D\uDD12' : ''}</p>
                                                  <span className="block w-full text-center text-xs tabular-nums font-bold text-foreground">
                                                    {formatCurrencyFull(faturamentoTotal[i])}
                                                  </span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                          <div className="flex items-center gap-6 text-xs">
                                            <span className="text-muted-foreground">Total ano: <strong className="text-foreground">{formatCurrencyFull(totalRevYear)}</strong></span>
                                            {hcIsMrr && (
                                              <span className="text-muted-foreground">MRR Dez: <strong className="text-foreground">{formatCurrencyFull(faturamentoTotal[11])}</strong></span>
                                            )}
                                          </div>
                                        </div>
                                      </>
                                    );
                                  })()}

                                </div>
                              </td>
                            </tr>
                            );
                          })()}
                        </React.Fragment>
                      );
                    })}
                    {/* Subtotal da categoria */}
                    <tr className="border-b border-border bg-secondary/20">
                      <td className="p-2 pl-5 text-xs font-bold text-foreground/70">Total {group.group}</td>
                      <td className="text-right p-2 tabular-nums text-xs font-bold text-foreground/70 bg-primary/5">
                        {Math.round(group.items.reduce((sum, row) => {
                          if (!row.dataKey || excludedFromTotal[row.dataKey]) return sum;
                          return sum + getAnnualClientSum(row.dataKey as SubProductKey, selectedYear);
                        }, 0)).toLocaleString('pt-BR')}
                      </td>
                      <td className="text-right p-2 tabular-nums text-xs font-bold text-emerald-600 bg-primary/5">
                        {formatCurrency(group.items.reduce((sum, row) => {
                          if (!row.dataKey || excludedFromTotal[row.dataKey]) return sum;
                          return sum + getAnnualRevenue(row.dataKey as SubProductKey, selectedYear);
                        }, 0))}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}

                {/* Total geral de clientes com filtro interativo */}
                {(() => {
                  const allProducts = CLIENTS_ROWS.flatMap(g => g.items.map(r => ({ ...r, group: g.group })));
                  const included = allProducts.filter(r => r.dataKey && !excludedFromTotal[r.dataKey]);
                  const excluded = allProducts.filter(r => r.dataKey && excludedFromTotal[r.dataKey]);

                  const breakdown = included.map(row => {
                    const somaAno = getAnnualClientSum(row.dataKey as SubProductKey, selectedYear);
                    const receita = getAnnualRevenue(row.dataKey as SubProductKey, selectedYear);
                    // Dez: use API if available, otherwise engine
                    const decPeriod = toPeriod(selectedYear, 11);
                    const decApi = historicalData[row.dataKey!]?.[decPeriod];
                    const decEngine = getMonthlyClients(row.dataKey as SubProductKey, selectedYear, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11];
                    const dez = (decApi && isHistorical(selectedYear, 11)) ? decApi.client_count : Math.round(decEngine);
                    return { label: row.label, group: row.group, key: row.dataKey!, somaAno, dez, receita };
                  });
                  const totalNovos = breakdown.reduce((s, b) => s + b.somaAno, 0);
                  const totalAtivos = breakdown.reduce((s, b) => s + b.dez, 0);
                  const totalReceita = breakdown.reduce((s, b) => s + b.receita, 0);

                  return (
                    <>
                      <tr className="border-t-2 border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => setShowTotalFilter(v => !v)}>
                        <td className="p-3 text-sm font-bold text-foreground">
                          <div className="flex items-center gap-2">
                            {showTotalFilter ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            Total de Clientes (soma no ano)
                          </div>
                          {excluded.length > 0 && (
                            <span className="block text-[9px] font-normal text-muted-foreground mt-0.5 ml-5">
                              Exclui: {excluded.map(r => r.label).join(', ')}
                            </span>
                          )}
                        </td>
                        <td className="text-right p-3 tabular-nums text-sm font-bold text-foreground">{totalNovos.toLocaleString('pt-BR')}</td>
                        <td className="text-right p-3 tabular-nums text-sm font-bold text-emerald-600">{formatCurrency(totalReceita)}</td>
                      </tr>
                      <tr className="bg-primary/10 cursor-pointer hover:bg-primary/15 transition-colors" onClick={() => setShowTotalFilter(v => !v)}>
                        <td className="p-3 text-sm font-bold text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="w-3.5" />
                            Clientes Ativos (Dez {selectedYear})
                          </div>
                        </td>
                        <td className="text-right p-3 tabular-nums text-sm font-bold text-primary">{totalAtivos.toLocaleString('pt-BR')}</td>
                        <td className="text-right p-3 tabular-nums text-sm font-bold text-primary"></td>
                      </tr>
                      {showTotalFilter && (
                        <tr>
                          <td colSpan={3} className="p-0">
                            <div className="bg-card border border-border rounded-lg m-2 p-4 space-y-3">
                              <p className="text-xs font-semibold text-foreground">Selecione os produtos para incluir no calculo:</p>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {allProducts.filter(r => r.dataKey).map(row => {
                                  const isIncluded = !excludedFromTotal[row.dataKey!];
                                  const somaAno = getAnnualClientSum(row.dataKey as SubProductKey, selectedYear);
                                  const decPeriod2 = toPeriod(selectedYear, 11);
                                  const decApi2 = historicalData[row.dataKey!]?.[decPeriod2];
                                  const decEng2 = getMonthlyClients(row.dataKey as SubProductKey, selectedYear, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11];
                                  const dez = (decApi2 && isHistorical(selectedYear, 11)) ? decApi2.client_count : Math.round(decEng2);
                                  return (
                                    <label key={row.dataKey} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${isIncluded ? 'bg-primary/5 border-primary/30' : 'bg-secondary/30 border-border opacity-60'}`}>
                                      <input
                                        type="checkbox"
                                        checked={isIncluded}
                                        onChange={() => setExcludedFromTotal(prev => ({ ...prev, [row.dataKey!]: !prev[row.dataKey!] }))}
                                        className="rounded"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <span className="text-xs font-medium text-foreground block truncate">{row.label}</span>
                                        <span className="text-[9px] text-muted-foreground">{row.group} · Soma: {somaAno.toLocaleString('pt-BR')} · Dez: {dez.toLocaleString('pt-BR')}</span>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                              <div className="border-t border-border pt-2 text-xs text-muted-foreground space-y-1">
                                <p><strong>Soma no ano:</strong> {breakdown.map(b => `${b.label}: ${b.somaAno.toLocaleString('pt-BR')}`).join(' + ')} = <strong className="text-foreground">{totalNovos.toLocaleString('pt-BR')}</strong></p>
                                <p><strong>Ativos Dez:</strong> {breakdown.map(b => `${b.label}: ${b.dez.toLocaleString('pt-BR')}`).join(' + ')} = <strong className="text-primary">{totalAtivos.toLocaleString('pt-BR')}</strong></p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })()}

              </tbody>
            </table>
          </div>




        </TabsContent>

        {/* ─── BLOCO 2: TAX DEDUCTIONS — Lucro Presumido por Subproduto ─── */}
        <TabsContent value="tax" className="space-y-6 mt-4">



          {/* Constantes Globais — Lucro Presumido */}
          <div className="gradient-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Landmark className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Constantes Globais — Lucro Presumido</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'IRPJ alíquota base', value: '15%' },
                { label: 'CSLL alíquota base', value: '9%' },
                { label: 'AD.IRPJ alíquota', value: '10%' },
                { label: 'Limite isenção AD/mês', value: 'R$ 20.000' },
                { label: 'Base presumida', value: '32%' },
              ].map(c => (
                <div key={c.label} className="kpi-card text-center py-2">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{c.label}</p>
                  <p className="text-lg font-bold text-foreground">{c.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">AD.IRPJ:</span> Adicional de 10% sobre a base presumida IRPJ que exceder R$ 20.000/mês — calculado globalmente sobre o consolidado da empresa, não por subcategoria.
            </div>
          </div>

          {/* Matriz por Categoria */}
          {(() => {
            const TAX_CATEGORIES: { id: string; label: string; keys: FinTicketKey[] }[] = [
              { id: 'caas', label: 'CaaS', keys: CAAS_KEYS as FinTicketKey[] },
              { id: 'saas', label: 'SaaS', keys: SAAS_KEYS as FinTicketKey[] },
              { id: 'education', label: 'Education', keys: EDUCATION_KEYS as FinTicketKey[] },
              { id: 'expansao', label: 'Expansão', keys: EXPANSAO_KEYS as FinTicketKey[] },
              { id: 'tax', label: 'Tax', keys: TAX_KEYS as FinTicketKey[] },
            ];
            // Each row: { label, field (if editable), computed (if calculated) }
            // Lucro Presumido: base presumida variável por subproduto (lida do config)
            // IRPJ base: 15%, CSLL base: 9%, Adicional IRPJ: 10% (sobre excedente R$20k/mês)
            const TAX_ROW_DEFS: { label: string; field?: keyof SubProductTaxConfig; computed?: (cfg: SubProductTaxConfig) => number; isTotal?: boolean; isProfile?: boolean }[] = [
              { label: '📋 Perfil Tributário', isProfile: true },
              { label: '2.01  CSLL (retido na fonte) (%)', field: 'csllRetido' },
              { label: '2.02  PIS (retido na fonte) (%)', field: 'pisRetido' },
              { label: '2.03  ISS (%)', field: 'iss' },
              { label: '2.04  PIS (%)', field: 'pis' },
              { label: '2.05  COFINS (%)', field: 'cofins' },
              { label: '2.06  ICMS (%)', field: 'icms' },
              { label: '2.07  IRRF (retido na fonte) (%)', field: 'irrfRetido' },
              { label: '2.08  COFINS (retido na fonte) (%)', field: 'cofinsRetido' },
              { label: 'Base Pres. IRPJ (%)', computed: (cfg) => getEffectivePresumido(cfg).irpj },
              { label: 'Base Pres. CSLL (%)', computed: (cfg) => getEffectivePresumido(cfg).csll },
              { label: 'IRPJ efetivo (%)', computed: (cfg) => getEffectivePresumido(cfg).irpj / 100 * 0.15 * 100 },
              { label: 'CSLL efetivo (%)', computed: (cfg) => getEffectivePresumido(cfg).csll / 100 * 0.09 * 100 },
              { label: 'TOTAL efetivo (sem AD.IRPJ)', computed: (cfg) => {
                const eff = getEffectivePresumido(cfg);
                const effRates = getEffectiveTaxRates(cfg);
                const irpj = eff.irpj / 100 * 0.15 * 100;
                const csll = eff.csll / 100 * 0.09 * 100;
                return effRates.pis + effRates.cofins + effRates.iss + cfg.csllRetido + cfg.pisRetido + effRates.icms + cfg.irrfRetido + cfg.cofinsRetido + irpj + csll;
              }, isTotal: true },
              { label: 'AD.IRPJ (global)', computed: (cfg) => getEffectivePresumido(cfg).irpj / 100 * 0.10 * 100 },
            ];

            const fullLabels: Record<string, string> = {
              caasAssessoria: 'Serviços Especializados', caasEnterprise: 'Enterprise', caasCorporate: 'Corporate', caasParceiros: 'Parceiros', caasSetup: 'BPO Financeiro',
              saasOxy: 'Oxy', saasOxyGenio: 'Oxy+Gênio', saasSetup: 'Setup', saasParceiros: 'Parceiros', saasOxyGenioEsp: 'Oxy+Gênio+Especialista',
              educationDonoCFO: 'Dono CFO', educationEN: 'Eng. Negócios', educationFR: 'Financeiro Raiz', educationFSP: 'FSP',
              baas: 'Oxy Hacker', baasFranquia: 'Franquia', baasMasterFranquia: 'Master Franquia',
              taxAT: 'AT', taxGPT: 'GPT', taxRCT: 'RCT', taxRT: 'RT', taxDTC: 'DTC',
            };

            // Map TicketKey → TAX_PREMISES key for audit tooltips
            const premiseKeyMap: Record<string, string> = {
              caasAssessoria: 'CaaS/Serviços Especializados', caasEnterprise: 'CaaS/Enterprise', caasCorporate: 'CaaS/Corporate',
              caasParceiros: 'CaaS/Parceiros', caasSetup: 'CaaS/BPO Financeiro',
              saasOxy: 'SaaS/Oxy', saasOxyGenio: 'SaaS/Oxy + Gênio', saasSetup: 'SaaS/Setup',
              saasParceiros: 'SaaS/Parceiros', saasOxyGenioEsp: 'SaaS/Oxy + Gênio + Especialista',
              educationDonoCFO: 'Education/Dono CFO', educationEN: 'Education/Engenheiro de Negócios',
              educationFR: 'Education/Financeiro Raiz', educationFSP: 'Education/Finance Sales Program',
              baas: 'Expansão/Oxy Hacker - Micro Franqueado', baasFranquia: 'Expansão/Franquia', baasMasterFranquia: 'Expansão/Master Franquia',
              taxAT: 'Tax/Assessoria Tributária', taxGPT: 'Tax/Gestão Passivo Tributário',
              taxRCT: 'Tax/Recuperação Crédito Tributário', taxRT: 'Tax/Reforma Tributária', taxDTC: 'Tax/Diagnóstico Tributário & Compliance',
            };
            const getPremise = (k: string): TaxPremise | null => TAX_PREMISES[premiseKeyMap[k]] ?? null;

            const getConfig = (key: FinTicketKey): SubProductTaxConfig => {
              return getSubProductTaxRate(key, data as AssumptionsType);
            };

            const updateSubProductTax = (key: FinTicketKey, field: keyof SubProductTaxConfig, val: number) => {
              setAssumptions(prev => {
                const current = getSubProductTaxRate(key, prev as AssumptionsType);
                const updated = { ...current, [field]: val };
                const rates = { ...(prev.subProductTaxRates ?? {}), [key]: updated };
                return { ...prev, subProductTaxRates: rates } as AssumptionsType;
              });
            };

            return (
              <div className="gradient-card p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Lucro Presumido — Alíquotas por Subproduto</h3>
                </div>

                {/* Category filter buttons */}
                <div className="flex flex-wrap gap-2">
                  {TAX_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveTaxCategory(prev => prev === cat.id ? '' : cat.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        activeTaxCategory === cat.id
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-secondary text-secondary-foreground hover:bg-accent'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Filtered tables per active category (or all) */}
                {TAX_CATEGORIES
                  .filter(cat => !activeTaxCategory || activeTaxCategory === cat.id)
                  .map(cat => (
                  <div key={cat.id} className="space-y-2">
                    {!activeTaxCategory && (
                      <h4 className="text-xs font-semibold text-primary mt-2">{cat.label}</h4>
                    )}
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground min-w-[140px]">Dedução</th>
                          {cat.keys.map(k => {
                            const premise = getPremise(k);
                            return (
                              <th key={k} className="text-center py-2 px-2 font-medium text-muted-foreground whitespace-nowrap group relative">
                                <span className="cursor-help" title={premise ? `${premise.perfilAplicado} | Total: ${(premise.totalEfetivo * 100).toFixed(2)}% | ${premise.baseLegal}` : ''}>
                                  {fullLabels[k] ?? k}
                                  {premise && <span className="ml-1 text-[9px] text-primary opacity-60">i</span>}
                                </span>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {TAX_ROW_DEFS.map((rowDef) => {
                          const isEditable = !!rowDef.field;
                          const isTotal = !!rowDef.isTotal;
                          const isProfile = !!rowDef.isProfile;
                          return (
                            <tr key={rowDef.label} className={`border-b border-border/30 ${isTotal ? 'bg-muted/30 font-semibold' : ''}`}>
                              <td className={`py-1.5 px-3 font-medium whitespace-nowrap ${isTotal ? 'text-primary' : 'text-muted-foreground'}`}>
                                {rowDef.label}
                              </td>
                              {cat.keys.map(k => {
                                const cfg = getConfig(k);

                                if (isProfile) {
                                  const currentProfile = cfg.perfilTributario || '';
                                  return (
                                    <td key={k} className="py-1 px-1 text-center">
                                      {editing ? (
                                        <div className="space-y-1">
                                          <select
                                            value={currentProfile}
                                            onChange={e => {
                                              const profileKey = e.target.value;
                                              setAssumptions(prev => {
                                                const current = getSubProductTaxRate(k, prev as AssumptionsType);
                                                const updated = applyTaxProfile(current, profileKey);
                                                const rates = { ...(prev.subProductTaxRates ?? {}), [k]: updated };
                                                return { ...prev, subProductTaxRates: rates };
                                              });
                                            }}
                                            className="w-20 border border-border rounded px-1 py-0.5 text-[10px] text-foreground bg-secondary outline-none focus:ring-1 focus:ring-primary"
                                          >
                                            <option value="">Padrão</option>
                                            {TAX_PROFILE_KEYS.map(pk => (
                                              <option key={pk} value={pk}>{TAX_PROFILES[pk].label}</option>
                                            ))}
                                          </select>
                                          {currentProfile === 'mix' && (
                                            <div className="space-y-1 mt-1">
                                              {getMixTaxSlices(cfg.taxSlices).map((sl: TaxSlice, si: number) => (
                                                <div key={si} className="flex items-center gap-1">
                                                  <select
                                                    value={sl.profileKey}
                                                    onChange={e => {
                                                      setAssumptions(prev => {
                                                        const current = getSubProductTaxRate(k, prev as AssumptionsType);
                                                        const slices = swapOrUpdateMixSliceProfile(current.taxSlices, si, e.target.value);
                                                        const rates = { ...(prev.subProductTaxRates ?? {}), [k]: { ...current, taxSlices: slices, perfilTributario: 'mix', mixServicoPct: undefined } };
                                                        return { ...prev, subProductTaxRates: rates };
                                                      });
                                                    }}
                                                    className="w-16 border border-border rounded px-0.5 py-0.5 text-[9px] bg-secondary text-foreground outline-none"
                                                  >
                                                    {SLICE_PROFILE_KEYS.map(pk => (
                                                      <option key={pk} value={pk}>{TAX_PROFILES[pk].label}</option>
                                                    ))}
                                                  </select>
                                                  <input
                                                    type="number" min="0" max="100" step="5"
                                                    value={sl.pct}
                                                    onChange={e => {
                                                      setAssumptions(prev => {
                                                        const current = getSubProductTaxRate(k, prev as AssumptionsType);
                                                        const slices = updateMixSlicePct(current.taxSlices, si, Number(e.target.value) || 0);
                                                        const rates = { ...(prev.subProductTaxRates ?? {}), [k]: { ...current, taxSlices: slices, perfilTributario: 'mix', mixServicoPct: undefined } };
                                                        return { ...prev, subProductTaxRates: rates };
                                                      });
                                                    }}
                                                    className="w-10 border border-border rounded px-0.5 py-0.5 text-center text-[9px] bg-accent/50 text-foreground outline-none"
                                                  />
                                                  <span className="text-[8px]">%</span>
                                                  {getMixTaxSlices(cfg.taxSlices).length > 1 && (
                                                    <button
                                                      onClick={() => {
                                                        setAssumptions(prev => {
                                                          const current = getSubProductTaxRate(k, prev as AssumptionsType);
                                                          const slices = removeMixTaxSlice(current.taxSlices, si);
                                                          const rates = { ...(prev.subProductTaxRates ?? {}), [k]: { ...current, taxSlices: slices, perfilTributario: 'mix', mixServicoPct: undefined } };
                                                          return { ...prev, subProductTaxRates: rates };
                                                        });
                                                      }}
                                                      className="text-[9px] text-destructive hover:text-destructive/80"
                                                    >✕</button>
                                                  )}
                                                </div>
                                              ))}
                                              <button
                                                onClick={() => {
                                                  setAssumptions(prev => {
                                                    const current = getSubProductTaxRate(k, prev as AssumptionsType);
                                                    const slices = addMixTaxSlice(current.taxSlices);
                                                    const rates = { ...(prev.subProductTaxRates ?? {}), [k]: { ...current, taxSlices: slices, perfilTributario: 'mix', mixServicoPct: undefined } };
                                                    return { ...prev, subProductTaxRates: rates };
                                                  });
                                                }}
                                                className="text-[9px] text-primary font-semibold"
                                              >+ Fatia</button>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-[10px] tabular-nums text-muted-foreground">
                                          {currentProfile ? (
                                            <>
                                              {TAX_PROFILES[currentProfile]?.label || currentProfile}
                                              {currentProfile === 'mix' && cfg.taxSlices?.length && (
                                                <span className="ml-1 text-primary font-semibold text-[8px]">
                                                  {cfg.taxSlices.map(s => `${TAX_PROFILES[s.profileKey]?.label || s.profileKey} ${s.pct}%`).join(' + ')}
                                                </span>
                                              )}
                                            </>
                                          ) : '—'}
                                        </span>
                                      )}
                                    </td>
                                  );
                                }

                                if (isEditable && rowDef.field) {
                                  const effRates = getEffectiveTaxRates(cfg);
                                  const isMixDerivedField = cfg.perfilTributario === 'mix' && ['pis', 'cofins', 'iss', 'icms'].includes(rowDef.field);
                                  const cellValue = isMixDerivedField
                                    ? effRates[rowDef.field as 'pis' | 'cofins' | 'iss' | 'icms']
                                    : cfg[rowDef.field] as number | undefined;
                                  const isLocked = (cfg.perfilTributario && cfg.perfilTributario !== 'custom' && cfg.perfilTributario !== 'mix') || isMixDerivedField;
                                  return (
                                    <td key={k} className="py-1 px-1 text-center">
                                      {editing && !isLocked ? (
                                        <input
                                          type="number"
                                          step="0.1"
                                          min="0"
                                          max="100"
                                          placeholder="0"
                                          className="w-16 border border-border rounded px-1.5 py-0.5 text-center text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary bg-secondary"
                                          value={cellValue ?? 0}
                                          onChange={e => updateSubProductTax(k, rowDef.field!, Number(e.target.value) || 0)}
                                        />
                                      ) : (
                                        <span className={`text-xs tabular-nums ${isLocked ? 'text-muted-foreground/60' : ''}`}>
                                          {`${(cellValue ?? 0).toFixed(2).replace('.', ',')}%`}
                                        </span>
                                      )}
                                    </td>
                                  );
                                }

                                const cellValue = rowDef.computed!(cfg);
                                return (
                                  <td key={k} className={`py-1.5 px-2 text-center tabular-nums ${isTotal ? 'text-primary' : 'text-muted-foreground'}`}>
                                    <div className="flex items-center justify-center gap-0.5">
                                      {cellValue.toFixed(2).replace('.', ',')}%
                                      {isTotal && <FormulaExplainer explanation={explainTaxEffective(k, fullLabels[k] ?? k, data as AssumptionsType)} iconSize={10} />}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
                <div className="flex items-start gap-2 mt-3 text-[11px] text-muted-foreground">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>Lucro Presumido — base presumida editável por subproduto (padrão 32% para serviço). Deduções sobre Receita Bruta: PIS 0,65% + COFINS 3% + ISS (SaaS 2,9% | Education 2% | demais 5%). IRPJ efetivo = base × 15%. CSLL efetivo = base × 9%. AD.IRPJ = 10% sobre base presumida IRPJ excedente a R$20.000/mês (calculado globalmente). Tributos incidem independente de lucro ou prejuízo.</span>
                </div>
              </div>
            );
          })()}

        </TabsContent>

        {/* ─── BLOCO 3: COS (Cost of Service) ─── */}
        <TabsContent value="cos" className="space-y-6 mt-4">

          {(() => {
            const data = assumptions;
            const cos = data.cosConfig ?? DEFAULT_COS_CONFIG;

            const updateCos = (field: keyof CosConfig, val: number) => {
              const newCos = { ...cos, [field]: val };
              if (editing) {
                setAssumptions(prev => ({ ...prev, cosConfig: newCos }));
              } else {
                setAssumptions(prev => ({ ...prev, cosConfig: newCos }));
              }
            };

            // Compute yearly impact
            const yearImpact = activeYears.map(y => {
              const yr = model.years[y];
              const caasEnd = data.caasClients[y] ?? 0;

              // 3.1 CaaS
              const numPFD = Math.max(1, Math.ceil(caasEnd / Math.max(1, cos.pfdClientsPerOne)));
              const numCFO = Math.max(1, Math.ceil(caasEnd / Math.max(1, cos.cfoClientsPerOne)));
              const numFPA = Math.max(1, Math.ceil(caasEnd / Math.max(1, cos.fpaClientsPerOne)));
              const caasCost = (numPFD * cos.pfdSalary + numCFO * cos.cfoSalary + numFPA * cos.fpaSalary);

              // 3.2 SaaS assinatura
              const saasSubEnd = (data.subProductClients.saasOxy?.[y] ?? 0)
                + (data.subProductClients.saasOxyGenio?.[y] ?? 0);
              const numDevSr = Math.max(0, Math.ceil(saasSubEnd / Math.max(1, cos.devSrClientsPerOne)));
              const numCSSaaS = Math.max(0, Math.ceil(saasSubEnd / Math.max(1, cos.csClientsPerOne)));
              const saasSubCost = numDevSr * cos.devSrSalary + numCSSaaS * cos.csSaaSalary;

              // Setup — novos clientes/mês
              const prevSaasSub = y > 2025
                ? (data.subProductClients.saasOxy?.[(y - 1) as Year] ?? 0)
                  + (data.subProductClients.saasOxyGenio?.[(y - 1) as Year] ?? 0)
                : 0;
              const prevCaasEntCorp = y > 2025
                ? (data.subProductClients.caasEnterprise?.[(y - 1) as Year] ?? 0)
                  + (data.subProductClients.caasCorporate?.[(y - 1) as Year] ?? 0)
                : 0;
              const caasEntCorpEnd = (data.subProductClients.caasEnterprise?.[y] ?? 0)
                + (data.subProductClients.caasCorporate?.[y] ?? 0);
              const newPerMonth = Math.max(0, ((saasSubEnd - prevSaasSub) + (caasEntCorpEnd - prevCaasEntCorp)) / 12);
              const numSetupSquads = newPerMonth > 0 ? Math.max(1, Math.ceil(newPerMonth / Math.max(1, cos.setupClientsPerSquad))) : 0;
              const numHeadData = newPerMonth > 0 ? Math.max(1, Math.ceil(newPerMonth / Math.max(1, cos.headDataClientsPerOne))) : 0;
              const setupCost = numSetupSquads * (cos.dataAnalystPerSquad * cos.dataAnalystSalary + cos.processAnalystPerSquad * cos.processAnalystSalary)
                + numHeadData * cos.headDataSalary;

              // 3.3 Education
              const eduRev = yr.educationRevenue;
              const eduCost = Math.abs(eduRev) * cos.eduCostRate;

              // 3.4 Customer Success
              const numCX = Math.max(0, Math.ceil(caasEnd / Math.max(1, cos.cxAnalystClientsPerOne)));
              const csCost = numCX * cos.cxAnalystSalary;

              // 3.5 Expansão
              const expansaoRev = yr.baasRevenue;
              const expansaoCost = Math.abs(expansaoRev) * cos.expansaoCostRate;

              // 3.6 Tax
              const taxRev = yr.taxRevenue;
              const taxCost = Math.abs(taxRev) * cos.taxCostRate;

              const totalMonthly = caasCost + saasSubCost + setupCost + csCost;
              const totalPercentage = eduCost + expansaoCost + taxCost;
              const grandTotal = totalMonthly * 12 + totalPercentage;
              const pctRev = yr.grossRevenue > 0 ? (grandTotal / 1000 / yr.grossRevenue * 100) : 0;

              return {
                year: y, caasEnd, numPFD, numCFO, numFPA, caasCost,
                saasSubEnd, numDevSr, numCSSaaS, saasSubCost,
                newPerMonth: Math.round(newPerMonth), numSetupSquads, numHeadData, setupCost,
                eduCost, numCX, csCost, expansaoCost, taxCost,
                totalMonthly, totalPercentage, grandTotal, pctRev,
              };
            });

            const inputCls = "w-full bg-card border border-border rounded px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary";

            return (
              <>
                {/* 3.1 Custos CaaS */}
                <div className="gradient-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">3.1</span>
                    <h3 className="text-sm font-semibold">Custos CaaS — Squad por Clientes</h3>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Squad = 1 CFO + 2 FP&A Analysts. Project Finance Director supervisiona ~6-7 squads (100 clientes).</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-foreground/80 uppercase tracking-wide">Project Finance Director</p>
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-muted-foreground">1 a cada N clientes CaaS</label>
                        <input type="number" className={inputCls} value={cos.pfdClientsPerOne} disabled={false} onChange={e => updateCos('pfdClientsPerOne', Number(e.target.value) || 1)} />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-muted-foreground">Salário (R$/mês)</label>
                        <CurrencyInput value={cos.pfdSalary} disabled={false} onChange={v => updateCos('pfdSalary', v)} />
                      </div>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-foreground/80 uppercase tracking-wide">CFO</p>
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-muted-foreground">1 a cada N clientes CaaS</label>
                        <input type="number" step="0.5" className={inputCls} value={cos.cfoClientsPerOne} disabled={false} onChange={e => updateCos('cfoClientsPerOne', Number(e.target.value) || 1)} />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-muted-foreground">Salário (R$/mês)</label>
                        <CurrencyInput value={cos.cfoSalary} disabled={false} onChange={v => updateCos('cfoSalary', v)} />
                      </div>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-foreground/80 uppercase tracking-wide">FP&A Analyst</p>
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-muted-foreground">1 a cada N clientes CaaS</label>
                        <input type="number" step="0.5" className={inputCls} value={cos.fpaClientsPerOne} disabled={false} onChange={e => updateCos('fpaClientsPerOne', Number(e.target.value) || 1)} />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] text-muted-foreground">Salário (R$/mês)</label>
                        <CurrencyInput value={cos.fpaSalary} disabled={false} onChange={v => updateCos('fpaSalary', v)} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3.2 Custos SaaS */}
                <div className="gradient-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">3.2</span>
                    <h3 className="text-sm font-semibold">Custos SaaS — Equipe + Setup</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Assinatura */}
                    <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-foreground/80 uppercase tracking-wide">SAAS ASSINATURAS (Oxy + Oxy+Gênio + Esp.)</p>
                      <p className="text-[9px] text-muted-foreground">Headcount escala com base ativa de assinantes</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Dev Senior — 1 a cada N clientes</label>
                          <input type="number" className={inputCls} value={cos.devSrClientsPerOne} disabled={false} onChange={e => updateCos('devSrClientsPerOne', Number(e.target.value) || 1)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Dev Senior (R$/mês)</label>
                          <CurrencyInput value={cos.devSrSalary} disabled={false} onChange={v => updateCos('devSrSalary', v)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Customer Success — 1 a cada N clientes</label>
                          <input type="number" className={inputCls} value={cos.csClientsPerOne} disabled={false} onChange={e => updateCos('csClientsPerOne', Number(e.target.value) || 1)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">CS (R$/mês)</label>
                          <CurrencyInput value={cos.csSaaSalary} disabled={false} onChange={v => updateCos('csSaaSalary', v)} />
                        </div>
                      </div>
                    </div>
                    {/* Setup */}
                    <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-foreground/80 uppercase tracking-wide">SETUP (1.2.3)</p>
                      <p className="text-[9px] text-muted-foreground">Novos = CaaS Enterprise + Corporate + SaaS Assinaturas. Não acumula.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Novos clientes / squad</label>
                          <input type="number" className={inputCls} value={cos.setupClientsPerSquad} disabled={false} onChange={e => updateCos('setupClientsPerSquad', Number(e.target.value) || 1)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Data Analysts / squad</label>
                          <input type="number" className={inputCls} value={cos.dataAnalystPerSquad} disabled={false} onChange={e => updateCos('dataAnalystPerSquad', Number(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Data Analyst (R$/mês)</label>
                          <CurrencyInput value={cos.dataAnalystSalary} disabled={false} onChange={v => updateCos('dataAnalystSalary', v)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Process Analysts / squad</label>
                          <input type="number" className={inputCls} value={cos.processAnalystPerSquad} disabled={false} onChange={e => updateCos('processAnalystPerSquad', Number(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Process Analyst (R$/mês)</label>
                          <CurrencyInput value={cos.processAnalystSalary} disabled={false} onChange={v => updateCos('processAnalystSalary', v)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Head of Data — 1 a cada N novos/mês</label>
                          <input type="number" className={inputCls} value={cos.headDataClientsPerOne} disabled={false} onChange={e => updateCos('headDataClientsPerOne', Number(e.target.value) || 1)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Head of Data (R$/mês)</label>
                          <CurrencyInput value={cos.headDataSalary} disabled={false} onChange={v => updateCos('headDataSalary', v)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3.3, 3.5, 3.6 — % da Receita Bruta */}
                <div className="gradient-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">3.3 / 3.5 / 3.6</span>
                    <h3 className="text-sm font-semibold">Custos Percentuais da Receita Bruta</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-foreground/80 uppercase tracking-wide">3.3 Education</p>
                      <div className="flex items-center gap-2">
                        <input type="number" step="1" min="0" max="100" className="w-16 bg-card border border-border rounded px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary" value={Math.round(cos.eduCostRate * 100)} disabled={false} onChange={e => updateCos('eduCostRate', (Number(e.target.value) || 0) / 100)} />
                        <span className="text-xs text-muted-foreground">% da receita bruta</span>
                      </div>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-foreground/80 uppercase tracking-wide">3.5 Expansão</p>
                      <div className="flex items-center gap-2">
                        <input type="number" step="1" min="0" max="100" className="w-16 bg-card border border-border rounded px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary" value={Math.round(cos.expansaoCostRate * 100)} disabled={false} onChange={e => updateCos('expansaoCostRate', (Number(e.target.value) || 0) / 100)} />
                        <span className="text-xs text-muted-foreground">% da receita bruta</span>
                      </div>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-foreground/80 uppercase tracking-wide">3.6 Tax</p>
                      <div className="flex items-center gap-2">
                        <input type="number" step="1" min="0" max="100" className="w-16 bg-card border border-border rounded px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary" value={Math.round(cos.taxCostRate * 100)} disabled={false} onChange={e => updateCos('taxCostRate', (Number(e.target.value) || 0) / 100)} />
                        <span className="text-xs text-muted-foreground">% da receita bruta</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3.4 Customer Success */}
                <div className="gradient-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">3.4</span>
                    <h3 className="text-sm font-semibold">Custos Customer Success</h3>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5 max-w-xs">
                    <p className="text-[10px] font-bold text-foreground/80 uppercase tracking-wide">Customer Experience Analyst</p>
                    <div className="space-y-0.5">
                      <label className="text-[9px] text-muted-foreground">1 a cada N clientes CaaS</label>
                      <input type="number" className={inputCls} value={cos.cxAnalystClientsPerOne} disabled={false} onChange={e => updateCos('cxAnalystClientsPerOne', Number(e.target.value) || 1)} />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[9px] text-muted-foreground">Salário (R$/mês)</label>
                      <CurrencyInput value={cos.cxAnalystSalary} disabled={false} onChange={v => updateCos('cxAnalystSalary', v)} />
                    </div>
                  </div>
                </div>

                {/* Impacto por Ano */}
                <div className="gradient-card p-5 space-y-3">
                  <h3 className="text-sm font-semibold">Impacto COS por Ano</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-2 py-2 text-muted-foreground font-medium">Ano</th>
                          <th className="text-right px-2 py-2 text-muted-foreground font-medium">3.1 CaaS</th>
                          <th className="text-right px-2 py-2 text-muted-foreground font-medium">3.2 SaaS</th>
                          <th className="text-right px-2 py-2 text-muted-foreground font-medium">3.2 Setup</th>
                          <th className="text-right px-2 py-2 text-muted-foreground font-medium">3.3 Education</th>
                          <th className="text-right px-2 py-2 text-muted-foreground font-medium">3.4 CS</th>
                          <th className="text-right px-2 py-2 text-muted-foreground font-medium">3.5 Expansão</th>
                          <th className="text-right px-2 py-2 text-muted-foreground font-medium">3.6 Tax</th>
                          <th className="text-right px-2 py-2 text-muted-foreground font-medium">Total/Ano</th>
                          <th className="text-right px-2 py-2 text-muted-foreground font-medium">% Receita</th>
                        </tr>
                      </thead>
                      <tbody>
                        {yearImpact.map(yi => (
                          <tr key={yi.year} className={`border-b border-border/30 hover:bg-secondary/20 ${yi.year === selectedYear ? 'bg-primary/5' : ''}`}>
                            <td className="px-2 py-2 font-medium">{yi.year}</td>
                            <td className="text-right px-2 py-2 tabular-nums">
                              <div className="flex items-center justify-end gap-0.5">
                                {formatCurrency(yi.caasCost * 12)}
                                {yi.year === selectedYear && <FormulaExplainer explanation={explainCOS('caas', yi.year, data, model)} iconSize={10} />}
                              </div>
                            </td>
                            <td className="text-right px-2 py-2 tabular-nums">{formatCurrency(yi.saasSubCost * 12)}</td>
                            <td className="text-right px-2 py-2 tabular-nums">{formatCurrency(yi.setupCost * 12)}</td>
                            <td className="text-right px-2 py-2 tabular-nums">
                              <div className="flex items-center justify-end gap-0.5">
                                {formatCurrency(yi.eduCost)}
                                {yi.year === selectedYear && <FormulaExplainer explanation={explainCOS('education', yi.year, data, model)} iconSize={10} />}
                              </div>
                            </td>
                            <td className="text-right px-2 py-2 tabular-nums">{formatCurrency(yi.csCost * 12)}</td>
                            <td className="text-right px-2 py-2 tabular-nums">
                              <div className="flex items-center justify-end gap-0.5">
                                {formatCurrency(yi.expansaoCost)}
                                {yi.year === selectedYear && <FormulaExplainer explanation={explainCOS('expansao', yi.year, data, model)} iconSize={10} />}
                              </div>
                            </td>
                            <td className="text-right px-2 py-2 tabular-nums">
                              <div className="flex items-center justify-end gap-0.5">
                                {formatCurrency(yi.taxCost)}
                                {yi.year === selectedYear && <FormulaExplainer explanation={explainCOS('tax', yi.year, data, model)} iconSize={10} />}
                              </div>
                            </td>
                            <td className="text-right px-2 py-2 tabular-nums font-medium">{formatCurrency(yi.grandTotal)}</td>
                            <td className="text-right px-2 py-2 tabular-nums">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                yi.pctRev > 25 ? 'bg-destructive/15 text-destructive' :
                                yi.pctRev > 15 ? 'bg-amber-500/15 text-amber-500' :
                                'bg-emerald-500/15 text-emerald-500'
                              }`}>{yi.pctRev.toFixed(1)}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>Custos CaaS/SaaS/CS = headcount mensal × 12. Education/Expansão/Tax = % aplicado sobre receita bruta anual.</span>
                  </div>
                </div>
              </>
            );
          })()}

        </TabsContent>
        <TabsContent value="sga" className="space-y-6 mt-4">

          {/* Marketing Planejado vs Realizado */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-sm font-semibold">Marketing — Planejado vs Realizado</h3>
            <div className="flex bg-secondary rounded-lg p-0.5 border border-border">
              {(['planned', 'actual'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setMarketingView(v)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${
                    marketingView === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {v === 'planned' ? 'Planejado' : 'Realizado'}
                </button>
              ))}
            </div>
          </div>

          {marketingView === 'actual' && (() => {
            const isHistPeriod = (monthIdx: number) => isHistorical(selectedYear, monthIdx);
            const mkRows: { label: string; key: string; isSummary?: boolean }[] = [
              { label: 'Despesas de Marketing', key: 'Despesas de Marketing', isSummary: true },
              { label: 'Despesas Comerciais', key: 'Despesas Comerciais' },
            ];
            const getHistVal = (key: string, monthIdx: number): number => {
              const period = `${selectedYear}-${String(monthIdx + 1).padStart(2, '0')}`;
              return historicalExpenses[key]?.[period] ?? 0;
            };
            const getAnnual = (key: string): number =>
              MONTHS.reduce((s, _, i) => s + getHistVal(key, i), 0);
            const statusBadge = selectedYear <= 2025
              ? <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Realizado</span>
              : selectedYear === 2026
              ? <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Jan–Mar Realizado</span>
              : <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">Projetado</span>;

            return (
              <div className="gradient-card overflow-x-auto">
                <h3 className="text-sm font-semibold p-5 pb-3 flex items-center flex-wrap gap-1">
                  Gastos de Marketing — {selectedYear}
                  {statusBadge}
                </h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="sticky left-0 z-10 bg-card text-left px-4 py-2 text-muted-foreground font-medium min-w-[200px]">Linha</th>
                      {MONTHS.map((m, i) => (
                        <th key={m} className={`text-right px-2 py-2 text-muted-foreground font-medium min-w-[72px]${selectedYear === 2026 && i === 2 ? ' border-r border-primary/30' : ''}`}>{m}</th>
                      ))}
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium min-w-[88px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mkRows.map(row => (
                      <tr key={row.key} className={`border-b border-border/20 transition-colors ${row.isSummary ? 'bg-secondary/40 hover:bg-secondary/60 font-semibold' : 'hover:bg-secondary/20'}`}>
                        <td className={`sticky left-0 z-10 px-4 py-1.5 font-medium ${row.isSummary ? 'bg-secondary/40' : 'bg-card'}`}>{row.label}</td>
                        {MONTHS.map((_, i) => {
                          const val = getHistVal(row.key, i);
                          const isHist = isHistPeriod(i);
                          const isCutoffBorder = selectedYear === 2026 && i === 2;
                          return (
                            <td key={i} className={`text-right px-2 py-1.5 tabular-nums${isCutoffBorder ? ' border-r border-primary/30' : ''}${!isHist ? ' text-muted-foreground/60 italic' : ''}`}>
                              {!isHist && val === 0 ? '—' : formatCurrency(val)}
                            </td>
                          );
                        })}
                        <td className="text-right px-3 py-1.5 tabular-nums font-medium">{formatCurrency(getAnnual(row.key))}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-border bg-primary/5 font-bold">
                      <td className="sticky left-0 z-10 bg-primary/5 px-4 py-2">TOTAL MARKETING</td>
                      {MONTHS.map((_, i) => {
                        const val = mkRows.reduce((s, r) => s + getHistVal(r.key, i), 0);
                        const isHist = isHistPeriod(i);
                        const isCutoffBorder = selectedYear === 2026 && i === 2;
                        return (
                          <td key={i} className={`text-right px-2 py-2 tabular-nums${isCutoffBorder ? ' border-r border-primary/30' : ''}${!isHist ? ' text-muted-foreground/60 italic' : ''}`}>
                            {formatCurrency(val)}
                          </td>
                        );
                      })}
                      <td className="text-right px-3 py-2 tabular-nums">{formatCurrency(mkRows.reduce((s, r) => s + getAnnual(r.key), 0))}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-[10px] text-muted-foreground p-3 pt-1">
                  Fonte: Oxy DB — dados reais de despesas de marketing e comerciais extraídos do sistema financeiro.
                </p>
              </div>
            );
          })()}

          {/* PR e Eventos Marketing */}
          <div className="gradient-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">PR e Eventos Marketing (custo mensal)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-muted-foreground whitespace-nowrap min-w-[120px]">Assessoria de Imprensa (R$/mês)</label>
                <input type="number" className="w-32 bg-secondary border border-border rounded px-2 py-1 text-right text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                  value={data.marketingPR ?? 0}
                  onChange={e => {
                    const v = Number(e.target.value) || 0;
                    setAssumptions(prev => ({ ...prev, marketingPR: v }));
                  }}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-muted-foreground whitespace-nowrap min-w-[120px]">Eventos & Patrocínios (R$/mês)</label>
                <input type="number" className="w-32 bg-secondary border border-border rounded px-2 py-1 text-right text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                  value={data.marketingEvents ?? 0}
                  onChange={e => {
                    const v = Number(e.target.value) || 0;
                    setAssumptions(prev => ({ ...prev, marketingEvents: v }));
                  }}
                />
              </div>
            </div>
          </div>

          {/* CAC por Produto */}
          <div className="gradient-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">CAC por Produto</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2 text-muted-foreground font-medium">Produto</th>
                    <th className="text-right px-3 py-2 text-muted-foreground font-medium">CAC (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(data.tickets) as TicketKey[]).map(key => (
                    <tr key={key} className="border-b border-border/30 hover:bg-secondary/20">
                      <td className="px-3 py-2 text-xs">{SUB_PRODUCT_LABELS[key as keyof typeof SUB_PRODUCT_LABELS] || key}</td>
                      <td className="text-right px-3 py-2">
                        <input type="number" className="w-28 bg-secondary border border-border rounded px-2 py-1 text-right text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                          value={data.cacPerProduct?.[key] ?? 0}
                          onChange={e => {
                            const v = Number(e.target.value) || 0;
                            const newCac = { ...(data.cacPerProduct ?? {}), [key]: v };
                            setAssumptions(prev => ({ ...prev, cacPerProduct: newCac }));
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Comissão e SG&A */}
          <div className="gradient-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Comissão e SG&A</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Comissão de Vendas</p>
                <p className="text-sm font-semibold">{(commissionRate.caas * 100).toFixed(0)}% da receita bruta</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">SG&A % of Revenue</p>
                <div className="text-sm font-semibold">
                  {editing ? (
                    <input type="number" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                      value={data.sgaPercent} onChange={e => setAssumptions(p => ({ ...p, sgaPercent: Number(e.target.value) || 0 }))} />
                  ) : <span>{data.sgaPercent}%</span>}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">SG&A Annual Growth %</p>
                <div className="text-sm font-semibold">
                  {editing ? (
                    <input type="number" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                      value={data.sgaGrowthRate} onChange={e => setAssumptions(p => ({ ...p, sgaGrowthRate: Number(e.target.value) || 0 }))} />
                  ) : <span>{data.sgaGrowthRate}%</span>}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Headcount Cost Growth/yr</p>
                <div className="text-sm font-semibold">
                  {editing ? (
                    <input type="number" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                      value={data.headcountGrowth} onChange={e => setAssumptions(p => ({ ...p, headcountGrowth: Number(e.target.value) || 0 }))} />
                  ) : <span>{data.headcountGrowth}%</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Resumo Operacional Mensal */}
          {(() => {
            const isHistPeriod = (monthIdx: number) => isHistorical(selectedYear, monthIdx);
            const getFinancialCatValue = (catCode: string, period: string): number => {
              const cat = historicalFinancial[catCode];
              if (!cat) return 0;
              let sum = 0;
              for (const group of Object.values(cat)) {
                for (const item of Object.values(group as Record<string, Record<string, number>>)) {
                  sum += (item[period] ?? 0);
                }
              }
              return sum;
            };
            const getProjected = (engineCode: string): number => {
              const node = findNodeInTree(engineCode, model.pnlTree);
              if (!node) return 0;
              return Math.abs(node.annual[selectedYear] ?? 0) * 1000 / 12;
            };
            const getProjectedDespesasFixas = (): number => {
              const codes = ['4', '5', '6', '7'];
              return codes.reduce((sum, c) => {
                const node = findNodeInTree(c, model.pnlTree);
                return sum + (node ? Math.abs(node.annual[selectedYear] ?? 0) * 1000 / 12 : 0);
              }, 0);
            };
            const getProjectedFinanceiras = (): number => getProjected('8D');
            const getProjectedProvisoes = (): number => getProjected('TAX');
            const getProjectedAmortizacao = (): number => getProjected('11');
            const getProjectedInvestimentos = (): number => getProjected('12');

            type OpRow = {
              label: string;
              indent?: boolean;
              isSummary?: boolean;
              groupKey?: string;
              getHistValue: (period: string) => number;
              getProjValue: () => number;
            };

            const rows: OpRow[] = [
              { label: 'Custos Variáveis', isSummary: true, groupKey: 'custos',
                getHistValue: (p) => Object.values(historicalCosts).reduce((s, g) => s + (g[p] ?? 0), 0),
                getProjValue: () => {
                  const codes = ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6'];
                  return codes.reduce((sum, c) => {
                    const node = findNodeInTree(c, model.pnlTree);
                    return sum + (node ? Math.abs(node.annual[selectedYear] ?? 0) * 1000 / 12 : 0);
                  }, 0);
                },
              },
              { label: 'Custos CaaS', indent: true, getHistValue: (p) => historicalCosts['Custos Caas']?.[p] ?? 0, getProjValue: () => 0 },
              { label: 'Custos SaaS', indent: true, getHistValue: (p) => historicalCosts['Custos SaaS']?.[p] ?? 0, getProjValue: () => 0 },
              { label: 'Custos Customer Success', indent: true, getHistValue: (p) => historicalCosts['Custos Customer Success']?.[p] ?? 0, getProjValue: () => 0 },
              { label: 'Custos Education', indent: true, getHistValue: (p) => historicalCosts['Custos Education']?.[p] ?? 0, getProjValue: () => 0 },
              { label: 'Custos Expansão', indent: true, getHistValue: (p) => historicalCosts['Custos Expansão']?.[p] ?? 0, getProjValue: () => 0 },
              { label: 'Custos Tax', indent: true, getHistValue: (p) => historicalCosts['Custos Tax']?.[p] ?? 0, getProjValue: () => 0 },
              { label: 'Despesas Fixas', isSummary: true, groupKey: 'despesas',
                getHistValue: (p) => Object.values(historicalExpenses).reduce((s, g) => s + (g[p] ?? 0), 0),
                getProjValue: getProjectedDespesasFixas },
              { label: 'Desp. Administrativas', indent: true, getHistValue: (p) => historicalExpenses['Despesas Administrativas']?.[p] ?? 0, getProjValue: () => 0 },
              { label: 'Desp. Comerciais', indent: true, getHistValue: (p) => historicalExpenses['Despesas Comerciais']?.[p] ?? 0, getProjValue: () => 0 },
              { label: 'Desp. com Pessoal', indent: true, getHistValue: (p) => historicalExpenses['Despesas com Pessoal']?.[p] ?? 0, getProjValue: () => 0 },
              { label: 'Desp. de Marketing', indent: true, getHistValue: (p) => historicalExpenses['Despesas de Marketing']?.[p] ?? 0, getProjValue: () => 0 },
              { label: 'Despesas Financeiras', getHistValue: (p) => getFinancialCatValue('DF', p), getProjValue: getProjectedFinanceiras },
              { label: 'Provisões (IRPJ/CSLL)', getHistValue: (p) => getFinancialCatValue('PROV', p), getProjValue: getProjectedProvisoes },
              { label: 'Amortização de Dívida', getHistValue: (p) => getFinancialCatValue('AD', p), getProjValue: getProjectedAmortizacao },
              { label: 'Investimentos', getHistValue: (p) => getFinancialCatValue('INV', p), getProjValue: getProjectedInvestimentos },
            ];

            const visibleRows = rows.filter((row) => {
              if (!row.indent) return true;
              const costLabels = ['Custos CaaS', 'Custos SaaS', 'Custos Customer Success', 'Custos Education', 'Custos Expansão', 'Custos Tax'];
              const expLabels = ['Desp. Administrativas', 'Desp. Comerciais', 'Desp. com Pessoal', 'Desp. de Marketing'];
              if (costLabels.includes(row.label)) return opExpandedGroups.custos;
              if (expLabels.includes(row.label)) return opExpandedGroups.despesas;
              return true;
            });

            const getMonthlyValue = (row: OpRow, monthIdx: number): { value: number; isHist: boolean } => {
              const period = `${selectedYear}-${String(monthIdx + 1).padStart(2, '0')}`;
              const isHist = (HISTORICAL_PERIODS as readonly string[]).includes(period);
              if (isHist) return { value: row.getHistValue(period), isHist: true };
              if (!row.indent) return { value: row.getProjValue(), isHist: false };
              return { value: 0, isHist: false };
            };

            const nonSubRows = rows.filter(r => !r.indent);
            const getTotalValue = (monthIdx: number): { value: number; isHist: boolean } => {
              const { isHist } = getMonthlyValue(nonSubRows[0], monthIdx);
              const value = nonSubRows.reduce((s, r) => s + getMonthlyValue(r, monthIdx).value, 0);
              return { value, isHist };
            };
            const getAnnualTotal = (row: OpRow): number =>
              MONTHS.reduce((s, _, i) => s + getMonthlyValue(row, i).value, 0);
            const getGrandTotal = (): number =>
              MONTHS.reduce((s, _, i) => s + getTotalValue(i).value, 0);

            const statusBadge = selectedYear <= 2025
              ? <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Realizado</span>
              : selectedYear === 2026
              ? <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">Jan–Mar Realizado</span>
              : <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">Projetado</span>;

            return (
              <div className="gradient-card overflow-x-auto">
                <h3 className="text-sm font-semibold p-5 pb-3 flex items-center flex-wrap gap-1">
                  Resumo Operacional — {selectedYear}
                  {statusBadge}
                </h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="sticky left-0 z-10 bg-card text-left px-4 py-2 text-muted-foreground font-medium min-w-[190px]">Linha</th>
                      {MONTHS.map((m, i) => (
                        <th key={m} className={`text-right px-2 py-2 text-muted-foreground font-medium min-w-[72px]${selectedYear === 2026 && i === 2 ? ' border-r border-primary/30' : ''}`}>{m}</th>
                      ))}
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium min-w-[88px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const isGroup = row.isSummary && row.groupKey;
                      return (
                        <tr key={row.label} className={`border-b border-border/20 transition-colors ${row.isSummary ? 'bg-secondary/40 hover:bg-secondary/60 font-semibold' : 'hover:bg-secondary/20'}`}>
                          <td className={`sticky left-0 z-10 px-4 py-1.5 font-medium ${row.isSummary ? 'bg-secondary/40' : 'bg-card'}`}>
                            <div className={`flex items-center gap-1 ${isGroup ? 'cursor-pointer select-none' : ''}`}
                              onClick={isGroup ? () => setOpExpandedGroups(prev => ({ ...prev, [row.groupKey!]: !prev[row.groupKey!] })) : undefined}>
                              {isGroup && (
                                opExpandedGroups[row.groupKey!]
                                  ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                                  : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                              <span className={row.indent ? 'pl-4 text-muted-foreground' : ''}>{row.label}</span>
                            </div>
                          </td>
                          {MONTHS.map((_, i) => {
                            const { value, isHist } = getMonthlyValue(row, i);
                            const isCutoffBorder = selectedYear === 2026 && i === 2;
                            const showDash = !isHist && value === 0;
                            return (
                              <td key={i} className={`text-right px-2 py-1.5 tabular-nums${isCutoffBorder ? ' border-r border-primary/30' : ''}${!isHist ? ' text-muted-foreground/60 italic' : ''}`}>
                                {showDash ? '—' : formatCurrency(value)}
                              </td>
                            );
                          })}
                          <td className="text-right px-3 py-1.5 tabular-nums font-medium">{formatCurrency(getAnnualTotal(row))}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-border bg-primary/5 font-bold">
                      <td className="sticky left-0 z-10 bg-primary/5 px-4 py-2">TOTAL OPERACIONAL</td>
                      {MONTHS.map((_, i) => {
                        const { value, isHist } = getTotalValue(i);
                        const isCutoffBorder = selectedYear === 2026 && i === 2;
                        return (
                          <td key={i} className={`text-right px-2 py-2 tabular-nums${isCutoffBorder ? ' border-r border-primary/30' : ''}${!isHist ? ' text-muted-foreground/60 italic' : ''}`}>
                            {formatCurrency(value)}
                          </td>
                        );
                      })}
                      <td className="text-right px-3 py-2 tabular-nums">{formatCurrency(getGrandTotal())}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Indicadores de Folha */}
          {(() => {
            const yearMonths = MONTHS.map((_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`);
            const isHistCell = (monthIdx: number) => isHistorical(selectedYear, monthIdx);
            const cutoff = (i: number) => selectedYear === 2026 && i === 2;
            const indicators = [
              { label: 'Faturamento (MRR)', getVal: (p: string) => payrollFaturamento[p] ?? 0, format: (v: number) => formatCurrency(v) },
              { label: 'Payroll / Gross Revenue', getVal: (p: string) => (payrollGrossRevenueRatio[p] ?? 0) * 100, format: (v: number) => `${v.toFixed(1)}%` },
              { label: 'Benefícios', getVal: (p: string) => benefitsMonthly[p] ?? 0, format: (v: number) => formatCurrency(v) },
            ];
            return (
              <div className="gradient-card overflow-x-auto">
                <h3 className="text-sm font-semibold p-5 pb-3">Indicadores de Folha — {selectedYear}</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="sticky left-0 z-10 bg-card text-left px-4 py-2 text-muted-foreground font-medium min-w-[200px]">Indicador</th>
                      {MONTHS.map((m, i) => (
                        <th key={m} className={`text-right px-2 py-2 text-muted-foreground font-medium min-w-[72px]${cutoff(i) ? ' border-r border-primary/30' : ''}`}>{m}</th>
                      ))}
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium min-w-[88px]">Total / Méd.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indicators.map(ind => {
                      const values = yearMonths.map(p => ind.getVal(p));
                      const total = ind.label === 'Payroll / Gross Revenue'
                        ? values.reduce((s, v) => s + v, 0) / 12
                        : values.reduce((s, v) => s + v, 0);
                      return (
                        <tr key={ind.label} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                          <td className="sticky left-0 z-10 bg-card px-4 py-1.5 font-medium">{ind.label}</td>
                          {yearMonths.map((p, i) => {
                            const val = ind.getVal(p);
                            return (
                              <td key={i} className={`text-right px-2 py-1.5 tabular-nums${cutoff(i) ? ' border-r border-primary/30' : ''}${!isHistCell(i) ? ' text-muted-foreground/60 italic' : ''}`}>
                                {ind.format(val)}
                              </td>
                            );
                          })}
                          <td className="text-right px-3 py-1.5 tabular-nums font-medium">{ind.format(total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Reembolsos por Centro de Custo */}
          {(() => {
            const isHistCell = (monthIdx: number) => isHistorical(selectedYear, monthIdx);
            const cutoff = (i: number) => selectedYear === 2026 && i === 2;
            const yearMonths = MONTHS.map((_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`);
            return (
              <div className="gradient-card overflow-x-auto">
                <h3 className="text-sm font-semibold p-5 pb-3">Reembolsos por Centro de Custo — {selectedYear}</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="sticky left-0 z-10 bg-card text-left px-4 py-2 text-muted-foreground font-medium min-w-[200px]">Centro de Custo</th>
                      {MONTHS.map((m, i) => (
                        <th key={m} className={`text-right px-2 py-2 text-muted-foreground font-medium min-w-[72px]${cutoff(i) ? ' border-r border-primary/30' : ''}`}>{m}</th>
                      ))}
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium min-w-[88px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(reimbursements).map(([cc, months]) => {
                      const annTotal = yearMonths.reduce((s, p) => s + (months[p] ?? 0), 0);
                      return (
                        <tr key={cc} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                          <td className="sticky left-0 z-10 bg-card px-4 py-1.5 font-medium">{cc}</td>
                          {yearMonths.map((p, i) => {
                            const val = months[p] ?? 0;
                            return (
                              <td key={i} className={`text-right px-2 py-1.5 tabular-nums${cutoff(i) ? ' border-r border-primary/30' : ''}${!isHistCell(i) ? ' text-muted-foreground/60 italic' : ''}`}>
                                {val === 0 ? '—' : formatCurrency(val)}
                              </td>
                            );
                          })}
                          <td className="text-right px-3 py-1.5 tabular-nums font-medium">{formatCurrency(annTotal)}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-border bg-primary/5 font-bold">
                      <td className="sticky left-0 z-10 bg-primary/5 px-4 py-2">TOTAL REEMBOLSOS</td>
                      {yearMonths.map((p, i) => {
                        const val = Object.values(reimbursements).reduce((s, m) => s + (m[p] ?? 0), 0);
                        return (
                          <td key={i} className={`text-right px-2 py-2 tabular-nums${cutoff(i) ? ' border-r border-primary/30' : ''}${!isHistCell(i) ? ' text-muted-foreground/60 italic' : ''}`}>
                            {formatCurrency(val)}
                          </td>
                        );
                      })}
                      <td className="text-right px-3 py-2 tabular-nums">
                        {formatCurrency(yearMonths.reduce((s, p) => s + Object.values(reimbursements).reduce((ss, m) => ss + (m[p] ?? 0), 0), 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}

        </TabsContent>

        {/* ─── BLOCO 5: ECONOMIC AND FINANCIAL RESULTS ─── */}
        <TabsContent value="economic" className="space-y-6 mt-4">

          {/* Finance KPI / Selic */}
          <div className="gradient-card p-5">
            <h3 className="text-sm font-semibold mb-4">Finance KPI</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground font-medium">Selic Mensal (%):</label>
                <input type="number" step="0.01"
                  className="w-20 bg-secondary border border-border rounded px-2 py-1 text-right text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                  value={((data.selicMonthly ?? 0.0117) * 100).toFixed(2)}
                  onChange={e => {
                    const v = (Number(e.target.value) || 0) / 100;
                    updateModel(prev => ({ ...prev, selicMonthly: v }));
                  }}
                />
                <span className="text-[10px] text-muted-foreground">({((data.selicMonthly ?? 0.0117) * 100).toFixed(2)}% a.m. = {((Math.pow(1 + (data.selicMonthly ?? 0.0117), 12) - 1) * 100).toFixed(1)}% a.a.)</span>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium min-w-[200px]">Indicador</th>
                  {MONTHS.map(m => (
                    <th key={m} className="text-right p-3 text-muted-foreground font-medium min-w-[58px]">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                  <td className="p-3 font-medium">Selic Mensal</td>
                  {MONTHS.map((_, i) => {
                    const monthlyPct = ((data.selicMonthly ?? 0.0117) * 100);
                    return (
                      <td key={i} className="text-right p-3 tabular-nums text-xs">{monthlyPct.toFixed(3)}%</td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Resumo de Dívidas */}
          <div className="gradient-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Landmark className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Resumo de Dívidas</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Saldo Total Devedor</p>
                <p className="text-sm font-semibold tabular-nums">{formatCurrencyFull(debtSchedule.reduce((s, d) => s + d.outstanding, 0))}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Parcela Mensal Total</p>
                <p className="text-sm font-semibold tabular-nums">{formatCurrencyFull(debtSchedule.reduce((s, d) => s + d.monthlyPayment, 0))}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Nº de Contratos</p>
                <p className="text-sm font-semibold tabular-nums">{debtSchedule.length}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium text-xs">Contrato</th>
                    <th className="text-left py-2 text-muted-foreground font-medium text-xs">Credor</th>
                    <th className="text-right py-2 text-muted-foreground font-medium text-xs">Saldo (R$)</th>
                    <th className="text-right py-2 text-muted-foreground font-medium text-xs">Parcela/mês</th>
                    <th className="text-right py-2 text-muted-foreground font-medium text-xs">Parcelas rest.</th>
                    <th className="text-right py-2 text-muted-foreground font-medium text-xs">Previsão final</th>
                  </tr>
                </thead>
                <tbody>
                  {debtSchedule.map(d => (
                    <tr key={d.name} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="py-2 text-xs font-medium">{d.name}</td>
                      <td className="py-2 text-xs text-muted-foreground">{d.creditor}</td>
                      <td className="py-2 text-right text-xs tabular-nums">{formatCurrencyFull(d.outstanding)}</td>
                      <td className="py-2 text-right text-xs tabular-nums">{formatCurrencyFull(d.monthlyPayment)}</td>
                      <td className="py-2 text-right text-xs tabular-nums">{d.remainingInstallments}</td>
                      <td className="py-2 text-right text-xs tabular-nums">{d.finalDate ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </TabsContent>
      </Tabs>

    </div>
  );
}
