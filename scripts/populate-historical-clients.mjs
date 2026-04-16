/**
 * One-time script: Fetch historical client data from Oxy API
 * and insert into Supabase historical_clients table.
 *
 * Usage: node scripts/populate-historical-clients.mjs
 */

const OXY_API_KEY = '65ef8d4f-4e78-4e94-8ce1-5eb7e0028ad8';
const OXY_BASE = 'https://api.oxy.finance/v2/dre/dre-drill-down';
const CNPJ = '23.813.779/0001-60';

const SUPABASE_URL = 'https://nqpmyugsscvqsvjxdshd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xcG15dWdzc2N2cXN2anhkc2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDA4MjIsImV4cCI6MjA4ODkxNjgyMn0.e7RfALb11WA__w0hF5fq0NI3oMxcwQQ4Y4kfC4HcawI';

// Category mapping: API name → assumption_key → is_mrr
const CATEGORIES = [
  { api: 'Enterprise', key: 'caasEnterprise', mrr: true },
  { api: 'Corporate', key: 'caasCorporate', mrr: true },
  { api: 'Serviços Especializados', key: 'caasAssessoria', mrr: false },
  { api: 'BPO Financeiro', key: 'caasSetup', mrr: true },
  { api: 'Parceiros', key: 'caasParceiros', mrr: false },  // CaaS Parceiros
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

// Periods: Jan/2025 to Mar/2026
const PERIODS = [];
for (let y = 2025; y <= 2026; y++) {
  const maxMonth = y === 2026 ? 3 : 12;
  for (let m = 1; m <= maxMonth; m++) {
    PERIODS.push(`${y}-${String(m).padStart(2, '0')}`);
  }
}

function getMonthRange(period) {
  const [y, m] = period.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
  return { start, end };
}

async function fetchCategory(category, startDate, endDate) {
  const url = `${OXY_BASE}?category=${encodeURIComponent(category)}&startDate=${startDate}&endDate=${endDate}&cnpjs[]=${encodeURIComponent(CNPJ)}`;
  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': OXY_API_KEY },
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return { data: [] };
    const json = await res.json();
    return json;
  } catch (e) {
    console.error(`  ⚠️ Timeout/error for ${category}: ${e.message}`);
    return { data: [] };
  }
}

async function insertToSupabase(rows) {
  // Delete existing rows for this period first, then insert fresh
  const period = rows[0]?.period;
  if (period) {
    await fetch(`${SUPABASE_URL}/rest/v1/historical_clients?period=eq.${period}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
    });
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/historical_clients`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`  ❌ Supabase insert error: ${err}`);
    return false;
  }
  return true;
}

async function run() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('POPULATING HISTORICAL CLIENTS');
  console.log(`Periods: ${PERIODS[0]} to ${PERIODS[PERIODS.length - 1]} (${PERIODS.length} months)`);
  console.log(`Categories: ${CATEGORIES.length}`);
  console.log(`${'═'.repeat(60)}\n`);

  // Store prev month data for churn calculation
  const prevMonthClients = {}; // key → Set of client names

  let totalInserted = 0;

  for (const period of PERIODS) {
    const { start, end } = getMonthRange(period);
    console.log(`\n── ${period} ──`);

    const rows = [];

    for (const cat of CATEGORIES) {
      const result = await fetchCategory(cat.api, start, end);
      const clients = result.data || [];

      const clientCount = clients.length;
      const totalRevenue = clients.reduce((sum, c) => {
        const periodData = c.data?.find(d => d.period === period);
        return sum + (periodData?.value || 0);
      }, 0);
      const avgTicket = clientCount > 0 ? totalRevenue / clientCount : 0;

      // Client names for this month
      const currentNames = new Set(clients.map(c => c.label));
      const clientDetails = clients.map(c => ({
        name: c.label,
        value: c.data?.find(d => d.period === period)?.value || 0,
      }));

      // Churn: clients from prev month not in this month
      const prevNames = prevMonthClients[cat.key] || new Set();
      let churned = 0;
      if (prevNames.size > 0) {
        for (const name of prevNames) {
          if (!currentNames.has(name)) churned++;
        }
      }
      const churnRate = prevNames.size > 0 ? (churned / prevNames.size) * 100 : 0;

      // Update prev month
      prevMonthClients[cat.key] = currentNames;

      rows.push({
        period,
        category: cat.api,
        assumption_key: cat.key,
        is_mrr: cat.mrr,
        client_count: clientCount,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        avg_ticket: Math.round(avgTicket * 100) / 100,
        churned_clients: churned,
        churn_rate: Math.round(churnRate * 100) / 100,
        client_names: clientDetails,
      });

      if (clientCount > 0) {
        console.log(`  ${cat.key}: ${clientCount} clients, R$ ${Math.round(totalRevenue).toLocaleString()}, ticket: R$ ${Math.round(avgTicket).toLocaleString()}, churn: ${churned} (${churnRate.toFixed(1)}%)`);
      }

      // Rate limit: 200ms between API calls
      await new Promise(r => setTimeout(r, 200));
    }

    // Insert batch for this period
    const ok = await insertToSupabase(rows);
    if (ok) {
      totalInserted += rows.length;
      console.log(`  ✅ Inserted ${rows.length} rows`);
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`DONE: ${totalInserted} total rows inserted`);
  console.log(`${'═'.repeat(60)}`);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
