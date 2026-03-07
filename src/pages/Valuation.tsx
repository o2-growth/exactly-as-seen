import { useState, useEffect, useMemo, useRef } from 'react';
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS, Year, SCENARIO_MULTIPLIERS } from '@/lib/financialData';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

type ShareholderType = 'Founder' | 'Investor' | 'SOP C-Level' | 'SOP Team';

interface Shareholder {
  id: string;
  name: string;
  type: ShareholderType;
  ownershipPct: number; // drives shares
  entryDate: string;
}

const DONUT_COLORS = [
  'hsl(217 91% 60%)', 'hsl(160 84% 39%)', 'hsl(38 92% 50%)',
  'hsl(258 90% 66%)', 'hsl(0 84% 60%)', 'hsl(172 66% 50%)',
  'hsl(280 60% 55%)', 'hsl(30 80% 55%)',
];

const STORAGE_KEY = 'o2-cap-table';
const TOTAL_SHARES_KEY = 'o2-total-shares';

function loadCapTable(): Shareholder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // backward compat: convert old shares-based model to pct-based
      if (parsed.length > 0 && parsed[0].shares !== undefined && parsed[0].ownershipPct === undefined) {
        const total = parsed.reduce((s: number, sh: any) => s + (sh.shares || 0), 0);
        return parsed.map((sh: any) => ({
          id: sh.id,
          name: sh.name,
          type: sh.type,
          ownershipPct: total > 0 ? Math.round(((sh.shares / total) * 100) * 10) / 10 : 0,
          entryDate: sh.entryDate || '',
        }));
      }
      return parsed;
    }
  } catch {}
  return [
    { id: '1', name: 'Pedro Albite', type: 'Founder', ownershipPct: 70.0, entryDate: '2017-08' },
    { id: '2', name: 'Tiago Pisoni', type: 'Founder', ownershipPct: 30.0, entryDate: '2024-01' },
    { id: '3', name: 'Rafael Fleck', type: 'Investor', ownershipPct: 0.0, entryDate: '' },
  ];
}

function loadTotalShares(): number {
  try {
    const raw = localStorage.getItem(TOTAL_SHARES_KEY);
    if (raw) return Number(raw) || 1_000_000;
  } catch {}
  return 1_000_000;
}

function formatSharesInput(value: number): string {
  if (!value) return '';
  return value.toLocaleString('pt-BR');
}

