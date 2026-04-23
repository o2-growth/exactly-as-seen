import { Assumptions, Year, YEARS, TicketKey } from './financialData';

export interface FieldChange {
  field: string;
  path: string;
  oldValue: number | string | boolean | null;
  newValue: number | string | boolean | null;
}

export interface AssumptionsDiff {
  changedFields: string[];
  changes: FieldChange[];
  summary: string;
}

function compareScalar(
  label: string,
  path: string,
  a: number | string | boolean | null | undefined,
  b: number | string | boolean | null | undefined,
  changes: FieldChange[],
) {
  if (a !== b) {
    changes.push({ field: label, path, oldValue: a ?? null, newValue: b ?? null });
  }
}

function compareYearRecord(
  label: string,
  pathPrefix: string,
  a: Record<number, number> | undefined,
  b: Record<number, number> | undefined,
  changes: FieldChange[],
) {
  if (!a || !b) return;
  for (const y of YEARS) {
    if ((a[y] ?? 0) !== (b[y] ?? 0)) {
      changes.push({
        field: `${label} ${y}`,
        path: `${pathPrefix}.${y}`,
        oldValue: a[y] ?? 0,
        newValue: b[y] ?? 0,
      });
    }
  }
}

export function computeAssumptionsDiff(
  oldA: Assumptions,
  newA: Assumptions,
): AssumptionsDiff {
  const changes: FieldChange[] = [];

  // --- Sub-product clients ---
  if (oldA.subProductClients && newA.subProductClients) {
    for (const key of Object.keys(oldA.subProductClients) as (keyof typeof oldA.subProductClients)[]) {
      compareYearRecord(
        `Clientes ${key}`,
        `subProductClients.${key}`,
        oldA.subProductClients[key],
        newA.subProductClients[key],
        changes,
      );
    }
  }

  // --- Aggregate client counts ---
  compareYearRecord('CaaS Clients', 'caasClients', oldA.caasClients, newA.caasClients, changes);
  compareYearRecord('SaaS Clients', 'saasClients', oldA.saasClients, newA.saasClients, changes);
  compareYearRecord('Education Clients', 'educationClients', oldA.educationClients, newA.educationClients, changes);
  compareYearRecord('Tax Clients', 'taxClients', oldA.taxClients, newA.taxClients, changes);

  // --- Tickets ---
  if (oldA.tickets && newA.tickets) {
    for (const key of Object.keys(oldA.tickets) as (keyof typeof oldA.tickets)[]) {
      compareScalar(`Ticket ${key}`, `tickets.${key}`, oldA.tickets[key], newA.tickets[key], changes);
    }
  }

  // --- Churn ---
  compareScalar('Churn CaaS', 'churnCaas', oldA.churnCaas, newA.churnCaas, changes);
  compareScalar('Churn SaaS', 'churnSaas', oldA.churnSaas, newA.churnSaas, changes);
  compareScalar('Churn BaaS', 'churnBaas', newA.churnBaas, newA.churnBaas, changes);

  // --- Expense percentages ---
  compareYearRecord('SG&A %', 'sgaPercent', oldA.sgaPercent, newA.sgaPercent, changes);
  compareYearRecord('Marketing %', 'marketingPercent', oldA.marketingPercent, newA.marketingPercent, changes);
  compareYearRecord('Commercial %', 'commercialPercent', oldA.commercialPercent, newA.commercialPercent, changes);
  compareYearRecord('Pessoal %', 'pessoalPercent', oldA.pessoalPercent, newA.pessoalPercent, changes);

  // --- Financial result ---
  compareYearRecord('Receitas Financeiras %', 'receitasFinanceirasPercent', oldA.receitasFinanceirasPercent, newA.receitasFinanceirasPercent, changes);
  compareYearRecord('Despesas Financeiras %', 'despesasFinanceirasPercent', oldA.despesasFinanceirasPercent, newA.despesasFinanceirasPercent, changes);
  compareYearRecord('Outras Receitas %', 'outrasReceitasPercent', oldA.outrasReceitasPercent, newA.outrasReceitasPercent, changes);
  compareYearRecord('Despesas Não-Op %', 'despesasNaoOperacionaisPercent', oldA.despesasNaoOperacionaisPercent, newA.despesasNaoOperacionaisPercent, changes);

  // --- Headcount ---
  compareScalar('Headcount Growth', 'headcountGrowth', oldA.headcountGrowth, newA.headcountGrowth, changes);
  compareScalar('SG&A Growth Rate', 'sgaGrowthRate', oldA.sgaGrowthRate, newA.sgaGrowthRate, changes);

  if (oldA.headcountSalaries && newA.headcountSalaries) {
    const allKeys = new Set([...Object.keys(oldA.headcountSalaries), ...Object.keys(newA.headcountSalaries)]);
    for (const key of allKeys) {
      compareScalar(
        `Salário ${key}`,
        `headcountSalaries.${key}`,
        oldA.headcountSalaries[key] || 0,
        newA.headcountSalaries[key] || 0,
        changes,
      );
    }
  }

  if (oldA.headcountRatios && newA.headcountRatios) {
    for (const key of Object.keys(oldA.headcountRatios) as (keyof typeof oldA.headcountRatios)[]) {
      compareScalar(
        `Ratio ${key}`,
        `headcountRatios.${key}`,
        oldA.headcountRatios[key],
        newA.headcountRatios[key],
        changes,
      );
    }
  }

  // --- Marketing ---
  compareScalar('Marketing PR', 'marketingPR', oldA.marketingPR, newA.marketingPR, changes);
  compareScalar('Marketing Events', 'marketingEvents', oldA.marketingEvents, newA.marketingEvents, changes);

  // --- Tax ---
  compareScalar('Tax Enabled', 'taxEnabled', oldA.taxEnabled, newA.taxEnabled, changes);
  compareScalar('Selic Monthly', 'selicMonthly', oldA.selicMonthly, newA.selicMonthly, changes);

  // --- CAC per product ---
  if (oldA.cacPerProduct && newA.cacPerProduct) {
    const allCacKeys = new Set([
      ...Object.keys(oldA.cacPerProduct || {}),
      ...Object.keys(newA.cacPerProduct || {}),
    ]);
    for (const key of allCacKeys) {
      compareScalar(
        `CAC ${key}`,
        `cacPerProduct.${key}`,
        (oldA.cacPerProduct as any)?.[key],
        (newA.cacPerProduct as any)?.[key],
        changes,
      );
    }
  }

  // --- PMR Produtos ---
  if (JSON.stringify(oldA.pmrProdutos) !== JSON.stringify(newA.pmrProdutos)) {
    changes.push({ field: 'PMR Produtos', path: 'pmrProdutos', oldValue: 'alterado', newValue: 'alterado' });
  }

  // --- PMP Config ---
  if (JSON.stringify((oldA as any).pmpConfig) !== JSON.stringify((newA as any).pmpConfig)) {
    changes.push({ field: 'PMP Config', path: 'pmpConfig', oldValue: 'alterado', newValue: 'alterado' });
  }

  // --- Valuation ---
  if (oldA.valuationConfig && newA.valuationConfig) {
    const vc = oldA.valuationConfig;
    const nvc = newA.valuationConfig;
    compareScalar('EBITDA Multiple', 'valuationConfig.ebitdaMultiple', vc.ebitdaMultiple, nvc.ebitdaMultiple, changes);
    compareScalar('ARR Multiple', 'valuationConfig.arrMultiple', vc.arrMultiple, nvc.arrMultiple, changes);
    compareScalar('Raise Amount', 'valuationConfig.raiseAmount', vc.raiseAmount, nvc.raiseAmount, changes);
    compareScalar('Raise Valuation', 'valuationConfig.raiseValuation', vc.raiseValuation, nvc.raiseValuation, changes);
  }

  // Build summary
  const changedFields = [...new Set(changes.map(c => c.path.split('.')[0]))];
  const summary = changes.length === 0
    ? 'Nenhuma alteração'
    : `${changes.length} campo(s) alterado(s): ${changedFields.slice(0, 5).join(', ')}${changedFields.length > 5 ? ` +${changedFields.length - 5}` : ''}`;

  return { changedFields, changes, summary };
}

/** Builds compact JSONB for change_summary column */
export function buildChangeSummary(diff: AssumptionsDiff): {
  fields_changed: string[];
  count: number;
  summary: string;
} {
  return {
    fields_changed: diff.changedFields,
    count: diff.changes.length,
    summary: diff.summary,
  };
}

/** Builds previous_values and new_values for audit log */
export function buildAuditValues(diff: AssumptionsDiff): {
  previous_values: Record<string, any>;
  new_values: Record<string, any>;
} {
  const previous_values: Record<string, any> = {};
  const new_values: Record<string, any> = {};

  for (const change of diff.changes) {
    previous_values[change.path] = change.oldValue;
    new_values[change.path] = change.newValue;
  }

  return { previous_values, new_values };
}
