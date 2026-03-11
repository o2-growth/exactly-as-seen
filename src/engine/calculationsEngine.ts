/**
 * O2 Inc — Calculations Engine
 * Computes all P&L, Cash Flow, and KPI values from raw model data.
 * Replaces hardcoded values with formula-driven calculations.
 */

import { Year, YEARS, Assumptions, DEFAULT_ASSUMPTIONS, Scenario } from '@/lib/financialData';
import { PnlNode } from '@/lib/pnlData';
import {
  clientsBase2025, avgTicket, churnAnnual, salesDeductions, salesDeductionsByYear,
  cogsMonthly2025, commissionRate, cacPerClient, marketingHeadcount, sgaMonthly2025,
  commercialExpenses2025, taxRates, revenueTaxes, debtSchedule,
  scenarioMultipliers, benefitsMonthly2025, basePayroll2025, headcountRatios,
  salaryRanges, expectedOutputs, saasSetupClients, namedEmployees2025,
  financialItems2025, outrosExpenses2025,
} from '@/data/modelData';

// ─── TYPES ───

export interface MonthlyPnL {
  grossRevenue: number;
  caasRevenue: number;
  saasRevenue: number;
  educationRevenue: number;
  baasRevenue: number;
  deductions: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  commissions: number;
  marketing: number;
  contributionMargin: number;
  sga: number;
  headcount: number;
  commercial: number;
  otherExpenses: number;
  ebitda: number;
  financialResult: number;
  ebt: number;
  taxes: number;
  netIncome: number;
  debtPayments: number;
  capex: number;
  finalResult: number;
  totalClients: number;
}

export interface AnnualOutput {
  grossRevenue: number;
  caasRevenue: number;
  saasRevenue: number;
  educationRevenue: number;
  baasRevenue: number;
  deductions: number;
  netRevenue: number;
  cogs: number;
  cogsDetail: { caas: number; customerService: number; saas: number; education: number; baas: number };
  grossProfit: number;
  grossMarginPct: number;
  commissions: number;
  marketing: number;
  marketingDetail: { caas: number; saas: number; education: number; baas: number };
  contributionMargin: number;
  contributionMarginPct: number;
  sga: number;
  headcount: number;
  headcountDetail: { salaries: number; benefits: number };
  commercial: number;
  otherExpenses: number;
  ebitda: number;
  ebitdaMarginPct: number;
  financialResult: number;
  ebt: number;
  taxes: number;
  taxDetail: { irpj: number; csll: number };
  netIncome: number;
  netMarginPct: number;
  debtPayments: number;
  debtDetail: { loans: number; suppliers: number };
  capex: number;
  capexDetail: { software: number; realestate: number };
  finalResult: number;
  receivablesChange: number;
  totalClients: number;
  monthlyData: MonthlyPnL[];
  // Sub-revenue detail
  revenueDetail: {
    caasAssessoria: number; caasEnterprise: number; caasCorporate: number; caasSetup: number;
    saasOxy: number; saasOxyGenio: number; saasSetup: number;
    educationDonoCfo: number;
    baasAssinatura: number;
  };
}

export interface FullModelOutput {
  years: Record<Year, AnnualOutput>;
  pnlTree: PnlNode[];
}

// ─── HELPER: Get monthly clients for a product ───

function getDecClients2025(bu: string, product: string): number {
  const buData = (clientsBase2025 as any)[bu];
  if (!buData || !buData[product]) return 0;
  return buData[product][11] || 0;
}

function getMonthlyClientCount(bu: string, product: string, month: number, year: number, assumptions: Assumptions): number {
  // month is 0-indexed (0=Jan, 11=Dec)
  if (year === 2025) {
    const arr = (clientsBase2025 as any)[bu]?.[product];
    return arr ? arr[month] : 0;
  }

  // For years > 2025: interpolate from previous year-end to current year-end
  // Use assumptions subProductClients for end-of-year targets
  const keyMap: Record<string, string> = {
    'caas.assessoria': 'caasAssessoria', 'caas.enterprise': 'caasEnterprise',
    'caas.corporate': 'caasCorporate', 'caas.setup': 'caasSetup',
    'saas.oxy': 'saasOxy', 'saas.oxyGenio': 'saasOxyGenio',
    'education.donoCfo': 'educationDonoCFO', 'baas.assinatura': 'baas',
  };
  const subKey = keyMap[`${bu}.${product}`];
  if (!subKey) return 0;

  const prevYear = (year - 1) as Year;
  let startClients: number;
  if (prevYear === 2025) {
    startClients = getDecClients2025(bu, product);
  } else if (YEARS.includes(prevYear)) {
    startClients = (assumptions.subProductClients as any)[subKey]?.[prevYear] ?? 0;
  } else {
    startClients = 0;
  }

  const endClients = (assumptions.subProductClients as any)[subKey]?.[year] ?? 0;
  // Linear interpolation within the year
  return startClients + (endClients - startClients) * ((month + 1) / 12);
}

// ─── REVENUE ───

function calcMonthlyRevenue(month: number, year: number, assumptions: Assumptions, scenarioMult: number) {
  const t = assumptions.tickets;

  const caasAssessoria = getMonthlyClientCount('caas', 'assessoria', month, year, assumptions) * t.caasAssessoria;
  const caasEnterprise = getMonthlyClientCount('caas', 'enterprise', month, year, assumptions) * t.caasEnterprise;
  const caasCorporate  = getMonthlyClientCount('caas', 'corporate', month, year, assumptions) * t.caasCorporate;
  const caasSetup      = getMonthlyClientCount('caas', 'setup', month, year, assumptions) * t.caasSetup;
  const caasTotal = caasAssessoria + caasEnterprise + caasCorporate + caasSetup;

  const saasOxy     = getMonthlyClientCount('saas', 'oxy', month, year, assumptions) * t.saasOxy;
  const saasOxyGenio= getMonthlyClientCount('saas', 'oxyGenio', month, year, assumptions) * t.saasOxyGenio;
  // SaaS setup: use monthly setup clients from model data
  const saasSetupArr = saasSetupClients[year] || saasSetupClients[2025];
  const saasSetup   = (saasSetupArr[month] || 0) * avgTicket.saas.setup;
  const saasTotal = saasOxy + saasOxyGenio + saasSetup;

  const eduDonoCfo = getMonthlyClientCount('education', 'donoCfo', month, year, assumptions) * t.educationDonoCFO;
  const eduTotal = eduDonoCfo;

  const baas = getMonthlyClientCount('baas', 'assinatura', month, year, assumptions) * t.baas;

  const grandTotal = (caasTotal + saasTotal + eduTotal + baas) * scenarioMult;

  return {
    caasAssessoria: caasAssessoria * scenarioMult,
    caasEnterprise: caasEnterprise * scenarioMult,
    caasCorporate: caasCorporate * scenarioMult,
    caasSetup: caasSetup * scenarioMult,
    caas: caasTotal * scenarioMult,
    saasOxy: saasOxy * scenarioMult,
    saasOxyGenio: saasOxyGenio * scenarioMult,
    saasSetup: saasSetup * scenarioMult,
    saas: saasTotal * scenarioMult,
    education: eduTotal * scenarioMult,
    educationDonoCfo: eduDonoCfo * scenarioMult,
    baas: baas * scenarioMult,
    baasAssinatura: baas * scenarioMult,
    total: grandTotal,
  };
}

// ─── TOTAL ACTIVE CLIENTS ───

function calcTotalClients(month: number, year: number, assumptions: Assumptions): number {
  const products = [
    ['caas', 'assessoria'], ['caas', 'enterprise'], ['caas', 'corporate'], ['caas', 'setup'],
    ['saas', 'oxy'], ['saas', 'oxyGenio'],
    ['education', 'donoCfo'],
    ['baas', 'assinatura'],
  ];
  return products.reduce((sum, [bu, prod]) => sum + getMonthlyClientCount(bu, prod, month, year, assumptions), 0);
}

// ─── COGS ───

