import { useState } from 'react';
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS, Year } from '@/lib/financialData';
import { PnlNode } from '@/lib/pnlData';
import { formatCurrency } from '@/lib/formatters';
import { ChevronRight, ChevronDown, ChevronUp, Database, Calculator, Loader2, Landmark } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, LineChart, Line, ComposedChart,
} from 'recharts';
import {
  HISTORICAL_PERIODS,
  historicalRevenue,
  historicalDeductions,
  historicalCosts,
  historicalExpenses,
  historicalFinancial,
} from '@/data/historicalData';
import { useDreData, CashFlowDbData } from '@/hooks/useDreData';
import { useOxyCashFlow } from '@/hooks/useOxyCashFlow';

// ─── Period helpers ───────────────────────────────────────────────────────────

const HIST_2025 = HISTORICAL_PERIODS.filter(p => p.startsWith('2025'));

function sumFlat(data: Record<string, number>, periods: readonly string[]): number {
  return periods.reduce((acc, p) => acc + (data[p] ?? 0), 0) / 1000;
}

function sumFinancialCat(catCode: string, periods: readonly string[]): number {
  const cat = historicalFinancial[catCode];
  if (!cat) return 0;
  let total = 0;
  for (const group of Object.values(cat)) {
    for (const item of Object.values(group)) {
      for (const p of periods) {
        total += (item[p] ?? 0);
      }
    }
  }
  return total / 1000;
}

function sumDeductions(periods: readonly string[]): number {
  let total = 0;
  for (const item of Object.values(historicalDeductions)) {
    total += periods.reduce((acc, p) => acc + (item[p] ?? 0), 0);
  }
  return total / 1000;
}

function sumCosts(periods: readonly string[]): number {
  let total = 0;
  for (const group of Object.values(historicalCosts)) {
    total += periods.reduce((acc, p) => acc + (group[p] ?? 0), 0);
  }
  return total / 1000;
}

// ─── Engine helpers ───────────────────────────────────────────────────────────

function findNode(code: string, nodes: PnlNode[]): PnlNode | undefined {
  for (const n of nodes) {
    if (n.code === code) return n;
    if (n.children) {
      const found = findNode(code, n.children);
      if (found) return found;
    }
  }
  return undefined;
}

function getAnnual(code: string, year: Year, tree: PnlNode[]): number {
  const node = findNode(code, tree);
  if (!node) return 0;
  return Math.round(node.annual[year]);
}

// ─── Blending logic ───────────────────────────────────────────────────────────

function blend(
  year: Year,
  histFn: (periods: readonly string[]) => number,
  engineVal: number,
): number {
  if (year === 2025) return histFn(HIST_2025);
  return engineVal;
}

// ─── Cash flow row type ───────────────────────────────────────────────────────

interface CashFlowRow {
  code: string;
  label: string;
  isSummary?: boolean;
  getValues: (year: Year) => number;
  children?: CashFlowRow[];
}

// ─── Tree builder (model mode) ────────────────────────────────────────────────

