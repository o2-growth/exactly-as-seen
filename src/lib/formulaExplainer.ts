/**
 * Formula Explainer — builds decomposition objects for each metric
 * so the UI can show "how we got to this number".
 */

import {
  Year, Assumptions, TicketKey, SubProductTaxConfig,
  getSubProductTaxRate, getEffectivePresumido, getEffectiveTaxRates,
  CosConfig, DEFAULT_COS_CONFIG, CAAS_KEYS, SAAS_KEYS,
} from '@/lib/financialData';
import { formatCurrency, formatCurrencyFull, formatPercent } from '@/lib/formatters';
import { getMonthlyClients, MONTHS } from '@/lib/monthlyData';
import { FullModelOutput } from '@/engine/calculationsEngine';

/** Find first month index with value > 0; fallback to 0 */
function findRepresentativeMonth(monthly: number[]): number {
  const idx = monthly.findIndex(v => v > 0);
  return idx >= 0 ? idx : 0;
}

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
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides);
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
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides);
  const total = monthly.reduce((s, v) => s + v, 0);
  const dec = Math.round(monthly[11]);
  const jan = Math.round(monthly[0]);

  // Previous year December
  let prevDec = 0;
  if (year > 2025) {
    const prevYr = (year - 1) as Year;
    const prevMonthly = getMonthlyClients(key, prevYr, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides);
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
  const caasEnd = CAAS_KEYS.reduce((s, k) => s + (assumptions.subProductClients[k]?.[year] ?? 0), 0);

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
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides);
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
        ? getMonthlyClients(key, (year - 1) as Year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides)[11]
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
    example: (() => {
      const m = findRepresentativeMonth(monthly);
      const prevActive = m === 0
        ? (year > 2025
          ? getMonthlyClients(key, (year - 1) as Year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides)[11]
          : monthly[0])
        : monthly[m - 1];
      const rateM = isArray ? (churnRates as number[])[m] : rateJan;
      return `Ex: ${Math.round(prevActive)} ativos × ${rateM.toFixed(2)}% = ${(prevActive * rateM / 100).toFixed(1)} churns (${MONTHS[m]}/${year})`;
    })(),
  };
}

// ─── NOVOS CLIENTES ───

export function explainNovosClientes(
  key: TicketKey, label: string, year: Year,
  assumptions: Assumptions,
): FormulaExplanation {
  const newOverrides = assumptions.monthlyNewClientOverrides?.[key]?.[year];
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides);

  // Compute new clients per month (delta + churn)
  let prevDec = 0;
  if (year > 2025) {
    const prev = getMonthlyClients(key, (year - 1) as Year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides);
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
    example: (() => {
      const m = findRepresentativeMonth(monthly);
      const prev = m === 0 ? prevDec : monthly[m - 1];
      const nv = newOverrides?.[m] ?? Math.max(0, monthly[m] - prev);
      return `Ex: ${Math.round(monthly[m])} (${MONTHS[m]}) − ${Math.round(prev)} (${m === 0 ? `Dez/${year - 1}` : MONTHS[m - 1]}) = ${Math.round(nv)} novos (${MONTHS[m]}/${year})`;
    })(),
  };
}

// ─── CLIENTES ATIVOS ───

export function explainClientesAtivos(
  key: TicketKey, label: string, year: Year,
  assumptions: Assumptions,
): FormulaExplanation {
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides);
  const jan = Math.round(monthly[0]);
  const dec = Math.round(monthly[11]);

  let prevDec = 0;
  if (year > 2025) {
    const prev = getMonthlyClients(key, (year - 1) as Year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides);
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
    example: (() => {
      const m = findRepresentativeMonth(monthly);
      const prev = m === 0 ? prevDec : Math.round(monthly[m - 1]);
      const cur = Math.round(monthly[m]);
      return `Ex: ${prev} (${m === 0 ? `Dez/${year - 1}` : MONTHS[m - 1]}) + novos − churn = ${cur} (${MONTHS[m]}/${year})`;
    })(),
  };
}

// ─── FATURAMENTO BASE ───

