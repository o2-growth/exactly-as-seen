import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TAX_CATEGORIES,
  type TaxCategory,
  getSubcategoriesForCategory,
  getScenariosForSubcategory,
  findScenarioById,
} from '@/lib/taxScenarios';
import { calculateTaxForRevenue, type TaxResult } from '@/lib/taxCalc';
import { formatCurrency, formatPercent } from '@/lib/formatters';

interface ColumnState {
  category: TaxCategory;
  subcategory: string;
  scenarioId: string;
}

function initialColumn(category: TaxCategory): ColumnState {
  const sub = getSubcategoriesForCategory(category)[0] ?? '';
  const scen = getScenariosForSubcategory(category, sub)[0]?.id ?? '';
  return { category, subcategory: sub, scenarioId: scen };
}

export default function ComparadorTributario() {
  const [revenueStr, setRevenueStr] = useState<string>('10000000');
  const [columns, setColumns] = useState<ColumnState[]>(() => [
    initialColumn('CaaS'),
    initialColumn('SaaS'),
    initialColumn('Education'),
  ]);

  const revenue = Math.max(0, Number(revenueStr) || 0);

  const updateColumn = (idx: number, patch: Partial<ColumnState>) => {
    setColumns(prev => {
      const next = [...prev];
      const current = { ...next[idx], ...patch };
      // If category changed, reset sub + scenario
      if (patch.category && patch.category !== next[idx].category) {
        const fresh = initialColumn(patch.category);
        next[idx] = fresh;
        return next;
      }
      // If subcategory changed, reset scenario
      if (patch.subcategory && patch.subcategory !== next[idx].subcategory) {
        const firstScen =
          getScenariosForSubcategory(current.category, patch.subcategory)[0]?.id ?? '';
        current.scenarioId = firstScen;
      }
      next[idx] = current;
      return next;
    });
  };

  const results: Array<{ col: ColumnState; scenario: ReturnType<typeof findScenarioById>; result: TaxResult }> =
    useMemo(() => {
      return columns.map(col => {
        const scenario = findScenarioById(col.scenarioId);
        const result = calculateTaxForRevenue(revenue, scenario?.composition ?? []);
        return { col, scenario, result };
      });
    }, [columns, revenue]);

  const rates = results.map(r => r.result.effectiveRate);
  const bestRate = Math.min(...rates);
  const worstRate = Math.max(...rates);
  const bestIdx = rates.indexOf(bestRate);
  const worstIdx = rates.indexOf(worstRate);

  const savingsVsWorst =
    results[worstIdx].result.totalTax - results[bestIdx].result.totalTax;

  return (
    <div className="space-y-6">
      {/* Shared revenue */}
      <Card className="p-5">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Receita Anual (aplicada aos 3 cenários)</Label>
            <Input
              type="number"
              value={revenueStr}
              onChange={(e) => setRevenueStr(e.target.value)}
              className="text-lg h-12 font-semibold mt-1 max-w-md"
              min={0}
            />
          </div>
        </div>
      </Card>

      {/* 3 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {results.map(({ col, scenario, result }, idx) => {
          const isBest = idx === bestIdx && bestRate !== worstRate;
          return (
            <Card
              key={idx}
              className={`p-5 space-y-4 ${
                isBest ? 'border-emerald-500/50 bg-emerald-500/5' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Cenário {idx + 1}</h3>
                {isBest && (
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]">
                    MELHOR CENÁRIO
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">Categoria</Label>
                <Select
                  value={col.category}
                  onValueChange={(v) => updateColumn(idx, { category: v as TaxCategory })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">Subcategoria</Label>
                <Select
                  value={col.subcategory}
                  onValueChange={(v) => updateColumn(idx, { subcategory: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getSubcategoriesForCategory(col.category).map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[11px] text-muted-foreground">Cenário</Label>
                <Select
                  value={col.scenarioId}
                  onValueChange={(v) => updateColumn(idx, { scenarioId: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getScenariosForSubcategory(col.category, col.subcategory).map(sc => (
                      <SelectItem key={sc.id} value={sc.id}>{sc.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Composição</Label>
                <Badge variant="secondary" className="text-[11px]">
                  {scenario?.compositionString ?? '—'}
                </Badge>
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Imposto Total</span>
                  <span className="tabular-nums font-semibold text-foreground">
                    {formatCurrency(result.totalTax)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-muted-foreground">Alíquota Efetiva</span>
                  <span className={`text-2xl font-bold tabular-nums ${isBest ? 'text-emerald-600' : 'text-primary'}`}>
                    {formatPercent(result.effectiveRate * 100)}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Comparison table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Métrica</th>
                {results.map((_, idx) => (
                  <th key={idx} className="text-right px-3 py-2 text-xs text-muted-foreground font-medium">
                    Cenário {idx + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <ComparisonRow label="Receita Bruta" values={results.map(r => formatCurrency(r.result.grossRevenue))} />
              <ComparisonRow label="IRPJ + Adicional" values={results.map(r => formatCurrency(r.result.irpj + r.result.adicionalIrpj))} />
              <ComparisonRow label="CSLL" values={results.map(r => formatCurrency(r.result.csll))} />
              <ComparisonRow label="PIS" values={results.map(r => formatCurrency(r.result.pis))} />
              <ComparisonRow label="COFINS" values={results.map(r => formatCurrency(r.result.cofins))} />
              <ComparisonRow label="ISS" values={results.map(r => formatCurrency(r.result.iss))} />
              <ComparisonRow label="ICMS" values={results.map(r => formatCurrency(r.result.icms))} />
              <ComparisonRow label="Total Impostos" values={results.map(r => formatCurrency(r.result.totalTax))} bold />
              <ComparisonRow label="Receita Líquida" values={results.map(r => formatCurrency(r.result.netRevenue))} />
              <ComparisonRow
                label="Alíquota Efetiva"
                values={results.map(r => formatPercent(r.result.effectiveRate * 100))}
                bold
              />
            </tbody>
          </table>
        </div>
      </Card>

      {/* Savings vs worst */}
      {bestRate !== worstRate && (
        <Card className="p-5 border-emerald-500/30 bg-emerald-500/5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Economia do Melhor vs Pior Cenário
              </p>
              <p className="text-2xl md:text-3xl font-bold text-emerald-600 tabular-nums mt-1">
                {formatCurrency(savingsVsWorst)}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Diferença de alíquota:{' '}
              <span className="font-semibold text-foreground">
                {formatPercent((worstRate - bestRate) * 100)}
              </span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function ComparisonRow({
  label,
  values,
  bold,
}: {
  label: string;
  values: string[];
  bold?: boolean;
}) {
  return (
    <tr className={`border-t border-border ${bold ? 'font-semibold bg-muted/20' : ''}`}>
      <td className="px-3 py-2 text-foreground">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="px-3 py-2 text-right tabular-nums text-foreground">
          {v}
        </td>
      ))}
    </tr>
  );
}
