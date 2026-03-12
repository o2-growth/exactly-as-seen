/**
 * Monthly data generation utilities for the Assumptions page.
 * Provides month-by-month client counts and headcount projections.
 */

import { Year, SubProductClients } from '@/lib/financialData';
import { clientsBase2025, headcountRatios, namedEmployees2025, salaryRanges } from '@/data/modelData';
import { historicalRevenueItems, HISTORICAL_PERIODS } from '@/data/historicalData';

export const MONTHS = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
] as const;

export type Month = typeof MONTHS[number];

// ─── SubProductKey → clientsBase2025 actual monthly array mapping ───

type SubProductKey = keyof SubProductClients;

// Map from SubProductKey to historical revenue item location (group, item_name)
const HISTORICAL_REVENUE_MAP: Partial<Record<SubProductKey, { group: string; item: string }>> = {
  caasAssessoria:   { group: 'CaaS', item: 'Serviços Especializados' },
  caasEnterprise:   { group: 'CaaS', item: 'Enterprise' },
  caasCorporate:    { group: 'CaaS', item: 'Corporate' },
  caasSetup:        { group: 'CaaS', item: 'BPO Financeiro' },
  saasOxy:          { group: 'SaaS', item: 'Oxy' },
  saasOxyGenio:     { group: 'SaaS', item: 'Oxy + Gênio' },
  educationDonoCFO: { group: 'Education', item: 'Dono CFO' },
  // baas: no historical data yet
};

/**
 * Returns historical client counts for a sub-product for all 12 months of a given year.
 * Client count = revenue / ticket_price (rounded to integer).
 * Returns null for months that are not in HISTORICAL_PERIODS (i.e. future months).
 * Returns 0 for sub-products with no historical mapping (e.g. baas).
 */
export function getHistoricalClients(
  key: SubProductKey,
  year: number,
  ticketPrice: number,
): (number | null)[] {
  const mapping = HISTORICAL_REVENUE_MAP[key];

  return Array.from({ length: 12 }, (_, m) => {
    const period = `${year}-${String(m + 1).padStart(2, '0')}`;
    const isHistoricalPeriod = (HISTORICAL_PERIODS as readonly string[]).includes(period);

    if (!isHistoricalPeriod) {
      return null; // future — use projection
    }

    if (!mapping) {
      return 0; // no historical data for this sub-product (e.g. baas)
    }

    const revenue = historicalRevenueItems[mapping.group]?.[mapping.item]?.[period] ?? 0;
    if (ticketPrice <= 0) return 0;
    return Math.round(revenue / ticketPrice);
  });
}

const SUB_PRODUCT_2025_DATA: Record<SubProductKey, number[]> = {
  caasAssessoria:   clientsBase2025.caas.assessoria,
  caasEnterprise:   clientsBase2025.caas.enterprise,
  caasCorporate:    clientsBase2025.caas.corporate,
  caasSetup:        clientsBase2025.caas.setup,
  saasOxy:          clientsBase2025.saas.oxy,
  saasOxyGenio:     clientsBase2025.saas.oxyGenio,
  educationDonoCFO: clientsBase2025.education.donoCfo,
  baas:             clientsBase2025.baas.assinatura,
};

/**
 * Returns an array of 12 monthly client counts for a given sub-product and year.
 *
 * For 2025: returns real historical data derived from revenue / ticket_price.
 * For 2026 Jan-Mar: returns real historical data (those periods are in HISTORICAL_PERIODS).
 * For 2026 Apr-Dec and beyond: uses geometric interpolation from the last historical month
 *   to the annual target.
 *   month i (1-based): prevDec * (currentDec / prevDec)^(i/12)
 *   Special case: if prevDec === 0, linear ramp: currentDec * i/12
 *
 * The ticketPrice is taken from subProductClients context — callers should pass
 * the current assumptions ticket price. For backwards compatibility, a static
 * fallback is used when the ticket is unavailable.
 */
export function getMonthlyClients(
  key: SubProductKey,
  year: Year,
  subProductClients: SubProductClients,
  ticketPrices?: Partial<Record<SubProductKey, number>>,
): number[] {
  // Determine the ticket price for this sub-product
  const STATIC_TICKET_FALLBACK: Record<SubProductKey, number> = {
    caasAssessoria:   25000,
    caasEnterprise:   6209,
    caasCorporate:    13573,
    caasSetup:        15000,
    saasOxy:          1297,
    saasOxyGenio:     1997,
    educationDonoCFO: 3997,
    baas:             229,
  };
  const ticket = ticketPrices?.[key] ?? STATIC_TICKET_FALLBACK[key];

  if (year === 2025) {
    // Use real historical data for all 12 months of 2025
    const hist = getHistoricalClients(key, 2025, ticket);
    return hist.map(v => v ?? 0);
  }

  if (year === 2026) {
    // Jan-Mar 2026 are historical; Apr-Dec are projected
    const hist = getHistoricalClients(key, 2026, ticket);
    // Find the last historical month to use as base for projection
    let lastHistIdx = -1;
    for (let m = 11; m >= 0; m--) {
      if (hist[m] !== null) { lastHistIdx = m; break; }
    }
    const prevDec = lastHistIdx >= 0 ? (hist[lastHistIdx] ?? 0) : SUB_PRODUCT_2025_DATA[key][11];
    const currentDec = subProductClients[key][year];

    return hist.map((histVal, i) => {
      if (histVal !== null) return histVal;
      // Projected month — geometric from prevDec
      const monthNum = i + 1; // 1-based
      const baseMonthNum = lastHistIdx + 1; // 1-based index of last historical month
      const remainingMonths = 12 - baseMonthNum;
      const stepsFromBase = monthNum - baseMonthNum;
      let val: number;
      if (prevDec > 0 && currentDec > 0 && remainingMonths > 0) {
        val = prevDec * Math.pow(currentDec / prevDec, stepsFromBase / remainingMonths);
      } else if (prevDec === 0 && currentDec > 0 && remainingMonths > 0) {
        val = currentDec * (stepsFromBase / remainingMonths);
      } else {
        val = 0;
      }
      return Math.round(val * 100) / 100;
    });
  }

  // For 2027+: geometric interpolation from Dec of previous year to Dec target of current year
  const prevYear = (year - 1) as Year;
  const prevDec = subProductClients[key][prevYear];
  const currentDec = subProductClients[key][year];

  const months: number[] = [];
  for (let i = 1; i <= 12; i++) {
    let val: number;
    if (prevDec > 0 && currentDec > 0) {
      val = prevDec * Math.pow(currentDec / prevDec, i / 12);
    } else if (prevDec === 0 && currentDec > 0) {
      val = currentDec * (i / 12);
    } else {
      val = 0;
    }
    months.push(Math.round(val * 100) / 100);
  }
  return months;
}