function buildCashFlowTree(tree: PnlNode[], receivablesChange: Record<Year, number>): CashFlowRow[] {
  const inflows: CashFlowRow[] = [
    {
      code: 'I.1', label: 'Receita CaaS',
      getValues: (y) => blend(y, (ps) => sumFlat(historicalRevenue['CaaS'] ?? {}, ps), getAnnual('1.1', y, tree)),
    },
    {
      code: 'I.2', label: 'Receita SaaS',
      getValues: (y) => blend(y, (ps) => sumFlat(historicalRevenue['SaaS'] ?? {}, ps), getAnnual('1.2', y, tree)),
    },
    {
      code: 'I.3', label: 'Receita Education',
      getValues: (y) => blend(y, (ps) => sumFlat(historicalRevenue['Education'] ?? {}, ps), getAnnual('1.3', y, tree)),
    },
    {
      code: 'I.4', label: 'Receita BaaS',
      getValues: (y) => blend(y, () => 0, getAnnual('1.5', y, tree)),
    },
    {
      code: 'I.5', label: 'Receita Expansão',
      getValues: (y) => blend(y, (ps) => sumFlat(historicalRevenue['Expansão'] ?? {}, ps), 0),
    },
    {
      code: 'I.6', label: 'Outras Receitas',
      getValues: (y) => blend(y, (ps) => sumFlat(historicalRevenue['Tax'] ?? {}, ps) + sumFinancialCat('RNO', ps), 0),
    },
    {
      code: 'I.7', label: 'Receitas Financeiras',
      getValues: (y) => blend(y, (ps) => sumFinancialCat('RF', ps), Math.max(0, getAnnual('8', y, tree))),
    },
    {
      code: 'I.8', label: 'Variação de Contas a Receber',
      getValues: (y) => receivablesChange[y] ?? 0,
    },
  ];

  const outflows: CashFlowRow[] = [
    {
      code: 'O.1', label: 'Deduções de Vendas',
      getValues: (y) => blend(y, (ps) => -sumDeductions(ps), getAnnual('2', y, tree)),
    },
    {
      code: 'O.2', label: 'Custos Variáveis',
      getValues: (y) => blend(y, (ps) => -sumCosts(ps), getAnnual('3', y, tree)),
    },
    {
      code: 'O.3', label: 'Despesas Administrativas',
      getValues: (y) => blend(y, (ps) => -sumFlat(historicalExpenses['Despesas Administrativas'] ?? {}, ps), getAnnual('4', y, tree)),
    },
    {
      code: 'O.4', label: 'Despesas Comerciais',
      getValues: (y) => blend(y, (ps) => -sumFlat(historicalExpenses['Despesas Comerciais'] ?? {}, ps), getAnnual('6', y, tree)),
    },
    {
      code: 'O.5', label: 'Despesas com Pessoal',
      getValues: (y) => blend(y, (ps) => -sumFlat(historicalExpenses['Despesas com Pessoal'] ?? {}, ps), getAnnual('5', y, tree)),
    },
    {
      code: 'O.6', label: 'Despesas de Marketing',
      getValues: (y) => blend(y, (ps) => -sumFlat(historicalExpenses['Despesas de Marketing'] ?? {}, ps), getAnnual('7', y, tree)),
    },
    {
      code: 'O.7', label: 'Despesas Financeiras',
      getValues: (y) => blend(y, (ps) => -sumFinancialCat('DF', ps), Math.min(0, getAnnual('8', y, tree))),
    },
    {
      code: 'O.8', label: 'Despesas Não Operacionais',
      getValues: (y) => blend(y, (ps) => -sumFinancialCat('DNO', ps), 0),
    },
    {
      code: 'O.9', label: 'Provisões (IRPJ/CSLL)',
      getValues: (y) => blend(y, (ps) => -sumFinancialCat('PROV', ps), getAnnual('TAX', y, tree)),
    },
    {
      code: 'O.10', label: 'Amortização de Dívida',
      getValues: (y) => blend(y, (ps) => -sumFinancialCat('AD', ps), getAnnual('11', y, tree)),
    },
    {
      code: 'O.11', label: 'Investimentos (Capex)',
      getValues: (y) => blend(y, (ps) => -sumFinancialCat('INV', ps), getAnnual('12', y, tree)),
    },
  ];

  return [
    {
      code: 'INFLOWS', label: 'Total Entradas', isSummary: true,
      getValues: (y) => inflows.reduce((s, r) => s + r.getValues(y), 0),
      children: inflows,
    },
    {
      code: 'OUTFLOWS', label: 'Total Saídas', isSummary: true,
      getValues: (y) => outflows.reduce((s, r) => s + r.getValues(y), 0),
      children: outflows,
    },
  ];
}

// ─── Tree builder (DB/actual mode) ────────────────────────────────────────────

