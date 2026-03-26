import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS, HEADCOUNT, Year } from '@/lib/financialData';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/formatters';
import { TrendingUp, Users, DollarSign, BarChart3, Percent } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend, ComposedChart,
} from 'recharts';
import RuleOf40Card, { RuleOf40Chart } from '@/components/overview/RuleOf40';
import { DataSourceBadge } from '@/components/period/DataSourceBadge';
import { HISTORICAL_PERIODS } from '@/data/historicalData';
import { getYearDataSource, resolveAnnualMetric, resolveMonthlyMetric } from '@/lib/periodResolution';

// ---------------------------------------------------------------------------
// Period-aware data helpers
// ---------------------------------------------------------------------------
function getKpiValue(metric: string, year: Year, engineVal: number): number {
  return resolveAnnualMetric(metric, year, engineVal);
}

/** Badge shown next to the year to indicate data type. */
function YearBadge({ year }: { year: Year }) {
  return <DataSourceBadge source={getYearDataSource(year)} className="ml-2" />;
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
  '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

function formatPeriodLabel(period: string): string {
  const [year, month] = period.split('-');
  return `${MONTH_LABELS[month]}/${year.slice(2)}`;
}

const DRE_LINES = [
  { key: 'Receita Bruta', color: 'hsl(160 84% 39%)' },
  { key: 'Lucro Bruto', color: 'hsl(217 91% 60%)' },
  { key: 'EBITDA', color: 'hsl(45 93% 58%)' },
  { key: 'Resultado Líquido', color: 'hsl(280 60% 65%)' },
];

const DreTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg" style={{ minWidth: 220 }}>
      <p className="text-sm font-bold text-foreground mb-2">{label}</p>
      {DRE_LINES.map(({ key, color }) => {
        const entry = payload.find((p: any) => p.dataKey === key);
        if (!entry) return null;
        return (
          <div key={key} className="flex items-center gap-2 py-0.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[13px] text-muted-foreground">{key}</span>
            <span className="ml-auto text-[13px] tabular-nums font-semibold text-foreground">
              R$ {Number(entry.value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </span>
          </div>
        );
      })}
    </div>
  );
};

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
  const { projections, assumptions, filteredYears, focalYear, model } = useFinancialModel();

  const activeYears = filteredYears.length > 0 ? filteredYears : YEARS;

  const kpiYear: Year = activeYears.includes(focalYear)
    ? focalYear
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

  const dreMonthlyData = activeYears.flatMap((year) => {
    const monthlyData = model.years[year].monthlyData;
    const grossRevenueSeries = resolveMonthlyMetric('RECEITA BRUTA', year, monthlyData.map((month) => month.grossRevenue));
    const grossProfitSeries = resolveMonthlyMetric('LUCRO BRUTO', year, monthlyData.map((month) => month.grossProfit));
    const ebitdaSeries = resolveMonthlyMetric('EBITDA', year, monthlyData.map((month) => month.ebitda));
    const netIncomeSeries = resolveMonthlyMetric('RESULTADO LÍQUIDO', year, monthlyData.map((month) => month.netIncome));

    return Array.from({ length: 12 }, (_, monthIndex) => {
      const period = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      return {
        label: formatPeriodLabel(period),
        'Receita Bruta': grossRevenueSeries[monthIndex],
        'Lucro Bruto': grossProfitSeries[monthIndex],
        EBITDA: ebitdaSeries[monthIndex],
        'Resultado Líquido': netIncomeSeries[monthIndex],
      };
    });
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
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-xl md:text-2xl font-bold text-primary">Overview — {kpiYear}</h2>
        <YearBadge year={kpiYear} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="kpi-card">
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
            </div>
            <p className="text-lg md:text-2xl font-bold tracking-tight animate-count">{value}</p>
          </div>
        ))}
        <RuleOf40Card />
      </div>

      {/* DRE Mensal — dados reais do Oxy */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold mb-4">DRE Mensal</h3>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={dreMonthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
            <XAxis dataKey="label" stroke="hsl(215 20% 55%)" fontSize={11} />
            <YAxis stroke="hsl(215 20% 55%)" fontSize={11} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<DreTooltip />} />
            <Line type="monotone" dataKey="Receita Bruta" stroke="hsl(160 84% 39%)" strokeWidth={2} dot={{ fill: 'hsl(160 84% 39%)', r: 3 }} />
            <Line type="monotone" dataKey="Lucro Bruto" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={{ fill: 'hsl(217 91% 60%)', r: 3 }} />
            <Line type="monotone" dataKey="EBITDA" stroke="hsl(45 93% 58%)" strokeWidth={2} dot={{ fill: 'hsl(45 93% 58%)', r: 3 }} />
            <Line type="monotone" dataKey="Resultado Líquido" stroke="hsl(280 60% 65%)" strokeWidth={2} dot={{ fill: 'hsl(280 60% 65%)', r: 3 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Destaques */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold mb-4">Destaques</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-secondary/40 rounded-lg p-3">
            <p className="text-muted-foreground">Ticket CaaS Assessoria</p>
            <p className="font-bold text-foreground text-base">R$ {assumptions.tickets.caasAssessoria.toLocaleString('pt-BR')}</p>
          </div>
          <div className="bg-secondary/40 rounded-lg p-3">
            <p className="text-muted-foreground">Ticket SaaS Oxy</p>
            <p className="font-bold text-foreground text-base">R$ {assumptions.tickets.saasOxy.toLocaleString('pt-BR')}</p>
          </div>
          <div className="bg-secondary/40 rounded-lg p-3">
            <p className="text-muted-foreground">Churn CaaS / SaaS</p>
            <p className="font-bold text-foreground text-base">{assumptions.churnCaas}% / {assumptions.churnSaas}%</p>
          </div>
          <div className="bg-secondary/40 rounded-lg p-3">
            <p className="text-muted-foreground">Headcount {kpiYear}</p>
            <p className="font-bold text-foreground text-base">{totalHeadcount[kpiYear]?.toLocaleString('pt-BR') ?? '—'}</p>
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
        Valores em R$ mil (000's) · período respeita automaticamente realizado, projetado e combinado
      </p>
    </div>
  );
}
