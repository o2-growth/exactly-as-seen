import { DEBTS, YEARS } from '@/lib/financialData';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export default function DebtFinance() {
  // Generate monthly debt amortization data
  const debtChartData = YEARS.slice(0, 5).flatMap(year => {
    return Array.from({ length: 12 }, (_, m) => {
      const monthIndex = (year - 2025) * 12 + m;
      return {
        period: `${year}-${String(m + 1).padStart(2, '0')}`,
        PRONAMP: monthIndex < 30 ? 3.853 : 0, // Until Jul 2027
        FAMPE: monthIndex < 6 ? 5.284 : 0,     // Until Jun 2025
        Santander: monthIndex < 48 ? 3.270 : 0, // Until Jan 2029
      };
    });
  }).filter((_, i) => i % 3 === 0); // Show quarterly for readability

  const phases = [
    { year: '2025', label: 'Seed / Bootstrap', desc: 'Debt repayment', color: 'bg-warning' },
    { year: '2026', label: 'Series A', desc: 'Preparation', color: 'bg-primary' },
    { year: '2027', label: 'Scale', desc: 'Expansion', color: 'bg-success' },
    { year: '2028–2030', label: 'Growth', desc: 'Profitability', color: 'bg-success' },
  ];

  const totalDebt = DEBTS.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Debt & Finance</h2>

      {/* Summary KPI */}
      <div className="kpi-card">
        <p className="text-xs text-muted-foreground mb-1">Total Outstanding Debt</p>
        <p className="text-3xl font-bold text-negative">{formatCurrency(totalDebt)}</p>
      </div>

      {/* Debt Table */}
      <div className="gradient-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 text-muted-foreground font-medium">Creditor</th>
              <th className="text-right p-4 text-muted-foreground font-medium">Amount</th>
              <th className="text-right p-4 text-muted-foreground font-medium">Monthly Payment</th>
              <th className="text-right p-4 text-muted-foreground font-medium">Final Date</th>
              <th className="text-right p-4 text-muted-foreground font-medium">Rate</th>
            </tr>
          </thead>
          <tbody>
            {DEBTS.map(d => (
              <tr key={d.creditor} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="p-4 font-medium">{d.creditor}</td>
                <td className="text-right p-4 tabular-nums">{formatCurrency(d.amount)}</td>
                <td className="text-right p-4 tabular-nums text-negative">{formatCurrency(-d.monthlyPayment)}</td>
                <td className="text-right p-4 text-muted-foreground">{d.finalDate}</td>
                <td className="text-right p-4">{formatPercent(d.rate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Amortization Chart */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold mb-4">Debt Amortization (R$ thousands / quarter)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={debtChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
            <XAxis dataKey="period" stroke="hsl(215 20% 55%)" fontSize={9} interval={3} angle={-45} textAnchor="end" height={50} />
            <YAxis stroke="hsl(215 20% 55%)" fontSize={11} />
            <Tooltip contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'hsl(210 40% 98%)' }} />
            <Bar dataKey="PRONAMP" stackId="a" fill="#3b82f6" />
            <Bar dataKey="FAMPE" stackId="a" fill="#f59e0b" />
            <Bar dataKey="Santander" stackId="a" fill="#ef4444" radius={[3, 3, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Finance Timeline */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold mb-6">Finance Cycle Timeline</h3>
        <div className="flex items-center gap-2">
          {phases.map((p, i) => (
            <div key={p.year} className="flex-1 relative">
              <div className={`h-2 rounded-full ${p.color}`} />
              <div className="mt-3">
                <p className="text-xs font-bold">{p.year}</p>
                <p className="text-[10px] text-muted-foreground">{p.label}</p>
                <p className="text-[10px] text-muted-foreground">{p.desc}</p>
              </div>
              {i < phases.length - 1 && (
                <div className="absolute top-0.5 right-0 w-2 h-2 rounded-full bg-foreground/30 translate-x-1" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
