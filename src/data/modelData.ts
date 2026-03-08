/**
 * O2 Inc — Raw Model Data (Source of Truth)
 * All values extracted from Excel v7. Do not modify unless updating the model.
 */

// ─── CLIENT GROWTH: Monthly active clients Jan–Dec 2025 ───
export const clientsBase2025 = {
  caas: {
    assessoria: [0, 0, 0, 6.37, 9, 13, 18, 24, 31, 39, 48, 58],
    enterprise: [30.43, 33.47, 36.52, 45.31, 49.84, 54.83, 60.31, 66.34, 72.98, 80.27, 88.30, 97.13],
    corporate:  [3.60, 3.96, 4.32, 5.36, 5.90, 6.49, 7.13, 7.85, 8.63, 9.50, 10.44, 11.49],
    setup:      [0, 3, 3, 16, 8, 10, 11, 10, 11, 13, 13, 14],
    parceiros:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  saas: {
    oxy:       [0, 0, 0, 47.21, 53.81, 60.41, 67.01, 73.60, 80.20, 86.80, 93.39, 99.99],
    oxyGenio:  [0, 0, 0, 16.21, 23.90, 31.60, 39.29, 47.98, 56.68, 65.38, 74.07, 82.77],
    setup:     [0, 0, 0, 0, 7, 7, 7, 7, 7, 7, 7, 7],
    parceiros: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  education: {
    donoCfo: [0, 0, 0, 22.94, 25.23, 27.75, 30.53, 33.58, 36.94, 40.63, 44.70, 49.17],
    outros:  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  baas: {
    assinatura: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    custodia:   [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
};

// ─── AVERAGE TICKETS (BRL/month, fixed unless user edits) ───
export const avgTicket = {
  caas: {
    assessoria: 2000,
    enterprise: 9210,
    corporate:  15570,
    setup:      15000,
    parceiros:  0,
  },
  saas: {
    oxy:      1297,
    oxyGenio: 1997,
    setup:    15000,
    parceiros: 0,
  },
  education: {
    donoCfo:        397,
    diagnostico360: 1997,
    engNegocio:     7500,
    finRaiz:        2997,
  },
  baas: {
    assinatura: 229,
    custodia:   0.20,
  },
};

// ─── CHURN RATES (annual) ───
export const churnAnnual = {
  caas:      0.05,
  saas:      0.05,
  education: 0.00,
  baas:      0.00,
};

// ─── SALES DEDUCTIONS (% of Gross Revenue) ───
export const salesDeductions = {
  pis:       0.0065,
  cofins:    0.0300,
  iss:       0.0500,
  discounts: 0.0100,
  totalRate: 0.0965,
};

// ─── COGS monthly values Jan–Dec 2025 (BRL, negative) ───
export const cogsMonthly2025 = {
  caas:            [-95000, -98500, -68500, -122000, -130500, -150500, -185500, -220500, -268500, -326000, -393500, -469500],
  customerService: [-6500, 0, -4000, -8000, -12000, -12000, -16000, -22000, -30000, -40000, -52000, -65000],
  saas:            [-13800, -13800, -13800, -17800, -24700, -39450, -47450, -47450, -47450, -47450, -47450, -47450],
  education:       [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  baas:            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

// ─── SALES COMMISSIONS (% of Gross Revenue) ───
export const commissionRate = {
  caas:      0.03,  // from March 2025 onward (0% Jan-Feb)
  saas:      0.03,
  education: 0.03,
  baas:      0.03,
};

// ─── CAC PER CLIENT (BRL) ───
export const cacPerClient = {
  caas:      11462.61,
  saas:      8766.00,
  education: 2046.00,
  baas:      2415.00,
};

// ─── MARKETING HEADCOUNT COST ───
export const marketingHeadcount = {
  caas: -9700,
};

// ─── CAC BY SECTOR (for display) ───
export const cacBySector = [
  { sector: 'Agtech',              cac: 3804 },
  { sector: 'Adtech',              cac: 3456 },
  { sector: 'Aviation & Defense',  cac: 3150 },
  { sector: 'Automotive',          cac: 2568 },
  { sector: 'Fintech (SaaS)',      cac: 8766 },
  { sector: 'Edtech',              cac: 2046 },
  { sector: 'BaaS',                cac: 2415 },
];

// ─── SG&A MONTHLY VALUES (BRL, 2025 base) ───
export const sgaMonthly2025 = {
  '4.02_energia':     -1354.49,
  '4.03_internet':    -429.83,
  '4.04_aluguel':     -6244.50,
  '4.05_condominio':  -2772.54,
  '4.07_materiais':   -1427.75,
  '4.08_higiene':     -2000.00,
  '4.10_maquinas':    -4286.00,
  '4.11_contabil':    -2084.50,
  '4.13_juridica':    -1000.00,
  '4.15_seguros':     -513.48,
  '4.18_eventos':     -832.52,
  '4.22_alimentacao': -21260.20,
  '4.25_softwares':   -10866.72,
  '4.26_badDebt':     0, // computed: -2% × Net Revenue
};

// ─── SG&A GROWTH RATES (YoY) ───
export const sgaGrowthRates: Record<string, number> = {
  '4.02_energia':    0.10,
  '4.03_internet':   0.10,
  '4.04_aluguel':    0.10,
  '4.05_condominio': 0.10,
  '4.25_softwares':  0.10,
  default:           0.10,
};

// ─── NAMED EMPLOYEES 2025 ───
export const namedEmployees2025 = [
  { name: 'Pedro Albite',       role: 'CEO',          bu: 'Management',     salary: 24100,  costCode: '5.01' },
  { name: 'Tiago Pisoni',       role: 'COO',          bu: 'Management',     salary: 25895,  costCode: '5.01' },
  { name: 'João Freitas',       role: 'CTO',          bu: 'Management',     salary: 20000,  costCode: '5.01' },
  { name: 'Rafael Fleck',       role: 'CMO',          bu: 'Management',     salary: 18000,  costCode: '5.01' },
  { name: 'Adivilso Oliveira',  role: 'CFO',          bu: 'CaaS',           salary: 12000,  costCode: '3.1.1' },
  { name: 'Douglas Schossler',  role: 'CFO',          bu: 'CaaS',           salary: 20000,  costCode: '3.1.1' },
  { name: 'Pedro Martins',      role: 'CFO',          bu: 'CaaS',           salary: 20000,  costCode: '3.1.1' },
  { name: "Eduardo D'Agostini", role: 'CFO',          bu: 'CaaS',           salary: 11000,  costCode: '3.1.1' },
  { name: 'Fernando de Paula',  role: 'CFO',          bu: 'CaaS',           salary: 12000,  costCode: '3.1.1' },
  { name: 'Pedro Ritter',       role: 'CFO',          bu: 'CaaS',           salary: 7000,   costCode: '3.1.1' },
  { name: 'Jefferson Caruso',   role: 'FP&A',         bu: 'CaaS',           salary: 6000,   costCode: '3.1.1' },
  { name: 'Rafaelli Fink',      role: 'FP&A',         bu: 'CaaS',           salary: 6500,   costCode: '3.1.1' },
  { name: 'José Roberto',       role: 'FP&A',         bu: 'CaaS',           salary: 4000,   costCode: '3.1.1' },
  { name: 'Bruno Ketzer',       role: 'Customer Svc', bu: 'Customer Svc',   salary: 6500,   costCode: '3.1.2' },
  { name: 'Leonardo Rezende',   role: 'IT',           bu: 'IT',             salary: 5500,   costCode: '3.1.3' },
  { name: 'Pedro Santiago',     role: 'IT',           bu: 'IT',             salary: 8300,   costCode: '3.1.3' },
  { name: 'Eduarda Vilanova',   role: 'People',       bu: 'Administrative', salary: 6000,   costCode: '5.01' },
  { name: 'Eduarda Rovani',     role: 'Marketing',    bu: 'Marketing',      salary: 6500,   costCode: '7.01' },
  { name: 'Rafaela Mendes',     role: 'Marketing',    bu: 'Marketing',      salary: 3200,   costCode: '7.01' },
  { name: 'Frank Martins',      role: 'Finance',      bu: 'Administrative', salary: 6000,   costCode: '5.01' },
  { name: 'Eduardo Pedrolo',    role: 'Admin',        bu: 'Administrative', salary: 12000,  costCode: '5.01' },
  { name: 'Mauricio Daneluz',   role: 'Admin',        bu: 'Administrative', salary: 7500,   costCode: '5.01' },
];

// ─── SALARY RANGES FOR FUTURE HIRES ───
export const salaryRanges: Record<string, number> = {
  'Project Finance Director': 25000,
  'CFO':                      15000,
  'FP&A Analyst':             5000,
  'Project Analyst':          3500,
  'Data Processes Analyst':   5000,
  'Customer Service':         4000,
  'Senior Fullstack':         8300,
  'Pleno Fullstack':          5500,
  'AI Engineer':              18000,
  'DevOps':                   11500,
  'UX Designer':              8000,
  'PMO':                      16000,
};

// ─── HEADCOUNT RATIOS (1 person per N clients) ───
export const headcountRatios = {
  clientsPerPF:          100,
  clientsPerCFO:         15,
  clientsPerFPA:         15,
  clientsPerProjectAnal: 50,
  clientsPerDataAnal:    50,
  clientsPerCSM:         54,
};

// ─── COMMERCIAL EXPENSES MONTHLY (BRL, 2025 base) ───
export const commercialExpenses2025 = {
  '6.03_softwares':    -1464.13,
  '6.04_alimentacao':  0,
  '6.05_deslocamento': -1318.32,
  '6.06_hospedagem':   -2632.91,
  '6.08_assessoria':   -11367.00,
};

// ─── TAX RATES ───
export const taxRates = {
  csll: 0.09,
  irpj: 0.25,
  combinedEBT: 0.34,
};

// ─── FINANCIAL/REVENUE TAXES ───
export const revenueTaxes = {
  boletoPerClient: 14.34,
};

// ─── DEBT SCHEDULE ───
export const debtSchedule = [
  {
    name:       'PRONAMP',
    creditor:   'CEF',
    account:    '11.01',
    category:   'bank' as const,
    outstanding:    119459.12,
    monthlyPayment: 3853.52,
    finalDate:      '2027-07',
    interestRate:   0.012,
    remainingInstallments: 31,
  },
  {
    name:       'FAMPE',
    creditor:   'CEF',
    account:    '11.01',
    category:   'bank' as const,
    outstanding:    31705.50,
    monthlyPayment: 5284.25,
    finalDate:      '2025-06',
    interestRate:   0.012,
    remainingInstallments: 6,
  },
  {
    name:       'Empréstimo 234411204',
    creditor:   'Santander',
    account:    '11.01',
    category:   'bank' as const,
    outstanding:    160214.18,
    monthlyPayment: 3269.67,
    finalDate:      '2029-01',
    interestRate:   0.012,
    remainingInstallments: 49,
    startMonth:     3,
  },
  {
    name:       'Imóvel Reserva Bela Vista',
    creditor:   'Melnick',
    account:    '12.04',
    category:   'bank' as const,
    outstanding:    185283.74,
    monthlyPayment: 989.69,
    interestRate:   0.012,
    remainingInstallments: 132,
  },
  {
    name:       'Negociação Debentures',
    creditor:   'Karen',
    account:    '11.03',
    category:   'investor' as const,
    outstanding:    53494.10,
    monthlyPayment: 2057.47,
    finalDate:      '2027-02',
    interestRate:   0.00,
    remainingInstallments: 26,
  },
  {
    name:       'Negociação Caramello+EPG',
    creditor:   'Guardian',
    account:    '11.03',
    category:   'investor' as const,
    outstanding:    119130.00,
    monthlyPayment: 5000.00,
    finalDate:      '2026-04',
    interestRate:   0.00,
    remainingInstallments: 13,
  },
];

// ─── TAX DEBT (outstanding Jan 2025) ───
export const taxDebtItems = [
  { name: 'IRPJ 4º tri 2024',    creditor: 'Receita Federal', amount: 11894.92, dueDate: '2025-01-31' },
  { name: 'CSLL 4º tri 2024',    creditor: 'Receita Federal', amount: 5446.91,  dueDate: '2025-01-31' },
  { name: 'ISS Dezembro 2024',   creditor: 'Prefeitura SP',   amount: 14281.89, dueDate: '2025-01-10' },
  { name: 'IRPJ 4º tri 2024 #2', creditor: 'Receita Federal', amount: 45637.12, dueDate: '2025-01-31' },
  { name: 'CSLL 4º tri 2024 #2', creditor: 'Receita Federal', amount: 14947.16, dueDate: '2025-01-31' },
  { name: 'ISS Dezembro 2024 #2',creditor: 'Prefeitura SP',   amount: 4017.77,  dueDate: '2025-01-10' },
  { name: 'IRPJ 4º tri 2024 #3', creditor: 'Receita Federal', amount: 4685.58,  dueDate: '2025-01-31' },
  { name: 'CSLL 4º tri 2024 #3', creditor: 'Receita Federal', amount: 2698.09,  dueDate: '2025-01-31' },
];

// ─── SELIC RATES (annual, for BaaS Custodia yield calculation) ───
export const selicRates: Record<number, number> = {
  2025: 0.15,
  2026: 0.125,
  2027: 0.105,
  2028: 0.10,
  2029: 0.1297,
  2030: 0.1297,
};

// ─── BaaS CUSTODIA PARAMETERS ───
export const baasCustodia = {
  avgPmeCash: 20039,       // Average PME cash balance (R$)
  custodyFeeRate: 0.002,   // 0.2% of AUM
};

// ─── SaaS SETUP CLIENTS (for years > 2025) ───
export const saasSetupClients: Record<number, number[]> = {
  2025: [0, 0, 0, 0, 7, 7, 7, 7, 7, 7, 7, 7],
  2026: [22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22],
  2027: [97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97, 97],
  2028: [361, 361, 361, 361, 361, 361, 361, 361, 361, 361, 361, 361],
  2029: [787, 787, 787, 787, 787, 787, 787, 787, 787, 787, 787, 787],
  2030: [1345, 1345, 1345, 1345, 1345, 1345, 1345, 1345, 1345, 1345, 1345, 1345],
};

// ─── SCENARIO MULTIPLIERS ───
export const scenarioMultipliers = {
  base: { revenue: 1.00, cost: 1.00 },
  bull: { revenue: 1.20, cost: 1.00 },
  bear: { revenue: 0.80, cost: 1.00 },
};

// ─── BENEFITS MONTHLY (2025) ───
export const benefitsMonthly2025 = [5980, 5400, 7500, 7500, 7500, 7500, 7500, 7500, 7500, 7500, 7500, 7500];

// ─── BASE PAYROLL 2025 ───
export const basePayroll2025 = namedEmployees2025
  .filter(e => e.costCode === '5.01')
  .reduce((s, e) => s + e.salary, 0); // ~113,600

// ─── EXPECTED ANNUAL OUTPUTS (for validation, R$ thousands) ───
export const expectedOutputs = {
  grossRevenue:   { 2025: 13777, 2026: 34250, 2027: 103707, 2028: 337072, 2029: 785967, 2030: 1460172 },
  netRevenue:     { 2025: 12447, 2026: 30945, 2027: 87892,  2028: 285669, 2029: 666107, 2030: 1237496 },
  grossProfit:    { 2025: 9679,  2026: 23643, 2027: 68276,  2028: 229690, 2029: 540218, 2030: 1010705 },
  ebitda:         { 2025: 1360,  2026: 7136,  2027: 6605,   2028: 18606,  2029: 41855,  2030: 118380  },
  grossMarginPct: { 2025: 77.8,  2026: 76.4,  2027: 77.7,   2028: 80.4,   2029: 81.1,   2030: 81.7   },
  ebitdaMarginPct:{ 2025: 10.9,  2026: 23.1,  2027: 7.5,    2028: 6.5,    2029: 6.3,    2030: 9.6    },
  totalClients:   { 2025: 442,   2026: 1048,  2027: 5439,   2028: 23634,  2029: 66172,  2030: 143059 },
};
