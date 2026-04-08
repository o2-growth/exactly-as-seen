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
import { YEARS, Year, Assumptions as AssumptionsType, DEFAULT_ASSUMPTIONS, HEADCOUNT, SUB_PRODUCT_LABELS, SubProductClients, BUTaxConfig, TicketKey as FinTicketKey, SubProductTaxConfig, CAAS_KEYS, SAAS_KEYS, EDUCATION_KEYS, EXPANSAO_KEYS, TAX_KEYS, ALL_SUBPRODUCT_KEYS, getSubProductTaxRate, getDefaultSubProductTaxConfig, CosConfig, DEFAULT_COS_CONFIG } from '@/lib/financialData';
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
  if (key === 'taxAT' || key === 'taxGPT' || key === 'taxRCT' || key === 'taxRT' || key === 'taxDTC') {
    return 0;
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
    let total = 0;
    for (let m = 0; m < 12; m++) {
      const period = toPeriod(year, m);
      const apiEntry = historicalData[key]?.[period];
      if (apiEntry && apiEntry.client_count > 0) {
        total += apiEntry.client_count;
      } else if (isHistorical(year, m) && apiEntry) {
        total += 0; // API says 0, trust it
      } else {
        total += Math.round(engineMonthly[m]);
      }
    }
    return Math.round(total);
  };

  /** Get annual revenue using API data for historical months, engine for projected */
  const getAnnualRevenue = (key: SubProductKey, year: Year): number => {
    const engineMonthly = getMonthlyClients(key, year, data.subProductClients, data.tickets, data.monthlyClientOverrides);
    const tk = data.tickets[key as TicketKey] ?? 0;
    let total = 0;
    for (let m = 0; m < 12; m++) {
      const period = toPeriod(year, m);
      const apiEntry = historicalData[key]?.[period];
      if (apiEntry && apiEntry.total_revenue > 0) {
        total += apiEntry.total_revenue;
      } else if (isHistorical(year, m) && apiEntry) {
        total += 0;
      } else {
        const monthTicket = data.monthlyTickets?.[key]?.[year]?.[m] ?? tk;
        total += engineMonthly[m] * monthTicket;
      }
    }
    return total;
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
  const [excludedFromTotal, setExcludedFromTotal] = useState<Record<string, boolean>>(() => ({
    caasSetup: true,
    saasSetup: true,
  }));
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
        yearMap = { ...current };
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

  const setRowApplyPctPersist = (valOrFn: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
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

  const handleClientChange = (key: SubProductKey, year: Year, monthIdx: number, newCount: number) => {
    // When user edits a month, recalculate subsequent months using current growth %
    const rate = getGrowthPct(key, year) / 100;

    setAssumptions(prev => {
      const currentOverrides = prev.monthlyClientOverrides ?? {};
      const currentManualFlags = prev.manualMonthlyClientOverrideFlags ?? {};
      const yearArr = currentOverrides[key as TicketKey]?.[year]
        ? [...currentOverrides[key as TicketKey]![year]!]
        : Array(12).fill(null);
      const manualFlags = currentManualFlags[key as TicketKey]?.[year]
        ? [...currentManualFlags[key as TicketKey]![year]!]
        : Array(12).fill(false);

      yearArr[monthIdx] = newCount;
      manualFlags[monthIdx] = true;

      // Recalculate subsequent non-manual months using growth % from the edited value
      let prevVal = newCount;
      for (let j = monthIdx + 1; j < 12; j++) {
        if (manualFlags[j] && yearArr[j] !== null && yearArr[j] !== undefined) {
          prevVal = yearArr[j]!; // respect other manual edits
        } else {
          const churnRate = getChurnForMonth(key, prev, year, j);
          prevVal = prevVal * (1 + rate - churnRate);
          yearArr[j] = Math.max(0, Math.round(prevVal));
        }
      }
      const decValue = yearArr[11] ?? newCount;

      return {
        ...prev,
        subProductClients: {
          ...prev.subProductClients,
          [key]: { ...prev.subProductClients[key], [year]: Math.round(decValue) },
        },
        monthlyClientOverrides: {
          ...(prev.monthlyClientOverrides ?? {}),
          [key]: {
            ...((prev.monthlyClientOverrides ?? {})[key as TicketKey] ?? {}),
            [year]: yearArr,
          },
        },
        manualMonthlyClientOverrideFlags: {
          ...(prev.manualMonthlyClientOverrideFlags ?? {}),
          [key]: {
            ...((prev.manualMonthlyClientOverrideFlags ?? {})[key as TicketKey] ?? {}),
            [year]: manualFlags,
          },
        },
      };
    });
  };

  const handleApplyAll = () => {
    const rate = applyAllPct / 100;
    const newGrowthRates = { ...growthRates };
    const overridesAccum: Partial<Record<SubProductKey, Partial<Record<Year, (number | null)[]>>>> = {};
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

          // Build sequential projection — preserve existing manual overrides
          const base = getMonthlyClients(k, y, data.subProductClients, data.tickets, data.monthlyClientOverrides);
          const existingOverrides = data.monthlyClientOverrides?.[k]?.[y];
          const manualFlags = data.manualMonthlyClientOverrideFlags?.[k]?.[y];
          let prev = y === 2025 ? 0 : Math.round(getMonthlyClients(k, (y - 1) as Year, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11]);
          const projected: (number | null)[] = Array(12).fill(null);
          for (let m = 0; m < 12; m++) {
            if (isHistorical(y, m)) {
              prev = Math.round(base[m]);
            } else if (manualFlags?.[m] && existingOverrides?.[m] !== null && existingOverrides?.[m] !== undefined) {
              const manual = existingOverrides[m]!;
              projected[m] = manual;
              prev = manual;
            } else {
              const churnRate = getChurnForMonth(k, data, y, m);
              prev = prev * (1 + arr[m] - churnRate);
              projected[m] = Math.max(0, Math.round(prev));
            }
          }
          if (!overridesAccum[k]) overridesAccum[k] = {};
          overridesAccum[k]![y] = projected;
          if (!decTargets[k]) decTargets[k] = {};
          decTargets[k]![y] = projected[11] ?? Math.round(base[11]);
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
          ...overridesAccum,
        },
        manualMonthlyClientOverrideFlags: nextManualFlags,
      };
    };
    if (editing) {
      setAssumptions(applyAllUpdater);
    } else {
      setAssumptions(applyAllUpdater);
    }
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

    // Then compute and update assumptions using latest state
    setAssumptions(prev => {
      const allOverrides: Record<number, (number | null)[]> = {};
      const allDecTargets: Record<number, number> = {};

      let prevClients = year === 2025 ? 0 : Math.round(getMonthlyClients(key, (year - 1) as Year, prev.subProductClients, prev.tickets, prev.monthlyClientOverrides)[11]);

      for (const y of yearsToApply) {
        const arr = newGrowthArrays[y];

        const base = getMonthlyClients(key, y, prev.subProductClients, prev.tickets, prev.monthlyClientOverrides);
        const existingOverrides = prev.monthlyClientOverrides?.[key as TicketKey]?.[y as Year];
        const manualFlags = prev.manualMonthlyClientOverrideFlags?.[key as TicketKey]?.[y as Year];

        const projected: (number | null)[] = Array(12).fill(null);
        for (let m = 0; m < 12; m++) {
          if (isHistorical(y, m)) {
            prevClients = Math.round(base[m]);
          } else if (manualFlags?.[m] && existingOverrides?.[m] !== null && existingOverrides?.[m] !== undefined) {
            // Preserve manual edits
            const manual = existingOverrides[m]!;
            projected[m] = manual;
            prevClients = manual;
          } else {
            const churnRate = getChurnForMonth(key, prev, y, m);
            prevClients = prevClients * (1 + arr[m] - churnRate);
            projected[m] = Math.max(0, Math.round(prevClients));
          }
        }
        allOverrides[y] = projected;
        allDecTargets[y] = projected[11] ?? Math.round(base[11]);
      }

      const newSPC = { ...prev.subProductClients, [key]: { ...prev.subProductClients[key] } };
      const newMO = { ...(prev.monthlyClientOverrides ?? {}), [key]: { ...((prev.monthlyClientOverrides ?? {})[key as TicketKey] ?? {}) } };
      const newMF = { ...(prev.manualMonthlyClientOverrideFlags ?? {}), [key]: { ...((prev.manualMonthlyClientOverrideFlags ?? {})[key as TicketKey] ?? {}) } };

      for (const y of yearsToApply) {
        (newSPC[key] as Record<number, number>)[y] = allDecTargets[y];
        (newMO[key] as Record<number, (number | null)[]>)[y] = allOverrides[y];
        // Keep manual flags — manual edits serve as anchor points for growth projection
      }

      return { ...prev, subProductClients: newSPC, monthlyClientOverrides: newMO };
    });

    // Growth rates already updated above before setAssumptions
  };

  // ─── Reproject clients when churn changes ───
  const reprojectWithChurn = (key: SubProductKey, newChurnRates: Record<number, number>) => {
    const yearsToApply = YEARS.filter(y => y >= selectedYear);

    setAssumptions(prev => {
      const allOverrides: Record<number, (number | null)[]> = {};
      const allDecTargets: Record<number, number> = {};

      let prevClients = selectedYear === 2025 ? 0 : Math.round(getMonthlyClients(key, (selectedYear - 1) as Year, prev.subProductClients, prev.tickets, prev.monthlyClientOverrides)[11]);

      for (const y of yearsToApply) {
        const growthArr = growthRates[y as Year]?.[key] ?? Array(12).fill(0.06);
        const base = getMonthlyClients(key, y as Year, prev.subProductClients, prev.tickets, prev.monthlyClientOverrides);
        const existingOverrides = prev.monthlyClientOverrides?.[key as TicketKey]?.[y as Year];
        const manualFlags = prev.manualMonthlyClientOverrideFlags?.[key as TicketKey]?.[y as Year];

        const projected: (number | null)[] = Array(12).fill(null);
        for (let m = 0; m < 12; m++) {
          if (isHistorical(y as Year, m)) {
            prevClients = Math.round(base[m]);
            // Leave projected[m] as null — historical months are not overridden
          } else if (manualFlags?.[m] && existingOverrides?.[m] !== null && existingOverrides?.[m] !== undefined) {
            const manual = existingOverrides[m]!;
            projected[m] = manual;
            prevClients = manual;
          } else {
            const churnRate = newChurnRates[y] !== undefined ? newChurnRates[y] / 100 / 12 : getChurnForMonth(key, prev, y as Year, m);
            prevClients = prevClients * (1 + growthArr[m] - churnRate);
            projected[m] = Math.max(0, Math.round(prevClients));
          }
        }
        allOverrides[y] = projected;
        allDecTargets[y] = projected[11] ?? Math.round(base[11]);
      }

      const newSPC = { ...prev.subProductClients, [key]: { ...prev.subProductClients[key] } };
      const newMO = { ...(prev.monthlyClientOverrides ?? {}), [key]: { ...((prev.monthlyClientOverrides ?? {})[key as TicketKey] ?? {}) } };
      const newMF = { ...(prev.manualMonthlyClientOverrideFlags ?? {}), [key]: { ...((prev.manualMonthlyClientOverrideFlags ?? {})[key as TicketKey] ?? {}) } };
      const newCR = { ...(prev.monthlyChurnRates ?? {}), [key]: { ...((prev.monthlyChurnRates ?? {})[key] ?? {}), ...newChurnRates } };

      for (const y of yearsToApply) {
        (newSPC[key] as Record<number, number>)[y] = allDecTargets[y];
        (newMO[key] as Record<number, (number | null)[]>)[y] = allOverrides[y];
      }

      return { ...prev, subProductClients: newSPC, monthlyClientOverrides: newMO, monthlyChurnRates: newCR };
    });
  };

  // ─── Reproject clients when churn changes (monthly arrays) ───
  const reprojectWithChurnArrays = (key: SubProductKey, newChurnArrays: Record<number, number[]>) => {
    const yearsToApply = YEARS.filter(y => y >= selectedYear);

    setAssumptions(prev => {
      const allOverrides: Record<number, (number | null)[]> = {};
      const allDecTargets: Record<number, number> = {};

      let prevClients = selectedYear === 2025 ? 0 : Math.round(getMonthlyClients(key, (selectedYear - 1) as Year, prev.subProductClients, prev.tickets, prev.monthlyClientOverrides)[11]);

      for (const y of yearsToApply) {
        const growthArr = growthRates[y as Year]?.[key] ?? Array(12).fill(0.06);
        const base = getMonthlyClients(key, y as Year, prev.subProductClients, prev.tickets, prev.monthlyClientOverrides);
        const churnArr = newChurnArrays[y];
        const existingOverrides = prev.monthlyClientOverrides?.[key as TicketKey]?.[y as Year];
        const manualFlags = prev.manualMonthlyClientOverrideFlags?.[key as TicketKey]?.[y as Year];

        const projected: (number | null)[] = Array(12).fill(null);
        for (let m = 0; m < 12; m++) {
          if (isHistorical(y as Year, m)) {
            prevClients = Math.round(base[m]);
          } else if (manualFlags?.[m] && existingOverrides?.[m] !== null && existingOverrides?.[m] !== undefined) {
            const manual = existingOverrides[m]!;
            projected[m] = manual;
            prevClients = manual;
          } else {
            const churnRate = churnArr ? churnArr[m] / 100 / 12 : getChurnForMonth(key, prev, y as Year, m);
            prevClients = prevClients * (1 + growthArr[m] - churnRate);
            projected[m] = Math.max(0, Math.round(prevClients));
          }
        }
        allOverrides[y] = projected;
        allDecTargets[y] = projected[11] ?? Math.round(base[11]);
      }

      const newSPC = { ...prev.subProductClients, [key]: { ...prev.subProductClients[key] } };
      const newMO = { ...(prev.monthlyClientOverrides ?? {}), [key]: { ...((prev.monthlyClientOverrides ?? {})[key as TicketKey] ?? {}) } };
      const newMF = { ...(prev.manualMonthlyClientOverrideFlags ?? {}), [key]: { ...((prev.manualMonthlyClientOverrideFlags ?? {})[key as TicketKey] ?? {}) } };
      const newCR = { ...(prev.monthlyChurnRates ?? {}), [key]: { ...((prev.monthlyChurnRates ?? {})[key] ?? {}), ...newChurnArrays } };

      for (const y of yearsToApply) {
        (newSPC[key] as Record<number, number>)[y] = allDecTargets[y];
        (newMO[key] as Record<number, (number | null)[]>)[y] = allOverrides[y];
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
          return [
            { label: 'Receita Bruta', value: formatCurrency(gr * 1000) },
            { label: 'EBITDA', value: formatCurrency(ebitda * 1000) },
            { label: 'Margem Bruta', value: `${gmPct}%` },
            { label: 'Margem EBITDA', value: `${emPct}%` },
            { label: 'Clientes', value: model.years[selectedYear].totalClients.toLocaleString('pt-BR') },
            { label: 'Resultado Líq.', value: formatCurrency(ni * 1000) },
          ];
        })().map(kpi => (
          <div key={kpi.label} className="gradient-card p-3 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
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
                              {row.dataKey ? getAnnualClientSum(row.dataKey as SubProductKey, selectedYear).toLocaleString('pt-BR') : '—'}
                            </td>
                            <td className="text-right p-3 tabular-nums text-sm bg-primary/5 font-semibold text-emerald-600">
                              {row.dataKey ? (() => {
                                const rev = getAnnualRevenue(row.dataKey as SubProductKey, selectedYear);
                                return formatCurrency(rev);
                              })() : '—'}
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
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Clientes por ano (soma)</p>
                                    <div className="grid grid-cols-6 gap-2">
                                      {activeYears.map(y => {
                                        const yrSum = getAnnualClientSum(prodKey as SubProductKey, y);
                                        return (
                                          <div key={y} className={`text-center p-2 rounded ${y === selectedYear ? 'bg-primary/10 border border-primary/30' : 'bg-card border border-border/50'}`}>
                                            <p className="text-[9px] text-muted-foreground font-medium mb-1">{y}</p>
                                            <span className="block w-full text-center text-sm tabular-nums font-bold text-foreground">
                                              {yrSum.toLocaleString('pt-BR')}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Monthly breakdown */}
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-xs font-semibold text-muted-foreground">
                                        Novos clientes mensais — {selectedYear}
                                        {prodKey === 'saasSetup' && <span className="ml-2 text-[9px] text-primary font-normal">(auto: Enterprise + Corporate + Oxy + Oxy+Gênio + Oxy+Gênio+Esp)</span>}
                                      </p>
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
                                        const hcPeriod = toPeriod(selectedYear, i);
                                        const hcEntry = hist ? historicalData[prodKey]?.[hcPeriod] : undefined;
                                        const displayClients = hcEntry ? hcEntry.client_count : monthly[i];
                                        return (
                                          <div key={m} className={`text-center space-y-1 p-1.5 rounded ${hist ? 'bg-secondary/40' : 'bg-card border border-border/50'}`}>
                                            <p className="text-[9px] text-muted-foreground font-medium">{m}{hist ? ' 🔒' : ''}{hcEntry ? <span className="ml-0.5 text-[8px] text-sky-500 font-semibold" title="Dado real da API">API</span> : ''}</p>
                                            {hist ? (
                                              <span
                                                className={`block w-full text-center text-xs tabular-nums font-medium cursor-pointer hover:text-foreground hover:underline transition-colors ${hcEntry ? 'text-sky-600' : 'text-muted-foreground'}`}
                                                title={hcEntry ? 'Dado real (API)' : 'Clique para editar dado histórico'}
                                                onClick={() => {
                                                  if (window.confirm(`Editar dado histórico de ${m}? Este é um valor realizado.`)) {
                                                    const val = window.prompt(`${m} — Novo valor de clientes:`, String(Math.round(displayClients)));
                                                    if (val !== null) {
                                                      handleClientChange(row.dataKey as SubProductKey, selectedYear, i, Number(val) || 0);
                                                    }
                                                  }
                                                }}
                                              >
                                                {Math.round(displayClients).toLocaleString('pt-BR')}
                                              </span>
                                            ) : (
                              <MonthlyClientInput
                                                value={monthly[i]}
                                                className="w-full bg-transparent text-center text-xs tabular-nums font-medium outline-none border-b border-transparent hover:border-primary/30 focus:border-primary transition-colors text-foreground"
                                                onCommit={v => handleClientChange(row.dataKey as SubProductKey, selectedYear, i, v)}
                                                readOnly={prodKey === 'saasSetup'}
                                              />
                                            )}
                                            <p className={`text-[9px] tabular-nums ${hist ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                                              {i > 0 && monthly[i - 1] > 0 ? `${(((monthly[i] / monthly[i - 1]) - 1) * 100).toFixed(0)}%` : '—'}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Clientes base (flat) — preenche meses nao-historicos com valor fixo */}
                                  {prodKey !== 'saasSetup' && (
                                    <div className="flex items-center gap-2 text-xs pt-1">
                                      <span className="text-muted-foreground">Clientes base (flat):</span>
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
                                            const yearOverrides = prev.monthlyClientOverrides?.[key]?.[selectedYear]
                                              ? [...prev.monthlyClientOverrides[key]![selectedYear]!]
                                              : Array(12).fill(null);
                                            const yearFlags = prev.manualMonthlyClientOverrideFlags?.[key]?.[selectedYear]
                                              ? [...prev.manualMonthlyClientOverrideFlags[key]![selectedYear]!]
                                              : Array(12).fill(false);
                                            for (let m = 0; m < 12; m++) {
                                              if (!isHistorical(selectedYear, m)) {
                                                yearOverrides[m] = flatVal;
                                                yearFlags[m] = true;
                                              }
                                            }
                                            return {
                                              ...prev,
                                              subProductClients: {
                                                ...prev.subProductClients,
                                                [prodKey]: { ...prev.subProductClients[prodKey as keyof typeof prev.subProductClients], [selectedYear]: flatVal },
                                              },
                                              monthlyClientOverrides: {
                                                ...(prev.monthlyClientOverrides ?? {}),
                                                [key]: { ...((prev.monthlyClientOverrides ?? {})[key] ?? {}), [selectedYear]: yearOverrides },
                                              },
                                              manualMonthlyClientOverrideFlags: {
                                                ...(prev.manualMonthlyClientOverrideFlags ?? {}),
                                                [key]: { ...((prev.manualMonthlyClientOverrideFlags ?? {})[key] ?? {}), [selectedYear]: yearFlags },
                                              },
                                            };
                                          });
                                        }}
                                        disabled={false}
                                      />
                                    </div>
                                  )}

                                  {/* Ticket mensal + summary */}
                                  <div className="space-y-2 pt-1">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-xs font-semibold text-muted-foreground">Ticket (R$/mês) — {selectedYear}</p>
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
                                        const decTicket = data.monthlyTickets?.[prodKey]?.[selectedYear]?.[11] ?? ticketVal;
                                        return <span className="text-muted-foreground">MRR Dez: <strong className="text-foreground">{formatCurrencyFull(monthly[11] * decTicket)}</strong></span>;
                                      })()}
                                    </div>
                                  </div>

                                  {/* Receita Bruta Total */}
                                  <div className="space-y-2 pt-1">
                                    <p className="text-xs font-semibold text-muted-foreground">Nova Receita adicionada (R$/mês) — {selectedYear}</p>
                                    <div className="grid grid-cols-12 gap-1.5">
                                      {MONTHS.map((m, i) => {
                                        const hist = isHistorical(selectedYear, i);
                                        const monthTicket = data.monthlyTickets?.[prodKey]?.[selectedYear]?.[i] ?? ticketVal;
                                        const grossRevenue = monthly[i] * monthTicket;
                                        return (
                                          <div key={m} className={`text-center space-y-1 p-1.5 rounded ${hist ? 'bg-secondary/40 opacity-60' : 'bg-accent/20 border border-accent/30'}`}>
                                            <p className="text-[9px] text-muted-foreground font-medium">{m}{hist ? ' 🔒' : ''}</p>
                                            <span className="block w-full text-center text-xs tabular-nums font-medium text-foreground">
                                              {formatCurrencyFull(grossRevenue)}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <div className="flex items-center gap-6 text-xs">
                                      {(() => {
                                        const totalAno = MONTHS.reduce((sum, _, i) => {
                                          const mt = data.monthlyTickets?.[prodKey]?.[selectedYear]?.[i] ?? ticketVal;
                                          return sum + monthly[i] * mt;
                                        }, 0);
                                        const decTicket = data.monthlyTickets?.[prodKey]?.[selectedYear]?.[11] ?? ticketVal;
                                        const mrrDez = monthly[11] * decTicket;
                                        return (
                                          <>
                                            <span className="text-muted-foreground">Total ano: <strong className="text-foreground">{formatCurrencyFull(totalAno)}</strong></span>
                                            <span className="text-muted-foreground">MRR Dez: <strong className="text-foreground">{formatCurrencyFull(mrrDez)}</strong></span>
                                          </>
                                        );
                                      })()}
                                    </div>
                                   </div>

                                  {/* Churn (% mensal) */}
                                  <div className="space-y-2 pt-1">
                                    <div className="flex items-center gap-4">
                                      <p className="text-xs font-semibold text-negative">Churn (% mensal) — {selectedYear}</p>
                                      <button
                                        className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${data.churnNotApplicable?.[prodKey] ? 'bg-muted text-muted-foreground ring-1 ring-border' : 'bg-secondary/60 text-muted-foreground/60 hover:bg-secondary'}`}
                                        disabled={false}
                                        onClick={e => {
                                          e.stopPropagation();
                                          const updater = (prev: typeof assumptions) => ({
                                            ...prev,
                                            churnNotApplicable: {
                                              ...(prev.churnNotApplicable ?? {}),
                                              [prodKey]: !(prev.churnNotApplicable?.[prodKey]),
                                            },
                                          });
                                          setAssumptions(updater);
                                        }}
                                      >
                                        N/A
                                      </button>
                                    </div>
                                    {data.churnNotApplicable?.[prodKey] ? (
                                      <div className="grid grid-cols-12 gap-1.5">
                                        {MONTHS.map((m) => (
                                          <div key={m} className="text-center space-y-1 p-1.5 rounded bg-muted/30">
                                            <p className="text-[9px] text-muted-foreground font-medium">{m}</p>
                                            <span className="block w-full text-center text-xs tabular-nums font-medium text-muted-foreground">N/A</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-12 gap-1.5">
                                        {MONTHS.map((m, i) => {
                                          const hist = isHistorical(selectedYear, i);
                                          const hcChurnPeriod = toPeriod(selectedYear, i);
                                          const hcChurnEntry = hist ? historicalData[prodKey]?.[hcChurnPeriod] : undefined;
                                          // Historical months: show stored value if manually edited, otherwise category default
                                          const storedArr = data.monthlyChurnRates?.[prodKey as TicketKey]?.[selectedYear];
                                          const hasManualChurn = hist && storedArr && Array.isArray(storedArr) && storedArr[i] !== undefined;
                                          const churnRate = hcChurnEntry
                                            ? hcChurnEntry.churn_rate / 100 / 12
                                            : (hasManualChurn
                                              ? storedArr[i] / 100 / 12
                                              : (hist
                                                ? getChurnMonthly(prodKey, { ...data, monthlyChurnRates: undefined } as any, selectedYear)
                                                : getChurnForMonth(prodKey, data, selectedYear, i)));
                                          const churnPctMonthly = Math.round(churnRate * 100 * 100) / 100;
                                          return (
                                            <div key={m} className={`text-center space-y-1 p-1.5 rounded ${hist ? 'bg-secondary/40' : 'bg-negative/5 border border-negative/20'}`}>
                                              <p className="text-[9px] text-muted-foreground font-medium">{m}{hist ? ' 🔒' : ''}{hcChurnEntry ? <span className="ml-0.5 text-[8px] text-sky-500 font-semibold" title="Dado real da API">API</span> : ''}</p>
                                              <span
                                                className={`block w-full text-center text-xs tabular-nums font-medium ${hcChurnEntry ? 'text-sky-600' : 'text-negative'} ${hist ? 'cursor-pointer hover:underline' : ''}`}
                                                onClick={hist ? () => {
                                                  if (window.confirm(`Editar churn histórico de ${m}?`)) {
                                                    const val = window.prompt(`${m} — Novo churn (% anual):`, String(Math.round(churnPctMonthly * 12 * 100) / 100));
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
                                                {churnPctMonthly > 0 ? `${churnPctMonthly}%` : '—'}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
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
                                            // Save as arrays (consistent with reprojectWithChurnArrays)
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
                                            return `${yr}: ${first}→${last}%`;
                                          }
                                          const rate = (typeof stored === 'number' ? stored : null)
                                            ?? Math.round(getChurnMonthly(prodKey, data, yr) * 12 * 100 * 10) / 10;
                                          return `${yr}: ${rate}%`;
                                        }).join(' · ')}
                                      </div>
                                      </>
                                      );
                                    })()}
                                    <div className="flex items-center gap-6 text-xs">
                                      {data.churnNotApplicable?.[prodKey] ? (
                                        <span className="text-muted-foreground italic">Não se aplica</span>
                                      ) : (
                                        (() => {
                                          const totalChurn = MONTHS.reduce((sum, _, i) => {
                                            const churnRate = getChurnForMonth(prodKey, data, selectedYear, i);
                                            const prevClients = i === 0
                                              ? (selectedYear === 2025 ? 0 : Math.round(getMonthlyClients(prodKey, (selectedYear - 1) as Year, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11]))
                                              : monthly[i - 1];
                                            return sum + Math.round(prevClients * churnRate);
                                          }, 0);
                                          const stored = data.monthlyChurnRates?.[prodKey]?.[selectedYear];
                                          const annualLabel = stored !== undefined && Array.isArray(stored)
                                            ? `${stored[0]}→${stored[11]}%`
                                            : (() => { const r = getChurnMonthly(prodKey, data, selectedYear); return `${Math.round(r * 12 * 100 * 10) / 10}% a.a.`; })();
                                          const avgRate = getChurnMonthly(prodKey, data, selectedYear);
                                          return <span className="text-negative">Churn: <strong>{annualLabel}</strong> ({Math.round(avgRate * 10000) / 100}%/mes avg) · <strong>{totalChurn.toLocaleString('pt-BR')}</strong> clientes perdidos/ano</span>;
                                        })()
                                      )}
                                    </div>
                                  </div>
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
                          const mc = getMonthlyClients(row.dataKey as SubProductKey, selectedYear, data.subProductClients, data.tickets, data.monthlyClientOverrides);
                          const tk = data.tickets[row.dataKey as TicketKey] ?? 0;
                          return sum + mc.reduce((s, v, i) => s + v * (data.monthlyTickets?.[row.dataKey as SubProductKey]?.[selectedYear]?.[i] ?? tk), 0);
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
            const TAX_ROW_DEFS: { label: string; field?: keyof SubProductTaxConfig; computed?: (cfg: SubProductTaxConfig) => number; isTotal?: boolean }[] = [
              { label: '2.01  CSLL (retido na fonte) (%)', field: 'csllRetido' },
              { label: '2.02  PIS (retido na fonte) (%)', field: 'pisRetido' },
              { label: '2.03  ISS (%)', field: 'iss' },
              { label: '2.04  PIS (%)', field: 'pis' },
              { label: '2.05  COFINS (%)', field: 'cofins' },
              { label: '2.06  ICMS (%)', field: 'icms' },
              { label: '2.07  IRRF (retido na fonte) (%)', field: 'irrfRetido' },
              { label: '2.08  COFINS (retido na fonte) (%)', field: 'cofinsRetido' },
              { label: 'IRPJ efetivo (%)', computed: (cfg) => (cfg.tipoReceita === 'servico' ? 0.32 : 0.08) * 0.15 * 100 },
              { label: 'Adicional de IRPJ (% máx)', computed: (cfg) => (cfg.tipoReceita === 'servico' ? 0.32 : 0.08) * 0.10 * 100 },
              { label: 'CSLL efetivo (%)', computed: (cfg) => (cfg.tipoReceita === 'servico' ? 0.32 : 0.12) * 0.09 * 100 },
              { label: 'TOTAL efetivo (%)', computed: (cfg) => {
                const irpj = (cfg.tipoReceita === 'servico' ? 0.32 : 0.08) * 0.15 * 100;
                const adicional = (cfg.tipoReceita === 'servico' ? 0.32 : 0.08) * 0.10 * 100;
                const csll = (cfg.tipoReceita === 'servico' ? 0.32 : 0.12) * 0.09 * 100;
                return cfg.pis + cfg.cofins + cfg.iss + cfg.csllRetido + cfg.pisRetido + cfg.icms + cfg.irrfRetido + cfg.cofinsRetido + irpj + adicional + csll;
              }, isTotal: true },
            ];

            const fullLabels: Record<string, string> = {
              caasAssessoria: 'Serviços Especializados', caasEnterprise: 'Enterprise', caasCorporate: 'Corporate', caasParceiros: 'Parceiros', caasSetup: 'BPO Financeiro',
              saasOxy: 'Oxy', saasOxyGenio: 'Oxy+Gênio', saasSetup: 'Setup', saasParceiros: 'Parceiros', saasOxyGenioEsp: 'Oxy+Gênio+Especialista',
              educationDonoCFO: 'Dono CFO', educationEN: 'Eng. Negócios', educationFR: 'Financeiro Raiz', educationFSP: 'FSP',
              baas: 'Oxy Hacker', baasFranquia: 'Franquia', baasMasterFranquia: 'Master Franquia',
              taxAT: 'AT', taxGPT: 'GPT', taxRCT: 'RCT', taxRT: 'RT', taxDTC: 'DTC',
            };

            const getConfig = (key: FinTicketKey): SubProductTaxConfig => {
              return getSubProductTaxRate(key, data as AssumptionsType);
            };

            const updateSubProductTax = (key: FinTicketKey, field: keyof SubProductTaxConfig, val: number) => {
              const current = getConfig(key);
              const updated = { ...current, [field]: val };
              const rates = { ...(data.subProductTaxRates ?? {}), [key]: updated };
              if (editing) {
                setAssumptions(prev => ({ ...prev, subProductTaxRates: rates }));
              } else {
                setAssumptions(prev => ({ ...prev, subProductTaxRates: rates } as AssumptionsType));
              }
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
                          {cat.keys.map(k => (
                            <th key={k} className="text-center py-2 px-2 font-medium text-muted-foreground whitespace-nowrap">
                              {fullLabels[k] ?? k}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {TAX_ROW_DEFS.map((rowDef) => {
                          const isEditable = !!rowDef.field;
                          const isTotal = !!rowDef.isTotal;
                          return (
                            <tr key={rowDef.label} className={`border-b border-border/30 ${isTotal ? 'bg-muted/30 font-semibold' : ''}`}>
                              <td className={`py-1.5 px-3 font-medium whitespace-nowrap ${isTotal ? 'text-primary' : 'text-muted-foreground'}`}>
                                {rowDef.label}
                              </td>
                              {cat.keys.map(k => {
                                const cfg = getConfig(k);

                                if (isEditable && rowDef.field) {
                                  const cellValue = cfg[rowDef.field] as number;
                                  return (
                                    <td key={k} className="py-1 px-1 text-center">
                                      {editing ? (
                                        <input
                                          type="number"
                                          step="0.1"
                                          min="0"
                                          max="20"
                                          className="w-16 bg-secondary border border-border rounded px-1.5 py-0.5 text-center text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                                          value={cellValue}
                                          onChange={e => updateSubProductTax(k, rowDef.field!, Number(e.target.value) || 0)}
                                        />
                                      ) : (
                                        <span className="text-xs tabular-nums">{cellValue.toFixed(2).replace('.', ',')}%</span>
                                      )}
                                    </td>
                                  );
                                }

                                const cellValue = rowDef.computed!(cfg);
                                return (
                                  <td key={k} className={`py-1.5 px-2 text-center tabular-nums ${isTotal ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {cellValue.toFixed(2).replace('.', ',')}%
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
                  <span>Deduções (PIS + COFINS + ISS) abatidas da Receita Bruta. IRPJ + CSLL incidem sobre a base presumida: CaaS e Setup → 8%/12% (produto, ISS 0%); MRR SaaS (assinaturas) → 32% (serviço, ISS 2,9%); Education e Tax → 32% (serviço, ISS 5%); Expansão → mix 80/20: 80% produto (8%/12%) + 20% serviço (32%), ISS 1%. Tributos sempre incidem, independente de lucro ou prejuízo (Lucro Presumido).</span>
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
                            <td className="text-right px-2 py-2 tabular-nums">{formatCurrency(yi.caasCost * 12)}</td>
                            <td className="text-right px-2 py-2 tabular-nums">{formatCurrency(yi.saasSubCost * 12)}</td>
                            <td className="text-right px-2 py-2 tabular-nums">{formatCurrency(yi.setupCost * 12)}</td>
                            <td className="text-right px-2 py-2 tabular-nums">{formatCurrency(yi.eduCost)}</td>
                            <td className="text-right px-2 py-2 tabular-nums">{formatCurrency(yi.csCost * 12)}</td>
                            <td className="text-right px-2 py-2 tabular-nums">{formatCurrency(yi.expansaoCost)}</td>
                            <td className="text-right px-2 py-2 tabular-nums">{formatCurrency(yi.taxCost)}</td>
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