export function explainFaturamentoBase(
  key: TicketKey, label: string, year: Year,
  assumptions: Assumptions,
): FormulaExplanation {
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides);
  const ticketBase = assumptions.tickets[key] ?? 0;

  // Previous December revenue
  let prevDecRev = 0;
  if (year > 2025) {
    const prev = getMonthlyClients(key, (year - 1) as Year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides);
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
    example: (() => {
      const m = findRepresentativeMonth(fatBase);
      const prevClients = m === 0
        ? (year > 2025 ? Math.round(prevDecRev / ((assumptions.monthlyTickets?.[key]?.[(year - 1) as Year]?.[11] ?? ticketBase) || 1)) : Math.round(monthly[0]))
        : Math.round(monthly[m - 1]);
      const prevTicket = m === 0
        ? (assumptions.monthlyTickets?.[key]?.[(year - 1) as Year]?.[11] ?? ticketBase)
        : (assumptions.monthlyTickets?.[key]?.[year]?.[m - 1] ?? ticketBase);
      return `Ex: ${prevClients} clientes × ${formatCurrencyFull(Math.round(prevTicket))} = ${formatCurrencyFull(Math.round(fatBase[m]))} (${MONTHS[m]})`;
    })(),
  };
}

// ─── INCREMENTO ───

export function explainIncremento(
  key: TicketKey, label: string, year: Year,
  assumptions: Assumptions,
): FormulaExplanation {
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides);
  const ticketBase = assumptions.tickets[key] ?? 0;

  let prevDec = 0;
  if (year > 2025) {
    const prev = getMonthlyClients(key, (year - 1) as Year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides);
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
      const m = findRepresentativeMonth(incremento);
      const prevClients = m === 0 ? prevDec : monthly[m - 1];
      const newM = Math.max(0, monthly[m] - prevClients);
      const ticketM = assumptions.monthlyTickets?.[key]?.[year]?.[m] ?? ticketBase;
      return `Ex: ${Math.round(newM)} novos × ${formatCurrencyFull(Math.round(ticketM))} = ${formatCurrencyFull(Math.round(incremento[m]))} (${MONTHS[m]})`;
    })(),
  };
}

// ─── REVENUE CHURN ───

export function explainRevenueChurn(
  key: TicketKey, label: string, year: Year,
  assumptions: Assumptions,
): FormulaExplanation {
  const monthly = getMonthlyClients(key, year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides);
  const ticketBase = assumptions.tickets[key] ?? 0;
  const churnRates = assumptions.monthlyChurnRates?.[key]?.[year];
  const isArray = Array.isArray(churnRates);
  const rateFlat = typeof churnRates === 'number' ? churnRates : 0;

  let prevDec = 0;
  if (year > 2025) {
    const prev = getMonthlyClients(key, (year - 1) as Year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides);
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
      const m = findRepresentativeMonth(monthly);
      const prevClients = m === 0 ? prevDec : monthly[m - 1];
      const rateM = isArray ? (churnRates as number[])[m] : rateFlat;
      const churnedM = prevClients * (rateM / 100);
      const ticketM = assumptions.monthlyTickets?.[key]?.[year]?.[m] ?? ticketBase;
      return `Ex: ${prevClients.toFixed(0)} × ${rateM.toFixed(2)}% = ${churnedM.toFixed(1)} churns × ${formatCurrencyFull(Math.round(ticketM))} = ${formatCurrencyFull(Math.round(churnedM * ticketM))} (${MONTHS[m]})`;
    })(),
  };
}

// ─── RESUMO FINANCEIRO (COS vs Receita) ───

