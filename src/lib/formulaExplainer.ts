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
  example?: string;
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
    example: `Ex: ${avgClients.toFixed(0)} clientes (média) × ${formatCurrencyFull(Math.round(totalRev / Math.max(totalClients, 1)))} (ticket médio) = ${formatCurrencyFull(Math.round(totalRev / 12))}/mês → ${formatCurrencyFull(totalRev)}/ano`,
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
    example: `Ex: ${prevDec} (Dez/${year - 1}) + novos − churn = ${jan} (Jan/${year}) … ${dec} (Dez/${year})`,
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
    example: `Ex: ${rates.pis.toFixed(2)}% + ${rates.cofins.toFixed(2)}% + ${rates.iss.toFixed(2)}%${rates.icms > 0 ? ` + ${rates.icms.toFixed(2)}%` : ''} + (${eff.irpj.toFixed(0)}% × 15%) + (${eff.csll.toFixed(0)}% × 9%) = ${total.toFixed(2)}%`,
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
      example: `Ex: ceil(${caasEnd}/${cos.pfdClientsPerOne}) = ${numPFD} PFDs × ${formatCurrencyFull(cos.pfdSalary)} × 12 = ${formatCurrencyFull(numPFD * cos.pfdSalary * 12)} (só PFD)`,
    };
  }

  if (buKey === 'education') {
    const eduRev = Math.abs(yr.educationRevenue) * 1000;
    const cost = eduRev * cos.eduCostRate;
    steps.push(
      { label: 'Receita Education', value: formatCurrencyFull(eduRev), source: 'Motor de cálculo' },
      { label: 'Taxa de custo', value: `${(cos.eduCostRate * 100).toFixed(0)}%`, source: 'Premissa COS' },
    );
    return { title: `COS Education — ${year}`, formula: 'Receita × Taxa', steps, result: formatCurrencyFull(cost), example: `Ex: ${formatCurrencyFull(eduRev)} × ${(cos.eduCostRate * 100).toFixed(0)}% = ${formatCurrencyFull(cost)}` };
  }

  if (buKey === 'expansao') {
    const rev = Math.abs(yr.baasRevenue) * 1000;
    const cost = rev * cos.expansaoCostRate;
    steps.push(
      { label: 'Receita Expansão', value: formatCurrencyFull(rev), source: 'Motor de cálculo' },
      { label: 'Taxa de custo', value: `${(cos.expansaoCostRate * 100).toFixed(0)}%`, source: 'Premissa COS' },
    );
    return { title: `COS Expansão — ${year}`, formula: 'Receita × Taxa', steps, result: formatCurrencyFull(cost), example: `Ex: ${formatCurrencyFull(rev)} × ${(cos.expansaoCostRate * 100).toFixed(0)}% = ${formatCurrencyFull(cost)}` };
  }

  if (buKey === 'tax') {
    const rev = Math.abs(yr.taxRevenue) * 1000;
    const cost = rev * cos.taxCostRate;
    steps.push(
      { label: 'Receita Tax', value: formatCurrencyFull(rev), source: 'Motor de cálculo' },
      { label: 'Taxa de custo', value: `${(cos.taxCostRate * 100).toFixed(0)}%`, source: 'Premissa COS' },
    );
    return { title: `COS Tax — ${year}`, formula: 'Receita × Taxa', steps, result: formatCurrencyFull(cost), example: `Ex: ${formatCurrencyFull(rev)} × ${(cos.taxCostRate * 100).toFixed(0)}% = ${formatCurrencyFull(cost)}` };
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
      example: `Ex: ${formatCurrency(yr.caasRevenue * 1000)} + ${formatCurrency(yr.saasRevenue * 1000)} + ${formatCurrency(yr.educationRevenue * 1000)} + ${formatCurrency(yr.baasRevenue * 1000)} + ${formatCurrency(yr.taxRevenue * 1000)} = ${formatCurrency(yr.grossRevenue * 1000)}`,
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
      example: `Ex: ${formatCurrency(yr.grossProfit * 1000)} − ${formatCurrency(Math.abs(yr.commissions + yr.marketing + yr.sga + yr.headcount) * 1000)} (opex) = ${formatCurrency(yr.ebitda * 1000)}`,
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
      example: `Ex: ${formatCurrency(yr.grossProfit * 1000)} ÷ ${formatCurrency(yr.netRevenue * 1000)} × 100 = ${gm.toFixed(1)}%`,
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
      example: `Ex: ${formatCurrency(yr.ebitda * 1000)} ÷ ${formatCurrency(yr.netRevenue * 1000)} × 100 = ${em.toFixed(1)}%`,
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
      example: `Ex: ${formatCurrency(yr.ebt * 1000)} − ${formatCurrency(Math.abs(yr.taxes) * 1000)} (impostos) = ${formatCurrency(yr.netIncome * 1000)}`,
    };
  }

  return { title: '', formula: '', steps: [], result: '' };
}

