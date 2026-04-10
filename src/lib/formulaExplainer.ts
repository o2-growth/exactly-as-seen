/**
 * Formula Explainer — builds decomposition objects for each metric
 * so the UI can show "how we got to this number".
 */

import {
  Year, Assumptions, TicketKey, SubProductTaxConfig,
  getSubProductTaxRate, getEffectivePresumido, getEffectiveTaxRates,
  CosConfig, DEFAULT_COS_CONFIG,
} from '@/lib/financialData';
import { formatCurrency, formatCurrencyFull, formatPercent } from '@/lib/formatters';
import { getMonthlyClients } from '@/lib/monthlyData';
import { FullModelOutput } from '@/engine/calculationsEngine';

export interface FormulaStep {
  label: string;
  value: string;
  source: string;
}

export interface FormulaExplanation {
  title: string;
  formula: string;
  steps: FormulaStep[];
  result: string;
}

// ─── REVENUE ───

export function explainRevenue(
  key: TicketKey, label: string, year: Year,
  assumptions: Assumptions, model: FullModelOutput,
): FormulaExplanation {
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides);
  const ticket = assumptions.tickets[key] ?? 0;
  const totalClients = monthly.reduce((s, v) => s + v, 0);
  const totalRev = monthly.reduce((s, v, i) => {
    const mt = assumptions.monthlyTickets?.[key]?.[year]?.[i] ?? ticket;
    return s + v * mt;
  }, 0);
  const avgClients = totalClients / 12;

  return {
    title: `Receita ${label} — ${year}`,
    formula: 'Σ (Clientes_mês × Ticket_mês)',
    steps: [
      { label: 'Ticket base (flat)', value: formatCurrencyFull(ticket), source: 'Premissa "Ticket"' },
      { label: 'Clientes (soma no ano)', value: Math.round(totalClients).toLocaleString('pt-BR'), source: 'Premissa "Novos Clientes"' },
      { label: 'Média mensal de clientes', value: avgClients.toFixed(1), source: 'Calculado' },
      { label: 'Receita anual', value: formatCurrencyFull(totalRev), source: 'Σ meses' },
    ],
    result: formatCurrencyFull(totalRev),
  };
}

// ─── CLIENTS ───

export function explainClients(
  key: TicketKey, label: string, year: Year,
  assumptions: Assumptions,
): FormulaExplanation {
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides);
  const total = monthly.reduce((s, v) => s + v, 0);
  const dec = Math.round(monthly[11]);
  const jan = Math.round(monthly[0]);

  // Previous year December
  let prevDec = 0;
  if (year > 2025) {
    const prevYr = (year - 1) as Year;
    const prevMonthly = getMonthlyClients(key, prevYr, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides);
    prevDec = Math.round(prevMonthly[11]);
  }

  return {
    title: `Clientes ${label} — ${year}`,
    formula: 'Ativos(m) = Ativos(m-1) + Novos(m) − Churn(m)',
    steps: [
      { label: `Base (Dez/${year - 1})`, value: prevDec.toLocaleString('pt-BR'), source: 'Ano anterior' },
      { label: `Jan/${year}`, value: jan.toLocaleString('pt-BR'), source: 'Primeiro mês do ano' },
      { label: `Dez/${year}`, value: dec.toLocaleString('pt-BR'), source: 'Último mês do ano' },
      { label: 'Soma no ano (client-meses)', value: Math.round(total).toLocaleString('pt-BR'), source: 'Σ 12 meses' },
    ],
    result: Math.round(total).toLocaleString('pt-BR'),
  };
}

// ─── TAX EFFECTIVE ───

export function explainTaxEffective(
  key: TicketKey, label: string,
  assumptions: Assumptions,
): FormulaExplanation {
  const cfg = getSubProductTaxRate(key, assumptions);
  const eff = getEffectivePresumido(cfg);
  const rates = getEffectiveTaxRates(cfg);
  const irpjEff = eff.irpj / 100 * 15;
  const csllEff = eff.csll / 100 * 9;
  const total = rates.pis + rates.cofins + rates.iss + rates.icms + cfg.csllRetido + cfg.pisRetido + cfg.irrfRetido + cfg.cofinsRetido + irpjEff + csllEff;

  const steps: FormulaStep[] = [
    { label: 'PIS', value: `${rates.pis.toFixed(2)}%`, source: `Alíquota PIS` },
    { label: 'COFINS', value: `${rates.cofins.toFixed(2)}%`, source: `Alíquota COFINS` },
    { label: 'ISS', value: `${rates.iss.toFixed(2)}%`, source: `Alíquota ISS` },
  ];

  if (rates.icms > 0) {
    steps.push({ label: 'ICMS', value: `${rates.icms.toFixed(2)}%`, source: 'Alíquota ICMS' });
  }

  steps.push(
    { label: 'Base presumida IRPJ', value: `${eff.irpj.toFixed(1)}%`, source: cfg.perfilTributario === 'mix' ? 'Média ponderada das fatias' : 'Perfil tributário' },
    { label: 'IRPJ efetivo', value: `${irpjEff.toFixed(2)}%`, source: `${eff.irpj.toFixed(1)}% × 15%` },
    { label: 'Base presumida CSLL', value: `${eff.csll.toFixed(1)}%`, source: cfg.perfilTributario === 'mix' ? 'Média ponderada das fatias' : 'Perfil tributário' },
    { label: 'CSLL efetivo', value: `${csllEff.toFixed(2)}%`, source: `${eff.csll.toFixed(1)}% × 9%` },
  );

  if (cfg.perfilTributario === 'mix' && cfg.taxSlices?.length) {
    const sliceDesc = cfg.taxSlices.map(s => `${s.pct}% ${s.profileKey}`).join(' + ');
    steps.unshift({ label: 'Mix', value: sliceDesc, source: 'Composição de fatias' });
  }

  return {
    title: `Deduções Tributárias — ${label}`,
    formula: 'PIS + COFINS + ISS + IRPJ efetivo + CSLL efetivo + retidos',
    steps,
    result: `${total.toFixed(2)}%`,
  };
}

