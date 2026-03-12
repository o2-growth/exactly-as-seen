import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS, HEADCOUNT, Year } from '@/lib/financialData';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/formatters';
import { TrendingUp, Users, DollarSign, BarChart3, Percent } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend, ComposedChart,
} from 'recharts';
import RuleOf40Card, { RuleOf40Chart } from '@/components/overview/RuleOf40';
import { historicalMetrics } from '@/data/historicalData';

// ---------------------------------------------------------------------------
// Historical helpers
// ---------------------------------------------------------------------------

/** Sum a metric across all 12 months of a given year, returning R$ thousands. */
function getHistoricalAnnualMetric(metricName: string, year: number): number {
  const data = historicalMetrics[metricName];
  if (!data) return 0;
  let sum = 0;
  for (let m = 1; m <= 12; m++) {
    const period = `${year}-${String(m).padStart(2, '0')}`;
    sum += data[period] ?? 0;
  }
  return sum / 1000; // R$ → R$ thousands
}

/**
 * For 2026: real Jan–Mar + engine value scaled to remaining 9 months.
 * `engineVal` is already in R$ thousands (full-year projection).
 */
function getBlended2026Metric(metricName: string, engineVal: number): number {
  const data = historicalMetrics[metricName];
  if (!data) return engineVal;
  let realSum = 0;
  for (let m = 1; m <= 3; m++) {
    realSum += data[`2026-${String(m).padStart(2, '0')}`] ?? 0;
  }
  return (realSum / 1000) + engineVal * (9 / 12);
}

/**
 * Returns the best available value for a KPI metric for the given year.
 * - 2025 → full-year actuals from Oxy DB
 * - 2026 → 3 months real + 9 months engine
 * - 2027+ → pure engine
 */
function getKpiValue(metric: string, year: Year, engineVal: number): number {
  if (year === 2025) return getHistoricalAnnualMetric(metric, 2025);
  if (year === 2026) return getBlended2026Metric(metric, engineVal);
  return engineVal;
}

/** Badge shown next to the year to indicate data type. */
function YearBadge({ year }: { year: Year }) {
  if (year === 2025) {
    return (
      <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        Realizado
      </span>
    );
  }
  if (year === 2026) {
    return (
      <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
        Parcial
      </span>
    );
  }
  return (
    <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
      Projeção
    </span>
  );
}

const CustomRevenueTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg" style={{ minWidth: 180 }}>
      <p className="text-sm font-bold text-foreground mb-2">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[13px] font-semibold text-foreground">{entry.name}</span>
          <span className="ml-auto text-[13px] tabular-nums text-muted-foreground">
            R$ {Number(entry.value).toLocaleString('pt-BR')}k
          </span>
        </div>
      ))}
    </div>
  );
};

