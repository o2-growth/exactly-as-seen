import React, { useState, useRef, useEffect } from 'react';

/** Input with local state buffer — commits on blur/Enter, syncs when not focused */
function MonthlyClientInput({ value, onCommit, className }: { value: number; onCommit: (v: number) => void; className?: string }) {
  const [local, setLocal] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setLocal(value); }, [value]);
  const commit = () => { focused.current = false; if (local !== value) onCommit(local); };
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
import { YEARS, Year, Assumptions as AssumptionsType, DEFAULT_ASSUMPTIONS, HEADCOUNT, SUB_PRODUCT_LABELS, SubProductClients } from '@/lib/financialData';
import { MONTHS, getMonthlyClients, getMonthlyHeadcount } from '@/lib/monthlyData';
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
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

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
  if (!editing) {
    return <span className="tabular-nums">{value.toLocaleString('pt-BR')}</span>;
  }
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

function getChurnMonthly(key: SubProductKey, data: AssumptionsType, year?: Year): number {
  // Check for per-product override first
  if (year && data.monthlyChurnRates?.[key]?.[year] !== undefined) {
    return (data.monthlyChurnRates[key]![year]!) / 100 / 12;
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
  const { assumptions, setAssumptions, resetAssumptions, scenario, projections, model, filteredYears } = useFinancialModel();
  const { saveVersion } = useVersionHistory();

  // Use filteredYears for the year selector; fall back to all YEARS if empty
  const activeYears: Year[] = filteredYears.length > 0 ? filteredYears : [...YEARS];

  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<AssumptionsType>(assumptions);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveNote, setSaveNote] = useState('');
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
  const [hcViewMode, setHcViewMode] = useState<'people' | 'cost'>('people');

  const [actualData, setActualData] = useState<Record<string, Record<number, number>>>(() => {
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

  const [applyAllPct, setApplyAllPct] = useState(6);
  const [rowApplyPct, setRowApplyPct] = useState<Record<string, number>>({});
  const [rowTicketGrowthPct, setRowTicketGrowthPct] = useState<Record<string, number>>({});
  const [rowChurnPct, setRowChurnPct] = useState<Record<string, number>>({});
  const [opExpandedGroups, setOpExpandedGroups] = useState<Record<string, boolean>>({
    custos: false,
    despesas: false,
  });

  // ─── Headcount editable state ───
  const [hcEmployees, setHcEmployees] = useState(() =>
    hcNamedEmployees.map(e => ({ ...e, monthly: { ...e.monthly } }))
  );

  const updateEmployeeSalary = (empIdx: number, period: string, value: number) => {
    setHcEmployees(prev => {
      const next = [...prev];
      next[empIdx] = { ...next[empIdx], monthly: { ...next[empIdx].monthly, [period]: value } };
      return next;
    });
  };

  const updateEmployeeField = (empIdx: number, field: 'name' | 'role' | 'bu' | 'code', value: string) => {
    setHcEmployees(prev => {
      const next = [...prev];
      next[empIdx] = { ...next[empIdx], [field]: value };
      return next;
    });
  };

  const addEmployee = () => {
    setHcEmployees(prev => [...prev, {
      name: 'Novo Colaborador',
      role: '',
      code: '',
      bu: 'CaaS',
      monthly: {},
    }]);
  };

  const removeEmployee = (empIdx: number) => {
    setHcEmployees(prev => prev.filter((_, i) => i !== empIdx));
  };

  const startEditing = () => {
    setEditState({ ...assumptions });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditState(assumptions);
    setEditing(false);
  };

  const handleSave = () => {
    setShowSaveModal(true);
  };

  const confirmSave = () => {
    if (!saveNote.trim()) return;
    setAssumptions(editState);
    saveVersion(saveNote.trim(), editState, scenario);
    setSaveNote('');
    setShowSaveModal(false);
    setEditing(false);
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
    setAssumptions(prev => ({
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
    setActualData(prev => ({
      ...prev,
      [key]: { ...prev[key], [year]: val },
    }));
  };

  const data = editing ? editState : assumptions;

  // Helper: update assumptions directly (when not in edit mode) or editState (when editing)
  const updateModel = (updater: (prev: AssumptionsType) => AssumptionsType) => {
    if (editing) {
      setEditState(updater);
    } else {
      setAssumptions(updater(assumptions));
    }
  };

  // ─── Projection handlers ───

  const handleGrowthChange = (key: SubProductKey, year: Year, monthIdx: number, newPctVal: number) => {
    const newRate = newPctVal / 100;
    setGrowthRates(prev => {
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
    // Read from the correct state source (editState when editing, assumptions otherwise)
    const source = editing ? editState : assumptions;
    const currentOverrides = source.monthlyClientOverrides ?? {};
    const yearArr = currentOverrides[key as TicketKey]?.[year]
      ? [...currentOverrides[key as TicketKey]![year]!]
      : Array(12).fill(null);
    yearArr[monthIdx] = newCount;

    // Determine Dec target
    const decValue = monthIdx === 11
      ? newCount
      : (yearArr[11] !== null && yearArr[11] !== undefined ? yearArr[11] : source.subProductClients[key][year]);

    // Recalculate subsequent months via geometric interpolation from edited month to Dec target
    if (monthIdx < 11) {
      const remainingSteps = 11 - monthIdx;
      for (let j = monthIdx + 1; j <= 10; j++) {
        const step = j - monthIdx;
        let val: number;
        if (newCount > 0 && decValue > 0) {
          val = newCount * Math.pow(decValue / newCount, step / remainingSteps);
        } else if (newCount === 0 && decValue > 0) {
          val = decValue * (step / remainingSteps);
        } else {
          val = 0;
        }
        yearArr[j] = Math.round(val * 100) / 100;
      }
      yearArr[11] = decValue;
    }

    console.log('[handleClientChange]', key, year, monthIdx, '→', newCount, 'decTarget:', decValue);
    updateModel(prev => ({
      ...prev,
      subProductClients: {
        ...prev.subProductClients,
        [key]: { ...prev.subProductClients[key], [year]: decValue },
      },
      monthlyClientOverrides: {
        ...(prev.monthlyClientOverrides ?? {}),
        [key]: {
          ...((prev.monthlyClientOverrides ?? {})[key as TicketKey] ?? {}),
          [year]: yearArr,
        },
      },
    }));
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

          // Build sequential projection to get monthly values with growth
          const base = getMonthlyClients(k, y, data.subProductClients, data.tickets, data.monthlyClientOverrides);
          const churnRate = getChurnMonthly(k, data, y);
          let prev = y === 2025 ? 0 : Math.round(getMonthlyClients(k, (y - 1) as Year, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11]);
          const projected: (number | null)[] = Array(12).fill(null);
          for (let m = 0; m < 12; m++) {
            if (isHistorical(y, m)) {
              prev = Math.round(base[m]);
            } else {
              const next = Math.max(0, Math.round(prev * (1 + arr[m] - churnRate)));
              projected[m] = next;
              prev = next;
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

    setGrowthRates(newGrowthRates);

    const applyAllUpdater = (prev: AssumptionsType) => {
      const newSPC = { ...prev.subProductClients };
      for (const [k, yearMap] of Object.entries(decTargets)) {
        newSPC[k as SubProductKey] = { ...newSPC[k as SubProductKey], ...yearMap };
      }
      return {
        ...prev,
        subProductClients: newSPC,
        monthlyClientOverrides: {
          ...(prev.monthlyClientOverrides ?? {}),
          ...overridesAccum,
        },
      };
    };
    if (editing) {
      setEditState(applyAllUpdater);
    } else {
      setAssumptions(applyAllUpdater);
    }
  };

  const handleApplyRow = (key: SubProductKey, year: Year) => {
    const pct = rowApplyPct[key] ?? 6;
    const rate = pct / 100;
    const currentArr = growthRates[year]?.[key] ?? Array(12).fill(0.06);
    const arr = [...currentArr];
    for (let m = 0; m < 12; m++) {
      if (!isHistorical(year, m)) arr[m] = rate;
    }

    // Build sequential projection with growth rates and save as full overrides
    const base = getMonthlyClients(key, year, data.subProductClients, data.tickets, data.monthlyClientOverrides);
    const churnRate = getChurnMonthly(key, data, year);
    let prev = year === 2025 ? 0 : Math.round(getMonthlyClients(key, (year - 1) as Year, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11]);
    const projected: (number | null)[] = Array(12).fill(null);
    for (let m = 0; m < 12; m++) {
      if (isHistorical(year, m)) {
        prev = Math.round(base[m]);
      } else {
        const next = Math.max(0, Math.round(prev * (1 + arr[m] - churnRate)));
        projected[m] = next;
        prev = next;
      }
    }
    const newDecTarget = projected[11] ?? Math.round(base[11]);

    setGrowthRates(prev => {
      const updated = { ...prev };
      const yearRates = { ...updated[year] };
      yearRates[key] = arr;
      updated[year] = yearRates;
      return updated;
    });

    const applyRowUpdater = (prev: AssumptionsType) => ({
      ...prev,
      subProductClients: {
        ...prev.subProductClients,
        [key]: { ...prev.subProductClients[key], [year]: newDecTarget },
      },
      monthlyClientOverrides: {
        ...(prev.monthlyClientOverrides ?? {}),
        [key]: {
          ...((prev.monthlyClientOverrides ?? {})[key as TicketKey] ?? {}),
          [year]: projected,
        },
      },
    });
    if (editing) {
      setEditState(applyRowUpdater);
    } else {
      setAssumptions(applyRowUpdater);
    }
  };

  const handleApplyTicketGrowth = (prodKey: SubProductKey, year: Year) => {
    const pct = rowTicketGrowthPct[prodKey] ?? 0;
    const rate = pct / 100;
    const ticketVal = data.tickets[prodKey as TicketKey] ?? 0;
    const currentMonthlyTickets = data.monthlyTickets ?? {};
    const yearArr = currentMonthlyTickets[prodKey]?.[year]
      ? [...currentMonthlyTickets[prodKey]![year]!]
      : Array(12).fill(ticketVal);

    // Find first non-historical month as base
    let baseTicket = ticketVal;
    for (let m = 0; m < 12; m++) {
      if (!isHistorical(year, m)) {
        baseTicket = yearArr[m] ?? ticketVal;
        break;
      }
    }

    // Apply compound growth to projected months
    let compoundIdx = 0;
    for (let m = 0; m < 12; m++) {
      if (isHistorical(year, m)) continue;
      yearArr[m] = Math.round(baseTicket * Math.pow(1 + rate, compoundIdx));
      compoundIdx++;
    }

    const updater = (prev: AssumptionsType) => ({
      ...prev,
      monthlyTickets: {
        ...(prev.monthlyTickets ?? {}),
        [prodKey]: {
          ...((prev.monthlyTickets ?? {})[prodKey] ?? {}),
          [year]: yearArr,
        },
      },
    });
    if (editing) {
      setEditState(updater);
    } else {
      setAssumptions(updater);
    }
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
          {editing ? (
            <>
              <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                <Save className="h-3.5 w-3.5" /> Save
              </button>
              <button onClick={cancelEditing} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={startEditing} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-primary/40 rounded-lg text-primary hover:bg-primary/10 transition-colors">
                <Unlock className="h-3.5 w-3.5" /> Edit Assumptions
              </button>
              <button onClick={resetAssumptions} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </>
          )}
        </div>
      </div>

      {!editing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Cells are locked. Click "Edit Assumptions" to modify.
        </div>
      )}

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
        {[
          { label: 'Receita Bruta', value: formatCurrency(model.years[selectedYear].grossRevenue * 1000) },
          { label: 'EBITDA', value: formatCurrency(model.years[selectedYear].ebitda * 1000) },
          { label: 'Margem Bruta', value: `${model.years[selectedYear].grossMarginPct}%` },
          { label: 'Margem EBITDA', value: `${model.years[selectedYear].ebitdaMarginPct}%` },
          { label: 'Clientes', value: model.years[selectedYear].totalClients.toLocaleString('pt-BR') },
          { label: 'Resultado Líq.', value: formatCurrency(model.years[selectedYear].netIncome * 1000) },
        ].map(kpi => (
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
            <BarChart data={activeYears.map(y => ({
              year: y,
              CaaS: model.years[y].caasRevenue,
              SaaS: model.years[y].saasRevenue,
              Education: model.years[y].educationRevenue,
              Expansão: model.years[y].baasRevenue,
              Tax: model.years[y].taxRevenue,
            }))}>
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
                  {activeYears.map(y => (
                    <th key={y} className={`text-right p-3 text-muted-foreground font-medium min-w-[80px] ${y === selectedYear ? 'bg-primary/5' : ''}`}>{y}</th>
                  ))}
                  
                </tr>
              </thead>
              <tbody>
                {CLIENTS_ROWS.map(group => (
                  <React.Fragment key={group.group}>
                    <tr className="bg-secondary/40 border-b border-border/50">
                      <td colSpan={activeYears.length + 1} className="p-2 text-xs font-bold text-foreground/80 uppercase tracking-wide">
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
                            {activeYears.map(y => (
                              <td key={y} className={`text-right p-3 tabular-nums text-sm ${y === selectedYear ? 'bg-primary/5 font-semibold' : ''}`}>
                                {row.dataKey ? (data.subProductClients[row.dataKey as SubProductKey]?.[y] ?? 0).toLocaleString('pt-BR') : '—'}
                              </td>
                            ))}
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
                              setAssumptions(prev => ({
                                ...prev,
                                tickets: { ...prev.tickets, [prodKey]: val },
                              }));
                            };
                            return (
                            <tr className="border-b border-border/30">
                              <td colSpan={activeYears.length + 2} className="px-5 py-4 bg-secondary/5">
                                <div className="space-y-4">
                                  {/* Annual targets */}
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground mb-2">Clientes por ano (target fim de ano)</p>
                                    <div className="grid grid-cols-6 gap-2">
                                      {activeYears.map(y => (
                                        <div key={y} className={`text-center p-2 rounded ${y === selectedYear ? 'bg-primary/10 border border-primary/30' : 'bg-card border border-border/50'}`}>
                                          <p className="text-[9px] text-muted-foreground font-medium mb-1">{y}</p>
                                          <input
                                            type="number"
                                            className="w-full bg-transparent text-center text-sm tabular-nums font-bold text-foreground outline-none border-b border-transparent hover:border-primary/30 focus:border-primary transition-colors"
                                            value={assumptions.subProductClients[prodKey]?.[y] ?? 0}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => directUpdateClients(y, Number(e.target.value) || 0)}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Monthly breakdown */}
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-xs font-semibold text-muted-foreground">Clientes mensais — {selectedYear}</p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-muted-foreground">Crescimento:</span>
                                        <input
                                          type="number"
                                          step="0.1"
                                          className="w-14 bg-secondary border border-border rounded px-1.5 py-0.5 text-right text-[10px] text-foreground outline-none focus:ring-1 focus:ring-primary"
                                          value={rowApplyPct[rowKey] ?? 6}
                                          onClick={e => e.stopPropagation()}
                                          onChange={e => setRowApplyPct(p => ({ ...p, [rowKey]: Number(e.target.value) || 0 }))}
                                        />
                                        <span className="text-[10px] text-muted-foreground">%</span>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleApplyRow(row.dataKey as SubProductKey, selectedYear); }}
                                          className="px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary border border-primary/30 rounded hover:bg-primary/20 transition-colors"
                                        >
                                          Aplicar
                                        </button>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-12 gap-1.5">
                                      {MONTHS.map((m, i) => {
                                        const hist = isHistorical(selectedYear, i);
                                        return (
                                          <div key={m} className={`text-center space-y-1 p-1.5 rounded ${hist ? 'bg-secondary/40 opacity-60' : 'bg-card border border-border/50'}`}>
                                            <p className="text-[9px] text-muted-foreground font-medium">{m}{hist ? ' 🔒' : ''}</p>
                                            {hist ? (
                                              <span className="block w-full text-center text-xs tabular-nums font-medium text-muted-foreground cursor-not-allowed" title="Período histórico — somente leitura">
                                                {monthly[i].toLocaleString('pt-BR')}
                                              </span>
                                            ) : (
                                              <MonthlyClientInput
                                                value={monthly[i]}
                                                className="w-full bg-transparent text-center text-xs tabular-nums font-medium outline-none border-b border-transparent hover:border-primary/30 focus:border-primary transition-colors text-foreground"
                                                onCommit={v => handleClientChange(row.dataKey as SubProductKey, selectedYear, i, v)}
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
                                          onChange={e => setRowTicketGrowthPct(p => ({ ...p, [prodKey]: Number(e.target.value) || 0 }))}
                                        />
                                        <span className="text-[10px] text-muted-foreground">%</span>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleApplyTicketGrowth(prodKey, selectedYear); }}
                                          className="px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary border border-primary/30 rounded hover:bg-primary/20 transition-colors"
                                        >
                                          Aplicar
                                        </button>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-12 gap-1.5">
                                      {MONTHS.map((m, i) => {
                                        const hist = isHistorical(selectedYear, i);
                                        const monthTicket = assumptions.monthlyTickets?.[prodKey]?.[selectedYear]?.[i] ?? ticketVal;
                                        return (
                                          <div key={m} className={`text-center space-y-1 p-1.5 rounded ${hist ? 'bg-secondary/40 opacity-60' : 'bg-card border border-border/50'}`}>
                                            <p className="text-[9px] text-muted-foreground font-medium">{m}{hist ? ' 🔒' : ''}</p>
                                            {hist ? (
                                              <span className="block w-full text-center text-xs tabular-nums font-medium text-muted-foreground cursor-not-allowed">
                                                {formatCurrencyFull(monthTicket)}
                                              </span>
                                            ) : (
                                              <MonthlyClientInput
                                                value={monthTicket}
                                                className="w-full bg-transparent text-center text-xs tabular-nums font-medium outline-none border-b border-transparent hover:border-primary/30 focus:border-primary transition-colors text-foreground"
                                                onCommit={v => {
                                                  const currentMonthlyTickets = assumptions.monthlyTickets ?? {};
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
                                                  setAssumptions(prev => ({
                                                    ...prev,
                                                    monthlyTickets: {
                                                      ...(prev.monthlyTickets ?? {}),
                                                      [prodKey]: {
                                                        ...((prev.monthlyTickets ?? {})[prodKey] ?? {}),
                                                        [selectedYear]: yearArr,
                                                      },
                                                    },
                                                  }));
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
                                        />
                                      </div>
                                      <span className="text-muted-foreground">Total ano: <strong className="text-foreground">{monthly.reduce((s, v) => s + v, 0).toLocaleString('pt-BR')}</strong></span>
                                      <span className="text-muted-foreground">Dez: <strong className="text-foreground">{monthly[11].toLocaleString('pt-BR')}</strong></span>
                                      {(() => {
                                        const decTicket = assumptions.monthlyTickets?.[prodKey]?.[selectedYear]?.[11] ?? ticketVal;
                                        return <span className="text-muted-foreground">MRR Dez: <strong className="text-foreground">{formatCurrencyFull(monthly[11] * decTicket)}</strong></span>;
                                      })()}
                                    </div>
                                  </div>

                                  {/* Receita Bruta Total */}
                                  <div className="space-y-2 pt-1">
                                    <p className="text-xs font-semibold text-muted-foreground">Receita Bruta (R$/mês) — {selectedYear}</p>
                                    <div className="grid grid-cols-12 gap-1.5">
                                      {MONTHS.map((m, i) => {
                                        const hist = isHistorical(selectedYear, i);
                                        const monthTicket = assumptions.monthlyTickets?.[prodKey]?.[selectedYear]?.[i] ?? ticketVal;
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
                                          const mt = assumptions.monthlyTickets?.[prodKey]?.[selectedYear]?.[i] ?? ticketVal;
                                          return sum + monthly[i] * mt;
                                        }, 0);
                                        const decTicket = assumptions.monthlyTickets?.[prodKey]?.[selectedYear]?.[11] ?? ticketVal;
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

                                  {/* Churn (clientes/mês) */}
                                  <div className="space-y-2 pt-1">
                                    <div className="flex items-center gap-4">
                                      <p className="text-xs font-semibold text-negative">Churn (clientes/mês) — {selectedYear}</p>
                                      <button
                                        className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${data.churnNotApplicable?.[prodKey] ? 'bg-muted text-muted-foreground ring-1 ring-border' : 'bg-secondary/60 text-muted-foreground/60 hover:bg-secondary'}`}
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
                                      {!data.churnNotApplicable?.[prodKey] && (
                                        <div className="ml-auto flex items-center gap-2">
                                          <span className="text-[10px] text-muted-foreground">Taxa de churn:</span>
                                          <input
                                            type="number"
                                            step="0.5"
                                            className="w-16 bg-secondary border border-border rounded px-2 py-0.5 text-right text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                                            value={rowChurnPct[prodKey] ?? (() => {
                                              const rate = getChurnMonthly(prodKey, data, selectedYear);
                                              return Math.round(rate * 12 * 100 * 10) / 10;
                                            })()}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => setRowChurnPct(prev => ({ ...prev, [prodKey]: Number(e.target.value) || 0 }))}
                                          />
                                          <span className="text-[10px] text-muted-foreground">% a.a.</span>
                                          <button
                                            className="px-2 py-0.5 text-[10px] font-semibold rounded bg-negative/20 text-negative hover:bg-negative/30 transition-colors"
                                            onClick={e => {
                                              e.stopPropagation();
                                              const pct = rowChurnPct[prodKey] ?? (() => {
                                                const rate = getChurnMonthly(prodKey, data, selectedYear);
                                                return Math.round(rate * 12 * 100 * 10) / 10;
                                              })();
                                              setAssumptions(prev => ({
                                                ...prev,
                                                monthlyChurnRates: {
                                                  ...(prev.monthlyChurnRates ?? {}),
                                                  [prodKey]: {
                                                    ...((prev.monthlyChurnRates ?? {})[prodKey] ?? {}),
                                                    [selectedYear]: pct,
                                                  },
                                                },
                                              }));
                                            }}
                                          >
                                            Aplicar
                                          </button>
                                        </div>
                                      )}
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
                                          const churnRate = getChurnMonthly(prodKey, data, selectedYear);
                                          const prev = i === 0
                                            ? (selectedYear === 2025 ? 0 : Math.round(getMonthlyClients(prodKey, (selectedYear - 1) as Year, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11]))
                                            : monthly[i - 1];
                                          const churnVal = Math.round(prev * churnRate);
                                          return (
                                            <div key={m} className={`text-center space-y-1 p-1.5 rounded ${hist ? 'bg-secondary/40 opacity-60' : 'bg-negative/5 border border-negative/20'}`}>
                                              <p className="text-[9px] text-muted-foreground font-medium">{m}{hist ? ' 🔒' : ''}</p>
                                              <span className="block w-full text-center text-xs tabular-nums font-medium text-negative">
                                                {churnVal || '—'}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-6 text-xs">
                                      {data.churnNotApplicable?.[prodKey] ? (
                                        <span className="text-muted-foreground italic">Não se aplica</span>
                                      ) : (
                                        (() => {
                                          const churnRate = getChurnMonthly(prodKey, data, selectedYear);
                                          const totalChurn = MONTHS.reduce((sum, _, i) => {
                                            const prev = i === 0
                                              ? (selectedYear === 2025 ? 0 : Math.round(getMonthlyClients(prodKey, (selectedYear - 1) as Year, data.subProductClients, data.tickets, data.monthlyClientOverrides)[11]))
                                              : monthly[i - 1];
                                            return sum + Math.round(prev * churnRate);
                                          }, 0);
                                          return <span className="text-negative">Total ano: <strong>{totalChurn.toLocaleString('pt-BR')}</strong> clientes perdidos</span>;
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
                  </React.Fragment>
                ))}

                {/* ── Novos Clientes por produto ── */}
                <tr className="bg-secondary/40 border-b border-border/50">
                  <td colSpan={showGrowthPct ? 27 : 15} className="p-2 text-xs font-bold text-foreground/80 uppercase tracking-wide">
                    Novos Clientes
                  </td>
                </tr>
                {CLIENTS_ROWS.flatMap(group => group.items.filter(r => r.dataKey)).map(row => {
                  const rowKey = row.dataKey!;
                  const growthArr = growthRates[selectedYear]?.[rowKey] ?? Array(12).fill(0.06);
                  const churn = getChurnMonthly(rowKey, data, selectedYear);
                  const monthly = getMonthlyClients(rowKey, selectedYear, data.subProductClients, data.tickets, data.monthlyClientOverrides).map(v => Math.round(v));
                  const newClients = monthly.map((val, i) => {
                    if (i === 0) {
                      let prevBase: number;
                      if (selectedYear === 2025) prevBase = 0;
                      else if (selectedYear === 2026) prevBase = Math.round(getMonthlyClients(rowKey, 2025, data.subProductClients, undefined, data.monthlyClientOverrides)[11]);
                      else prevBase = Math.round(getMonthlyClients(rowKey, (selectedYear - 1) as Year, data.subProductClients, undefined, data.monthlyClientOverrides)[11]);
                      return Math.max(0, val - prevBase);
                    }
                    return Math.max(0, val - monthly[i - 1]);
                  });
                  return (
                    <tr key={`new-${rowKey}`} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                      <td className="p-2 pl-5 font-medium text-xs text-emerald-500">{row.label}</td>
                      {MONTHS.map((_, i) => {
                        const hist = isHistorical(selectedYear, i);
                        const cutoff = selectedYear === 2026 && i === 2;
                        return (
                          <React.Fragment key={i}>
                            <td className={`text-right px-1 py-1 tabular-nums text-xs text-emerald-500/80${cutoff ? ' border-l-2 border-primary/40' : ''}${hist ? ' bg-secondary/30' : ''}`}>
                              {newClients[i] || '—'}
                            </td>
                            {showGrowthPct && <td className="text-right px-1 py-1" />}
                          </React.Fragment>
                        );
                      })}
                      <td className="text-right px-2 py-1 tabular-nums text-xs font-semibold text-emerald-500 bg-primary/5">
                        {newClients.reduce((s, v) => s + v, 0).toLocaleString('pt-BR')}
                      </td>
                      {showGrowthPct && <td />}
                    </tr>
                  );
                })}



                {/* ── Totais: Novos Clientes e Churn ── */}
                {(() => {
                  const allProducts = CLIENTS_ROWS.flatMap(g => g.items.filter(r => r.dataKey));
                  const totalNew = Array(12).fill(0);
                  const totalChurn = Array(12).fill(0);
                  for (const row of allProducts) {
                    const rowKey = row.dataKey!;
                    const churnRate = getChurnMonthly(rowKey, data, selectedYear);
                    const monthly = getMonthlyClients(rowKey, selectedYear, data.subProductClients, data.tickets, data.monthlyClientOverrides).map(v => Math.round(v));
                    for (let i = 0; i < 12; i++) {
                      const prev = i === 0
                        ? (selectedYear === 2025 ? 0 : selectedYear === 2026
                          ? Math.round(getMonthlyClients(rowKey, 2025, data.subProductClients, undefined, data.monthlyClientOverrides)[11])
                          : Math.round(getMonthlyClients(rowKey, (selectedYear - 1) as Year, data.subProductClients, undefined, data.monthlyClientOverrides)[11]))
                        : monthly[i - 1];
                      totalNew[i] += Math.max(0, monthly[i] - prev);
                      totalChurn[i] += Math.round(prev * churnRate);
                    }
                  }
                  return (
                    <>
                      <tr className="bg-primary/5 border-b border-border font-bold">
                        <td className="p-2 text-xs text-emerald-500 italic">Novos Clientes</td>
                        {MONTHS.map((_, i) => {
                          const cutoff = selectedYear === 2026 && i === 2;
                          return (
                            <React.Fragment key={i}>
                              <td className={`text-right px-1 py-1 tabular-nums text-xs font-bold text-emerald-500${cutoff ? ' border-l-2 border-primary/40' : ''}`}>
                                {totalNew[i] || '—'}
                              </td>
                              {showGrowthPct && <td />}
                            </React.Fragment>
                          );
                        })}
                        <td className="text-right px-2 py-1 tabular-nums text-xs font-bold text-emerald-500 bg-primary/5">
                          {totalNew.reduce((s: number, v: number) => s + v, 0).toLocaleString('pt-BR')}
                        </td>
                        {showGrowthPct && <td />}
                      </tr>
                      <tr className="bg-primary/5 border-b border-border font-bold">
                        <td className="p-2 text-xs text-negative italic">Churn</td>
                        {MONTHS.map((_, i) => {
                          const cutoff = selectedYear === 2026 && i === 2;
                          return (
                            <React.Fragment key={i}>
                              <td className={`text-right px-1 py-1 tabular-nums text-xs font-bold text-negative${cutoff ? ' border-l-2 border-primary/40' : ''}`}>
                                {totalChurn[i] || '—'}
                              </td>
                              {showGrowthPct && <td />}
                            </React.Fragment>
                          );
                        })}
                        <td className="text-right px-2 py-1 tabular-nums text-xs font-bold text-negative bg-primary/5">
                          {totalChurn.reduce((s: number, v: number) => s + v, 0).toLocaleString('pt-BR')}
                        </td>
                        {showGrowthPct && <td />}
                      </tr>
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>




        </TabsContent>

        {/* ─── BLOCO 2: TAX DEDUCTIONS ─── */}
        <TabsContent value="tax" className="space-y-6 mt-4">

          {/* Toggle IRPJ/CSLL */}
          <div className="gradient-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">Impostos sobre Lucro</h3>
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground whitespace-nowrap">IRPJ/CSLL (imposto sobre lucro)</label>
              <button
                onClick={() => {
                  const next = !data.taxEnabled;
                  if (editing) {
                    setEditState(prev => ({ ...prev, taxEnabled: next }));
                  } else {
                    setAssumptions({ ...assumptions, taxEnabled: next });
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  data.taxEnabled ? 'bg-primary' : 'bg-secondary border border-border'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  data.taxEnabled ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
              <span className="text-xs font-medium">{data.taxEnabled ? 'Ativo' : 'Zerado'}</span>
            </div>
          </div>

          {/* Regime Tributário */}
          <div className="gradient-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Scale className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Regime Tributário</h3>
              <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary">Transição em 2027</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <BadgePercent className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-foreground">Lucro Presumido (2025–2026)</p>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>PIS 0,65% + COFINS 3,0% + ISS 5,0% + Descontos 1,0%</p>
                  <p className="text-sm font-semibold text-foreground">Taxa total: 9,65%</p>
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <BadgePercent className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-foreground">Lucro Real (2027–2030)</p>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>PIS 1,65% + COFINS 7,6% + ISS 5,0% + Descontos 1,0%</p>
                  <p className="text-sm font-semibold text-foreground">Taxa total: 15,25%</p>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 mt-3 text-[11px] text-muted-foreground">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <span>IRPJ 25% + CSLL 9% = 34% sobre lucro tributável (EBT). Aplicado em ambos os regimes.</span>
            </div>
          </div>

        </TabsContent>

        {/* ─── BLOCO 3: COS (Cost of Service) ─── */}
        <TabsContent value="cos" className="space-y-6 mt-4">

          {/* Custo Equipe Education/Expansão */}
          <div className="gradient-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">Custos Operacionais Diretos</h3>
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Custo Equipe Education/Expansão (%)</label>
              <input
                type="number"
                step="0.01"
                className="w-20 bg-secondary border border-border rounded px-2 py-1 text-right text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                value={((data.eduExpansaoTeamRate ?? 0.15) * 100).toFixed(0)}
                onChange={e => {
                  const v = (Number(e.target.value) || 0) / 100;
                  if (editing) {
                    setEditState(prev => ({ ...prev, eduExpansaoTeamRate: v }));
                  } else {
                    setAssumptions({ ...assumptions, eduExpansaoTeamRate: v });
                  }
                }}
              />
              <span className="text-xs text-muted-foreground">% do faturamento</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">CAPEX % do COGS SaaS</p>
                <p className="text-sm font-semibold">50% (2025–26) → 30% (2027+)</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">BaaS COGS/cliente</p>
                <p className="text-sm font-semibold">R$ 25/mês (a partir de 2025)</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">PDD (Provisão p/ Devedores)</p>
                <p className="text-sm font-semibold">2% da receita bruta</p>
              </div>
            </div>
          </div>

          {/* Squad Operação Config */}
          <div className="gradient-card p-5 space-y-4">
            {(() => {
              const rawSq = data.squadConfig ?? DEFAULT_ASSUMPTIONS.squadConfig!;
              const defaults = DEFAULT_ASSUMPTIONS.squadConfig!;
              const sq = Object.fromEntries(
                Object.keys(defaults).map(k => [k, (rawSq as Record<string, number>)[k] != null && !Number.isNaN((rawSq as Record<string, number>)[k]) ? (rawSq as Record<string, number>)[k] : (defaults as Record<string, number>)[k]])
              ) as typeof defaults;
              const updateSquad = (field: string, val: number) => {
                const newSq = { ...sq, [field]: val };
                if (editing) {
                  setEditState(prev => ({ ...prev, squadConfig: newSq }));
                } else {
                  setAssumptions(prev => ({ ...prev, squadConfig: newSq }));
                }
              };

              const cfoSquadCost = sq.cfoSalary + sq.cfoAnalistasPerSquad * sq.cfoAnalistaSalary;
              const setupSquadCost = sq.setupAnalistaSalary + sq.setupImplPerSquad * sq.setupImplSalary + (sq.setupLiderSalary / sq.setupSquadsPerLider);

              const yearImpact = activeYears.map(y => {
                const yr = model.years[y];
                const caasEnd = data.caasClients[y] ?? 0;
                const numCfoSquads = Math.max(1, Math.ceil(caasEnd / Math.max(1, sq.cfoClientsPerSquad)));
                const cfoTotal = numCfoSquads * cfoSquadCost;
                const cfoHC = numCfoSquads * (1 + sq.cfoAnalistasPerSquad);
                const numCS = Math.max(1, Math.ceil(yr.totalClients / Math.max(1, sq.csPerClients)));
                const csTotal = numCS * sq.csSalary;
                const saasThis = (data.subProductClients.saasOxy?.[y] ?? 0) + (data.subProductClients.saasOxyGenio?.[y] ?? 0);
                const saasPrev = y > 2025 ? (data.subProductClients.saasOxy?.[(y - 1) as Year] ?? 0) + (data.subProductClients.saasOxyGenio?.[(y - 1) as Year] ?? 0) : 0;
                const newSaasMonth = Math.max(0, (saasThis - saasPrev) / 12);
                const numSetupSquads = Math.max(1, Math.ceil(newSaasMonth / Math.max(1, sq.setupSetupsPerSquad)));
                const setupTotal = numSetupSquads * (sq.setupAnalistaSalary + sq.setupImplPerSquad * sq.setupImplSalary);
                const setupHC = numSetupSquads * (1 + sq.setupImplPerSquad);
                const numLideres = Math.max(1, Math.ceil(numSetupSquads / Math.max(1, sq.setupSquadsPerLider)));
                const liderTotal = numLideres * sq.setupLiderSalary;
                const monthCost = cfoTotal + csTotal + setupTotal + liderTotal;
                const totalHC = cfoHC + numCS + setupHC + numLideres;
                return { year: y, caasEnd, clients: yr.totalClients, numCfoSquads, cfoHC, numCS, numSetupSquads, setupHC, numLideres, totalHC, monthCost, annualCost: monthCost * 12, newSaasMonth: Math.round(newSaasMonth) };
              });

              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Squad CaaS */}
                    <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                      <p className="text-xs font-bold text-foreground/80 uppercase tracking-wide">SQUAD CAAS</p>
                      <p className="text-[10px] text-muted-foreground">1 Diretor + 1 CFO + 1 FP&A Analista por squad, cada squad aguenta {sq.cfoClientsPerSquad} clientes CaaS</p>
                      <p className="text-[10px] text-muted-foreground">Custo squad: {formatCurrencyFull(cfoSquadCost)}/mês | CS: 1 a cada {sq.csPerClients} clientes @ {formatCurrencyFull(sq.csSalary)}/mês</p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Diretor (R$/mês)</label>
                          <input type="number" className="w-full bg-card border border-border rounded px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary" value={sq.cfoSalary} onChange={e => updateSquad('cfoSalary', Number(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">CFO (R$/mês)</label>
                          <input type="number" className="w-full bg-card border border-border rounded px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary" value={sq.cfoAnalistaSalary} onChange={e => updateSquad('cfoAnalistaSalary', Number(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">CFO + FP&A / squad</label>
                          <input type="number" className="w-full bg-card border border-border rounded px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary" value={sq.cfoAnalistasPerSquad} onChange={e => updateSquad('cfoAnalistasPerSquad', Number(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Clientes CaaS/squad</label>
                          <input type="number" className="w-full bg-card border border-border rounded px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary" value={sq.cfoClientsPerSquad} onChange={e => updateSquad('cfoClientsPerSquad', Number(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">CS (R$/mês)</label>
                          <input type="number" className="w-full bg-card border border-border rounded px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary" value={sq.csSalary} onChange={e => updateSquad('csSalary', Number(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Clientes/CS</label>
                          <input type="number" className="w-full bg-card border border-border rounded px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary" value={sq.csPerClients} onChange={e => updateSquad('csPerClients', Number(e.target.value) || 0)} />
                        </div>
                      </div>
                    </div>

                    {/* Squad Setup SaaS */}
                    <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                      <p className="text-xs font-bold text-foreground/80 uppercase tracking-wide">SQUAD SETUP SAAS</p>
                      <p className="text-[10px] text-muted-foreground">1 analista + {sq.setupImplPerSquad} impl = {formatCurrencyFull(setupSquadCost)}/mês por squad</p>
                      <p className="text-[10px] text-muted-foreground">Cada squad aguenta {sq.setupSetupsPerSquad} setups/mês. Líder cuida de {sq.setupSquadsPerLider} squads.</p>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Analista/Impl (R$/mês)</label>
                          <input type="number" className="w-full bg-card border border-border rounded px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary" value={sq.setupImplSalary} onChange={e => { updateSquad('setupImplSalary', Number(e.target.value) || 0); updateSquad('setupAnalistaSalary', Number(e.target.value) || 0); }} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Impl/squad</label>
                          <input type="number" className="w-full bg-card border border-border rounded px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary" value={sq.setupImplPerSquad} onChange={e => updateSquad('setupImplPerSquad', Number(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Setups/squad/mês</label>
                          <input type="number" className="w-full bg-card border border-border rounded px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary" value={sq.setupSetupsPerSquad} onChange={e => updateSquad('setupSetupsPerSquad', Number(e.target.value) || 0)} />
                        </div>
                        <div className="space-y-0.5">
                          <label className="text-[9px] text-muted-foreground">Líder (R$/mês)</label>
                          <input type="number" className="w-full bg-card border border-border rounded px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary" value={sq.setupLiderSalary} onChange={e => updateSquad('setupLiderSalary', Number(e.target.value) || 0)} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Impact per year table */}
                  <div className="pt-3">
                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">Impacto por Ano</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left px-2 py-2 text-muted-foreground font-medium">Ano</th>
                            <th className="text-right px-2 py-2 text-muted-foreground font-medium">Clientes CaaS</th>
                            <th className="text-right px-2 py-2 text-muted-foreground font-medium">Squads CFO</th>
                            <th className="text-right px-2 py-2 text-muted-foreground font-medium">Total Clientes</th>
                            <th className="text-right px-2 py-2 text-muted-foreground font-medium">Nº CS</th>
                            <th className="text-right px-2 py-2 text-muted-foreground font-medium">Novos SaaS/mês</th>
                            <th className="text-right px-2 py-2 text-muted-foreground font-medium">Squads Setup</th>
                            <th className="text-right px-2 py-2 text-muted-foreground font-medium">Líderes</th>
                            <th className="text-right px-2 py-2 text-muted-foreground font-medium">HC Total</th>
                            <th className="text-right px-2 py-2 text-muted-foreground font-medium">Custo/Mês</th>
                            <th className="text-right px-2 py-2 text-muted-foreground font-medium">Custo/Ano</th>
                            <th className="text-right px-2 py-2 text-muted-foreground font-medium">% Receita</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yearImpact.map(yi => {
                            const revPct = model.years[yi.year].grossRevenue > 0
                              ? ((yi.annualCost / 1000) / model.years[yi.year].grossRevenue * 100).toFixed(1)
                              : '—';
                            return (
                              <tr key={yi.year} className={`border-b border-border/30 hover:bg-secondary/20 ${yi.year === selectedYear ? 'bg-primary/5' : ''}`}>
                                <td className="px-2 py-2 font-medium">{yi.year}</td>
                                <td className="text-right px-2 py-2 tabular-nums">{yi.caasEnd.toLocaleString('pt-BR')}</td>
                                <td className="text-right px-2 py-2 tabular-nums">{yi.numCfoSquads}</td>
                                <td className="text-right px-2 py-2 tabular-nums">{yi.clients.toLocaleString('pt-BR')}</td>
                                <td className="text-right px-2 py-2 tabular-nums">{yi.numCS}</td>
                                <td className="text-right px-2 py-2 tabular-nums">{yi.newSaasMonth}</td>
                                <td className="text-right px-2 py-2 tabular-nums">{yi.numSetupSquads}</td>
                                <td className="text-right px-2 py-2 tabular-nums">{yi.numLideres}</td>
                                <td className="text-right px-2 py-2 tabular-nums font-medium">{yi.totalHC}</td>
                                <td className="text-right px-2 py-2 tabular-nums">{formatCurrencyFull(yi.monthCost)}</td>
                                <td className="text-right px-2 py-2 tabular-nums font-medium">{formatCurrency(yi.annualCost)}</td>
                                <td className="text-right px-2 py-2 tabular-nums">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    Number(revPct) > 10 ? 'bg-red-500/15 text-red-400' :
                                    Number(revPct) > 5 ? 'bg-amber-500/15 text-amber-500' :
                                    'bg-emerald-500/15 text-emerald-500'
                                  }`}>{revPct}%</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Headcount Projetado por Área */}
          {(() => {
            const data = editing ? editState : assumptions;
            const hcData = editing ? editState : assumptions;
            const ratios = hcData.headcountRatios;
            const salaries = hcData.salaryRanges;

            const subProductKeys = Object.keys(hcData.subProductClients) as SubProductKey[];
            const monthlyTotals: number[] = Array.from({ length: 12 }, (_, m) => {
              return subProductKeys.reduce((sum, key) => {
                const monthly = getMonthlyClients(key, selectedYear, hcData.subProductClients);
                return sum + monthly[m];
              }, 0);
            });

            const PROJECTED_ROLES = [
              { key: 'cfos', label: 'CFOs', bu: 'CaaS', ratioKey: 'clientsPerCFO' as const, salaryKey: 'CFO', baseCount: namedEmployees2025.filter(e => e.role === 'CFO').length },
              { key: 'fpa', label: 'FP&A Analysts', bu: 'CaaS', ratioKey: 'clientsPerFPA' as const, salaryKey: 'FP&A Analyst', baseCount: namedEmployees2025.filter(e => e.role === 'FP&A').length },
              { key: 'pf', label: 'Project Finance Directors', bu: 'CaaS', ratioKey: 'clientsPerPF' as const, salaryKey: 'Project Finance Director', baseCount: 0 },
              { key: 'projectAnalyst', label: 'Project Analysts', bu: 'CaaS', ratioKey: 'clientsPerProjectAnal' as const, salaryKey: 'Project Analyst', baseCount: 0 },
              { key: 'dataAnalyst', label: 'Data Analysts', bu: 'SaaS', ratioKey: 'clientsPerDataAnal' as const, salaryKey: 'Data Processes Analyst', baseCount: 0 },
              { key: 'csm', label: 'Customer Service', bu: 'Operations', ratioKey: 'clientsPerCSM' as const, salaryKey: 'Customer Service', baseCount: namedEmployees2025.filter(e => e.role === 'Customer Svc').length },
              { key: 'sdr', label: 'SDRs', bu: 'Commercial', ratioKey: 'clientsPerSDR' as const, salaryKey: 'SDR', baseCount: namedEmployees2025.filter(e => e.role === 'SDR').length },
              { key: 'head', label: 'Head Comercial', bu: 'Commercial', ratioKey: 'clientsPerCommercialHead' as const, salaryKey: 'Head Comercial', baseCount: namedEmployees2025.filter(e => e.role === 'Commercial').length },
            ];

            const computeQty = (role: typeof PROJECTED_ROLES[0], totalClients: number) => {
              const ratio = ratios[role.ratioKey];
              return Math.max(role.baseCount, Math.ceil(totalClients / ratio));
            };

            return (
              <div className="gradient-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">Headcount Projetado por Área — {selectedYear}</h3>
                  </div>
                  <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
                    <button
                      onClick={() => setHcViewMode('people')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${hcViewMode === 'people' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Pessoas
                    </button>
                    <button
                      onClick={() => setHcViewMode('cost')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${hcViewMode === 'cost' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Custo
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="sticky left-0 z-10 bg-card text-left px-3 py-2 text-muted-foreground font-medium text-xs min-w-[180px]">Cargo</th>
                        <th className="text-left px-2 py-2 text-muted-foreground font-medium text-xs min-w-[80px]">BU</th>
                        {MONTHS.map(m => (
                          <th key={m} className="text-right px-2 py-2 text-muted-foreground font-medium text-xs min-w-[64px]">{m}</th>
                        ))}
                        <th className="text-right px-3 py-2 text-muted-foreground font-medium text-xs min-w-[80px]">Média</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PROJECTED_ROLES.map(role => {
                        const monthlyQty = monthlyTotals.map(t => computeQty(role, t));
                        const salary = salaries[role.salaryKey] ?? 0;
                        const avg = Math.round(monthlyQty.reduce((a, b) => a + b, 0) / 12);
                        return (
                          <tr key={role.key} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                            <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium text-xs">{role.label}</td>
                            <td className="px-2 py-1.5 text-xs text-muted-foreground">{role.bu}</td>
                            {monthlyQty.map((qty, i) => (
                              <td key={i} className="text-right px-2 py-1.5 tabular-nums text-xs">
                                {hcViewMode === 'people' ? qty : formatCurrencyFull(qty * salary)}
                              </td>
                            ))}
                            <td className="text-right px-3 py-1.5 tabular-nums text-xs font-medium">
                              {hcViewMode === 'people' ? avg : formatCurrencyFull(avg * salary)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-border bg-primary/5 font-bold">
                        <td className="sticky left-0 z-10 bg-primary/5 px-3 py-2 text-xs" colSpan={2}>Total</td>
                        {MONTHS.map((_, i) => {
                          const totalQty = PROJECTED_ROLES.reduce((s, role) => s + computeQty(role, monthlyTotals[i]), 0);
                          const totalCost = PROJECTED_ROLES.reduce((s, role) => {
                            const qty = computeQty(role, monthlyTotals[i]);
                            return s + qty * (salaries[role.salaryKey] ?? 0);
                          }, 0);
                          return (
                            <td key={i} className="text-right px-2 py-2 tabular-nums text-xs">
                              {hcViewMode === 'people' ? totalQty : formatCurrencyFull(totalCost)}
                            </td>
                          );
                        })}
                        <td className="text-right px-3 py-2 tabular-nums text-xs">
                          {(() => {
                            const avgTotal = Math.round(MONTHS.reduce((s, _, i) => s + PROJECTED_ROLES.reduce((ss, role) => ss + computeQty(role, monthlyTotals[i]), 0), 0) / 12);
                            const avgCost = Math.round(MONTHS.reduce((s, _, i) => s + PROJECTED_ROLES.reduce((ss, role) => ss + computeQty(role, monthlyTotals[i]) * (salaries[role.salaryKey] ?? 0), 0), 0) / 12);
                            return hcViewMode === 'people' ? avgTotal : formatCurrencyFull(avgCost);
                          })()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Regras de Contratação */}
          <div className="gradient-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Regras de Contratação (Headcount)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Proporção por clientes ativos</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 text-muted-foreground font-medium text-xs">Função</th>
                      <th className="text-right py-1.5 text-muted-foreground font-medium text-xs">1 por cada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      { label: 'CFO', ratioKey: 'clientsPerCFO' as const },
                      { label: 'FP&A Analyst', ratioKey: 'clientsPerFPA' as const },
                      { label: 'Project Finance Director', ratioKey: 'clientsPerPF' as const },
                      { label: 'Project Analyst', ratioKey: 'clientsPerProjectAnal' as const },
                      { label: 'Data Processes Analyst', ratioKey: 'clientsPerDataAnal' as const },
                      { label: 'Customer Service Manager', ratioKey: 'clientsPerCSM' as const },
                      { label: 'SDR', ratioKey: 'clientsPerSDR' as const },
                      { label: 'Head Comercial', ratioKey: 'clientsPerCommercialHead' as const },
                    ] as const).map(row => {
                      const data = editing ? editState : assumptions;
                      const val = data.headcountRatios[row.ratioKey];
                      return (
                        <tr key={row.label} className="border-b border-border/30">
                          <td className="py-1.5 text-xs font-medium">{row.label}</td>
                          <td className="py-1.5 text-right text-xs tabular-nums">
                            {editing ? (
                              <input
                                type="number"
                                className="w-20 bg-secondary border border-primary/30 rounded px-2 py-0.5 text-right text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                                value={val}
                                onChange={e => {
                                  const v = Number(e.target.value) || 1;
                                  setEditState(prev => ({
                                    ...prev,
                                    headcountRatios: { ...prev.headcountRatios, [row.ratioKey]: v },
                                  }));
                                }}
                              />
                            ) : (
                              <>{val} clientes</>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Faixas salariais para novas contratações</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 text-muted-foreground font-medium text-xs">Cargo</th>
                      <th className="text-right py-1.5 text-muted-foreground font-medium text-xs">Salário/mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries((editing ? editState : assumptions).salaryRanges).map(([role, salary]) => (
                      <tr key={role} className="border-b border-border/30">
                        <td className="py-1.5 text-xs font-medium">{role}</td>
                        <td className="py-1.5 text-right text-xs tabular-nums">
                          {editing ? (
                            <input
                              type="number"
                              className="w-24 bg-secondary border border-primary/30 rounded px-2 py-0.5 text-right text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                              value={salary}
                              onChange={e => {
                                const v = Number(e.target.value) || 0;
                                setEditState(prev => ({
                                  ...prev,
                                  salaryRanges: { ...prev.salaryRanges, [role]: v },
                                }));
                              }}
                            />
                          ) : (
                            formatCurrencyFull(salary as number)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </TabsContent>

        {/* ─── BLOCO 4: SG&A ─── */}
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
                <label className="text-xs text-muted-foreground whitespace-nowrap min-w-[120px]">PR (R$/mês)</label>
                <input type="number" className="w-32 bg-secondary border border-border rounded px-2 py-1 text-right text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                  value={data.marketingPR ?? 0}
                  onChange={e => {
                    const v = Number(e.target.value) || 0;
                    if (editing) { setEditState(prev => ({ ...prev, marketingPR: v })); }
                    else { setAssumptions({ ...assumptions, marketingPR: v }); }
                  }}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-muted-foreground whitespace-nowrap min-w-[120px]">Eventos (R$/mês)</label>
                <input type="number" className="w-32 bg-secondary border border-border rounded px-2 py-1 text-right text-xs tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                  value={data.marketingEvents ?? 0}
                  onChange={e => {
                    const v = Number(e.target.value) || 0;
                    if (editing) { setEditState(prev => ({ ...prev, marketingEvents: v })); }
                    else { setAssumptions({ ...assumptions, marketingEvents: v }); }
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
                            if (editing) { setEditState(prev => ({ ...prev, cacPerProduct: newCac })); }
                            else { setAssumptions({ ...assumptions, cacPerProduct: newCac }); }
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
                      value={data.sgaPercent} onChange={e => setEditState(p => ({ ...p, sgaPercent: Number(e.target.value) || 0 }))} />
                  ) : <span>{data.sgaPercent}%</span>}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">SG&A Annual Growth %</p>
                <div className="text-sm font-semibold">
                  {editing ? (
                    <input type="number" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                      value={data.sgaGrowthRate} onChange={e => setEditState(p => ({ ...p, sgaGrowthRate: Number(e.target.value) || 0 }))} />
                  ) : <span>{data.sgaGrowthRate}%</span>}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Headcount Cost Growth/yr</p>
                <div className="text-sm font-semibold">
                  {editing ? (
                    <input type="number" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                      value={data.headcountGrowth} onChange={e => setEditState(p => ({ ...p, headcountGrowth: Number(e.target.value) || 0 }))} />
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

      {/* Save Modal */}
      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save Assumptions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">
                Why are you changing this assumption? <span className="text-negative">*</span>
              </label>
              <textarea
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
                rows={3}
                placeholder="Describe the rationale for this change..."
                value={saveNote}
                onChange={e => setSaveNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button
                disabled={!saveNote.trim()}
                onClick={confirmSave}
                className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Confirm &amp; Save Version
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