export function explainResumoFinanceiro(
  metric: 'grossRevenue' | 'deductions' | 'netRevenue' | 'cogs' | 'grossProfit' | 'grossMargin',
  year: Year, model: FullModelOutput,
): FormulaExplanation {
  const yr = model.years[year];

  if (metric === 'grossRevenue') {
    return {
      title: `Receita Bruta — ${year}`,
      formula: 'Σ Receita de todos os sub-produtos (Assumptions)',
      steps: [
        { label: 'CaaS', value: formatCurrency(yr.caasRevenue * 1000), source: 'Σ sub-produtos CaaS' },
        { label: 'SaaS', value: formatCurrency(yr.saasRevenue * 1000), source: 'Σ sub-produtos SaaS' },
        { label: 'Education', value: formatCurrency(yr.educationRevenue * 1000), source: 'educationDonoCFO' },
        { label: 'Expansão', value: formatCurrency(yr.baasRevenue * 1000), source: 'BaaS' },
        { label: 'Tax', value: formatCurrency(yr.taxRevenue * 1000), source: 'Σ sub-produtos Tax' },
      ],
      result: formatCurrency(yr.grossRevenue * 1000),
    };
  }

  if (metric === 'deductions') {
    const dd = yr.dedDetail;
    return {
      title: `Deduções / Impostos — ${year}`,
      formula: 'PIS + COFINS + ISS + CSLL ret. + PIS ret. + COFINS ret. + IRRF ret. + ICMS',
      steps: [
        { label: 'PIS', value: formatCurrency(dd.pis * 1000), source: 'Premissa tributária' },
        { label: 'COFINS', value: formatCurrency(dd.cofins * 1000), source: 'Premissa tributária' },
        { label: 'ISS', value: formatCurrency(dd.iss * 1000), source: 'Premissa tributária' },
        { label: 'CSLL Retido', value: formatCurrency(dd.csllRetido * 1000), source: 'Premissa tributária' },
        { label: 'PIS Retido', value: formatCurrency(dd.pisRetido * 1000), source: 'Premissa tributária' },
        { label: 'COFINS Retido', value: formatCurrency(dd.cofinsRetido * 1000), source: 'Premissa tributária' },
        { label: 'IRRF Retido', value: formatCurrency(dd.irrfRetido * 1000), source: 'Premissa tributária' },
        { label: 'ICMS', value: formatCurrency(dd.icms * 1000), source: 'Premissa tributária' },
      ],
      result: formatCurrency(yr.deductions * 1000),
    };
  }

  if (metric === 'netRevenue') {
    return {
      title: `Receita Líquida — ${year}`,
      formula: 'Receita Bruta − Deduções',
      steps: [
        { label: 'Receita Bruta', value: formatCurrency(yr.grossRevenue * 1000), source: 'Σ sub-produtos' },
        { label: 'Deduções', value: formatCurrency(yr.deductions * 1000), source: 'Impostos sobre faturamento' },
      ],
      result: formatCurrency(yr.netRevenue * 1000),
      example: `${formatCurrency(yr.grossRevenue * 1000)} + (${formatCurrency(yr.deductions * 1000)}) = ${formatCurrency(yr.netRevenue * 1000)}`,
    };
  }

  if (metric === 'cogs') {
    const cd = yr.cogsDetail;
    return {
      title: `COS Total — ${year}`,
      formula: 'CaaS + CS + SaaS + Education + Expansão + Tax',
      steps: [
        { label: 'CaaS (headcount)', value: formatCurrency(cd.caas * 1000), source: 'PFD + CFO + FPA × salário × 12' },
        { label: 'Customer Success', value: formatCurrency(cd.customerService * 1000), source: 'CX Analysts × salário × 12' },
        { label: 'SaaS (headcount+setup)', value: formatCurrency(cd.saas * 1000), source: 'DevSr + CS + Setup squads × 12' },
        { label: 'Education', value: formatCurrency(cd.education * 1000), source: `${((yr.educationRevenue !== 0 ? Math.abs(cd.education / yr.educationRevenue) : 0) * 100).toFixed(0)}% da receita edu` },
        { label: 'Expansão', value: formatCurrency(cd.baas * 1000), source: `% da receita expansão` },
        { label: 'Tax', value: formatCurrency((cd.tax ?? 0) * 1000), source: `% da receita tax` },
      ],
      result: formatCurrency(yr.cogs * 1000),
    };
  }

  if (metric === 'grossProfit') {
    return {
      title: `Lucro Bruto — ${year}`,
      formula: 'Receita Líquida − COS Total',
      steps: [
        { label: 'Receita Líquida', value: formatCurrency(yr.netRevenue * 1000), source: 'Receita Bruta − Deduções' },
        { label: 'COS Total', value: formatCurrency(yr.cogs * 1000), source: 'Custos dos Serviços' },
      ],
      result: formatCurrency(yr.grossProfit * 1000),
      example: `${formatCurrency(yr.netRevenue * 1000)} + (${formatCurrency(yr.cogs * 1000)}) = ${formatCurrency(yr.grossProfit * 1000)}`,
    };
  }

  // grossMargin
  const gm = yr.netRevenue > 0 ? (yr.grossProfit / yr.netRevenue * 100) : 0;
  return {
    title: `Margem Bruta — ${year}`,
    formula: 'Lucro Bruto ÷ Receita Líquida × 100',
    steps: [
      { label: 'Lucro Bruto', value: formatCurrency(yr.grossProfit * 1000), source: 'Receita Líq. − COS' },
      { label: 'Receita Líquida', value: formatCurrency(yr.netRevenue * 1000), source: 'Receita Bruta − Deduções' },
    ],
    result: `${gm.toFixed(1)}%`,
    example: `${formatCurrency(yr.grossProfit * 1000)} ÷ ${formatCurrency(yr.netRevenue * 1000)} × 100 = ${gm.toFixed(1)}%`,
  };
}

