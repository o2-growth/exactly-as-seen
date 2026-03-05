export const YEARS = [2025, 2026, 2027, 2028, 2029, 2030] as const;
export type Year = typeof YEARS[number];

export interface Assumptions {
  caasClients: Record<Year, number>;
  saasClients: Record<Year, number>;
  educationClients: Record<Year, number>;
  tickets: {
    caasAssessoria: number;
    caasEnterprise: number;
    caasCorporate: number;
    caasSetup: number;
    saasOxy: number;
    saasOxyGenio: number;
    educationDonoCFO: number;
    baas: number;
  };
  churnCaas: number;
  churnSaas: number;
  sgaPercent: number;
  headcountGrowth: number;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  caasClients: { 2025: 167, 2026: 272, 2027: 768, 2028: 2136, 2029: 4171, 2030: 6472 },
  saasClients: { 2025: 226, 2026: 631, 2027: 2293, 2028: 7992, 2029: 19471, 2030: 37918 },
  educationClients: { 2025: 49, 2026: 145, 2027: 605, 2028: 2373, 2029: 5292, 2030: 9504 },
  tickets: {
    caasAssessoria: 2000,
    caasEnterprise: 9210,
    caasCorporate: 15570,
    caasSetup: 15000,
    saasOxy: 1297,
    saasOxyGenio: 1997,
    educationDonoCFO: 397,
    baas: 229,
  },
  churnCaas: 5,
  churnSaas: 5,
  sgaPercent: 15,
  headcountGrowth: 10,
};

// Base annual data (R$ thousands)
export const BASE_ANNUAL_DATA = {
  grossRevenue:  { 2025: 13777, 2026: 34250, 2027: 103707, 2028: 337072, 2029: 785967, 2030: 1460172 },
  netRevenue:    { 2025: 12447, 2026: 30945, 2027: 87892,  2028: 285669, 2029: 666107, 2030: 1237496 },
  grossProfit:   { 2025: 9679,  2026: 23643, 2027: 68276,  2028: 229690, 2029: 540218, 2030: 1010705 },
  ebitda:        { 2025: 1360,  2026: 7136,  2027: 6605,   2028: 18606,  2029: 41855,  2030: 118380  },
};

export const TOTAL_CLIENTS: Record<Year, number> = {
  2025: 442, 2026: 1048, 2027: 5439, 2028: 23634, 2029: 66172, 2030: 143059
};

export const GROSS_MARGINS: Record<Year, number> = {
  2025: 77.8, 2026: 76.4, 2027: 77.7, 2028: 80.4, 2029: 81.1, 2030: 81.7
};

export type Scenario = 'BASE' | 'BULL' | 'BEAR';

export const SCENARIO_MULTIPLIERS: Record<Scenario, number> = {
  BASE: 1.0,
  BULL: 1.20,
  BEAR: 0.80,
};

export interface ProjectionData {
  grossRevenue: Record<Year, number>;
  netRevenue: Record<Year, number>;
  grossProfit: Record<Year, number>;
  ebitda: Record<Year, number>;
  totalClients: Record<Year, number>;
  grossMargins: Record<Year, number>;
}

export function calculateProjections(
  assumptions: Assumptions,
  scenario: Scenario
): ProjectionData {
  const multiplier = SCENARIO_MULTIPLIERS[scenario];
  
  // Scale revenue based on client changes relative to defaults
  const projections: ProjectionData = {
    grossRevenue: {} as Record<Year, number>,
    netRevenue: {} as Record<Year, number>,
    grossProfit: {} as Record<Year, number>,
    ebitda: {} as Record<Year, number>,
    totalClients: {} as Record<Year, number>,
    grossMargins: {} as Record<Year, number>,
  };

  for (const year of YEARS) {
    const clientRatio = (
      (assumptions.caasClients[year] + assumptions.saasClients[year] + assumptions.educationClients[year]) /
      (DEFAULT_ASSUMPTIONS.caasClients[year] + DEFAULT_ASSUMPTIONS.saasClients[year] + DEFAULT_ASSUMPTIONS.educationClients[year])
    );

    const revenueScale = clientRatio * multiplier;

    projections.grossRevenue[year] = Math.round(BASE_ANNUAL_DATA.grossRevenue[year] * revenueScale);
    projections.netRevenue[year] = Math.round(BASE_ANNUAL_DATA.netRevenue[year] * revenueScale);
    projections.grossProfit[year] = Math.round(BASE_ANNUAL_DATA.grossProfit[year] * revenueScale);
    projections.ebitda[year] = Math.round(BASE_ANNUAL_DATA.ebitda[year] * revenueScale);
    projections.totalClients[year] = assumptions.caasClients[year] + assumptions.saasClients[year] + assumptions.educationClients[year];
    projections.grossMargins[year] = GROSS_MARGINS[year];
  }

  return projections;
}

// Debt data
export const DEBTS = [
  { creditor: 'CEF – PRONAMP', amount: 119459, monthlyPayment: 3853, finalDate: 'Jul/2027', rate: 1.2 },
  { creditor: 'CEF – FAMPE', amount: 31705, monthlyPayment: 5284, finalDate: 'Jun/2025', rate: 1.2 },
  { creditor: 'Santander', amount: 160214, monthlyPayment: 3270, finalDate: 'Jan/2029', rate: 1.2 },
];

// CAC data by sector
export const CAC_BY_SECTOR = [
  { sector: 'Agtech', cac: 3804 },
  { sector: 'Adtech', cac: 3456 },
  { sector: 'Aviation & Defense', cac: 3150 },
  { sector: 'Automotive', cac: 2568 },
];

// Headcount data
export const HEADCOUNT = [
  { role: 'CFOs', 2025: 11, 2026: 97, 2027: 431, 2028: 950, 2029: 1800, 2030: 3200 },
  { role: 'PMO Directors', 2025: 1, 2026: 8, 2027: 65, 2028: 180, 2029: 400, 2030: 750 },
  { role: 'Sales Team', 2025: 5, 2026: 15, 2027: 45, 2028: 120, 2029: 280, 2030: 500 },
  { role: 'Tech Team', 2025: 8, 2026: 20, 2027: 55, 2028: 140, 2029: 300, 2030: 520 },
];
