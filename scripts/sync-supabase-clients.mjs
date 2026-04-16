#!/usr/bin/env node
/**
 * sync-supabase-clients.mjs — Fast sync of historical_clients from Oxy API.
 * Fetches ALL periods per category (1 API call each), then PATCHes Supabase.
 */

const OXY_API_KEY = '65ef8d4f-4e78-4e94-8ce1-5eb7e0028ad8';
const OXY_BASE = 'https://api.oxy.finance/v2/dre/dre-drill-down';
const CNPJ = '23.813.779/0001-60';
const SUPABASE_URL = 'https://nqpmyugsscvqsvjxdshd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xcG15dWdzc2N2cXN2anhkc2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDA4MjIsImV4cCI6MjA4ODkxNjgyMn0.e7RfALb11WA__w0hF5fq0NI3oMxcwQQ4Y4kfC4HcawI';

const CATEGORIES = [
  { api: 'Enterprise', key: 'caasEnterprise', mrr: true },
  { api: 'Corporate', key: 'caasCorporate', mrr: true },
  { api: 'Serviços Especializados', key: 'caasAssessoria', mrr: false },
  { api: 'BPO Financeiro', key: 'caasSetup', mrr: true },
  { api: 'Parceiros', key: 'caasParceiros', mrr: false },
  { api: 'Oxy', key: 'saasOxy', mrr: true },
  { api: 'Oxy + Gênio', key: 'saasOxyGenio', mrr: true },
  { api: 'Oxy + Gênio + Especialista', key: 'saasOxyGenioEsp', mrr: true },
  { api: 'Setup', key: 'saasSetup', mrr: false },
  { api: 'Dono CFO', key: 'educationDonoCFO', mrr: false },
  { api: 'Engenheiro de Negócios', key: 'educationEN', mrr: false },
  { api: 'Financeiro Raiz', key: 'educationFR', mrr: false },
  { api: 'Finance Sales Program', key: 'educationFSP', mrr: false },
  { api: 'Oxy Hacker - Micro Franqueado', key: 'baas', mrr: false },
  { api: 'Franquia', key: 'baasFranquia', mrr: false },
  { api: 'Master Franquia', key: 'baasMasterFranquia', mrr: false },
  { api: 'AT - Assessoria Tributária', key: 'taxAT', mrr: true },
  { api: 'GPT - Gestão passivo tributário', key: 'taxGPT', mrr: false },
  { api: 'RCT - Recuperação Crédito tributário', key: 'taxRCT', mrr: false },
  { api: 'RT - Reforma tributária', key: 'taxRT', mrr: false },
  { api: 'Diagnóstico Tributário & Compliance Tributário', key: 'taxDTC', mrr: false },
];

async function fetchCategory(apiName) {
  const url = `${OXY_BASE}?category=${encodeURIComponent(apiName)}&startDate=2025-01-01&endDate=2026-03-31&cnpjs[]=${encodeURIComponent(CNPJ)}`;
  try {
    const res = await fetch(url, { headers: { 'x-api-key': OXY_API_KEY }, signal: AbortSignal.timeout(60000) });
    if (!res.ok) return [];
    return (await res.json()).data || [];
  } catch (e) {
    console.log(`  ⚠ Timeout: ${apiName}`);
    return [];
  }
}

async function patchRow(period, assumptionKey, data) {
  const url = `${SUPABASE_URL}/rest/v1/historical_clients?period=eq.${period}&assumption_key=eq.${assumptionKey}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  return res.ok;
}

async function run() {
  console.log('=== Sync Supabase historical_clients ===\n');

  // Step 1: Fetch all categories
  const allData = {};
  for (const cat of CATEGORIES) {
    process.stdout.write(`  ${cat.key.padEnd(25)}`);
    const clients = await fetchCategory(cat.api);
    allData[cat.key] = { cat, clients };
    console.log(`${clients.length} clients`);
    await new Promise(r => setTimeout(r, 500));
  }

  // Step 2: Build per-period data and PATCH
  const periods = [];
  for (let y = 2025; y <= 2026; y++) {
    const maxM = y === 2026 ? 3 : 12;
    for (let m = 1; m <= maxM; m++) periods.push(`${y}-${String(m).padStart(2, '0')}`);
  }

  console.log(`\nPatching ${periods.length} periods × ${CATEGORIES.length} categories...\n`);

  let updated = 0, skipped = 0;
  const prevClients = {};

  for (const period of periods) {
    let periodUpdated = 0;

    for (const cat of CATEGORIES) {
      const { clients } = allData[cat.key];
      if (clients.length === 0) { skipped++; continue; }

      // Clients active this period
      const periodClients = [];
      for (const client of clients) {
        const dp = (client.data || []).find(d => d.period === period);
        if (dp && dp.value > 0) periodClients.push({ name: client.label, value: dp.value });
      }

      const clientCount = periodClients.length;
      const totalRevenue = periodClients.reduce((s, c) => s + c.value, 0);
      const avgTicket = clientCount > 0 ? totalRevenue / clientCount : 0;

      // Churn
      const currentNames = new Set(periodClients.map(c => c.name));
      const prevNames = prevClients[cat.key] || new Set();
      let churned = 0;
      for (const name of prevNames) { if (!currentNames.has(name)) churned++; }
      const churnRate = prevNames.size > 0 ? (churned / prevNames.size) * 100 : 0;
      prevClients[cat.key] = currentNames;

      const ok = await patchRow(period, cat.key, {
        client_count: clientCount,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        avg_ticket: Math.round(avgTicket * 100) / 100,
        churned_clients: churned,
        churn_rate: Math.round(churnRate * 100) / 100,
        client_names: periodClients,
      });

      if (ok) { updated++; periodUpdated++; }
    }

    console.log(`  ${period}: ${periodUpdated} updated`);
  }

  console.log(`\nDone! ${updated} rows updated, ${skipped} skipped (API timeout).`);

  const missing = CATEGORIES.filter(c => allData[c.key].clients.length === 0);
  if (missing.length > 0) {
    console.log(`\n⚠ Categories with 0 data (API timeout — run again later):`);
    for (const c of missing) console.log(`  - ${c.api} (${c.key})`);
  }
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
