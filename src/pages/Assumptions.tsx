import { useState, useCallback } from 'react';
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { useVersionHistory } from '@/contexts/VersionHistoryContext';
import { YEARS, Year, Assumptions as AssumptionsType, HEADCOUNT, SUB_PRODUCT_LABELS, SubProductClients } from '@/lib/financialData';
import { formatCurrency, formatCurrencyFull } from '@/lib/formatters';
import { Lock, Unlock, Save, X, RotateCcw, Scale, Receipt, Landmark, Info, BadgePercent, UserCheck } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { debtSchedule, headcountRatios, salaryRanges, commissionRate, cacBySector, namedEmployees2025, cacPerClient } from '@/data/modelData';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

type TicketKey = keyof AssumptionsType['tickets'];
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

function CellInput({ value, editing, onChange }: { value: number; editing: boolean; onChange: (v: number) => void }) {
  if (!editing) {
    return <span className="tabular-nums">{value.toLocaleString('pt-BR')}</span>;
  }
  return (
    <input
      type="number"
      className="w-full bg-secondary border border-primary/30 rounded px-2 py-1 text-right text-sm tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
      value={value}
      onChange={e => onChange(Number(e.target.value) || 0)}
    />
  );
}

// Headcount projection helper (from ClientsGrowth)
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

