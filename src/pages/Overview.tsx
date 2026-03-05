import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS } from '@/lib/financialData';
import { formatCurrency, formatPercent, formatNumber } from '@/lib/formatters';
import { TrendingUp, Users, DollarSign, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend,
} from 'recharts';

export default function Overview() {
  const { projections, selectedYear } = useFinancialModel();

  const kpis = [
    { label: 'Total Clients', value: formatNumber(projections.totalClients[selectedYear]), icon: Users, color: 'text-primary' },
    { label: 'Gross Revenue', value: formatCurrency(projections.grossRevenue[selectedYear] * 1000), icon: DollarSign, color: 'text-success' },
    { label: 'EBITDA', value: formatCurrency(projections.ebitda[selectedYear] * 1000), icon: BarChart3, color: 'text-warning' },
    { label: 'Gross Margin', value: formatPercent(projections.grossMargins[selectedYear]), icon: TrendingUp, color: 'text-primary' },
  ];

  const revenueChartData = YEARS.map(y => ({
    year: y.toString(),
    'Gross Revenue': projections.grossRevenue[y],
    'Net Revenue': projections.netRevenue[y],
  }));

  const clientChartData = YEARS.map(y => ({
    year: y.toString(),
    CaaS: Math.round(projections.totalClients[y] * 0.15),
    SaaS: Math.round(projections.totalClients[y] * 0.60),
    Education: Math.round(projections.totalClients[y] * 0.25),
  }));

  const marginChartData = YEARS.map(y => ({
    year: y.toString(),
    'Gross Margin': projections.grossMargins[y],
    'EBITDA %': projections.grossRevenue[y] > 0
      ? Number(((projections.ebitda[y] / projections.grossRevenue[y]) * 100).toFixed(1))
      : 0,
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Overview — {selectedYear}</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="kpi-card">
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-xs text-muted-foreground font-medium">{label}</span>
            </div>
            <p className="text-2xl font-bold tracking-tight animate-count">{value}</p>
          </div>
        ))}
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
              <Tooltip
                contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'hsl(210 40% 98%)' }}
                formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR')}k`, '']}
              />
              <Bar dataKey="Gross Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Net Revenue" fill="#3b82f680" radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'hsl(215 20% 55%)' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Client Growth */}
        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold mb-4">Client Growth</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={clientChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
              <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={11} />
              <YAxis stroke="hsl(215 20% 55%)" fontSize={11} />
              <Tooltip
                contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'hsl(210 40% 98%)' }}
              />
              <Area type="monotone" dataKey="SaaS" stackId="1" fill="#8b5cf6" stroke="#8b5cf6" fillOpacity={0.6} />
              <Area type="monotone" dataKey="Education" stackId="1" fill="#f59e0b" stroke="#f59e0b" fillOpacity={0.6} />
              <Area type="monotone" dataKey="CaaS" stackId="1" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.6} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Margin Evolution */}
        <div className="gradient-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4">Margin Evolution</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={marginChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
              <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={11} />
              <YAxis stroke="hsl(215 20% 55%)" fontSize={11} unit="%" />
              <Tooltip
                contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'hsl(210 40% 98%)' }}
                formatter={(v: number) => [`${v}%`, '']}
              />
              <Line type="monotone" dataKey="Gross Margin" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
              <Line type="monotone" dataKey="EBITDA %" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer Disclaimer */}
      <p className="text-[10px] text-muted-foreground text-center pt-4">
        Valores em R$ mil (000's) · Projeções estimadas · Modelo v7
      </p>
    </div>
  );
}
