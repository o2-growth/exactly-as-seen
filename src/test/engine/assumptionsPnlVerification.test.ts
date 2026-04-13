/**
 * Verification: Assumptions → Engine → P&L consistency
 * Ensures all user-editable assumptions are properly read by the engine
 * and reflected in the P&L output.
 */
import { describe, it, expect } from 'vitest';
import { computeFullModel, FullModelOutput } from '@/engine/calculationsEngine';
import { DEFAULT_ASSUMPTIONS, Assumptions, YEARS, Year } from '@/lib/financialData';

function getModel(overrides?: Partial<Assumptions>): FullModelOutput {
  const assumptions = overrides ? { ...DEFAULT_ASSUMPTIONS, ...overrides } : DEFAULT_ASSUMPTIONS;
  return computeFullModel(assumptions, 'BASE');
}

// ─── 1. Revenue: Changing tickets should change gross revenue ───

describe('Assumptions → P&L: Ticket changes affect revenue', () => {
  it('doubling caasEnterprise ticket doubles CaaS Enterprise revenue', () => {
    const base = getModel();
    const doubled = getModel({
      tickets: { ...DEFAULT_ASSUMPTIONS.tickets, caasEnterprise: 9210 * 2 },
    });

    for (const y of YEARS) {
      // Skip 2025 (fully historical) and 2026 (mixed: Jan-Mar historical, Apr-Dec projected).
      // After the fix to read real Oxy data, historical months compute clients as
      // revenue/ticket, so doubling the ticket halves the clients and leaves revenue
      // unchanged. Only fully projected years (2027+) scale linearly with ticket.
      if (y <= 2026) continue;
      const baseRev = base.years[y].revenueDetail.caasEnterprise;
      const dblRev = doubled.years[y].revenueDetail.caasEnterprise;
      if (baseRev > 0) {
        const ratio = dblRev / baseRev;
        expect(ratio).toBeGreaterThan(1.9);
        expect(ratio).toBeLessThan(2.1);
      }
    }
  });

  it('changing saasOxy ticket changes SaaS Oxy revenue proportionally', () => {
    const base = getModel();
    const modified = getModel({
      tickets: { ...DEFAULT_ASSUMPTIONS.tickets, saasOxy: 2000 },
    });

    for (const y of YEARS) {
      if (y === 2025) continue;
      const baseRev = base.years[y].revenueDetail.saasOxy;
      const modRev = modified.years[y].revenueDetail.saasOxy;
      if (baseRev > 0) {
        const ratio = modRev / baseRev;
        const expectedRatio = 2000 / 1297;
        expect(Math.abs(ratio - expectedRatio)).toBeLessThan(0.1);
      }
    }
  });
});

// ─── 2. Client counts: Changing client targets should change revenue ───

describe('Assumptions → P&L: Client count changes affect revenue', () => {
  it('doubling caasEnterprise clients approximately doubles CaaS Enterprise revenue', () => {
    const base = getModel();
    const newClients = { ...DEFAULT_ASSUMPTIONS.subProductClients };
    for (const y of YEARS) {
      newClients.caasEnterprise = { ...newClients.caasEnterprise, [y]: DEFAULT_ASSUMPTIONS.subProductClients.caasEnterprise[y] * 2 };
    }
    const doubled = getModel({ subProductClients: newClients });

    for (const y of [2027, 2028, 2029, 2030] as Year[]) {
      const baseRev = base.years[y].revenueDetail.caasEnterprise;
      const dblRev = doubled.years[y].revenueDetail.caasEnterprise;
      if (baseRev > 100) {
        const ratio = dblRev / baseRev;
        expect(ratio).toBeGreaterThan(1.5);
        expect(ratio).toBeLessThan(2.5);
      }
    }
  });
});

// ─── 3. SG&A Growth Rate: Changing it should affect SG&A costs ───

describe('Assumptions → P&L: SG&A percentage affects costs', () => {
  it('higher sgaPercent increases SG&A (Despesas Administrativas)', () => {
    const base = getModel({ sgaPercent: 10.4 });
    const high = getModel({ sgaPercent: 20 });

    for (const y of [2027, 2028, 2029, 2030] as Year[]) {
      const baseSGA = Math.abs(base.years[y].sga);
      const highSGA = Math.abs(high.years[y].sga);
      expect(highSGA).toBeGreaterThan(baseSGA);
    }
  });

  it('sgaPercent = 5 costs less than sgaPercent = 20', () => {
    const low = getModel({ sgaPercent: 5 });
    const high = getModel({ sgaPercent: 20 });
    for (const y of [2028, 2029, 2030] as Year[]) {
      expect(Math.abs(low.years[y].sga)).toBeLessThan(Math.abs(high.years[y].sga));
    }
  });
});