export default function Overview() {
  const { projections, selectedYear, assumptions, filteredYears } = useFinancialModel();

  // Use filteredYears for chart ranges; fall back to YEARS if undefined/empty
  const activeYears = filteredYears.length > 0 ? filteredYears : YEARS;

  // KPI year: use selectedYear if it's within the active range, otherwise use last year in range
  const kpiYear: Year = activeYears.includes(selectedYear)
    ? selectedYear
    : activeYears[activeYears.length - 1];

  // ---------------------------------------------------------------------------
  // Override projections with historical data for 2025 / partial 2026
  // ---------------------------------------------------------------------------
  const grossRevenue = getKpiValue('RECEITA BRUTA', kpiYear, projections.grossRevenue[kpiYear]);
  const netRevenue   = getKpiValue('RECEITA LÍQUIDA', kpiYear, projections.netRevenue[kpiYear]);
  const ebitda       = getKpiValue('EBITDA', kpiYear, projections.ebitda[kpiYear]);
  const grossProfit  = getKpiValue('LUCRO BRUTO', kpiYear, projections.grossProfit[kpiYear]);
  const netIncome    = getKpiValue('RESULTADO FINAL', kpiYear, projections.netIncome[kpiYear]);

  // Compute margins from overridden values to keep them consistent
  const grossMarginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
  const ebitdaMarginPct = grossRevenue > 0 ? (ebitda / grossRevenue) * 100 : 0;
  const netMarginPct   = netRevenue > 0 ? (netIncome / netRevenue) * 100 : 0;

  const kpis = [
    { label: 'Total Clients', value: formatNumber(projections.totalClients[kpiYear]), icon: Users, color: 'text-primary' },
    { label: 'Gross Revenue', value: formatCurrency(grossRevenue * 1000), icon: DollarSign, color: 'text-positive' },
    { label: 'EBITDA', value: formatCurrency(ebitda * 1000), icon: BarChart3, color: 'text-warning' },
    { label: 'Gross Margin', value: formatPercent(grossMarginPct), icon: TrendingUp, color: 'text-primary' },
    { label: 'Net Margin', value: formatPercent(netMarginPct), icon: Percent, color: netMarginPct >= 0 ? 'text-positive' : 'text-negative' },
  ];

  // ---------------------------------------------------------------------------
  // Chart data — use overridden values per year
  // ---------------------------------------------------------------------------

  const revenueChartData = activeYears.map(y => ({
    year: y.toString(),
    'Gross Revenue': getKpiValue('RECEITA BRUTA', y, projections.grossRevenue[y]),
    'Net Revenue':   getKpiValue('RECEITA LÍQUIDA', y, projections.netRevenue[y]),
  }));

  // YoY Revenue Growth (based on overridden gross revenue)
  const yoyGrowth = activeYears.slice(1).map((y, i) => {
    const prev = getKpiValue('RECEITA BRUTA', activeYears[i], projections.grossRevenue[activeYears[i]]);
    const curr = getKpiValue('RECEITA BRUTA', y, projections.grossRevenue[y]);
    return { period: `${activeYears[i]}→${y}`, growth: prev > 0 ? Number((((curr - prev) / prev) * 100).toFixed(1)) : 0 };
  });

  // Total headcount per year
  const totalHeadcount = YEARS.reduce((acc, y) => {
    acc[y] = HEADCOUNT.reduce((sum, h) => sum + (h as any)[y], 0);
    return acc;
  }, {} as Record<number, number>);

  // Client chart with actual BU data from assumptions + YoY growth
  const clientChartData = activeYears.map((y, i) => {
    const baasClients = assumptions.subProductClients.baas[y];
    const total = assumptions.caasClients[y] + assumptions.saasClients[y] + assumptions.educationClients[y] + baasClients;
    const prevBaas = i > 0 ? assumptions.subProductClients.baas[activeYears[i-1]] : 0;
    const prevTotal = i > 0 ? assumptions.caasClients[activeYears[i-1]] + assumptions.saasClients[activeYears[i-1]] + assumptions.educationClients[activeYears[i-1]] + prevBaas : 0;
    const growthPct = i > 0 && prevTotal > 0 ? Number((((total - prevTotal) / prevTotal) * 100).toFixed(0)) : 0;
    return {
      year: y.toString(),
      CaaS: assumptions.caasClients[y],
      SaaS: assumptions.saasClients[y],
      Education: assumptions.educationClients[y],
      BaaS: baasClients,
      'Growth %': growthPct,
    };
  });

  const marginChartData = activeYears.map(y => {
    const yr_grossRevenue = getKpiValue('RECEITA BRUTA', y, projections.grossRevenue[y]);
    const yr_netRevenue   = getKpiValue('RECEITA LÍQUIDA', y, projections.netRevenue[y]);
    const yr_grossProfit  = getKpiValue('LUCRO BRUTO', y, projections.grossProfit[y]);
    const yr_ebitda       = getKpiValue('EBITDA', y, projections.ebitda[y]);
    const yr_netIncome    = getKpiValue('RESULTADO FINAL', y, projections.netIncome[y]);

    const yr_grossMarginPct = yr_netRevenue > 0 ? Number(((yr_grossProfit / yr_netRevenue) * 100).toFixed(1)) : 0;
    const yr_ebitdaMarginPct = yr_grossRevenue > 0 ? Number(((yr_ebitda / yr_grossRevenue) * 100).toFixed(1)) : 0;
    const yr_netMarginPct   = yr_netRevenue > 0 ? Number(((yr_netIncome / yr_netRevenue) * 100).toFixed(1)) : 0;

    // Cash Gen % uses engine value for 2027+; for 2025/2026 use net income as proxy
    const cashFlow = (y === 2025 || y === 2026)
      ? yr_netIncome
      : projections.operatingCashFlow[y];
    const yr_cashGenPct = yr_netRevenue > 0 ? Number(((cashFlow / yr_netRevenue) * 100).toFixed(1)) : 0;

    return {
      year: y.toString(),
      'Gross Margin':  yr_grossMarginPct,
      'EBITDA %':      yr_ebitdaMarginPct,
      'Net Margin':    yr_netMarginPct,
      'Cash Gen %':    yr_cashGenPct,
    };
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center">
        Overview — {kpiYear}
        <YearBadge year={kpiYear} />
      </h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="kpi-card">
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
            </div>
            <p className="text-2xl font-bold tracking-tight animate-count">{value}</p>
          </div>
        ))}
        <RuleOf40Card />
      </div>

      {/* Assumptions Summary */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold mb-4">Resumo de Premissas</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {/* YoY Revenue Growth */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Crescimento YoY de Receita</p>
            <div className="space-y-1.5">
              {yoyGrowth.map(({ period, growth }) => (
                <div key={period} className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-24 shrink-0">{period}</span>
                  <div className="flex-1 h-4 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full transition-all"
                      style={{ width: `${Math.min(Math.max(growth / 5, 2), 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums w-14 text-right">{growth}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Key Highlights */}
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Destaques</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-secondary/40 rounded-lg p-2.5">
                <p className="text-muted-foreground">Ticket CaaS Assessoria</p>
                <p className="font-bold text-foreground">R$ {assumptions.tickets.caasAssessoria.toLocaleString('pt-BR')}</p>
              </div>
              <div className="bg-secondary/40 rounded-lg p-2.5">
                <p className="text-muted-foreground">Ticket SaaS Oxy</p>
                <p className="font-bold text-foreground">R$ {assumptions.tickets.saasOxy.toLocaleString('pt-BR')}</p>
              </div>
              <div className="bg-secondary/40 rounded-lg p-2.5">
                <p className="text-muted-foreground">Churn CaaS / SaaS</p>
                <p className="font-bold text-foreground">{assumptions.churnCaas}% / {assumptions.churnSaas}%</p>
              </div>
              <div className="bg-secondary/40 rounded-lg p-2.5">
                <p className="text-muted-foreground">Headcount {kpiYear}</p>
                <p className="font-bold text-foreground">{totalHeadcount[kpiYear]?.toLocaleString('pt-BR') ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue Growth */}
        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold mb-4">Revenue Growth (R$ thousands)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
              <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={11} />
              <YAxis stroke="hsl(215 20% 55%)" fontSize={11} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}M`} />
              <Tooltip content={<CustomRevenueTooltip />} />
              <Bar dataKey="Gross Revenue" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Net Revenue" fill="hsl(217 91% 60% / 0.5)" radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'hsl(215 20% 55%)' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Client Growth with secondary Y-axis */}
        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold mb-4">Client Growth</h3>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={clientChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
              <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={11} />
              <YAxis yAxisId="left" stroke="hsl(215 20% 55%)" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(38 92% 50%)" fontSize={11} unit="%" />
              <Tooltip
                contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'hsl(210 40% 98%)' }}
              />
              <Area yAxisId="left" type="monotone" dataKey="SaaS" stackId="1" fill="hsl(258 90% 66%)" stroke="hsl(258 90% 66%)" fillOpacity={0.6} />
              <Area yAxisId="left" type="monotone" dataKey="Education" stackId="1" fill="hsl(38 92% 50%)" stroke="hsl(38 92% 50%)" fillOpacity={0.6} />
              <Area yAxisId="left" type="monotone" dataKey="CaaS" stackId="1" fill="hsl(217 91% 60%)" stroke="hsl(217 91% 60%)" fillOpacity={0.6} />
              <Area yAxisId="left" type="monotone" dataKey="BaaS" stackId="1" fill="hsl(340 82% 52%)" stroke="hsl(340 82% 52%)" fillOpacity={0.6} />
              <Line yAxisId="right" type="monotone" dataKey="Growth %" stroke="hsl(280 60% 65%)" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: 'hsl(280 60% 65%)', r: 3 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="gradient-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4">Margin Evolution</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={marginChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
              <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={11} />
              <YAxis stroke="hsl(215 20% 55%)" fontSize={11} unit="%" />
              <Tooltip
                contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 13 }}
                labelStyle={{ color: 'hsl(210 40% 98%)', fontWeight: 700 }}
                formatter={(v: number, name: string) => [`${v}%`, name]}
              />
              <Line type="monotone" dataKey="Gross Margin" stroke="hsl(160 84% 39%)" strokeWidth={2} dot={{ fill: 'hsl(160 84% 39%)', r: 4 }} />
              <Line type="monotone" dataKey="EBITDA %" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={{ fill: 'hsl(217 91% 60%)', r: 4 }} />
              <Line type="monotone" dataKey="Net Margin" stroke="hsl(0 72% 51%)" strokeWidth={2} dot={{ fill: 'hsl(0 72% 51%)', r: 4 }} />
              <Line type="monotone" dataKey="Cash Gen %" stroke="hsl(45 93% 58%)" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: 'hsl(45 93% 58%)', r: 4 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Rule of 40 Chart */}
        <div className="lg:col-span-2">
          <RuleOf40Chart />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-4">
        Valores em R$ mil (000's) · 2025: dados realizados Oxy DB · 2026: Jan–Mar real + Abr–Dez estimado · Modelo v7
      </p>
    </div>
  );
}
