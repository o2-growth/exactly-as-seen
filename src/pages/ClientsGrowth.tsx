import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS, CAC_BY_SECTOR, HEADCOUNT } from '@/lib/financialData';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export default function ClientsGrowth() {
  const { projections, assumptions, selectedYear } = useFinancialModel();

  const clientData = YEARS.map(y => ({
    year: y.toString(),
    CaaS: assumptions.caasClients[y],
    SaaS: assumptions.saasClients[y],
    Education: assumptions.educationClients[y],
  }));

  const cacData = CAC_BY_SECTOR.sort((a, b) => b.cac - a.cac);

  // LTV calculation
  const avgTicket = (assumptions.tickets.saasOxy + assumptions.tickets.caasAssessoria) / 2;
  const avgChurn = (assumptions.churnCaas + assumptions.churnSaas) / 2 / 100;
  const ltv = avgChurn > 0 ? avgTicket / avgChurn : avgTicket * 100;
  const avgCac = CAC_BY_SECTOR.reduce((s, c) => s + c.cac, 0) / CAC_BY_SECTOR.length;
  const ltvCacRatio = avgCac > 0 ? ltv / avgCac : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Clients & Growth</h2>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">Total Clients ({selectedYear})</p>
          <p className="text-2xl font-bold">{formatNumber(projections.totalClients[selectedYear])}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">Avg CAC</p>
          <p className="text-2xl font-bold">{formatCurrency(avgCac)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">LTV:CAC Ratio</p>
          <p className={`text-2xl font-bold ${ltvCacRatio >= 3 ? 'text-positive' : 'text-negative'}`}>{ltvCacRatio.toFixed(1)}x</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Client Growth */}
        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold mb-4">Client Growth by Segment</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={clientData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
              <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={11} />
              <YAxis stroke="hsl(215 20% 55%)" fontSize={11} />
              <Tooltip contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'hsl(210 40% 98%)' }} />
              <Bar dataKey="CaaS" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="SaaS" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Education" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* CAC by Sector */}
        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold mb-4">CAC by Sector (BRL)</h3>
          <div className="space-y-3">
            {cacData.map(c => (
              <div key={c.sector}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{c.sector}</span>
                  <span className="font-semibold">{formatCurrency(c.cac)}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(c.cac / 4000) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Headcount */}
      <div className="gradient-card overflow-x-auto">
        <h3 className="text-sm font-semibold p-5 pb-0">Headcount Growth</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 text-muted-foreground font-medium">Role</th>
              {YEARS.map(y => (
                <th key={y} className="text-right p-4 text-muted-foreground font-medium">{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEADCOUNT.map(h => (
              <tr key={h.role} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="p-4 font-medium">{h.role}</td>
                {YEARS.map(y => (
                  <td key={y} className="text-right p-4 tabular-nums">{(h as any)[y].toLocaleString('pt-BR')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
