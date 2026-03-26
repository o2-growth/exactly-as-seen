import { useState } from 'react';
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS, SUB_PRODUCT_LABELS, SubProductClients, Year } from '@/lib/financialData';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { cacBySector, headcountRatios, namedEmployees2025, salaryRanges, cacPerClient } from '@/data/modelData';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

type SubProductKey = keyof SubProductClients;

const SUB_PRODUCT_COLORS: Record<SubProductKey, string> = {
  caasAssessoria: 'hsl(217 91% 60%)',
  caasEnterprise: 'hsl(199 89% 48%)',
  caasCorporate: 'hsl(187 85% 43%)',
  caasSetup: 'hsl(175 80% 40%)',
  saasOxy: 'hsl(258 90% 66%)',
  saasOxyGenio: 'hsl(280 85% 60%)',
  educationDonoCFO: 'hsl(38 92% 50%)',
  baas: 'hsl(340 82% 52%)',
};

// Compute projected headcount from engine ratios
function computeHeadcount(totalClients: number) {
  const baseCFOs = namedEmployees2025.filter(e => e.role === 'CFO').length;
  const baseFPA = namedEmployees2025.filter(e => e.role === 'FP&A').length;
  const baseCSM = namedEmployees2025.filter(e => e.role === 'Customer Svc').length;
  const baseIT = namedEmployees2025.filter(e => e.role === 'IT').length;
  const baseMgmt = namedEmployees2025.filter(e => ['CEO', 'COO', 'CTO', 'CMO'].includes(e.role)).length;
  const baseAdmin = namedEmployees2025.filter(e => ['People', 'Finance', 'Admin'].includes(e.role)).length;
  const baseMkt = namedEmployees2025.filter(e => e.role === 'Marketing').length;

  return {
    cfos: Math.max(baseCFOs, Math.ceil(totalClients / headcountRatios.clientsPerCFO)),
    fpa: Math.max(baseFPA, Math.ceil(totalClients / headcountRatios.clientsPerFPA)),
    csm: Math.max(baseCSM, Math.ceil(totalClients / headcountRatios.clientsPerCSM)),
    pf: Math.ceil(totalClients / headcountRatios.clientsPerPF),
    projectAnalyst: Math.ceil(totalClients / headcountRatios.clientsPerProjectAnal),
    dataAnalyst: Math.ceil(totalClients / headcountRatios.clientsPerDataAnal),
    it: baseIT,
    management: baseMgmt,
    admin: baseAdmin,
    marketing: baseMkt,
  };
}

const HEADCOUNT_ROLES = [
  { key: 'cfos', label: 'CFOs', bu: 'CaaS', salary: salaryRanges['CFO'] },
  { key: 'fpa', label: 'FP&A Analysts', bu: 'CaaS', salary: salaryRanges['FP&A Analyst'] },
  { key: 'csm', label: 'Customer Service', bu: 'Operations', salary: salaryRanges['Customer Service'] },
  { key: 'pf', label: 'Project Finance Directors', bu: 'CaaS', salary: salaryRanges['Project Finance Director'] },
  { key: 'projectAnalyst', label: 'Project Analysts', bu: 'CaaS', salary: salaryRanges['Project Analyst'] },
  { key: 'dataAnalyst', label: 'Data Analysts', bu: 'SaaS', salary: salaryRanges['Data Processes Analyst'] },
  { key: 'it', label: 'Tech Team', bu: 'SaaS', salary: salaryRanges['Senior Fullstack'] },
  { key: 'management', label: 'Management', bu: 'Management', salary: 22000 },
  { key: 'admin', label: 'Administrative', bu: 'Admin', salary: 8500 },
  { key: 'marketing', label: 'Marketing', bu: 'Marketing', salary: salaryRanges['UX Designer'] },
];

