/**
 * PMR Projection Engine
 * Distributes monthly revenue into future months based on parcelas configuration,
 * applying inadimplência and antecipação deductions.
 */

import { ProdutoPMR, Year, YEARS } from './financialData';
import { PnlNode } from '@/lib/pnlData';

// Map product IDs to P&L tree codes
const PRODUCT_PNL_MAP: Record<string, string> = {
  caasAssessoria: '1.1.1',
  caasEnterprise: '1.1.2',
  caasCorporate: '1.1.3',
  caasParceiros: '1.1.4',
  caasSetup: '1.1.5',
  saasOxy: '1.2.1',
  saasOxyGenio: '1.2.2',
  saasSetup: '1.2.3',
  saasParceiros: '1.2.4',
  saasOxyGenioEsp: '1.2.5',
  educationDonoCFO: '1.3.1',
  educationEN: '1.3.2',
  educationFR: '1.3.3',
  educationFSP: '1.3.4',
  baas: '1.5.1',
  baasFranquia: '1.5.2',
  baasMasterFranquia: '1.5.3',
  taxAT: '1.6.1',
  taxGPT: '1.6.2',
  taxRCT: '1.6.3',
  taxRT: '1.6.4',
  taxDTC: '1.6.5',
};

function findNode(code: string, nodes: PnlNode[]): PnlNode | undefined {
  for (const n of nodes) {
    if (n.code === code) return n;
    if (n.children) {
      const f = findNode(code, n.children);
      if (f) return f;
    }
  }
  return undefined;
}

/** Get monthly revenue for a product from the pnlTree (R$ thousands) */
function getMonthlyRevenue(productId: string, year: Year, tree: PnlNode[]): number[] {
  const code = PRODUCT_PNL_MAP[productId];
  if (!code) return new Array(12).fill(0);
  const node = findNode(code, tree);
  if (!node?.monthly?.[year]) {
    // Fallback: distribute annual evenly
    const annual = node?.annual[year] ?? 0;
    return new Array(12).fill(annual / 12);
  }
  return node.monthly[year];
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
  tree: PnlNode[],
): ProjectionResult {
  const recebimentos: Record<string, number[]> = {};
  const totalRecebido = new Array(12).fill(0);
  const totalFaturado = new Array(12).fill(0);
  const totalInadimplencia = new Array(12).fill(0);
  const totalCustoAntecipacao = new Array(12).fill(0);
  const produtoResumo: ProjectionResult['produtoResumo'] = [];

  for (const cfg of produtos) {
    const monthly = getMonthlyRevenue(cfg.id, year, tree);
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
