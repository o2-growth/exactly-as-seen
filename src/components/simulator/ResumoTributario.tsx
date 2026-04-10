import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import {
  getAllSubcategories,
  findScenarioById,
  getScenariosForSubcategory,
  type TaxCategory,
} from '@/lib/taxScenarios';
import {
  calculateTaxForRevenue,
  calculateBaselineEffectiveRate,
  sumTaxResults,
  type TaxResult,
} from '@/lib/taxCalc';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import type { PlanejamentoRows } from '@/pages/SimuladorTributario';
import { buildRowKey } from '@/pages/SimuladorTributario';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface Props {
  rows: PlanejamentoRows;
}

const PIE_COLORS = [
  'hsl(217 91% 60%)', // blue - IRPJ
  'hsl(280 60% 65%)', // purple - Adicional
  'hsl(160 84% 39%)', // emerald - CSLL
  'hsl(45 93% 58%)',  // amber - PIS
  'hsl(25 95% 55%)',  // orange - COFINS
  'hsl(340 82% 60%)', // pink - ISS
  'hsl(195 80% 55%)', // cyan - ICMS
];

export default function ResumoTributario({ rows }: Props) {
  const subcategories = useMemo(() => getAllSubcategories(), []);

  // Compute per-row results
  const rowResults = useMemo(() => {
    return subcategories.map(sub => {
      const rowKey = buildRowKey(sub.category, sub.subcategory);
      const row = rows[rowKey] ?? { revenue: 0, scenarioId: '' };
      const scenario =
        findScenarioById(row.scenarioId) ??
        getScenariosForSubcategory(sub.category, sub.subcategory)[0];
      const result = calculateTaxForRevenue(
        row.revenue,
        scenario?.composition ?? [],
      );
      return { category: sub.category, result };
    });
  }, [rows, subcategories]);

  const grandTotal = useMemo(
    () => sumTaxResults(rowResults.map(r => r.result)),
    [rowResults],
  );

  const baselineRate = useMemo(() => calculateBaselineEffectiveRate(), []);
  const plannedRate = grandTotal.effectiveRate;
  const baselineTax = grandTotal.grossRevenue * baselineRate;
  const savings = baselineTax - grandTotal.totalTax;
  const savingsPct = baselineTax > 0 ? (savings / baselineTax) * 100 : 0;

  // Subtotals by category
  const byCategory = useMemo(() => {
    const map = new Map<TaxCategory, TaxResult[]>();
    for (const r of rowResults) {
      if (!map.has(r.category)) map.set(r.category, []);
      map.get(r.category)!.push(r.result);
    }
    const entries: Array<{ category: TaxCategory; total: TaxResult }> = [];
    for (const [cat, results] of map) {
      entries.push({ category: cat, total: sumTaxResults(results) });
    }
    return entries;
  }, [rowResults]);

  // Pie data
  const pieData = [
    { name: 'IRPJ', value: grandTotal.irpj },
    { name: 'Adicional IRPJ', value: grandTotal.adicionalIrpj },
    { name: 'CSLL', value: grandTotal.csll },
    { name: 'PIS', value: grandTotal.pis },
    { name: 'COFINS', value: grandTotal.cofins },
    { name: 'ISS', value: grandTotal.iss },
    { name: 'ICMS', value: grandTotal.icms },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <BigKpi
          label="Receita Total Anual"
          value={formatCurrency(grandTotal.grossRevenue)}
        />
        <BigKpi
          label="Imposto Total Anual"
          value={formatCurrency(grandTotal.totalTax)}
          tone="negative"
        />
        <BigKpi
          label="Receita Líquida Anual"
          value={formatCurrency(grandTotal.netRevenue)}
          tone="positive"
        />
        <BigKpi
          label="Alíquota Efetiva Média"
          value={formatPercent(plannedRate * 100)}
        />
      </div>

      {/* Baseline comparison */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          Comparação vs Baseline
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground">
              Se tudo fosse P1 (CaaS)
            </p>
            <p className="text-2xl font-bold text-foreground tabular-nums mt-1">
              {formatPercent(baselineRate * 100)}
            </p>
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              {formatCurrency(baselineTax)}
            </p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground">Cenário Planejado</p>
            <p className="text-2xl font-bold text-primary tabular-nums mt-1">
              {formatPercent(plannedRate * 100)}
            </p>
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              {formatCurrency(grandTotal.totalTax)}
            </p>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <p className="text-xs text-muted-foreground">Economia Anual</p>
            <p className={`text-2xl font-bold tabular-nums mt-1 ${savings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {formatCurrency(savings)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPercent(savingsPct)} sobre baseline
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subtotals by category */}
        <Card className="p-4 lg:col-span-2 overflow-hidden">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-2">
            Subtotais por BU
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">BU</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Receita</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Imposto</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Alíquota</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map(({ category, total }) => (
                  <tr key={category} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground font-medium">{category}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {formatCurrency(total.grossRevenue)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground">
                      {formatCurrency(total.totalTax)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {formatPercent(total.effectiveRate * 100)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-primary/10 border-t-2 border-primary/30 font-semibold">
                  <td className="px-3 py-2 text-foreground uppercase text-xs">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(grandTotal.grossRevenue)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCurrency(grandTotal.totalTax)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatPercent(plannedRate * 100)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pie chart */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Composição dos Impostos
          </h3>
          {pieData.length > 0 ? (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(v: number) => formatCurrency(v)}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-16">
              Sem dados para exibir
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

function BigKpi({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-600'
      : tone === 'negative'
      ? 'text-red-600'
      : 'text-foreground';
  return (
    <Card className="p-5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xl md:text-2xl font-bold tabular-nums mt-2 ${toneClass}`}>{value}</p>
    </Card>
  );
}