function calcMonthlyCOGS(month: number, year: number, revenueScale: number, baasClients: number) {
  if (year === 2025) {
    return {
      caas: cogsMonthly2025.caas[month] / 1000,
      customerService: cogsMonthly2025.customerService[month] / 1000,
      saas: cogsMonthly2025.saas[month] / 1000,
      education: cogsMonthly2025.education[month] / 1000,
      baas: cogsMonthly2025.baas[month] / 1000,
    };
  }
  // For later years, scale COGS with revenue growth
  const yearMult = revenueScale;
  const base = {
    caas: (cogsMonthly2025.caas.reduce((s, v) => s + v, 0) / 12) / 1000,
    customerService: (cogsMonthly2025.customerService.reduce((s, v) => s + v, 0) / 12) / 1000,
    saas: (cogsMonthly2025.saas.reduce((s, v) => s + v, 0) / 12) / 1000,
    education: 0,
  };
  // BaaS COGS: ~R$25 per BaaS client/month (processing, compliance, banking fees)
  // Starts from 2025
  const baasCogs = year >= 2025 ? -(baasClients * 25) / 1000 : 0;

  return {
    caas: base.caas * yearMult,
    customerService: base.customerService * yearMult,
    saas: base.saas * yearMult,
    education: base.education * yearMult,
    baas: baasCogs,
  };
}

// ─── SG&A ───

// Helper: get value from SGA item (array or scalar) for a given month
function getSgaValue(key: string, month: number): number {
  const v = sgaMonthly2025[key];
  if (Array.isArray(v)) return v[month];
  return v as number;
}

function calcMonthlySGA(month: number, year: number, grossRevenue: number, totalHeadcount: number): number {
  const yearMult = Math.pow(1.10, year - 2025);

  // Items that scale with 10% YoY (truly fixed costs)
  // For 2025, use monthly values; for later years, use Feb-Nov base × yearMult
  const fixedKeys = [
    '4.02_energia', '4.03_internet', '4.04_aluguel', '4.05_condominio',
    '4.07_materiais', '4.08_higiene', '4.11_contabil', '4.13_juridica',
    '4.22_alimentacao',
  ];
  let sgaFixed: number;
  if (year === 2025) {
    sgaFixed = fixedKeys.reduce((s, k) => s + getSgaValue(k, month), 0) / 1000;
  } else {
    // Use a stable base (Feb value for arrays, scalar for others)
    sgaFixed = fixedKeys.reduce((s, k) => {
      const v = sgaMonthly2025[k];
      const base = Array.isArray(v) ? v[1] : v as number; // Feb as base
      return s + base;
    }, 0) * yearMult / 1000;
  }

  // Assessoria RH (4.14)
  let assessoriaRH: number;
  if (year === 2025) {
    assessoriaRH = getSgaValue('4.14_assessoriaRH', month) / 1000;
  } else {
    assessoriaRH = -300 * yearMult / 1000;
  }

  // Insurance (4.15) — monthly array handles Jan-Mar 2025, 0 after
  let insurance: number;
  if (year === 2025) {
    insurance = getSgaValue('4.15_seguros', month) / 1000;
  } else {
    insurance = 0;
  }

  // Items that scale proportionally to headcount (not flat 10% YoY)
  const baseHC = 22; // 2025 base headcount
  const hcRatio = Math.max(1, totalHeadcount / baseHC);
  const hcScaledItems = [
    sgaMonthly2025['4.10_maquinas'] as number,  // Notebooks/machines
    sgaMonthly2025['4.25_softwares'] as number, // Google email, software licenses
  ];
  const sgaHcScaled = hcScaledItems.reduce((s, v) => s + v, 0) * hcRatio / 1000;

  // Eventos also scale with headcount
  const eventosBase = sgaMonthly2025['4.18_eventos'] as number || -832.52;
  const eventos = eventosBase * hcRatio / 1000;

  // Bad debt = -2% of GROSS revenue (not net — Excel uses gross)
  const badDebt = -0.02 * Math.abs(grossRevenue);

  return sgaFixed + assessoriaRH + insurance + sgaHcScaled + eventos + badDebt;
}

// ─── HEADCOUNT ───

function calcMonthlyHeadcount(
  month: number, year: number,
  caasClients: number, caasSaasClients: number, totalClients: number
): { salaries: number; benefits: number } {
  const yearMult = Math.pow(1.10, year - 2025);

  // Base payroll (named employees, code 5.01)
  // Include temp employees only in their active months (2025 only)
  let basePay = basePayroll2025;
  if (year === 2025) {
    // Acivaldo (R$3,067) and Lorenzi (R$7,500) only in January
    if (month === 0) basePay += 3067 + 7500;
  }
  let salaries = basePay / 1000 * yearMult;

  // Additional hires based on client ratios
  // Excel uses CaaS-only clients for PF/CFO/FP&A, CaaS+SaaS for Project/Data/CSM
  const additionalCFOs = Math.max(0, Math.ceil(caasClients / headcountRatios.clientsPerCFO) - 9); // 9 existing
  const additionalFPA = Math.max(0, Math.ceil(caasClients / headcountRatios.clientsPerFPA) - 3);
  const additionalPF = Math.max(0, Math.ceil(caasClients / headcountRatios.clientsPerPF) - 0);
  const additionalProjectAnal = Math.max(0, Math.ceil(caasSaasClients / headcountRatios.clientsPerProjectAnal) - 0);
  const additionalDataAnal = Math.max(0, Math.ceil(caasSaasClients / headcountRatios.clientsPerDataAnal) - 0);
  const additionalCSM = Math.max(0, Math.ceil(caasSaasClients / headcountRatios.clientsPerCSM) - 1);

  // CaaS/Operations hires
  salaries += (additionalCFOs * salaryRanges['CFO'] +
    additionalFPA * salaryRanges['FP&A Analyst'] +
    additionalCSM * salaryRanges['Customer Service'] +
    additionalPF * salaryRanges['Project Finance Director'] +
    additionalProjectAnal * salaryRanges['Project Analyst'] +
    additionalDataAnal * salaryRanges['Data Processes Analyst']) / 1000;

  // Tech hires (scale with SaaS client growth)
  const saasScale = Math.max(0, Math.floor(caasSaasClients / 500)); // 1 batch per 500 clients
  const techHires = {
    seniorFullstack: Math.min(saasScale, 5),
    plenoFullstack: Math.min(saasScale * 2, 10),
    aiEngineer: Math.min(Math.floor(saasScale / 2), 3),
    devops: Math.min(Math.ceil(saasScale / 3), 3),
    uxDesigner: Math.min(Math.ceil(saasScale / 2), 4),
    pmo: Math.min(Math.ceil(saasScale / 4), 2),
  };
  salaries += (
    techHires.seniorFullstack * salaryRanges['Senior Fullstack'] +
    techHires.plenoFullstack * salaryRanges['Pleno Fullstack'] +
    techHires.aiEngineer * salaryRanges['AI Engineer'] +
    techHires.devops * salaryRanges['DevOps'] +
    techHires.uxDesigner * salaryRanges['UX Designer'] +
    techHires.pmo * salaryRanges['PMO']
  ) / 1000;

  // Total headcount for benefits calculation
  const baseHC = namedEmployees2025.filter(e => !('endMonth' in e)).length; // 22 permanent
  const totalHC = baseHC + additionalCFOs + additionalFPA + additionalCSM + additionalPF +
    additionalProjectAnal + additionalDataAnal +
    techHires.seniorFullstack + techHires.plenoFullstack + techHires.aiEngineer +
    techHires.devops + techHires.uxDesigner + techHires.pmo;

  // Benefits
  let benefits: number;
  if (year === 2025) {
    benefits = benefitsMonthly2025[month] / 1000;
  } else {
    benefits = totalHC * 901.10 / 1000 * yearMult;
  }

  return { salaries: -salaries, benefits: -benefits };
}

// ─── COMMERCIAL EXPENSES ───

// Helper: get value from commercial item (array or scalar) for a given month
function getCommercialValue(key: string, month: number): number {
  const v = commercialExpenses2025[key];
  if (Array.isArray(v)) return v[month];
  return v as number;
}

