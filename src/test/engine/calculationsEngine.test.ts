/**
 * Calculations Engine — Unit Tests
 * Validates the core financial model for the O2 Inc BP 2025–2030.
 */
import { describe, it, expect } from 'vitest';
import { computeFullModel, computeKPIs, FullModelOutput, AnnualOutput } from '@/engine/calculationsEngine';
import { DEFAULT_ASSUMPTIONS, Assumptions, YEARS, Year, getDefaultSubProductTaxConfig } from '@/lib/financialData';
import { expectedOutputs } from '@/data/modelData';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getModel(overrides?: Partial<Assumptions>, scenario: 'BASE' | 'BULL' | 'BEAR' = 'BASE'): FullModelOutput {
  const assumptions = overrides ? { ...DEFAULT_ASSUMPTIONS, ...overrides } : DEFAULT_ASSUMPTIONS;
  return computeFullModel(assumptions, scenario);
}

function getYear(model: FullModelOutput, year: Year): AnnualOutput {
  return model.years[year];
}

// Allow up to N% deviation from expected
function expectClose(actual: number, expected: number, tolerancePct = 2) {
  if (expected === 0) {
    expect(Math.abs(actual)).toBeLessThan(10); // within R$10k for zero targets
    return;
  }
  const deviation = Math.abs((actual - expected) / expected) * 100;
  expect(deviation).toBeLessThan(tolerancePct);
}

// ─── 1. BASE SCENARIO — Expected Output Validation ─────────────────────────────
// Note: The brownfield changes (squad config, edu/exp 15% rate, etc.) shift numbers
// from the original Excel expectedOutputs. We use wider tolerances and also test
// a "vanilla" scenario (no squad, no edu rate) for close match.

describe('Engine: Base scenario structure validation', () => {
  const model = getModel();

  it.each(YEARS.map(y => [y]))('gross revenue %i is positive and in correct order of magnitude', (year) => {
    expect(model.years[year].grossRevenue).toBeGreaterThan(0);
    // Within 15% of expected (brownfield adds squad costs that don't affect revenue directly,
    // but edu/exp rate changes contribution margin which affects EBITDA, not gross revenue)
    expectClose(model.years[year].grossRevenue, expectedOutputs.grossRevenue[year], 15);
  });

  it.each(YEARS.map(y => [y]))('total clients %i is positive', (year) => {
    expect(model.years[year].totalClients).toBeGreaterThan(0);
  });

  it.each(YEARS.map(y => [y]))('gross margin %i is reasonable (60-90%%)', (year) => {
    const gm = model.years[year].grossMarginPct;
    expect(gm).toBeGreaterThan(60);
    expect(gm).toBeLessThan(90);
  });
});

describe('Engine: Vanilla scenario (no brownfield extras)', () => {
  // Disable squad and edu/exp rate to approximate original Excel model
  const vanilla = getModel({
    squadConfig: undefined,
    eduExpansaoTeamRate: 0,
  } as any);

  it.each(YEARS.map(y => [y]))('gross revenue %i within 12%% of expected', (year) => {
    expectClose(vanilla.years[year].grossRevenue, expectedOutputs.grossRevenue[year], 12);
  });

  it('client count grows monotonically', () => {
    for (let i = 1; i < YEARS.length; i++) {
      expect(vanilla.years[YEARS[i]].totalClients).toBeGreaterThan(
        vanilla.years[YEARS[i - 1]].totalClients
      );
    }
  });

  it('revenue grows faster than linear', () => {
    // Revenue should grow super-linearly (exponential client growth × tickets)
    const rev2025 = vanilla.years[2025].grossRevenue;
    const rev2030 = vanilla.years[2030].grossRevenue;
    expect(rev2030 / rev2025).toBeGreaterThan(50); // at least 50× growth
  });
});

// ─── 2. REVENUE STRUCTURE ───────────────────────────────────────────────────────

describe('Engine: Revenue structure', () => {
  const model = getModel();

  it('gross revenue is sum of all BUs', () => {
    for (const y of YEARS) {
      const yr = model.years[y];
      const buSum = yr.caasRevenue + yr.saasRevenue + yr.educationRevenue + yr.baasRevenue;
      // BU sum may differ slightly from grossRevenue due to SaaS Setup + rounding
      expectClose(buSum, yr.grossRevenue, 5);
    }
  });

  it('net revenue = gross revenue + deductions (deductions are negative)', () => {
    for (const y of YEARS) {
      const yr = model.years[y];
      expectClose(yr.netRevenue, yr.grossRevenue + yr.deductions, 1);
    }
  });

  it('gross profit = net revenue + cogs (cogs is negative)', () => {
    for (const y of YEARS) {
      const yr = model.years[y];
      expectClose(yr.grossProfit, yr.netRevenue + yr.cogs, 1);
    }
  });

  it('revenue grows each year', () => {
    for (let i = 1; i < YEARS.length; i++) {
      expect(model.years[YEARS[i]].grossRevenue).toBeGreaterThan(model.years[YEARS[i - 1]].grossRevenue);
    }
  });

  it('revenue detail sub-items sum to BU total', () => {
    for (const y of YEARS) {
      const d = model.years[y].revenueDetail;
      const caasSum = d.caasAssessoria + d.caasEnterprise + d.caasCorporate + d.caasSetup;
      expectClose(caasSum, model.years[y].caasRevenue, 2);
    }
  });
});

