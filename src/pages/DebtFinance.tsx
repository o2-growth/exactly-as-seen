import { useState } from 'react';
import { DEBTS, YEARS } from '@/lib/financialData';
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface DebtRow {
  id: string;
  creditor: string;
  amount: number;
  monthlyPayment: number;
  finalDate: string;
  rate: number;
}

interface InvestorDebtRow {
  id: string;
  investor: string;
  amount: number;
  rate: number;
  term: string;
  monthlyPayment: number;
}

const bankDebts: DebtRow[] = DEBTS.map((d, i) => ({
  id: `bank-${i}`,
  creditor: d.creditor,
  amount: d.amount,
  monthlyPayment: d.monthlyPayment,
  finalDate: d.finalDate,
  rate: d.rate,
}));

export default function DebtFinance() {
  const { projections } = useFinancialModel();
  const [taxDebts, setTaxDebts] = useState<DebtRow[]>([]);
  const [investorDebts, setInvestorDebts] = useState<InvestorDebtRow[]>([]);

  const allDebts = [...bankDebts, ...taxDebts];
  const totalDebt = allDebts.reduce((s, d) => s + d.amount, 0) + investorDebts.reduce((s, d) => s + d.amount, 0);
  const totalMonthlyService = allDebts.reduce((s, d) => s + d.monthlyPayment, 0) + investorDebts.reduce((s, d) => s + d.monthlyPayment, 0);
  const weightedRate = totalDebt > 0
    ? allDebts.reduce((s, d) => s + d.rate * d.amount, 0) / (allDebts.reduce((s, d) => s + d.amount, 0) || 1)
    : 0;
  const ebitda2025 = projections.ebitda[2025];
  const debtToEbitda = ebitda2025 > 0 ? totalDebt / ebitda2025 : 0;

  const addTaxDebt = () => setTaxDebts(prev => [...prev, { id: `tax-${Date.now()}`, creditor: '', amount: 0, monthlyPayment: 0, finalDate: '', rate: 0 }]);
  const removeTaxDebt = (id: string) => setTaxDebts(prev => prev.filter(d => d.id !== id));
  const updateTaxDebt = (id: string, field: keyof DebtRow, value: string | number) => {
    setTaxDebts(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const addInvestorDebt = () => setInvestorDebts(prev => [...prev, { id: `inv-${Date.now()}`, investor: '', amount: 0, rate: 0, term: '', monthlyPayment: 0 }]);
  const removeInvestorDebt = (id: string) => setInvestorDebts(prev => prev.filter(d => d.id !== id));
  const updateInvestorDebt = (id: string, field: keyof InvestorDebtRow, value: string | number) => {
    setInvestorDebts(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  // Amortization chart data
  const debtChartData = YEARS.slice(0, 5).flatMap(year =>
    Array.from({ length: 12 }, (_, m) => {
      const monthIndex = (year - 2025) * 12 + m;
      return {
        period: `${year}-${String(m + 1).padStart(2, '0')}`,
        PRONAMP: monthIndex < 30 ? 3.853 : 0,
        FAMPE: monthIndex < 6 ? 5.284 : 0,
        Santander: monthIndex < 48 ? 3.270 : 0,
      };
    })
  ).filter((_, i) => i % 3 === 0);

  const phases = [
    { year: '2025', label: 'Seed / Bootstrap', desc: 'Debt repayment', color: 'bg-warning' },
    { year: '2026', label: 'Series A', desc: 'Preparation', color: 'bg-primary' },
    { year: '2027', label: 'Scale', desc: 'Expansion', color: 'bg-accent' },
    { year: '2028–2030', label: 'Growth', desc: 'Profitability', color: 'bg-accent' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Debt & Finance</h2>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">Total Debt</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(totalDebt)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">Wtd Avg Rate</p>
          <p className="text-2xl font-bold text-foreground">{formatPercent(weightedRate)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">Monthly Debt Service</p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(totalMonthlyService)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">Debt / EBITDA</p>
          <p className="text-2xl font-bold text-foreground">{debtToEbitda.toFixed(1)}x</p>
        </div>
      </div>

      {/* Category 1: Bank Debt */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Dívida Bancária</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium">Creditor</th>
                <th className="text-right p-3 text-muted-foreground font-medium">Amount</th>
                <th className="text-right p-3 text-muted-foreground font-medium">Monthly Payment</th>
                <th className="text-right p-3 text-muted-foreground font-medium">Final Date</th>
                <th className="text-right p-3 text-muted-foreground font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {bankDebts.map(d => (
                <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="p-3 font-medium text-foreground">{d.creditor}</td>
                  <td className="text-right p-3 tabular-nums text-foreground">{formatCurrency(d.amount)}</td>
                  <td className="text-right p-3 tabular-nums text-destructive">{formatCurrency(-d.monthlyPayment)}</td>
                  <td className="text-right p-3 text-muted-foreground">{d.finalDate}</td>
                  <td className="text-right p-3 text-foreground">{formatPercent(d.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Amortization Chart */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Bank Debt Amortization (R$ 000's / quarter)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={debtChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
            <XAxis dataKey="period" stroke="hsl(215 20% 55%)" fontSize={11} interval={3} angle={-45} textAnchor="end" height={50} />
            <YAxis stroke="hsl(215 20% 55%)" fontSize={13} tickFormatter={(v: number) => `R$${v.toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'hsl(210 40% 98%)' }} />
            <Bar dataKey="PRONAMP" stackId="a" fill="hsl(217 91% 60%)" />
            <Bar dataKey="FAMPE" stackId="a" fill="hsl(38 92% 50%)" />
            <Bar dataKey="Santander" stackId="a" fill="hsl(0 84% 60%)" radius={[3, 3, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category 2: Tax Debt */}
      <div className="gradient-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Dívida Tributária</h3>
          <Button variant="outline" size="sm" onClick={addTaxDebt} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Row
          </Button>
        </div>
        {taxDebts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No tax debts added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium">Creditor</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">Amount</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">Monthly Payment</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">Final Date</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">Rate %</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {taxDebts.map(d => (
                  <tr key={d.id} className="border-b border-border/50">
                    <td className="p-2"><Input value={d.creditor} onChange={e => updateTaxDebt(d.id, 'creditor', e.target.value)} className="h-8 text-xs" placeholder="Creditor" /></td>
                    <td className="p-2"><Input type="number" value={d.amount || ''} onChange={e => updateTaxDebt(d.id, 'amount', +e.target.value)} className="h-8 text-xs text-right" /></td>
                    <td className="p-2"><Input type="number" value={d.monthlyPayment || ''} onChange={e => updateTaxDebt(d.id, 'monthlyPayment', +e.target.value)} className="h-8 text-xs text-right" /></td>
                    <td className="p-2"><Input value={d.finalDate} onChange={e => updateTaxDebt(d.id, 'finalDate', e.target.value)} className="h-8 text-xs text-right" placeholder="Mon/YYYY" /></td>
                    <td className="p-2"><Input type="number" step="0.1" value={d.rate || ''} onChange={e => updateTaxDebt(d.id, 'rate', +e.target.value)} className="h-8 text-xs text-right" /></td>
                    <td className="p-2"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeTaxDebt(d.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Category 3: Investor / Related Party */}
      <div className="gradient-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Mútuos / Capital PF</h3>
          <Button variant="outline" size="sm" onClick={addInvestorDebt} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Row
          </Button>
        </div>
        {investorDebts.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No investor debts added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium">Investor</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">Amount</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">Rate %</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">Term</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">Monthly Payment</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {investorDebts.map(d => (
                  <tr key={d.id} className="border-b border-border/50">
                    <td className="p-2"><Input value={d.investor} onChange={e => updateInvestorDebt(d.id, 'investor', e.target.value)} className="h-8 text-xs" placeholder="Name" /></td>
                    <td className="p-2"><Input type="number" value={d.amount || ''} onChange={e => updateInvestorDebt(d.id, 'amount', +e.target.value)} className="h-8 text-xs text-right" /></td>
                    <td className="p-2"><Input type="number" step="0.1" value={d.rate || ''} onChange={e => updateInvestorDebt(d.id, 'rate', +e.target.value)} className="h-8 text-xs text-right" /></td>
                    <td className="p-2"><Input value={d.term} onChange={e => updateInvestorDebt(d.id, 'term', e.target.value)} className="h-8 text-xs text-right" placeholder="e.g. 24 months" /></td>
                    <td className="p-2"><Input type="number" value={d.monthlyPayment || ''} onChange={e => updateInvestorDebt(d.id, 'monthlyPayment', +e.target.value)} className="h-8 text-xs text-right" /></td>
                    <td className="p-2"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeInvestorDebt(d.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Finance Timeline */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-6">Finance Cycle Timeline</h3>
        <div className="flex items-center gap-2">
          {phases.map((p, i) => (
            <div key={p.year} className="flex-1 relative">
              <div className={`h-2 rounded-full ${p.color}`} />
              <div className="mt-3">
                <p className="text-xs font-bold text-foreground">{p.year}</p>
                <p className="text-[10px] text-muted-foreground">{p.label}</p>
                <p className="text-[10px] text-muted-foreground">{p.desc}</p>
              </div>
              {i < phases.length - 1 && (
                <div className="absolute top-0.5 right-0 w-2 h-2 rounded-full bg-muted-foreground/30 translate-x-1" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
