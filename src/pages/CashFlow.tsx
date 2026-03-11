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

// Engine already applies scenario — read directly from pnlTree
function getAnnual(code: string, year: Year, tree: PnlNode[]): number {
  const node = findNode(code, tree);
  if (!node) return 0;
  return Math.round(node.annual[year]);
}

interface CashFlowRow {
  code: string;
  label: string;
  isSummary?: boolean;
  getValues: (year: Year) => number;
  children?: CashFlowRow[];
}

function buildCashFlowTree(tree: PnlNode[], receivablesChange: Record<Year, number>): CashFlowRow[] {
  const inflows: CashFlowRow[] = [
    { code: 'I.1', label: 'CaaS Revenue', getValues: (y) => getAnnual('1.1', y, tree) },
    { code: 'I.2', label: 'SaaS Revenue', getValues: (y) => getAnnual('1.2', y, tree) },
    { code: 'I.3', label: 'Education', getValues: (y) => getAnnual('1.3', y, tree) },
    { code: 'I.4', label: 'BaaS', getValues: (y) => getAnnual('1.4', y, tree) },
    { code: 'I.5', label: 'Financial Income', getValues: (y) => Math.max(0, getAnnual('8', y, tree)) },
    { code: 'I.6', label: 'Variacao de Contas a Receber', getValues: (y) => receivablesChange[y] ?? 0 },
  ];

  const outflows: CashFlowRow[] = [
    { code: 'O.1', label: 'Sales Deductions', getValues: (y) => getAnnual('2', y, tree) },
    { code: 'O.2', label: 'COGS', getValues: (y) => getAnnual('3', y, tree) },
    { code: 'O.3', label: 'SG&A', getValues: (y) => getAnnual('4', y, tree) },
    { code: 'O.4', label: 'Headcount', getValues: (y) => getAnnual('5', y, tree) },
    { code: 'O.5', label: 'Commissions', getValues: (y) => getAnnual('3.1', y, tree) },
    { code: 'O.6', label: 'Marketing', getValues: (y) => getAnnual('7', y, tree) },
    { code: 'O.7', label: 'Commercial', getValues: (y) => getAnnual('6', y, tree) },
    { code: 'O.8', label: 'Taxes', getValues: (y) => getAnnual('TAX', y, tree) },
    { code: 'O.9', label: 'Debt Repayments', getValues: (y) => getAnnual('11', y, tree) },
    { code: 'O.10', label: 'Capex', getValues: (y) => getAnnual('12', y, tree) },
    { code: 'O.11', label: 'Financial Costs', getValues: (y) => Math.min(0, getAnnual('8', y, tree)) },
  ];

  return [
    {
      code: 'INFLOWS', label: 'Total Inflows', isSummary: true,
      getValues: (y) => inflows.reduce((s, r) => s + r.getValues(y), 0),
      children: inflows,
    },
    {
      code: 'OUTFLOWS', label: 'Total Outflows', isSummary: true,
      getValues: (y) => outflows.reduce((s, r) => s + r.getValues(y), 0),
      children: outflows,
    },
  ];
}

function CashFlowExpandableRow({ row, depth }: { row: CashFlowRow; depth: number }) {
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
        {YEARS.map(y => {
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
        <CashFlowExpandableRow key={child.code} row={child} depth={depth + 1} />
      ))}
    </>
  );
}

const formatAxis = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1000) return `R$${(v / 1000).toFixed(0)}M`;
  return `R$${v.toFixed(0)}k`;
};

export default function CashFlow() {
  const { scenario, pnlTree, model, assumptions, setAssumptions } = useFinancialModel();
  const [pmrOpen, setPmrOpen] = useState(false);
  const [editingPmr, setEditingPmr] = useState(false);
  const [pmrDraft, setPmrDraft] = useState(assumptions.pmrConfig);

  // Build receivablesChange lookup from engine
  const receivablesChange: Record<Year, number> = {} as Record<Year, number>;
  for (const y of YEARS) {
    receivablesChange[y] = model.years[y].receivablesChange;
  }

  const tree = buildCashFlowTree(pnlTree, receivablesChange);

  // Compute opening/closing balances
  let openingBalance = 0;
  const balanceData = YEARS.map(y => {
    const inflows = tree[0].getValues(y);
    const outflows = tree[1].getValues(y);
    const closing = openingBalance + inflows + outflows;
    const row = { year: y.toString(), opening: openingBalance, inflows, outflows, closing };
    openingBalance = closing;
    return row;
  });

  // Waterfall chart data
  const waterfallData = balanceData.map(d => ({
    year: d.year,
    Inflows: d.inflows,
    Outflows: d.outflows,
    'Net Cash': d.closing,
  }));

  const savePmr = () => {
    setAssumptions({ ...assumptions, pmrConfig: pmrDraft });
    setEditingPmr(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Cash Flow</h2>

      {/* PMR Panel */}
      <div className="gradient-card">
        <button
          className="w-full flex items-center justify-between p-5 text-left"
          onClick={() => setPmrOpen(o => !o)}
        >
          <div>
            <h3 className="text-sm font-semibold">Prazo Medio de Recebimento (PMR)</h3>
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
                    <th className="text-left py-1.5 text-muted-foreground font-medium">Variacao de Recebíveis</th>
                    {YEARS.map(y => (
                      <th key={y} className="text-right py-1.5 text-muted-foreground font-medium min-w-[90px]">{y}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1.5 font-medium">Delta Contas a Receber</td>
                    {YEARS.map(y => {
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
                Description
              </th>
              {YEARS.map(y => (
                <th key={y} className="text-right p-3 text-muted-foreground font-medium min-w-[110px]">{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Opening Balance */}
            <tr className="border-b border-border/30 bg-primary/5 font-bold">
              <td className="p-3 sticky left-0 bg-card text-sm">Opening Balance</td>
              {balanceData.map(d => (
                <td key={d.year} className="text-right p-3 tabular-nums text-sm">
                  {d.opening === 0 ? '—' : formatCurrency(d.opening * 1000)}
                </td>
              ))}
            </tr>

            {/* Inflows & Outflows */}
            {tree.map(row => (
              <CashFlowExpandableRow key={row.code} row={row} depth={0} />
            ))}

            {/* Closing Balance */}
            <tr className="border-b border-border bg-primary/10 font-bold">
              <td className="p-3 sticky left-0 bg-card text-sm text-foreground">Closing Balance</td>
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
        <h3 className="text-sm font-semibold mb-4">Annual Cash Flow Waterfall (R$ thousands)</h3>
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
            <Bar dataKey="Inflows" fill="hsl(166 72% 28%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Outflows" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Net Cash" fill="hsl(221 83% 53%)" radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Valores em R$ mil (000's) · {scenario} scenario · Projecoes estimadas
      </p>
    </div>
  );
}