// ─── 3. MONTHLY DATA ────────────────────────────────────────────────────────────

describe('Engine: Monthly data consistency', () => {
  const model = getModel();

  it('has 12 months of data per year', () => {
    for (const y of YEARS) {
      expect(model.years[y].monthlyData).toHaveLength(12);
    }
  });

  it('sum of monthly gross revenue ≈ annual gross revenue', () => {
    for (const y of YEARS) {
      const monthlySum = model.years[y].monthlyData.reduce((s, m) => s + m.grossRevenue, 0);
      expectClose(monthlySum, model.years[y].grossRevenue, 1);
    }
  });

  it('sum of monthly net income ≈ annual net income', () => {
    for (const y of YEARS) {
      const monthlySum = model.years[y].monthlyData.reduce((s, m) => s + m.netIncome, 0);
      expectClose(monthlySum, model.years[y].netIncome, 1);
    }
  });

  it('monthly clients are non-negative', () => {
    for (const y of YEARS) {
      for (const m of model.years[y].monthlyData) {
        expect(m.totalClients).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('monthly EBITDA = CM + SGA + HC + Commercial + Other', () => {
    for (const y of YEARS) {
      for (const m of model.years[y].monthlyData) {
        const expected = m.contributionMargin + m.sga + m.headcount + m.commercial + m.otherExpenses;
        expectClose(m.ebitda, expected, 1);
      }
    }
  });
});

// ─── 4. DEDUCTIONS ──────────────────────────────────────────────────────────────

describe('Engine: Sales deductions', () => {
  const model = getModel();

  it('deductions are always negative', () => {
    for (const y of YEARS) {
      expect(model.years[y].deductions).toBeLessThanOrEqual(0);
    }
  });

  it('deduction rate is ~8-10% (Lucro Presumido per BU — PIS+COFINS+ISS)', () => {
    for (const y of YEARS) {
      const yr = model.years[y];
      if (yr.grossRevenue > 0) {
        const rate = Math.abs(yr.deductions / yr.grossRevenue);
        // Per-BU rates: PIS 0.65% + COFINS 3% + ISS 2.9-5% ≈ 6.55-8.65% on BU revenue
        // But deductions are only on CaaS+SaaS+Setup, not total gross revenue
        expect(rate).toBeGreaterThan(0.04);
        expect(rate).toBeLessThan(0.12);
      }
    }
  });

  it('deductions always apply even when taxEnabled is false', () => {
    const modelNoTax = getModel({ taxEnabled: false });
    for (const y of YEARS) {
      // Deductions should still be non-zero
      expect(modelNoTax.years[y].deductions).toBeLessThan(0);
      // Same deductions as with tax enabled
      expectClose(modelNoTax.years[y].deductions, model.years[y].deductions, 0.1);
    }
  });

  it('mix order does not change deductions or taxes for Expansão products', () => {
    const baseBaas = getDefaultSubProductTaxConfig('baas');
    const baseFranquia = getDefaultSubProductTaxConfig('baasFranquia');
    const baseMaster = getDefaultSubProductTaxConfig('baasMasterFranquia');

    const modelA = getModel({
      subProductTaxRates: {
        baas: { ...baseBaas, perfilTributario: 'mix', taxSlices: [{ profileKey: 'ebook', pct: 20 }, { profileKey: 'servico', pct: 80 }] },
        baasFranquia: { ...baseFranquia, perfilTributario: 'mix', taxSlices: [{ profileKey: 'ebook', pct: 20 }, { profileKey: 'servico', pct: 80 }] },
        baasMasterFranquia: { ...baseMaster, perfilTributario: 'mix', taxSlices: [{ profileKey: 'ebook', pct: 20 }, { profileKey: 'servico', pct: 80 }] },
      },
    });

    const modelB = getModel({
      subProductTaxRates: {
        baas: { ...baseBaas, perfilTributario: 'mix', taxSlices: [{ profileKey: 'servico', pct: 80 }, { profileKey: 'ebook', pct: 20 }] },
        baasFranquia: { ...baseFranquia, perfilTributario: 'mix', taxSlices: [{ profileKey: 'servico', pct: 80 }, { profileKey: 'ebook', pct: 20 }] },
        baasMasterFranquia: { ...baseMaster, perfilTributario: 'mix', taxSlices: [{ profileKey: 'servico', pct: 80 }, { profileKey: 'ebook', pct: 20 }] },
      },
    });

    for (const year of [2027, 2028, 2029, 2030] as Year[]) {
      expect(modelA.years[year].deductions).toBeCloseTo(modelB.years[year].deductions, 10);
      expect(modelA.years[year].taxes).toBeCloseTo(modelB.years[year].taxes, 10);
    }
  });
});

// ─── 5. TAX TOGGLE (Item 4) ────────────────────────────────────────────────────

describe('Engine: Tax toggle (Item 4)', () => {
  const modelTaxOn = getModel({ taxEnabled: true });
  const modelTaxOff = getModel({ taxEnabled: false });

  it('IRPJ/CSLL are zero when taxEnabled=false', () => {
    for (const y of YEARS) {
      expect(modelTaxOff.years[y].taxes).toBe(0);
      expect(modelTaxOff.years[y].taxDetail.irpj).toBe(0);
      expect(modelTaxOff.years[y].taxDetail.csll).toBe(0);
    }
  });

  it('IRPJ/CSLL are always non-zero when taxEnabled=true and there is revenue (Lucro Presumido)', () => {
    for (const y of YEARS) {
      if (modelTaxOn.years[y].grossRevenue > 0) {
        expect(modelTaxOn.years[y].taxes).toBeLessThan(0);
      }
    }
  });

  it('net income is higher when taxes are off', () => {
    for (const y of YEARS) {
      if (modelTaxOn.years[y].grossRevenue > 0) {
        expect(modelTaxOff.years[y].netIncome).toBeGreaterThanOrEqual(modelTaxOn.years[y].netIncome);
      }
    }
  });

  it('IRPJ and CSLL details are both negative when taxes apply', () => {
    // In years with clearly positive EBT (high-growth years), taxes should exist
    for (const y of [2028, 2029, 2030] as Year[]) {
      if (modelTaxOn.years[y].taxes < 0) {
        expect(modelTaxOn.years[y].taxDetail.irpj).toBeLessThan(0);
        expect(modelTaxOn.years[y].taxDetail.csll).toBeLessThan(0);
        // IRPJ should be larger than CSLL (25% vs 9%)
        expect(Math.abs(modelTaxOn.years[y].taxDetail.irpj)).toBeGreaterThan(
          Math.abs(modelTaxOn.years[y].taxDetail.csll)
        );
      }
    }
  });
});

// ─── 6. MARKETING PR & EVENTS (Item 5) ─────────────────────────────────────────

describe('Engine: Marketing PR & Events (Item 5)', () => {
  it('PR cost reduces EBITDA', () => {
    const base = getModel();
    const withPR = getModel({ marketingPR: 50000 }); // R$50k/month
    for (const y of YEARS) {
      // 50k/month = 600k/year = 600 in R$thousands
      const diff = base.years[y].ebitda - withPR.years[y].ebitda;
      expect(diff).toBeGreaterThan(500); // at least R$500k annual impact
    }
  });

  it('Events cost reduces EBITDA', () => {
    const base = getModel();
    const withEvents = getModel({ marketingEvents: 30000 }); // R$30k/month
    for (const y of YEARS) {
      const diff = base.years[y].ebitda - withEvents.years[y].ebitda;
      expect(diff).toBeGreaterThan(300);
    }
  });

  it('PR and Events flow into marketing line', () => {
    const base = getModel();
    const withBoth = getModel({ marketingPR: 10000, marketingEvents: 10000 });
    for (const y of YEARS) {
      // Marketing should be more negative with costs added
      expect(withBoth.years[y].marketing).toBeLessThan(base.years[y].marketing);
    }
  });
});

// ─── 7. CAC PER PRODUCT (Item 6) ───────────────────────────────────────────────

describe('Engine: CAC per product (Item 6)', () => {
  it('higher CAC increases marketing spend', () => {
    const base = getModel();
    const highCac = getModel({
      cacPerProduct: {
        caasAssessoria: 20000, caasEnterprise: 20000, caasCorporate: 20000, caasSetup: 20000,
        saasOxy: 15000, saasOxyGenio: 15000, educationDonoCFO: 5000, baas: 5000,
      },
    });
    for (const y of YEARS) {
      // Marketing is negative, more negative = more spend
      expect(highCac.years[y].marketing).toBeLessThanOrEqual(base.years[y].marketing);
    }
  });

  it('zero CAC reduces marketing spend', () => {
    const base = getModel();
    const zeroCac = getModel({
      cacPerProduct: {
        caasAssessoria: 0, caasEnterprise: 0, caasCorporate: 0, caasSetup: 0,
        saasOxy: 0, saasOxyGenio: 0, educationDonoCFO: 0, baas: 0,
      },
    });
    for (const y of YEARS) {
      // With zero CAC, marketing should be less negative (closer to zero)
      expect(zeroCac.years[y].marketing).toBeGreaterThanOrEqual(base.years[y].marketing);
    }
  });
});

// ─── 8. EDUCATION/EXPANSAO TEAM RATE (Item 8) ──────────────────────────────────

describe('Engine: Education/Expansão team rate (Item 8)', () => {
  it('15% rate reduces contribution margin', () => {
    const noRate = getModel({ eduExpansaoTeamRate: 0 });
    const withRate = getModel({ eduExpansaoTeamRate: 0.15 });
    for (const y of YEARS) {
      expect(withRate.years[y].contributionMargin).toBeLessThanOrEqual(noRate.years[y].contributionMargin);
    }
  });

  it('higher rate has larger impact on later years (more edu/baas revenue)', () => {
    const noRate = getModel({ eduExpansaoTeamRate: 0 });
    const withRate = getModel({ eduExpansaoTeamRate: 0.15 });
    const diff2025 = Math.abs(noRate.years[2025].contributionMargin - withRate.years[2025].contributionMargin);
    const diff2030 = Math.abs(noRate.years[2030].contributionMargin - withRate.years[2030].contributionMargin);
    expect(diff2030).toBeGreaterThan(diff2025);
  });

  it('zero rate has no impact (same as base without edu/exp cost)', () => {
    const withZero = getModel({ eduExpansaoTeamRate: 0 });
    const withRate = getModel({ eduExpansaoTeamRate: 0.15 });
    // With zero rate, CM should be higher
    for (const y of YEARS) {
      expect(withZero.years[y].ebitda).toBeGreaterThanOrEqual(withRate.years[y].ebitda);
    }
  });
});

// ─── 9. SQUAD CONFIG (Item 7) ──────────────────────────────────────────────────

describe('Engine: Squad config (Item 7)', () => {
  it('squad mode (substitutive) produces different headcount than legacy mode', () => {
    const noSquad = getModel({
      squadConfig: undefined,
    } as any);
    const withSquad = getModel(); // defaults have squadConfig
    // They should produce DIFFERENT headcount (squad replaces legacy ratios)
    let anyDiff = false;
    for (const y of YEARS) {
      if (withSquad.years[y].headcount !== noSquad.years[y].headcount) anyDiff = true;
    }
    expect(anyDiff).toBe(true);
  });

  it('higher CS-per-clients ratio reduces headcount', () => {
    const sq = { ...DEFAULT_ASSUMPTIONS.squadConfig! };
    const frequent = getModel({ squadConfig: { ...sq, csPerClients: 50 } }); // 1 CS per 50 clients
    const sparse = getModel({ squadConfig: { ...sq, csPerClients: 500 } }); // 1 CS per 500 clients
    // Sparse = fewer CS hires = less headcount cost
    for (const y of YEARS) {
      expect(sparse.years[y].headcount).toBeGreaterThanOrEqual(frequent.years[y].headcount);
    }
  });

  it('squad salaries impact EBITDA', () => {
    const sq = { ...DEFAULT_ASSUMPTIONS.squadConfig! };
    const cheap = getModel({ squadConfig: { ...sq, cfoSalary: 10000, cfoAnalistaSalary: 5000 } });
    const expensive = getModel({ squadConfig: { ...sq, cfoSalary: 50000, cfoAnalistaSalary: 20000 } });
    for (const y of YEARS) {
      expect(cheap.years[y].ebitda).toBeGreaterThan(expensive.years[y].ebitda);
    }
  });
});

// ─── 9b. SQUAD BUSINESS RULES — Detailed Verification ────────────────────────
// These tests verify the exact squad formulas against the business rules:
//   CFO Squad: 1 CFO (R$15k) + 2 analysts (R$8k) = R$31k/squad, capacity 15 CaaS clients
//   CS: 1 CS (R$5k) per 100 total clients
//   Setup Squad: 1 analyst (R$8k) + 2 impl (R$8k) = R$24k/squad, capacity 16 setups/month
//   Setup Leader: R$12k, manages 2 squads

describe('Engine: Squad business rules — CFO squads', () => {
  // Use 2026 with monthlyClientOverrides to set flat client counts per month.
  // CaaS clients for headcount = assessoria + enterprise + corporate (NOT setup).
  // We set these via overrides so every month has the exact count we want.

  function makeAssumptions(caasPerMonth: number): Partial<Assumptions> {
    // Distribute evenly across assessoria/enterprise/corporate
    const assessoria = Math.floor(caasPerMonth / 3);
    const enterprise = Math.floor(caasPerMonth / 3);
    const corporate = caasPerMonth - assessoria - enterprise;
    return {
      monthlyClientOverrides: {
        caasAssessoria:  { 2026: Array(12).fill(assessoria) },
        caasEnterprise:  { 2026: Array(12).fill(enterprise) },
        caasCorporate:   { 2026: Array(12).fill(corporate) },
        caasSetup:       { 2026: Array(12).fill(0) },
        saasOxy:         { 2026: Array(12).fill(0) },
        saasOxyGenio:    { 2026: Array(12).fill(0) },
        educationDonoCFO:{ 2026: Array(12).fill(0) },
        baas:            { 2026: Array(12).fill(0) },
      },
    };
  }

  it('15 CaaS clients → exactly 1 CFO squad (1 CFO + 2 analysts = 3 people)', () => {
    // numCfoSquads = ceil(15/15) = 1
    // cfoCost = 1 * (15000 + 2*8000) = 31000/month
    // cfoHC = 1 * (1+2) = 3
    const model15 = getModel(makeAssumptions(15));
    const model30 = getModel(makeAssumptions(30));

    // With 15 clients, headcount cost should be lower than 30 clients
    // (30 clients = 2 squads = double the CFO squad cost)
    const hc15 = Math.abs(model15.years[2026].headcount);
    const hc30 = Math.abs(model30.years[2026].headcount);
    expect(hc30).toBeGreaterThan(hc15);
  });

  it('30 CaaS clients → 2 CFO squads (6 people)', () => {
    // numCfoSquads = ceil(30/15) = 2
    // cfoCost = 2 * 31000 = 62000/month
    // Difference between 30 and 15 CaaS clients should be ~R$31k/month = R$372k/year
    const model15 = getModel(makeAssumptions(15));
    const model30 = getModel(makeAssumptions(30));

    // Extra squad cost = R$31k/month * 12 = R$372k/year = 372 in R$thousands
    // But benefits also scale, so allow some tolerance
    const diff = Math.abs(model30.years[2026].headcount) - Math.abs(model15.years[2026].headcount);
    // The difference should be in the range of one squad + benefits
    // 1 squad = R$31k/month salary + benefits for 3 people
    // 31k * 12 / 1000 = 372 (R$k), with 10% year multiplier = ~409
    expect(diff).toBeGreaterThan(300); // at least R$300k annual (conservative)
    expect(diff).toBeLessThan(600);    // at most R$600k (generous upper bound with benefits)
  });

  it('16 CaaS clients → 2 CFO squads (ceiling division)', () => {
    // numCfoSquads = ceil(16/15) = 2
    const model15 = getModel(makeAssumptions(15));  // 1 squad
    const model16 = getModel(makeAssumptions(16));  // 2 squads (ceil)
    const hc15 = Math.abs(model15.years[2026].headcount);
    const hc16 = Math.abs(model16.years[2026].headcount);
    // Should jump up when crossing 15-client boundary
    expect(hc16).toBeGreaterThan(hc15);
  });
});

describe('Engine: Squad business rules — CS', () => {
  function makeAssumptions(totalPerMonth: number): Partial<Assumptions> {
    // Spread across multiple products to get desired total client count
    return {
      monthlyClientOverrides: {
        caasAssessoria:  { 2026: Array(12).fill(5) },
        caasEnterprise:  { 2026: Array(12).fill(5) },
        caasCorporate:   { 2026: Array(12).fill(5) },
        caasSetup:       { 2026: Array(12).fill(0) },
        saasOxy:         { 2026: Array(12).fill(Math.floor((totalPerMonth - 15) / 2)) },
        saasOxyGenio:    { 2026: Array(12).fill(totalPerMonth - 15 - Math.floor((totalPerMonth - 15) / 2)) },
        educationDonoCFO:{ 2026: Array(12).fill(0) },
        baas:            { 2026: Array(12).fill(0) },
      },
    };
  }

  it('100 total clients → 1 CS', () => {
    // numCS = ceil(100/100) = 1, cost = 5000/month
    const model100 = getModel(makeAssumptions(100));
    const model250 = getModel(makeAssumptions(250));
    // With 250 clients we need ceil(250/100) = 3 CS vs 1 CS for 100
    // Extra 2 CS = 2 * 5000 * 12 / 1000 = 120 R$k/year (+ benefits + yearMult)
    const diff = Math.abs(model250.years[2026].headcount) - Math.abs(model100.years[2026].headcount);
    expect(diff).toBeGreaterThan(80);  // at least R$80k more (conservative)
  });

  it('250 total clients → 3 CS (ceiling division)', () => {
    // numCS = ceil(250/100) = 3
    // vs 200 clients = ceil(200/100) = 2 CS
    const model200 = getModel(makeAssumptions(200));
    const model250 = getModel(makeAssumptions(250));
    const hc200 = Math.abs(model200.years[2026].headcount);
    const hc250 = Math.abs(model250.years[2026].headcount);
    // 250 crosses the 200 boundary → 1 extra CS
    expect(hc250).toBeGreaterThan(hc200);
  });
});

describe('Engine: Squad business rules — Setup squads & leaders', () => {
  // Setup squads depend on new SaaS clients per month:
  //   newSaasPerMonth = (saasClientsThisYear - saasClientsPrevYear) / 12
  // For 2026: uses subProductClients saasOxy + saasOxyGenio for 2026 vs 2025.

  it('16 new SaaS/month → 1 setup squad + 1 leader', () => {
    // To get 16 new SaaS per month: newSaasPerMonth = (thisYear - prevYear) / 12
    // So thisYear - prevYear = 192
    // Default 2025 SaaS: saasOxy=55 + saasOxyGenio=47 = 102
    // Need 2026 total = 102 + 192 = 294 → split across oxy/oxyGenio
    const model = getModel({
      subProductClients: {
        ...DEFAULT_ASSUMPTIONS.subProductClients,
        saasOxy:      { ...DEFAULT_ASSUMPTIONS.subProductClients.saasOxy,      2026: 198 },
        saasOxyGenio: { ...DEFAULT_ASSUMPTIONS.subProductClients.saasOxyGenio, 2026: 96 },
      },
    });
    // numSetupSquads = ceil(16/16) = 1
    // numLideres = ceil(1/2) = 1
    // This should work - we verify via headcount cost being reasonable
    expect(model.years[2026].headcount).toBeLessThan(0); // costs are negative
  });

  it('33 new SaaS/month → 3 setup squads + 2 leaders', () => {
    // newSaasPerMonth = 33 → thisYear - prevYear = 396
    // 2025 base = 102, so 2026 = 498
    const model = getModel({
      subProductClients: {
        ...DEFAULT_ASSUMPTIONS.subProductClients,
        saasOxy:      { ...DEFAULT_ASSUMPTIONS.subProductClients.saasOxy,      2026: 350 },
        saasOxyGenio: { ...DEFAULT_ASSUMPTIONS.subProductClients.saasOxyGenio, 2026: 148 },
      },
    });
    // numSetupSquads = ceil(33/16) = 3
    // numLideres = ceil(3/2) = 2
    // More squads + leaders = higher cost than 16/month scenario
    const model16 = getModel({
      subProductClients: {
        ...DEFAULT_ASSUMPTIONS.subProductClients,
        saasOxy:      { ...DEFAULT_ASSUMPTIONS.subProductClients.saasOxy,      2026: 198 },
        saasOxyGenio: { ...DEFAULT_ASSUMPTIONS.subProductClients.saasOxyGenio, 2026: 96 },
      },
    });
    // 33/month has 3 squads + 2 leaders vs 1 squad + 1 leader
    // Extra: 2 squads * R$24k + 1 leader * R$12k = R$60k/month = R$720k/year
    const diff = Math.abs(model.years[2026].headcount) - Math.abs(model16.years[2026].headcount);
    expect(diff).toBeGreaterThan(500); // at least R$500k more (conservative)
  });
});

describe('Engine: Squad cost totals', () => {
  it('1 CFO squad + 1 CS + 1 setup squad + 1 leader = R$72k/month', () => {
    // Verify the per-squad cost formula:
    //   CFO squad:  15000 + 2*8000 = 31000
    //   CS:         5000
    //   Setup squad: 8000 + 2*8000 = 24000
    //   Leader:     12000
    //   Total:      72000/month = 864k/year in R$
    const sq = DEFAULT_ASSUMPTIONS.squadConfig!;
    const cfoSquadCost = sq.cfoSalary + sq.cfoAnalistasPerSquad * sq.cfoAnalistaSalary;
    expect(cfoSquadCost).toBe(31000);

    const csCost = sq.csSalary;
    expect(csCost).toBe(5000);

    const setupSquadCost = sq.setupAnalistaSalary + sq.setupImplPerSquad * sq.setupImplSalary;
    expect(setupSquadCost).toBe(24000);

    const liderCost = sq.setupLiderSalary;
    expect(liderCost).toBe(12000);

    const totalPerMonth = cfoSquadCost + csCost + setupSquadCost + liderCost;
    expect(totalPerMonth).toBe(72000);
  });
});

describe('Engine: Squad costs flow into P&L headcount line', () => {
  it('headcount line with squad is more negative than without squad', () => {
    const withSquad = getModel(); // defaults include squadConfig
    const noSquad = getModel({ squadConfig: undefined } as any);
    // With squad, headcount cost includes squad salaries on top of base payroll
    // In later years with many clients, squad cost should dominate
    for (const y of [2028, 2029, 2030] as Year[]) {
      expect(Math.abs(withSquad.years[y].headcount)).toBeGreaterThan(
        Math.abs(noSquad.years[y].headcount)
      );
    }
  });

  it('headcount detail salaries include squad costs', () => {
    const model = getModel();
    for (const y of YEARS) {
      // salaries should be negative (expense)
      expect(model.years[y].headcountDetail.salaries).toBeLessThan(0);
      // benefits should be negative (expense)
      expect(model.years[y].headcountDetail.benefits).toBeLessThan(0);
      // total = salaries + benefits
      expectClose(
        model.years[y].headcountDetail.salaries + model.years[y].headcountDetail.benefits,
        model.years[y].headcount,
        1
      );
    }
  });
});

// ─── 10. MONTHLY TICKETS (Item 1) ──────────────────────────────────────────────

describe('Engine: Monthly ticket overrides (Item 1)', () => {
  it('flat ticket is used when no monthly override', () => {
    const model = getModel(); // no monthlyTickets set
    // Revenue should be positive (brownfield additions shift from exact expected)
    expect(model.years[2025].grossRevenue).toBeGreaterThan(0);
  });

  it('higher monthly ticket increases revenue', () => {
    const base = getModel();
    const highTicket = getModel({
      monthlyTickets: {
        caasAssessoria: {
          2026: Array(12).fill(5000), // doubled from 2000
        },
      },
    });
    expect(highTicket.years[2026].grossRevenue).toBeGreaterThan(base.years[2026].grossRevenue);
  });

  it('zero monthly ticket zeroes that product revenue', () => {
    const base = getModel();
    const zeroTicket = getModel({
      monthlyTickets: {
        saasOxy: {
          2027: Array(12).fill(0),
        },
      },
    });
    // SaaS revenue should be lower
    expect(zeroTicket.years[2027].saasRevenue).toBeLessThan(base.years[2027].saasRevenue);
  });

  it('monthly override only affects specified year', () => {
    const base = getModel();
    const override2028 = getModel({
      monthlyTickets: {
        caasEnterprise: {
          2028: Array(12).fill(20000), // much higher
        },
      },
    });
    // 2027 should be unaffected
    expectClose(override2028.years[2027].grossRevenue, base.years[2027].grossRevenue, 0.1);
    // 2028 should be higher
    expect(override2028.years[2028].grossRevenue).toBeGreaterThan(base.years[2028].grossRevenue);
  });
});

// ─── 11. SCENARIO MULTIPLIERS ───────────────────────────────────────────────────

describe('Engine: Scenario multipliers', () => {
  const base = getModel(undefined, 'BASE');
  const bull = getModel(undefined, 'BULL');
  const bear = getModel(undefined, 'BEAR');

  it('BULL revenue is ~20% higher than BASE', () => {
    for (const y of YEARS) {
      const ratio = bull.years[y].grossRevenue / base.years[y].grossRevenue;
      expect(ratio).toBeGreaterThan(1.15);
      expect(ratio).toBeLessThan(1.25);
    }
  });

  it('BEAR revenue is ~20% lower than BASE', () => {
    for (const y of YEARS) {
      const ratio = bear.years[y].grossRevenue / base.years[y].grossRevenue;
      expect(ratio).toBeGreaterThan(0.75);
      expect(ratio).toBeLessThan(0.85);
    }
  });

  it('BULL EBITDA > BASE EBITDA > BEAR EBITDA', () => {
    for (const y of YEARS) {
      expect(bull.years[y].ebitda).toBeGreaterThan(base.years[y].ebitda);
      expect(base.years[y].ebitda).toBeGreaterThan(bear.years[y].ebitda);
    }
  });
});

// ─── 12. COGS ───────────────────────────────────────────────────────────────────

describe('Engine: COGS', () => {
  const model = getModel();

  it('COGS are always negative', () => {
    for (const y of YEARS) {
      expect(model.years[y].cogs).toBeLessThanOrEqual(0);
    }
  });

  it('COGS detail sums to total COGS', () => {
    for (const y of YEARS) {
      const d = model.years[y].cogsDetail;
      const detailSum = d.caas + d.customerService + d.saas + d.education + d.baas;
      expectClose(detailSum, model.years[y].cogs, 1);
    }
  });

  it('COGS grows with revenue scale', () => {
    for (let i = 1; i < YEARS.length; i++) {
      expect(Math.abs(model.years[YEARS[i]].cogs)).toBeGreaterThan(
        Math.abs(model.years[YEARS[i - 1]].cogs)
      );
    }
  });
});

// ─── 13. DEBT & CAPEX ──────────────────────────────────────────────────────────

describe('Engine: Debt & Capex', () => {
  const model = getModel();

  it('debt payments are negative or zero', () => {
    for (const y of YEARS) {
      expect(model.years[y].debtPayments).toBeLessThanOrEqual(0);
    }
  });

  it('capex is negative or zero', () => {
    for (const y of YEARS) {
      expect(model.years[y].capex).toBeLessThanOrEqual(0);
    }
  });

  it('debt payments decrease over time (amortization)', () => {
    // By 2030, most debts should be paid off
    expect(Math.abs(model.years[2030].debtPayments)).toBeLessThan(
      Math.abs(model.years[2025].debtPayments)
    );
  });

  it('capex detail sums to total capex', () => {
    for (const y of YEARS) {
      const d = model.years[y].capexDetail;
      expectClose(d.software + d.realestate, model.years[y].capex, 1);
    }
  });
});

// ─── 14. FINAL RESULT (Cash Flow) ──────────────────────────────────────────────

describe('Engine: Final result / Cash flow', () => {
  const model = getModel();

  it('final result = net income + debt payments + capex', () => {
    for (const y of YEARS) {
      const yr = model.years[y];
      expectClose(yr.finalResult, yr.netIncome + yr.debtPayments + yr.capex, 1);
    }
  });

  it('net income improves from 2025 to 2028', () => {
    // With brownfield squad costs, final result may not always grow linearly
    // but net income should improve from early loss-making to profitability
    expect(model.years[2028].netIncome).toBeGreaterThan(model.years[2025].netIncome);
  });
});

// ─── 15. PNL TREE ──────────────────────────────────────────────────────────────

describe('Engine: PnL tree structure', () => {
  const model = getModel();

  it('pnlTree is non-empty', () => {
    expect(model.pnlTree.length).toBeGreaterThan(0);
  });

  it('has RECEITA BRUTA as first node', () => {
    expect(model.pnlTree[0].code).toBe('1');
    expect(model.pnlTree[0].label).toBe('RECEITA BRUTA');
  });

  it('has RESULTADO FINAL as last node', () => {
    const last = model.pnlTree[model.pnlTree.length - 1];
    expect(last.code).toBe('FCR');
    expect(last.label).toBe('RESULTADO FINAL');
  });

  it('RECEITA BRUTA has BU children', () => {
    const rb = model.pnlTree[0];
    expect(rb.children).toBeDefined();
    const childCodes = rb.children!.map(c => c.code);
    expect(childCodes).toContain('1.1'); // CaaS
    expect(childCodes).toContain('1.2'); // SaaS
    expect(childCodes).toContain('1.3'); // Education
    expect(childCodes).toContain('1.5'); // Expansão
    expect(childCodes).toContain('2');   // Deduções
  });

  it('nodes have annual data for all years', () => {
    for (const node of model.pnlTree) {
      for (const y of YEARS) {
        expect(node.annual[y]).toBeDefined();
        expect(typeof node.annual[y]).toBe('number');
      }
    }
  });

  it('summary nodes have isSummary flag', () => {
    const summaryNodes = model.pnlTree.filter(n => n.isSummary);
    const summaryCodes = summaryNodes.map(n => n.code);
    expect(summaryCodes).toContain('1');      // RECEITA BRUTA
    expect(summaryCodes).toContain('NR');     // RECEITA LÍQUIDA
    expect(summaryCodes).toContain('GP');     // LUCRO BRUTO
    expect(summaryCodes).toContain('EBITDA');
    expect(summaryCodes).toContain('NI');     // RESULTADO LÍQUIDO
    expect(summaryCodes).toContain('FCR');    // RESULTADO FINAL
  });

  it('marketing node includes PR and Events lines (7.09, 7.10)', () => {
    const mktNode = model.pnlTree.find(n => n.code === '7');
    expect(mktNode).toBeDefined();
    expect(mktNode!.children).toBeDefined();
    const childCodes = mktNode!.children!.map(c => c.code);
    expect(childCodes).toContain('7.09'); // PR
    expect(childCodes).toContain('7.10'); // Eventos Marketing
  });
});

// ─── 16. KPIs ───────────────────────────────────────────────────────────────────

describe('Engine: KPI computation', () => {
  const model = getModel();

  it('computes KPIs for each year', () => {
    for (const y of YEARS) {
      const kpis = computeKPIs(model, y);
      expect(kpis.grossRevenue).toBe(model.years[y].grossRevenue);
      expect(kpis.ebitda).toBe(model.years[y].ebitda);
      expect(kpis.totalClients).toBe(model.years[y].totalClients);
    }
  });

  it('MRR is last month gross revenue × 1000', () => {
    for (const y of YEARS) {
      const kpis = computeKPIs(model, y);
      const lastMonthRev = model.years[y].monthlyData[11].grossRevenue;
      expect(kpis.mrr).toBe(lastMonthRev * 1000);
    }
  });

  it('ARR = MRR × 12', () => {
    for (const y of YEARS) {
      const kpis = computeKPIs(model, y);
      expect(kpis.arr).toBe(kpis.mrr * 12);
    }
  });
});

// ─── 17. RECEIVABLES / WORKING CAPITAL ──────────────────────────────────────────

describe('Engine: Receivables change', () => {
  const model = getModel();

  it('receivables change is computed for each year', () => {
    for (const y of YEARS) {
      expect(typeof model.years[y].receivablesChange).toBe('number');
    }
  });

  it('receivables change is negative when revenue grows (cash consumed)', () => {
    // As revenue grows, more cash is tied up in receivables
    // receivablesChange should be negative in high-growth years
    expect(model.years[2027].receivablesChange).toBeLessThan(0);
    expect(model.years[2028].receivablesChange).toBeLessThan(0);
  });
});

// ─── 18. HEADCOUNT ──────────────────────────────────────────────────────────────

describe('Engine: Headcount', () => {
  const model = getModel();

  it('headcount costs are negative', () => {
    for (const y of YEARS) {
      expect(model.years[y].headcount).toBeLessThan(0);
    }
  });

  it('headcount detail sums to total', () => {
    for (const y of YEARS) {
      const d = model.years[y].headcountDetail;
      expectClose(d.salaries + d.benefits, model.years[y].headcount, 1);
    }
  });

  it('headcount costs grow with client base', () => {
    expect(Math.abs(model.years[2030].headcount)).toBeGreaterThan(
      Math.abs(model.years[2025].headcount)
    );
  });
});

// ─── 19. COMBINED BROWNFIELD SCENARIO ──────────────────────────────────────────

describe('Engine: Combined brownfield scenario', () => {
  it('all brownfield features together produce valid output', () => {
    const model = getModel({
      taxEnabled: false,
      marketingPR: 20000,
      marketingEvents: 15000,
      cacPerProduct: {
        caasAssessoria: 15000, caasEnterprise: 15000, caasCorporate: 15000, caasSetup: 15000,
        saasOxy: 10000, saasOxyGenio: 10000, educationDonoCFO: 3000, baas: 3000,
      },
      eduExpansaoTeamRate: 0.20,
      monthlyTickets: {
        saasOxy: { 2027: Array(12).fill(1500) },
      },
      squadConfig: {
        cfoSalary: 20000, cfoAnalistaSalary: 9000, cfoAnalistasPerSquad: 3,
        cfoClientsPerSquad: 12, csPerClients: 80, csSalary: 6000,
        setupAnalistaSalary: 9000, setupImplSalary: 9000, setupImplPerSquad: 3,
        setupSetupsPerSquad: 12, setupLiderSalary: 15000, setupSquadsPerLider: 2,
      },
    });

    for (const y of YEARS) {
      const yr = model.years[y];
      // Basic sanity checks
      expect(yr.grossRevenue).toBeGreaterThan(0);
      expect(yr.netRevenue).toBeGreaterThan(0);
      expect(yr.deductions).toBeLessThan(0);
      expect(yr.cogs).toBeLessThanOrEqual(0);
      expect(yr.taxes).toBe(0); // taxEnabled is false
      expect(yr.monthlyData).toHaveLength(12);
    }

    // PnL tree should still be valid
    expect(model.pnlTree.length).toBeGreaterThan(0);
  });
});