// ─── TICKET ───

export function explainTicket(
  key: TicketKey, label: string, year: Year,
  assumptions: Assumptions,
): FormulaExplanation {
  const ticketBase = assumptions.tickets[key] ?? 0;
  const monthlyTickets = assumptions.monthlyTickets?.[key]?.[year];
  const jan = monthlyTickets?.[0] ?? ticketBase;
  const dec = monthlyTickets?.[11] ?? ticketBase;
  const sum = Array.from({ length: 12 }, (_, i) => monthlyTickets?.[i] ?? ticketBase).reduce((s, v) => s + v, 0);
  const avg = sum / 12;

  return {
    title: `Ticket ${label} — ${year}`,
    formula: 'Ticket(m) = Ticket_base × (1 + crescimento%)^m',
    steps: [
      { label: 'Ticket base (flat)', value: formatCurrencyFull(ticketBase), source: 'Premissa "Ticket"' },
      { label: `Jan/${year}`, value: formatCurrencyFull(jan), source: 'Primeiro mês' },
      { label: `Dez/${year}`, value: formatCurrencyFull(dec), source: 'Último mês' },
      { label: 'Média anual', value: formatCurrencyFull(Math.round(avg)), source: 'Σ tickets / 12' },
    ],
    result: formatCurrencyFull(Math.round(avg)),
    example: `Ex: ${formatCurrencyFull(ticketBase)} (base) → ${formatCurrencyFull(jan)} (Jan) → ${formatCurrencyFull(dec)} (Dez), média = ${formatCurrencyFull(Math.round(avg))}`,
  };
}

// ─── CHURN ───

export function explainChurn(
  key: TicketKey, label: string, year: Year,
  assumptions: Assumptions,
): FormulaExplanation {
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides);
  const churnRates = assumptions.monthlyChurnRates?.[key]?.[year];
  const isArray = Array.isArray(churnRates);
  const rateJan = isArray ? (churnRates as number[])[0] : (typeof churnRates === 'number' ? churnRates : 0);
  const rateDec = isArray ? (churnRates as number[])[11] : rateJan;

  let totalChurned = 0;
  let totalActive = 0;
  for (let i = 0; i < 12; i++) {
    const rate = isArray ? (churnRates as number[])[i] : rateJan;
    const prevActive = i === 0
      ? (year > 2025
        ? getMonthlyClients(key, (year - 1) as Year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides)[11]
        : monthly[0])
      : monthly[i - 1];
    totalChurned += prevActive * (rate / 100);
    totalActive += monthly[i];
  }
  const avgActive = totalActive / 12;
  const annualRate = avgActive > 0 ? (totalChurned / avgActive) * 100 : 0;

  return {
    title: `Logo Churn ${label} — ${year}`,
    formula: 'Churn(m) = Ativos(m-1) × Taxa_mensal(%)',
    steps: [
      { label: 'Taxa mensal Jan', value: `${rateJan.toFixed(2)}%`, source: 'Premissa churn' },
      { label: 'Taxa mensal Dez', value: `${rateDec.toFixed(2)}%`, source: isArray ? 'Crescimento progressivo' : 'Flat' },
      { label: 'Total churns no ano', value: Math.round(totalChurned).toLocaleString('pt-BR'), source: 'Σ mensal' },
      { label: 'Taxa anual efetiva', value: `${annualRate.toFixed(1)}%`, source: 'Churns / Média ativos' },
    ],
    result: Math.round(totalChurned).toLocaleString('pt-BR'),
    example: `Ex: ${Math.round(monthly[0])} ativos × ${rateJan.toFixed(2)}% = ${(monthly[0] * rateJan / 100).toFixed(1)} churns (Jan/${year})`,
  };
}

// ─── NOVOS CLIENTES ───