export default function ClientsGrowth() {
  const { projections, assumptions, selectedYear, model } = useFinancialModel();
  const [viewMode, setViewMode] = useState<'planned' | 'actual'>('planned');

  const subProductKeys = Object.keys(SUB_PRODUCT_LABELS) as SubProductKey[];

  // Sub-product segmentation chart data
  const clientData = YEARS.map(y => {
    const row: any = { year: y.toString() };
    subProductKeys.forEach(key => {
      row[SUB_PRODUCT_LABELS[key]] = assumptions.subProductClients[key][y];
    });
    return row;
  });

  // Actual data placeholder
  const [actualData, setActualData] = useState<Record<string, Record<number, number>>>(() => {
    const d: Record<string, Record<number, number>> = {};
    subProductKeys.forEach(key => {
      d[key] = {};
      YEARS.forEach(y => { d[key][y] = 0; });
    });
    return d;
  });

  const updateActual = (key: string, year: Year, val: number) => {
    setActualData(prev => ({
      ...prev,
      [key]: { ...prev[key], [year]: val },
    }));
  };

  // CAC data from real model (7 sectors)
  const cacData = [...cacBySector].sort((a, b) => b.cac - a.cac);

  // LTV calculation using real CAC per BU
  const avgTicket = Object.values(assumptions.tickets).reduce((s, v) => s + v, 0) / Object.values(assumptions.tickets).length;
  const avgChurn = (assumptions.churnCaas + assumptions.churnSaas) / 2 / 100;
  const monthlyChurn = avgChurn / 12;
  const ltv = monthlyChurn > 0 ? avgTicket / monthlyChurn : avgTicket * 1200;
  const avgCac = (cacPerClient.caas + cacPerClient.saas + cacPerClient.education + cacPerClient.baas) / 4;
  const ltvCacRatio = avgCac > 0 ? ltv / avgCac : 0;

  // MRR / ARR
  const totalClientsYear = projections.totalClients[selectedYear];
  const mrr = totalClientsYear * avgTicket;
  const arr = mrr * 12;

  // Headcount projections from engine ratios
  const headcountByYear = YEARS.map(y => ({
    year: y,
    ...computeHeadcount(projections.totalClients[y]),
  }));

  // BU breakdown from engine
  const buData = YEARS.map(y => {
    const yr = model.years[y];
    return {
      year: y.toString(),
      'CaaS': yr.caasRevenue,
      'SaaS': yr.saasRevenue,
      'Education': yr.educationRevenue,
      'BaaS': yr.baasRevenue,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Clients & Growth</h2>
        <div className="flex bg-secondary rounded-lg p-0.5 border border-border">
          {(['planned', 'actual'] as const).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${
                viewMode === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">Total Clients ({selectedYear})</p>
          <p className="text-2xl font-bold">{formatNumber(totalClientsYear)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">MRR</p>
          <p className="text-2xl font-bold">{formatCurrency(mrr)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">ARR</p>
          <p className="text-2xl font-bold">{formatCurrency(arr)}</p>
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

      {/* Client Segmentation Chart */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold mb-4">Client Growth by Sub-Product</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={clientData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22% / 0.5)" />
            <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={13} />
            <YAxis stroke="hsl(215 20% 55%)" fontSize={13} />
            <Tooltip
              contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'hsl(210 40% 98%)', fontWeight: 700 }}
            />
            {subProductKeys.map(key => (
              <Bar key={key} dataKey={SUB_PRODUCT_LABELS[key]} stackId="clients" fill={SUB_PRODUCT_COLORS[key]} />
            ))}
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* BU Revenue Breakdown */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold mb-4">Revenue by BU (R$ thousands)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={buData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22% / 0.5)" />
            <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={13} />
            <YAxis stroke="hsl(215 20% 55%)" fontSize={13} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}M`} />
            <Tooltip
              contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'hsl(210 40% 98%)', fontWeight: 700 }}
              formatter={(v: number) => [formatCurrency(v * 1000), '']}
            />
            <Bar dataKey="CaaS" stackId="rev" fill="hsl(217 91% 60%)" />
            <Bar dataKey="SaaS" stackId="rev" fill="hsl(258 90% 66%)" />
            <Bar dataKey="Education" stackId="rev" fill="hsl(38 92% 50%)" />
            <Bar dataKey="BaaS" stackId="rev" fill="hsl(340 82% 52%)" />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Actual input table (shown when "Actual" selected) */}
      {viewMode === 'actual' && (
        <div className="gradient-card overflow-x-auto">
          <h3 className="text-sm font-semibold p-5 pb-3">Actual Client Numbers (editable)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium min-w-[180px]">Sub-Product</th>
                {YEARS.map(y => (
                  <th key={y} className="text-right p-3 text-muted-foreground font-medium">{y}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subProductKeys.map(key => (
                <tr key={key} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                  <td className="p-3 font-medium">{SUB_PRODUCT_LABELS[key]}</td>
                  {YEARS.map(y => (
                    <td key={y} className="text-right p-3">
                      <input
                        type="number"
                        className="w-20 bg-secondary border border-border rounded px-2 py-1 text-right text-sm tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                        value={actualData[key]?.[y] || 0}
                        onChange={e => updateActual(key, y, Number(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-muted-foreground p-3 pt-1">
            Ready for Meta Ads integration — populate with actual acquisition data.
          </p>
        </div>
      )}

      {/* Marketing KPIs */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* CAC by Sector (real data from modelData) */}
        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold mb-4">CAC by BU / Sector (BRL)</h3>
          <div className="space-y-3">
            {cacData.map(c => (
              <div key={c.sector}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{c.sector}</span>
                  <span className="font-semibold">{formatCurrency(c.cac)}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (c.cac / 12000) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LTV & Unit Economics */}
        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold mb-4">Unit Economics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Avg Ticket</p>
              <p className="text-lg font-bold">{formatCurrency(avgTicket)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Avg Churn (annual)</p>
              <p className="text-lg font-bold">{(avgChurn * 100).toFixed(1)}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">LTV</p>
              <p className="text-lg font-bold">{formatCurrency(ltv)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">LTV:CAC</p>
              <p className={`text-lg font-bold ${ltvCacRatio >= 3 ? 'text-positive' : 'text-negative'}`}>{ltvCacRatio.toFixed(1)}x</p>
            </div>
          </div>
        </div>
      </div>

      {/* Headcount (engine-driven from ratios) */}
      <div className="gradient-card overflow-x-auto">
        <h3 className="text-sm font-semibold p-5 pb-0">Headcount Projection (ratio-driven)</h3>
        <p className="text-[10px] text-muted-foreground px-5 pb-3">Based on {headcountRatios.clientsPerCFO} clients/CFO, {headcountRatios.clientsPerFPA} clients/FP&A, {headcountRatios.clientsPerCSM} clients/CSM</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 text-muted-foreground font-medium">Role</th>
              <th className="text-left p-4 text-muted-foreground font-medium">BU</th>
              {YEARS.map(y => (
                <th key={y} className="text-right p-4 text-muted-foreground font-medium">{y}</th>
              ))}
              <th className="text-right p-4 text-muted-foreground font-medium">Salary/mo</th>
            </tr>
          </thead>
          <tbody>
            {HEADCOUNT_ROLES.map(role => (
              <tr key={role.key} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="p-4 font-medium">{role.label}</td>
                <td className="p-4 text-muted-foreground">{role.bu}</td>
                {headcountByYear.map(h => (
                  <td key={h.year} className="text-right p-4 tabular-nums">
                    {((h as any)[role.key] || 0).toLocaleString('pt-BR')}
                  </td>
                ))}
                <td className="text-right p-4 tabular-nums">{formatCurrency(role.salary)}</td>
              </tr>
            ))}
            {/* Total row */}
            <tr className="border-b border-border bg-primary/5 font-bold">
              <td className="p-4">Total</td>
              <td className="p-4"></td>
              {headcountByYear.map(h => {
                const total = HEADCOUNT_ROLES.reduce((s, r) => s + ((h as any)[r.key] || 0), 0);
                return <td key={h.year} className="text-right p-4 tabular-nums">{total.toLocaleString('pt-BR')}</td>;
              })}
              <td className="p-4"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
