import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS, HEADCOUNT } from '@/lib/financialData';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/formatters';
import { TrendingUp, Users, DollarSign, BarChart3, Percent } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend, ComposedChart,
} from 'recharts';
import RuleOf40Card, { RuleOf40Chart } from '@/components/overview/RuleOf40';

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
  const { projections, selectedYear, assumptions } = useFinancialModel();

  const kpis = [
    { label: 'Total Clients', value: formatNumber(projections.totalClients[selectedYear]), icon: Users, color: 'text-primary' },
    { label: 'Gross Revenue', value: formatCurrency(projections.grossRevenue[selectedYear] * 1000), icon: DollarSign, color: 'text-positive' },
    { label: 'EBITDA', value: formatCurrency(projections.ebitda[selectedYear] * 1000), icon: BarChart3, color: 'text-warning' },
    { label: 'Gross Margin', value: formatPercent(projections.grossMargins[selectedYear]), icon: TrendingUp, color: 'text-primary' },
    { label: 'Net Margin', value: formatPercent(projections.netMargins[selectedYear]), icon: Percent, color: projections.netMargins[selectedYear] >= 0 ? 'text-positive' : 'text-negative' },
  ];

  // YoY Revenue Growth
  const yoyGrowth = YEARS.slice(1).map((y, i) => {
    const prev = projections.grossRevenue[YEARS[i]];
    const curr = projections.grossRevenue[y];
    return { period: `${YEARS[i]}→${y}`, growth: prev > 0 ? Number((((curr - prev) / prev) * 100).toFixed(1)) : 0 };
  });

  // Total headcount per year
  const totalHeadcount = YEARS.reduce((acc, y) => {
    acc[y] = HEADCOUNT.reduce((sum, h) => sum + (h as any)[y], 0);
    return acc;
  }, {} as Record<number, number>);

  const revenueChartData = YEARS.map(y => ({
    year: y.toString(),
    'Gross Revenue': projections.grossRevenue[y],
    'Net Revenue': projections.netRevenue[y],
  }));

  // Client chart with actual BU data from assumptions + YoY growth
  const clientChartData = YEARS.map((y, i) => {
    const total = assumptions.caasClients[y] + assumptions.saasClients[y] + assumptions.educationClients[y];
    const prevTotal = i > 0 ? assumptions.caasClients[YEARS[i-1]] + assumptions.saasClients[YEARS[i-1]] + assumptions.educationClients[YEARS[i-1]] : 0;
    const growthPct = i > 0 && prevTotal > 0 ? Number((((total - prevTotal) / prevTotal) * 100).toFixed(0)) : 0;
    return {
      year: y.toString(),
      CaaS: assumptions.caasClients[y],
      SaaS: assumptions.saasClients[y],
      Education: assumptions.educationClients[y],
      'Growth %': growthPct,
    };
  });

  const marginChartData = YEARS.map(y => ({
    year: y.toString(),
    'Gross Margin': projections.grossMargins[y],
    'EBITDA %': projections.grossRevenue[y] > 0
      ? Number(((projections.ebitda[y] / projections.grossRevenue[y]) * 100).toFixed(1))
      : 0,
    'Net Margin': projections.netMargins[y],
    'Cash Gen %': projections.netRevenue[y] > 0
      ? Number(((projections.operatingCashFlow[y] / projections.netRevenue[y]) * 100).toFixed(1))
      : 0,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Overview — {selectedYear}</h2>

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
                <p className="text-muted-foreground">Headcount {selectedYear}</p>
                <p className="font-bold text-foreground">{totalHeadcount[selectedYear]?.toLocaleString('pt-BR') ?? '—'}</p>
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
              <Line yAxisId="right" type="monotone" dataKey="Growth %" stroke="hsl(38 92% 50%)" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: 'hsl(38 92% 50%)', r: 3 }} />
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
              <Line type="monotone" dataKey="Net Margin" stroke="hsl(258 90% 66%)" strokeWidth={2} dot={{ fill: 'hsl(258 90% 66%)', r: 4 }} />
              <Line type="monotone" dataKey="Cash Gen %" stroke="hsl(38 92% 50%)" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: 'hsl(38 92% 50%)', r: 4 }} />
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
        Valores em R$ mil (000's) · Projeções estimadas · Modelo v7
      </p>
    </div>
  );
}
