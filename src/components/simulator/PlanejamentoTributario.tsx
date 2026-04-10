import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  getAllSubcategories,
  getScenariosForSubcategory,
  findScenarioById,
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

interface Props {
  rows: PlanejamentoRows;
  setRows: React.Dispatch<React.SetStateAction<PlanejamentoRows>>;
}

interface ComputedRow {
  category: TaxCategory;
  subcategory: string;
  rowKey: string;
  revenue: number;
  scenarioId: string;
  scenarioLabel: string;
  compositionString: string;
  result: TaxResult;
}

export default function PlanejamentoTributario({ rows, setRows }: Props) {
  const subcategories = useMemo(() => getAllSubcategories(), []);

  const computedRows: ComputedRow[] = useMemo(() => {
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
      return {
        category: sub.category,
        subcategory: sub.subcategory,
        rowKey,
        revenue: row.revenue,
        scenarioId: scenario?.id ?? '',
        scenarioLabel: scenario?.label ?? '—',
        compositionString: scenario?.compositionString ?? '—',
        result,
      };
    });
  }, [rows, subcategories]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<TaxCategory, ComputedRow[]>();
    for (const row of computedRows) {
      if (!map.has(row.category)) map.set(row.category, []);
      map.get(row.category)!.push(row);
    }
    return map;
  }, [computedRows]);

  const grandTotal = useMemo(
    () => sumTaxResults(computedRows.map(r => r.result)),
    [computedRows],
  );

  const baselineRate = useMemo(() => calculateBaselineEffectiveRate(), []);
  const baselineTax = grandTotal.grossRevenue * baselineRate;
  const savings = baselineTax - grandTotal.totalTax;
  const savingsPct =
    baselineTax > 0 ? (savings / baselineTax) * 100 : 0;

  const updateRevenue = (rowKey: string, value: number) => {
    setRows(prev => ({
      ...prev,
      [rowKey]: { ...prev[rowKey], revenue: Math.max(0, value || 0) },
    }));
  };

  const updateScenario = (rowKey: string, scenarioId: string) => {
    setRows(prev => ({
      ...prev,
      [rowKey]: { ...prev[rowKey], scenarioId },
    }));
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Receita Total" value={formatCurrency(grandTotal.grossRevenue)} />
        <KpiCard
          label="Imposto Total"
          value={formatCurrency(grandTotal.totalTax)}
          tone="negative"
        />
        <KpiCard
          label="Alíquota Média"
          value={formatPercent(grandTotal.effectiveRate * 100)}
        />
        <KpiCard
          label={`Economia vs Baseline (${formatPercent(baselineRate * 100)})`}
          value={formatCurrency(savings)}
          subline={`${formatPercent(savingsPct)} sobre baseline`}
          tone={savings >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {/* Placeholder toolbar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Modo de Receita</Label>
            <p className="text-sm font-medium text-foreground mt-1">
              Receita Própria (por BU)
            </p>
          </div>
          <div className="ml-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" disabled>
                  Importar do modelo
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Integração com FinancialModelContext na próxima versão
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Subcategoria</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Receita (R$)</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Cenário</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Composição</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Imposto</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Alíquota</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(grouped.entries()).map(([category, groupRows]) => {
                const subtotal = sumTaxResults(groupRows.map(r => r.result));
                return (
                  <GroupRows
                    key={category}
                    category={category}
                    rows={groupRows}
                    subtotal={subtotal}
                    onRevenueChange={updateRevenue}
                    onScenarioChange={updateScenario}
                  />
                );
              })}
              <tr className="bg-primary/10 border-t-2 border-primary/30 font-semibold">
                <td className="px-3 py-3 text-foreground uppercase text-xs">Total Geral</td>
                <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(grandTotal.grossRevenue)}</td>
                <td className="px-3 py-3" colSpan={2}></td>
                <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(grandTotal.totalTax)}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatPercent(grandTotal.effectiveRate * 100)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function GroupRows({
  category,
  rows,
  subtotal,
  onRevenueChange,
  onScenarioChange,
}: {
  category: TaxCategory;
  rows: ComputedRow[];
  subtotal: TaxResult;
  onRevenueChange: (rowKey: string, value: number) => void;
  onScenarioChange: (rowKey: string, scenarioId: string) => void;
}) {
  return (
    <>
      <tr className="bg-muted/30 border-t border-border">
        <td colSpan={6} className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground">
          {category}
        </td>
      </tr>
      {rows.map(row => {
        const scenarios = getScenariosForSubcategory(row.category, row.subcategory);
        return (
          <tr key={row.rowKey} className="border-t border-border hover:bg-muted/10">
            <td className="px-3 py-2 text-foreground">{row.subcategory}</td>
            <td className="px-3 py-2 text-right">
              <Input
                type="number"
                value={row.revenue}
                min={0}
                onChange={(e) => onRevenueChange(row.rowKey, Number(e.target.value))}
                className="h-8 text-right tabular-nums w-36 ml-auto"
              />
            </td>
            <td className="px-3 py-2 min-w-[200px]">
              <Select
                value={row.scenarioId}
                onValueChange={(v) => onScenarioChange(row.rowKey, v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map(sc => (
                    <SelectItem key={sc.id} value={sc.id}>{sc.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </td>
            <td className="px-3 py-2">
              <Badge variant="outline" className="text-[10px]">
                {row.compositionString}
              </Badge>
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-foreground">
              {formatCurrency(row.result.totalTax)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
              {formatPercent(row.result.effectiveRate * 100)}
            </td>
          </tr>
        );
      })}
      <tr className="bg-muted/20 border-t border-border text-xs">
        <td className="px-3 py-2 italic text-muted-foreground">Subtotal {category}</td>
        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(subtotal.grossRevenue)}</td>
        <td className="px-3 py-2" colSpan={2}></td>
        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(subtotal.totalTax)}</td>
        <td className="px-3 py-2 text-right tabular-nums">
          {formatPercent(subtotal.effectiveRate * 100)}
        </td>
      </tr>
    </>
  );
}

function KpiCard({
  label,
  value,
  subline,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  subline?: string;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-600'
      : tone === 'negative'
      ? 'text-red-600'
      : 'text-foreground';
  return (
    <Card className="p-4">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-xl md:text-2xl font-bold tabular-nums mt-1 ${toneClass}`}>{value}</p>
      {subline && <p className="text-[11px] text-muted-foreground mt-1">{subline}</p>}
    </Card>
  );
}
