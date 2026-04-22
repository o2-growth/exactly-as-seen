import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS, Year } from '@/lib/financialData';
import { PnlNode } from '@/lib/pnlData';
import { formatCurrency } from '@/lib/formatters';
import { Info, TrendingDown, TrendingUp, Timer, Wallet } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, BarChart, Bar, ReferenceLine,
} from 'recharts';
import { DataSourceBadge } from '@/components/period/DataSourceBadge';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findNode(code: string, nodes: PnlNode[]): PnlNode | undefined {
  for (const n of nodes) {
    if (n.code === code) return n;
    if (n.children) { const f = findNode(code, n.children); if (f) return f; }
  }
  return undefined;
}

function tv(code: string, y: Year, tree: PnlNode[]): number {
  return findNode(code, tree)?.annual[y] ?? 0;
}

interface PmpConfig {
  impostos: number;
  custos: number;
  despesas: number;
  irpjCsll: number;
}

function getPmpConfig(assumptions: any): PmpConfig {
  return assumptions.pmpConfig ?? { impostos: 30, custos: 30, despesas: 30, irpjCsll: 30 };
}

// ─── Finance Cycle Calculations ───────────────────────────────────────────────

interface CycleMetrics {
  year: Year;
  // Revenue & costs
  grossRevenue: number;
  totalCogs: number;
  totalOpex: number;
  // Balances
  receivablesBalance: number;
  payablesBalance: number;
  workingCapital: number;
  // Days
  dso: number;   // Days Sales Outstanding (weighted PMR)
  dpo: number;   // Days Payable Outstanding
  ccc: number;   // Cash Conversion Cycle = DSO - DPO
  // Cash impact
  receivablesChange: number;
  payablesChange: number;
  netWorkingCapitalChange: number;
}

