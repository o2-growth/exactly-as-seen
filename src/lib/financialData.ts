export const YEARS = [2025, 2026, 2027, 2028, 2029, 2030] as const;
export type Year = typeof YEARS[number];

export interface SubProductClients {
  caasAssessoria: Record<Year, number>;
  caasEnterprise: Record<Year, number>;
  caasCorporate: Record<Year, number>;
  caasSetup: Record<Year, number>;
  saasOxy: Record<Year, number>;
  saasOxyGenio: Record<Year, number>;
  educationDonoCFO: Record<Year, number>;
  baas: Record<Year, number>;
}

export interface Assumptions {
  caasClients: Record<Year, number>;
  saasClients: Record<Year, number>;
  educationClients: Record<Year, number>;
  subProductClients: SubProductClients;
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
  headcountSalaries: Record<string, number>;
  sgaGrowthRate: number;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  caasClients: { 2025: 167, 2026: 272, 2027: 768, 2028: 2136, 2029: 4171, 2030: 6472 },
  saasClients: { 2025: 226, 2026: 631, 2027: 2293, 2028: 7992, 2029: 19471, 2030: 37918 },
  educationClients: { 2025: 49, 2026: 145, 2027: 605, 2028: 2373, 2029: 5292, 2030: 9504 },
  subProductClients: {
    caasAssessoria:  { 2025: 21, 2026: 78, 2027: 188, 2028: 525, 2029: 1127, 2030: 1886 },
    caasEnterprise:  { 2025: 65, 2026: 130, 2027: 315, 2028: 879, 2029: 1887, 2030: 3157 },
    caasCorporate:   { 2025: 6, 2026: 15, 2027: 37, 2028: 104, 2029: 223, 2030: 373 },
    caasSetup:       { 2025: 75, 2026: 49, 2027: 228, 2028: 628, 2029: 934, 2030: 1056 },
    saasOxy:         { 2025: 55, 2026: 289, 2027: 936, 2028: 3358, 2029: 8177, 2030: 15709 },
    saasOxyGenio:    { 2025: 47, 2026: 186, 2027: 539, 2028: 1824, 2029: 4061, 2030: 7849 },
    educationDonoCFO:{ 2025: 26, 2026: 101, 2027: 394, 2028: 1562, 2029: 3952, 2030: 7570 },
    baas:            { 2025: 0, 2026: 0, 2027: 960, 2028: 6840, 2029: 25264, 2030: 65340 },
  },
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
  headcountSalaries: {
    'CFOs': 8500,
    'PMO Directors': 12000,
    'Sales Team': 6000,
    'Tech Team': 9000,
    'Customer Service': 4500,
    'Operations': 5500,
  },
  sgaGrowthRate: 10,
};

// Base annual data (R$ thousands)
export const BASE_ANNUAL_DATA = {
  grossRevenue:     { 2025: 13777, 2026: 34250, 2027: 103707, 2028: 337072, 2029: 785967, 2030: 1460172 },
  netRevenue:       { 2025: 12447, 2026: 30945, 2027: 87892,  2028: 285669, 2029: 666107, 2030: 1237496 },
  grossProfit:      { 2025: 9679,  2026: 23643, 2027: 68276,  2028: 229690, 2029: 540218, 2030: 1010705 },
  ebitda:           { 2025: 1360,  2026: 7136,  2027: 6605,   2028: 18606,  2029: 41855,  2030: 118380  },
  netIncome:        { 2025: -174,  2026: 3409,  2027: 4357,   2028: 12268,  2029: 27589,  2030: 78046   },
  operatingCashFlow:{ 2025: -730,  2026: 2216,  2027: 2878,   2028: 9173,   2029: 21896,  2030: 68736   },
};

export const TOTAL_CLIENTS: Record<Year, number> = {
  2025: 442, 2026: 1048, 2027: 5439, 2028: 23634, 2029: 66172, 2030: 143059
};

export const GROSS_MARGINS: Record<Year, number> = {
  2025: 77.8, 2026: 76.4, 2027: 77.7, 2028: 80.4, 2029: 81.1, 2030: 81.7
};

export const NET_MARGINS: Record<Year, number> = {
  2025: -1.4, 2026: 11.0, 2027: 5.0, 2028: 4.3, 2029: 4.1, 2030: 6.3
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
  netIncome: Record<Year, number>;
  operatingCashFlow: Record<Year, number>;
  totalClients: Record<Year, number>;
  grossMargins: Record<Year, number>;
  netMargins: Record<Year, number>;
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
    netIncome: {} as Record<Year, number>,
    operatingCashFlow: {} as Record<Year, number>,
    totalClients: {} as Record<Year, number>,
    grossMargins: {} as Record<Year, number>,
    netMargins: {} as Record<Year, number>,
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
    projections.netIncome[year] = Math.round(BASE_ANNUAL_DATA.netIncome[year] * revenueScale);
    projections.operatingCashFlow[year] = Math.round(BASE_ANNUAL_DATA.operatingCashFlow[year] * revenueScale);
    projections.totalClients[year] = assumptions.caasClients[year] + assumptions.saasClients[year] + assumptions.educationClients[year];
    projections.grossMargins[year] = GROSS_MARGINS[year];
    projections.netMargins[year] = NET_MARGINS[year];
  }

  return projections;
}



export const SUB_PRODUCT_LABELS: Record<keyof SubProductClients, string> = {
  caasAssessoria: 'CaaS Assessoria',
  caasEnterprise: 'CaaS Enterprise',
  caasCorporate: 'CaaS Corporate',
  caasSetup: 'CaaS Setup',
  saasOxy: 'SaaS Oxy',
  saasOxyGenio: 'SaaS Oxy+Gênio',
  educationDonoCFO: 'Education Dono CFO',
  baas: 'BaaS',
};