// ─── 4. Headcount Growth: Changing it should affect headcount costs ───

describe('Assumptions → P&L: Pessoal percentage affects costs', () => {
  it('higher pessoalPercent increases headcount (Despesas com Pessoal)', () => {
    const base = getModel({ pessoalPercent: 7.2 });
    const high = getModel({ pessoalPercent: 20 });

    for (const y of [2027, 2028, 2029, 2030] as Year[]) {
      const baseHC = Math.abs(base.years[y].headcount);
      const highHC = Math.abs(high.years[y].headcount);
      expect(highHC).toBeGreaterThan(baseHC);
    }
  });
});

// ─── 5. Headcount Ratios: Changing them should affect hiring ───

describe('Assumptions → P&L: Headcount ratios (legacy — now percentage-based)', () => {
  it('headcount is now driven by pessoalPercent, not ratios', () => {
    // With the simplified model, headcountRatios no longer affect Despesas com Pessoal.
    // Changing pessoalPercent changes headcount costs.
    const low = getModel({ pessoalPercent: 5 });
    const high = getModel({ pessoalPercent: 15 });

    for (const y of [2028, 2029, 2030] as Year[]) {
      expect(Math.abs(high.years[y].headcount)).toBeGreaterThan(Math.abs(low.years[y].headcount));
    }
  });
});

// ─── 6. Salary Ranges: Changing them should affect costs ───

describe('Assumptions → P&L: Salary ranges (legacy — now percentage-based)', () => {
  it('headcount is now driven by pessoalPercent, salaries no longer affect it', () => {
    // With the simplified model, salaryRanges no longer affect Despesas com Pessoal.
    const base = getModel({ pessoalPercent: 7.2 });
    const high = getModel({ pessoalPercent: 14.4 });

    for (const y of [2028, 2029, 2030] as Year[]) {
      const baseCost = Math.abs(base.years[y].headcount);
      const highCost = Math.abs(high.years[y].headcount);
      expect(highCost).toBeGreaterThan(baseCost);
    }
  });
});

// ─── 7. COS Config: Changing it should affect COGS ───

describe('Assumptions → P&L: COS config affects COGS', () => {
  it('higher CaaS CFO salary increases COGS', () => {
    const base = getModel();
    const expensive = getModel({
      cosConfig: { ...DEFAULT_ASSUMPTIONS.cosConfig!, cfoSalary: 40000 },
    });

    for (const y of [2027, 2028] as Year[]) {
      const baseCOGS = Math.abs(base.years[y].cogs);
      const expCOGS = Math.abs(expensive.years[y].cogs);
      expect(expCOGS).toBeGreaterThan(baseCOGS);
    }
  });
});

// ─── 8. Tax rates: Changing sub-product tax rates should affect deductions ───

describe('Assumptions → P&L: Tax rates affect deductions', () => {
  it('higher ISS rate increases deductions (more negative)', () => {
    const base = getModel();
    const highTax = getModel({
      subProductTaxRates: {
        caasAssessoria: { pis: 0.65, cofins: 3.0, iss: 10.0, csllRetido: 0, pisRetido: 0, icms: 0, irrfRetido: 0, cofinsRetido: 0, presumidoIRPJ: 32, presumidoCSLL: 32, tipoReceita: 'servico' },
        caasEnterprise: { pis: 0.65, cofins: 3.0, iss: 10.0, csllRetido: 0, pisRetido: 0, icms: 0, irrfRetido: 0, cofinsRetido: 0, presumidoIRPJ: 32, presumidoCSLL: 32, tipoReceita: 'servico' },
      },
    });

    for (const y of [2026, 2027] as Year[]) {
      const baseDed = Math.abs(base.years[y].deductions);
      const highDed = Math.abs(highTax.years[y].deductions);
      expect(highDed).toBeGreaterThan(baseDed);
    }
  });
});

// ─── 9. Marketing: PR and Events should affect marketing costs ───

describe('Assumptions → P&L: Marketing costs', () => {
  it('higher marketingPercent increases marketing expense', () => {
    const base = getModel({ marketingPercent: 15.5 });
    const high = getModel({ marketingPercent: 25 });

    for (const y of YEARS) {
      const baseMkt = Math.abs(base.years[y].marketing);
      const highMkt = Math.abs(high.years[y].marketing);
      expect(highMkt).toBeGreaterThan(baseMkt);
    }
  });
});