function calcMonthlyCommercial(month: number, year: number): number {
  const yearMult = Math.pow(1.10, year - 2025);
  const variableKeys = ['6.03_softwares', '6.04_alimentacao', '6.05_deslocamento', '6.06_hospedagem'];

  let variable: number;
  if (year === 2025) {
    variable = variableKeys.reduce((s, k) => s + getCommercialValue(k, month), 0) / 1000;
  } else {
    // Use Apr+ base values for projection (stable period)
    variable = variableKeys.reduce((s, k) => {
      const v = commercialExpenses2025[k];
      const base = Array.isArray(v) ? v[3] : v as number; // Apr as stable base
      return s + base;
    }, 0) * yearMult / 1000;
  }

  const assessoria = commercialExpenses2025['6.08_assessoria'] as number;
  const fixed = assessoria / 1000; // doesn't grow
  return variable + fixed;
}

// ─── DEBT PAYMENTS ───

function calcMonthlyDebtPayment(month: number, year: number): { loans: number; suppliers: number } {
  const absoluteMonth = (year - 2025) * 12 + month; // 0 = Jan 2025
  let loans = 0;
  let suppliers = 0;

  for (const d of debtSchedule) {
    if (absoluteMonth >= d.remainingInstallments) continue;
    if (d.account === '11.03') {
      suppliers -= d.monthlyPayment / 1000;
    } else if (d.account === '11.01') {
      // Santander starts March
      if (d.name === 'Empréstimo 234411204' && absoluteMonth < 2) continue;
      loans -= d.monthlyPayment / 1000;
    }
    // 12.04 (real estate) goes to capex, not debt
  }

  return { loans, suppliers };
}

// ─── CAPEX ───

function calcMonthlyCapex(month: number, year: number, saasCogsMonthly: number): { software: number; realestate: number } {
  // Software capex = % of SaaS COGS (tech investment)
  // 50% in 2025-2026, 30% in 2027+ (as per Excel model)
  const capexPct = year <= 2026 ? 0.50 : 0.30;
  const software = saasCogsMonthly * capexPct;

  // Real estate: Melnick installment
  const absoluteMonth = (year - 2025) * 12 + month;
  const melnick = debtSchedule.find(d => d.name === 'Imóvel Reserva Bela Vista');
  const realestate = melnick && absoluteMonth < melnick.remainingInstallments ? -melnick.monthlyPayment / 1000 : 0;

  return { software, realestate };
}

// ─── COMPUTE FULL YEAR ───

