/**
 * O2 Inc — Calculations Engine
 * Computes all P&L, Cash Flow, and KPI values from raw model data.
 * Replaces hardcoded values with formula-driven calculations.
 */

import { Year, YEARS, Assumptions, DEFAULT_ASSUMPTIONS, Scenario } from '@/lib/financialData';
import { PnlNode } from '@/lib/pnlData';
import {
  clientsBase2025, avgTicket, churnAnnual, salesDeductions, cogsMonthly2025,
  commissionRate, cacPerClient, marketingHeadcount, sgaMonthly2025,
  commercialExpenses2025, taxRates, revenueTaxes, debtSchedule,
  scenarioMultipliers, benefitsMonthly2025, basePayroll2025, headcountRatios,
  salaryRanges, expectedOutputs,
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
  // SaaS setup: use same pattern as CaaS setup but with SaaS setup clients
  const saasSetup   = (year === 2025 ? (clientsBase2025.saas.setup[month] || 0) : 0) * avgTicket.saas.setup;
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

function calcMonthlyCOGS(month: number, year: number, revenueScale: number) {
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
    baas: 0,
  };
  return {
    caas: base.caas * yearMult,
    customerService: base.customerService * yearMult,
    saas: base.saas * yearMult,
    education: base.education * yearMult,
    baas: base.baas * yearMult,
  };
}

// ─── SG&A ───

function calcMonthlySGA(month: number, year: number, netRevenue: number): number {
  const yearMult = Math.pow(1.10, year - 2025);
  const fixedItems = [
    sgaMonthly2025['4.02_energia'],
    sgaMonthly2025['4.03_internet'],
    sgaMonthly2025['4.04_aluguel'],
    sgaMonthly2025['4.05_condominio'],
    sgaMonthly2025['4.07_materiais'],
    sgaMonthly2025['4.08_higiene'],
    sgaMonthly2025['4.10_maquinas'],
    sgaMonthly2025['4.11_contabil'],
    sgaMonthly2025['4.13_juridica'],
    sgaMonthly2025['4.22_alimentacao'],
    sgaMonthly2025['4.25_softwares'],
  ];
  const sgaFixed = fixedItems.reduce((s, v) => s + v, 0) * yearMult / 1000;
  // Bad debt = -2% of net revenue
  const badDebt = -0.02 * Math.abs(netRevenue);
  // Insurance only first 3 months of 2025
  const insurance = (year === 2025 && month < 3) ? sgaMonthly2025['4.15_seguros'] / 1000 : 0;
  return sgaFixed + badDebt + insurance;
}

// ─── HEADCOUNT ───

function calcMonthlyHeadcount(month: number, year: number, totalClients: number): { salaries: number; benefits: number } {
  const yearMult = Math.pow(1.10, year - 2025);

  // Base payroll (named employees, code 5.01)
  let salaries = basePayroll2025 / 1000 * yearMult;

  // Additional hires based on client ratios
  const additionalCFOs = Math.max(0, Math.ceil(totalClients / headcountRatios.clientsPerCFO) - 9); // 9 existing
  const additionalFPA = Math.max(0, Math.ceil(totalClients / headcountRatios.clientsPerFPA) - 3);
  const additionalCSM = Math.max(0, Math.ceil(totalClients / headcountRatios.clientsPerCSM) - 1);
  const additionalPF = Math.max(0, Math.ceil(totalClients / headcountRatios.clientsPerPF) - 0);

  salaries += (additionalCFOs * salaryRanges['CFO'] +
    additionalFPA * salaryRanges['FP&A Analyst'] +
    additionalCSM * salaryRanges['Customer Service'] +
    additionalPF * salaryRanges['Project Finance Director']) / 1000;

  // Benefits
  let benefits: number;
  if (year === 2025) {
    benefits = benefitsMonthly2025[month] / 1000;
  } else {
    // Scale benefits with total headcount
    const totalHC = 22 + additionalCFOs + additionalFPA + additionalCSM + additionalPF;
    benefits = totalHC * 901.10 / 1000 * yearMult; // R$901.10 per person (food allowance basis)
  }

  return { salaries: -salaries, benefits: -benefits };
}