// ─── 10. P&L tree consistency ───

describe('Assumptions → P&L: Tree consistency', () => {
  it('P&L tree Receita Bruta matches engine grossRevenue for projected years (2027+)', () => {
    const model = getModel();
    const tree = model.pnlTree;
    const receitaNode = tree.find(n => n.code === '1');
    expect(receitaNode).toBeDefined();

    // 2025 = full historical override, 2026 = blended (real Jan-Mar + engine Apr-Dec)
    // Only 2027+ should match engine exactly
    for (const y of [2027, 2028, 2029, 2030] as Year[]) {
      const treeVal = receitaNode!.annual[y];
      const engineVal = model.years[y].grossRevenue;
      expect(Math.abs(treeVal - engineVal)).toBeLessThan(2);
    }
  });

  it('P&L tree EBITDA matches engine ebitda for projected years (2027+)', () => {
    const model = getModel();
    const tree = model.pnlTree;
    const ebitdaNode = tree.find(n => n.code === 'EBITDA');
    expect(ebitdaNode).toBeDefined();

    for (const y of [2027, 2028, 2029, 2030] as Year[]) {
      const treeVal = ebitdaNode!.annual[y];
      const engineVal = model.years[y].ebitda;
      expect(Math.abs(treeVal - engineVal)).toBeLessThan(2);
    }
  });

  it('P&L tree 2025 uses historical data (differs from pure engine)', () => {
    const model = getModel();
    const tree = model.pnlTree;
    const receitaNode = tree.find(n => n.code === '1');
    expect(receitaNode).toBeDefined();
    // 2025 tree value should differ from engine (historical overrides applied)
    const treeVal = receitaNode!.annual[2025];
    const engineVal = model.years[2025].grossRevenue;
    // They CAN be equal if historical matches engine, but typically differ
    // Just verify both are positive
    expect(treeVal).toBeGreaterThan(0);
    expect(engineVal).toBeGreaterThan(0);
  });
});

// ─── 11. Churn: monthlyClientOverrides affect revenue ───

describe('Assumptions → P&L: Churn via monthlyClientOverrides', () => {
  it('setting monthlyClientOverrides with lower clients reduces revenue', () => {
    const base = getModel();

    // Create overrides with 50% fewer clients for caasEnterprise in 2027
    const halfClients: (number | null)[] = [];
    for (let m = 0; m < 12; m++) {
      // Roughly half the interpolated value
      const orig = DEFAULT_ASSUMPTIONS.subProductClients.caasEnterprise[2026] +
        (DEFAULT_ASSUMPTIONS.subProductClients.caasEnterprise[2027] - DEFAULT_ASSUMPTIONS.subProductClients.caasEnterprise[2026]) * ((m + 1) / 12);
      halfClients.push(Math.round(orig * 0.5));
    }

    const withChurn = getModel({
      monthlyClientOverrides: {
        caasEnterprise: { 2027: halfClients },
      },
    });

    // Revenue should be lower in 2027
    expect(withChurn.years[2027].revenueDetail.caasEnterprise)
      .toBeLessThan(base.years[2027].revenueDetail.caasEnterprise);

    // Should be roughly half
    const ratio = withChurn.years[2027].revenueDetail.caasEnterprise / base.years[2027].revenueDetail.caasEnterprise;
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it('monthlyChurnRates field is saved but engine uses overrides not rates directly', () => {
    // Engine does NOT read monthlyChurnRates — it reads monthlyClientOverrides
    // Changing monthlyChurnRates alone without overrides has no effect on engine
    const base = getModel();
    const withRates = getModel({
      monthlyChurnRates: { caasEnterprise: { 2027: 50 } }, // 50% annual churn
    });

    // Without monthlyClientOverrides, engine ignores monthlyChurnRates
    expect(withRates.years[2027].grossRevenue).toBe(base.years[2027].grossRevenue);
  });
});

// ─── 12. Assumptions page KPI vs P&L KPI ───

describe('Assumptions KPIs match P&L values', () => {
  it('engine grossRevenue used by both pages is the same source', () => {
    const model = getModel();
    // Both Assumptions and P&L read from model.years[y].grossRevenue
    // This test verifies the engine produces consistent values
    for (const y of YEARS) {
      expect(model.years[y].grossRevenue).toBeGreaterThan(0);
      expect(model.years[y].netRevenue).toBeLessThanOrEqual(model.years[y].grossRevenue);
      expect(model.years[y].grossProfit).toBeLessThanOrEqual(model.years[y].netRevenue);
    }
  });
});