function computeYear(year: Year, assumptions: Assumptions, scenario: Scenario): AnnualOutput {
  const sMult = scenarioMultipliers[scenario.toLowerCase() as keyof typeof scenarioMultipliers] ?? scenarioMultipliers.base;

  const monthly: MonthlyPnL[] = [];
  let annualGrossRevenue = 0, annualCaas = 0, annualSaas = 0, annualEdu = 0, annualBaas = 0;
  let annualDeductions = 0, annualNetRevenue = 0, annualCogs = 0, annualGrossProfit = 0;
  let annualCommissions = 0, annualMarketing = 0, annualCM = 0;
  let annualSGA = 0, annualHC = 0, annualCommercial = 0, annualOther = 0;
  let annualEBITDA = 0, annualFinancial = 0, annualEBT = 0, annualTaxes = 0, annualNI = 0;
  let annualDebt = 0, annualCapex = 0, annualFinal = 0;

  let cogsD = { caas: 0, customerService: 0, saas: 0, education: 0, baas: 0 };
  let hcD = { salaries: 0, benefits: 0 };
  let mktD = { caas: 0, saas: 0, education: 0, baas: 0 };
  let taxD = { irpj: 0, csll: 0 };
  let debtD = { loans: 0, suppliers: 0 };
  let capexD = { software: 0, realestate: 0 };
  let revD = {
    caasAssessoria: 0, caasEnterprise: 0, caasCorporate: 0, caasSetup: 0,
    saasOxy: 0, saasOxyGenio: 0, saasSetup: 0,
    educationDonoCfo: 0, baasAssinatura: 0,
  };
  let lastClients = 0;

  // Compute revenue scale for COGS scaling (for years > 2025)
  const baseAnnualRev2025 = expectedOutputs.grossRevenue[2025];
  // Quick estimate of this year's revenue for scaling
  let estRevenue = 0;
  for (let m = 0; m < 12; m++) {
    const rev = calcMonthlyRevenue(m, year, assumptions, sMult.revenue);
    estRevenue += rev.total / 1000;
  }
  const revenueScale = baseAnnualRev2025 > 0 ? estRevenue / baseAnnualRev2025 : 1;

  for (let m = 0; m < 12; m++) {
    const rev = calcMonthlyRevenue(m, year, assumptions, sMult.revenue);
    const grossRev = rev.total / 1000; // Convert to R$ thousands

    // Revenue detail
    revD.caasAssessoria += rev.caasAssessoria / 1000;
    revD.caasEnterprise += rev.caasEnterprise / 1000;
    revD.caasCorporate += rev.caasCorporate / 1000;
    revD.caasSetup += rev.caasSetup / 1000;
    revD.saasOxy += rev.saasOxy / 1000;
    revD.saasOxyGenio += rev.saasOxyGenio / 1000;
    revD.saasSetup += rev.saasSetup / 1000;
    revD.educationDonoCfo += rev.educationDonoCfo / 1000;
    revD.baasAssinatura += rev.baasAssinatura / 1000;

    const caasRev = rev.caas / 1000;
    const saasRev = rev.saas / 1000;
    const eduRev = rev.education / 1000;
    const baasRev = rev.baas / 1000;

    // Deductions (rate changes at 2027: Lucro Presumido → Lucro Real)
    const dedRate = salesDeductionsByYear[year] ?? salesDeductions.totalRate;
    const ded = -grossRev * dedRate;

    // Net revenue
    const netRev = grossRev + ded;

    // COGS (pass BaaS clients for BaaS COGS calculation)
    const baasClientsM = getMonthlyClientCount('baas', 'assinatura', m, year, assumptions);
    const cogs = calcMonthlyCOGS(m, year, revenueScale, baasClientsM);
    const totalCogs = cogs.caas + cogs.customerService + cogs.saas + cogs.education + cogs.baas;

    // Gross profit
    const gp = netRev + totalCogs;

    // Commissions (from March for CaaS)
    const commCaas = (year === 2025 && m < 2) ? 0 : -caasRev * commissionRate.caas;
    const commSaas = -saasRev * commissionRate.saas;
    const commEdu = -eduRev * commissionRate.education;
    const totalComm = commCaas + commSaas + commEdu;

    // Marketing (CAC × new clients + HC costs)
    const totalClientsM = calcTotalClients(m, year, assumptions);
    const prevClients = m > 0 ? calcTotalClients(m - 1, year, assumptions) :
      (year > 2025 ? calcTotalClients(11, year - 1, assumptions) : 0);
    const newClients = Math.max(0, totalClientsM - prevClients);

    const mktCaas = (-newClients * 0.4 * cacPerClient.caas + marketingHeadcount.caas) / 1000;
    const mktSaas = (-newClients * 0.35 * cacPerClient.saas) / 1000;
    const mktEdu = (-newClients * 0.15 * cacPerClient.education) / 1000;
    const mktBaas = (-newClients * 0.10 * cacPerClient.baas) / 1000;
    const totalMkt = mktCaas + mktSaas + mktEdu + mktBaas;

    // Contribution margin
    const cm = gp + totalComm + totalMkt;

    // Calculate client counts by BU for headcount ratios
    const caasClientsM = getMonthlyClientCount('caas', 'assessoria', m, year, assumptions)
      + getMonthlyClientCount('caas', 'enterprise', m, year, assumptions)
      + getMonthlyClientCount('caas', 'corporate', m, year, assumptions);
    const saasClientsM = getMonthlyClientCount('saas', 'oxy', m, year, assumptions)
      + getMonthlyClientCount('saas', 'oxyGenio', m, year, assumptions);
    const caasSaasClientsM = caasClientsM + saasClientsM;

    // Headcount (uses CaaS-only for CFO/FP&A/PF, CaaS+SaaS for others)
    const hc = calcMonthlyHeadcount(m, year, caasClientsM, caasSaasClientsM, totalClientsM);
    const totalHC = hc.salaries + hc.benefits;

    // Estimate total headcount for SG&A scaling
    const baseHC = 22;
    const addCFOs = Math.max(0, Math.ceil(caasClientsM / headcountRatios.clientsPerCFO) - 9);
    const addFPA = Math.max(0, Math.ceil(caasClientsM / headcountRatios.clientsPerFPA) - 3);
    const addCSM = Math.max(0, Math.ceil(caasSaasClientsM / headcountRatios.clientsPerCSM) - 1);
    const saasScale = Math.max(0, Math.floor(caasSaasClientsM / 500));
    const estTotalHC = baseHC + addCFOs + addFPA + addCSM +
      Math.min(saasScale, 5) + Math.min(saasScale * 2, 10) +
      Math.min(Math.floor(saasScale / 2), 3) + Math.min(Math.ceil(saasScale / 3), 3);

    // SG&A (uses gross revenue for PDD, headcount for scaling)
    const sga = calcMonthlySGA(m, year, grossRev, estTotalHC);

    // Commercial
    const commercial = calcMonthlyCommercial(m, year);

    // Other expenses (code 10 — temporary services, only 2025)
    let other: number;
    if (year === 2025) {
      other = outrosExpenses2025[m] / 1000;
    } else {
      other = 0;
    }

    // EBITDA
    const ebitda = cm + sga + totalHC + commercial + other;

    // Financial result — use real monthly values for 2025, formula-based after
    let financialResult: number;
    if (year === 2025) {
      const jurosChEsp = financialItems2025['8.01_jurosChEspecial'][m] / 1000;
      const iof = financialItems2025['8.03_iof'][m] / 1000;
      const jurosEmp = financialItems2025['8.04_jurosEmprestimos'][m] / 1000;
      // Boleto tariff: real Jan-Mar, then f(clients) Apr+
      const boletoReal = financialItems2025['8.05_tarifaBoletos'][m];
      const boleto = m < 3 ? boletoReal / 1000 : -(totalClientsM * revenueTaxes.baasBoletoPerClient) / 1000;
      const antecipacao = financialItems2025['8.08_antecipacao'][m] / 1000;
      const recFinanceira = financialItems2025['8.09_receitaFinanceira'][m] / 1000;
      financialResult = jurosChEsp + iof + jurosEmp + boleto + antecipacao + recFinanceira;
    } else {
      // BaaS boleto only for later years
      const boleto = -(baasClientsM * revenueTaxes.baasBoletoPerClient) / 1000;
      financialResult = boleto;
    }

    // EBT
    const ebt = ebitda + financialResult;

    // Taxes
    let irpj = 0, csll = 0;
    if (ebt > 0) {
      irpj = -ebt * taxRates.irpj;
      csll = -ebt * taxRates.csll;
    }
    const totalTax = irpj + csll;

    // Net income
    const ni = ebt + totalTax;

    // Debt payments
    const debt = calcMonthlyDebtPayment(m, year);
    const totalDebtPmt = debt.loans + debt.suppliers;

    // Capex
    const capex = calcMonthlyCapex(m, year, cogs.saas);
    const totalCapex = capex.software + capex.realestate;

    // Final result
    const finalResult = ni + totalDebtPmt + totalCapex;

    // Accumulate
    annualGrossRevenue += grossRev;
    annualCaas += caasRev;
    annualSaas += saasRev;
    annualEdu += eduRev;
    annualBaas += baasRev;
    annualDeductions += ded;
    annualNetRevenue += netRev;
    annualCogs += totalCogs;
    annualGrossProfit += gp;
    annualCommissions += totalComm;
    annualMarketing += totalMkt;
    annualCM += cm;
    annualSGA += sga;
    annualHC += totalHC;
    annualCommercial += commercial;
    annualOther += other;
    annualEBITDA += ebitda;
    annualFinancial += financialResult;
    annualEBT += ebt;
    annualTaxes += totalTax;
    annualNI += ni;
    annualDebt += totalDebtPmt;
    annualCapex += totalCapex;
    annualFinal += finalResult;

    cogsD.caas += cogs.caas; cogsD.customerService += cogs.customerService;
    cogsD.saas += cogs.saas; cogsD.education += cogs.education; cogsD.baas += cogs.baas;
    hcD.salaries += hc.salaries; hcD.benefits += hc.benefits;
    mktD.caas += mktCaas; mktD.saas += mktSaas; mktD.education += mktEdu; mktD.baas += mktBaas;
    taxD.irpj += irpj; taxD.csll += csll;
    debtD.loans += debt.loans; debtD.suppliers += debt.suppliers;
    capexD.software += capex.software; capexD.realestate += capex.realestate;
    lastClients = totalClientsM;

    monthly.push({
      grossRevenue: grossRev, caasRevenue: caasRev, saasRevenue: saasRev,
      educationRevenue: eduRev, baasRevenue: baasRev,
      deductions: ded, netRevenue: netRev, cogs: totalCogs, grossProfit: gp,
      commissions: totalComm, marketing: totalMkt, contributionMargin: cm,
      sga, headcount: totalHC, commercial, otherExpenses: other,
      ebitda, financialResult, ebt, taxes: totalTax, netIncome: ni,
      debtPayments: totalDebtPmt, capex: totalCapex, finalResult,
      totalClients: totalClientsM,
    });
  }

  const r = (v: number) => Math.round(v);

  // ─── PMR / Receivables Change ───
  // Ending receivables = annual gross revenue * weighted PMR / 365
  const pmr = assumptions.pmrConfig ?? { caas: 30, saas: 15, education: 30, baas: 0 };
  const totalRevForPmr = annualCaas + annualSaas + annualEdu + annualBaas;
  const weightedPmr = totalRevForPmr > 0
    ? (annualCaas * pmr.caas + annualSaas * pmr.saas + annualEdu * pmr.education + annualBaas * pmr.baas) / totalRevForPmr
    : 0;
  const endingReceivables = (annualGrossRevenue / 1000) * (weightedPmr / 365); // in R$ thousands
  // For prior year we approximate using same formula with prior year revenue
  const prevYear = (year - 1) as Year;
  const prevYearRev = YEARS.includes(prevYear) ? expectedOutputs.grossRevenue[prevYear] ?? 0 : 0;
  const beginningReceivables = (prevYearRev / 1000) * (weightedPmr / 365);
  const receivablesChange = -(endingReceivables - beginningReceivables); // negative = cash used, positive = cash released

  return {
    grossRevenue: r(annualGrossRevenue), caasRevenue: r(annualCaas), saasRevenue: r(annualSaas),
    educationRevenue: r(annualEdu), baasRevenue: r(annualBaas),
    deductions: r(annualDeductions), netRevenue: r(annualNetRevenue),
    cogs: r(annualCogs), cogsDetail: { caas: r(cogsD.caas), customerService: r(cogsD.customerService), saas: r(cogsD.saas), education: r(cogsD.education), baas: r(cogsD.baas) },
    grossProfit: r(annualGrossProfit),
    grossMarginPct: annualNetRevenue !== 0 ? Number(((annualGrossProfit / annualNetRevenue) * 100).toFixed(1)) : 0,
    commissions: r(annualCommissions),
    marketing: r(annualMarketing),
    marketingDetail: { caas: r(mktD.caas), saas: r(mktD.saas), education: r(mktD.education), baas: r(mktD.baas) },
    contributionMargin: r(annualCM),
    contributionMarginPct: annualNetRevenue !== 0 ? Number(((annualCM / annualNetRevenue) * 100).toFixed(1)) : 0,
    sga: r(annualSGA), headcount: r(annualHC),
    headcountDetail: { salaries: r(hcD.salaries), benefits: r(hcD.benefits) },
    commercial: r(annualCommercial), otherExpenses: r(annualOther),
    ebitda: r(annualEBITDA),
    ebitdaMarginPct: annualNetRevenue !== 0 ? Number(((annualEBITDA / annualNetRevenue) * 100).toFixed(1)) : 0,
    financialResult: r(annualFinancial), ebt: r(annualEBT),
    taxes: r(annualTaxes), taxDetail: { irpj: r(taxD.irpj), csll: r(taxD.csll) },
    netIncome: r(annualNI),
    netMarginPct: annualNetRevenue !== 0 ? Number(((annualNI / annualNetRevenue) * 100).toFixed(1)) : 0,
    debtPayments: r(annualDebt), debtDetail: { loans: r(debtD.loans), suppliers: r(debtD.suppliers) },
    capex: r(annualCapex), capexDetail: { software: r(capexD.software), realestate: r(capexD.realestate) },
    finalResult: r(annualFinal),
    receivablesChange: r(receivablesChange),
    totalClients: Math.round(lastClients),
    monthlyData: monthly,
    revenueDetail: {
      caasAssessoria: r(revD.caasAssessoria), caasEnterprise: r(revD.caasEnterprise),
      caasCorporate: r(revD.caasCorporate), caasSetup: r(revD.caasSetup),
      saasOxy: r(revD.saasOxy), saasOxyGenio: r(revD.saasOxyGenio), saasSetup: r(revD.saasSetup),
      educationDonoCfo: r(revD.educationDonoCfo), baasAssinatura: r(revD.baasAssinatura),
    },
  };
}

