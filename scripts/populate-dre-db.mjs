#!/usr/bin/env node
/**
 * populate-dre-db.mjs
 *
 * Fetches full DRE from Oxy API (dre-table endpoint) and writes directly
 * to the PostgreSQL DRE database. Then regenerates historicalData.ts.
 */

const DRE_DB = {
  host: '5.78.97.125',
  port: 5432,
  database: 'dre_analytics',
  user: 'postgres',
  password: 'b85ad58ebb9e9caed0e200bc640e1d82',
};

const OXY_API_KEY = '65ef8d4f-4e78-4e94-8ce1-5eb7e0028ad8';
const CNPJ = '23.813.779/0001-60';
const CNPJ_CLEAN = '23813779000160';

import pg from 'pg';
const { Client } = pg;

// ── Step 1: Fetch DRE from Oxy ──

async function fetchOxyDRE(startDate, endDate) {
  const url = `https://api.oxy.finance/v2/dre/dre-table?startDate=${startDate}&endDate=${endDate}&cnpjs[]=${encodeURIComponent(CNPJ)}`;
  console.log('Fetching Oxy DRE table...');
  const res = await fetch(url, { headers: { 'x-api-key': OXY_API_KEY } });
  if (!res.ok) throw new Error(`Oxy API error: ${res.status}`);
  const data = await res.json();
  console.log(`  Got ${data.groups.length} groups, periods: ${data.periods.filter(p => p !== 'TOTAL').join(', ')}`);
  return data;
}

// ── Step 2: Write to DRE DB ──

async function populateDB(dre) {
  const client = new Client(DRE_DB);
  await client.connect();
  console.log('Connected to DRE DB');

  const groups = dre.groups;
  const periods = dre.periods.filter(p => p !== 'TOTAL');

  // Map: label → group_id (insert if not exists)
  const groupMap = {};

  for (const g of groups) {
    const isMetric = g.type === 'metric';
    const categoryCode = isMetric ? null : (g.code || null);

    // Check if exists
    const existing = await client.query('SELECT id FROM dre_groups WHERE label = $1', [g.label]);
    let groupId;
    if (existing.rows.length > 0) {
      groupId = existing.rows[0].id;
    } else {
      const ins = await client.query(
        `INSERT INTO dre_groups (label, is_metric, category_code, updated_at)
         VALUES ($1, $2, $3, NOW()) RETURNING id`,
        [g.label, isMetric, categoryCode]
      );
      groupId = ins.rows[0].id;
      console.log(`  Created group: ${g.label} (${isMetric ? 'metric' : categoryCode})`);
    }
    groupMap[g.label] = groupId;

    // Upsert dre_data for each period
    for (const dp of g.data) {
      if (dp.period === 'TOTAL') continue;
      await client.query(
        `INSERT INTO dre_data (cnpj, group_id, period, value, av, avc, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (cnpj, group_id, period)
         DO UPDATE SET value = $4, av = $5, avc = $6, updated_at = NOW()`,
        [CNPJ_CLEAN, groupId, dp.period, dp.value, dp.av || 0, dp.avc || 0]
      );
    }
  }

  // Count
  const countRes = await client.query('SELECT COUNT(*) as total FROM dre_data');
  console.log(`  dre_data: ${countRes.rows[0].total} rows`);

  // Log
  await client.query(
    `INSERT INTO integration_logs (execution_mode, period_start, period_end, status, records_processed)
     VALUES ('script', $1, $2, 'success', $3)`,
    [periods[0], periods[periods.length - 1], Object.keys(groupMap).length * periods.length]
  );

  await client.end();
  console.log('DRE DB populated successfully!\n');
  return groupMap;
}

// ── Step 3: Fetch drill-down items from Oxy API ──

