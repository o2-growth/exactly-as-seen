import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS } from '@/lib/financialData';
import { formatPercent } from '@/lib/formatters';
import { Gauge, TrendingUp, Percent, Info } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart,
} from 'recharts';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function getScoreColor(score: number): string {
  if (score >= 60) return 'text-positive';
  if (score >= 40) return 'text-primary';
  if (score >= 20) return 'text-warning';
  return 'text-negative';
}

function getScoreLabel(score: number): string {
  if (score >= 60) return 'Elite';
  if (score >= 40) return 'Healthy';
  if (score >= 20) return 'Weak';
  return 'Critical';
}

function getAreaFill(score: number): string {
  if (score >= 60) return 'hsl(160 84% 39% / 0.15)';
  if (score >= 40) return 'hsl(217 91% 60% / 0.15)';
  if (score >= 20) return 'hsl(38 92% 50% / 0.15)';
  return 'hsl(0 84% 60% / 0.15)';
}

function getLineStroke(score: number): string {
  if (score >= 60) return 'hsl(160 84% 39%)';
  if (score >= 40) return 'hsl(217 91% 60%)';
  if (score >= 20) return 'hsl(38 92% 50%)';
  return 'hsl(0 84% 60%)';
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg" style={{ minWidth: 200 }}>
      <p className="text-sm font-bold text-foreground mb-2">{label}</p>
      <div className="space-y-1 text-[13px]">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Rule of 40</span>
          <span className="font-bold">{d?.score?.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Revenue Growth</span>
          <span className="tabular-nums">{d?.revenueGrowth?.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Profit Margin</span>
          <span className="tabular-nums">{d?.profitMargin?.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};

export default function RuleOf40() {
  const { projections, selectedYear, filteredYears } = useFinancialModel();

  // Use filteredYears for the chart; fall back to all YEARS if empty
  const activeYears = filteredYears.length > 0 ? filteredYears : YEARS;

  // Compute Rule of 40 for active years. For growth rate we need the previous year value,
  // which may be outside activeYears so we look it up from projections directly.
  const chartData = activeYears.map((y, i) => {
    const prevYear = activeYears[i - 1] ?? (y > YEARS[0] ? (y - 1) as typeof YEARS[number] : undefined);
    const prev = prevYear != null ? projections.grossRevenue[prevYear as typeof YEARS[number]] : 0;
    const curr = projections.grossRevenue[y];
    const revenueGrowth = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
    const profitMargin = projections.netMargins[y];
    const score = revenueGrowth + profitMargin;
    return { year: y.toString(), revenueGrowth: Number(revenueGrowth.toFixed(1)), profitMargin: Number(profitMargin.toFixed(1)), score: Number(score.toFixed(1)) };
  });

  const currentData = chartData.find(d => d.year === selectedYear.toString());
  const score = currentData?.score ?? 0;
  const revenueGrowth = currentData?.revenueGrowth ?? 0;
  const profitMargin = currentData?.profitMargin ?? 0;

  // Determine dominant color based on current score
  const avgScore = chartData.reduce((s, d) => s + d.score, 0) / chartData.length;

  return (
    <>
      {/* KPI Card */}
      <div className="kpi-card relative">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className={`h-4 w-4 ${getScoreColor(score)}`} />
          <span className="text-xs text-muted-foreground font-medium">Rule of 40</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground/50 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-xs">
                The Rule of 40 is a SaaS metric used by investors to evaluate the balance between company growth and profitability.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className={`text-2xl font-bold tracking-tight ${getScoreColor(score)}`}>
          {score.toFixed(1)}%
        </p>
        <span className={`text-[10px] font-semibold ${getScoreColor(score)}`}>{getScoreLabel(score)}</span>
        <div className="mt-2 space-y-0.5 text-[11px]">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>Growth: <span className="font-semibold text-foreground">{revenueGrowth.toFixed(1)}%</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Percent className="h-3 w-3" />
            <span>Margin: <span className="font-semibold text-foreground">{profitMargin.toFixed(1)}%</span></span>
          </div>
        </div>
      </div>

      {/* Chart — rendered separately, placed in the charts grid by parent */}
    </>
  );
}

export function RuleOf40Chart() {
  const { projections, filteredYears } = useFinancialModel();

  // Use filteredYears for the chart; fall back to all YEARS if empty
  const activeYears = filteredYears.length > 0 ? filteredYears : YEARS;

  const chartData = activeYears.map((y, i) => {
    const prevYear = activeYears[i - 1] ?? (y > YEARS[0] ? (y - 1) as typeof YEARS[number] : undefined);
    const prev = prevYear != null ? projections.grossRevenue[prevYear as Year] : 0;
    const curr = projections.grossRevenue[y];
    const revenueGrowth = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
    const profitMargin = projections.netMargins[y];
    const score = revenueGrowth + profitMargin;
    return { year: y.toString(), revenueGrowth: Number(revenueGrowth.toFixed(1)), profitMargin: Number(profitMargin.toFixed(1)), score: Number(score.toFixed(1)) };
  });

  const avgScore = chartData.reduce((s, d) => s + d.score, 0) / chartData.length;

  return (
    <div className="gradient-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-semibold">Rule of 40 — Evolution</h3>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px] text-xs">
              The Rule of 40 is a SaaS metric used by investors to evaluate the balance between company growth and profitability. Score = Revenue Growth % + Profit Margin %.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={chartData}>
          <defs>
            <linearGradient id="ruleOf40Gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={getLineStroke(avgScore)} stopOpacity={0.3} />
              <stop offset="100%" stopColor={getLineStroke(avgScore)} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
          <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={11} />
          <YAxis stroke="hsl(215 20% 55%)" fontSize={11} unit="%" />
          <ReTooltip content={<CustomTooltip />} />
          {/* Benchmark reference lines */}
          <ReferenceLine y={20} stroke="hsl(0 84% 60% / 0.4)" strokeDasharray="4 4" label={{ value: '20% Weak', position: 'right', fill: 'hsl(0 84% 60% / 0.6)', fontSize: 9 }} />
          <ReferenceLine y={40} stroke="hsl(160 84% 39% / 0.5)" strokeDasharray="4 4" label={{ value: '40% Healthy', position: 'right', fill: 'hsl(160 84% 39% / 0.7)', fontSize: 9 }} />
          <ReferenceLine y={60} stroke="hsl(258 90% 66% / 0.5)" strokeDasharray="4 4" label={{ value: '60% Elite', position: 'right', fill: 'hsl(258 90% 66% / 0.7)', fontSize: 9 }} />
          <Area type="monotone" dataKey="score" fill="url(#ruleOf40Gradient)" stroke="none" />
          <Line type="monotone" dataKey="score" stroke={getLineStroke(avgScore)} strokeWidth={2.5} dot={{ fill: getLineStroke(avgScore), r: 4, strokeWidth: 2, stroke: 'hsl(217 33% 17%)' }} name="Rule of 40" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
