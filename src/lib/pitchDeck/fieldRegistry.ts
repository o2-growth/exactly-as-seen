import type { FullModelOutput } from '@/engine/calculationsEngine';

/** Helpers para formatar números em milhares (R$ 000's) e milhões (MM). */
export const fmtThousands = (v: number) =>
  (Math.round(v / 1000)).toLocaleString('pt-BR');

export const fmtMillions = (v: number) =>
  `${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}MM`;

export const fmtPct = (v: number, digits = 1) =>
  `${v.toFixed(digits)}%`;

/** YoY simple growth */
export const yoyPct = (curr: number, prev: number) =>
  prev === 0 ? 0 : ((curr - prev) / prev) * 100;

/** Total accumulated revenue for a year using monthly recompute would be ideal,
 *  but for slides we use AnnualOutput.grossRevenue (já é total anual). */
export function getYearMetrics(model: FullModelOutput, year: number) {
  return model.years[year as keyof typeof model.years];
}