function buildCashFlowTreeFromDb(cf: CashFlowDbData, receivablesChange: Record<Year, number>): CashFlowRow[] {
  const dbVal = (key: string, y: Year) => cf[key]?.annual[y] ?? 0;

  const inflows: CashFlowRow[] = [
    { code: 'I.1', label: 'Receita CaaS', getValues: (y) => dbVal('revenueCaaS', y) },
    { code: 'I.2', label: 'Receita SaaS', getValues: (y) => dbVal('revenueSaaS', y) },
    { code: 'I.3', label: 'Receita Education', getValues: (y) => dbVal('revenueEducation', y) },
    { code: 'I.4', label: 'Receita BaaS', getValues: () => 0 },
    { code: 'I.5', label: 'Receita Expansão', getValues: (y) => dbVal('revenueExpansao', y) },
    { code: 'I.6', label: 'Outras Receitas', getValues: (y) => dbVal('revenueTax', y) + dbVal('otherRevenue', y) },
    { code: 'I.7', label: 'Receitas Financeiras', getValues: (y) => dbVal('financialRevenue', y) },
    { code: 'I.8', label: 'Variação de Contas a Receber', getValues: (y) => receivablesChange[y] ?? 0 },
  ];

  const outflows: CashFlowRow[] = [
    { code: 'O.1', label: 'Deduções de Vendas', getValues: (y) => -Math.abs(dbVal('deductions', y)) },
    { code: 'O.2', label: 'Custos Variáveis', getValues: (y) => -Math.abs(dbVal('variableCosts', y)) },
    { code: 'O.3', label: 'Despesas Administrativas', getValues: (y) => -Math.abs(dbVal('adminExpenses', y)) },
    { code: 'O.4', label: 'Despesas Comerciais', getValues: (y) => -Math.abs(dbVal('commercialExpenses', y)) },
    { code: 'O.5', label: 'Despesas com Pessoal', getValues: (y) => -Math.abs(dbVal('personnelExpenses', y)) },
    { code: 'O.6', label: 'Despesas de Marketing', getValues: (y) => -Math.abs(dbVal('marketingExpenses', y)) },
    { code: 'O.7', label: 'Despesas Financeiras', getValues: (y) => -Math.abs(dbVal('financialExpenses', y)) },
    { code: 'O.8', label: 'Despesas Não Operacionais', getValues: (y) => -Math.abs(dbVal('nonOpExpenses', y)) },
    { code: 'O.9', label: 'Provisões (IRPJ/CSLL)', getValues: (y) => -Math.abs(dbVal('taxProvisions', y)) },
    { code: 'O.10', label: 'Amortização de Dívida', getValues: (y) => -Math.abs(dbVal('debtAmortization', y)) },
    { code: 'O.11', label: 'Investimentos (Capex)', getValues: (y) => -Math.abs(dbVal('investments', y)) },
  ];

  return [
    {
      code: 'INFLOWS', label: 'Total Entradas', isSummary: true,
      getValues: (y) => inflows.reduce((s, r) => s + r.getValues(y), 0),
      children: inflows,
    },
    {
      code: 'OUTFLOWS', label: 'Total Saídas', isSummary: true,
      getValues: (y) => outflows.reduce((s, r) => s + r.getValues(y), 0),
      children: outflows,
    },
  ];
}

// ─── Expandable row component ─────────────────────────────────────────────────

function CashFlowExpandableRow({ row, depth, activeYears }: { row: CashFlowRow; depth: number; activeYears: Year[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = row.children && row.children.length > 0;

  return (
    <>
      <tr
        className={`border-b border-border/30 transition-colors ${
          row.isSummary ? 'bg-primary/5 font-bold' : 'hover:bg-secondary/20'
        }`}
      >
        <td
          className="p-3 whitespace-nowrap cursor-pointer select-none sticky left-0 bg-card"
          style={{ paddingLeft: `${12 + depth * 20}px` }}
          onClick={() => hasChildren && setExpanded(!expanded)}
        >
          <div className="flex items-center gap-1.5">
            {hasChildren ? (
              expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <span className="w-3.5" />
            )}
            <span className={`text-sm ${row.isSummary ? 'text-foreground' : 'text-foreground/90'}`}>
              {row.label}
            </span>
          </div>
        </td>
        {activeYears.map(y => {
          const val = row.getValues(y);
          return (
            <td key={y} className="text-right p-3 tabular-nums text-sm">
              <span className={val < 0 ? 'text-negative' : ''}>
                {val === 0 ? '—' : formatCurrency(val * 1000)}
              </span>
            </td>
          );
        })}
      </tr>
      {expanded && row.children?.map(child => (
        <CashFlowExpandableRow key={child.code} row={child} depth={depth + 1} activeYears={activeYears} />
      ))}
    </>
  );
}

// ─── Axis formatter ───────────────────────────────────────────────────────────

const formatAxis = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1000) return `R$${(v / 1000).toFixed(0)}M`;
  return `R$${v.toFixed(0)}k`;
};

