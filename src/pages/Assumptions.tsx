import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS, Year } from '@/lib/financialData';
import { formatCurrency } from '@/lib/formatters';
import { RotateCcw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';

function SliderInput({ label, value, min, max, step = 1, onChange, format = 'number' }: {
  label: string; value: number; min: number; max: number; step?: number;
  onChange: (v: number) => void; format?: 'number' | 'currency' | 'percent';
}) {
  const display = format === 'currency' ? formatCurrency(value) : format === 'percent' ? `${value}%` : value.toLocaleString('pt-BR');

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-secondary accent-primary"
      />
    </div>
  );
}

export default function Assumptions() {
  const { assumptions, updateAssumption, resetAssumptions, projections } = useFinancialModel();

  const updateClientYear = (line: 'caasClients' | 'saasClients' | 'educationClients', year: Year, value: number) => {
    updateAssumption(line, { ...assumptions[line], [year]: value });
  };

  const updateTicket = (key: keyof typeof assumptions.tickets, value: number) => {
    updateAssumption('tickets', { ...assumptions.tickets, [key]: value });
  };

  const livePreviewData = YEARS.map(y => ({
    year: y.toString(),
    Revenue: projections.grossRevenue[y],
    EBITDA: projections.ebitda[y],
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Assumptions</h2>
        <button onClick={resetAssumptions} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
          <RotateCcw className="h-3.5 w-3.5" /> Reset to Base
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Sliders */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client Growth */}
          <div className="gradient-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">Client Growth Targets</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <p className="text-xs text-primary font-semibold">CaaS</p>
                {([2025, 2026, 2027] as Year[]).map(y => (
                  <SliderInput key={`caas-${y}`} label={`${y}`} value={assumptions.caasClients[y]}
                    min={0} max={y === 2025 ? 500 : y === 2026 ? 1000 : 2000}
                    onChange={v => updateClientYear('caasClients', y, v)} />
                ))}
              </div>
              <div className="space-y-4">
                <p className="text-xs font-semibold" style={{ color: '#8b5cf6' }}>SaaS</p>
                {([2025, 2026, 2027] as Year[]).map(y => (
                  <SliderInput key={`saas-${y}`} label={`${y}`} value={assumptions.saasClients[y]}
                    min={0} max={y === 2025 ? 1000 : y === 2026 ? 3000 : 5000}
                    onChange={v => updateClientYear('saasClients', y, v)} />
                ))}
              </div>
              <div className="space-y-4">
                <p className="text-xs font-semibold" style={{ color: '#f59e0b' }}>Education</p>
                <SliderInput label="2025" value={assumptions.educationClients[2025]}
                  min={0} max={300} onChange={v => updateClientYear('educationClients', 2025, v)} />
              </div>
            </div>
          </div>

          {/* Tickets */}
          <div className="gradient-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">Average Tickets (BRL/month)</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <SliderInput label="CaaS Assessoria" value={assumptions.tickets.caasAssessoria} min={500} max={5000} step={100} format="currency" onChange={v => updateTicket('caasAssessoria', v)} />
              <SliderInput label="CaaS Enterprise" value={assumptions.tickets.caasEnterprise} min={3000} max={20000} step={100} format="currency" onChange={v => updateTicket('caasEnterprise', v)} />
              <SliderInput label="CaaS Corporate" value={assumptions.tickets.caasCorporate} min={5000} max={30000} step={100} format="currency" onChange={v => updateTicket('caasCorporate', v)} />
              <SliderInput label="SaaS Oxy" value={assumptions.tickets.saasOxy} min={200} max={5000} step={50} format="currency" onChange={v => updateTicket('saasOxy', v)} />
              <SliderInput label="SaaS Oxy + Gênio" value={assumptions.tickets.saasOxyGenio} min={500} max={8000} step={50} format="currency" onChange={v => updateTicket('saasOxyGenio', v)} />
              <SliderInput label="Education Dono CFO" value={assumptions.tickets.educationDonoCFO} min={100} max={2000} step={10} format="currency" onChange={v => updateTicket('educationDonoCFO', v)} />
              <SliderInput label="BaaS" value={assumptions.tickets.baas} min={50} max={1000} step={10} format="currency" onChange={v => updateTicket('baas', v)} />
            </div>
          </div>

          {/* Churn & Cost */}
          <div className="gradient-card p-5 space-y-4">
            <h3 className="text-sm font-semibold">Churn & Cost Assumptions</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <SliderInput label="CaaS Churn Rate" value={assumptions.churnCaas} min={0} max={20} step={0.5} format="percent" onChange={v => updateAssumption('churnCaas', v)} />
              <SliderInput label="SaaS Churn Rate" value={assumptions.churnSaas} min={0} max={20} step={0.5} format="percent" onChange={v => updateAssumption('churnSaas', v)} />
              <SliderInput label="SG&A % of Revenue" value={assumptions.sgaPercent} min={0} max={50} step={1} format="percent" onChange={v => updateAssumption('sgaPercent', v)} />
              <SliderInput label="Headcount Cost Growth/yr" value={assumptions.headcountGrowth} min={0} max={30} step={1} format="percent" onChange={v => updateAssumption('headcountGrowth', v)} />
            </div>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="space-y-6">
          <div className="gradient-card p-5 sticky top-20">
            <h3 className="text-sm font-semibold mb-4">Live Preview</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Revenue Projection (R$ thousands)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={livePreviewData}>
                    <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={10} />
                    <YAxis stroke="hsl(215 20% 55%)" fontSize={10} hide />
                    <Bar dataKey="Revenue" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">EBITDA Projection</p>
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={livePreviewData}>
                    <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={10} />
                    <YAxis stroke="hsl(215 20% 55%)" fontSize={10} hide />
                    <Line type="monotone" dataKey="EBITDA" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
