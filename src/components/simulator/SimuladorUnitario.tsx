import { useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TAX_CATEGORIES,
  type TaxCategory,
  getSubcategoriesForCategory,
  getScenariosForSubcategory,
  findScenarioById,
} from '@/lib/taxScenarios';
import { calculateTaxForRevenue } from '@/lib/taxCalc';
import { formatCurrency, formatPercent } from '@/lib/formatters';

const DEFAULT_CATEGORY: TaxCategory = 'CaaS';

export default function SimuladorUnitario() {
  const [category, setCategory] = useState<TaxCategory>(DEFAULT_CATEGORY);
  const [subcategory, setSubcategory] = useState<string>(
    () => getSubcategoriesForCategory(DEFAULT_CATEGORY)[0] ?? '',
  );
  const [scenarioId, setScenarioId] = useState<string>(
    () => getScenariosForSubcategory(DEFAULT_CATEGORY, getSubcategoriesForCategory(DEFAULT_CATEGORY)[0] ?? '')[0]?.id ?? '',
  );
  const [revenueStr, setRevenueStr] = useState<string>('10000000');

  const subcategories = useMemo(
    () => getSubcategoriesForCategory(category),
    [category],
  );
  const scenarios = useMemo(
    () => getScenariosForSubcategory(category, subcategory),
    [category, subcategory],
  );
  const scenario = useMemo(
    () => findScenarioById(scenarioId) ?? scenarios[0],
    [scenarioId, scenarios],
  );

  const revenue = Math.max(0, Number(revenueStr) || 0);

  const result = useMemo(
    () => calculateTaxForRevenue(revenue, scenario?.composition ?? []),
    [revenue, scenario],
  );

  const handleCategoryChange = (next: string) => {
    const nextCat = next as TaxCategory;
    setCategory(nextCat);
    const nextSubs = getSubcategoriesForCategory(nextCat);
    const nextSub = nextSubs[0] ?? '';
    setSubcategory(nextSub);
    const nextScenarios = getScenariosForSubcategory(nextCat, nextSub);
    setScenarioId(nextScenarios[0]?.id ?? '');
  };

  const handleSubcategoryChange = (next: string) => {
    setSubcategory(next);
    const nextScenarios = getScenariosForSubcategory(category, next);
    setScenarioId(nextScenarios[0]?.id ?? '');
  };

  const effectiveRatePct = result.effectiveRate * 100;

  const breakdownRows: Array<{ label: string; value: number }> = [
    { label: 'IRPJ', value: result.irpj },
    { label: 'AD. IRPJ', value: result.adicionalIrpj },
    { label: 'CSLL', value: result.csll },
    { label: 'PIS', value: result.pis },
    { label: 'COFINS', value: result.cofins },
    { label: 'ISS', value: result.iss },
    { label: 'ICMS', value: result.icms },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Configuração */}
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Configuração
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Escolha categoria, subcategoria, cenário e informe a receita anual.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Categoria</Label>
          <Select value={category} onValueChange={handleCategoryChange}>
            <SelectTrigger>
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
          <Label className="text-xs text-muted-foreground">Subcategoria</Label>
          <Select value={subcategory} onValueChange={handleSubcategoryChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {subcategories.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Cenário</Label>
          <Select value={scenarioId} onValueChange={setScenarioId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scenarios.map(sc => (
                <SelectItem key={sc.id} value={sc.id}>{sc.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Composição</Label>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">
              {scenario?.compositionString ?? '—'}
            </Badge>
            {scenario && scenario.composition.length > 1 && (
              <div className="flex gap-1 flex-wrap">
                {scenario.composition.map((slice, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {slice.profileKey} {Math.round(slice.pct * 100)}%
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Receita Anual (R$)</Label>
          <Input
            type="number"
            value={revenueStr}
            onChange={(e) => setRevenueStr(e.target.value)}
            className="text-lg h-12 font-semibold"
            min={0}
          />
        </div>
      </Card>

      {/* Resultado */}
      <Card className="p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Resultado
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Cálculo de Lucro Presumido aplicado à receita informada.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-5 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Alíquota Efetiva
          </p>
          <p className="text-4xl md:text-5xl font-bold text-primary mt-1 tabular-nums">
            {formatPercent(effectiveRatePct)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <KpiMini label="Receita Bruta" value={result.grossRevenue} />
          <KpiMini label="Total de Impostos" value={result.totalTax} tone="negative" />
          <KpiMini label="Receita Líquida" value={result.netRevenue} tone="positive" />
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Breakdown
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Tributo</th>
                  <th className="text-right px-3 py-2 text-xs text-muted-foreground font-medium">Valor</th>
                  <th className="text-right px-3 py-2 text-xs text-muted-foreground font-medium">% Receita</th>
                </tr>
              </thead>
              <tbody>
                {breakdownRows.map(row => {
                  const pct = revenue > 0 ? (row.value / revenue) * 100 : 0;
                  return (
                    <tr key={row.label} className="border-t border-border">
                      <td className="px-3 py-2 text-foreground">{row.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-foreground">
                        {formatCurrency(row.value)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatPercent(pct)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-border bg-muted/30 font-semibold">
                  <td className="px-3 py-2 text-foreground">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">
                    {formatCurrency(result.totalTax)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">
                    {formatPercent(effectiveRatePct)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}

function KpiMini({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-600'
      : tone === 'negative'
      ? 'text-red-600'
      : 'text-foreground';
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`text-sm md:text-base font-semibold tabular-nums mt-1 ${toneClass}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}