// ─── COMPUTE FULL MODEL ───

export function computeFullModel(assumptions: Assumptions, scenario: Scenario): FullModelOutput {
  const years = {} as Record<Year, AnnualOutput>;

  for (const y of YEARS) {
    years[y] = computeYear(y, assumptions, scenario);
  }

  // Validate against expected outputs (base scenario only)
  if (scenario === 'BASE' && assumptions === DEFAULT_ASSUMPTIONS) {
    validateOutputs(years);
  }

  return { years, pnlTree: buildPnlTree(years) };
}

// ─── VALIDATION ───

function validateOutputs(years: Record<Year, AnnualOutput>) {
  const checks: [string, (y: AnnualOutput) => number, Record<number, number>][] = [
    ['Gross Revenue', y => y.grossRevenue, expectedOutputs.grossRevenue],
    ['Net Revenue', y => y.netRevenue, expectedOutputs.netRevenue],
    ['EBITDA', y => y.ebitda, expectedOutputs.ebitda],
  ];

  for (const [label, getter, expected] of checks) {
    for (const year of YEARS) {
      const computed = getter(years[year]);
      const exp = expected[year];
      if (exp !== 0) {
        const deviation = Math.abs((computed - exp) / exp);
        if (deviation > 0.02) {
          console.warn(
            `[Engine] ${label} ${year}: computed ${computed.toLocaleString()}, expected ${exp.toLocaleString()} (${(deviation * 100).toFixed(1)}% deviation)`
          );
        }
      }
    }
  }
}

// ─── MONTHLY & ALLOCATION HELPERS ───

function mArr(yrs: Record<Year, AnnualOutput>, fn: (d: MonthlyPnL) => number): Record<Year, number[]> {
  const r = {} as Record<Year, number[]>;
  for (const y of YEARS) r[y] = yrs[y].monthlyData.map(d => Math.round(fn(d)));
  return r;
}

function allocMo(pMo: Record<Year, number[]>, cAn: Record<Year, number>, pAn: Record<Year, number>): Record<Year, number[]> {
  const r = {} as Record<Year, number[]>;
  for (const y of YEARS) {
    r[y] = pAn[y] !== 0 ? pMo[y].map(v => Math.round(v * cAn[y] / pAn[y])) : new Array(12).fill(0);
  }
  return r;
}

function zMo(): Record<Year, number[]> {
  const r = {} as Record<Year, number[]>;
  for (const y of YEARS) r[y] = new Array(12).fill(0);
  return r;
}

const V = (a: number, b: number, c: number, d: number, e: number, f: number): Record<Year, number> =>
  ({ 2025: a, 2026: b, 2027: c, 2028: d, 2029: e, 2030: f } as Record<Year, number>);

// ─── BASE DETAIL VALUES (from Excel, for proportional sub-item allocation) ───

const BASE_SGA = [
  { c: '4.01', l: 'Água e Esgoto', v: V(-3,-3,-4,-4,-5,-5) },
  { c: '4.02', l: 'Energia Elétrica', v: V(-8,-9,-10,-11,-12,-13) },
  { c: '4.03', l: 'Internet/Telefone', v: V(-5,-6,-6,-7,-7,-8) },
  { c: '4.04', l: 'Aluguel', v: V(-36,-40,-44,-48,-53,-58) },
  { c: '4.05', l: 'Condomínio', v: V(-12,-13,-15,-16,-18,-19) },
  { c: '4.06', l: 'IPTU', v: V(-4,-4,-5,-5,-6,-6) },
  { c: '4.07', l: 'Materiais de Uso e Consumo', v: V(-3,-3,-4,-4,-5,-5) },
  { c: '4.08', l: 'Serviço de Higiene e Limpeza', v: V(-4,-4,-5,-5,-6,-6) },
  { c: '4.09', l: 'Manutenções e Reparos', v: V(-2,-2,-3,-3,-3,-4) },
  { c: '4.10', l: 'Locação de Máquinas e Equip.', v: V(-1,-1,-1,-2,-2,-2) },
  { c: '4.11', l: 'Assessoria Contábil', v: V(-18,-20,-22,-24,-26,-29) },
  { c: '4.12', l: 'Assessoria Financeira', v: V(-10,-11,-12,-13,-15,-16) },
  { c: '4.13', l: 'Assessoria Jurídica', v: V(-13,-14,-16,-17,-19,-21) },
  { c: '4.14', l: 'Assessoria RH', v: V(-3,-4,-4,-4,-4,-4) },
  { c: '4.15', l: 'Seguros', v: V(-2,0,0,0,0,0) },
  { c: '4.16', l: 'Taxas e Emolumentos', v: V(0,0,0,0,0,0) },
  { c: '4.17', l: 'Custas Judiciais ou Processuais', v: V(0,0,0,0,0,0) },
  { c: '4.18', l: 'Eventos Internos', v: V(-23,-51,-121,-339,-737,-1488) },
  { c: '4.19', l: 'Retenções IRRF de Serviços de Terceiros', v: V(0,0,0,0,0,0) },
  { c: '4.20', l: 'Retenções PIS/COFINS/CSLL de Serviços de Terceiros', v: V(0,0,0,0,0,0) },
  { c: '4.21', l: 'Assessoria de Informática', v: V(0,0,0,0,0,0) },
  { c: '4.22', l: 'Alimentação - Administrativo', v: V(-255,-281,-309,-340,-374,-411) },
  { c: '4.23', l: 'Deslocamento - Administrativo', v: V(0,0,0,0,0,0) },
  { c: '4.24', l: 'Viagens e Estadias - Administrativo', v: V(0,0,0,0,0,0) },
  { c: '4.25', l: 'Softwares e Ferramentas - Administrativo', v: V(-172,-262,-548,-1418,-3108,-5874) },
  { c: '4.26', l: 'Provisão para Devedores Duvidosos', v: V(-276,-685,-2074,-6742,-15719,-29215) },
  { c: '4.27', l: 'Despesas a Identificar', v: V(0,0,0,0,0,0) },
  { c: '4.28', l: 'DIFAL - Diferencial de Alíquotas do ICMS', v: V(0,0,0,0,0,0) },
  { c: '4.29', l: 'Retenções ISS de Serviços de Terceiros', v: V(0,0,0,0,0,0) },
];