// ─── SG&A EXPLANATION ───

export function explainSGA(
  year: Year, assumptions: Assumptions, model: FullModelOutput,
): FormulaExplanation {
  const yr = model.years[year];
  const getP = (field: string, fb: number): number => {
    const v = (assumptions as any)[field];
    if (v && typeof v === 'object') return v[year] ?? fb;
    return typeof v === 'number' ? v : fb;
  };
  const mk = getP('marketingPercent', 15.5);
  const co = getP('commercialPercent', 2.3);
  const pe = getP('pessoalPercent', 7.2);
  const ad = getP('sgaPercent', 10.4);
  const total = mk + co + pe + ad;
  const revBruta = yr.grossRevenue * 1000;

  return {
    title: `SG&A Total — ${year}`,
    formula: '(Marketing% + Comercial% + Pessoal% + Adm%) × Receita Bruta',
    steps: [
      { label: 'Marketing', value: `${mk.toFixed(1)}%`, source: 'Premissa editável' },
      { label: 'Comercial', value: `${co.toFixed(1)}%`, source: 'Premissa editável' },
      { label: 'Pessoal', value: `${pe.toFixed(1)}%`, source: 'Premissa editável' },
      { label: 'Administrativa', value: `${ad.toFixed(1)}%`, source: 'Premissa editável' },
      { label: 'Total %', value: `${total.toFixed(1)}%`, source: 'Soma das 4 categorias' },
      { label: 'Receita Bruta', value: formatCurrency(revBruta), source: 'Engine' },
    ],
    result: formatCurrency(revBruta * total / 100),
    example: `${formatCurrency(revBruta)} × ${total.toFixed(1)}% = ${formatCurrency(revBruta * total / 100)}`,
  };
}

// ─── ECON & FIN EXPLANATION ───

