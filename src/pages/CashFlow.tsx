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

// ─── Period helpers ───────────────────────────────────────────────────────────

const HIST_2025 = HISTORICAL_PERIODS.filter(p => p.startsWith('2025'));

/**
 * Sums a flat { period: value } map for the given periods.
 * Returns R$ thousands (divides raw R$ by 1000).
 */
function sumFlat(data: Record<string, number>, periods: readonly string[]): number {
  return periods.reduce((acc, p) => acc + (data[p] ?? 0), 0) / 1000;
}

/**
 * Sums all groups → items for a category in historicalFinancial over the given periods.
 * historicalFinancial[cat][group][item][period] = R$
 * Returns R$ thousands.
 */
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

/**
 * Sums all items in historicalDeductions across all periods provided.
 * Returns R$ thousands.
 */
function sumDeductions(periods: readonly string[]): number {
  let total = 0;
  for (const item of Object.values(historicalDeductions)) {
    total += periods.reduce((acc, p) => acc + (item[p] ?? 0), 0);
  }
  return total / 1000;
}

/**
 * Sums all groups in historicalCosts for the given periods.
 * Returns R$ thousands.
 */
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

/**
 * Returns a blended value (R$ thousands) for a given year:
 *   2025 → historical 12-month sum
 *   2026 → engine value directly (PnL nodes are pre-blended by applyHistoricalOverrides:
 *           real Jan-Mar actual + engine Apr-Dec projection, summed month by month)
 *   2027+ → engine value
 *
 * histFn is kept for signature compatibility but is only called for year === 2025.
 * For rows with no engine node (engineVal === 0) in 2026, the result will be 0 —
 * this is acceptable since Expansão / Outras Receitas / DNO have no projected values.
 */
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

// ─── Tree builder ─────────────────────────────────────────────────────────────

