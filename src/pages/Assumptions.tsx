import React, { useState } from 'react';
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { useVersionHistory } from '@/contexts/VersionHistoryContext';
import { YEARS, Year, Assumptions as AssumptionsType, HEADCOUNT, SUB_PRODUCT_LABELS, SubProductClients } from '@/lib/financialData';
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
    group: 'CFO as a Service',
    items: [
      { label: 'Serviços Especializados', dataKey: 'caasAssessoria' },
      { label: 'Enterprise',              dataKey: 'caasEnterprise' },
      { label: 'Corporate',               dataKey: 'caasCorporate' },
      { label: 'Setup',                   dataKey: 'caasSetup' },
      { label: 'Parceiros',               dataKey: null },
    ],
  },
  {
    group: 'Software as a Service',
    items: [
      { label: 'Oxy + Gênio [SaaS]',  dataKey: 'saasOxy' },
      { label: 'Oxy + Gênio [CaaS]',  dataKey: 'saasOxyGenio' },
      { label: 'Setup',               dataKey: null },
      { label: 'Parceiros',           dataKey: null },
    ],
  },
  {
    group: 'Education',
    items: [
      { label: 'Turnaround',              dataKey: null },
      { label: 'Engenheiro de Negócios',  dataKey: null },
      { label: 'Financeiro 10x',          dataKey: null },
      { label: "FP&A na Prática",         dataKey: null },
      { label: 'Financeiro Raiz',         dataKey: null },
      { label: 'Dono CFO',                dataKey: 'educationDonoCFO' },
      { label: 'Finance Sales Program',   dataKey: null },
      { label: 'Jornada 40 em 4',         dataKey: null },
      { label: 'O2 Inc. para Empresas',   dataKey: null },
      { label: 'Treinamento In Company',  dataKey: null },
    ],
  },
  {
    group: 'Banking as a Service',
    items: [
      { label: 'Assinatura', dataKey: 'baas' },
      { label: 'Custódia',   dataKey: null },
      { label: 'n.a.',       dataKey: null },
      { label: 'Parceiros',  dataKey: null },
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
    group: 'CFO as a Service',
    items: [
      { label: 'Serviços Especializados', dataKey: 'caasAssessoria', staticValue: 25000 },
      { label: 'Enterprise',              dataKey: 'caasEnterprise',  staticValue: 6209 },
      { label: 'Corporate',               dataKey: 'caasCorporate',   staticValue: 13573 },
      { label: 'Setup',                   dataKey: 'caasSetup',       staticValue: 15000 },
      { label: 'Parceiros',               dataKey: null,              staticValue: 0 },
    ],
  },
  {
    group: 'Software as a Service',
    items: [
      { label: 'Oxy + Gênio [SaaS]', dataKey: 'saasOxy',     staticValue: 1297 },
      { label: 'Oxy + Gênio [CaaS]', dataKey: 'saasOxyGenio', staticValue: 1997 },
      { label: 'Setup',              dataKey: null,           staticValue: 15000 },
      { label: 'Parceiros',          dataKey: null,           staticValue: 0 },
    ],
  },
  {
    group: 'Education',
    items: [
      { label: 'Turnaround',             dataKey: null, staticValue: 14997 },
      { label: 'Engenheiro de Negócios', dataKey: null, staticValue: 3997 },
      { label: 'Financeiro 10x',         dataKey: null, staticValue: 9997 },
      { label: "FP&A na Prática",        dataKey: null, staticValue: 7997 },
      { label: 'Financeiro Raiz',        dataKey: null, staticValue: 3997 },
      { label: 'Dono CFO',               dataKey: 'educationDonoCFO', staticValue: 3997 },
      { label: 'Finance Sales Program',  dataKey: null, staticValue: 497 },
      { label: 'Jornada 40 em 4',        dataKey: null, staticValue: 35997 },
      { label: 'O2 Inc. para Empresas',  dataKey: null, staticValue: 9997 },
      { label: 'Treinamento In Company', dataKey: null, staticValue: 19997 },
    ],
  },
  {
    group: 'Banking as a Service',
    items: [
      { label: 'Assinatura', dataKey: 'baas', staticValue: 229 },
      { label: 'Custódia',   dataKey: null,   staticValue: 0.20 },
      { label: 'Parceiros',  dataKey: null,   staticValue: 0 },
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
  return 0;
}

function computeProjectedClients(
  key: SubProductKey,
  year: Year,
  growthArr: number[],
  monthlyChurn: number,
  subProductClients: SubProductClients,
  ticketPrices?: Partial<Record<SubProductKey, number>>,
): number[] {
  const historicalMonths = getMonthlyClients(key, year, subProductClients, ticketPrices).map(v => Math.round(v));

  if (year === 2025) {
    return historicalMonths;
  }

  let base: number;
  if (year === 2026) {
    base = historicalMonths[2]; // Mar 2026 (index 2) — last historical month
  } else {
    const prevYear = (year - 1) as Year;
    base = Math.round(getMonthlyClients(key, prevYear, subProductClients, ticketPrices)[11]);
  }

  const result: number[] = [];
  let prev = base;
  for (let m = 0; m < 12; m++) {
    if (isHistorical(year, m)) {
      result.push(historicalMonths[m]);
      prev = historicalMonths[m];
    } else {
      const next = Math.max(0, Math.round(prev * (1 + growthArr[m] - monthlyChurn)));
      result.push(next);
      prev = next;
    }
  }
  return result;
}

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
    setEditState(prev => ({
      ...prev,
      subProductClients: {
        ...prev.subProductClients,
        [key]: { ...prev.subProductClients[key], [year]: val },
      },
    }));
  };

  const updateTicket = (key: TicketKey, val: number) => {
    setEditState(prev => ({
      ...prev,
      tickets: { ...prev.tickets, [key]: val },
    }));
  };

  const updateSalary = (role: string, val: number) => {
    setEditState(prev => ({
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
    const monthlyChurn = getChurnMonthly(key, data);
    const currentGrowthArr = growthRates[year]?.[key] ?? Array(12).fill(0.06);
    const prevClients = computeProjectedClients(key, year, currentGrowthArr, monthlyChurn, data.subProductClients, data.tickets);
    const prevVal = monthIdx > 0 ? prevClients[monthIdx - 1] : (() => {
      // prevVal of first projected month = last historical
      if (year === 2026) {
        return Math.round(getMonthlyClients(key, 2026, data.subProductClients, data.tickets)[2]);
      }
      const prevYear = (year - 1) as Year;
      return Math.round(getMonthlyClients(key, prevYear, data.subProductClients, data.tickets)[11]);
    })();

    let backCalcGrowth = 0.06;
    if (prevVal > 0) {
      backCalcGrowth = (newCount / prevVal) - 1 + monthlyChurn;
    }

    setGrowthRates(prev => {
      const updated = { ...prev };
      const yearRates = { ...updated[year] };
      const arr = [...(yearRates[key] ?? Array(12).fill(0.06))];
      arr[monthIdx] = backCalcGrowth;
      yearRates[key] = arr;
      updated[year] = yearRates;
      return updated;
    });
  };

  const handleApplyAll = () => {
    const rate = applyAllPct / 100;
    setGrowthRates(prev => {
      const updated = { ...prev };
      for (const y of YEARS) {
        const yearRates = { ...updated[y] };
        for (const group of CLIENTS_ROWS) {
          for (const row of group.items) {
            if (!row.dataKey) continue;
            const k = row.dataKey;
            const arr = [...(yearRates[k] ?? Array(12).fill(0.06))];
            for (let m = 0; m < 12; m++) {
              if (!isHistorical(y, m)) arr[m] = rate;
            }
            yearRates[k] = arr;
          }
        }
        updated[y] = yearRates;
      }
      return updated;
    });
  };

  const handleApplyRow = (key: SubProductKey, year: Year) => {
    const pct = rowApplyPct[key] ?? 6;
    const rate = pct / 100;
    setGrowthRates(prev => {
      const updated = { ...prev };
      const yearRates = { ...updated[year] };
      const arr = [...(yearRates[key] ?? Array(12).fill(0.06))];
      for (let m = 0; m < 12; m++) {
        if (!isHistorical(year, m)) arr[m] = rate;
      }
      yearRates[key] = arr;
      updated[year] = yearRates;
      return updated;
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
        <h2 className="text-2xl font-bold text-primary">Assumptions</h2>
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

      <Tabs defaultValue="receita" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="receita">Receita</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="operacao">Operação</TabsTrigger>
          <TabsTrigger value="headcount">Headcount/Pessoal</TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: RECEITA ─── */}
        <TabsContent value="receita" className="space-y-6 mt-4">

          {/* ── Section 1: Nº de Clientes + % Crescimento (unified table) ── */}
          <div className="gradient-card overflow-x-auto">
            <div className="flex items-center gap-2 p-5 pb-3 flex-wrap">
              <h3 className="text-sm font-semibold">Número de Clientes — {selectedYear}</h3>
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setEditingClients(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                    editingClients
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  <Pencil className="h-3 w-3" />
                  {editingClients ? 'Editando' : 'Editar'}
                </button>
                <button
                  onClick={() => setShowGrowthPct(v => !v)}
                  className={`px-3 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                    showGrowthPct
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  % Crescimento
                </button>
                {showGrowthPct && editingClients && (
                  <>
                    <input
                      type="number"
                      step="0.1"
                      className="w-16 bg-secondary border border-border rounded px-2 py-1 text-right text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                      value={applyAllPct}
                      onChange={e => setApplyAllPct(Number(e.target.value) || 0)}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    <button
                      onClick={handleApplyAll}
                      className="px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary border border-primary/30 rounded-md hover:bg-primary/20 transition-colors whitespace-nowrap"
                    >
                      Aplicar para todos
                    </button>
                  </>
                )}
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground font-medium min-w-[170px]" rowSpan={2}>Sub-Produto</th>
                  {MONTHS.map((m, i) => (
                    <th
                      key={m}
                      colSpan={showGrowthPct ? 2 : 1}
                      className={`text-center p-2 text-muted-foreground font-medium${showGrowthPct ? ' border-b border-border/30' : ''}${selectedYear === 2026 && i === 2 ? ' border-l-2 border-primary/40' : ''}`}
                    >
                      {m}
                    </th>
                  ))}
                  <th className="text-right p-2 text-muted-foreground font-medium min-w-[60px]" rowSpan={showGrowthPct ? 2 : 1}>Total</th>
                  {showGrowthPct && <th className="text-right p-2 text-muted-foreground font-medium min-w-[80px]" rowSpan={2}>Aplicar %</th>}
                </tr>
                {showGrowthPct && (
                <tr className="border-b border-border">
                  {MONTHS.map((_, i) => (
                    <React.Fragment key={i}>
                      <th className={`text-right px-1 py-1 text-[10px] text-muted-foreground/70 font-medium min-w-[48px]${selectedYear === 2026 && i === 2 ? ' border-l-2 border-primary/40' : ''}`}>Nº</th>
                      <th className="text-right px-1 py-1 text-[10px] text-muted-foreground/70 font-medium min-w-[48px]">%</th>
                    </React.Fragment>
                  ))}
                </tr>
                )}
              </thead>
              <tbody>
                {CLIENTS_ROWS.map(group => (
                  <React.Fragment key={group.group}>
                    <tr className="bg-secondary/40 border-b border-border/50">
                      <td colSpan={showGrowthPct ? 27 : 15} className="p-2 text-xs font-bold text-foreground/80 uppercase tracking-wide">
                        {group.group}
                      </td>
                    </tr>
                    {group.items.map(row => {
                      const rowKey = row.dataKey ?? row.label;
                      const growthArr = growthRates[selectedYear]?.[rowKey] ?? Array(12).fill(0.06);
                      const churn = row.dataKey ? getChurnMonthly(row.dataKey, data) : 0;
                      const monthly: number[] = row.dataKey
                        ? computeProjectedClients(row.dataKey, selectedYear, growthArr, churn, data.subProductClients, data.tickets)
                        : Array(12).fill(0);
                      const totalYear = monthly.reduce((s, v) => s + v, 0);

                      return (
                        <tr key={`${group.group}-${row.label}`} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                          <td className="p-2 pl-5 font-medium text-xs">{row.label}</td>
                          {MONTHS.map((_, i) => {
                            const hist = isHistorical(selectedYear, i);
                            const cutoff = selectedYear === 2026 && i === 2;

                            // Compute growth % for display
                            let growthPct: string;
                            if (hist) {
                              const prev = i > 0 ? monthly[i - 1] : (() => {
                                if (!row.dataKey || selectedYear === 2025) return 0;
                                if (selectedYear === 2026) {
                                  return Math.round(getMonthlyClients(row.dataKey, 2025, data.subProductClients)[11]);
                                }
                                return Math.round(getMonthlyClients(row.dataKey, (selectedYear - 1) as Year, data.subProductClients)[11]);
                              })();
                              growthPct = (!row.dataKey || prev === 0) ? '—' : (((monthly[i] / prev) - 1) * 100).toFixed(1) + '%';
                            } else {
                              growthPct = (growthArr[i] * 100).toFixed(1) + '%';
                            }

                            return (
                              <React.Fragment key={i}>
                                {/* Nº column */}
                                <td className={`text-right px-1 py-1 tabular-nums text-xs${cutoff ? ' border-l-2 border-primary/40' : ''}${hist ? ' bg-secondary/30 text-muted-foreground' : ''}`}>
                                  {editingClients && !hist && row.dataKey ? (
                                    <input
                                      type="number"
                                      className="w-12 bg-transparent border border-primary/20 rounded px-1 py-0.5 text-right text-[11px] tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary focus:bg-secondary/50"
                                      value={monthly[i]}
                                      onChange={e => handleClientChange(row.dataKey as SubProductKey, selectedYear, i, Number(e.target.value) || 0)}
                                    />
                                  ) : (
                                    monthly[i].toLocaleString('pt-BR')
                                  )}
                                </td>
                                {/* % column (conditional) */}
                                {showGrowthPct && (
                                <td className={`text-right px-1 py-1 tabular-nums text-[10px]${hist ? ' bg-secondary/30 text-muted-foreground/60' : ' text-muted-foreground'}`}>
                                  {editingClients && !hist && row.dataKey ? (
                                    <input
                                      type="number"
                                      step="0.1"
                                      className="w-12 bg-transparent border border-primary/10 rounded px-1 py-0.5 text-right text-[10px] tabular-nums text-primary/80 outline-none focus:ring-1 focus:ring-primary focus:bg-secondary/50"
                                      value={(growthArr[i] * 100).toFixed(1)}
                                      onChange={e => handleGrowthChange(row.dataKey as SubProductKey, selectedYear, i, Number(e.target.value) || 0)}
                                    />
                                  ) : (
                                    <span>{growthPct}</span>
                                  )}
                                </td>
                                )}
                              </React.Fragment>
                            );
                          })}
                          {/* Total column */}
                          <td className="text-right px-2 py-1 tabular-nums text-xs font-semibold bg-primary/5">
                            {totalYear.toLocaleString('pt-BR')}
                          </td>
                          {/* Apply % per row (conditional) */}
                          {showGrowthPct && (
                          <td className="text-right px-1 py-1">
                            {editingClients && row.dataKey ? (
                              <div className="flex items-center justify-end gap-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  className="w-11 bg-secondary border border-border rounded px-1 py-0.5 text-right text-[10px] text-foreground outline-none focus:ring-1 focus:ring-primary"
                                  value={rowApplyPct[rowKey] ?? 6}
                                  onChange={e => setRowApplyPct(p => ({ ...p, [rowKey]: Number(e.target.value) || 0 }))}
                                />
                                <button
                                  onClick={() => handleApplyRow(row.dataKey as SubProductKey, selectedYear)}
                                  className="px-1.5 py-0.5 text-[9px] font-medium bg-secondary border border-border rounded hover:bg-secondary/80 transition-colors"
                                  title="Aplicar % a esta linha"
                                >
                                  OK
                                </button>
                              </div>
                            ) : null}
                          </td>
                          )}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Section 2: Ticket Médio ── */}
          <div className="gradient-card overflow-x-auto">
            <h3 className="text-sm font-semibold p-5 pb-3">
              Ticket Médio (R$/mês) — {selectedYear}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium min-w-[200px]">Sub-Produto</th>
                  {MONTHS.map(m => (
                    <th key={m} className="text-right p-3 text-muted-foreground font-medium min-w-[80px]">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TICKETS_ROWS.map(group => (
                  <>
                    {/* BU group header row */}
                    <tr key={group.group} className="bg-secondary/40 border-b border-border/50">
                      <td
                        colSpan={13}
                        className="p-3 text-xs font-bold text-foreground/80 uppercase tracking-wide"
                      >
                        {group.group}
                      </td>
                    </tr>
                    {group.items.map(row => {
                      const displayVal = row.dataKey
                        ? data.tickets[row.dataKey]
                        : row.staticValue;
                      const formatted = displayVal === 0
                        ? 'R$ 0'
                        : displayVal < 1
                          ? `R$ ${displayVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : `R$ ${displayVal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
                      return (
                        <tr key={`${group.group}-${row.label}`} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                          <td className="p-3 pl-6 font-medium text-sm">{row.label}</td>
                          {MONTHS.map((_, i) => (
                            <td key={i} className="text-right p-3 tabular-nums text-xs">
                              {row.dataKey && editing ? (
                                i === 0 ? (
                                  <input
                                    type="number"
                                    className="w-24 bg-secondary border border-primary/30 rounded px-2 py-1 text-right text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                                    value={data.tickets[row.dataKey]}
                                    onChange={e => updateTicket(row.dataKey as TicketKey, Number(e.target.value) || 0)}
                                  />
                                ) : (
                                  <span className="text-muted-foreground">{formatted}</span>
                                )
                              ) : (
                                formatted
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Section 3: Finance KPI ── */}
          <div className="gradient-card p-5">
            <h3 className="text-sm font-semibold mb-4">Finance KPI</h3>
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
                    const annualSelic = selicRates[selectedYear] ?? 0.15;
                    const monthlyPct = ((Math.pow(1 + annualSelic, 1 / 12) - 1) * 100);
                    return (
                      <td key={i} className="text-right p-3 tabular-nums text-xs">
                        {monthlyPct.toFixed(3)}%
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                  <td className="p-3 font-medium">R$ em Custódia</td>
                  {MONTHS.map((_, i) => (
                    <td key={i} className="text-right p-3 tabular-nums text-xs text-muted-foreground">R$ 0</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── Section 4: Churn Médio ── */}
          <div className="gradient-card overflow-x-auto">
            <h3 className="text-sm font-semibold p-5 pb-3">Churn Médio</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium min-w-[200px]">BU</th>
                  {MONTHS.map(m => (
                    <th key={m} className="text-right p-3 text-muted-foreground font-medium min-w-[58px]">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* CFO as a Service */}
                <tr className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                  <td className="p-3 font-medium">CFO as a Service</td>
                  {MONTHS.map((_, i) => (
                    <td key={i} className="text-right p-3 tabular-nums text-xs">
                      {editing ? (
                        i === 0 ? (
                          <input
                            type="number"
                            step="0.5"
                            className="w-16 bg-secondary border border-primary/30 rounded px-2 py-1 text-right text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                            value={data.churnCaas}
                            onChange={e => setEditState(p => ({ ...p, churnCaas: Number(e.target.value) || 0 }))}
                          />
                        ) : (
                          <span className="text-muted-foreground">{data.churnCaas}%</span>
                        )
                      ) : (
                        `${data.churnCaas}%`
                      )}
                    </td>
                  ))}
                </tr>
                {/* Software as a Service */}
                <tr className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                  <td className="p-3 font-medium">Software as a Service</td>
                  {MONTHS.map((_, i) => (
                    <td key={i} className="text-right p-3 tabular-nums text-xs">
                      {editing ? (
                        i === 0 ? (
                          <input
                            type="number"
                            step="0.5"
                            className="w-16 bg-secondary border border-primary/30 rounded px-2 py-1 text-right text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                            value={data.churnSaas}
                            onChange={e => setEditState(p => ({ ...p, churnSaas: Number(e.target.value) || 0 }))}
                          />
                        ) : (
                          <span className="text-muted-foreground">{data.churnSaas}%</span>
                        )
                      ) : (
                        `${data.churnSaas}%`
                      )}
                    </td>
                  ))}
                </tr>
                {/* Education */}
                <tr className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                  <td className="p-3 font-medium">Education</td>
                  {MONTHS.map((_, i) => (
                    <td key={i} className="text-right p-3 tabular-nums text-xs text-muted-foreground">0%</td>
                  ))}
                </tr>
                {/* Banking as a Service */}
                <tr className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                  <td className="p-3 font-medium">Banking as a Service</td>
                  {MONTHS.map((_, i) => (
                    <td key={i} className="text-right p-3 tabular-nums text-xs">
                      {editing ? (
                        i === 0 ? (
                          <input
                            type="number"
                            step="0.5"
                            className="w-16 bg-secondary border border-primary/30 rounded px-2 py-1 text-right text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                            value={data.churnBaas}
                            onChange={e => setEditState(p => ({ ...p, churnBaas: Number(e.target.value) || 0 }))}
                          />
                        ) : (
                          <span className="text-muted-foreground">{data.churnBaas}%</span>
                        )
                      ) : (
                        `${data.churnBaas}%`
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

        </TabsContent>

        {/* ─── TAB 2: MARKETING ─── */}
        <TabsContent value="marketing" className="space-y-6 mt-4">
          {/* Planned/Actual toggle */}
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

          {/* Realizado: historical marketing spend table */}
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
                        <th
                          key={m}
                          className={`text-right px-2 py-2 text-muted-foreground font-medium min-w-[72px]${selectedYear === 2026 && i === 2 ? ' border-r border-primary/30' : ''}`}
                        >
                          {m}
                        </th>
                      ))}
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium min-w-[88px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mkRows.map(row => (
                      <tr
                        key={row.key}
                        className={`border-b border-border/20 transition-colors ${
                          row.isSummary
                            ? 'bg-secondary/40 hover:bg-secondary/60 font-semibold'
                            : 'hover:bg-secondary/20'
                        }`}
                      >
                        <td className={`sticky left-0 z-10 px-4 py-1.5 font-medium ${row.isSummary ? 'bg-secondary/40' : 'bg-card'}`}>
                          {row.label}
                        </td>
                        {MONTHS.map((_, i) => {
                          const val = getHistVal(row.key, i);
                          const isHist = isHistPeriod(i);
                          const isCutoffBorder = selectedYear === 2026 && i === 2;
                          return (
                            <td
                              key={i}
                              className={`text-right px-2 py-1.5 tabular-nums${isCutoffBorder ? ' border-r border-primary/30' : ''}${
                                !isHist ? ' text-muted-foreground/60 italic' : ''
                              }`}
                            >
                              {!isHist && val === 0 ? '—' : formatCurrency(val)}
                            </td>
                          );
                        })}
                        <td className="text-right px-3 py-1.5 tabular-nums font-medium">
                          {formatCurrency(getAnnual(row.key))}
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr className="border-t-2 border-border bg-primary/5 font-bold">
                      <td className="sticky left-0 z-10 bg-primary/5 px-4 py-2">TOTAL MARKETING</td>
                      {MONTHS.map((_, i) => {
                        const val = mkRows.reduce((s, r) => s + getHistVal(r.key, i), 0);
                        const isHist = isHistPeriod(i);
                        const isCutoffBorder = selectedYear === 2026 && i === 2;
                        return (
                          <td
                            key={i}
                            className={`text-right px-2 py-2 tabular-nums${isCutoffBorder ? ' border-r border-primary/30' : ''}${
                              !isHist ? ' text-muted-foreground/60 italic' : ''
                            }`}
                          >
                            {formatCurrency(val)}
                          </td>
                        );
                      })}
                      <td className="text-right px-3 py-2 tabular-nums">
                        {formatCurrency(mkRows.reduce((s, r) => s + getAnnual(r.key), 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-[10px] text-muted-foreground p-3 pt-1">
                  Fonte: Oxy DB — dados reais de despesas de marketing e comerciais extraidos do sistema financeiro.
                </p>
              </div>
            );
          })()}

          {/* Unit Economics */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="gradient-card p-5">
              <h3 className="text-sm font-semibold mb-4">Unit Economics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Ticket Medio</p>
                  <p className="text-lg font-bold">{formatCurrency(avgTicketVal)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Churn Medio (anual)</p>
                  <p className="text-lg font-bold">{(avgChurn * 100).toFixed(1)}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">LTV</p>
                  <p className="text-lg font-bold">{formatCurrency(ltv)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">LTV:CAC</p>
                  <p className={`text-lg font-bold ${ltvCacRatio >= 3 ? 'text-positive' : 'text-negative'}`}>{ltvCacRatio.toFixed(1)}x</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">CAC Medio</p>
                  <p className="text-lg font-bold">{formatCurrency(avgCac)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Comissao de Vendas</p>
                  <p className="text-sm font-semibold">{(commissionRate.caas * 100).toFixed(0)}% da receita bruta</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── TAB 3: OPERACAO ─── */}
        <TabsContent value="operacao" className="space-y-6 mt-4">

          {/* ── Resumo Operacional Mensal ── */}
          {(() => {
            const isHistPeriod = (monthIdx: number) => isHistorical(selectedYear, monthIdx);

            // Get value for a financial category from historicalFinancial (4-level: cat → group → item → period)
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

            // Projected value from engine (R$ thousands → R$ reais, annual / 12)
            const getProjected = (engineCode: string): number => {
              const node = findNodeInTree(engineCode, model.pnlTree);
              if (!node) return 0;
              return Math.abs(node.annual[selectedYear] ?? 0) * 1000 / 12;
            };

            // Projected Despesas Fixas = sum of codes 4, 5, 6, 7
            const getProjectedDespesasFixas = (): number => {
              const codes = ['4', '5', '6', '7'];
              return codes.reduce((sum, c) => {
                const node = findNodeInTree(c, model.pnlTree);
                return sum + (node ? Math.abs(node.annual[selectedYear] ?? 0) * 1000 / 12 : 0);
              }, 0);
            };

            // Projected Despesas Financeiras = engine code '8D'
            const getProjectedFinanceiras = (): number => getProjected('8D');
            // Projected Provisões = engine code 'TAX'
            const getProjectedProvisoes = (): number => getProjected('TAX');
            // Projected Amortização = engine code '11'
            const getProjectedAmortizacao = (): number => getProjected('11');
            // Projected Investimentos = engine code '12'
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
              {
                label: 'Custos Variáveis',
                isSummary: true,
                groupKey: 'custos',
                getHistValue: (p) => Object.values(historicalCosts).reduce((s, g) => s + (g[p] ?? 0), 0),
                getProjValue: () => {
                  const codes = ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6'];
                  return codes.reduce((sum, c) => {
                    const node = findNodeInTree(c, model.pnlTree);
                    return sum + (node ? Math.abs(node.annual[selectedYear] ?? 0) * 1000 / 12 : 0);
                  }, 0);
                },
              },
              {
                label: 'Custos CaaS', indent: true,
                getHistValue: (p) => historicalCosts['Custos Caas']?.[p] ?? 0,
                getProjValue: () => 0,
              },
              {
                label: 'Custos SaaS', indent: true,
                getHistValue: (p) => historicalCosts['Custos SaaS']?.[p] ?? 0,
                getProjValue: () => 0,
              },
              {
                label: 'Custos Customer Success', indent: true,
                getHistValue: (p) => historicalCosts['Custos Customer Success']?.[p] ?? 0,
                getProjValue: () => 0,
              },
              {
                label: 'Custos Education', indent: true,
                getHistValue: (p) => historicalCosts['Custos Education']?.[p] ?? 0,
                getProjValue: () => 0,
              },
              {
                label: 'Custos Expansão', indent: true,
                getHistValue: (p) => historicalCosts['Custos Expansão']?.[p] ?? 0,
                getProjValue: () => 0,
              },
              {
                label: 'Custos Tax', indent: true,
                getHistValue: (p) => historicalCosts['Custos Tax']?.[p] ?? 0,
                getProjValue: () => 0,
              },
              {
                label: 'Despesas Fixas',
                isSummary: true,
                groupKey: 'despesas',
                getHistValue: (p) => Object.values(historicalExpenses).reduce((s, g) => s + (g[p] ?? 0), 0),
                getProjValue: getProjectedDespesasFixas,
              },
              {
                label: 'Desp. Administrativas', indent: true,
                getHistValue: (p) => historicalExpenses['Despesas Administrativas']?.[p] ?? 0,
                getProjValue: () => 0,
              },
              {
                label: 'Desp. Comerciais', indent: true,
                getHistValue: (p) => historicalExpenses['Despesas Comerciais']?.[p] ?? 0,
                getProjValue: () => 0,
              },
              {
                label: 'Desp. com Pessoal', indent: true,
                getHistValue: (p) => historicalExpenses['Despesas com Pessoal']?.[p] ?? 0,
                getProjValue: () => 0,
              },
              {
                label: 'Desp. de Marketing', indent: true,
                getHistValue: (p) => historicalExpenses['Despesas de Marketing']?.[p] ?? 0,
                getProjValue: () => 0,
              },
              {
                label: 'Despesas Financeiras',
                getHistValue: (p) => getFinancialCatValue('DF', p),
                getProjValue: getProjectedFinanceiras,
              },
              {
                label: 'Provisões (IRPJ/CSLL)',
                getHistValue: (p) => getFinancialCatValue('PROV', p),
                getProjValue: getProjectedProvisoes,
              },
              {
                label: 'Amortização de Dívida',
                getHistValue: (p) => getFinancialCatValue('AD', p),
                getProjValue: getProjectedAmortizacao,
              },
              {
                label: 'Investimentos',
                getHistValue: (p) => getFinancialCatValue('INV', p),
                getProjValue: getProjectedInvestimentos,
              },
            ];

            // Determine which rows are visible (sub-items hidden when group is collapsed)
            const visibleRows = rows.filter((row) => {
              if (!row.indent) return true;
              // Sub-items of custos group
              const costLabels = ['Custos CaaS', 'Custos SaaS', 'Custos Customer Success', 'Custos Education', 'Custos Expansão', 'Custos Tax'];
              const expLabels = ['Desp. Administrativas', 'Desp. Comerciais', 'Desp. com Pessoal', 'Desp. de Marketing'];
              if (costLabels.includes(row.label)) return opExpandedGroups.custos;
              if (expLabels.includes(row.label)) return opExpandedGroups.despesas;
              return true;
            });

            // Monthly values for each row
            const getMonthlyValue = (row: OpRow, monthIdx: number): { value: number; isHist: boolean } => {
              const period = `${selectedYear}-${String(monthIdx + 1).padStart(2, '0')}`;
              const isHist = (HISTORICAL_PERIODS as readonly string[]).includes(period);
              if (isHist) {
                return { value: row.getHistValue(period), isHist: true };
              }
              // Projected: only show for summary/non-indent rows, sub-items show 0 (rendered as —)
              if (!row.indent) {
                return { value: row.getProjValue(), isHist: false };
              }
              return { value: 0, isHist: false };
            };

            // Total row: sum of summary rows only
            const summaryRows = rows.filter(r => r.isSummary || (!r.indent && !r.isSummary));
            // Actually: sum all non-indent rows for the total
            const nonSubRows = rows.filter(r => !r.indent);
            const getTotalValue = (monthIdx: number): { value: number; isHist: boolean } => {
              const { isHist } = getMonthlyValue(nonSubRows[0], monthIdx);
              const value = nonSubRows.reduce((s, r) => s + getMonthlyValue(r, monthIdx).value, 0);
              return { value, isHist };
            };

            // Annual total for a row
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
                        <th
                          key={m}
                          className={`text-right px-2 py-2 text-muted-foreground font-medium min-w-[72px]${selectedYear === 2026 && i === 2 ? ' border-r border-primary/30' : ''}`}
                        >
                          {m}
                        </th>
                      ))}
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium min-w-[88px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => {
                      const isGroup = row.isSummary && row.groupKey;
                      return (
                        <tr
                          key={row.label}
                          className={`border-b border-border/20 transition-colors ${
                            row.isSummary
                              ? 'bg-secondary/40 hover:bg-secondary/60 font-semibold'
                              : 'hover:bg-secondary/20'
                          }`}
                        >
                          <td
                            className={`sticky left-0 z-10 px-4 py-1.5 font-medium ${
                              row.isSummary ? 'bg-secondary/40' : 'bg-card'
                            }`}
                          >
                            <div
                              className={`flex items-center gap-1 ${isGroup ? 'cursor-pointer select-none' : ''}`}
                              onClick={isGroup ? () => setOpExpandedGroups(prev => ({ ...prev, [row.groupKey!]: !prev[row.groupKey!] })) : undefined}
                            >
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
                              <td
                                key={i}
                                className={`text-right px-2 py-1.5 tabular-nums${isCutoffBorder ? ' border-r border-primary/30' : ''}${
                                  !isHist ? ' text-muted-foreground/60 italic' : ''
                                }`}
                              >
                                {showDash ? '—' : formatCurrency(value)}
                              </td>
                            );
                          })}
                          <td className="text-right px-3 py-1.5 tabular-nums font-medium">
                            {formatCurrency(getAnnualTotal(row))}
                          </td>
                        </tr>
                      );
                    })}
                    {/* TOTAL OPERACIONAL */}
                    <tr className="border-t-2 border-border bg-primary/5 font-bold">
                      <td className="sticky left-0 z-10 bg-primary/5 px-4 py-2">TOTAL OPERACIONAL</td>
                      {MONTHS.map((_, i) => {
                        const { value, isHist } = getTotalValue(i);
                        const isCutoffBorder = selectedYear === 2026 && i === 2;
                        return (
                          <td
                            key={i}
                            className={`text-right px-2 py-2 tabular-nums${isCutoffBorder ? ' border-r border-primary/30' : ''}${
                              !isHist ? ' text-muted-foreground/60 italic' : ''
                            }`}
                          >
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

          {/* Cost Assumptions */}
          <div className="gradient-card p-5">
            <h3 className="text-sm font-semibold mb-4">Cost Assumptions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

          {/* Regime Tributario */}
          <div className="gradient-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Scale className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Regime Tributario</h3>
              <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary">Transicao em 2027</span>
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
              <span>IRPJ 25% + CSLL 9% = 34% sobre lucro tributavel (EBT). Aplicado em ambos os regimes.</span>
            </div>
          </div>

          {/* Custos e Margens */}
          <div className="gradient-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Custos e Margens</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Comissao de Vendas</p>
                <p className="text-sm font-semibold">{(commissionRate.caas * 100).toFixed(0)}% da receita bruta</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Crescimento SG&A/ano</p>
                <p className="text-sm font-semibold">
                  {editing ? (
                    <input type="number" step="1" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                      value={data.sgaGrowthRate} onChange={e => setEditState(p => ({ ...p, sgaGrowthRate: Number(e.target.value) || 0 }))} />
                  ) : <span>{data.sgaGrowthRate}%</span>}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">CAPEX % do COGS SaaS</p>
                <p className="text-sm font-semibold">50% (2025–26) -&gt; 30% (2027+)</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">BaaS COGS/cliente</p>
                <p className="text-sm font-semibold">R$ 25/mes (a partir de 2025)</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">PDD (Provisao p/ Devedores)</p>
                <p className="text-sm font-semibold">2% da receita bruta</p>
              </div>
            </div>
          </div>

          {/* Resumo de Dividas */}
          <div className="gradient-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Landmark className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Resumo de Dividas</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Saldo Total Devedor</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatCurrencyFull(debtSchedule.reduce((s, d) => s + d.outstanding, 0))}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Parcela Mensal Total</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatCurrencyFull(debtSchedule.reduce((s, d) => s + d.monthlyPayment, 0))}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">N de Contratos</p>
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
                    <th className="text-right py-2 text-muted-foreground font-medium text-xs">Parcela/mes</th>
                    <th className="text-right py-2 text-muted-foreground font-medium text-xs">Parcelas rest.</th>
                    <th className="text-right py-2 text-muted-foreground font-medium text-xs">Previsao final</th>
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

        {/* ─── TAB 4: HEADCOUNT/PESSOAL ─── */}
        <TabsContent value="headcount" className="space-y-6 mt-4">


          {/* Section 2: Colaboradores Nomeados */}
          {(() => {
            const isHistCell = (monthIdx: number) => isHistorical(selectedYear, monthIdx);
            const cutoff = (i: number) => selectedYear === 2026 && i === 2;
            const yearMonths = MONTHS.map((_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`);

            // Group employees by BU (use hcEmployees state)
            const buOrder = ['CaaS', 'SaaS', 'Customer Success', 'Tech', 'Management', 'Commercial & Sales', 'Marketing', 'Administrative', 'Education'];
            const grouped: Record<string, Array<{ emp: typeof hcEmployees[number]; globalIdx: number }>> = {};
            hcEmployees.forEach((emp, globalIdx) => {
              if (!grouped[emp.bu]) grouped[emp.bu] = [];
              grouped[emp.bu].push({ emp, globalIdx });
            });

            const buGroups = buOrder.filter(bu => grouped[bu]);
            Object.keys(grouped).forEach(bu => { if (!buGroups.includes(bu)) buGroups.push(bu); });

            return (
              <div className={`gradient-card overflow-x-auto${editing ? ' ring-1 ring-primary/30' : ''}`}>
                <h3 className="text-sm font-semibold p-5 pb-3">Colaboradores Nomeados — {selectedYear}</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {editing && <th className="px-2 py-2 min-w-[24px]"></th>}
                      <th className="sticky left-0 z-10 bg-card text-left px-4 py-2 text-muted-foreground font-medium min-w-[160px]">Nome</th>
                      <th className="text-left px-2 py-2 text-muted-foreground font-medium min-w-[120px]">Função</th>
                      <th className="text-left px-2 py-2 text-muted-foreground font-medium min-w-[56px]">Código</th>
                      <th className="text-left px-2 py-2 text-muted-foreground font-medium min-w-[80px]">BU</th>
                      {MONTHS.map((m, i) => (
                        <th key={m} className={`text-right px-2 py-2 text-muted-foreground font-medium min-w-[72px]${cutoff(i) ? ' border-r border-primary/30' : ''}`}>{m}</th>
                      ))}
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium min-w-[80px]">Total Anual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buGroups.map(bu => {
                      const employees = grouped[bu] ?? [];
                      return (
                        <React.Fragment key={bu}>
                          <tr className="bg-secondary/30">
                            <td colSpan={editing ? 5 + 12 + 1 : 4 + 12 + 1} className="sticky left-0 px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">{bu}</td>
                          </tr>
                          {employees.map(({ emp, globalIdx }) => {
                            const annual = yearMonths.reduce((s, p) => s + (emp.monthly[p] ?? 0), 0);
                            return (
                              <tr key={globalIdx} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                                {editing && (
                                  <td className="px-2 py-1.5 text-center">
                                    <button
                                      onClick={() => removeEmployee(globalIdx)}
                                      className="text-negative/60 hover:text-negative transition-colors"
                                      title="Remover colaborador"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </td>
                                )}
                                <td className="sticky left-0 z-10 bg-card px-4 py-1.5 font-medium">
                                  {editing ? (
                                    <input
                                      type="text"
                                      className="w-36 bg-secondary border border-primary/30 rounded px-1 py-0.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                                      value={emp.name}
                                      onChange={e => updateEmployeeField(globalIdx, 'name', e.target.value)}
                                    />
                                  ) : emp.name}
                                </td>
                                <td className="px-2 py-1.5 text-muted-foreground">
                                  {editing ? (
                                    <input
                                      type="text"
                                      className="w-28 bg-secondary border border-primary/30 rounded px-1 py-0.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                                      value={emp.role}
                                      onChange={e => updateEmployeeField(globalIdx, 'role', e.target.value)}
                                    />
                                  ) : emp.role}
                                </td>
                                <td className="px-2 py-1.5 text-muted-foreground font-mono">
                                  {editing ? (
                                    <input
                                      type="text"
                                      className="w-14 bg-secondary border border-primary/30 rounded px-1 py-0.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary font-mono"
                                      value={emp.code}
                                      onChange={e => updateEmployeeField(globalIdx, 'code', e.target.value)}
                                    />
                                  ) : emp.code}
                                </td>
                                <td className="px-2 py-1.5 text-muted-foreground">
                                  {editing ? (
                                    <input
                                      type="text"
                                      className="w-20 bg-secondary border border-primary/30 rounded px-1 py-0.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                                      value={emp.bu}
                                      onChange={e => updateEmployeeField(globalIdx, 'bu', e.target.value)}
                                    />
                                  ) : emp.bu}
                                </td>
                                {yearMonths.map((p, i) => {
                                  const val = emp.monthly[p] ?? 0;
                                  return (
                                    <td key={i} className={`text-right px-2 py-1.5 tabular-nums${cutoff(i) ? ' border-r border-primary/30' : ''}${!isHistCell(i) ? ' text-muted-foreground/60 italic' : ''}`}>
                                      {editing && !isHistCell(i) ? (
                                        <input
                                          type="number"
                                          min="0"
                                          className="w-20 bg-secondary border border-primary/30 rounded px-1 py-0.5 text-right text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
                                          value={val || ''}
                                          onChange={e => updateEmployeeSalary(globalIdx, p, Number(e.target.value) || 0)}
                                        />
                                      ) : (
                                        val === 0 ? '—' : formatCurrency(val)
                                      )}
                                    </td>
                                  );
                                })}
                                <td className="text-right px-3 py-1.5 tabular-nums font-medium">{annual === 0 ? '—' : formatCurrency(annual)}</td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    <tr className="border-t-2 border-border bg-primary/5 font-bold">
                      <td className="sticky left-0 z-10 bg-primary/5 px-4 py-2" colSpan={editing ? 5 : 4}>Total Folha</td>
                      {yearMonths.map((p, i) => {
                        const total = hcEmployees.reduce((s, emp) => s + (emp.monthly[p] ?? 0), 0);
                        return (
                          <td key={i} className={`text-right px-2 py-2 tabular-nums${cutoff(i) ? ' border-r border-primary/30' : ''}${!isHistCell(i) ? ' text-muted-foreground/60 italic' : ''}`}>
                            {total === 0 ? '—' : formatCurrency(total)}
                          </td>
                        );
                      })}
                      <td className="text-right px-3 py-2 tabular-nums">
                        {formatCurrency(yearMonths.reduce((s, p) => s + hcEmployees.reduce((ss, emp) => ss + (emp.monthly[p] ?? 0), 0), 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
                {editing && (
                  <div className="px-4 py-3 border-t border-border/30">
                    <button
                      onClick={addEmployee}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar Colaborador
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Section 3: Indicadores de Folha */}
          {(() => {
            const yearMonths = MONTHS.map((_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`);
            const isHistCell = (monthIdx: number) => isHistorical(selectedYear, monthIdx);
            const cutoff = (i: number) => selectedYear === 2026 && i === 2;

            const indicators = [
              {
                label: 'Faturamento (MRR)',
                getVal: (p: string) => payrollFaturamento[p] ?? 0,
                format: (v: number) => formatCurrency(v),
              },
              {
                label: 'Payroll / Gross Revenue',
                getVal: (p: string) => (payrollGrossRevenueRatio[p] ?? 0) * 100,
                format: (v: number) => `${v.toFixed(1)}%`,
              },
              {
                label: 'Benefícios',
                getVal: (p: string) => benefitsMonthly[p] ?? 0,
                format: (v: number) => formatCurrency(v),
              },
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

          {/* Section 4: Reembolsos por Centro de Custo */}
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
                      <th className="sticky left-0 z-10 bg-card text-left px-4 py-2 text-muted-foreground font-medium min-w-[220px]">Descrição</th>
                      <th className="text-left px-2 py-2 text-muted-foreground font-medium min-w-[56px]">Código</th>
                      <th className="text-left px-2 py-2 text-muted-foreground font-medium min-w-[80px]">BU</th>
                      {MONTHS.map((m, i) => (
                        <th key={m} className={`text-right px-2 py-2 text-muted-foreground font-medium min-w-[72px]${cutoff(i) ? ' border-r border-primary/30' : ''}`}>{m}</th>
                      ))}
                      <th className="text-right px-3 py-2 text-muted-foreground font-medium min-w-[88px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reimbursements.map(row => {
                      const annual = yearMonths.reduce((s, p) => s + (row.monthly[p] ?? 0), 0);
                      return (
                        <tr key={row.desc} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                          <td className="sticky left-0 z-10 bg-card px-4 py-1.5 font-medium">{row.desc}</td>
                          <td className="px-2 py-1.5 text-muted-foreground font-mono">{row.code}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{row.bu}</td>
                          {yearMonths.map((p, i) => {
                            const val = row.monthly[p] ?? 0;
                            return (
                              <td key={i} className={`text-right px-2 py-1.5 tabular-nums${cutoff(i) ? ' border-r border-primary/30' : ''}${!isHistCell(i) ? ' text-muted-foreground/60 italic' : ''}`}>
                                {val === 0 ? '—' : formatCurrency(val)}
                              </td>
                            );
                          })}
                          <td className="text-right px-3 py-1.5 tabular-nums font-medium">{annual === 0 ? '—' : formatCurrency(annual)}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-border bg-primary/5 font-bold">
                      <td className="sticky left-0 z-10 bg-primary/5 px-4 py-2" colSpan={3}>Total Reembolsos</td>
                      {yearMonths.map((p, i) => {
                        const total = reimbursements.reduce((s, row) => s + (row.monthly[p] ?? 0), 0);
                        return (
                          <td key={i} className={`text-right px-2 py-2 tabular-nums${cutoff(i) ? ' border-r border-primary/30' : ''}${!isHistCell(i) ? ' text-muted-foreground/60 italic' : ''}`}>
                            {total === 0 ? '—' : formatCurrency(total)}
                          </td>
                        );
                      })}
                      <td className="text-right px-3 py-2 tabular-nums">
                        {formatCurrency(yearMonths.reduce((s, p) => s + reimbursements.reduce((ss, row) => ss + (row.monthly[p] ?? 0), 0), 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Headcount Projetado por Área */}
          {(() => {
            const data = editing ? editState : assumptions;
            const hcData = editing ? editState : assumptions;
            const ratios = hcData.headcountRatios;
            const salaries = hcData.salaryRanges;
            const salaries = data.salaryRanges;

            // Compute monthly total clients for selectedYear
            const subProductKeys = Object.keys(data.subProductClients) as SubProductKey[];
            const monthlyTotals: number[] = Array.from({ length: 12 }, (_, m) => {
              return subProductKeys.reduce((sum, key) => {
                const monthly = getMonthlyClients(key, selectedYear, data.subProductClients);
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

          {/* Regras de Contratação (editável) */}
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
