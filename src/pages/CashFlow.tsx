import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, ComposedChart, Line,
} from 'recharts';
import { useOxyCashFlow, OxyCashFlowData } from '@/hooks/useOxyCashFlow';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatBrl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function monthLabel(period: string): string {
  const parts = period.split('-');
  const m = parseInt(parts[1]) - 1;
  return `${MONTH_LABELS[m]}/${parts[0].slice(2)}`;
}

// ─── Monthly expandable row ───────────────────────────────────────────────────

interface MonthlyCashFlowRow {
  code: string;
  label: string;
  isSummary?: boolean;
  values: Record<string, number>;
  children?: MonthlyCashFlowRow[];
}

function MonthlyExpandableRow({ row, depth, periods }: { row: MonthlyCashFlowRow; depth: number; periods: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = row.children && row.children.length > 0;
  const total = periods.reduce((s, p) => s + (row.values[p] ?? 0), 0);

  return (
    <>
      <tr className={`border-b border-border/30 transition-colors ${row.isSummary ? 'bg-primary/5 font-bold' : 'hover:bg-secondary/20'}`}>
        <td
          className="p-3 whitespace-nowrap cursor-pointer select-none sticky left-0 bg-card"
          style={{ paddingLeft: `${12 + depth * 20}px` }}
          onClick={() => hasChildren && setExpanded(!expanded)}
        >
          <div className="flex items-center gap-1.5">
            {hasChildren ? (
              expanded ? (
                <svg className="h-3.5 w-3.5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              ) : (
                <svg className="h-3.5 w-3.5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
              )
            ) : <span className="w-3.5" />}
            <span className={`text-sm ${row.isSummary ? 'text-foreground' : 'text-foreground/90'}`}>{row.label}</span>
          </div>
        </td>
        {periods.map(p => {
          const val = row.values[p] ?? 0;
          return (
            <td key={p} className="text-right p-3 tabular-nums text-sm">
              <span className={val < 0 ? 'text-negative' : ''}>{val === 0 ? '—' : formatBrl(val)}</span>
            </td>
          );
        })}
        <td className="text-right p-3 tabular-nums text-sm font-semibold">
          <span className={total < 0 ? 'text-negative' : ''}>{total === 0 ? '—' : formatBrl(total)}</span>
        </td>
      </tr>
      {expanded && row.children?.map(child => (
        <MonthlyExpandableRow key={child.code} row={child} depth={depth + 1} periods={periods} />
      ))}
    </>
  );
}

// ─── Build tree from Oxy data ─────────────────────────────────────────────────

function buildCashFlowTreeFromOxy(data: OxyCashFlowData) {
  const periods = data.periods;

  const inflowChildren: MonthlyCashFlowRow[] = data.recebido.map((item, idx) => ({
    code: `IR.${idx}`,
    label: item.label,
    values: Object.fromEntries(item.data.map(d => [d.period, d.value])),
  }));

  const outflowChildren: MonthlyCashFlowRow[] = data.pago.map((item, idx) => ({
    code: `OP.${idx}`,
    label: item.label,
    values: Object.fromEntries(item.data.map(d => [d.period, -Math.abs(d.value)])),
  }));

  const inflowValues: Record<string, number> = {};
  const outflowValues: Record<string, number> = {};
  data.chart.forEach(item => {
    inflowValues[item.month] = item.entradas;
    outflowValues[item.month] = -Math.abs(item.saidas);
  });

  const tree: MonthlyCashFlowRow[] = [
    { code: 'INFLOWS', label: 'Total Entradas', isSummary: true, values: inflowValues, children: inflowChildren },
    { code: 'OUTFLOWS', label: 'Total Saídas', isSummary: true, values: outflowValues, children: outflowChildren },
  ];

  let opening = 0;
  const balances = periods.map(p => {
    const inflow = inflowValues[p] ?? 0;
    const outflow = outflowValues[p] ?? 0;
    const closing = opening + inflow + outflow;
    const row = { period: p, opening, closing };
    opening = closing;
    return row;
  });

  return { tree, balances };
}

// ─── Banking view component ──────────────────────────────────────────────────

function OxyBankingView({ historicalStart, historicalEnd, projectionStart, projectionEnd }: { historicalStart: string; historicalEnd: string; projectionStart: string; projectionEnd: string }) {
  const { data, loading, error } = useOxyCashFlow(historicalStart, historicalEnd, true);
  const { data: projData, loading: projLoading } = useOxyCashFlow(projectionStart, projectionEnd, true);
  const [detailView, setDetailView] = useState<'recebido' | 'pago'>('recebido');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando dados bancários...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gradient-card p-6 text-center">
        <p className="text-sm text-destructive">Erro ao carregar dados bancários: {error}</p>
      </div>
    );
  }

  if (!data) return null;

  const projSource = projData || data;
  const { tree: oxyTree, balances: oxyBalances } = buildCashFlowTreeFromOxy(projSource);

  const waterfallMonthly = data.chart.map(item => ({
    month: monthLabel(item.month),
    Entradas: item.entradas,
    'Saídas': -Math.abs(item.saidas),
    'Saldo Líquido': item.saldo,
  }));

  const chartData = data.chart.map(item => ({
    month: monthLabel(item.month),
    Entradas: item.entradas,
    Saídas: item.saidas,
    Saldo: item.saldo,
  }));

  const totalEntradas = data.chart.reduce((s, i) => s + i.entradas, 0);
  const totalSaidas = data.chart.reduce((s, i) => s + i.saidas, 0);
  const saldoTotal = totalEntradas - totalSaidas;

  const details = detailView === 'recebido' ? data.recebido : data.pago;
  const sortedDetails = [...details].sort((a, b) => {
    const totalA = a.data.reduce((s, d) => s + d.value, 0);
    const totalB = b.data.reduce((s, d) => s + d.value, 0);
    return totalB - totalA;
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="gradient-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Total Entradas</p>
          <p className="text-xl font-bold text-primary mt-1">{formatBrl(totalEntradas)}</p>
        </div>
        <div className="gradient-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Total Saídas</p>
          <p className="text-xl font-bold text-destructive mt-1">{formatBrl(totalSaidas)}</p>
        </div>
        <div className="gradient-card p-5">
          <p className="text-xs text-muted-foreground font-medium">Saldo Líquido</p>
          <p className={`text-xl font-bold mt-1 ${saldoTotal >= 0 ? 'text-primary' : 'text-destructive'}`}>
            {formatBrl(saldoTotal)}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold mb-4">Fluxo de Caixa Mensal — Dados Bancários (R$)</h3>
        <ResponsiveContainer width="100%" height={240} className="md:!h-[320px]">
          <ComposedChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}
              formatter={(v: number, name: string) => [formatBrl(v), name]}
            />
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
            <Bar dataKey="Entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="Saldo" stroke="hsl(var(--ring))" strokeWidth={2} dot={{ r: 3 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Projection Table */}
      <div className="gradient-card overflow-x-auto">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <h3 className="text-sm font-semibold">Projeção de Caixa — Visão Expandível</h3>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 tracking-wide">Bancário</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-2 md:p-3 text-muted-foreground font-medium min-w-[160px] md:min-w-[240px] sticky left-0 bg-card">Descrição</th>
              {data.periods.map(p => (
                <th key={p} className="text-right p-2 md:p-3 text-muted-foreground font-medium min-w-[80px] md:min-w-[100px]">
                  <div className="flex flex-col items-end gap-0.5">
                    <span>{monthLabel(p)}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 tracking-wide">Bancário</span>
                  </div>
                </th>
              ))}
              <th className="text-right p-3 text-muted-foreground font-bold min-w-[110px]">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/30 bg-primary/5 font-bold">
              <td className="p-3 sticky left-0 bg-card text-sm">Saldo Inicial</td>
              {oxyBalances.map(b => (
                <td key={b.period} className="text-right p-3 tabular-nums text-sm">
                  {b.opening === 0 ? '—' : formatBrl(b.opening)}
                </td>
              ))}
              <td className="text-right p-3 tabular-nums text-sm">—</td>
            </tr>
            {oxyTree.map(row => (
              <MonthlyExpandableRow key={row.code} row={row} depth={0} periods={data.periods} />
            ))}
            <tr className="border-b border-border bg-primary/10 font-bold">
              <td className="p-3 sticky left-0 bg-card text-sm text-foreground">Saldo Final</td>
              {oxyBalances.map(b => (
                <td key={b.period} className={`text-right p-3 tabular-nums text-sm ${b.closing < 0 ? 'text-negative' : 'text-positive'}`}>
                  {formatBrl(b.closing)}
                </td>
              ))}
              <td className="text-right p-3 tabular-nums text-sm font-bold">
                {formatBrl(oxyBalances[oxyBalances.length - 1]?.closing ?? 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Waterfall Chart */}
      {waterfallMonthly.length > 0 && (
        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold mb-4">Fluxo de Caixa Mensal — Cascata (R$)</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={waterfallMonthly} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 700 }}
                formatter={(v: number, name: string) => [formatBrl(v), name]}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Bar dataKey="Entradas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saldo Líquido" fill="hsl(var(--ring))" radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detail Table */}
      <div className="gradient-card overflow-x-auto">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <h3 className="text-sm font-semibold mr-4">Detalhamento por Contraparte</h3>
          <div className="flex items-center bg-secondary rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setDetailView('recebido')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                detailView === 'recebido' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Recebido ({data.recebido.length})
            </button>
            <button
              onClick={() => setDetailView('pago')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 ${
                detailView === 'pago' ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Pago ({data.pago.length})
            </button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-muted-foreground font-medium min-w-[240px] sticky left-0 bg-card">Contraparte</th>
              {data.periods.map(p => (
                <th key={p} className="text-right p-3 text-muted-foreground font-medium min-w-[100px]">{monthLabel(p)}</th>
              ))}
              <th className="text-right p-3 text-muted-foreground font-bold min-w-[110px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {sortedDetails.slice(0, 30).map((item, idx) => {
              const total = item.data.reduce((s, d) => s + d.value, 0);
              return (
                <tr key={idx} className="border-b border-border/30 hover:bg-secondary/20">
                  <td className="p-3 text-sm whitespace-nowrap sticky left-0 bg-card truncate max-w-[240px]" title={item.label}>{item.label}</td>
                  {data.periods.map(p => {
                    const found = item.data.find(d => d.period === p);
                    const val = found?.value ?? 0;
                    return (
                      <td key={p} className="text-right p-3 tabular-nums text-sm">{val === 0 ? '—' : formatBrl(val)}</td>
                    );
                  })}
                  <td className="text-right p-3 tabular-nums text-sm font-semibold">{formatBrl(total)}</td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-border bg-primary/5 font-bold">
              <td className="p-3 text-sm sticky left-0 bg-card">Total</td>
              {data.periods.map(p => {
                const periodTotal = sortedDetails.reduce((s, item) => {
                  const found = item.data.find(d => d.period === p);
                  return s + (found?.value ?? 0);
                }, 0);
                return <td key={p} className="text-right p-3 tabular-nums text-sm">{formatBrl(periodTotal)}</td>;
              })}
              <td className="text-right p-3 tabular-nums text-sm font-bold">
                {formatBrl(sortedDetails.reduce((s, item) => s + item.data.reduce((ss, d) => ss + d.value, 0), 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Valores em R$ · Fonte: Dados Bancários (Oxy Finance) · Período: {historicalStart} a {historicalEnd} (histórico) / {projectionStart} a {projectionEnd} (projeção)
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CashFlow() {
  const now = new Date();
  const histStart = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  const historicalStart = `${histStart.getFullYear()}-${String(histStart.getMonth() + 1).padStart(2, '0')}-01`;
  const histEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const historicalEnd = `${histEndDate.getFullYear()}-${String(histEndDate.getMonth() + 1).padStart(2, '0')}-${String(histEndDate.getDate()).padStart(2, '0')}`;
  const projStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const projEndDate = new Date(now.getFullYear(), now.getMonth() + 12, 0);
  const projectionEnd = `${projEndDate.getFullYear()}-${String(projEndDate.getMonth() + 1).padStart(2, '0')}-${String(projEndDate.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      <h2 className="text-xl md:text-2xl font-bold text-primary">Fluxo de Caixa</h2>
      <OxyBankingView
        historicalStart={historicalStart}
        historicalEnd={historicalEnd}
        projectionStart={projStart}
        projectionEnd={projectionEnd}
      />
    </div>
  );
}