function buildCashFlowTree(tree: PnlNode[], receivablesChange: Record<Year, number>): CashFlowRow[] {
  // ── ENTRADAS (Inflows) ────────────────────────────────────────────────────
  const inflows: CashFlowRow[] = [
    {
      code: 'I.1', label: 'Receita CaaS',
      getValues: (y) => blend(
        y,
        (ps) => sumFlat(historicalRevenue['CaaS'] ?? {}, ps),
        getAnnual('1.1', y, tree),
      ),
    },
    {
      code: 'I.2', label: 'Receita SaaS',
      getValues: (y) => blend(
        y,
        (ps) => sumFlat(historicalRevenue['SaaS'] ?? {}, ps),
        getAnnual('1.2', y, tree),
      ),
    },
    {
      code: 'I.3', label: 'Receita Education',
      getValues: (y) => blend(
        y,
        (ps) => sumFlat(historicalRevenue['Education'] ?? {}, ps),
        getAnnual('1.3', y, tree),
      ),
    },
    {
      // BaaS revenue is stored under Expansão (code 1.5) in the engine PnL tree.
      // No historical data in Oxy DB — zero for 2025.
      code: 'I.4', label: 'Receita BaaS',
      getValues: (y) => blend(
        y,
        () => 0,
        getAnnual('1.5', y, tree),
      ),
    },
    {
      code: 'I.5', label: 'Receita Expansão',
      getValues: (y) => blend(
        y,
        (ps) => sumFlat(historicalRevenue['Expansão'] ?? {}, ps),
        // No engine node for Expansão BU — 0 for projected years
        0,
      ),
    },
    {
      // Tax BU revenue + Non-operating income (RNO)
      code: 'I.6', label: 'Outras Receitas',
      getValues: (y) => blend(
        y,
        (ps) => sumFlat(historicalRevenue['Tax'] ?? {}, ps) + sumFinancialCat('RNO', ps),
        // No direct engine node — 0 for projected years
        0,
      ),
    },
    {
      code: 'I.7', label: 'Receitas Financeiras',
      getValues: (y) => blend(
        y,
        (ps) => sumFinancialCat('RF', ps),
        Math.max(0, getAnnual('8', y, tree)),
      ),
    },
    {
      // Receivables delta — engine-only; no historical equivalent in DB
      code: 'I.8', label: 'Variação de Contas a Receber',
      getValues: (y) => receivablesChange[y] ?? 0,
    },
  ];

  // ── SAÍDAS (Outflows) ─────────────────────────────────────────────────────
  // Engine values are negative; historical values are positive R$ — must negate.
  const outflows: CashFlowRow[] = [
    {
      code: 'O.1', label: 'Deduções de Vendas',
      getValues: (y) => blend(
        y,
        (ps) => -sumDeductions(ps),
        getAnnual('2', y, tree),
      ),
    },
    {
      code: 'O.2', label: 'Custos Variáveis',
      getValues: (y) => blend(
        y,
        (ps) => -sumCosts(ps),
        getAnnual('3', y, tree),
      ),
    },
    {
      code: 'O.3', label: 'Despesas Administrativas',
      getValues: (y) => blend(
        y,
        (ps) => -sumFlat(historicalExpenses['Despesas Administrativas'] ?? {}, ps),
        getAnnual('4', y, tree),
      ),
    },
    {
      code: 'O.4', label: 'Despesas Comerciais',
      getValues: (y) => blend(
        y,
        (ps) => -sumFlat(historicalExpenses['Despesas Comerciais'] ?? {}, ps),
        getAnnual('6', y, tree),
      ),
    },
    {
      code: 'O.5', label: 'Despesas com Pessoal',
      getValues: (y) => blend(
        y,
        (ps) => -sumFlat(historicalExpenses['Despesas com Pessoal'] ?? {}, ps),
        getAnnual('5', y, tree),
      ),
    },
    {
      code: 'O.6', label: 'Despesas de Marketing',
      getValues: (y) => blend(
        y,
        (ps) => -sumFlat(historicalExpenses['Despesas de Marketing'] ?? {}, ps),
        getAnnual('7', y, tree),
      ),
    },
    {
      code: 'O.7', label: 'Despesas Financeiras',
      getValues: (y) => blend(
        y,
        (ps) => -sumFinancialCat('DF', ps),
        Math.min(0, getAnnual('8', y, tree)),
      ),
    },
    {
      code: 'O.8', label: 'Despesas Não Operacionais',
      getValues: (y) => blend(
        y,
        (ps) => -sumFinancialCat('DNO', ps),
        // No engine node for DNO — 0 for projected years
        0,
      ),
    },
    {
      code: 'O.9', label: 'Provisões (IRPJ/CSLL)',
      getValues: (y) => blend(
        y,
        (ps) => -sumFinancialCat('PROV', ps),
        getAnnual('TAX', y, tree),
      ),
    },
    {
      code: 'O.10', label: 'Amortização de Dívida',
      getValues: (y) => blend(
        y,
        (ps) => -sumFinancialCat('AD', ps),
        getAnnual('11', y, tree),
      ),
    },
    {
      code: 'O.11', label: 'Investimentos (Capex)',
      getValues: (y) => blend(
        y,
        (ps) => -sumFinancialCat('INV', ps),
        getAnnual('12', y, tree),
      ),
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CashFlow() {
  const { scenario, pnlTree, model, assumptions, setAssumptions, filteredYears } = useFinancialModel();
  const [pmrOpen, setPmrOpen] = useState(false);
  const [editingPmr, setEditingPmr] = useState(false);
  const [pmrDraft, setPmrDraft] = useState(assumptions.pmrConfig);

  // Use filteredYears for visible columns; fall back to all YEARS if empty
  const activeYears: Year[] = filteredYears.length > 0 ? filteredYears : [...YEARS];

  // Build receivablesChange lookup from engine (always full YEARS for sequential balance calc)
  const receivablesChange: Record<Year, number> = {} as Record<Year, number>;
  for (const y of YEARS) {
    receivablesChange[y] = model.years[y].receivablesChange;
  }

  const tree = buildCashFlowTree(pnlTree, receivablesChange);

  // Compute opening/closing balances — must run sequentially over ALL years so opening balance
  // is correct even when viewing a subset. Then we filter to activeYears for display.
  let openingBalance = 0;
  const allBalanceData = YEARS.map(y => {
    const inflows = tree[0].getValues(y);
    const outflows = tree[1].getValues(y);
    const closing = openingBalance + inflows + outflows;
    const row = { year: y.toString(), opening: openingBalance, inflows, outflows, closing };
    openingBalance = closing;
    return row;
  });

  // Only show balance rows for activeYears
  const balanceData = allBalanceData.filter(d => activeYears.includes(Number(d.year) as Year));

  // Waterfall chart data
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
      <h2 className="text-2xl font-bold">Fluxo de Caixa</h2>

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
                const isHistorical = y === 2025;
                const isPartial    = y === 2026;
                return (
                  <th key={y} className="text-right p-3 text-muted-foreground font-medium min-w-[110px]">
                    <div className="flex flex-col items-end gap-0.5">
                      <span>{y}</span>
                      {isHistorical && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 tracking-wide">
                          Realizado
                        </span>
                      )}
                      {isPartial && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 tracking-wide">
                          Parcial
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
        Valores em R$ mil (000's) · {scenario} scenario · 2025 Realizado · 2026 Jan–Mar Realizado + Projeção
      </p>
    </div>
  );
}
