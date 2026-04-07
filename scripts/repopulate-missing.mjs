/**
 * Re-fetch missing data (where client_count=0 but should have data)
 * Only for Enterprise which had timeouts
 */
const OXY_API_KEY = '65ef8d4f-4e78-4e94-8ce1-5eb7e0028ad8';
const CNPJ = '23.813.779/0001-60';
const SUPABASE_URL = 'https://nqpmyugsscvqsvjxdshd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xcG15dWdzc2N2cXN2anhkc2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDA4MjIsImV4cCI6MjA4ODkxNjgyMn0.e7RfALb11WA__w0hF5fq0NI3oMxcwQQ4Y4kfC4HcawI';

// All categories that may have had timeouts
const CATEGORIES = [
  { api: 'Enterprise', key: 'caasEnterprise', mrr: true },
  { api: 'Corporate', key: 'caasCorporate', mrr: true },
  { api: 'Serviços Especializados', key: 'caasAssessoria', mrr: false },
  { api: 'BPO Financeiro', key: 'caasSetup', mrr: false },
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

async function run() {
  // 1. Fetch all existing rows with 0 clients
  const res = await fetch(`${SUPABASE_URL}/rest/v1/historical_clients?client_count=eq.0&select=period,assumption_key,id`, {
    headers: { 'apikey': SUPABASE_KEY },
  });
  const missing = await res.json();
  console.log(`Found ${missing.length} rows with 0 clients to retry\n`);

  let fixed = 0;
  for (const row of missing) {
    const cat = CATEGORIES.find(c => c.key === row.assumption_key);
    if (!cat) continue;

    const [y, m] = row.period.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

    try {
      const apiRes = await fetch(
        `https://api.oxy.finance/v2/dre/dre-drill-down?category=${encodeURIComponent(cat.api)}&startDate=${start}&endDate=${end}&cnpjs[]=${encodeURIComponent(CNPJ)}`,
        { headers: { 'x-api-key': OXY_API_KEY }, signal: AbortSignal.timeout(30000) }
      );
      if (!apiRes.ok) continue;
      const data = await apiRes.json();
      const clients = data.data || [];

      if (clients.length === 0) continue; // genuinely 0 clients

      const totalRevenue = clients.reduce((sum, c) => {
        const pd = c.data?.find(d => d.period === row.period);
        return sum + (pd?.value || 0);
      }, 0);
      const avgTicket = clients.length > 0 ? totalRevenue / clients.length : 0;
      const clientDetails = clients.map(c => ({
        name: c.label,
        value: c.data?.find(d => d.period === row.period)?.value || 0,
      }));

      // Update in Supabase
      const upRes = await fetch(`${SUPABASE_URL}/rest/v1/historical_clients?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_count: clients.length,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          avg_ticket: Math.round(avgTicket * 100) / 100,
          client_names: clientDetails,
        }),
      });

      if (upRes.ok) {
        fixed++;
        console.log(`✅ ${row.period} ${cat.key}: ${clients.length} clients, R$ ${Math.round(totalRevenue).toLocaleString()}`);
      }
    } catch (e) {
      console.log(`⚠️ ${row.period} ${cat.key}: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 500)); // rate limit
  }

  console.log(`\nFixed ${fixed} rows`);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
