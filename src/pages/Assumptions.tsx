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
      { label: 'Parceiros',               dataKey: null },
      { label: 'BPO Financeiro',          dataKey: 'caasSetup' },
    ],
  },
  {
    group: 'SaaS',
    items: [
      { label: 'Oxy',                         dataKey: 'saasOxy' },
      { label: 'Oxy + Gênio',                 dataKey: 'saasOxyGenio' },
      { label: 'Setup',                        dataKey: null },
      { label: 'Parceiros',                    dataKey: null },
      { label: 'Oxy + Gênio + Especialista',  dataKey: null },
    ],
  },
  {
    group: 'Education',
    items: [
      { label: 'Dono CFO',                dataKey: 'educationDonoCFO' },
      { label: 'Engenheiro de Negócios',   dataKey: null },
      { label: 'Financeiro Raiz',          dataKey: null },
      { label: 'Finance Sales Program',    dataKey: null },
    ],
  },
  {
    group: 'Expansão',
    items: [
      { label: 'Assinatura', dataKey: 'baas' },
      { label: 'Franquia',                       dataKey: null },
      { label: 'Master Franquia',                dataKey: null },
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
      { label: 'Parceiros',               dataKey: null,              staticValue: 0 },
      { label: 'BPO Financeiro',          dataKey: 'caasSetup',       staticValue: 15000 },
    ],
  },
  {
    group: 'SaaS',
    items: [
      { label: 'Oxy',                         dataKey: 'saasOxy',      staticValue: 1297 },
      { label: 'Oxy + Gênio',                 dataKey: 'saasOxyGenio', staticValue: 1997 },
      { label: 'Setup',                        dataKey: null,           staticValue: 15000 },
      { label: 'Parceiros',                    dataKey: null,           staticValue: 0 },
      { label: 'Oxy + Gênio + Especialista',  dataKey: null,           staticValue: 0 },
    ],
  },
  {
    group: 'Education',
    items: [
      { label: 'Dono CFO',                dataKey: 'educationDonoCFO', staticValue: 3997 },
      { label: 'Engenheiro de Negócios',   dataKey: null, staticValue: 3997 },
      { label: 'Financeiro Raiz',          dataKey: null, staticValue: 3997 },
      { label: 'Finance Sales Program',    dataKey: null, staticValue: 497 },
    ],
  },
  {
    group: 'Expansão',
    items: [
      { label: 'Assinatura', dataKey: 'baas', staticValue: 229 },
      { label: 'Franquia',                       dataKey: null,   staticValue: 0 },
      { label: 'Master Franquia',                dataKey: null,   staticValue: 0 },
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

function getChurnMonthly(key: SubProductKey, data: AssumptionsType): number {
  if (key === 'caasAssessoria' || key === 'caasEnterprise' || key === 'caasCorporate' || key === 'caasSetup') {
    return data.churnCaas / 100 / 12;
  }
  if (key === 'saasOxy' || key === 'saasOxyGenio') {
    return data.churnSaas / 100 / 12;
  }
  if (key === 'educationDonoCFO') {
    return 0;
  }
  if (key === 'baas') {
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
          const churnRate = getChurnMonthly(k, data);
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
    const churnRate = getChurnMonthly(key, data);
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
              <Tooltip formatter={(v: number) => formatCurrency(v * 1000)} />
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
              Tax: data.taxClients[y],
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="CaaS" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="SaaS" stroke="hsl(210, 70%, 55%)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Education" stroke="hsl(150, 50%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Tax" stroke="hsl(280, 60%, 55%)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Tabs defaultValue="receita" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="tax">Tax Deductions</TabsTrigger>
          <TabsTrigger value="cos">COS</TabsTrigger>
          <TabsTrigger value="sga">SG&A</TabsTrigger>
          <TabsTrigger value="economic">Econ. & Financial</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-4">
          <div className="gradient-card p-6 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Revenue</h3>
            <p className="text-xs text-muted-foreground">Premissas de receita: clientes, tickets, churn e crescimento por BU.</p>
            <p className="text-xs text-muted-foreground italic mt-4">Em construção — configurar premissas bloco a bloco.</p>
          </div>
        </TabsContent>

        <TabsContent value="tax" className="mt-4">
          <div className="gradient-card p-6 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Tax Deductions</h3>
            <p className="text-xs text-muted-foreground">Deduções fiscais e impostos incidentes sobre a receita bruta.</p>
            <p className="text-xs text-muted-foreground italic mt-4">Em construção — configurar premissas bloco a bloco.</p>
          </div>
        </TabsContent>

        <TabsContent value="cos" className="mt-4">
          <div className="gradient-card p-6 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">COS (Cost of Service)</h3>
            <p className="text-xs text-muted-foreground">Custos diretos de prestação de serviço.</p>
            <p className="text-xs text-muted-foreground italic mt-4">Em construção — configurar premissas bloco a bloco.</p>
          </div>
        </TabsContent>

        <TabsContent value="sga" className="mt-4">
          <div className="gradient-card p-6 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">SG&A (Sales, General & Administration)</h3>
            <p className="text-xs text-muted-foreground">Despesas comerciais, gerais e administrativas.</p>
            <p className="text-xs text-muted-foreground italic mt-4">Em construção — configurar premissas bloco a bloco.</p>
          </div>
        </TabsContent>

        <TabsContent value="economic" className="mt-4">
          <div className="gradient-card p-6 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Economic and Financial Results</h3>
            <p className="text-xs text-muted-foreground">Resultados econômicos e financeiros: depreciação, juros, impostos sobre lucro.</p>
            <p className="text-xs text-muted-foreground italic mt-4">Em construção — configurar premissas bloco a bloco.</p>
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