export default function Assumptions() {
  const { assumptions, setAssumptions, resetAssumptions, scenario, projections, model } = useFinancialModel();
  const { saveVersion } = useVersionHistory();

  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<AssumptionsType>(assumptions);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [marketingView, setMarketingView] = useState<'planned' | 'actual'>('planned');
  const [actualData, setActualData] = useState<Record<string, Record<number, number>>>(() => {
    const d: Record<string, Record<number, number>> = {};
    (Object.keys(SUB_PRODUCT_LABELS) as SubProductKey[]).forEach(key => {
      d[key] = {};
      YEARS.forEach(y => { d[key][y] = 0; });
    });
    return d;
  });

  const startEditing = () => {
    setEditState({ ...assumptions });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditState(assumptions);
    setEditing(false);
  };

  const handleSave = () => {
    setShowSaveModal(true);
  };

  const confirmSave = () => {
    if (!saveNote.trim()) return;
    setAssumptions(editState);
    saveVersion(saveNote.trim(), editState, scenario);
    setSaveNote('');
    setShowSaveModal(false);
    setEditing(false);
  };

  const updateSubProduct = (key: SubProductKey, year: Year, val: number) => {
    setEditState(prev => ({
      ...prev,
      subProductClients: {
        ...prev.subProductClients,
        [key]: { ...prev.subProductClients[key], [year]: val },
      },
    }));
  };

  const updateTicket = (key: TicketKey, val: number) => {
    setEditState(prev => ({
      ...prev,
      tickets: { ...prev.tickets, [key]: val },
    }));
  };

  const updateSalary = (role: string, val: number) => {
    setEditState(prev => ({
      ...prev,
      headcountSalaries: { ...prev.headcountSalaries, [role]: val },
    }));
  };

  const updateActual = (key: string, year: Year, val: number) => {
    setActualData(prev => ({
      ...prev,
      [key]: { ...prev[key], [year]: val },
    }));
  };

  const data = editing ? editState : assumptions;

  // Client segmentation chart data
  const subProductKeys = Object.keys(SUB_PRODUCT_LABELS) as SubProductKey[];
  const clientData = YEARS.map(y => {
    const row: any = { year: y.toString() };
    subProductKeys.forEach(key => {
      row[SUB_PRODUCT_LABELS[key]] = data.subProductClients[key][y];
    });
    return row;
  });

  // BU revenue breakdown
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

  // CAC and unit economics
  const cacData = [...cacBySector].sort((a, b) => b.cac - a.cac);
  const avgTicketVal = Object.values(data.tickets).reduce((s, v) => s + v, 0) / Object.values(data.tickets).length;
  const avgChurn = (data.churnCaas + data.churnSaas) / 2 / 100;
  const monthlyChurn = avgChurn / 12;
  const ltv = monthlyChurn > 0 ? avgTicketVal / monthlyChurn : avgTicketVal * 1200;
  const avgCac = (cacPerClient.caas + cacPerClient.saas + cacPerClient.education + cacPerClient.baas) / 4;
  const ltvCacRatio = avgCac > 0 ? ltv / avgCac : 0;

  // Headcount projections
  const headcountByYear = YEARS.map(y => ({
    year: y,
    ...computeHeadcount(projections.totalClients[y]),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Assumptions</h2>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                <Save className="h-3.5 w-3.5" /> Save
              </button>
              <button onClick={cancelEditing} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={startEditing} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-primary/40 rounded-lg text-primary hover:bg-primary/10 transition-colors">
                <Unlock className="h-3.5 w-3.5" /> Edit Assumptions
              </button>
              <button onClick={resetAssumptions} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </>
          )}
        </div>
      </div>

      {!editing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Cells are locked. Click "Edit Assumptions" to modify.
        </div>
      )}

      <Tabs defaultValue="receita" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="receita">Receita</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="operacao">Operacao</TabsTrigger>
          <TabsTrigger value="headcount">Headcount/Pessoal</TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: RECEITA ─── */}
        <TabsContent value="receita" className="space-y-6 mt-4">
          {/* 1. Client Growth Table */}
          <div className="gradient-card overflow-x-auto">
            <h3 className="text-sm font-semibold p-5 pb-3">Client Growth — Monthly New Targets</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium min-w-[180px]">Sub-Product</th>
                  {YEARS.map(y => (
                    <th key={y} className="text-right p-3 text-muted-foreground font-medium min-w-[90px]">{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Object.keys(SUB_PRODUCT_LABELS) as SubProductKey[]).map(key => (
                  <tr key={key} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="p-3 font-medium">{SUB_PRODUCT_LABELS[key]}</td>
                    {YEARS.map(y => (
                      <td key={y} className="text-right p-3">
                        <CellInput
                          value={data.subProductClients[key][y]}
                          editing={editing}
                          onChange={v => updateSubProduct(key, y, v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 2. Average Tickets */}
          <div className="gradient-card p-5">
            <h3 className="text-sm font-semibold mb-4">Average Ticket (BRL/month)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(Object.keys(SUB_PRODUCT_LABELS) as TicketKey[]).map(key => (
                <div key={key} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{SUB_PRODUCT_LABELS[key as SubProductKey]}</p>
                  <div className="text-sm font-semibold">
                    {editing ? (
                      <input
                        type="number"
                        className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                        value={data.tickets[key]}
                        onChange={e => updateTicket(key, Number(e.target.value) || 0)}
                      />
                    ) : (
                      <span>R$ {data.tickets[key].toLocaleString('pt-BR')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Churn Rates */}
          <div className="gradient-card p-5">
            <h3 className="text-sm font-semibold mb-4">Churn Rate (Annual %)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">CaaS</p>
                <div className="text-sm font-semibold">
                  {editing ? (
                    <input type="number" step="0.5" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                      value={data.churnCaas} onChange={e => setEditState(p => ({ ...p, churnCaas: Number(e.target.value) || 0 }))} />
                  ) : <span>{data.churnCaas}%</span>}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">SaaS</p>
                <div className="text-sm font-semibold">
                  {editing ? (
                    <input type="number" step="0.5" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                      value={data.churnSaas} onChange={e => setEditState(p => ({ ...p, churnSaas: Number(e.target.value) || 0 }))} />
                  ) : <span>{data.churnSaas}%</span>}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">BaaS</p>
                <div className="text-sm font-semibold">
                  {editing ? (
                    <input type="number" step="0.5" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                      value={data.churnBaas} onChange={e => setEditState(p => ({ ...p, churnBaas: Number(e.target.value) || 0 }))} />
                  ) : <span>{data.churnBaas}%</span>}
                </div>
              </div>
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
        </TabsContent>

        {/* ─── TAB 2: MARKETING ─── */}
        <TabsContent value="marketing" className="space-y-6 mt-4">
          {/* Planned/Actual toggle */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-sm font-semibold">Marketing — Planejado vs Realizado</h3>
            <div className="flex bg-secondary rounded-lg p-0.5 border border-border">
              {(['planned', 'actual'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setMarketingView(v)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${
                    marketingView === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {v === 'planned' ? 'Planejado' : 'Realizado'}
                </button>
              ))}
            </div>
          </div>

          {/* Actual input table (shown when "Actual" selected) */}
          {marketingView === 'actual' && (
            <div className="gradient-card overflow-x-auto">
              <h3 className="text-sm font-semibold p-5 pb-3">Clientes Reais (editavel)</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 text-muted-foreground font-medium min-w-[180px]">Sub-Produto</th>
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
                Pronto para integracao com Meta Ads — preencha com dados reais de aquisicao.
              </p>
            </div>
          )}

          {/* Unit Economics */}
          <div className="gradient-card p-5">
              <h3 className="text-sm font-semibold mb-4">Unit Economics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Ticket Medio</p>
                  <p className="text-lg font-bold">{formatCurrency(avgTicketVal)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Churn Medio (anual)</p>
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
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">CAC Medio</p>
                  <p className="text-lg font-bold">{formatCurrency(avgCac)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Comissao de Vendas</p>
                  <p className="text-sm font-semibold">{(commissionRate.caas * 100).toFixed(0)}% da receita bruta</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── TAB 3: OPERACAO ─── */}
        <TabsContent value="operacao" className="space-y-6 mt-4">
          {/* Cost Assumptions */}
          <div className="gradient-card p-5">
            <h3 className="text-sm font-semibold mb-4">Cost Assumptions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">SG&A % of Revenue</p>
                <div className="text-sm font-semibold">
                  {editing ? (
                    <input type="number" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                      value={data.sgaPercent} onChange={e => setEditState(p => ({ ...p, sgaPercent: Number(e.target.value) || 0 }))} />
                  ) : <span>{data.sgaPercent}%</span>}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">SG&A Annual Growth %</p>
                <div className="text-sm font-semibold">
                  {editing ? (
                    <input type="number" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                      value={data.sgaGrowthRate} onChange={e => setEditState(p => ({ ...p, sgaGrowthRate: Number(e.target.value) || 0 }))} />
                  ) : <span>{data.sgaGrowthRate}%</span>}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Headcount Cost Growth/yr</p>
                <div className="text-sm font-semibold">
                  {editing ? (
                    <input type="number" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                      value={data.headcountGrowth} onChange={e => setEditState(p => ({ ...p, headcountGrowth: Number(e.target.value) || 0 }))} />
                  ) : <span>{data.headcountGrowth}%</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Regime Tributario */}
          <div className="gradient-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Scale className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Regime Tributario</h3>
              <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary">Transicao em 2027</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <BadgePercent className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-foreground">Lucro Presumido (2025–2026)</p>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>PIS 0,65% + COFINS 3,0% + ISS 5,0% + Descontos 1,0%</p>
                  <p className="text-sm font-semibold text-foreground">Taxa total: 9,65%</p>
                </div>
              </div>
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <BadgePercent className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold text-foreground">Lucro Real (2027–2030)</p>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>PIS 1,65% + COFINS 7,6% + ISS 5,0% + Descontos 1,0%</p>
                  <p className="text-sm font-semibold text-foreground">Taxa total: 15,25%</p>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 mt-3 text-[11px] text-muted-foreground">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <span>IRPJ 25% + CSLL 9% = 34% sobre lucro tributavel (EBT). Aplicado em ambos os regimes.</span>
            </div>
          </div>

          {/* Custos e Margens */}
          <div className="gradient-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Custos e Margens</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Comissao de Vendas</p>
                <p className="text-sm font-semibold">{(commissionRate.caas * 100).toFixed(0)}% da receita bruta</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Crescimento SG&A/ano</p>
                <p className="text-sm font-semibold">
                  {editing ? (
                    <input type="number" step="1" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                      value={data.sgaGrowthRate} onChange={e => setEditState(p => ({ ...p, sgaGrowthRate: Number(e.target.value) || 0 }))} />
                  ) : <span>{data.sgaGrowthRate}%</span>}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">CAPEX % do COGS SaaS</p>
                <p className="text-sm font-semibold">50% (2025–26) -&gt; 30% (2027+)</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">BaaS COGS/cliente</p>
                <p className="text-sm font-semibold">R$ 25/mes (a partir de 2025)</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">PDD (Provisao p/ Devedores)</p>
                <p className="text-sm font-semibold">2% da receita bruta</p>
              </div>
            </div>
          </div>

          {/* Resumo de Dividas */}
          <div className="gradient-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Landmark className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Resumo de Dividas</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Saldo Total Devedor</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatCurrencyFull(debtSchedule.reduce((s, d) => s + d.outstanding, 0))}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Parcela Mensal Total</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatCurrencyFull(debtSchedule.reduce((s, d) => s + d.monthlyPayment, 0))}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">N de Contratos</p>
                <p className="text-sm font-semibold tabular-nums">{debtSchedule.length}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium text-xs">Contrato</th>
                    <th className="text-left py-2 text-muted-foreground font-medium text-xs">Credor</th>
                    <th className="text-right py-2 text-muted-foreground font-medium text-xs">Saldo (R$)</th>
                    <th className="text-right py-2 text-muted-foreground font-medium text-xs">Parcela/mes</th>
                    <th className="text-right py-2 text-muted-foreground font-medium text-xs">Parcelas rest.</th>
                    <th className="text-right py-2 text-muted-foreground font-medium text-xs">Previsao final</th>
                  </tr>
                </thead>
                <tbody>
                  {debtSchedule.map(d => (
                    <tr key={d.name} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="py-2 text-xs font-medium">{d.name}</td>
                      <td className="py-2 text-xs text-muted-foreground">{d.creditor}</td>
                      <td className="py-2 text-right text-xs tabular-nums">{formatCurrencyFull(d.outstanding)}</td>
                      <td className="py-2 text-right text-xs tabular-nums">{formatCurrencyFull(d.monthlyPayment)}</td>
                      <td className="py-2 text-right text-xs tabular-nums">{d.remainingInstallments}</td>
                      <td className="py-2 text-right text-xs tabular-nums">{d.finalDate ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ─── TAB 4: HEADCOUNT/PESSOAL ─── */}
        <TabsContent value="headcount" className="space-y-6 mt-4">
          {/* Headcount & Salaries (static table) */}
          <div className="gradient-card overflow-x-auto">
            <h3 className="text-sm font-semibold p-5 pb-3">Headcount & Salaries</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-3 text-muted-foreground font-medium">Role</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">BU</th>
                  {YEARS.map(y => (
                    <th key={y} className="text-right p-3 text-muted-foreground font-medium">{y}</th>
                  ))}
                  <th className="text-right p-3 text-muted-foreground font-medium">Salary/mo</th>
                  <th className="text-right p-3 text-muted-foreground font-medium">Total Cost/mo</th>
                </tr>
              </thead>
              <tbody>
                {HEADCOUNT.map(h => {
                  const salary = data.headcountSalaries[h.role] || 0;
                  const lastYearHC = (h as any)[YEARS[YEARS.length - 1]] || 0;
                  return (
                    <tr key={h.role} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                      <td className="p-3 font-medium">{h.role}</td>
                      <td className="p-3 text-muted-foreground">{h.bu}</td>
                      {YEARS.map(y => (
                        <td key={y} className="text-right p-3 tabular-nums">{(h as any)[y].toLocaleString('pt-BR')}</td>
                      ))}
                      <td className="text-right p-3">
                        {editing ? (
                          <input type="number" className="w-24 bg-secondary border border-primary/30 rounded px-2 py-1 text-right text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                            value={salary} onChange={e => updateSalary(h.role, Number(e.target.value) || 0)} />
                        ) : (
                          <span className="tabular-nums">{formatCurrency(salary)}</span>
                        )}
                      </td>
                      <td className="text-right p-3 tabular-nums text-muted-foreground">
                        {formatCurrency(lastYearHC * salary)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Headcount Projection (ratio-driven) */}
          <div className="gradient-card overflow-x-auto">
            <h3 className="text-sm font-semibold p-5 pb-0">Projecao de Headcount (por ratio)</h3>
            <p className="text-[10px] text-muted-foreground px-5 pb-3">
              Base: {headcountRatios.clientsPerCFO} clientes/CFO, {headcountRatios.clientsPerFPA} clientes/FP&A, {headcountRatios.clientsPerCSM} clientes/CSM
            </p>
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

          {/* Regras de Contratacao */}
          <div className="gradient-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <UserCheck className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Regras de Contratacao (Headcount)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Proporcao por clientes CaaS ativos</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 text-muted-foreground font-medium text-xs">Funcao</th>
                      <th className="text-right py-1.5 text-muted-foreground font-medium text-xs">1 por cada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'CFO', ratio: headcountRatios.clientsPerCFO },
                      { label: 'FP&A Analyst', ratio: headcountRatios.clientsPerFPA },
                      { label: 'Project Finance Director', ratio: headcountRatios.clientsPerPF },
                      { label: 'Project Analyst', ratio: headcountRatios.clientsPerProjectAnal },
                      { label: 'Data Processes Analyst', ratio: headcountRatios.clientsPerDataAnal },
                      { label: 'Customer Service Manager', ratio: headcountRatios.clientsPerCSM },
                    ].map(row => (
                      <tr key={row.label} className="border-b border-border/30">
                        <td className="py-1.5 text-xs font-medium">{row.label}</td>
                        <td className="py-1.5 text-right text-xs tabular-nums">{row.ratio} clientes</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Faixas salariais para novas contratacoes</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 text-muted-foreground font-medium text-xs">Cargo</th>
                      <th className="text-right py-1.5 text-muted-foreground font-medium text-xs">Salario/mes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(salaryRanges).map(([role, salary]) => (
                      <tr key={role} className="border-b border-border/30">
                        <td className="py-1.5 text-xs font-medium">{role}</td>
                        <td className="py-1.5 text-right text-xs tabular-nums">{formatCurrencyFull(salary)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Save Modal */}
      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save Assumptions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">
                Why are you changing this assumption? <span className="text-negative">*</span>
              </label>
              <textarea
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
                rows={3}
                placeholder="Describe the rationale for this change..."
                value={saveNote}
                onChange={e => setSaveNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button
                disabled={!saveNote.trim()}
                onClick={confirmSave}
                className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Confirm & Save Version
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