export function explainEconFin(
  year: Year, assumptions: Assumptions, model: FullModelOutput,
): FormulaExplanation {
  const yr = model.years[year];
  const getP = (field: string, fb: number): number => {
    const v = (assumptions as any)[field];
    if (v && typeof v === 'object') return v[year] ?? fb;
    return typeof v === 'number' ? v : fb;
  };
  const recFin = getP('receitasFinanceirasPercent', 0.5);
  const despFin = getP('despesasFinanceirasPercent', 1.5);
  const outras = getP('outrasReceitasPercent', 0);
  const despNaoOp = getP('despesasNaoOperacionaisPercent', 0);
  const net = recFin - despFin + outras - despNaoOp;
  const revBruta = yr.grossRevenue * 1000;

  return {
    title: `Resultado Financeiro — ${year}`,
    formula: '(Rec.Fin − Desp.Fin + Outras − Desp.NãoOp) × Receita Bruta',
    steps: [
      { label: 'Receitas Financeiras', value: `+${recFin.toFixed(1)}%`, source: 'Premissa editável' },
      { label: 'Despesas Financeiras', value: `-${despFin.toFixed(1)}%`, source: 'Premissa editável' },
      { label: 'Outras Receitas', value: `+${outras.toFixed(1)}%`, source: 'Premissa editável' },
      { label: 'Desp. Não Operacionais', value: `-${despNaoOp.toFixed(1)}%`, source: 'Premissa editável' },
      { label: 'Resultado Líquido', value: `${net.toFixed(1)}%`, source: 'Soma algébrica' },
      { label: 'Receita Bruta', value: formatCurrency(revBruta), source: 'Engine' },
    ],
    result: formatCurrency(revBruta * net / 100),
    example: `${formatCurrency(revBruta)} × ${net.toFixed(1)}% = ${formatCurrency(revBruta * net / 100)}`,
  };
}

// ─── SQUADS / HEADCOUNT EXPLANATION ───

export function explainSquadsCaaS(
  year: Year, assumptions: Assumptions,
): FormulaExplanation {
  const cos = assumptions.cosConfig ?? DEFAULT_COS_CONFIG;
  // Only advisory CaaS (assessoria + enterprise + corporate) need PFD/CFO/FPA
  const caasEnd = (assumptions.subProductClients.caasAssessoria?.[year] ?? 0)
    + (assumptions.subProductClients.caasEnterprise?.[year] ?? 0)
    + (assumptions.subProductClients.caasCorporate?.[year] ?? 0);
  const numPFD = Math.max(1, Math.ceil(caasEnd / Math.max(1, cos.pfdClientsPerOne)));
  const numCFO = Math.max(1, Math.ceil(caasEnd / Math.max(1, cos.cfoClientsPerOne)));
  const numFPA = Math.max(1, Math.ceil(caasEnd / Math.max(1, cos.fpaClientsPerOne)));

  return {
    title: `Squad CaaS — ${year}`,
    formula: 'ceil(Clientes CaaS ÷ Ratio) para cada cargo',
    steps: [
      { label: 'Clientes CaaS (Dez)', value: caasEnd.toLocaleString('pt-BR'), source: 'Σ sub-produtos CaaS' },
      { label: 'PFD', value: `${numPFD}`, source: `ceil(${caasEnd} ÷ ${cos.pfdClientsPerOne}) = 1 a cada ${cos.pfdClientsPerOne} clientes` },
      { label: 'CFO', value: `${numCFO}`, source: `ceil(${caasEnd} ÷ ${cos.cfoClientsPerOne}) = 1 a cada ${cos.cfoClientsPerOne} clientes` },
      { label: 'FP&A', value: `${numFPA}`, source: `ceil(${caasEnd} ÷ ${cos.fpaClientsPerOne}) = 1 a cada ${cos.fpaClientsPerOne} clientes` },
    ],
    result: `${numPFD + numCFO + numFPA} pessoas`,
    example: `Ex CaaS: ${caasEnd} clientes ÷ ${cos.cfoClientsPerOne} = ceil(${(caasEnd / cos.cfoClientsPerOne).toFixed(1)}) = ${numCFO} CFOs`,
  };
}