const formatBrl = (v: number) => {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

// ─── Month label helper ───────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function monthLabel(period: string): string {
  const parts = period.split('-');
  const m = parseInt(parts[1]) - 1;
  return `${MONTH_LABELS[m]}/${parts[0].slice(2)}`;
}

// ─── Monthly expandable row component ─────────────────────────────────────────

interface MonthlyCashFlowRow {
  code: string;
  label: string;
  isSummary?: boolean;
  values: Record<string, number>; // period -> value
  children?: MonthlyCashFlowRow[];
}

function MonthlyExpandableRow({ row, depth, periods }: { row: MonthlyCashFlowRow; depth: number; periods: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = row.children && row.children.length > 0;
  const total = periods.reduce((s, p) => s + (row.values[p] ?? 0), 0);

  return (
    <>
      <tr
        className={`border-b border-border/30 transition-colors ${
          row.isSummary ? 'bg-primary/5 font-bold' : 'hover:bg-secondary/20'
        }`}
      >
        <td
          className="p-3 whitespace-nowrap cursor-pointer select-none sticky left-0 bg-card"
          style={{ paddingLeft: `${12 + depth * 20}px` }}
          onClick={() => hasChildren && setExpanded(!expanded)}
        >
          <div className="flex items-center gap-1.5">
            {hasChildren ? (
              expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <span className="w-3.5" />
            )}
            <span className={`text-sm ${row.isSummary ? 'text-foreground' : 'text-foreground/90'}`}>
              {row.label}
            </span>
          </div>
        </td>
        {periods.map(p => {
          const val = row.values[p] ?? 0;
          return (
            <td key={p} className="text-right p-3 tabular-nums text-sm">
              <span className={val < 0 ? 'text-negative' : ''}>
                {val === 0 ? '—' : formatBrl(val)}
              </span>
            </td>
          );
        })}
        <td className="text-right p-3 tabular-nums text-sm font-semibold">
          <span className={total < 0 ? 'text-negative' : ''}>
            {total === 0 ? '—' : formatBrl(total)}
          </span>
        </td>
      </tr>
      {expanded && row.children?.map(child => (
        <MonthlyExpandableRow key={child.code} row={child} depth={depth + 1} periods={periods} />
      ))}
    </>
  );
}

// ─── Build tree from Oxy data ─────────────────────────────────────────────────

function buildCashFlowTreeFromOxy(data: import('@/hooks/useOxyCashFlow').OxyCashFlowData): {
  tree: MonthlyCashFlowRow[];
  balances: { period: string; opening: number; closing: number }[];
} {
  const periods = data.periods;

  // Build inflow children from recebido details
  const inflowChildren: MonthlyCashFlowRow[] = data.recebido.map((item, idx) => ({
    code: `IR.${idx}`,
    label: item.label,
    values: Object.fromEntries(item.data.map(d => [d.period, d.value])),
  }));

  // Build outflow children from pago details
  const outflowChildren: MonthlyCashFlowRow[] = data.pago.map((item, idx) => ({
    code: `OP.${idx}`,
    label: item.label,
    values: Object.fromEntries(item.data.map(d => [d.period, -Math.abs(d.value)])),
  }));

  // Totals from chart data (more reliable)
  const inflowValues: Record<string, number> = {};
  const outflowValues: Record<string, number> = {};
  data.chart.forEach(item => {
    inflowValues[item.month] = item.entradas;
    outflowValues[item.month] = -Math.abs(item.saidas);
  });

  const tree: MonthlyCashFlowRow[] = [
    {
      code: 'INFLOWS', label: 'Total Entradas', isSummary: true,
      values: inflowValues,
      children: inflowChildren,
    },
    {
      code: 'OUTFLOWS', label: 'Total Saídas', isSummary: true,
      values: outflowValues,
      children: outflowChildren,
    },
  ];

  // Compute running balances
  let opening = 0;
  const balances = periods.map(p => {
    const inflow = inflowValues[p] ?? 0;
    const outflow = outflowValues[p] ?? 0;
    const closing = opening + inflow + outflow;
    const row = { period: p, opening, closing };
    opening = closing;
    return row;
  });

  return { tree, balances };
}

// ─── Banking view component ──────────────────────────────────────────────────

function OxyBankingView({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { data, loading, error } = useOxyCashFlow(startDate, endDate, true);
  const [detailView, setDetailView] = useState<'recebido' | 'pago'>('recebido');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando dados bancários...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gradient-card p-6 text-center">
        <p className="text-sm text-destructive">Erro ao carregar dados bancários: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { tree: oxyTree, balances: oxyBalances } = data
    ? buildCashFlowTreeFromOxy(data)
    : { tree: [], balances: [] };

  const waterfallMonthly = data ? data.chart.map(item => ({
    month: monthLabel(item.month),
    Entradas: item.entradas,
    'Saídas': -Math.abs(item.saidas),
    'Saldo Líquido': item.saldo,
  })) : [];

  const chartData = data ? data.chart.map(item => ({
    month: monthLabel(item.month),
    Entradas: item.entradas,
    Saídas: item.saidas,
    Saldo: item.saldo,
  })) : [];

  // Summary totals
  const totalEntradas = data.chart.reduce((s, i) => s + i.entradas, 0);
  const totalSaidas = data.chart.reduce((s, i) => s + i.saidas, 0);
  const saldoTotal = totalEntradas - totalSaidas;

  const details = detailView === 'recebido' ? data.recebido : data.pago;
  // Sort by total descending
  const sortedDetails = [...details].sort((a, b) => {
    const totalA = a.data.reduce((s, d) => s + d.value, 0);
    const totalB = b.data.reduce((s, d) => s + d.value, 0);
    return totalB - totalA;
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="gradient-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Total Entradas</p>
          <p className="text-xl font-bold text-primary mt-1">{formatBrl(totalEntradas)}</p>
        </div>
        <div className="gradient-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Total Saídas</p>
          <p className="text-xl font-bold text-destructive mt-1">{formatBrl(totalSaidas)}</p>
        </div>
        <div className="gradient-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Saldo Líquido</p>
          <p className={`text-xl font-bold mt-1 ${saldoTotal >= 0 ? 'text-primary' : 'text-destructive'}`}>
            {formatBrl(saldoTotal)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold mb-4">Fluxo de Caixa Mensal — Dados Bancários (R$)</h3>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}
              formatter={(v: number, name: string) => [formatBrl(v), name]}
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
            <Bar dataKey="Entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="Saldo" stroke="hsl(var(--ring))" strokeWidth={2} dot={{ r: 3 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Projection Table */}
      <div className="gradient-card overflow-x-auto">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <h3 className="text-sm font-semibold">Projeção de Caixa — Visão Expandível</h3>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 tracking-wide">Bancário</span>
        </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium min-w-[240px] sticky left-0 bg-card">
                  Descrição
                </th>
                {data!.periods.map(p => (
                  <th key={p} className="text-right p-3 text-muted-foreground font-medium min-w-[100px]">
                    <div className="flex flex-col items-end gap-0.5">
                      <span>{monthLabel(p)}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 tracking-wide">
                        Bancário
                      </span>
                    </div>
                  </th>
                ))}
                <th className="text-right p-3 text-muted-foreground font-bold min-w-[110px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Saldo Inicial */}
              <tr className="border-b border-border/30 bg-primary/5 font-bold">
                <td className="p-3 sticky left-0 bg-card text-sm">Saldo Inicial</td>
                {oxyBalances.map(b => (
                  <td key={b.period} className="text-right p-3 tabular-nums text-sm">
                    {b.opening === 0 ? '—' : formatBrl(b.opening)}
                  </td>
                ))}
                <td className="text-right p-3 tabular-nums text-sm">—</td>
              </tr>

              {/* Entradas & Saídas */}
              {oxyTree.map(row => (
                <MonthlyExpandableRow key={row.code} row={row} depth={0} periods={data!.periods} />
              ))}

              {/* Saldo Final */}
              <tr className="border-b border-border bg-primary/10 font-bold">
                <td className="p-3 sticky left-0 bg-card text-sm text-foreground">Saldo Final</td>
                {oxyBalances.map(b => (
                  <td key={b.period} className={`text-right p-3 tabular-nums text-sm ${b.closing < 0 ? 'text-negative' : 'text-positive'}`}>
                    {formatBrl(b.closing)}
                  </td>
                ))}
                <td className="text-right p-3 tabular-nums text-sm font-bold">
                  {formatBrl(oxyBalances[oxyBalances.length - 1]?.closing ?? 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      

      {/* Waterfall Chart */}
      {waterfallMonthly.length > 0 && (
        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold mb-4">Fluxo de Caixa Mensal — Cascata (R$)</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={waterfallMonthly} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}
                formatter={(v: number, name: string) => [formatBrl(v), name]}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Bar dataKey="Entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saldo Líquido" fill="hsl(var(--ring))" radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detail Table */}
      <div className="gradient-card overflow-x-auto">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <h3 className="text-sm font-semibold mr-4">Detalhamento por Contraparte</h3>
          <div className="flex items-center bg-secondary rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setDetailView('recebido')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                detailView === 'recebido'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Recebido ({data.recebido.length})
            </button>
            <button
              onClick={() => setDetailView('pago')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                detailView === 'pago'
                  ? 'bg-destructive text-destructive-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pago ({data.pago.length})
            </button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-muted-foreground font-medium min-w-[240px] sticky left-0 bg-card">
                Contraparte
              </th>
              {data.periods.map(p => (
                <th key={p} className="text-right p-3 text-muted-foreground font-medium min-w-[100px]">
                  {monthLabel(p)}
                </th>
              ))}
              <th className="text-right p-3 text-muted-foreground font-bold min-w-[110px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedDetails.slice(0, 30).map((item, idx) => {
              const total = item.data.reduce((s, d) => s + d.value, 0);
              return (
                <tr key={idx} className="border-b border-border/30 hover:bg-secondary/20">
                  <td className="p-3 text-sm whitespace-nowrap sticky left-0 bg-card truncate max-w-[240px]" title={item.label}>
                    {item.label}
                  </td>
                  {data.periods.map(p => {
                    const found = item.data.find(d => d.period === p);
                    const val = found?.value ?? 0;
                    return (
                      <td key={p} className="text-right p-3 tabular-nums text-sm">
                        {val === 0 ? '—' : formatBrl(val)}
                      </td>
                    );
                  })}
                  <td className="text-right p-3 tabular-nums text-sm font-semibold">
                    {formatBrl(total)}
                  </td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr className="border-t-2 border-border bg-primary/5 font-bold">
              <td className="p-3 text-sm sticky left-0 bg-card">Total</td>
              {data.periods.map(p => {
                const periodTotal = sortedDetails.reduce((s, item) => {
                  const found = item.data.find(d => d.period === p);
                  return s + (found?.value ?? 0);
                }, 0);
                return (
                  <td key={p} className="text-right p-3 tabular-nums text-sm">
                    {formatBrl(periodTotal)}
                  </td>
                );
              })}
              <td className="text-right p-3 tabular-nums text-sm font-bold">
                {formatBrl(sortedDetails.reduce((s, item) => s + item.data.reduce((ss, d) => ss + d.value, 0), 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Valores em R$ · Fonte: Dados Bancários (Oxy Finance) · Período: {startDate} a {endDate}
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type CfSource = 'model' | 'db' | 'banking';

export default function CashFlow() {
  const { scenario, pnlTree, model, assumptions, setAssumptions, filteredYears } = useFinancialModel();
  const { cashFlowDb, loading: dreLoading } = useDreData();
  const [pmrOpen, setPmrOpen] = useState(false);
  const [editingPmr, setEditingPmr] = useState(false);
  const [pmrDraft, setPmrDraft] = useState(assumptions.pmrConfig);
  const [cfSource, setCfSource] = useState<CfSource>('model');

  const activeYears: Year[] = filteredYears.length > 0 ? filteredYears : [...YEARS];

  // Build receivablesChange lookup from engine
  const receivablesChange: Record<Year, number> = {} as Record<Year, number>;
  for (const y of YEARS) {
    receivablesChange[y] = model.years[y].receivablesChange;
  }

  const tree = cfSource === 'db' && cashFlowDb
    ? buildCashFlowTreeFromDb(cashFlowDb, receivablesChange)
    : buildCashFlowTree(pnlTree, receivablesChange);

  // Compute opening/closing balances
  let openingBalance = 0;
  const allBalanceData = YEARS.map(y => {
    const inflows = tree[0].getValues(y);
    const outflows = tree[1].getValues(y);
    const closing = openingBalance + inflows + outflows;
    const row = { year: y.toString(), opening: openingBalance, inflows, outflows, closing };
    openingBalance = closing;
    return row;
  });

  const balanceData = allBalanceData.filter(d => activeYears.includes(Number(d.year) as Year));

  const waterfallData = balanceData.map(d => ({
    year: d.year,
    Entradas: d.inflows,
    'Saídas': d.outflows,
    'Saldo Líquido': d.closing,
  }));

  const savePmr = () => {
    setAssumptions({ ...assumptions, pmrConfig: pmrDraft });
    setEditingPmr(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-primary">Fluxo de Caixa</h2>

        {/* Data source toggle */}
        <div className="flex items-center gap-2">
          {dreLoading && cfSource === 'db' && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          <div className="flex items-center bg-secondary rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setCfSource('model')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                cfSource === 'model'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calculator className="h-3.5 w-3.5" />
              Modelo
            </button>
            <button
              onClick={() => setCfSource('db')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                cfSource === 'db'
                  ? 'bg-emerald-600 text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              Realizado
            </button>
            <button
              onClick={() => setCfSource('banking')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                cfSource === 'banking'
                  ? 'bg-blue-600 text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Landmark className="h-3.5 w-3.5" />
              Bancário
            </button>
          </div>
        </div>
      </div>

      {/* Banking view */}
      {cfSource === 'banking' ? (
        <OxyBankingView startDate="2025-01-01" endDate="2025-12-31" />
      ) : (
        <>
          {/* PMR Panel */}
          <div className="gradient-card">
            <button
              className="w-full flex items-center justify-between p-5 text-left"
              onClick={() => setPmrOpen(o => !o)}
            >
              <div>
                <h3 className="text-sm font-semibold">Prazo Médio de Recebimento (PMR)</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  CaaS {assumptions.pmrConfig.caas}d · SaaS {assumptions.pmrConfig.saas}d · Education {assumptions.pmrConfig.education}d · BaaS {assumptions.pmrConfig.baas}d
                </p>
              </div>
              {pmrOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {pmrOpen && (
              <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(['caas', 'saas', 'education', 'baas'] as const).map(bu => (
                    <div key={bu} className="space-y-1">
                      <p className="text-xs text-muted-foreground capitalize">{bu} (dias)</p>
                      {editingPmr ? (
                        <input
                          type="number"
                          min="0"
                          max="180"
                          className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                          value={pmrDraft[bu]}
                          onChange={e => setPmrDraft(p => ({ ...p, [bu]: Number(e.target.value) || 0 }))}
                        />
                      ) : (
                        <p className="text-sm font-semibold">{assumptions.pmrConfig[bu]} dias</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  {editingPmr ? (
                    <>
                      <button onClick={savePmr} className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                        Salvar PMR
                      </button>
                      <button onClick={() => { setPmrDraft(assumptions.pmrConfig); setEditingPmr(false); }} className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { setPmrDraft(assumptions.pmrConfig); setEditingPmr(true); }} className="px-3 py-1.5 text-xs font-semibold border border-primary/40 rounded-lg text-primary hover:bg-primary/10 transition-colors">
                      Editar PMR
                    </button>
                  )}
                </div>

                {/* Receivables change preview */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 text-muted-foreground font-medium">Variação de Recebíveis</th>
                        {activeYears.map(y => (
                          <th key={y} className="text-right py-1.5 text-muted-foreground font-medium min-w-[90px]">{y}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1.5 font-medium">Delta Contas a Receber</td>
                        {activeYears.map(y => {
                          const val = receivablesChange[y] ?? 0;
                          return (
                            <td key={y} className={`text-right py-1.5 tabular-nums ${val < 0 ? 'text-negative' : 'text-positive'}`}>
                              {val === 0 ? '—' : formatCurrency(val * 1000)}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Expandable Table */}
          <div className="gradient-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium min-w-[240px] sticky left-0 bg-card">
                    Descrição
                  </th>
                  {activeYears.map(y => {
                    const isDb = cfSource === 'db';
                    return (
                      <th key={y} className="text-right p-3 text-muted-foreground font-medium min-w-[110px]">
                        <div className="flex flex-col items-end gap-0.5">
                          <span>{y}</span>
                          {isDb && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 tracking-wide">
                              Realizado
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Saldo Inicial */}
                <tr className="border-b border-border/30 bg-primary/5 font-bold">
                  <td className="p-3 sticky left-0 bg-card text-sm">Saldo Inicial</td>
                  {balanceData.map(d => (
                    <td key={d.year} className="text-right p-3 tabular-nums text-sm">
                      {d.opening === 0 ? '—' : formatCurrency(d.opening * 1000)}
                    </td>
                  ))}
                </tr>

                {/* Entradas & Saídas */}
                {tree.map(row => (
                  <CashFlowExpandableRow key={row.code} row={row} depth={0} activeYears={activeYears} />
                ))}

                {/* Saldo Final */}
                <tr className="border-b border-border bg-primary/10 font-bold">
                  <td className="p-3 sticky left-0 bg-card text-sm text-foreground">Saldo Final</td>
                  {balanceData.map(d => (
                    <td key={d.year} className={`text-right p-3 tabular-nums text-sm ${d.closing < 0 ? 'text-negative' : 'text-positive'}`}>
                      {formatCurrency(d.closing * 1000)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Waterfall Chart */}
          <div className="gradient-card p-5">
            <h3 className="text-sm font-semibold mb-4">Fluxo de Caixa Anual — Cascata (R$ mil)</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={waterfallData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22% / 0.5)" />
                <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={13} />
                <YAxis stroke="hsl(215 20% 55%)" fontSize={13} tickFormatter={formatAxis} />
                <Tooltip
                  contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 13 }}
                  labelStyle={{ color: 'hsl(210 40% 98%)', fontWeight: 700 }}
                  formatter={(v: number, name: string) => [formatCurrency(v * 1000), name]}
                />
                <ReferenceLine y={0} stroke="hsl(215 20% 55%)" strokeDasharray="3 3" />
                <Bar dataKey="Entradas" fill="hsl(166 72% 28%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Saídas" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Saldo Líquido" fill="hsl(221 83% 53%)" radius={[4, 4, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[10px] text-muted-foreground text-center pt-2">
            Valores em R$ mil (000's) · {scenario} scenario · Fonte: {cfSource === 'db' ? 'Realizado (Banco DRE)' : 'Modelo de Projeção'}
          </p>
        </>
      )}
    </div>
  );
}
