import { useState } from 'react';
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS, Year } from '@/lib/financialData';
import { PnlNode } from '@/lib/pnlData';
import { formatCurrency } from '@/lib/formatters';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine,
} from 'recharts';
import {
  HISTORICAL_PERIODS,
  historicalRevenue,
  historicalDeductions,
  historicalCosts,
  historicalExpenses,
  historicalFinancial,
} from '@/data/historicalData';
import { DataSourceBadge } from '@/components/period/DataSourceBadge';
import { getYearDataSource } from '@/lib/periodResolution';

// ─── Period helpers ───────────────────────────────────────────────────────────

const HIST_2025 = HISTORICAL_PERIODS.filter(p => p.startsWith('2025'));
const HIST_2026 = HISTORICAL_PERIODS.filter(p => p.startsWith('2026'));

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

/** Sum a specific item within a financial category: historicalFinancial[catCode][groupName][itemName] */
function sumFinancialItem(
  catCode: string,
  groupName: string,
  itemName: string,
  periods: readonly string[],
): number {
  const item = historicalFinancial[catCode]?.[groupName]?.[itemName];
  if (!item) return 0;
  return periods.reduce((acc, p) => acc + (item[p] ?? 0), 0) / 1000;
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

function sumExpenseGroup(groupName: string, periods: readonly string[]): number {
  const group = historicalExpenses[groupName];
  if (!group) return 0;
  return periods.reduce((acc, p) => acc + (group[p] ?? 0), 0) / 1000;
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
  return node.annual[year];
}

// ─── Blending logic ───────────────────────────────────────────────────────────

/** 2025 → full historical; 2026 → 3 months real + 9/12 engine; 2027+ → engine */
function blend(
  year: Year,
  histFn: (periods: readonly string[]) => number,
  engineVal: number,
): number {
  if (year === 2025) return histFn(HIST_2025);
  if (year === 2026) {
    const hist3m = histFn(HIST_2026);          // 3 months of real data
    const engine9m = engineVal * (9 / 12);     // 9 months of engine projection
    return hist3m + engine9m;
  }
  return engineVal;
}

// ─── Cash flow row type ───────────────────────────────────────────────────────

interface CashFlowRow {
  code: string;
  label: string;
  isSummary?: boolean;
  isHighlight?: boolean;
  getValues: (year: Year) => number;
  children?: CashFlowRow[];
}

// ─── Tree builder (model mode) ────────────────────────────────────────────────

function buildCashFlowTree(tree: PnlNode[]): CashFlowRow[] {
  // ── [1] Entradas ──────────────────────────────────────────────────────────
  const entradaItems: CashFlowRow[] = [
    {
      code: 'E.1', label: 'Receita CaaS',
      getValues: (y) => blend(y, (ps) => sumFlat(historicalRevenue['CaaS'] ?? {}, ps), getAnnual('1.1', y, tree)),
    },
    {
      code: 'E.2', label: 'Receita SaaS',
      getValues: (y) => blend(y, (ps) => sumFlat(historicalRevenue['SaaS'] ?? {}, ps), getAnnual('1.2', y, tree)),
    },
    {
      code: 'E.3', label: 'Receita Education',
      getValues: (y) => blend(y, (ps) => sumFlat(historicalRevenue['Education'] ?? {}, ps), getAnnual('1.3', y, tree)),
    },
    {
      code: 'E.4', label: 'Receita BaaS',
      getValues: (y) => blend(y, () => 0, getAnnual('1.4', y, tree)),
    },
    {
      code: 'E.5', label: 'Receita Expansão',
      getValues: (y) => blend(y, (ps) => sumFlat(historicalRevenue['Expansão'] ?? {}, ps), 0),
    },
  ];

  const entradas: CashFlowRow = {
    code: '[1]', label: '[1] Entradas', isSummary: true,
    getValues: (y) => entradaItems.reduce((s, r) => s + r.getValues(y), 0),
    children: entradaItems,
  };

  // ── [2] Saídas (Operating Outflows) ───────────────────────────────────────
  const saidaItems: CashFlowRow[] = [
    {
      code: 'S.1', label: 'Impostos Indiretos',
      getValues: (y) => blend(
        y,
        (ps) => -sumDeductions(ps),
        getAnnual('2', y, tree),   // engine deductions are already negative
      ),
    },
    {
      code: 'S.2', label: 'Impostos Diretos (IRPJ/CSLL)',
      getValues: (y) => blend(
        y,
        (ps) => -sumFinancialCat('PROV', ps),
        getAnnual('TAX', y, tree),
      ),
    },
    {
      code: 'S.3', label: 'Custo com Serviços',
      getValues: (y) => blend(
        y,
        (ps) => -sumCosts(ps),
        getAnnual('3', y, tree),
      ),
    },
    {
      code: 'S.4', label: 'Comissões Sobre Vendas',
      getValues: (y) => blend(
        y,
        () => 0,  // commissions are already within Despesas Comerciais in historicals
        getAnnual('3.1', y, tree),
      ),
    },
    {
      code: 'S.5', label: 'Marketing',
      getValues: (y) => blend(
        y,
        (ps) => -sumExpenseGroup('Despesas de Marketing', ps),
        getAnnual('7', y, tree),
      ),
    },
    {
      code: 'S.6', label: 'Despesas Administrativas',
      getValues: (y) => blend(
        y,
        (ps) => -sumExpenseGroup('Despesas Administrativas', ps),
        getAnnual('4', y, tree),
      ),
    },
    {
      code: 'S.7', label: 'Despesas com Pessoal',
      getValues: (y) => blend(
        y,
        (ps) => -sumExpenseGroup('Despesas com Pessoal', ps),
        getAnnual('5', y, tree),
      ),
    },
    {
      code: 'S.8', label: 'Despesas Comerciais',
      getValues: (y) => blend(
        y,
        (ps) => -sumExpenseGroup('Despesas Comerciais', ps),
        getAnnual('6', y, tree),
      ),
    },
    {
      code: 'S.9', label: 'Outros',
      getValues: (y) => blend(
        y,
        (ps) => -sumFinancialCat('DNO', ps),
        getAnnual('10', y, tree),
      ),
    },
  ];

  const totalSaidas: CashFlowRow = {
    code: '[3]', label: '[3] Total Saídas', isSummary: true,
    getValues: (y) => saidaItems.reduce((s, r) => s + r.getValues(y), 0),
    children: saidaItems,
  };

  // ── [2+3] Fluxo de Caixa Operacional ─────────────────────────────────────
  const fluxoOperacional: CashFlowRow = {
    code: '[2+3]', label: '[2+3] Fluxo de Caixa Operacional', isSummary: true, isHighlight: true,
    getValues: (y) => entradas.getValues(y) + totalSaidas.getValues(y),
  };

  // ── Non-Operational Items ─────────────────────────────────────────────────
  const nonOpItems: CashFlowRow[] = [
    {
      code: 'N.1', label: 'Rendimentos de Aplicações',
      getValues: (y) => blend(
        y,
        (ps) => sumFinancialItem('RF', 'Receitas Financeiras', 'Rendimentos de Aplicações', ps),
        0,
      ),
    },
    {
      code: 'N.2', label: 'Juros Recebidos',
      getValues: (y) => blend(
        y,
        (ps) => sumFinancialItem('RF', 'Receitas Financeiras', 'Juros Recebidos', ps),
        0,
      ),
    },
    {
      code: 'N.3', label: 'Tarifas e Taxas Bancárias',
      getValues: (y) => blend(
        y,
        (ps) => -sumFinancialItem('DF', 'Despesas Financeira', 'Tarifas e Taxas Bancárias', ps),
        0,
      ),
    },
    {
      code: 'N.4', label: 'Juros sobre Empréstimos e Financiamentos',
      getValues: (y) => blend(
        y,
        (ps) => -sumFinancialItem('DF', 'Despesas Financeira', 'Juros sobre Empréstimos e Financiamentos', ps),
        0,
      ),
    },
    {
      code: 'N.5', label: 'Amortização de Empréstimos Bancos',
      getValues: (y) => blend(
        y,
        (ps) => -sumFinancialItem('AD', 'Amortização da Dívida Global', 'Amortização de Empréstimos Bancos', ps),
        getAnnual('11.01', y, tree),
      ),
    },
    {
      code: 'N.6', label: 'Pagamento de Tributos Parcelados',
      getValues: (y) => blend(
        y,
        (ps) => -sumFinancialItem('AD', 'Amortização da Dívida Global', 'Pagamento de Tributos Parcelados', ps),
        getAnnual('11.02', y, tree),
      ),
    },
    {
      code: 'N.7', label: 'Pagamento de Dívida com Fornecedores Parcelado',
      getValues: (y) => blend(
        y,
        (ps) => -sumFinancialItem('AD', 'Amortização da Dívida Global', 'Pagamento de Dívida com Fornecedores Parcelado', ps),
        getAnnual('11.03', y, tree),
      ),
    },
    {
      code: 'N.8', label: 'Investimentos (Capex)',
      getValues: (y) => blend(
        y,
        (ps) => -sumFinancialCat('INV', ps),
        getAnnual('12', y, tree),
      ),
    },
    {
      code: 'N.9', label: 'Aportes',
      getValues: () => 0,
    },
    {
      code: 'N.10', label: 'Dividendos',
      getValues: () => 0,
    },
  ];

  const resultadoNaoOp: CashFlowRow = {
    code: '[4]', label: '[4] Resultado Não Operacional', isSummary: true,
    getValues: (y) => nonOpItems.reduce((s, r) => s + r.getValues(y), 0),
    children: nonOpItems,
  };

  return [entradas, totalSaidas, fluxoOperacional, resultadoNaoOp];
}


// ─── Expandable row component ─────────────────────────────────────────────────

function CashFlowExpandableRow({ row, depth, activeYears }: { row: CashFlowRow; depth: number; activeYears: Year[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = row.children && row.children.length > 0;

  return (
    <>
      <tr
        className={`border-b border-border/30 transition-colors ${
          row.isHighlight
            ? 'bg-primary/10 font-bold'
            : row.isSummary
              ? 'bg-primary/5 font-bold'
              : 'hover:bg-secondary/20'
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
              <span className={val < -0.5 ? 'text-negative' : val > 0.5 ? 'text-positive' : ''}>
                {Math.abs(val) < 0.5 ? '—' : formatCurrency(val * 1000)}
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CashFlow() {
  const { scenario, pnlTree, assumptions, setAssumptions, filteredYears, rangeDataSource } = useFinancialModel();
  const [pmrOpen, setPmrOpen] = useState(false);
  const [editingPmr, setEditingPmr] = useState(false);
  const [pmrDraft, setPmrDraft] = useState(assumptions.pmrConfig);

  const activeYears: Year[] = filteredYears.length > 0 ? filteredYears : [...YEARS];

  const tree = buildCashFlowTree(pnlTree);

  // tree[0] = [1] Entradas, tree[1] = [3] Total Saídas, tree[2] = [2+3] Fluxo Op, tree[3] = [4] Não Op
  const getEntradas = (y: Year) => tree[0].getValues(y);
  const getSaidas = (y: Year) => tree[1].getValues(y);
  const getFluxoOp = (y: Year) => tree[2].getValues(y);
  const getNaoOp = (y: Year) => tree[3].getValues(y);

  // Compute opening/closing balances
  let openingBalance = 0;
  const allBalanceData = YEARS.map(y => {
    const fluxoOp = getFluxoOp(y);
    const naoOp = getNaoOp(y);
    const closing = openingBalance + fluxoOp + naoOp;
    const row = {
      year: y.toString(),
      opening: openingBalance,
      entradas: getEntradas(y),
      saidas: getSaidas(y),
      fluxoOp,
      naoOp,
      closing,
    };
    openingBalance = closing;
    return row;
  });

  const balanceData = allBalanceData.filter(d => activeYears.includes(Number(d.year) as Year));

  const waterfallData = balanceData.map(d => ({
    year: d.year,
    Entradas: d.entradas,
    'Saídas': d.saidas,
    'Fluxo Operacional': d.fluxoOp,
    'Não Operacional': d.naoOp,
    'Saldo Final': d.closing,
  }));

  const savePmr = () => {
    setAssumptions({ ...assumptions, pmrConfig: pmrDraft });
    setEditingPmr(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold text-primary">Fluxo de Caixa</h2>
        <DataSourceBadge source={rangeDataSource} />
      </div>

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
          </div>
        )}
      </div>

      {/* Expandable Table */}
      <div className="gradient-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-muted-foreground font-medium min-w-[280px] sticky left-0 bg-card">
                Descrição
              </th>
              {activeYears.map(y => (
                <th key={y} className="text-right p-3 text-muted-foreground font-medium min-w-[110px]">
                  <div className="flex flex-col items-end gap-1">
                    <span>{y}</span>
                    <DataSourceBadge source={getYearDataSource(y)} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Saldo Inicial */}
            <tr className="border-b border-border/30 bg-primary/5 font-bold">
              <td className="p-3 sticky left-0 bg-card text-sm">Saldo Inicial</td>
              {balanceData.map(d => (
                <td key={d.year} className="text-right p-3 tabular-nums text-sm">
                  {Math.abs(d.opening) < 0.5 ? '—' : formatCurrency(d.opening * 1000)}
                </td>
              ))}
            </tr>

            {/* [1] Entradas */}
            <CashFlowExpandableRow key={tree[0].code} row={tree[0]} depth={0} activeYears={activeYears} />

            {/* [2] Saídas (expandable with items) */}
            <CashFlowExpandableRow key={tree[1].code} row={tree[1]} depth={0} activeYears={activeYears} />

            {/* [2+3] Fluxo de Caixa Operacional (computed, not expandable) */}
            <CashFlowExpandableRow key={tree[2].code} row={tree[2]} depth={0} activeYears={activeYears} />

            {/* Separator */}
            <tr className="border-b border-border/10">
              <td colSpan={activeYears.length + 1} className="py-1" />
            </tr>

            {/* [4] Resultado Não Operacional (expandable) */}
            <CashFlowExpandableRow key={tree[3].code} row={tree[3]} depth={0} activeYears={activeYears} />

            {/* Saldo Final */}
            <tr className="border-b border-border bg-primary/10 font-bold">
              <td className="p-3 sticky left-0 bg-card text-sm text-foreground">Saldo Final</td>
              {balanceData.map(d => (
                <td key={d.year} className={`text-right p-3 tabular-nums text-sm ${d.closing < -0.5 ? 'text-negative' : 'text-positive'}`}>
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
            <Bar dataKey="Fluxo Operacional" fill="hsl(221 83% 53%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Não Operacional" fill="hsl(45 93% 47%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Saldo Final" fill="hsl(280 60% 50%)" radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Valores em R$ mil (000's) · {scenario} scenario · período segue automaticamente realizado, projetado e combinado
      </p>
    </div>
  );
}