function computeCycleMetrics(
  tree: PnlNode[],
  model: any,
  pmrConfig: { caas: number; saas: number; education: number; baas: number },
  pmpConfig: PmpConfig,
): CycleMetrics[] {
  const metrics: CycleMetrics[] = [];
  let prevReceivables = 0;
  let prevPayables = 0;

  for (const y of YEARS) {
    const yr = model.years[y];

    // Revenue from tree (includes historical for 2025)
    const grossRevenue = Math.abs(tv('1', y, tree));

    // Revenue by BU for weighted PMR
    const caasRev = Math.abs(tv('1.1', y, tree));
    const saasRev = Math.abs(tv('1.2', y, tree));
    const eduRev = Math.abs(tv('1.3', y, tree));
    const expRev = Math.abs(tv('1.5', y, tree));
    const taxRev = Math.abs(tv('1.6', y, tree));

    // Weighted PMR (DSO)
    const totalRevForPmr = caasRev + saasRev + eduRev + expRev + taxRev;
    const weightedPmr = totalRevForPmr > 0
      ? (caasRev * pmrConfig.caas + saasRev * pmrConfig.saas + eduRev * pmrConfig.education + (expRev + taxRev) * pmrConfig.baas) / totalRevForPmr
      : 0;
    const dso = Math.round(weightedPmr * 10) / 10;

    // Costs & expenses from tree
    const totalCogs = Math.abs(
      tv('3.1', y, tree) + tv('3.2', y, tree) + tv('3.3', y, tree) +
      tv('3.4', y, tree) + tv('3.5', y, tree) + tv('3.6', y, tree)
    );
    const totalOpex = Math.abs(tv('4', y, tree) + tv('5', y, tree) + tv('6', y, tree) + tv('7', y, tree));
    const totalOutflows = totalCogs + totalOpex;

    // Weighted PMP (DPO)
    const cogsWeight = totalOutflows > 0 ? totalCogs / totalOutflows : 0.5;
    const opexWeight = totalOutflows > 0 ? totalOpex / totalOutflows : 0.5;
    const weightedPmp = cogsWeight * pmpConfig.custos + opexWeight * pmpConfig.despesas;
    const dpo = Math.round(weightedPmp * 10) / 10;

    // Balances
    const receivablesBalance = grossRevenue * (dso / 365);
    const payablesBalance = totalOutflows * (dpo / 365);
    const workingCapital = receivablesBalance - payablesBalance;

    // Changes
    const receivablesChange = -(receivablesBalance - prevReceivables);
    const payablesChange = payablesBalance - prevPayables;
    const netWorkingCapitalChange = receivablesChange + payablesChange;

    // CCC
    const ccc = Math.round((dso - dpo) * 10) / 10;

    metrics.push({
      year: y,
      grossRevenue, totalCogs, totalOpex,
      receivablesBalance, payablesBalance, workingCapital,
      dso, dpo, ccc,
      receivablesChange, payablesChange, netWorkingCapitalChange,
    });

    prevReceivables = receivablesBalance;
    prevPayables = payablesBalance;
  }

  return metrics;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, unit, subtitle, icon: Icon, color }: {
  label: string; value: string; unit?: string; subtitle?: string;
  icon: any; color: string;
}) {
  return (
    <div className="gradient-card p-5 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${color}`}>{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinanceCycle() {
  const { model, pnlTree, assumptions, filteredYears } = useFinancialModel();

  const activeYears: Year[] = filteredYears.length > 0 ? filteredYears : [...YEARS];
  const pmrConfig = assumptions.pmrConfig;
  const pmpConfig = getPmpConfig(assumptions);

  const metrics = computeCycleMetrics(pnlTree, model, pmrConfig, pmpConfig);
  const activeMetrics = metrics.filter(m => activeYears.includes(m.year));

  // Latest year for KPI cards
  const latest = activeMetrics[activeMetrics.length - 1];
  const prev = activeMetrics.length > 1 ? activeMetrics[activeMetrics.length - 2] : null;

  // Chart data
  const daysChartData = activeMetrics.map(m => ({
    year: m.year.toString(),
    DSO: m.dso,
    DPO: m.dpo,
    'Ciclo de Caixa': m.ccc,
  }));

  const balanceChartData = activeMetrics.map(m => ({
    year: m.year.toString(),
    'Contas a Receber': m.receivablesBalance,
    'Contas a Pagar': -m.payablesBalance,
    'Capital de Giro': m.workingCapital,
  }));

  const formatAxis = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1000) return `R$${(v / 1000).toFixed(0)}M`;
    return `R$${v.toFixed(0)}k`;
  };

  if (!latest) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-primary">Finance Cycle</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Ciclo financeiro: DSO (prazo de recebimento), DPO (prazo de pagamento) e ciclo de conversão de caixa.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="DSO — Prazo de Recebimento"
          value={latest.dso.toFixed(1)}
          unit="dias"
          subtitle={prev ? `${prev.dso.toFixed(1)}d em ${prev.year}` : undefined}
          icon={Timer}
          color="text-blue-400"
        />
        <KpiCard
          label="DPO — Prazo de Pagamento"
          value={latest.dpo.toFixed(1)}
          unit="dias"
          subtitle={prev ? `${prev.dpo.toFixed(1)}d em ${prev.year}` : undefined}
          icon={Timer}
          color="text-amber-400"
        />
        <KpiCard
          label="Ciclo de Caixa (CCC)"
          value={latest.ccc.toFixed(1)}
          unit="dias"
          subtitle={latest.ccc > 0 ? 'Paga antes de receber' : 'Recebe antes de pagar'}
          icon={latest.ccc > 0 ? TrendingDown : TrendingUp}
          color={latest.ccc > 0 ? 'text-negative' : 'text-positive'}
        />
        <KpiCard
          label="Capital de Giro"
          value={formatCurrency(latest.workingCapital * 1000)}
          subtitle={`Recebíveis ${formatCurrency(latest.receivablesBalance * 1000)} − Payables ${formatCurrency(latest.payablesBalance * 1000)}`}
          icon={Wallet}
          color={latest.workingCapital > 0 ? 'text-positive' : 'text-negative'}
        />
      </div>

      {/* DSO / DPO / CCC Chart */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold mb-4">DSO vs DPO vs Ciclo de Caixa (dias)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={daysChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22% / 0.5)" />
            <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={13} />
            <YAxis stroke="hsl(215 20% 55%)" fontSize={13} unit="d" />
            <Tooltip
              contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 13 }}
              labelStyle={{ color: 'hsl(210 40% 98%)', fontWeight: 700 }}
              formatter={(v: number) => [`${v.toFixed(1)} dias`]}
            />
            <ReferenceLine y={0} stroke="hsl(215 20% 55%)" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="DSO" stroke="hsl(221 83% 53%)" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="DPO" stroke="hsl(45 93% 47%)" strokeWidth={2} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="Ciclo de Caixa" stroke="hsl(0 72% 51%)" strokeWidth={2.5} dot={{ r: 5 }} strokeDasharray="5 5" />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Receivables vs Payables Chart */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold mb-4">Contas a Receber vs Contas a Pagar (R$ mil)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={balanceChartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22% / 0.5)" />
            <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={13} />
            <YAxis stroke="hsl(215 20% 55%)" fontSize={13} tickFormatter={formatAxis} />
            <Tooltip
              contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 13 }}
              labelStyle={{ color: 'hsl(210 40% 98%)', fontWeight: 700 }}
              formatter={(v: number, name: string) => [formatCurrency(Math.abs(v) * 1000), name]}
            />
            <ReferenceLine y={0} stroke="hsl(215 20% 55%)" strokeDasharray="3 3" />
            <Bar dataKey="Contas a Receber" fill="hsl(221 83% 53%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Contas a Pagar" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Capital de Giro" fill="hsl(166 72% 28%)" radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed Table */}
      <div className="gradient-card overflow-x-auto">
        <div className="p-5 pb-3">
          <h3 className="text-sm font-semibold">Detalhamento por Ano</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2 text-muted-foreground font-medium min-w-[220px]">Indicador</th>
              {activeMetrics.map(m => (
                <th key={m.year} className="text-right px-4 py-2 text-muted-foreground font-medium min-w-[120px]">{m.year}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Revenue */}
            <tr className="border-b border-border/30 bg-secondary/10">
              <td className="px-4 py-2 font-semibold text-muted-foreground" colSpan={activeMetrics.length + 1}>Receita & Custos (base)</td>
            </tr>
            <tr className="border-b border-border/20">
              <td className="px-4 py-1.5">Receita Bruta</td>
              {activeMetrics.map(m => <td key={m.year} className="text-right px-4 py-1.5 tabular-nums">{formatCurrency(m.grossRevenue * 1000)}</td>)}
            </tr>
            <tr className="border-b border-border/20">
              <td className="px-4 py-1.5">Total COGS</td>
              {activeMetrics.map(m => <td key={m.year} className="text-right px-4 py-1.5 tabular-nums text-negative">{formatCurrency(-m.totalCogs * 1000)}</td>)}
            </tr>
            <tr className="border-b border-border/20">
              <td className="px-4 py-1.5">Total OPEX</td>
              {activeMetrics.map(m => <td key={m.year} className="text-right px-4 py-1.5 tabular-nums text-negative">{formatCurrency(-m.totalOpex * 1000)}</td>)}
            </tr>

            {/* Days */}
            <tr className="border-b border-border/30 bg-secondary/10">
              <td className="px-4 py-2 font-semibold text-muted-foreground" colSpan={activeMetrics.length + 1}>Prazos (dias)</td>
            </tr>
            <tr className="border-b border-border/20">
              <td className="px-4 py-1.5">DSO (Prazo Médio de Recebimento)</td>
              {activeMetrics.map(m => <td key={m.year} className="text-right px-4 py-1.5 tabular-nums">{m.dso.toFixed(1)}d</td>)}
            </tr>
            <tr className="border-b border-border/20">
              <td className="px-4 py-1.5">DPO (Prazo Médio de Pagamento)</td>
              {activeMetrics.map(m => <td key={m.year} className="text-right px-4 py-1.5 tabular-nums">{m.dpo.toFixed(1)}d</td>)}
            </tr>
            <tr className="border-b border-border/20 font-semibold">
              <td className="px-4 py-1.5">CCC (Ciclo de Conversão de Caixa)</td>
              {activeMetrics.map(m => (
                <td key={m.year} className={`text-right px-4 py-1.5 tabular-nums ${m.ccc > 0 ? 'text-negative' : 'text-positive'}`}>
                  {m.ccc.toFixed(1)}d
                </td>
              ))}
            </tr>

            {/* Balances */}
            <tr className="border-b border-border/30 bg-secondary/10">
              <td className="px-4 py-2 font-semibold text-muted-foreground" colSpan={activeMetrics.length + 1}>Saldos (R$ mil)</td>
            </tr>
            <tr className="border-b border-border/20">
              <td className="px-4 py-1.5">Contas a Receber (AR)</td>
              {activeMetrics.map(m => <td key={m.year} className="text-right px-4 py-1.5 tabular-nums">{formatCurrency(m.receivablesBalance * 1000)}</td>)}
            </tr>
            <tr className="border-b border-border/20">
              <td className="px-4 py-1.5">Contas a Pagar (AP)</td>
              {activeMetrics.map(m => <td key={m.year} className="text-right px-4 py-1.5 tabular-nums">{formatCurrency(m.payablesBalance * 1000)}</td>)}
            </tr>
            <tr className="border-b border-border/20 font-semibold">
              <td className="px-4 py-1.5">Capital de Giro (AR − AP)</td>
              {activeMetrics.map(m => (
                <td key={m.year} className={`text-right px-4 py-1.5 tabular-nums ${m.workingCapital > 0 ? 'text-positive' : 'text-negative'}`}>
                  {formatCurrency(m.workingCapital * 1000)}
                </td>
              ))}
            </tr>

            {/* Changes */}
            <tr className="border-b border-border/30 bg-secondary/10">
              <td className="px-4 py-2 font-semibold text-muted-foreground" colSpan={activeMetrics.length + 1}>Variação no Período (impacto caixa)</td>
            </tr>
            <tr className="border-b border-border/20">
              <td className="px-4 py-1.5">Variação Recebíveis</td>
              {activeMetrics.map(m => (
                <td key={m.year} className={`text-right px-4 py-1.5 tabular-nums ${m.receivablesChange < 0 ? 'text-negative' : 'text-positive'}`}>
                  {formatCurrency(m.receivablesChange * 1000)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border/20">
              <td className="px-4 py-1.5">Variação Payables</td>
              {activeMetrics.map(m => (
                <td key={m.year} className={`text-right px-4 py-1.5 tabular-nums ${m.payablesChange > 0 ? 'text-positive' : 'text-negative'}`}>
                  {formatCurrency(m.payablesChange * 1000)}
                </td>
              ))}
            </tr>
            <tr className="border-b border-border font-semibold">
              <td className="px-4 py-1.5">Impacto Líquido no Caixa</td>
              {activeMetrics.map(m => (
                <td key={m.year} className={`text-right px-4 py-1.5 tabular-nums ${m.netWorkingCapitalChange > 0 ? 'text-positive' : 'text-negative'}`}>
                  {formatCurrency(m.netWorkingCapitalChange * 1000)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* ─── Aging de Recebíveis ─── */}
      <div className="gradient-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">Aging de Recebíveis — Projeção por Faixa</h3>
        <p className="text-[10px] text-muted-foreground">Distribuição estimada dos recebíveis por faixa de vencimento, baseada no DSO ponderado.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 text-muted-foreground font-medium min-w-[180px]">Faixa</th>
                {activeMetrics.map(m => (
                  <th key={m.year} className="text-right px-4 py-2 text-muted-foreground font-medium min-w-[120px]">{m.year}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Aging distribution based on DSO:
                // If DSO <= 15: 90% current, 10% 1-30d
                // If DSO 15-30: 70% current, 25% 1-30d, 5% 31-60d
                // If DSO 30-60: 50% current, 30% 1-30d, 15% 31-60d, 5% 61-90d
                // If DSO > 60: 40% current, 25% 1-30d, 20% 31-60d, 10% 61-90d, 5% 90d+
                const buckets = ['A vencer (current)', '1-30 dias', '31-60 dias', '61-90 dias', '90+ dias'];
                const getDistribution = (dso: number): number[] => {
                  if (dso <= 15) return [0.90, 0.10, 0, 0, 0];
                  if (dso <= 30) return [0.70, 0.25, 0.05, 0, 0];
                  if (dso <= 60) return [0.50, 0.30, 0.15, 0.05, 0];
                  return [0.40, 0.25, 0.20, 0.10, 0.05];
                };

                const colors = ['text-positive', 'text-foreground', 'text-amber-400', 'text-orange-400', 'text-negative'];

                return buckets.map((bucket, i) => (
                  <tr key={bucket} className="border-b border-border/20">
                    <td className={`px-4 py-1.5 ${colors[i]}`}>{bucket}</td>
                    {activeMetrics.map(m => {
                      const dist = getDistribution(m.dso);
                      const val = m.receivablesBalance * dist[i];
                      return (
                        <td key={m.year} className={`text-right px-4 py-1.5 tabular-nums ${colors[i]}`}>
                          {val < 0.5 ? '—' : formatCurrency(val * 1000)}
                        </td>
                      );
                    })}
                  </tr>
                ));
              })()}
              <tr className="border-t border-border font-semibold">
                <td className="px-4 py-1.5">Total Recebíveis</td>
                {activeMetrics.map(m => (
                  <td key={m.year} className="text-right px-4 py-1.5 tabular-nums">
                    {formatCurrency(m.receivablesBalance * 1000)}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/20">
                <td className="px-4 py-1.5 text-muted-foreground">% inadimplência estimada (90d+)</td>
                {activeMetrics.map(m => {
                  const dist = m.dso <= 15 ? 0 : m.dso <= 30 ? 0 : m.dso <= 60 ? 0.05 : 0.15;
                  return (
                    <td key={m.year} className={`text-right px-4 py-1.5 tabular-nums ${dist > 0.05 ? 'text-negative' : 'text-muted-foreground'}`}>
                      {(dist * 100).toFixed(1)}%
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Cash Sweep Simulation ─── */}
      <div className="gradient-card p-5 space-y-3">
        <h3 className="text-sm font-semibold">Simulação Cash Sweep</h3>
        <p className="text-[10px] text-muted-foreground">
          Se o saldo final excede o mínimo, o excedente amortiza dívida. Se fica abaixo, puxa linha de crédito.
        </p>
        {(() => {
          const minCash = (assumptions as any).minCashBalance ?? 500; // R$ 500k default
          const creditLimit = (assumptions as any).creditLineLimit ?? 5000; // R$ 5M default

          // Reconstruct balances from CashFlow logic
          const initialCash = (assumptions as any).initialCashBalance ?? 0;
          let balance = initialCash;
          const sweepData = activeMetrics.map(m => {
            // Simplified: use working capital change as proxy for period cash generation
            const grossCashGen = m.grossRevenue - m.totalCogs - m.totalOpex;
            const preSweepBalance = balance + grossCashGen;
            let sweep = 0;
            let drawdown = 0;

            if (preSweepBalance > minCash) {
              sweep = preSweepBalance - minCash; // excess → pay debt
            } else if (preSweepBalance < minCash) {
              drawdown = Math.min(minCash - preSweepBalance, creditLimit);
            }

            const postBalance = preSweepBalance - sweep + drawdown;
            const result = { year: m.year, preSweep: preSweepBalance, sweep, drawdown, postBalance, minCash };
            balance = postBalance;
            return result;
          });

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium min-w-[200px]">Item</th>
                    {sweepData.map(d => (
                      <th key={d.year} className="text-right px-4 py-2 text-muted-foreground font-medium min-w-[120px]">{d.year}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/20">
                    <td className="px-4 py-1.5">Saldo Pré-Sweep</td>
                    {sweepData.map(d => (
                      <td key={d.year} className={`text-right px-4 py-1.5 tabular-nums ${d.preSweep < d.minCash ? 'text-negative' : ''}`}>
                        {formatCurrency(d.preSweep * 1000)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="px-4 py-1.5 text-muted-foreground">Saldo Mínimo Target</td>
                    {sweepData.map(d => (
                      <td key={d.year} className="text-right px-4 py-1.5 tabular-nums text-muted-foreground">
                        {formatCurrency(d.minCash * 1000)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="px-4 py-1.5 text-positive">Amortização Extra (sweep)</td>
                    {sweepData.map(d => (
                      <td key={d.year} className="text-right px-4 py-1.5 tabular-nums text-positive">
                        {d.sweep > 0.5 ? formatCurrency(d.sweep * 1000) : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border/20">
                    <td className="px-4 py-1.5 text-negative">Drawdown Linha de Crédito</td>
                    {sweepData.map(d => (
                      <td key={d.year} className="text-right px-4 py-1.5 tabular-nums text-negative">
                        {d.drawdown > 0.5 ? formatCurrency(d.drawdown * 1000) : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t border-border font-semibold">
                    <td className="px-4 py-1.5">Saldo Pós-Sweep</td>
                    {sweepData.map(d => (
                      <td key={d.year} className={`text-right px-4 py-1.5 tabular-nums ${d.postBalance >= d.minCash ? 'text-positive' : 'text-negative'}`}>
                        {formatCurrency(d.postBalance * 1000)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      <div className="flex items-start gap-2 text-[11px] text-muted-foreground px-1">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        <span>
          DSO = Prazo médio ponderado de recebimento (PMR por BU). DPO = Prazo médio ponderado de pagamento (PMP por categoria).
          CCC = DSO − DPO. Aging estimado pela distribuição do DSO. Cash Sweep simula amortização automática quando caixa excede o mínimo.
          Edite PMR e PMP na página de Cash Flow.
        </span>
      </div>
    </div>
  );
}
