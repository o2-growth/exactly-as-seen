/**
 * PMR Projection Engine
 * Distributes monthly revenue into future months based on parcelas configuration,
 * applying inadimplência and antecipação deductions.
 */

import { ProdutoPMR, Year, Assumptions } from './financialData';
import { computeProductMonthlyRevenue } from '@/lib/revenueCalc';
import type { HistoricalClientData } from '@/hooks/useHistoricalClients';

type HistoricalDataMap = Record<string, Record<string, HistoricalClientData>>;

/**
 * Get monthly revenue for a product (R$ thousands).
 * Uses computeProductMonthlyRevenue (same source the P&L uses for annual patching),
 * so totalFaturado matches the P&L exactly.
 */
function getMonthlyRevenue(
  productId: string,
  year: Year,
  assumptions: Assumptions,
  historicalData: HistoricalDataMap,
): number[] {
  // Returns 12 monthly values in R$ (not thousands)
  const monthlyR$ = computeProductMonthlyRevenue(productId, year, assumptions, historicalData);
  // Convert to R$ thousands to match the rest of pmrProjection (which expects thousands)
  return monthlyR$.map(v => v / 1000);
}

export interface ProjectionResult {
  /** Grid: [product][month] = received amount in R$ thousands */
  recebimentos: Record<string, number[]>;
  /** Total received per month (sum of all products) */
  totalRecebido: number[];
  /** Total billed per month (receita bruta faturada) */
  totalFaturado: number[];
  /** Inadimplência total per month */
  totalInadimplencia: number[];
  /** Custo de antecipação total per month */
  totalCustoAntecipacao: number[];
  /** Per-product annual summary */
  produtoResumo: {
    id: string;
    nome: string;
    grupo: string;
    faturado: number;
    recebido: number;
    inadimplencia: number;
    custoAntecipacao: number;
  }[];
}

/**
 * Project receivables for a given year based on PMR product configs.
 * Distributes each month's revenue across future months per parcelas,
 * deducting inadimplência and antecipação costs.
 */
export function projectRecebimentos(
  year: Year,
  produtos: ProdutoPMR[],
  assumptions: Assumptions,
  historicalData: HistoricalDataMap,
): ProjectionResult {
  const recebimentos: Record<string, number[]> = {};
  const totalRecebido = new Array(12).fill(0);
  const totalFaturado = new Array(12).fill(0);
  const totalInadimplencia = new Array(12).fill(0);
  const totalCustoAntecipacao = new Array(12).fill(0);
  const produtoResumo: ProjectionResult['produtoResumo'] = [];

  for (const cfg of produtos) {
    const monthly = getMonthlyRevenue(cfg.id, year, assumptions, historicalData);
    const prodReceb = new Array(12).fill(0);
    let prodFaturado = 0;
    let prodRecebido = 0;
    let prodInadimplencia = 0;
    let prodCustoAntecipacao = 0;

    for (let m = 0; m < 12; m++) {
      const receita = Math.abs(monthly[m]);
      prodFaturado += receita;
      totalFaturado[m] += receita;

      // Deduct inadimplência
      const inadValue = receita * (cfg.inadimplencia / 100);
      totalInadimplencia[m] += inadValue;
      prodInadimplencia += inadValue;
      const netRev = receita - inadValue;

      // Distribute across parcelas
      for (let pi = 0; pi < cfg.parcelas.length; pi++) {
        const slot = m + pi;
        if (slot >= 12) continue; // overflow goes to next year (not tracked here)

        let val = netRev * (cfg.parcelas[pi] / 100);

        // Antecipação: future parcelas get deducted
        if (cfg.antecipa && pi > 0) {
          const custoAnt = val * (cfg.custoAntecipacao / 100) * pi;
          totalCustoAntecipacao[m] += custoAnt;
          prodCustoAntecipacao += custoAnt;
          val -= custoAnt;
        }

        prodReceb[slot] += val;
        totalRecebido[slot] += val;
        prodRecebido += val;
      }
    }

    recebimentos[cfg.id] = prodReceb;
    produtoResumo.push({
      id: cfg.id,
      nome: cfg.nome,
      grupo: cfg.grupo,
      faturado: prodFaturado,
      recebido: prodRecebido,
      inadimplencia: prodInadimplencia,
      custoAntecipacao: prodCustoAntecipacao,
    });
  }

  return { recebimentos, totalRecebido, totalFaturado, totalInadimplencia, totalCustoAntecipacao, produtoResumo };
}

/** Compute annual totals from projection */
export function annualTotals(result: ProjectionResult) {
  const faturado = result.totalFaturado.reduce((s, v) => s + v, 0);
  const recebido = result.totalRecebido.reduce((s, v) => s + v, 0);
  const inadimplencia = result.totalInadimplencia.reduce((s, v) => s + v, 0);
  const custoAntecipacao = result.totalCustoAntecipacao.reduce((s, v) => s + v, 0);
  const cobertura = faturado > 0 ? (recebido / faturado) * 100 : 0;
  return { faturado, recebido, inadimplencia, custoAntecipacao, cobertura };
}