export function explainNovosClientes(
  key: TicketKey, label: string, year: Year,
  assumptions: Assumptions,
): FormulaExplanation {
  const newOverrides = assumptions.monthlyNewClientOverrides?.[key]?.[year];
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides);

  // Compute new clients per month (delta + churn)
  let prevDec = 0;
  if (year > 2025) {
    const prev = getMonthlyClients(key, (year - 1) as Year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides);
    prevDec = prev[11];
  } else {
    prevDec = monthly[0]; // approximate
  }

  let totalNew = 0;
  for (let i = 0; i < 12; i++) {
    const nv = newOverrides?.[i];
    if (nv !== null && nv !== undefined) {
      totalNew += nv;
    } else {
      const prev = i === 0 ? prevDec : monthly[i - 1];
      const diff = monthly[i] - prev;
      if (diff > 0) totalNew += diff;
    }
  }

  const janNew = newOverrides?.[0] ?? Math.max(0, monthly[0] - prevDec);
  const decNew = newOverrides?.[11] ?? Math.max(0, monthly[11] - (monthly[10] ?? 0));

  return {
    title: `Novos Clientes ${label} — ${year}`,
    formula: 'Novos(m) = Ativos(m) − Ativos(m-1) + Churn(m)',
    steps: [
      { label: `Jan/${year}`, value: Math.round(janNew).toLocaleString('pt-BR'), source: 'Primeiro mês' },
      { label: `Dez/${year}`, value: Math.round(decNew).toLocaleString('pt-BR'), source: 'Último mês' },
      { label: 'Total novos no ano', value: Math.round(totalNew).toLocaleString('pt-BR'), source: 'Σ 12 meses' },
    ],
    result: Math.round(totalNew).toLocaleString('pt-BR'),
    example: `Ex: ${Math.round(monthly[0])} (Jan) − ${Math.round(prevDec)} (Dez/${year - 1}) = ${Math.round(janNew)} novos (Jan/${year})`,
  };
}

// ─── CLIENTES ATIVOS ───

export function explainClientesAtivos(
  key: TicketKey, label: string, year: Year,
  assumptions: Assumptions,
): FormulaExplanation {
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides);
  const jan = Math.round(monthly[0]);
  const dec = Math.round(monthly[11]);

  let prevDec = 0;
  if (year > 2025) {
    const prev = getMonthlyClients(key, (year - 1) as Year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides);
    prevDec = Math.round(prev[11]);
  }

  const growth = prevDec > 0 ? ((dec / prevDec - 1) * 100) : 0;

  return {
    title: `Clientes Ativos ${label} — ${year}`,
    formula: 'Ativos(m) = Ativos(m-1) + Novos(m) − Churn(m)',
    steps: [
      { label: `Base (Dez/${year - 1})`, value: prevDec.toLocaleString('pt-BR'), source: 'Ano anterior' },
      { label: `Jan/${year}`, value: jan.toLocaleString('pt-BR'), source: 'Primeiro mês' },
      { label: `Dez/${year}`, value: dec.toLocaleString('pt-BR'), source: 'Último mês' },
      { label: 'Crescimento anual', value: `${growth.toFixed(1)}%`, source: 'Dez/Dez anterior' },
    ],
    result: dec.toLocaleString('pt-BR'),
    example: `Ex: ${prevDec} (Dez/${year - 1}) + novos − churn = ${jan} (Jan/${year}), crescimento ${growth.toFixed(1)}% a.a.`,
  };
}

// ─── FATURAMENTO BASE ───

export function explainFaturamentoBase(
  key: TicketKey, label: string, year: Year,
  assumptions: Assumptions,
): FormulaExplanation {
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides);
  const ticketBase = assumptions.tickets[key] ?? 0;

  // Previous December revenue
  let prevDecRev = 0;
  if (year > 2025) {
    const prev = getMonthlyClients(key, (year - 1) as Year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides);
    const prevTicket = assumptions.monthlyTickets?.[key]?.[(year - 1) as Year]?.[11] ?? ticketBase;
    prevDecRev = prev[11] * prevTicket;
  }

  // Compute faturamento base for each month (MRR from previous month)
  const fatBase: number[] = [];
  for (let i = 0; i < 12; i++) {
    if (i === 0) {
      fatBase.push(prevDecRev);
    } else {
      const prevClients = monthly[i - 1];
      const prevTicket = assumptions.monthlyTickets?.[key]?.[year]?.[i - 1] ?? ticketBase;
      fatBase.push(prevClients * prevTicket);
    }
  }
  const total = fatBase.reduce((s, v) => s + v, 0);

  return {
    title: `Faturamento Base ${label} — ${year}`,
    formula: 'FatBase(m) = Clientes(m-1) × Ticket(m-1)',
    steps: [
      { label: `MRR Dez/${year - 1}`, value: formatCurrencyFull(Math.round(prevDecRev)), source: 'Mês anterior ao ano' },
      { label: `FatBase Jan/${year}`, value: formatCurrencyFull(Math.round(fatBase[0])), source: 'Primeiro mês' },
      { label: `FatBase Dez/${year}`, value: formatCurrencyFull(Math.round(fatBase[11])), source: 'Último mês' },
      { label: 'Total ano', value: formatCurrencyFull(Math.round(total)), source: 'Σ 12 meses' },
    ],
    result: formatCurrencyFull(Math.round(total)),
    example: `Ex: ${Math.round(year > 2025 ? prevDecRev > 0 ? monthly[0] : 0 : monthly[0])} clientes (Dez/${year - 1}) × ${formatCurrencyFull(Math.round(assumptions.monthlyTickets?.[key]?.[(year - 1) as Year]?.[11] ?? ticketBase))} = ${formatCurrencyFull(Math.round(fatBase[0]))} (Jan)`,
  };
}