const BASE_COMMERCIAL = [
  { c: '6.01', l: 'Eventos Comerciais', v: V(0,0,0,0,0,0) },
  { c: '6.02', l: 'Softwares e Ferramentas - Comercial', v: V(-23,-19,-21,-23,-26,-28) },
  { c: '6.03', l: 'Alimentação - Comercial', v: V(-3,0,0,0,0,0) },
  { c: '6.04', l: 'Deslocamento - Comercial', v: V(-16,-17,-19,-21,-23,-25) },
  { c: '6.05', l: 'Comissão de Parceiros', v: V(0,0,0,0,0,0) },
  { c: '6.06', l: 'Comissionamentos e Premiações Equipe', v: V(0,0,0,0,0,0) },
  { c: '6.07', l: 'Viagens e Estadias - Comercial', v: V(-30,-35,-38,-42,-46,-51) },
  { c: '6.08', l: 'Serviços de Terceiros Comercial', v: V(-136,-150,-165,-182,-200,-220) },
];

const BASE_MARKETING = [
  { c: '7.01', l: 'Anúncios Mídias Digitais', v: V(-80,-150,-400,-1200,-3000,-6000) },
  { c: '7.02', l: 'Anúncios Mídias Offline', v: V(-10,-20,-50,-150,-400,-800) },
  { c: '7.03', l: 'Assessoria Marketing', v: V(-40,-60,-120,-350,-800,-1500) },
  { c: '7.04', l: 'Softwares e Ferramentas - Marketing', v: V(-20,-30,-60,-180,-400,-800) },
  { c: '7.05', l: 'Serviços de Terceiros Marketing', v: V(-15,-25,-50,-140,-350,-700) },
  { c: '7.06', l: 'Alimentação - Marketing', v: V(-5,-8,-15,-40,-100,-200) },
  { c: '7.07', l: 'Deslocamento - Marketing', v: V(-8,-12,-25,-70,-180,-350) },
  { c: '7.08', l: 'Viagens e Estadias - Marketing', v: V(-10,-15,-30,-90,-220,-450) },
];

const BASE_FINANCIAL = [
  { c: '8.01', l: 'Juros Cheque Especial', v: V(-25,0,0,0,0,0) },
  { c: '8.02', l: 'Tarifas e Taxas Bancárias', v: V(0,0,0,0,0,0) },
  { c: '8.03', l: 'IOF', v: V(-1,0,0,0,0,0) },
  { c: '8.04', l: 'Juros sobre Empréstimos e Financiamentos', v: V(-2,0,0,0,0,0) },
  { c: '8.05', l: 'Tarifa de Boletos sobre Recebimentos', v: V(-7,-1,-4,-18,-56,-129) },
  { c: '8.06', l: 'Tarifa de PIX sobre Recebimentos', v: V(0,0,0,0,0,0) },
  { c: '8.10', l: 'Juros sobre Atraso', v: V(0,0,0,0,0,0) },
  { c: '8.07', l: 'Tarifa de Adquirência sobre Recebimentos', v: V(0,0,0,0,0,0) },
  { c: '8.08', l: 'Juros e Taxas sobre Antecipação de Recebíveis', v: V(-46,0,0,0,0,0) },
  { c: '8.11', l: 'Tarifas de Cartões de Crédito', v: V(0,0,0,0,0,0) },
  { c: '8.12', l: 'Descontos Concedidos', v: V(0,0,0,0,0,0) },
];

// ─── DETAIL CHILDREN BUILDER ───

function buildDetailChildren(
  baseItems: { c: string; l: string; v: Record<Year, number> }[],
  engineFn: (y: AnnualOutput) => number,
  moFn: (d: MonthlyPnL) => number,
  yrs: Record<Year, AnnualOutput>,
): PnlNode[] {
  const baseTot = {} as Record<Year, number>;
  for (const y of YEARS) baseTot[y] = baseItems.reduce((s, it) => s + it.v[y], 0);
  const pAn = {} as Record<Year, number>;
  const pMo = {} as Record<Year, number[]>;
  for (const y of YEARS) {
    pAn[y] = engineFn(yrs[y]);
    pMo[y] = yrs[y].monthlyData.map(d => Math.round(moFn(d)));
  }
  return baseItems.map(it => {
    const ann = {} as Record<Year, number>;
    for (const y of YEARS) {
      ann[y] = baseTot[y] !== 0 ? Math.round(it.v[y] * pAn[y] / baseTot[y]) : 0;
    }
    return { code: it.c, label: it.l, annual: ann, monthly: allocMo(pMo, ann, pAn) };
  });
}

// ─── BUILD PNL TREE ───

