import { useState } from 'react';
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS } from '@/lib/financialData';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export default function PnL() {
  const { projections, selectedYear } = useFinancialModel();
  const [view, setView] = useState<'annual' | 'monthly'>('annual');

  const lineItems = [
    { label: 'Gross Revenue', key: 'grossRevenue' as const },
    { label: 'Net Revenue', key: 'netRevenue' as const },
    { label: 'Gross Profit', key: 'grossProfit' as const },
    { label: 'EBITDA', key: 'ebitda' as const },
  ];

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyData = months.map((m, i) => {
    const annualRev = projections.grossRevenue[selectedYear];
    // Simple distribution with growth curve
    const weight = 0.6 + (i / 11) * 0.8;
    const totalWeight = Array.from({ length: 12 }, (_, j) => 0.6 + (j / 11) * 0.8).reduce((a, b) => a + b, 0);
    const monthlyRev = (annualRev * weight) / totalWeight;
    return {
      month: m,
      CaaS: Math.round(monthlyRev * 0.45),
      SaaS: Math.round(monthlyRev * 0.35),
      Education: Math.round(monthlyRev * 0.15),
      BaaS: Math.round(monthlyRev * 0.05),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">P&L — Income Statement</h2>
        <div className="flex bg-secondary rounded-lg p-0.5 border border-border">
          {(['annual', 'monthly'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${
                view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'annual' ? (
        <div className="gradient-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-muted-foreground font-medium">Line Item</th>
                {YEARS.map(y => (
                  <th key={y} className="text-right p-4 text-muted-foreground font-medium">{y}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map(({ label, key }) => (
                <tr key={key} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="p-4 font-medium">{label}</td>
                  {YEARS.map(y => (
                    <td key={y} className="text-right p-4 tabular-nums">
                      {formatCurrency(projections[key][y] * 1000)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b border-border/50">
                <td className="p-4 font-medium">Gross Margin</td>
                {YEARS.map(y => (
                  <td key={y} className="text-right p-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                      projections.grossMargins[y] > 70 ? 'bg-success/20 text-positive' : 'bg-warning/20 text-warning'
                    }`}>
                      {formatPercent(projections.grossMargins[y])}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold mb-4">Monthly Revenue Breakdown — {selectedYear} (R$ thousands)</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
              <XAxis dataKey="month" stroke="hsl(215 20% 55%)" fontSize={11} />
              <YAxis stroke="hsl(215 20% 55%)" fontSize={11} />
              <Tooltip
                contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'hsl(210 40% 98%)' }}
              />
              <Bar dataKey="CaaS" stackId="a" fill="#3b82f6" />
              <Bar dataKey="SaaS" stackId="a" fill="#8b5cf6" />
              <Bar dataKey="Education" stackId="a" fill="#f59e0b" />
              <Bar dataKey="BaaS" stackId="a" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