// ─── INCREMENTO ───

export function explainIncremento(
  key: TicketKey, label: string, year: Year,
  assumptions: Assumptions,
): FormulaExplanation {
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides);
  const ticketBase = assumptions.tickets[key] ?? 0;

  let prevDec = 0;
  if (year > 2025) {
    const prev = getMonthlyClients(key, (year - 1) as Year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides);
    prevDec = prev[11];
  } else {
    prevDec = monthly[0];
  }

  const incremento: number[] = [];
  for (let i = 0; i < 12; i++) {
    const prevClients = i === 0 ? prevDec : monthly[i - 1];
    const newClients = Math.max(0, monthly[i] - prevClients);
    const mt = assumptions.monthlyTickets?.[key]?.[year]?.[i] ?? ticketBase;
    incremento.push(newClients * mt);
  }
  const total = incremento.reduce((s, v) => s + v, 0);

  return {
    title: `Incremento ${label} — ${year}`,
    formula: 'Incremento(m) = Novos(m) × Ticket(m)',
    steps: [
      { label: `Jan/${year}`, value: formatCurrencyFull(Math.round(incremento[0])), source: 'Primeiro mês' },
      { label: `Dez/${year}`, value: formatCurrencyFull(Math.round(incremento[11])), source: 'Último mês' },
      { label: 'Total ano', value: formatCurrencyFull(Math.round(total)), source: 'Σ 12 meses' },
    ],
    result: formatCurrencyFull(Math.round(total)),
    example: (() => {
      const newJan = Math.max(0, monthly[0] - prevDec);
      const ticketJan = assumptions.monthlyTickets?.[key]?.[year]?.[0] ?? ticketBase;
      return `Ex: ${Math.round(newJan)} novos × ${formatCurrencyFull(Math.round(ticketJan))} = ${formatCurrencyFull(Math.round(incremento[0]))} (Jan)`;
    })(),
  };
}

// ─── REVENUE CHURN ───

export function explainRevenueChurn(
  key: TicketKey, label: string, year: Year,
  assumptions: Assumptions,
): FormulaExplanation {
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides);
  const ticketBase = assumptions.tickets[key] ?? 0;
  const churnRates = assumptions.monthlyChurnRates?.[key]?.[year];
  const isArray = Array.isArray(churnRates);
  const rateFlat = typeof churnRates === 'number' ? churnRates : 0;

  let prevDec = 0;
  if (year > 2025) {
    const prev = getMonthlyClients(key, (year - 1) as Year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides);
    prevDec = prev[11];
  } else {
    prevDec = monthly[0];
  }

  let totalRevChurn = 0;
  for (let i = 0; i < 12; i++) {
    const prevClients = i === 0 ? prevDec : monthly[i - 1];
    const rate = isArray ? (churnRates as number[])[i] : rateFlat;
    const churned = prevClients * (rate / 100);
    const mt = assumptions.monthlyTickets?.[key]?.[year]?.[i] ?? ticketBase;
    totalRevChurn += churned * mt;
  }

  return {
    title: `Revenue Churn ${label} — ${year}`,
    formula: 'RevChurn(m) = Churned(m) × Ticket(m)',
    steps: [
      { label: 'Ticket base', value: formatCurrencyFull(ticketBase), source: 'Premissa ticket' },
      { label: 'Total revenue churn', value: formatCurrencyFull(Math.round(totalRevChurn)), source: 'Σ 12 meses' },
    ],
    result: formatCurrencyFull(Math.round(totalRevChurn)),
    example: (() => {
      const rate0 = isArray ? (churnRates as number[])[0] : rateFlat;
      const churned0 = prevDec * (rate0 / 100);
      const ticket0 = assumptions.monthlyTickets?.[key]?.[year]?.[0] ?? ticketBase;
      return `Ex: ${prevDec.toFixed(0)} × ${rate0.toFixed(2)}% = ${churned0.toFixed(1)} churns × ${formatCurrencyFull(Math.round(ticket0))} = ${formatCurrencyFull(Math.round(churned0 * ticket0))} (Jan)`;
    })(),
  };
}
