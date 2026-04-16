#!/usr/bin/env node
/**
 * sync-historical-data.mjs
 *
 * Calls the Supabase Edge Function `fetch-dre-data` which reads the Oxy DRE
 * PostgreSQL database, then generates /src/data/historicalData.ts with fresh
 * values.  Run whenever the Oxy DRE DB is updated (monthly close, reclassifications, etc.).
 *
 * Usage:
 *   node scripts/sync-historical-data.mjs
 *
 * Requirements:
 *   - The `fetch-dre-data` edge function must be deployed and DRE_DB_* env vars
 *     must be configured in Supabase Function settings.
 */

const SUPABASE_URL = 'https://nqpmyugsscvqsvjxdshd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xcG15dWdzc2N2cXN2anhkc2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDA4MjIsImV4cCI6MjA4ODkxNjgyMn0.e7RfALb11WA__w0hF5fq0NI3oMxcwQQ4Y4kfC4HcawI';

const OXY_API_BASE = 'https://api.oxy.finance/v2/dre/dre-drill-down';
const OXY_API_KEY = '65ef8d4f-4e78-4e94-8ce1-5eb7e0028ad8';
const CNPJ = '23.813.779/0001-60';

import { writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const DRE_ONLY = process.argv.includes('--dre-only');

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../src/data/historicalData.ts');

// ─── Helpers ───

function toRecord(obj) {
  const r = {};
  for (const [k, v] of Object.entries(obj)) r[k] = v;
  return r;
}

function fmt(n) {
  return typeof n === 'number' ? n : 0;
}

// ─── Step 1: Fetch DRE from Edge Function ───

async function fetchDRE() {
  console.log('Fetching DRE data from Supabase Edge Function...');
  const res = await fetch(`${SUPABASE_URL}/functions/v1/fetch-dre-data`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Edge Function error: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Step 2: Fetch revenue detail per sub-product from Oxy API ───

const CATEGORY_MAP = [
  { api: 'Enterprise',            key: 'caasEnterprise' },
  { api: 'Corporate',             key: 'caasCorporate' },
  { api: 'Serviços Especializados', key: 'caasAssessoria' },
  { api: 'BPO Financeiro',        key: 'caasSetup' },
  { api: 'Parceiros',             key: 'caasParceiros' },
  { api: 'Oxy',                   key: 'saasOxy' },
  { api: 'Oxy + Gênio',           key: 'saasOxyGenio' },
  { api: 'Oxy + Gênio + Especialista', key: 'saasOxyGenioEsp' },
  { api: 'Setup',                 key: 'saasSetup' },
  { api: 'SaaS - Parceiros',      key: 'saasParceiros' },
  { api: 'Dono CFO',              key: 'educationDonoCFO' },
  { api: 'Engenheiro de Negócios', key: 'educationEN' },
  { api: 'Financeiro Raiz',       key: 'educationFR' },
  { api: 'Finance Sales Program', key: 'educationFSP' },
  { api: 'Oxy Hacker',            key: 'baas' },
  { api: 'Franquia',              key: 'baasFranquia' },
  { api: 'Master Franquia',       key: 'baasMasterFranquia' },
  { api: 'AT',                    key: 'taxAT' },
  { api: 'GPT',                   key: 'taxGPT' },
  { api: 'RCT',                   key: 'taxRCT' },
  { api: 'RT',                    key: 'taxRT' },
  { api: 'DTC',                   key: 'taxDTC' },
];

async function fetchOxyCategory(category, startDate, endDate) {
  const url = `${OXY_API_BASE}?category=${encodeURIComponent(category)}&startDate=${startDate}&endDate=${endDate}&cnpjs[]=${encodeURIComponent(CNPJ)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000); // 30s timeout
  try {
    const res = await fetch(url, { headers: { 'x-api-key': OXY_API_KEY }, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`  Warning: API error for ${category}: ${res.status}`);
      return [];
    }
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    clearTimeout(timer);
    console.warn(`  Warning: Timeout/error for ${category}: ${err.message || err}`);
    return [];
  }
}

async function fetchAllRevenueItems(periods) {
  const startDate = periods[0] + '-01';
  const lastP = periods[periods.length - 1];
  const [y, m] = lastP.split('-').map(Number);
  const endDate = `${y}-${String(m).padStart(2, '0')}-28`;

  const result = {};
  for (const { api, key } of CATEGORY_MAP) {
    console.log(`  Fetching Oxy API: ${api} → ${key}`);
    const data = await fetchOxyCategory(api, startDate, endDate);
    result[key] = {};
    for (const client of data) {
      for (const dp of (client.data || [])) {
        if (dp.period && periods.includes(dp.period)) {
          result[key][dp.period] = (result[key][dp.period] || 0) + (dp.value || 0);
        }
      }
    }
    await new Promise(r => setTimeout(r, 200)); // rate limit
  }
  return result;
}

// ─── Step 3: Transform DRE → historicalData.ts structures ───

function buildHistoricalData(dre, revenueItems) {
  const { pnlTree, cashFlowData, periods } = dre;

  // --- historicalMetrics: P&L summary metrics by period ---
  const metrics = {};
  const summaryLabels = {
    'RB_T': 'RECEITA BRUTA',
    'NR': 'RECEITA LÍQUIDA',
    'CV_T': 'CUSTOS VARIÁVEIS',
    'GP': 'LUCRO BRUTO',
    'DX_T': 'DESPESAS FIXAS',
    'EBITDA': 'EBITDA',
    'NI': 'RESULTADO LÍQUIDO',
    'FCR': 'RESULTADO FINAL',
  };
  for (const node of pnlTree) {
    const label = summaryLabels[node.code];
    if (label && node.monthly) {
      metrics[label] = {};
      for (const [yr, months] of Object.entries(node.monthly)) {
        for (let m = 0; m < months.length; m++) {
          const period = `${yr}-${String(m + 1).padStart(2, '0')}`;
          if (periods.includes(period) && months[m] !== 0) {
            metrics[label][period] = months[m];
          }
        }
      }
    }
  }

  // --- historicalRevenue: Revenue by BU (from cashFlowData) ---
  const revenue = {};
  const buMap = {
    revenueCaaS: 'CaaS',
    revenueSaaS: 'SaaS',
    revenueEducation: 'Education',
    revenueExpansao: 'Expansão',
    revenueTax: 'Tax',
  };
  for (const [cfKey, label] of Object.entries(buMap)) {
    const cf = cashFlowData[cfKey];
    if (!cf) continue;
    revenue[label] = {};
    for (const [yr, months] of Object.entries(cf.monthly)) {
      for (let m = 0; m < months.length; m++) {
        const period = `${yr}-${String(m + 1).padStart(2, '0')}`;
        if (periods.includes(period)) {
          revenue[label][period] = months[m];
        }
      }
    }
  }

  // --- historicalCosts: Variable costs by BU ---
  const costs = {};
  const costMap = {
    variableCosts: null, // we need individual BU costs from pnlTree
  };
  // Find CV category node in pnlTree
  for (const node of pnlTree) {
    if (node.children) {
      for (const child of node.children) {
        const label = child.label;
        if (['CaaS', 'SaaS', 'Education', 'Customer Success', 'Expansão', 'Tax'].some(bu =>
          label.toLowerCase().includes(bu.toLowerCase())
        )) {
          const costLabel = `Custos ${label.replace('Custos ', '').replace('Custo ', '')}`;
          costs[costLabel] = {};
          if (child.monthly) {
            for (const [yr, months] of Object.entries(child.monthly)) {
              for (let m = 0; m < months.length; m++) {
                const period = `${yr}-${String(m + 1).padStart(2, '0')}`;
                if (periods.includes(period)) {
                  costs[costLabel][period] = Math.abs(months[m]);
                }
              }
            }
          }
        }
      }
    }
  }

  // --- historicalExpenses: Fixed expenses by category (from cashFlowData) ---
  const expenses = {};
  const expMap = {
    marketingExpenses: 'Despesas de Marketing',
    commercialExpenses: 'Despesas Comerciais',
    personnelExpenses: 'Despesas com Pessoal',
    adminExpenses: 'Despesas Administrativas',
  };
  for (const [cfKey, label] of Object.entries(expMap)) {
    const cf = cashFlowData[cfKey];
    if (!cf) continue;
    expenses[label] = {};
    for (const [yr, months] of Object.entries(cf.monthly)) {
      for (let m = 0; m < months.length; m++) {
        const period = `${yr}-${String(m + 1).padStart(2, '0')}`;
        if (periods.includes(period)) {
          expenses[label][period] = Math.abs(months[m]);
        }
      }
    }
  }

  // --- historicalFinancial: Financial result detail (from pnlTree) ---
  const financial = {};
  const finCodes = { 'RF': 'RF', 'DF': 'DF', 'OR': 'OR', 'DN': 'DNO' };
  for (const node of pnlTree) {
    for (const [catCode, outCode] of Object.entries(finCodes)) {
      // Match by label pattern since codes are sequential numbers
      const labelMatch = {
        'RF': 'Receitas Financeiras',
        'DF': 'Despesas Financeiras',
        'OR': 'Outras Receitas',
        'DN': 'Despesas Não Operacionais',
      };
      if (node.label.includes(labelMatch[catCode]) && node.children) {
        financial[outCode] = {};
        for (const group of node.children) {
          financial[outCode][group.label] = {};
          if (group.children) {
            for (const item of group.children) {
              financial[outCode][group.label][item.label] = {};
              if (item.monthly) {
                for (const [yr, months] of Object.entries(item.monthly)) {
                  for (let m = 0; m < months.length; m++) {
                    const period = `${yr}-${String(m + 1).padStart(2, '0')}`;
                    if (periods.includes(period)) {
                      financial[outCode][group.label][item.label][period] = Math.abs(months[m]);
                    }
                  }
                }
              }
            }
          } else {
            // Group without children — treat group itself as the item
            financial[outCode][group.label] = { [group.label]: {} };
            if (group.monthly) {
              for (const [yr, months] of Object.entries(group.monthly)) {
                for (let m = 0; m < months.length; m++) {
                  const period = `${yr}-${String(m + 1).padStart(2, '0')}`;
                  if (periods.includes(period)) {
                    financial[outCode][group.label][group.label][period] = Math.abs(months[m]);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // --- historicalCostItems & historicalExpenseItems: detail sub-items ---
  const costItems = {};
  const expenseItems = {};
  for (const node of pnlTree) {
    if (!node.children) continue;
    for (const child of node.children) {
      // Cost items
      if (child.label.startsWith('Custos') && child.children) {
        costItems[child.label] = {};
        for (const item of child.children) {
          costItems[child.label][item.label] = {};
          if (item.monthly) {
            for (const [yr, months] of Object.entries(item.monthly)) {
              for (let m = 0; m < months.length; m++) {
                const period = `${yr}-${String(m + 1).padStart(2, '0')}`;
                if (periods.includes(period)) {
                  costItems[child.label][item.label][period] = Math.abs(months[m]);
                }
              }
            }
          }
        }
      }
      // Expense items
      if (child.label.startsWith('Despesas') && child.children) {
        expenseItems[child.label] = {};
        for (const item of child.children) {
          expenseItems[child.label][item.label] = {};
          if (item.monthly) {
            for (const [yr, months] of Object.entries(item.monthly)) {
              for (let m = 0; m < months.length; m++) {
                const period = `${yr}-${String(m + 1).padStart(2, '0')}`;
                if (periods.includes(period)) {
                  expenseItems[child.label][item.label][period] = Math.abs(months[m]);
                }
              }
            }
          }
        }
      }
    }
  }

  return { periods, metrics, revenue, revenueItems, costs, costItems, expenses, expenseItems, financial };
}

// ─── Step 4: Generate TypeScript ───

function generateTS(data) {
  const { periods, metrics, revenue, revenueItems, costs, costItems, expenses, expenseItems, financial } = data;

  const js = (obj) => JSON.stringify(obj, null, 2);

  const now = new Date().toISOString().split('T')[0];

  return `// Auto-generated by scripts/sync-historical-data.mjs on ${now}
// Source: Oxy DRE database via Supabase Edge Function + Oxy API
// DO NOT EDIT MANUALLY — re-run the script to refresh.

// Available periods
export const HISTORICAL_PERIODS = ${js(periods)} as const;

// P&L Summary metrics by period (RECEITA BRUTA, RECEITA LIQUIDA, LUCRO BRUTO, EBITDA, etc.)
export const historicalMetrics: Record<string, Record<string, number>> = ${js(metrics)};

// Revenue by Business Unit (CaaS, SaaS, Education, Expansão, Tax)
export const historicalRevenue: Record<string, Record<string, number>> = ${js(revenue)};

// Revenue line items by sub-product (from Oxy API drill-down)
export const historicalRevenueItems: Record<string, Record<string, number>> = ${js(revenueItems)};

// Variable costs by BU (Custos Caas, Custos SaaS, etc.)
export const historicalCosts: Record<string, Record<string, number>> = ${js(costs)};

// Variable cost line items detail: group -> item -> period -> value
export const historicalCostItems: Record<string, Record<string, Record<string, number>>> = ${js(costItems)};

// Fixed expenses by category (Despesas de Marketing, Comerciais, Pessoal, Administrativas)
export const historicalExpenses: Record<string, Record<string, number>> = ${js(expenses)};

// Fixed expense line items detail: group -> item -> period -> value
export const historicalExpenseItems: Record<string, Record<string, Record<string, number>>> = ${js(expenseItems)};

// Financial result detail: code -> group -> item -> period -> value
// Codes: RF (Receitas Financeiras), DF (Despesas Financeiras), RNO (Outras Receitas), DNO (Desp. Não Operacionais)
export const historicalFinancial: Record<string, Record<string, Record<string, Record<string, number>>>> = ${js(financial)};
`;
}

// ─── Main ───

async function main() {
  try {
    console.log('=== Sync Historical Data from Oxy DRE ===\n');

    // Step 1: Fetch DRE
    const dre = await fetchDRE();
    console.log(`  Got ${dre.periods.length} periods, ${dre.pnlTree.length} P&L nodes\n`);

    // Step 2: Fetch revenue items
    let revenueItems;
    if (DRE_ONLY) {
      console.log('--dre-only: Skipping Oxy API calls, keeping existing revenue items...');
      // Extract historicalRevenueItems from existing file via regex
      try {
        const existing = readFileSync(OUTPUT_PATH, 'utf-8');
        const match = existing.match(/export const historicalRevenueItems[^=]*=\s*(\{[\s\S]*?\n\});/);
        if (match) {
          revenueItems = JSON.parse(match[1]);
          console.log(`  Kept ${Object.keys(revenueItems).length} sub-products from existing file\n`);
        } else {
          revenueItems = {};
          console.log('  Warning: Could not parse existing file, revenue items will be empty\n');
        }
      } catch {
        revenueItems = {};
        console.log('  Warning: No existing file found, revenue items will be empty\n');
      }
    } else {
      console.log('Fetching revenue detail per sub-product from Oxy API...');
      revenueItems = await fetchAllRevenueItems(dre.periods);
      const itemCount = Object.values(revenueItems).reduce((s, v) => s + Object.keys(v).length, 0);
      console.log(`  Got ${itemCount} revenue data points across ${Object.keys(revenueItems).length} sub-products\n`);
    }

    // Step 3: Transform
    console.log('Transforming data...');
    const data = buildHistoricalData(dre, revenueItems);

    // Step 4: Generate TypeScript
    console.log('Generating historicalData.ts...');
    const ts = generateTS(data);
    writeFileSync(OUTPUT_PATH, ts, 'utf-8');
    console.log(`\nDone! Written to ${OUTPUT_PATH}`);
    console.log(`  Periods: ${data.periods.join(', ')}`);
    console.log(`  Metrics: ${Object.keys(data.metrics).join(', ')}`);
    console.log(`  Costs BUs: ${Object.keys(data.costs).join(', ')}`);
    console.log(`  Expenses: ${Object.keys(data.expenses).join(', ')}`);

  } catch (err) {
    console.error('FATAL:', err.message || err);
    process.exit(1);
  }
}

main();