export function explainSquadsSaaS(
  year: Year, assumptions: Assumptions,
): FormulaExplanation {
  const cos = assumptions.cosConfig ?? DEFAULT_COS_CONFIG;
  const saasSubEnd = (assumptions.subProductClients.saasOxy?.[year] ?? 0)
    + (assumptions.subProductClients.saasOxyGenio?.[year] ?? 0);
  const numDevSr = Math.max(0, Math.ceil(saasSubEnd / Math.max(1, cos.devSrClientsPerOne)));
  const numCS = Math.max(0, Math.ceil(saasSubEnd / Math.max(1, cos.csClientsPerOne)));

  return {
    title: `Squad SaaS — ${year}`,
    formula: 'ceil(Clientes SaaS assinatura ÷ Ratio)',
    steps: [
      { label: 'Oxy', value: (assumptions.subProductClients.saasOxy?.[year] ?? 0).toLocaleString('pt-BR'), source: 'subProductClients' },
      { label: 'Oxy+Gênio', value: (assumptions.subProductClients.saasOxyGenio?.[year] ?? 0).toLocaleString('pt-BR'), source: 'subProductClients' },
      { label: 'Total assinatura', value: saasSubEnd.toLocaleString('pt-BR'), source: 'Oxy + Oxy+Gênio' },
      { label: 'Dev Seniors', value: `${numDevSr}`, source: `ceil(${saasSubEnd} ÷ ${cos.devSrClientsPerOne})` },
      { label: 'Customer Success', value: `${numCS}`, source: `ceil(${saasSubEnd} ÷ ${cos.csClientsPerOne})` },
    ],
    result: `${numDevSr + numCS} pessoas`,
  };
}

export function explainSquadsSetup(
  year: Year, assumptions: Assumptions,
): FormulaExplanation {
  const cos = assumptions.cosConfig ?? DEFAULT_COS_CONFIG;
  const prevSaasSub = year > 2025
    ? (assumptions.subProductClients.saasOxy?.[(year - 1) as Year] ?? 0) + (assumptions.subProductClients.saasOxyGenio?.[(year - 1) as Year] ?? 0)
    : 0;
  const saasSubEnd = (assumptions.subProductClients.saasOxy?.[year] ?? 0) + (assumptions.subProductClients.saasOxyGenio?.[year] ?? 0);
  const prevCaas = year > 2025
    ? (assumptions.subProductClients.caasEnterprise?.[(year - 1) as Year] ?? 0) + (assumptions.subProductClients.caasCorporate?.[(year - 1) as Year] ?? 0)
    : 0;
  const caasEnd = (assumptions.subProductClients.caasEnterprise?.[year] ?? 0) + (assumptions.subProductClients.caasCorporate?.[year] ?? 0);
  const newPerMonth = Math.max(0, ((saasSubEnd - prevSaasSub) + (caasEnd - prevCaas)) / 12);
  const numSquads = newPerMonth > 0 ? Math.max(1, Math.ceil(newPerMonth / Math.max(1, cos.setupClientsPerSquad))) : 0;
  const numHeadData = newPerMonth > 0 ? Math.max(1, Math.ceil(newPerMonth / Math.max(1, cos.headDataClientsPerOne))) : 0;
  const people = numSquads * (cos.dataAnalystPerSquad + cos.processAnalystPerSquad) + numHeadData;

  return {
    title: `Squad Setup — ${year}`,
    formula: 'Novos clientes/mês = (ΔSaaS + ΔCaaS Enterprise+Corporate) ÷ 12',
    steps: [
      { label: 'Novos SaaS (ano)', value: `${saasSubEnd - prevSaasSub}`, source: `${saasSubEnd} − ${prevSaasSub}` },
      { label: 'Novos CaaS Ent+Corp (ano)', value: `${caasEnd - prevCaas}`, source: `${caasEnd} − ${prevCaas}` },
      { label: 'Novos/mês', value: `${Math.round(newPerMonth)}`, source: `(${saasSubEnd - prevSaasSub + caasEnd - prevCaas}) ÷ 12` },
      { label: 'Squads Setup', value: `${numSquads}`, source: `ceil(${Math.round(newPerMonth)} ÷ ${cos.setupClientsPerSquad})` },
      { label: 'Heads of Data', value: `${numHeadData}`, source: `ceil(${Math.round(newPerMonth)} ÷ ${cos.headDataClientsPerOne})` },
    ],
    result: `${people} pessoas`,
    example: `${numSquads} squads × ${cos.dataAnalystPerSquad + cos.processAnalystPerSquad} + ${numHeadData} heads = ${people}`,
  };
}

// ─── CLIENTES TOTAIS (Resumo Financeiro) ───

