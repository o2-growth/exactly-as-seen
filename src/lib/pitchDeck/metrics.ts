/**
 * Pitch-deck metrics: KPIs derivados do FullModelOutput.
 *
 * IMPORTANTE: o engine entrega valores em R$ MIL (000's).
 * Helpers de formatação estão em fieldRegistry.ts.
 */
import type { FullModelOutput, MonthlyPnL } from '@/engine/calculationsEngine';
import type { Year } from '@/lib/financialData';
import { cacPerClient, churnAnnual } from '@/data/modelData';

/** YoY growth % entre dois valores. */
export function yoy(curr: number, prev: number) {
  return prev === 0 ? 0 : ((curr - prev) / prev) * 100;
}

/** Range de anos inclusivo. */
export function yearsRange(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/** Pega array mensal (12) de receita bruta para um ano. R$ MIL. */
export function getMonthlyGrossRevenue(model: FullModelOutput, year: Year): number[] {
  const monthly = model.years[year]?.monthlyData ?? [];
  return Array.from({ length: 12 }, (_, m) => monthly[m]?.grossRevenue ?? 0);
}

/** Pega array trimestral (4) somando os meses reais. R$ MIL. */
export function getQuarterlyGrossRevenue(model: FullModelOutput, year: Year): number[] {
  const m = getMonthlyGrossRevenue(model, year);
  return [
    m[0] + m[1] + m[2],
    m[3] + m[4] + m[5],
    m[6] + m[7] + m[8],
    m[9] + m[10] + m[11],
  ];
}

/**
 * ARR de um ano = (MRR de Dezembro) × 12, considerando APENAS receitas recorrentes
 * (SaaS Oxy, Oxy+Gênio, Oxy+Gênio Esp, CaaS Enterprise, CaaS Corporate, CaaS Assessoria).
 * Setup e BaaS não entram porque são one-shot / serviço.
 */
export function getARR(model: FullModelOutput, year: Year): number {
  const dec = model.years[year]?.monthlyData?.[11] as MonthlyPnL | undefined;
  if (!dec) return 0;
  // Aproximação prática: receita SaaS + CaaS (recorrente) de dezembro, anualizada.
  // Não temos breakdown CaaS Setup separado por mês no MonthlyPnL — caasRevenue
  // inclui setup, mas o peso anual de setup em CaaS é pequeno.
  const recurringDec = (dec.saasRevenue ?? 0) + (dec.caasRevenue ?? 0);
  return recurringDec * 12; // R$ MIL
}

/**
 * LTV/CAC aproximado (média da companhia).
 * LTV = ticket médio anual × duração média (1/churn). CAC = média ponderada por BU.
 */
export function getLtvCac(model: FullModelOutput, year: Year = 2025): number {
  const y = model.years[year];
  if (!y) return 0;
  // Ticket médio anual da companhia
  const totalClients = y.totalClients || 1;
  const ticketAnual = (y.grossRevenue * 1000) / totalClients;
  // Vida média (anos): 1/churn. CaaS+SaaS=5%, Education+BaaS=0 (usa 5% como conservador).
  const churn = (churnAnnual.caas + churnAnnual.saas) / 2; // 5%
  const vidaAnos = churn > 0 ? 1 / churn : 10;
  const ltv = ticketAnual * vidaAnos;
  // CAC médio simples
  const cac = (cacPerClient.caas + cacPerClient.saas) / 2;
  return cac > 0 ? ltv / cac : 0;
}

/** Faturamento anual gerido por clientes (proxy via historicalData se disponível). */
export function getClientsManagedRevenue(historicalData: Record<string, any>): number {
  // historicalData = { saasOxy: { 2024: { revenue, clients } }, ... }
  // Aqui um proxy: somatório de clientes ativos × ticket médio anualizado.
  // Como não temos métrica "faturamento gerido", retornamos 0 e a UI fica em modo override.
  return 0;
}