// ─── COS ───

export function explainCOS(
  buKey: string, year: Year,
  assumptions: Assumptions, model: FullModelOutput,
): FormulaExplanation {
  const cos = assumptions.cosConfig ?? DEFAULT_COS_CONFIG;
  const yr = model.years[year];
  const caasEnd = assumptions.caasClients[year] ?? 0;

  const steps: FormulaStep[] = [];

  if (buKey === 'caas') {
    const numPFD = Math.max(1, Math.ceil(caasEnd / Math.max(1, cos.pfdClientsPerOne)));
    const numCFO = Math.max(1, Math.ceil(caasEnd / Math.max(1, cos.cfoClientsPerOne)));
    const numFPA = Math.max(1, Math.ceil(caasEnd / Math.max(1, cos.fpaClientsPerOne)));
    const total = (numPFD * cos.pfdSalary + numCFO * cos.cfoSalary + numFPA * cos.fpaSalary) * 12;

    steps.push(
      { label: `Clientes CaaS (Dez/${year})`, value: caasEnd.toLocaleString('pt-BR'), source: 'Premissa clientes' },
      { label: `PFD (1:${cos.pfdClientsPerOne})`, value: `${numPFD} × ${formatCurrencyFull(cos.pfdSalary)}`, source: `ceil(${caasEnd}/${cos.pfdClientsPerOne})` },
      { label: `CFO (1:${cos.cfoClientsPerOne})`, value: `${numCFO} × ${formatCurrencyFull(cos.cfoSalary)}`, source: `ceil(${caasEnd}/${cos.cfoClientsPerOne})` },
      { label: `FP&A (1:${cos.fpaClientsPerOne})`, value: `${numFPA} × ${formatCurrencyFull(cos.fpaSalary)}`, source: `ceil(${caasEnd}/${cos.fpaClientsPerOne})` },
    );

    return {
      title: `COS CaaS — ${year}`,
      formula: 'Σ (ceil(clientes/ratio) × salário) × 12',
      steps,
      result: formatCurrencyFull(total),
    };
  }

  if (buKey === 'education') {
    const eduRev = Math.abs(yr.educationRevenue) * 1000;
    const cost = eduRev * cos.eduCostRate;
    steps.push(
      { label: 'Receita Education', value: formatCurrencyFull(eduRev), source: 'Motor de cálculo' },
      { label: 'Taxa de custo', value: `${(cos.eduCostRate * 100).toFixed(0)}%`, source: 'Premissa COS' },
    );
    return { title: `COS Education — ${year}`, formula: 'Receita × Taxa', steps, result: formatCurrencyFull(cost) };
  }

  if (buKey === 'expansao') {
    const rev = Math.abs(yr.baasRevenue) * 1000;
    const cost = rev * cos.expansaoCostRate;
    steps.push(
      { label: 'Receita Expansão', value: formatCurrencyFull(rev), source: 'Motor de cálculo' },
      { label: 'Taxa de custo', value: `${(cos.expansaoCostRate * 100).toFixed(0)}%`, source: 'Premissa COS' },
    );
    return { title: `COS Expansão — ${year}`, formula: 'Receita × Taxa', steps, result: formatCurrencyFull(cost) };
  }

  if (buKey === 'tax') {
    const rev = Math.abs(yr.taxRevenue) * 1000;
    const cost = rev * cos.taxCostRate;
    steps.push(
      { label: 'Receita Tax', value: formatCurrencyFull(rev), source: 'Motor de cálculo' },
      { label: 'Taxa de custo', value: `${(cos.taxCostRate * 100).toFixed(0)}%`, source: 'Premissa COS' },
    );
    return { title: `COS Tax — ${year}`, formula: 'Receita × Taxa', steps, result: formatCurrencyFull(cost) };
  }

  return { title: `COS ${buKey} — ${year}`, formula: '', steps: [], result: '—' };
}

// ─── KPI ───