// ─── Monthly headcount computation ───

export interface MonthlyHeadcountRow {
  key: string;
  label: string;
  bu: string;
  salary: number;
  months: number[];
}

function computeHeadcountForClients(totalClients: number) {
  const baseCFOs    = namedEmployees2025.filter(e => e.role === 'CFO').length;
  const baseFPA     = namedEmployees2025.filter(e => e.role === 'FP&A').length;
  const baseCSM     = namedEmployees2025.filter(e => e.role === 'Customer Svc').length;
  const baseIT      = namedEmployees2025.filter(e => e.role === 'IT').length;
  const baseMgmt    = namedEmployees2025.filter(e => ['CEO', 'COO', 'CTO', 'CMO'].includes(e.role)).length;
  const baseAdmin   = namedEmployees2025.filter(e => ['People', 'Finance', 'Admin'].includes(e.role)).length;
  const baseMkt     = namedEmployees2025.filter(e => e.role === 'Marketing').length;

  return {
    cfos:          Math.max(baseCFOs,  Math.ceil(totalClients / headcountRatios.clientsPerCFO)),
    fpa:           Math.max(baseFPA,   Math.ceil(totalClients / headcountRatios.clientsPerFPA)),
    csm:           Math.max(baseCSM,   Math.ceil(totalClients / headcountRatios.clientsPerCSM)),
    pf:            Math.ceil(totalClients / headcountRatios.clientsPerPF),
    projectAnalyst: Math.ceil(totalClients / headcountRatios.clientsPerProjectAnal),
    dataAnalyst:   Math.ceil(totalClients / headcountRatios.clientsPerDataAnal),
    it:            baseIT,
    management:    baseMgmt,
    admin:         baseAdmin,
    marketing:     baseMkt,
  };
}

const MONTHLY_HEADCOUNT_ROLE_DEFS = [
  { key: 'cfos',           label: 'CFOs',                        bu: 'CaaS',       salary: salaryRanges['CFO'] },
  { key: 'fpa',            label: 'FP&A Analysts',               bu: 'CaaS',       salary: salaryRanges['FP&A Analyst'] },
  { key: 'csm',            label: 'Customer Service',            bu: 'Operations', salary: salaryRanges['Customer Service'] },
  { key: 'pf',             label: 'Project Finance Directors',   bu: 'CaaS',       salary: salaryRanges['Project Finance Director'] },
  { key: 'projectAnalyst', label: 'Project Analysts',            bu: 'CaaS',       salary: salaryRanges['Project Analyst'] },
  { key: 'dataAnalyst',    label: 'Data Analysts',               bu: 'SaaS',       salary: salaryRanges['Data Processes Analyst'] },
  { key: 'it',             label: 'Tech Team',                   bu: 'SaaS',       salary: salaryRanges['Senior Fullstack'] },
  { key: 'management',     label: 'Management',                  bu: 'Management', salary: 22000 },
  { key: 'admin',          label: 'Administrative',              bu: 'Admin',      salary: 8500 },
  { key: 'marketing',      label: 'Marketing',                   bu: 'Marketing',  salary: salaryRanges['UX Designer'] },
];

/**
 * Returns monthly headcount rows for all roles for the given year.
 * Each row has 12 monthly values computed from total clients per month.
 */
export function getMonthlyHeadcount(
  year: Year,
  subProductClients: SubProductClients,
  ticketPrices?: Partial<Record<SubProductKey, number>>,
): MonthlyHeadcountRow[] {
  const subProductKeys = Object.keys(subProductClients) as SubProductKey[];

  // Compute total clients for each of 12 months (sum across all sub-products)
  const monthlyTotals: number[] = Array.from({ length: 12 }, (_, m) => {
    return subProductKeys.reduce((sum, key) => {
      const monthly = getMonthlyClients(key, year, subProductClients, ticketPrices);
      return sum + monthly[m];
    }, 0);
  });

  // For each month, compute headcount
  const monthlyHC = monthlyTotals.map(total => computeHeadcountForClients(total));

  return MONTHLY_HEADCOUNT_ROLE_DEFS.map(roleDef => ({
    key:    roleDef.key,
    label:  roleDef.label,
    bu:     roleDef.bu,
    salary: roleDef.salary,
    months: monthlyHC.map(hc => (hc as Record<string, number>)[roleDef.key] ?? 0),
  }));
}