function buildPnlTree(years: Record<Year, AnnualOutput>): PnlNode[] {
  const a = (fn: (y: AnnualOutput) => number): Record<Year, number> => {
    const r = {} as Record<Year, number>;
    for (const y of YEARS) r[y] = fn(years[y]);
    return r;
  };
  const mo = (fn: (d: MonthlyPnL) => number) => mArr(years, fn);
  const z = a(() => 0);

  // Revenue
  const grAn = a(y => y.grossRevenue), grMo = mo(d => d.grossRevenue);
  const caasAn = a(y => y.caasRevenue), caasMo = mo(d => d.caasRevenue);
  const saasAn = a(y => y.saasRevenue), saasMo = mo(d => d.saasRevenue);
  const eduAn = a(y => y.educationRevenue), eduMo = mo(d => d.educationRevenue);
  // BaaS revenue flows into Expansão
  const baasAn = a(y => y.baasRevenue), baasMo = mo(d => d.baasRevenue);
  const baAn = a(y => y.revenueDetail.baasAssinatura);
  // Sub-revenue
  const assAn = a(y => y.revenueDetail.caasAssessoria);
  const entAn = a(y => y.revenueDetail.caasEnterprise);
  const corpAn = a(y => y.revenueDetail.caasCorporate);
  const csAn = a(y => y.revenueDetail.caasSetup);
  const oxyAn = a(y => y.revenueDetail.saasOxy);
  const ogAn = a(y => y.revenueDetail.saasOxyGenio);
  const ssAn = a(y => y.revenueDetail.saasSetup);
  const dcAn = a(y => y.revenueDetail.educationDonoCfo);
  // Main categories
  const dedAn = a(y => y.deductions), dedMo = mo(d => d.deductions);
  const nrAn = a(y => y.netRevenue), nrMo = mo(d => d.netRevenue);
  const cogsAn = a(y => y.cogs), cogsMo = mo(d => d.cogs);
  const gpAn = a(y => y.grossProfit), gpMo = mo(d => d.grossProfit);
  const mktAn = a(y => y.marketing), mktMo = mo(d => d.marketing);
  const sgaAn = a(y => y.sga), sgaMo = mo(d => d.sga);
  const hcAn = a(y => y.headcount), hcMo = mo(d => d.headcount);
  const commlAn = a(y => y.commercial), commlMo = mo(d => d.commercial);
  const ebitdaAn = a(y => y.ebitda), ebitdaMo = mo(d => d.ebitda);
  const finAn = a(y => y.financialResult), finMo = mo(d => d.financialResult);
  const taxAn = a(y => y.taxes), taxMo = mo(d => d.taxes);
  const niAn = a(y => y.netIncome), niMo = mo(d => d.netIncome);
  const debtAn = a(y => y.debtPayments), debtMo = mo(d => d.debtPayments);
  const capexAn = a(y => y.capex), capexMo = mo(d => d.capex);
  const fcrAn = a(y => y.finalResult), fcrMo = mo(d => d.finalResult);
  // Detail annuals
  const hcSalAn = a(y => y.headcountDetail.salaries), hcBenAn = a(y => y.headcountDetail.benefits);
  const irpjAn = a(y => y.taxDetail.irpj), csllAn = a(y => y.taxDetail.csll);
  const dLoansAn = a(y => y.debtDetail.loans), dSuppAn = a(y => y.debtDetail.suppliers);
  const cSWAn = a(y => y.capexDetail.software), cREAn = a(y => y.capexDetail.realestate);
  const cogsCaasAn = a(y => y.cogsDetail.caas), cogsCSAn = a(y => y.cogsDetail.customerService);
  const cogsSaasAn = a(y => y.cogsDetail.saas), cogsEduAn = a(y => y.cogsDetail.education);
  const cogsBaasAn = a(y => y.cogsDetail.baas); // BaaS COGS flows into Custos Expansão

  // Combine commissions + marketing into a single "Despesas de Marketing" total for DESPESAS FIXAS
  // (commissions are now under Despesas Comerciais in the Oxy structure)

  // Helper: build zero COGS children for a BU (structural placeholders)
  function buildCostChildren(buName: string, hasVariavel: boolean = false): PnlNode[] {
    const items: string[] = [
      `Custo com Deslocamento ${buName}`,
      `Custo com Alimentação ${buName}`,
      `Equipe ${buName}`,
      `Custo com Viagens e Estadias ${buName}`,
      `Softwares e Ferramentas - ${buName}`,
      `Benefícios - ${buName}`,
    ];
    if (hasVariavel) items.push(`Custo Variável ${buName}`);
    items.push(`Remuneração de Estagiários - ${buName}`);
    return items.map((label, i) => ({
      code: '',
      label,
      annual: z,
      monthly: zMo(),
    }));
  }

  return [
    // ── RECEITA BRUTA ──
    {
      code: '1', label: 'RECEITA BRUTA', annual: grAn, monthly: grMo, isSummary: true,
      children: [
        { code: '1.1', label: 'CaaS', annual: caasAn, monthly: caasMo, children: [
          { code: '1.1.1', label: 'Serviços Especializados', annual: assAn, monthly: allocMo(caasMo, assAn, caasAn) },
          { code: '1.1.2', label: 'Enterprise', annual: entAn, monthly: allocMo(caasMo, entAn, caasAn) },
          { code: '1.1.3', label: 'Corporate', annual: corpAn, monthly: allocMo(caasMo, corpAn, caasAn) },
          { code: '1.1.4', label: 'Parceiros', annual: z, monthly: zMo() },
          { code: '1.1.5', label: 'BPO Financeiro', annual: z, monthly: zMo() },
        ]},
        { code: '1.2', label: 'SaaS', annual: saasAn, monthly: saasMo, children: [
          { code: '1.2.1', label: 'Oxy', annual: oxyAn, monthly: allocMo(saasMo, oxyAn, saasAn) },
          { code: '1.2.2', label: 'Oxy + Gênio', annual: ogAn, monthly: allocMo(saasMo, ogAn, saasAn) },
          { code: '1.2.3', label: 'Setup', annual: ssAn, monthly: allocMo(saasMo, ssAn, saasAn) },
          { code: '1.2.4', label: 'Parceiros', annual: z, monthly: zMo() },
          { code: '1.2.5', label: 'Oxy + Gênio + Especialista', annual: z, monthly: zMo() },
        ]},
        { code: '1.3', label: 'Education', annual: eduAn, monthly: eduMo, children: [
          { code: '1.3.1', label: 'Dono CFO', annual: dcAn, monthly: eduMo },
          { code: '1.3.2', label: 'Engenheiro de Negócios', annual: z, monthly: zMo() },
          { code: '1.3.3', label: 'Financeiro Raiz', annual: z, monthly: zMo() },
          { code: '1.3.4', label: 'Finance Sales Program', annual: z, monthly: zMo() },
        ]},
        { code: '1.5', label: 'Expansão', annual: baasAn, monthly: baasMo, children: [
          { code: '1.5.1', label: 'Assinatura', annual: baAn, monthly: allocMo(baasMo, baAn, baasAn) },
          { code: '1.5.2', label: 'Custódia', annual: z, monthly: zMo() },
        ]},
        { code: '1.6', label: 'Tax', annual: z, monthly: zMo() },
        { code: '2', label: 'Deduções de Vendas', annual: dedAn, monthly: dedMo, children: (() => {
          const ratesPresumido = { pis: 0.0065, cofins: 0.0300, iss: 0.0500 };
          const ratesReal = { pis: 0.0165, cofins: 0.0760, iss: 0.0500 };
          // Proportional sub-items (have computed values)
          const proportionalItems: { code: string; label: string; key: 'pis' | 'cofins' | 'iss' }[] = [
            { code: '2.03', label: 'ISS', key: 'iss' },
            { code: '2.04', label: 'PIS', key: 'pis' },
            { code: '2.05', label: 'COFINS', key: 'cofins' },
          ];
          const proportionalNodes = proportionalItems.map(sd => {
            const ann = {} as Record<Year, number>;
            for (const y of YEARS) {
              const rates = (y as number) <= 2026 ? ratesPresumido : ratesReal;
              const totalRate = salesDeductionsByYear[y as number];
              const proportion = totalRate !== 0 ? rates[sd.key] / totalRate : 0;
              ann[y] = Math.round(dedAn[y] * proportion);
            }
            return { code: sd.code, label: sd.label, annual: ann, monthly: allocMo(dedMo, ann, dedAn) };
          });
          // Zero sub-items (structural placeholders)
          const zeroItems: PnlNode[] = [
            { code: '2.01', label: 'CSLL (retido na fonte)', annual: z, monthly: zMo() },
            { code: '2.02', label: 'PIS (retido na fonte)', annual: z, monthly: zMo() },
            { code: '2.06', label: 'ICMS', annual: z, monthly: zMo() },
            { code: '2.07', label: 'IRRF (retido na fonte)', annual: z, monthly: zMo() },
            { code: '2.08', label: 'COFINS (retido na fonte)', annual: z, monthly: zMo() },
            { code: '2.09', label: 'Devoluções – Reembolso ao Cliente', annual: z, monthly: zMo() },
            { code: '2.10', label: 'Devoluções – Cancelamento/Desistência de Venda', annual: z, monthly: zMo() },
          ];
          // Order: CSLL retido, ISS, PIS retido, PIS, COFINS, ICMS, IRRF retido, COFINS retido, Devoluções...
          return [
            zeroItems[0],           // CSLL (retido na fonte)
            proportionalNodes[0],   // ISS
            zeroItems[1],           // PIS (retido na fonte)
            proportionalNodes[1],   // PIS
            proportionalNodes[2],   // COFINS
            zeroItems[2],           // ICMS
            zeroItems[3],           // IRRF (retido na fonte)
            zeroItems[4],           // COFINS (retido na fonte)
            zeroItems[5],           // Devoluções – Reembolso ao Cliente
            zeroItems[6],           // Devoluções – Cancelamento/Desistência de Venda
          ];
        })() },
      ],
    },

    // ── RECEITA LÍQUIDA ──
    { code: 'NR', label: 'RECEITA LÍQUIDA', isSummary: true, annual: nrAn, monthly: nrMo },

    // ── CUSTOS VARIÁVEIS (section header) ──
    { code: 'CV_HDR', label: 'CUSTOS VARIÁVEIS', isHeader: true, annual: z, monthly: zMo() },
    {
      code: '3.1', label: 'Custos CaaS', annual: cogsCaasAn, monthly: allocMo(cogsMo, cogsCaasAn, cogsAn),
      children: buildCostChildren('CaaS'),
    },
    {
      code: '3.2', label: 'Custos SaaS', annual: cogsSaasAn, monthly: allocMo(cogsMo, cogsSaasAn, cogsAn),
      children: buildCostChildren('SaaS'),
    },
    {
      code: '3.3', label: 'Custos Education', annual: cogsEduAn, monthly: allocMo(cogsMo, cogsEduAn, cogsAn),
      children: buildCostChildren('Education', true),
    },
    {
      code: '3.4', label: 'Custos Customer Success', annual: cogsCSAn, monthly: allocMo(cogsMo, cogsCSAn, cogsAn),
      children: buildCostChildren('Customer Success'),
    },
    {
      code: '3.5', label: 'Custos Expansão', annual: cogsBaasAn, monthly: allocMo(cogsMo, cogsBaasAn, cogsAn),
      children: buildCostChildren('Expansão'),
    },
    {
      code: '3.6', label: 'Custos Tax', annual: z, monthly: zMo(),
      children: buildCostChildren('Tax'),
    },

    // ── LUCRO BRUTO ──
    { code: 'GP', label: 'LUCRO BRUTO', isSummary: true, annual: gpAn, monthly: gpMo },
    { code: 'GM%', label: '% Margem Bruta', isMargin: true, annual: a(y => y.grossMarginPct) },

    // ── DESPESAS FIXAS (section header) ──
    { code: 'DF_HDR', label: 'DESPESAS FIXAS', isHeader: true, annual: z, monthly: zMo() },
    {
      code: '7', label: 'Despesas de Marketing', annual: mktAn, monthly: mktMo,
      children: buildDetailChildren(BASE_MARKETING, y => y.marketing, d => d.marketing, years),
    },
    {
      code: '6', label: 'Despesas Comerciais', annual: commlAn, monthly: commlMo,
      children: buildDetailChildren(BASE_COMMERCIAL, y => y.commercial, d => d.commercial, years),
    },
    {
      code: '5', label: 'Despesas com Pessoal', annual: hcAn, monthly: hcMo,
      children: [
        { code: '5.01', label: 'Salários', annual: hcSalAn, monthly: allocMo(hcMo, hcSalAn, hcAn) },
        { code: '5.02', label: 'Benefícios', annual: hcBenAn, monthly: allocMo(hcMo, hcBenAn, hcAn) },
        { code: '5.03', label: 'FGTS', annual: z, monthly: zMo() },
        { code: '5.04', label: 'INSS', annual: z, monthly: zMo() },
        { code: '5.05', label: 'Remuneração de Estagiários', annual: z, monthly: zMo() },
        { code: '5.06', label: 'Rescisões', annual: z, monthly: zMo() },
        { code: '5.07', label: 'Pró-labore Sócios', annual: z, monthly: zMo() },
        { code: '5.08', label: 'Distribuição de Lucros', annual: z, monthly: zMo() },
        { code: '5.09', label: 'Cursos e Treinamentos', annual: z, monthly: zMo() },
        { code: '5.10', label: 'Remuneração Menor Aprendiz', annual: z, monthly: zMo() },
        { code: '5.11', label: 'Serviços de Terceiros', annual: z, monthly: zMo() },
        { code: '5.12', label: 'Produtos O2 - Endomarketing', annual: z, monthly: zMo() },
        { code: '5.13', label: 'Férias', annual: z, monthly: zMo() },
        { code: '5.14', label: '13º', annual: z, monthly: zMo() },
        { code: '5.15', label: 'Seguro de Vida', annual: z, monthly: zMo() },
      ],
    },
    {
      code: '4', label: 'Despesas Administrativas', annual: sgaAn, monthly: sgaMo,
      children: buildDetailChildren(BASE_SGA, y => y.sga, d => d.sga, years),
    },

    // ── EBITDA ──
    { code: 'EBITDA', label: 'EBITDA', isSummary: true, annual: ebitdaAn, monthly: ebitdaMo },
    { code: 'EBITDA%', label: '% EBITDA', isMargin: true, annual: a(y => y.ebitdaMarginPct) },

    // ── Below EBITDA ──
    { code: '8R', label: 'Receitas Financeiras', annual: z, monthly: zMo(), children: [
      { code: '8.01', label: 'Rendimentos de Aplicações', annual: z, monthly: zMo() },
      { code: '8.09', label: 'Juros Recebidos', annual: z, monthly: zMo() },
    ]},
    {
      code: '8D', label: 'Despesas Financeira', annual: finAn, monthly: finMo,
      children: buildDetailChildren(BASE_FINANCIAL, y => y.financialResult, d => d.financialResult, years),
    },
    { code: 'OR', label: 'Outras Receitas', annual: z, monthly: zMo(), children: [
      { code: 'OR.01', label: 'Reembolsos', annual: z, monthly: zMo() },
      { code: 'OR.02', label: 'Doações', annual: z, monthly: zMo() },
      { code: 'OR.03', label: 'Empréstimos de Bancos', annual: z, monthly: zMo() },
      { code: 'OR.04', label: 'Receitas Não Operacionais', annual: z, monthly: zMo() },
    ]},
    {
      code: 'DNO', label: 'Despesas Não Operacionais', annual: a(y => y.otherExpenses), monthly: mo(d => d.otherExpenses),
      children: [
        { code: 'DNO.1', label: 'Despesa Não Operacional', annual: a(y => y.otherExpenses), monthly: mo(d => d.otherExpenses) },
        { code: 'DNO.2', label: 'Doações', annual: z, monthly: zMo() },
      ],
    },
    {
      code: 'TAX', label: 'Provisão IRPJ/CSLL', annual: taxAn, monthly: taxMo,
      children: [
        { code: '10.01', label: 'IRPJ', annual: irpjAn, monthly: allocMo(taxMo, irpjAn, taxAn) },
        { code: '10.02', label: 'CSLL', annual: csllAn, monthly: allocMo(taxMo, csllAn, taxAn) },
      ],
    },

    // ── RESULTADO LÍQUIDO ──
    { code: 'NI', label: 'RESULTADO LÍQUIDO', isSummary: true, annual: niAn, monthly: niMo },
    { code: 'NM%', label: '% Margem Líquida', isMargin: true, annual: a(y => y.netMarginPct) },

    // ── Below Net Income ──
    {
      code: '11', label: 'Amortização da Dívida Global', annual: debtAn, monthly: debtMo,
      children: [
        { code: '11.01', label: 'Compra de Cotas', annual: z, monthly: zMo() },
        { code: '11.02', label: 'Pagamento de Tributos Parcelados', annual: z, monthly: zMo() },
        { code: '11.03', label: 'Amortização de Empréstimos e Financiamentos', annual: dLoansAn, monthly: allocMo(debtMo, dLoansAn, debtAn) },
        { code: '11.04', label: 'Pagamento de Dívida com Fornecedores', annual: dSuppAn, monthly: allocMo(debtMo, dSuppAn, debtAn) },
        { code: '11.05', label: 'Grupo Octo', annual: z, monthly: zMo() },
      ],
    },
    {
      code: '12', label: 'Investimentos', annual: capexAn, monthly: capexMo,
      children: [
        { code: '12.01', label: 'Máquinas e Equipamentos', annual: z, monthly: zMo() },
        { code: '12.02', label: 'Móveis e Utensílios', annual: z, monthly: zMo() },
        { code: '12.03', label: 'Software e Tecnologia', annual: cSWAn, monthly: allocMo(capexMo, cSWAn, capexAn) },
        { code: '12.04', label: 'Imóveis', annual: cREAn, monthly: allocMo(capexMo, cREAn, capexAn) },
        { code: '12.05', label: 'Veículos', annual: z, monthly: zMo() },
      ],
    },

    // ── RESULTADO FINAL ──
    { code: 'FCR', label: 'RESULTADO FINAL', isSummary: true, annual: fcrAn, monthly: fcrMo },
  ];
}

// ─── KPI HELPER ───

export function computeKPIs(model: FullModelOutput, year: Year) {
  const y = model.years[year];
  const lastMonth = y.monthlyData[11];
  const mrr = lastMonth.grossRevenue * 1000; // Back to BRL from R$k
  return {
    grossRevenue: y.grossRevenue,
    netRevenue: y.netRevenue,
    grossProfit: y.grossProfit,
    ebitda: y.ebitda,
    netIncome: y.netIncome,
    operatingCashFlow: y.finalResult,
    grossMarginPct: y.grossMarginPct,
    ebitdaMarginPct: y.ebitdaMarginPct,
    netMarginPct: y.netMarginPct,
    totalClients: y.totalClients,
    mrr,
    arr: mrr * 12,
  };
}

// ─── VALUATION HELPERS ───

export function calcValuationEBITDA(ebitda: number, multiple: number): number {
  return ebitda * multiple;
}

export function calcValuationARR(arr: number, multiple: number): number {
  return arr * multiple;
}

export function calcDilution(raiseAmount: number, preMoneyValuation: number): number {
  return raiseAmount / (preMoneyValuation + raiseAmount) * 100;
}
