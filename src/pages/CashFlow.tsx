import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS, DEBTS } from '@/lib/financialData';
import { formatCurrency } from '@/lib/formatters';
import { Shield } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend,
} from 'recharts';

export default function CashFlow() {
  const { projections, selectedYear } = useFinancialModel();

  const totalMonthlyDebt = DEBTS.reduce((s, d) => s + d.monthlyPayment, 0);

  const waterfallData = YEARS.map(y => ({
    year: y.toString(),
    EBITDA: projections.ebitda[y],
    'Debt Repayment': -(totalMonthlyDebt * 12) / 1000,
    'Net Cash': projections.ebitda[y] - (totalMonthlyDebt * 12) / 1000,
  }));

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let cumCash = 0;
  const monthlyCashData = months.map((m, i) => {
    const monthlyEbitda = projections.ebitda[selectedYear] / 12;
    cumCash += monthlyEbitda * 1000 - totalMonthlyDebt;
    return { month: m, cash: Math.round(cumCash / 1000) };
  });

  const monthlyBurn = (projections.grossRevenue[selectedYear] * 1000 - projections.ebitda[selectedYear] * 1000) / 12;
  const runwayMonths = monthlyBurn > 0 ? Math.round((projections.ebitda[selectedYear] * 1000 * 12) / monthlyBurn / 12) : 99;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Cash Flow</h2>

      {/* Cash Runway */}
      <div className="kpi-card flex items-center gap-4">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <p className="text-xs text-muted-foreground">Cash Runway</p>
          <p className="text-3xl font-bold">{runwayMonths > 36 ? '36+' : runwayMonths} <span className="text-sm text-muted-foreground">months</span></p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Waterfall */}
        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold mb-4">Annual Cash Flow (R$ thousands)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={waterfallData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
              <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={11} />
              <YAxis stroke="hsl(215 20% 55%)" fontSize={11} />
              <Tooltip
                contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'hsl(210 40% 98%)' }}
              />
              <Bar dataKey="EBITDA" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Debt Repayment" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Net Cash" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Cumulative */}
        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold mb-4">Cumulative Cash — {selectedYear} (R$ thousands)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={monthlyCashData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
              <XAxis dataKey="month" stroke="hsl(215 20% 55%)" fontSize={11} />
              <YAxis stroke="hsl(215 20% 55%)" fontSize={11} />
              <Tooltip
                contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'hsl(210 40% 98%)' }}
              />
              <Area type="monotone" dataKey="cash" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Debt Payments */}
      <div className="gradient-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 text-muted-foreground font-medium">Creditor</th>
              <th className="text-right p-4 text-muted-foreground font-medium">Amount</th>
              <th className="text-right p-4 text-muted-foreground font-medium">Monthly</th>
              <th className="text-right p-4 text-muted-foreground font-medium">Final</th>
            </tr>
          </thead>
          <tbody>
            {DEBTS.map(d => (
              <tr key={d.creditor} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="p-4 font-medium">{d.creditor}</td>
                <td className="text-right p-4 tabular-nums">{formatCurrency(d.amount)}</td>
                <td className="text-right p-4 tabular-nums text-negative">{formatCurrency(-d.monthlyPayment)}</td>
                <td className="text-right p-4 text-muted-foreground">{d.finalDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