export function explainResumoClientes(
  year: Year,
  assumptions: Assumptions,
  model: FullModelOutput,
): FormulaExplanation {
  const sp = assumptions.subProductClients;
  const yr = model.years[year];

  const caas = (sp.caasAssessoria?.[year] ?? 0) + (sp.caasEnterprise?.[year] ?? 0)
    + (sp.caasCorporate?.[year] ?? 0) + (sp.caasSetup?.[year] ?? 0) + (sp.caasParceiros?.[year] ?? 0);
  const saas = (sp.saasOxy?.[year] ?? 0) + (sp.saasOxyGenio?.[year] ?? 0)
    + (sp.saasSetup?.[year] ?? 0) + (sp.saasParceiros?.[year] ?? 0) + (sp.saasOxyGenioEsp?.[year] ?? 0);
  const edu = (sp.educationDonoCFO?.[year] ?? 0) + (sp.educationEN?.[year] ?? 0)
    + (sp.educationFR?.[year] ?? 0) + (sp.educationFSP?.[year] ?? 0);
  const exp = (sp.baas?.[year] ?? 0) + (sp.baasFranquia?.[year] ?? 0) + (sp.baasMasterFranquia?.[year] ?? 0);
  const tax = (sp.taxAT?.[year] ?? 0) + (sp.taxGPT?.[year] ?? 0) + (sp.taxRCT?.[year] ?? 0)
    + (sp.taxRT?.[year] ?? 0) + (sp.taxDTC?.[year] ?? 0);
  const totalFromAssumptions = caas + saas + edu + exp + tax;

  const engineTotal = yr.totalClients;
  const isHistorical = year <= 2025;

  const steps: FormulaStep[] = [
    { label: 'CaaS', value: caas.toLocaleString('pt-BR'), source: `Assessoria ${sp.caasAssessoria?.[year] ?? 0} + Enterprise ${sp.caasEnterprise?.[year] ?? 0} + Corporate ${sp.caasCorporate?.[year] ?? 0} + Setup ${sp.caasSetup?.[year] ?? 0}` },
    { label: 'SaaS', value: saas.toLocaleString('pt-BR'), source: `Oxy ${sp.saasOxy?.[year] ?? 0} + OxyGênio ${sp.saasOxyGenio?.[year] ?? 0} + Setup ${sp.saasSetup?.[year] ?? 0}` },
    { label: 'Education', value: edu.toLocaleString('pt-BR'), source: `DonoCFO ${sp.educationDonoCFO?.[year] ?? 0}` },
    { label: 'Expansão', value: exp.toLocaleString('pt-BR'), source: `Oxy Hacker ${sp.baas?.[year] ?? 0} + Franquia ${sp.baasFranquia?.[year] ?? 0} + Master ${sp.baasMasterFranquia?.[year] ?? 0}` },
    { label: 'Tax', value: tax.toLocaleString('pt-BR'), source: `AT ${sp.taxAT?.[year] ?? 0} + GPT ${sp.taxGPT?.[year] ?? 0} + RCT ${sp.taxRCT?.[year] ?? 0} + RT ${sp.taxRT?.[year] ?? 0} + DTC ${sp.taxDTC?.[year] ?? 0}` },
    { label: 'Σ Premissas (Dez)', value: totalFromAssumptions.toLocaleString('pt-BR'), source: 'Soma de todos os subprodutos' },
    { label: 'Engine (Dez)', value: engineTotal.toLocaleString('pt-BR'), source: isHistorical ? 'Derivado da receita real Oxy ÷ ticket' : 'Calculado mês a mês pelo motor' },
  ];

  return {
    title: `Clientes Totais — ${year}`,
    formula: 'Σ clientes ativos (Dezembro) de todos os 13+ subprodutos',
    steps,
    result: engineTotal.toLocaleString('pt-BR'),
    example: isHistorical
      ? `${year}: clientes derivados da receita real do Oxy dividida pelo ticket médio de cada produto`
      : `${caas} CaaS + ${saas} SaaS + ${edu} Edu + ${exp} Exp + ${tax} Tax = ${totalFromAssumptions} (premissas Dez)`,
  };
}