async function fetchDrillDownItems(groupLabel, startDate, endDate) {
  const url = `https://api.oxy.finance/v2/dre/dre-drill-down?category=${encodeURIComponent(groupLabel)}&startDate=${startDate}&endDate=${endDate}&cnpjs[]=${encodeURIComponent(CNPJ)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, { headers: { 'x-api-key': OXY_API_KEY }, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    clearTimeout(timer);
    return [];
  }
}

async function populateItems(dre, groupMap) {
  const client = new Client(DRE_DB);
  await client.connect();

  const startDate = dre.periods.find(p => p !== 'TOTAL') + '-01';
  const lastP = dre.periods.filter(p => p !== 'TOTAL').pop();
  const endDate = lastP + '-28';

  let totalItems = 0;

  for (const g of dre.groups) {
    if (g.type === 'metric') continue;
    const groupId = groupMap[g.label];
    if (!groupId) continue;

    console.log(`  Drill-down: ${g.label}`);
    const items = await fetchDrillDownItems(g.label, startDate, endDate);

    for (const item of items) {
      for (const dp of (item.data || [])) {
        if (!dp.period || dp.period === 'TOTAL') continue;
        await client.query(
          `INSERT INTO dre_category_items (group_id, item_name, period, value, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (group_id, item_name, period)
           DO UPDATE SET value = $4, updated_at = NOW()`,
          [groupId, item.label, dp.period, dp.value || 0]
        );
        totalItems++;
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }

  const countRes = await client.query('SELECT COUNT(*) as total FROM dre_category_items');
  console.log(`  dre_category_items: ${countRes.rows[0].total} rows (${totalItems} upserted)`);

  await client.end();
}

// ── Step 4: Generate historicalData.ts ──

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../src/data/historicalData.ts');

async function generateHistoricalData(dre) {
  const client = new Client(DRE_DB);
  await client.connect();

  const periods = dre.periods.filter(p => p !== 'TOTAL');

  // Read all data from DB
  const groupsRes = await client.query('SELECT id, label, is_metric, category_code FROM dre_groups ORDER BY label');
  const dataRes = await client.query("SELECT group_id, period, value::float FROM dre_data WHERE period != 'TOTAL' ORDER BY period");
  const itemsRes = await client.query("SELECT group_id, item_name, period, value::float FROM dre_category_items WHERE period != 'TOTAL' ORDER BY item_name, period");

  // Build lookups
  const groupById = {};
  const groupByLabel = {};
  for (const g of groupsRes.rows) {
    groupById[g.id] = g;
    groupByLabel[g.label] = g;
  }

  // group_id → period → value
  const dataByGroup = {};
  for (const d of dataRes.rows) {
    if (!dataByGroup[d.group_id]) dataByGroup[d.group_id] = {};
    dataByGroup[d.group_id][d.period] = d.value;
  }

  // group_id → item_name → period → value
  const itemsByGroup = {};
  for (const it of itemsRes.rows) {
    if (!itemsByGroup[it.group_id]) itemsByGroup[it.group_id] = {};
    if (!itemsByGroup[it.group_id][it.item_name]) itemsByGroup[it.group_id][it.item_name] = {};
    itemsByGroup[it.group_id][it.item_name][it.period] = it.value;
  }

  await client.end();

  // Build exports
  const metricLabels = ['RECEITA BRUTA', 'RECEITA LÍQUIDA', 'CUSTOS VARIÁVEIS', 'LUCRO BRUTO', 'DESPESAS FIXAS', 'EBITDA', 'RESULTADO LÍQUIDO', 'RESULTADO FINAL'];
  const historicalMetrics = {};
  for (const label of metricLabels) {
    const g = groupByLabel[label];
    if (g && dataByGroup[g.id]) historicalMetrics[label] = dataByGroup[g.id];
  }

  // Revenue by BU
  const buMap = { CaaS: 'CaaS', SaaS: 'SaaS', Education: 'Education', 'Expansão': 'Expansão', Tax: 'Tax' };
  const historicalRevenue = {};
  for (const [label, out] of Object.entries(buMap)) {
    const g = groupByLabel[label];
    if (g && dataByGroup[g.id]) historicalRevenue[out] = dataByGroup[g.id];
  }

  // Revenue items (from drill-down detail)
  const historicalRevenueItems = {};
  for (const [label] of Object.entries(buMap)) {
    const g = groupByLabel[label];
    if (g && itemsByGroup[g.id]) {
      for (const [itemName, periodData] of Object.entries(itemsByGroup[g.id])) {
        historicalRevenueItems[itemName] = periodData;
      }
    }
  }

  // Deductions detail
  const historicalDeductions = {};
  const dedGroup = groupByLabel['Deduções de Vendas'];
  if (dedGroup && itemsByGroup[dedGroup.id]) {
    for (const [itemName, periodData] of Object.entries(itemsByGroup[dedGroup.id])) {
      historicalDeductions[itemName] = periodData;
    }
  }

  // Costs by BU
  const costLabels = ['Custos Caas', 'Custos Customer Success', 'Custos Education', 'Custos Expansão', 'Custos SaaS', 'Custos Tax'];
  const historicalCosts = {};
  for (const label of costLabels) {
    const g = groupByLabel[label];
    if (g && dataByGroup[g.id]) historicalCosts[label] = dataByGroup[g.id];
  }

  // Cost items
  const historicalCostItems = {};
  for (const label of costLabels) {
    const g = groupByLabel[label];
    if (g && itemsByGroup[g.id]) historicalCostItems[label] = itemsByGroup[g.id];
  }

  // Expenses
  const expLabels = ['Despesas Administrativas', 'Despesas Comerciais', 'Despesas com Pessoal', 'Despesas de Marketing'];
  const historicalExpenses = {};
  for (const label of expLabels) {
    const g = groupByLabel[label];
    if (g && dataByGroup[g.id]) historicalExpenses[label] = dataByGroup[g.id];
  }

  // Expense items
  const historicalExpenseItems = {};
  for (const label of expLabels) {
    const g = groupByLabel[label];
    if (g && itemsByGroup[g.id]) historicalExpenseItems[label] = itemsByGroup[g.id];
  }

  // Financial detail
  const finMap = { 'Receitas Financeiras': 'RF', 'Despesas Financeira': 'DF', 'Outras Receitas': 'RNO', 'Despesas Não operacionais': 'DNO' };
  const historicalFinancial = {};
  for (const [label, code] of Object.entries(finMap)) {
    const g = groupByLabel[label];
    if (g && itemsByGroup[g.id]) {
      historicalFinancial[code] = { [label]: itemsByGroup[g.id] };
    }
  }

  const js = (obj) => JSON.stringify(obj, null, 2);
  const now = new Date().toISOString().split('T')[0];

  const ts = `// Auto-generated by scripts/populate-dre-db.mjs on ${now}
// Source: Oxy DRE API → PostgreSQL o2_dre database
// DO NOT EDIT MANUALLY — re-run the script to refresh.

export const HISTORICAL_PERIODS = ${js(periods)} as const;

// P&L Summary metrics by period
export const historicalMetrics: Record<string, Record<string, number>> = ${js(historicalMetrics)};

// Revenue by BU
export const historicalRevenue: Record<string, Record<string, number>> = ${js(historicalRevenue)};

// Revenue line items (from Oxy drill-down)
export const historicalRevenueItems: Record<string, Record<string, number>> = ${js(historicalRevenueItems)};

// Deductions detail (PIS, COFINS, ISS, etc.)
export const historicalDeductions: Record<string, Record<string, number>> = ${js(historicalDeductions)};

// Variable costs by BU
export const historicalCosts: Record<string, Record<string, number>> = ${js(historicalCosts)};

// Variable cost line items detail
export const historicalCostItems: Record<string, Record<string, Record<string, number>>> = ${js(historicalCostItems)};

// Fixed expenses by category
export const historicalExpenses: Record<string, Record<string, number>> = ${js(historicalExpenses)};

// Fixed expense line items detail
export const historicalExpenseItems: Record<string, Record<string, Record<string, number>>> = ${js(historicalExpenseItems)};

// Financial result detail
export const historicalFinancial: Record<string, Record<string, Record<string, Record<string, number>>>> = ${js(historicalFinancial)};
`;

  writeFileSync(OUTPUT_PATH, ts, 'utf-8');
  console.log(`Generated ${OUTPUT_PATH}`);
}

// ── Main ──

async function main() {
  console.log('=== Populate DRE DB from Oxy API ===\n');

  const dre = await fetchOxyDRE('2025-01-01', '2026-03-31');
  const groupMap = await populateDB(dre);

  console.log('Fetching drill-down items (may be slow)...');
  await populateItems(dre, groupMap);

  console.log('\nGenerating historicalData.ts...');
  await generateHistoricalData(dre);

  // Validate
  console.log('\n=== Validation ===');
  const rb2025 = dre.groups.find(g => g.label === 'RECEITA BRUTA')?.data.filter(d => d.period.startsWith('2025')).reduce((s, d) => s + d.value, 0);
  console.log('Receita Bruta 2025 (Oxy):', rb2025?.toFixed(2));
  console.log('Done!');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
