const OXY_API_KEY = '65ef8d4f-4e78-4e94-8ce1-5eb7e0028ad8';
const CNPJ = '23.813.779/0001-60';
const SUPABASE_URL = 'https://nqpmyugsscvqsvjxdshd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xcG15dWdzc2N2cXN2anhkc2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDA4MjIsImV4cCI6MjA4ODkxNjgyMn0.e7RfALb11WA__w0hF5fq0NI3oMxcwQQ4Y4kfC4HcawI';

const CATEGORIES = [
  { api: 'Enterprise', key: 'caasEnterprise' },
  { api: 'Corporate', key: 'caasCorporate' },
  { api: 'Serviços Especializados', key: 'caasAssessoria' },
  { api: 'BPO Financeiro', key: 'caasSetup' },
  { api: 'Parceiros', key: 'caasParceiros' },
  { api: 'Oxy', key: 'saasOxy' },
  { api: 'Oxy + Gênio', key: 'saasOxyGenio' },
  { api: 'Oxy + Gênio + Especialista', key: 'saasOxyGenioEsp' },
  { api: 'Setup', key: 'saasSetup' },
  { api: 'Dono CFO', key: 'educationDonoCFO' },
  { api: 'Engenheiro de Negócios', key: 'educationEN' },
  { api: 'Financeiro Raiz', key: 'educationFR' },
  { api: 'Finance Sales Program', key: 'educationFSP' },
  { api: 'Oxy Hacker - Micro Franqueado', key: 'baas' },
  { api: 'Franquia', key: 'baasFranquia' },
  { api: 'Master Franquia', key: 'baasMasterFranquia' },
  { api: 'AT - Assessoria Tributária', key: 'taxAT' },
  { api: 'GPT - Gestão passivo tributário', key: 'taxGPT' },
  { api: 'RCT - Recuperação Crédito tributário', key: 'taxRCT' },
  { api: 'RT - Reforma tributária', key: 'taxRT' },
  { api: 'Diagnóstico Tributário & Compliance Tributário', key: 'taxDTC' },
];

async function run() {
  // Get all rows with 0 clients
  const res = await fetch(`${SUPABASE_URL}/rest/v1/historical_clients?client_count=eq.0&select=id,period,assumption_key`, {
    headers: { 'apikey': SUPABASE_KEY },
  });
  const missing = await res.json();
  console.log(`${missing.length} rows to retry (60s timeout each)\n`);

  let fixed = 0, genuine0 = 0, failed = 0;

  for (let i = 0; i < missing.length; i++) {
    const row = missing[i];
    const cat = CATEGORIES.find(c => c.key === row.assumption_key);
    if (!cat) continue;

    const [y, m] = row.period.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const end = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

    try {
      const apiRes = await fetch(
        `https://api.oxy.finance/v2/dre/dre-drill-down?category=${encodeURIComponent(cat.api)}&startDate=${start}&endDate=${end}&cnpjs[]=${encodeURIComponent(CNPJ)}`,
        { headers: { 'x-api-key': OXY_API_KEY }, signal: AbortSignal.timeout(60000) }
      );
      if (!apiRes.ok) { failed++; continue; }
      const data = await apiRes.json();
      const clients = data.data || [];

      if (clients.length === 0) {
        genuine0++;
        process.stdout.write('.');
        await new Promise(r => setTimeout(r, 300));
        continue;
      }

      const totalRevenue = clients.reduce((sum, c) => {
        const pd = c.data?.find(d => d.period === row.period);
        return sum + (pd?.value || 0);
      }, 0);
      const avgTicket = totalRevenue / clients.length;
      const clientDetails = clients.map(c => ({
        name: c.label,
        value: c.data?.find(d => d.period === row.period)?.value || 0,
      }));

      await fetch(`${SUPABASE_URL}/rest/v1/historical_clients?id=eq.${row.id}`, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_count: clients.length,
          total_revenue: Math.round(totalRevenue * 100) / 100,
          avg_ticket: Math.round(avgTicket * 100) / 100,
          client_names: clientDetails,
        }),
      });
      fixed++;
      console.log(`\n✅ ${row.period} ${cat.key}: ${clients.length} clients, R$ ${Math.round(totalRevenue).toLocaleString()}`);
    } catch (e) {
      failed++;
      console.log(`\n⚠️ ${row.period} ${cat.key}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n\nDone: ${fixed} fixed, ${genuine0} genuinely 0, ${failed} failed`);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
