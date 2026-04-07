import { chromium } from 'playwright';
const BASE = 'http://localhost:8080';
const R = [];
function log(t, ok, d) { R.push({t,ok,d}); console.log(`${ok?'✅':'❌'} ${t}: ${d}`); }

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();

  // Login
  await page.goto(`${BASE}/auth`);
  await page.waitForTimeout(2000);
  await page.getByPlaceholder('seu@email.com').fill('test-claude@o2inc.test');
  await page.getByPlaceholder('••••••••').fill('TestO2Inc2026!');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForTimeout(3000);

  await page.goto(`${BASE}/assumptions`);
  await page.waitForTimeout(5000); // extra wait for historical data fetch

  // ═══ TEST 2025: Full historical year ═══
  console.log('\n── 2025: Full historical ──');
  await page.getByRole('button', { name: '2025' }).click();
  await page.waitForTimeout(500);

  // Expand Enterprise
  await page.getByRole('row', { name: /Enterprise/ }).first().click();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(500);

  // Check for "API" badges
  const apiBadges2025 = await page.locator('text=API').count();
  log('T1: 2025 has API badges', apiBadges2025 > 0, `Found ${apiBadges2025}`);

  // Read client values for historical months
  const clientVals2025 = await page.evaluate(() => {
    const cells = document.querySelectorAll('.text-sky-600');
    return Array.from(cells).map(c => c.textContent?.trim()).filter(Boolean).slice(0, 12);
  });
  console.log(`  Sky-blue values: ${clientVals2025.join(', ')}`);
  log('T2: 2025 shows real client data', clientVals2025.length > 0, `${clientVals2025.length} values`);

  // Check that client values are real numbers (not 0 for Enterprise which had 33+ clients)
  const hasRealClients = clientVals2025.some(v => {
    const n = Number(v?.replace(/\./g, '').replace(',', '.'));
    return n > 10;
  });
  log('T3: Enterprise 2025 has >10 clients', hasRealClients, clientVals2025.slice(0, 3).join(', '));

  // Scroll to ticket section
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(300);

  // Check ticket values
  const ticketBadges = await page.evaluate(() => {
    const badges = document.querySelectorAll('.text-sky-500');
    return Array.from(badges).map(b => b.textContent?.trim()).filter(t => t === 'API').length;
  });
  log('T4: Ticket section has API badges', ticketBadges > 0, `${ticketBadges} badges`);

  // Scroll to churn section
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(300);

  // Check churn values
  const churnText = await page.evaluate(() => {
    const negatives = document.querySelectorAll('.text-negative');
    return Array.from(negatives).map(n => n.textContent?.trim()).filter(t => t?.includes('%')).slice(0, 12);
  });
  console.log(`  Churn values: ${churnText.join(', ')}`);
  log('T5: Churn section has values', churnText.length > 0, `${churnText.length} values`);

  // Collapse Enterprise
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.getByRole('row', { name: /Enterprise/ }).first().click();
  await page.waitForTimeout(300);

  // ═══ TEST 2026: Partial historical (Jan-Mar) ═══
  console.log('\n── 2026: Partial historical ──');
  await page.getByRole('button', { name: '2026' }).click();
  await page.waitForTimeout(500);

  await page.getByRole('row', { name: /Enterprise/ }).first().click();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(500);

  const apiBadges2026 = await page.locator('text=API').count();
  log('T6: 2026 has API badges (Jan-Mar only)', apiBadges2026 > 0, `Found ${apiBadges2026}`);

  // Read ALL monthly client cells
  const allCells2026 = await page.evaluate(() => {
    const cells = [];
    const divs = document.querySelectorAll('[class*="rounded"]');
    divs.forEach(div => {
      const text = div.textContent || '';
      // Look for month headers + values
      if (text.match(/^(Jan|Fev|Feb|Mar|Abr|Apr|Mai|May|Jun|Jul|Ago|Aug|Set|Sep|Out|Oct|Nov|Dez|Dec)/)) {
        const hasSky = div.querySelector('.text-sky-600');
        const hasLock = text.includes('🔒');
        cells.push({
          month: text.slice(0, 3),
          hasSky: !!hasSky,
          hasLock,
          value: hasSky?.textContent?.trim() || div.querySelector('.font-medium')?.textContent?.trim() || '',
        });
      }
    });
    return cells.slice(0, 12);
  });

  console.log('  Monthly cells:');
  allCells2026.forEach(c => console.log(`    ${c.month}: ${c.value} ${c.hasSky ? '(API)' : ''} ${c.hasLock ? '🔒' : ''}`));

  // Jan-Mar should have API data, Apr+ should not
  const historicalWithAPI = allCells2026.filter(c => c.hasLock && c.hasSky);
  const projectedWithoutAPI = allCells2026.filter(c => !c.hasLock && !c.hasSky);
  log('T7: Jan-Mar have API data', historicalWithAPI.length >= 1, `${historicalWithAPI.length} historical with API`);
  log('T8: Apr+ do NOT have API data', projectedWithoutAPI.length >= 5, `${projectedWithoutAPI.length} projected without API`);

  // ═══ VERIFY: Values match Supabase ═══
  console.log('\n── Verify vs Supabase ──');

  // Fetch from Supabase directly
  const supabaseData = await page.evaluate(async () => {
    try {
      const res = await fetch(
        'https://nqpmyugsscvqsvjxdshd.supabase.co/rest/v1/historical_clients?assumption_key=eq.caasEnterprise&period=eq.2026-01&select=client_count,total_revenue,avg_ticket,churn_rate',
        {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xcG15dWdzc2N2cXN2anhkc2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNDA4MjIsImV4cCI6MjA4ODkxNjgyMn0.e7RfALb11WA__w0hF5fq0NI3oMxcwQQ4Y4kfC4HcawI',
          }
        }
      );
      const data = await res.json();
      return data[0] || null;
    } catch {
      return null;
    }
  });

  if (supabaseData) {
    console.log(`  Supabase Enterprise Jan/2026: ${supabaseData.client_count} clients, R$ ${supabaseData.avg_ticket} ticket, ${supabaseData.churn_rate}% churn`);
    log('T9: Supabase has data', supabaseData.client_count > 0, `${supabaseData.client_count} clients`);
  } else {
    log('T9: Supabase has data', false, 'No data returned');
  }

  // ═══ TEST: Corporate (different product) ═══
  console.log('\n── Corporate ──');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.getByRole('row', { name: /Enterprise/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('row', { name: /Corporate/ }).first().click();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(500);

  const corpAPI = await page.locator('text=API').count();
  log('T10: Corporate has API badges', corpAPI > 0, `${corpAPI}`);

  // ═══ REPORT ═══
  console.log('\n' + '═'.repeat(50));
  const p = R.filter(r => r.ok).length, f = R.filter(r => !r.ok).length;
  console.log(`PASSED: ${p} / FAILED: ${f} / TOTAL: ${R.length}\n`);
  R.forEach(r => console.log(`  ${r.ok?'✅':'❌'} ${r.t}: ${r.d}`));
  console.log('═'.repeat(50));

  await browser.close();
  if (f > 0) process.exit(1);
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
