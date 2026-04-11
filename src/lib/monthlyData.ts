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
// Complete mapping for all 21 sub-products to their entries in historicalRevenueItems.
// Products that didn't exist in 2025 (e.g. Oxy standalone) will have all-zero values in
// historicalRevenueItems but are still mapped for correctness.
const HISTORICAL_REVENUE_MAP: Partial<Record<SubProductKey, { group: string; item: string }>> = {
  // CaaS
  caasAssessoria:     { group: 'CaaS', item: 'Serviços Especializados' },
  caasEnterprise:     { group: 'CaaS', item: 'Enterprise' },
  caasCorporate:      { group: 'CaaS', item: 'Corporate' },
  caasSetup:          { group: 'CaaS', item: 'BPO Financeiro' },
  caasParceiros:      { group: 'CaaS', item: 'Parceiros' },
  // SaaS
  saasOxy:            { group: 'SaaS', item: 'Oxy' },
  saasOxyGenio:       { group: 'SaaS', item: 'Oxy + Gênio' },
  saasOxyGenioEsp:    { group: 'SaaS', item: 'Oxy + Gênio + Especialista' },
  saasSetup:          { group: 'SaaS', item: 'Setup' },
  saasParceiros:      { group: 'SaaS', item: 'Parceiros' },
  // Education
  educationDonoCFO:   { group: 'Education', item: 'Dono CFO' },
  educationEN:        { group: 'Education', item: 'Engenheiro de Negócios' },
  educationFR:        { group: 'Education', item: 'Financeiro Raiz' },
  educationFSP:       { group: 'Education', item: 'Finance Sales Program' },
  // Expansão (labeled as 'baas*' in SubProductKey, maps to 'Expansão' in historicalRevenueItems)
  baas:               { group: 'Expansão', item: 'Oxy Hacker - Micro Franqueado' },
  baasFranquia:       { group: 'Expansão', item: 'Franquia' },
  baasMasterFranquia: { group: 'Expansão', item: 'Master Franquia' },
  // Tax
  taxAT:              { group: 'Tax', item: 'AT - Assessoria Tributária' },
  taxGPT:             { group: 'Tax', item: 'GPT - Gestão passivo tributário' },
  taxRCT:             { group: 'Tax', item: 'RCT - Recuperação Crédito tributário' },
  taxRT:              { group: 'Tax', item: 'RT - Reforma tributária' },
  taxDTC:             { group: 'Tax', item: 'Diagnóstico Tributário & Compliance Tributário' },
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
  caasParceiros:    clientsBase2025.caas.parceiros,
  saasOxy:          clientsBase2025.saas.oxy,
  saasOxyGenio:     clientsBase2025.saas.oxyGenio,
  saasSetup:        clientsBase2025.saas.setup,
  saasParceiros:    clientsBase2025.saas.parceiros,
  saasOxyGenioEsp:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  educationDonoCFO: clientsBase2025.education.donoCfo,
  educationEN:      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  educationFR:      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  educationFSP:     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  baas:             clientsBase2025.baas.assinatura,
  baasFranquia:     [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  baasMasterFranquia: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  taxAT:            clientsBase2025.tax.at,
  taxGPT:           clientsBase2025.tax.gpt,
  taxRCT:           clientsBase2025.tax.rct,
  taxRT:            clientsBase2025.tax.rt,
  taxDTC:           clientsBase2025.tax.dtc,
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
  monthlyClientOverrides?: Partial<Record<SubProductKey, Partial<Record<Year, (number | null)[]>>>>,
): number[] {
  // Setup = sum of absolute client counts from 5 source products
  if (key === 'saasSetup') {
    const sources: SubProductKey[] = [
      'caasEnterprise', 'caasCorporate',
      'saasOxy', 'saasOxyGenio', 'saasOxyGenioEsp',
    ];
    return Array.from({ length: 12 }, (_, m) => {
      let total = 0;
      for (const src of sources) {
        const srcMonthly = getMonthlyClients(src, year, subProductClients, ticketPrices, monthlyClientOverrides);
        total += Math.round(srcMonthly[m]);
      }
      return total;
    });
  }
  // Determine the ticket price for this sub-product
  const STATIC_TICKET_FALLBACK: Record<SubProductKey, number> = {
    caasAssessoria:   25000,
    caasEnterprise:   6209,
    caasCorporate:    13573,
    caasSetup:        15000,
    caasParceiros:    0,
    saasOxy:          1297,
    saasOxyGenio:     1997,
    saasSetup:        15000,
    saasParceiros:    0,
    saasOxyGenioEsp:  0,
    educationDonoCFO: 3997,
    educationEN:      7500,
    educationFR:      2997,
    educationFSP:     497,
    baas:             229,
    baasFranquia:     0,
    baasMasterFranquia: 0,
    taxAT:            5000,
    taxGPT:           3000,
    taxRCT:           4000,
    taxRT:            3500,
    taxDTC:           2500,
  };
  const ticket = ticketPrices?.[key] ?? STATIC_TICKET_FALLBACK[key];

  // Helper: apply monthly client overrides on top of base result
  const applyOverrides = (base: number[]): number[] => {
    const overrides = monthlyClientOverrides?.[key]?.[year];
    if (!overrides) return base;
    return base.map((v, i) => {
      const ov = overrides[i];
      return (ov !== null && ov !== undefined) ? ov : v;
    });
  };

  if (year === 2025) {
    // Use real historical data from Oxy (via historicalRevenueItems),
    // not the hardcoded clientsBase2025 seed.
    // Each month's client count = revenue_from_oxy / ticket_price.
    // Products that didn't exist in 2025 (like Oxy standalone) will show 0,
    // which matches reality. Legacy SUB_PRODUCT_2025_DATA is kept for
    // reference but no longer used as source of truth.
    const hist = getHistoricalClients(key, 2025, ticket);
    return applyOverrides(hist.map(v => v ?? 0));
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

    const result = hist.map((histVal, i) => {
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
    return applyOverrides(result);
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
  return applyOverrides(months);
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