// ─── COMMERCIAL EXPENSES ───

function calcMonthlyCommercial(year: number): number {
  const yearMult = Math.pow(1.10, year - 2025);
  const items = [
    commercialExpenses2025['6.03_softwares'],
    commercialExpenses2025['6.05_deslocamento'],
    commercialExpenses2025['6.06_hospedagem'],
  ];
  const variable = items.reduce((s, v) => s + v, 0) * yearMult / 1000;
  const fixed = commercialExpenses2025['6.08_assessoria'] / 1000; // doesn't grow
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
  // Software capex = ~50% of SaaS COGS (tech investment)
  const software = saasCogsMonthly; // already negative in R$k

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

    // Deductions
    const ded = -grossRev * salesDeductions.totalRate;

    // Net revenue
    const netRev = grossRev + ded;

    // COGS
    const cogs = calcMonthlyCOGS(m, year, revenueScale);
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

    // SG&A
    const sga = calcMonthlySGA(m, year, netRev);

    // Headcount
    const hc = calcMonthlyHeadcount(m, year, totalClientsM);
    const totalHC = hc.salaries + hc.benefits;

    // Commercial
    const commercial = calcMonthlyCommercial(year);

    // Other expenses (only 2025)
    const other = year === 2025 ? -13 / 12 : 0;

    // EBITDA
    const ebitda = cm + sga + totalHC + commercial + other;

    // Financial result
    const boleto = -(totalClientsM * revenueTaxes.boletoPerClient) / 1000;
    const overdraft = (year === 2025 && m < 3) ? -25 / 3 : 0; // approximate
    const loanInterest = (year === 2025 && m < 3) ? -2 / 3 : 0;
    const financialResult = boleto + overdraft + loanInterest;

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

// ─── BUILD PNL TREE ───

function buildPnlTree(years: Record<Year, AnnualOutput>): PnlNode[] {
  const a = (fn: (y: AnnualOutput) => number): Record<Year, number> => {
    const result = {} as Record<Year, number>;
    for (const y of YEARS) result[y] = fn(years[y]);
    return result;
  };

  return [
    {
      code: '1', label: 'Receita Bruta de Vendas',
      annual: a(y => y.grossRevenue),
      children: [
        {
          code: '1.1', label: 'CaaS',
          annual: a(y => y.caasRevenue),
          children: [
            { code: '1.1.1', label: 'Assessoria', annual: a(y => y.revenueDetail.caasAssessoria) },
            { code: '1.1.2', label: 'Enterprise', annual: a(y => y.revenueDetail.caasEnterprise) },
            { code: '1.1.3', label: 'Corporate', annual: a(y => y.revenueDetail.caasCorporate) },
            { code: '1.1.4', label: 'Setup', annual: a(y => y.revenueDetail.caasSetup) },
          ],
        },
        {
          code: '1.2', label: 'SaaS',
          annual: a(y => y.saasRevenue),
          children: [
            { code: '1.2.1', label: 'Oxy', annual: a(y => y.revenueDetail.saasOxy) },
            { code: '1.2.2', label: 'Oxy + Gênio', annual: a(y => y.revenueDetail.saasOxyGenio) },
            { code: '1.2.4', label: 'Setup', annual: a(y => y.revenueDetail.saasSetup) },
          ],
        },
        {
          code: '1.3', label: 'Education',
          annual: a(y => y.educationRevenue),
          children: [
            { code: '1.3.3', label: 'Dono CFO', annual: a(y => y.revenueDetail.educationDonoCfo) },
          ],
        },
        {
          code: '1.4', label: 'BaaS',
          annual: a(y => y.baasRevenue),
          children: [
            { code: '1.4.1', label: 'Assinatura', annual: a(y => y.revenueDetail.baasAssinatura) },
          ],
        },
      ],
    },
    { code: '2', label: 'Dedução de Vendas', annual: a(y => y.deductions) },
    { code: 'NR', label: '(=) Receita Líquida', isSummary: true, annual: a(y => y.netRevenue) },
    {
      code: '3', label: 'Custo dos Serviços Prestados (COGS)',
      annual: a(y => y.cogs),
      children: [
        { code: '3.1.1', label: 'CaaS', annual: a(y => y.cogsDetail.caas) },
        { code: '3.1.2', label: 'Customer Service', annual: a(y => y.cogsDetail.customerService) },
        { code: '3.1.3', label: 'SaaS (Tech)', annual: a(y => y.cogsDetail.saas) },
        { code: '3.1.5', label: 'BaaS', annual: a(y => y.cogsDetail.baas) },
      ],
    },
    { code: 'GP', label: '(=) Lucro Bruto', isSummary: true, annual: a(y => y.grossProfit) },
    { code: 'GM%', label: '% Margem Bruta', isMargin: true, annual: a(y => y.grossMarginPct) },
    { code: '3.1', label: 'Comissões sobre Vendas', annual: a(y => y.commissions) },
    {
      code: '7', label: 'Despesas de Marketing',
      annual: a(y => y.marketing),
      children: [
        { code: '7.01', label: 'CaaS', annual: a(y => y.marketingDetail.caas) },
        { code: '7.02', label: 'SaaS', annual: a(y => y.marketingDetail.saas) },
        { code: '7.03', label: 'Education', annual: a(y => y.marketingDetail.education) },
        { code: '7.04', label: 'BaaS', annual: a(y => y.marketingDetail.baas) },
      ],
    },
    { code: 'CM', label: '(=) Margem de Contribuição', isSummary: true, annual: a(y => y.contributionMargin) },
    { code: 'CM%', label: '% Margem de Contribuição', isMargin: true, annual: a(y => y.contributionMarginPct) },
    { code: '4', label: 'Despesas Administrativas (SG&A)', annual: a(y => y.sga) },
    {
      code: '5', label: 'Despesas com Pessoal',
      annual: a(y => y.headcount),
      children: [
        { code: '5.01', label: 'Remuneração Equipe Interna', annual: a(y => y.headcountDetail.salaries) },
        { code: '5.03', label: 'Benefícios', annual: a(y => y.headcountDetail.benefits) },
      ],
    },
    { code: '6', label: 'Despesas Comerciais', annual: a(y => y.commercial) },
    { code: '10', label: 'Outras Despesas', annual: a(y => y.otherExpenses) },
    { code: '9', label: 'Depreciação & Amortização', annual: a(() => 0) },
    { code: 'EBITDA', label: '(=) EBITDA', isSummary: true, annual: a(y => y.ebitda) },
    { code: 'EBITDA%', label: '% EBITDA', isMargin: true, annual: a(y => y.ebitdaMarginPct) },
    { code: '8', label: 'Resultado Financeiro', annual: a(y => y.financialResult) },
    { code: 'EBT', label: '(=) Lucro antes do IR e CS', isSummary: true, annual: a(y => y.ebt) },
    {
      code: 'TAX', label: 'Impostos (IRPJ + CSLL)',
      annual: a(y => y.taxes),
      children: [
        { code: '10.01', label: 'IRPJ', annual: a(y => y.taxDetail.irpj) },
        { code: '10.02', label: 'CSLL', annual: a(y => y.taxDetail.csll) },
      ],
    },
    { code: 'NI', label: '(=) Lucro Líquido', isSummary: true, annual: a(y => y.netIncome) },
    { code: 'NM%', label: '% Margem Líquida', isMargin: true, annual: a(y => y.netMarginPct) },
    {
      code: '11', label: 'Pagamento de Dívidas',
      annual: a(y => y.debtPayments),
      children: [
        { code: '11.01', label: 'Empréstimos e Financiamentos', annual: a(y => y.debtDetail.loans) },
        { code: '11.03', label: 'Dívida com Fornecedores', annual: a(y => y.debtDetail.suppliers) },
      ],
    },
    {
      code: '12', label: 'Capex',
      annual: a(y => y.capex),
      children: [
        { code: '12.03', label: 'Software e Tecnologia', annual: a(y => y.capexDetail.software) },
        { code: '12.04', label: 'Imóveis', annual: a(y => y.capexDetail.realestate) },
      ],
    },
    { code: 'FCR', label: '(=) Resultado Final de Caixa', isSummary: true, annual: a(y => y.finalResult) },
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