export function explainKPI(
  kpiCode: 'grossRevenue' | 'ebitda' | 'grossMargin' | 'ebitdaMargin' | 'clients' | 'netIncome',
  year: Year,
  model: FullModelOutput,
): FormulaExplanation {
  const yr = model.years[year];

  if (kpiCode === 'grossRevenue') {
    return {
      title: `Receita Bruta — ${year}`,
      formula: 'CaaS + SaaS + Education + Expansão + Tax',
      steps: [
        { label: 'CaaS', value: formatCurrency(yr.caasRevenue * 1000), source: 'BU CaaS' },
        { label: 'SaaS', value: formatCurrency(yr.saasRevenue * 1000), source: 'BU SaaS' },
        { label: 'Education', value: formatCurrency(yr.educationRevenue * 1000), source: 'BU Education' },
        { label: 'Expansão', value: formatCurrency(yr.baasRevenue * 1000), source: 'BU Expansão' },
        { label: 'Tax', value: formatCurrency(yr.taxRevenue * 1000), source: 'BU Tax' },
      ],
      result: formatCurrency(yr.grossRevenue * 1000),
    };
  }

  if (kpiCode === 'ebitda') {
    return {
      title: `EBITDA — ${year}`,
      formula: 'Receita Líq. − COGS − Despesas Operacionais',
      steps: [
        { label: 'Receita Líquida', value: formatCurrency(yr.netRevenue * 1000), source: 'Receita Bruta − Deduções' },
        { label: 'COGS', value: formatCurrency(yr.cogs * 1000), source: 'Custo dos Serviços' },
        { label: 'Lucro Bruto', value: formatCurrency(yr.grossProfit * 1000), source: 'Receita Líq. − COGS' },
        { label: 'Comissões', value: formatCurrency(yr.commissions * 1000), source: 'Desp. Comerciais' },
        { label: 'Marketing', value: formatCurrency(yr.marketing * 1000), source: 'CAC + PR + Eventos' },
        { label: 'SG&A', value: formatCurrency(yr.sga * 1000), source: 'Despesas Administrativas' },
        { label: 'Headcount', value: formatCurrency(yr.headcount * 1000), source: 'Folha de Pagamento' },
      ],
      result: formatCurrency(yr.ebitda * 1000),
    };
  }

  if (kpiCode === 'grossMargin') {
    const gm = yr.netRevenue > 0 ? (yr.grossProfit / yr.netRevenue * 100) : 0;
    return {
      title: `Margem Bruta — ${year}`,
      formula: 'Lucro Bruto ÷ Receita Líquida × 100',
      steps: [
        { label: 'Lucro Bruto', value: formatCurrency(yr.grossProfit * 1000), source: 'Receita Líq. − COGS' },
        { label: 'Receita Líquida', value: formatCurrency(yr.netRevenue * 1000), source: 'Receita Bruta − Deduções' },
      ],
      result: `${gm.toFixed(1)}%`,
    };
  }

  if (kpiCode === 'ebitdaMargin') {
    const em = yr.netRevenue > 0 ? (yr.ebitda / yr.netRevenue * 100) : 0;
    return {
      title: `Margem EBITDA — ${year}`,
      formula: 'EBITDA ÷ Receita Líquida × 100',
      steps: [
        { label: 'EBITDA', value: formatCurrency(yr.ebitda * 1000), source: 'Resultado operacional' },
        { label: 'Receita Líquida', value: formatCurrency(yr.netRevenue * 1000), source: 'Receita Bruta − Deduções' },
      ],
      result: `${em.toFixed(1)}%`,
    };
  }

  if (kpiCode === 'clients') {
    return {
      title: `Clientes Totais — ${year}`,
      formula: 'Σ clientes ativos (Dez) de todos os subprodutos',
      steps: [
        { label: 'CaaS', value: (yr.revenueDetail?.caasAssessoria ? 'ver subprodutos' : '—'), source: 'BU CaaS' },
        { label: 'Total (Dez)', value: yr.totalClients.toLocaleString('pt-BR'), source: 'Motor de cálculo' },
      ],
      result: yr.totalClients.toLocaleString('pt-BR'),
    };
  }

  if (kpiCode === 'netIncome') {
    return {
      title: `Resultado Líquido — ${year}`,
      formula: 'EBITDA + Resultado Financeiro − Impostos (IRPJ+CSLL)',
      steps: [
        { label: 'EBITDA', value: formatCurrency(yr.ebitda * 1000), source: 'Resultado operacional' },
        { label: 'Resultado Financeiro', value: formatCurrency(yr.financialResult * 1000), source: 'Juros + Rendimentos' },
        { label: 'EBT', value: formatCurrency(yr.ebt * 1000), source: 'EBITDA + Financeiro' },
        { label: 'IRPJ + CSLL + Ad. IRPJ', value: formatCurrency(yr.taxes * 1000), source: 'Lucro Presumido' },
      ],
      result: formatCurrency(yr.netIncome * 1000),
    };
  }

  return { title: '', formula: '', steps: [], result: '' };
}