export default function Valuation() {
  const { projections, assumptions, scenario } = useFinancialModel();
  const [shareholders, setShareholders] = useState<Shareholder[]>(loadCapTable);
  const [totalSharesPool, setTotalSharesPool] = useState(loadTotalShares);
  const [ebitdaMultiple, setEbitdaMultiple] = useState(10);
  const [arrMultiple, setArrMultiple] = useState(5);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [raiseValuation, setRaiseValuation] = useState(0);

  // Local editing states for free-typing (keyed by shareholder id)
  const [editingPct, setEditingPct] = useState<Record<string, string>>({});
  const [editingShares, setEditingShares] = useState<Record<string, string>>({});

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shareholders));
  }, [shareholders]);

  useEffect(() => {
    localStorage.setItem(TOTAL_SHARES_KEY, String(totalSharesPool));
  }, [totalSharesPool]);

  const getShares = (pct: number) => Math.round(totalSharesPool * pct / 100);
  const totalShares = totalSharesPool;

  const totalOwnership = shareholders.reduce((s, sh) => s + sh.ownershipPct, 0);
  const totalAllocatedShares = shareholders.reduce((s, sh) => s + getShares(sh.ownershipPct), 0);
  const ownershipExceeds = totalOwnership > 100;
  const sharesExceeds = totalAllocatedShares > totalSharesPool;
  const atLimit = ownershipExceeds || sharesExceeds;

  const addShareholder = () => {
    if (atLimit) return;
    setShareholders(prev => [...prev, { id: `sh-${Date.now()}`, name: '', type: 'Investor', ownershipPct: 0, entryDate: '' }]);
  };
  const removeShareholder = (id: string) => setShareholders(prev => prev.filter(s => s.id !== id));
  const updateShareholder = (id: string, field: keyof Shareholder, value: string | number) => {
    setShareholders(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // Handlers for % ownership input
  const handlePctFocus = (id: string, currentPct: number) => {
    setEditingPct(prev => ({ ...prev, [id]: currentPct ? currentPct.toFixed(2) : '' }));
  };
  const handlePctChange = (id: string, rawValue: string) => {
    // Allow digits, dot, comma
    const filtered = rawValue.replace(/[^0-9.,]/g, '');
    setEditingPct(prev => ({ ...prev, [id]: filtered }));
  };
  const handlePctBlur = (id: string) => {
    const raw = (editingPct[id] || '').replace(',', '.');
    const num = parseFloat(raw);
    const final = isNaN(num) ? 0 : Math.round(num * 100) / 100;
    updateShareholder(id, 'ownershipPct', final);
    setEditingPct(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  // Handlers for shares input
  const handleSharesFocus = (id: string, currentPct: number) => {
    const shares = getShares(currentPct);
    setEditingShares(prev => ({ ...prev, [id]: shares ? formatNumber(shares) : '' }));
  };
  const handleSharesChange = (id: string, rawValue: string) => {
    // Allow digits and dots (pt-BR thousand separator)
    const filtered = rawValue.replace(/[^0-9.]/g, '');
    setEditingShares(prev => ({ ...prev, [id]: filtered }));
  };
  const handleSharesBlur = (id: string) => {
    const raw = (editingShares[id] || '').replace(/\./g, '');
    const num = parseInt(raw, 10);
    if (isNaN(num)) {
      updateShareholder(id, 'ownershipPct', 0);
    } else {
      const clamped = Math.min(num, totalSharesPool);
      const pct = Math.round((clamped / totalSharesPool) * 10000) / 100;
      updateShareholder(id, 'ownershipPct', pct);
    }
    setEditingShares(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  // Donut data
  const donutData = shareholders.filter(s => s.ownershipPct > 0).map(s => ({
    name: s.name || 'Unnamed',
    value: getShares(s.ownershipPct),
    pct: s.ownershipPct.toFixed(2),
  }));

  // EBITDA valuation
  const ebitdaValuations = useMemo(() => YEARS.map(y => ({
    year: y,
    ebitda: projections.ebitda[y],
    valuation: projections.ebitda[y] * ebitdaMultiple,
  })), [projections, ebitdaMultiple]);

  // ARR valuation (MRR from sub-product clients × tickets)
  const arrValuations = useMemo(() => {
    const { subProductClients, tickets } = assumptions;
    return YEARS.map(y => {
      const mrr =
        (subProductClients.caasAssessoria[y] * tickets.caasAssessoria +
         subProductClients.caasEnterprise[y] * tickets.caasEnterprise +
         subProductClients.caasCorporate[y] * tickets.caasCorporate +
         subProductClients.saasOxy[y] * tickets.saasOxy +
         subProductClients.saasOxyGenio[y] * tickets.saasOxyGenio +
         subProductClients.educationDonoCFO[y] * tickets.educationDonoCFO +
         subProductClients.baas[y] * tickets.baas) / 1000; // R$ thousands
      const arr = mrr * 12;
      return { year: y, mrr, arr, valuation: arr * arrMultiple };
    });
  }, [assumptions, arrMultiple]);

  // Scenario cards
  const baseVal2025Ebitda = projections.ebitda[2025] * ebitdaMultiple;
  const scenarioCards = (baseVal: number) => [
    { label: 'Bear', value: baseVal * SCENARIO_MULTIPLIERS.BEAR, color: 'text-destructive' },
    { label: 'Base', value: baseVal * SCENARIO_MULTIPLIERS.BASE, color: 'text-foreground' },
    { label: 'Bull', value: baseVal * SCENARIO_MULTIPLIERS.BULL, color: 'text-accent' },
  ];

  // Dilution
  const dilutionPct = raiseValuation > 0 ? (raiseAmount / (raiseValuation + raiseAmount)) * 100 : 0;
  const postMoneyShares = totalShares > 0 && dilutionPct > 0
    ? Math.round(totalShares * (dilutionPct / 100) / (1 - dilutionPct / 100))
    : 0;

  // Trajectory chart data (3 scenario lines)
  const trajectoryData = (valuations: { year: Year; valuation: number }[]) =>
    valuations.map(v => ({
      year: v.year,
      Bear: Math.round(v.valuation * SCENARIO_MULTIPLIERS.BEAR),
      Base: Math.round(v.valuation),
      Bull: Math.round(v.valuation * SCENARIO_MULTIPLIERS.BULL),
    }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Valuation & Cap Table</h2>

      {/* Cap Table */}
      <div className="gradient-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Cap Table</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Total Shares:</span>
              <Input
                value={formatSharesInput(totalSharesPool)}
                onChange={e => {
                  const num = Number(e.target.value.replace(/\D/g, ''));
                  setTotalSharesPool(num || 0);
                }}
                className="h-8 w-36 text-xs text-right"
              />
            </div>
            <Button variant="outline" size="sm" onClick={addShareholder} className="gap-1.5" disabled={atLimit}>
              <Plus className="h-3.5 w-3.5" /> Add Shareholder
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 overflow-x-auto min-w-0">
            <table className="w-full text-sm table-auto">
              <thead>
                <tr className="bg-secondary border-b-2 border-primary/40">
                  <th className="text-center p-2 text-foreground font-semibold text-xs uppercase tracking-wider whitespace-nowrap min-w-[140px]">Shareholder</th>
                  <th className="text-center p-2 text-foreground font-semibold text-xs uppercase tracking-wider whitespace-nowrap min-w-[120px]">Type</th>
                  <th className="text-center p-2 text-foreground font-semibold text-xs uppercase tracking-wider whitespace-nowrap min-w-[110px]">% Ownership</th>
                  <th className="text-center p-2 text-foreground font-semibold text-xs uppercase tracking-wider whitespace-nowrap min-w-[100px]">Shares</th>
                   <th className="text-center p-2 text-foreground font-semibold text-xs uppercase tracking-wider whitespace-nowrap min-w-[100px]">Entry Date</th>
                  <th className="p-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {shareholders.map(s => (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="p-2"><Input value={s.name} onChange={e => updateShareholder(s.id, 'name', e.target.value)} className="h-8 text-xs" /></td>
                    <td className="p-2">
                      <select value={s.type} onChange={e => updateShareholder(s.id, 'type', e.target.value)} className="h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground w-full min-w-[100px]">
                        <option value="Founder">Founder</option>
                        <option value="Investor">Investor</option>
                        <option value="SOP C-Level">SOP C-Level</option>
                        <option value="SOP Team">SOP Team</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <div className="relative inline-flex items-center w-full justify-end">
                        <Input
                          value={editingPct[s.id] !== undefined ? editingPct[s.id] : (s.ownershipPct ? s.ownershipPct.toFixed(2) : '')}
                          onFocus={() => handlePctFocus(s.id, s.ownershipPct)}
                          onChange={e => handlePctChange(s.id, e.target.value)}
                          onBlur={() => handlePctBlur(s.id)}
                          className="h-8 text-xs text-right pr-6"
                          placeholder="0.00"
                        />
                        <span className="absolute right-2 text-xs text-muted-foreground pointer-events-none">%</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <Input
                        value={editingShares[s.id] !== undefined ? editingShares[s.id] : formatNumber(getShares(s.ownershipPct))}
                        onFocus={() => handleSharesFocus(s.id, s.ownershipPct)}
                        onChange={e => handleSharesChange(s.id, e.target.value)}
                        onBlur={() => handleSharesBlur(s.id)}
                        className="h-8 text-xs text-right tabular-nums"
                        placeholder="0"
                      />
                    </td>
                    <td className="p-2"><Input type="number" value={s.entryValuation || ''} onChange={e => updateShareholder(s.id, 'entryValuation', +e.target.value)} className="h-8 text-xs text-right" /></td>
                    <td className="p-2"><Input value={s.entryDate} onChange={e => updateShareholder(s.id, 'entryDate', e.target.value)} className="h-8 text-xs text-left" placeholder="YYYY-MM" /></td>
                    <td className="p-2"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeShareholder(s.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></td>
                  </tr>
                ))}
                <tr className={`font-semibold ${ownershipExceeds || sharesExceeds ? 'bg-destructive/20' : 'bg-secondary/30'}`}>
                  <td className="p-2 text-foreground">Total</td>
                  <td className="p-2"></td>
                  <td className={`p-2 text-right tabular-nums ${ownershipExceeds ? 'text-destructive' : 'text-foreground'}`}>{totalOwnership.toFixed(2)}%</td>
                  <td className={`p-2 text-right tabular-nums ${sharesExceeds ? 'text-destructive' : 'text-foreground'}`}>{formatNumber(totalAllocatedShares)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tbody>
            </table>

            {ownershipExceeds && (
              <div className="mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                <p className="font-semibold">Total ownership is {totalOwnership.toFixed(2)}% — exceeds by {(totalOwnership - 100).toFixed(2)}%</p>
                <p className="text-xs mt-1 text-destructive/80">You need to redistribute or remove ownership from an existing shareholder.</p>
              </div>
            )}

            {sharesExceeds && (
              <div className="mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                <p className="font-semibold">Total allocated: {formatNumber(totalAllocatedShares)} shares — exceeds by {formatNumber(totalAllocatedShares - totalSharesPool)}</p>
                <p className="text-xs mt-1 text-destructive/80">You need to redistribute or remove shares from an existing shareholder.</p>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 12 }} formatter={(value: number) => formatNumber(value)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Valuation Scenarios */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Valuation Scenarios</h3>
        <Tabs defaultValue="ebitda">
          <TabsList className="mb-4">
            <TabsTrigger value="ebitda">EBITDA Multiple</TabsTrigger>
            <TabsTrigger value="arr">ARR Multiple</TabsTrigger>
          </TabsList>

          <TabsContent value="ebitda">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-muted-foreground">EBITDA Multiple:</span>
              <Input type="number" value={ebitdaMultiple} onChange={e => setEbitdaMultiple(+e.target.value)} className="h-8 w-20 text-xs text-right" />
              <span className="text-xs text-muted-foreground">x</span>
            </div>

            {/* Scenario cards */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {scenarioCards(baseVal2025Ebitda).map(c => (
                <div key={c.label} className="kpi-card text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">{c.label}</p>
                  <p className={`text-lg font-bold ${c.color}`}>{formatCurrency(c.value)}</p>
                </div>
              ))}
            </div>

            {totalShares > 0 && (
              <p className="text-xs text-muted-foreground mb-4">
                Implied per share: <span className="text-foreground font-medium">{formatCurrency(baseVal2025Ebitda / totalShares * 1000)}</span>
              </p>
            )}

            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 text-muted-foreground font-medium">Year</th>
                    <th className="text-right p-2 text-muted-foreground font-medium">EBITDA</th>
                    <th className="text-right p-2 text-muted-foreground font-medium">Valuation</th>
                  </tr>
                </thead>
                <tbody>
                  {ebitdaValuations.map(v => (
                    <tr key={v.year} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="p-2 text-foreground">{v.year}</td>
                      <td className="p-2 text-right tabular-nums text-foreground">{formatCurrency(v.ebitda)}</td>
                      <td className="p-2 text-right tabular-nums font-medium text-primary">{formatCurrency(v.valuation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trajectoryData(ebitdaValuations)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
                <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={13} />
                <YAxis stroke="hsl(215 20% 55%)" fontSize={13} tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}M`} />
                <Tooltip contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="Bear" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Base" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Bull" stroke="hsl(160 84% 39%)" strokeWidth={2} dot={false} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>

          <TabsContent value="arr">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-muted-foreground">ARR Multiple:</span>
              <Input type="number" value={arrMultiple} onChange={e => setArrMultiple(+e.target.value)} className="h-8 w-20 text-xs text-right" />
              <span className="text-xs text-muted-foreground">x</span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              {scenarioCards(arrValuations[0]?.valuation || 0).map(c => (
                <div key={c.label} className="kpi-card text-center">
                  <p className="text-[10px] text-muted-foreground mb-1">{c.label}</p>
                  <p className={`text-lg font-bold ${c.color}`}>{formatCurrency(c.value)}</p>
                </div>
              ))}
            </div>

            {totalShares > 0 && arrValuations[0] && (
              <p className="text-xs text-muted-foreground mb-4">
                Implied per share: <span className="text-foreground font-medium">{formatCurrency((arrValuations[0].valuation / totalShares) * 1000)}</span>
              </p>
            )}

            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 text-muted-foreground font-medium">Year</th>
                    <th className="text-right p-2 text-muted-foreground font-medium">MRR</th>
                    <th className="text-right p-2 text-muted-foreground font-medium">ARR</th>
                    <th className="text-right p-2 text-muted-foreground font-medium">Valuation</th>
                  </tr>
                </thead>
                <tbody>
                  {arrValuations.map(v => (
                    <tr key={v.year} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="p-2 text-foreground">{v.year}</td>
                      <td className="p-2 text-right tabular-nums text-foreground">{formatCurrency(v.mrr)}</td>
                      <td className="p-2 text-right tabular-nums text-foreground">{formatCurrency(v.arr)}</td>
                      <td className="p-2 text-right tabular-nums font-medium text-primary">{formatCurrency(v.valuation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trajectoryData(arrValuations)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
                <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={13} />
                <YAxis stroke="hsl(215 20% 55%)" fontSize={13} tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}M`} />
                <Tooltip contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="Bear" stroke="hsl(0 84% 60%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Base" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Bull" stroke="hsl(160 84% 39%)" strokeWidth={2} dot={false} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </LineChart>
            </ResponsiveContainer>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dilution Calculator */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Dilution Calculator</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Raise Amount (R$)</label>
            <Input type="number" value={raiseAmount || ''} onChange={e => setRaiseAmount(+e.target.value)} className="h-9 text-sm" placeholder="e.g. 5000000" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Pre-Money Valuation (R$)</label>
            <Input type="number" value={raiseValuation || ''} onChange={e => setRaiseValuation(+e.target.value)} className="h-9 text-sm" placeholder="e.g. 20000000" />
          </div>
        </div>

        {raiseAmount > 0 && raiseValuation > 0 && (
          <div className="space-y-4">
            <div className="kpi-card text-center">
              <p className="text-xs text-muted-foreground mb-1">Equity Given Up</p>
              <p className="text-3xl font-bold text-destructive">{dilutionPct.toFixed(1)}%</p>
              <p className="text-[10px] text-muted-foreground mt-1">Post-money: {formatCurrency(raiseValuation + raiseAmount)}</p>
            </div>

            <h4 className="text-xs font-semibold text-muted-foreground mt-4">Post-Money Cap Table</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 text-muted-foreground font-medium">Shareholder</th>
                    <th className="text-right p-2 text-muted-foreground font-medium">Shares</th>
                    <th className="text-right p-2 text-muted-foreground font-medium">% Ownership</th>
                  </tr>
                </thead>
                <tbody>
                  {shareholders.map(s => {
                    const shares = getShares(s.ownershipPct);
                    const newTotal = totalShares + postMoneyShares;
                    const pct = newTotal > 0 ? ((shares / newTotal) * 100).toFixed(1) : '0';
                    return (
                      <tr key={s.id} className="border-b border-border/50">
                        <td className="p-2 text-foreground">{s.name || 'Unnamed'}</td>
                        <td className="p-2 text-right tabular-nums text-foreground">{formatNumber(shares)}</td>
                        <td className="p-2 text-right tabular-nums text-foreground">{pct}%</td>
                      </tr>
                    );
                  })}
                  <tr className="border-b border-border/50 bg-primary/10">
                    <td className="p-2 font-medium text-primary">New Investor</td>
                    <td className="p-2 text-right tabular-nums text-primary">{formatNumber(postMoneyShares)}</td>
                    <td className="p-2 text-right tabular-nums text-primary">{dilutionPct.toFixed(1)}%</td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="p-2 text-foreground">Total</td>
                    <td className="p-2 text-right tabular-nums text-foreground">{formatNumber(totalShares + postMoneyShares)}</td>
                    <td className="p-2 text-right text-foreground">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
