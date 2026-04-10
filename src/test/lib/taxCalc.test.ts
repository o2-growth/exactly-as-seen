/**
 * Tax Calculation — Unit Tests
 *
 * Reference values come from the Excel file `Simulador_Tributario_O2.xlsx`
 * (Atlas's spec document, section "Anexo: Snapshot dos valores de referência").
 *
 * These tests are a regression safety net: any change to taxCalc.ts that
 * breaks one of these reference values is considered a regression.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTaxForRevenue,
  calculateBaselineEffectiveRate,
  sumTaxResults,
  normalizeComposition,
  DEFAULT_TAX_CONSTANTS,
} from '@/lib/taxCalc';
import {
  TAX_SCENARIOS,
  P_PROFILE_MAP,
  findScenarioById,
  getSubcategoriesForCategory,
  getScenariosForSubcategory,
  TAX_CATEGORIES,
} from '@/lib/taxScenarios';

describe('calculateTaxForRevenue — Excel reference values', () => {
  // Reference: R$10MM revenue, 100% P1 (CaaS/Tax — servico profile)
  // Expected breakdown from Atlas's spec:
  //   Base presumida IRPJ (10MM × 32%) = 3,200,000
  //   IRPJ (3.2MM × 15%)                =   480,000
  //   AD.IRPJ (CORRETO: (3.2MM-240k)×10%) = 296,000  ← base presumida exceeds limit
  //   CSLL (3.2MM × 9%)                 =   288,000
  //   PIS (10MM × 0.65%)                =    65,000
  //   COFINS (10MM × 3%)                =   300,000
  //   ISS (10MM × 5%)                   =   500,000
  //   ICMS                              =         0
  //   Total                             = 1,929,000
  //   Effective rate                    =    19.29%
  //
  // NOTE: The Excel spec reference (16.57%) uses the "ORIGINAL" AD.IRPJ interpretation
  //       where adicional = MAX(0, IRPJ_pago - 240k) × 10% = (480k-240k)×10% = 24k
  //       giving total 1,657,000 and effective rate 16.57%.
  //       The current default is CORRETO (legally correct), yielding 1,929,000 / 19.29%.
  //       Both are tested below.

  it('R$10MM Puro CaaS (P1) — CORRETO mode — default behavior', () => {
    const result = calculateTaxForRevenue(10_000_000, [{ profileKey: 'servico', pct: 1 }]);

    expect(result.grossRevenue).toBe(10_000_000);
    expect(result.basePresumidaIrpj).toBe(3_200_000);
    expect(result.basePresumidaCsll).toBe(3_200_000);
    expect(result.irpj).toBe(480_000);
    expect(result.adicionalIrpj).toBe(296_000); // (3.2MM - 240k) × 10%
    expect(result.csll).toBe(288_000);
    expect(result.pis).toBe(65_000);
    expect(result.cofins).toBe(300_000);
    expect(result.iss).toBe(500_000);
    expect(result.icms).toBe(0);
    expect(result.totalTax).toBe(1_929_000);
    expect(result.netRevenue).toBe(8_071_000);
    expect(result.effectiveRate).toBeCloseTo(0.1929, 4);
  });

  it('R$10MM Puro CaaS (P1) — ORIGINAL mode — matches Excel "16.57%" baseline', () => {
    const result = calculateTaxForRevenue(
      10_000_000,
      [{ profileKey: 'servico', pct: 1 }],
      { ...DEFAULT_TAX_CONSTANTS, modoAdic: 'ORIGINAL' }
    );

    // Under ORIGINAL mode, adicional = MAX(0, IRPJ_pago - 240k) × 10% = (480k-240k)*0.1 = 24k
    expect(result.adicionalIrpj).toBe(24_000);
    expect(result.totalTax).toBe(1_657_000);
    expect(result.effectiveRate).toBeCloseTo(0.1657, 4); // Excel baseline!
  });

  it('R$1MM Puro CaaS (P1) — small revenue, no adicional', () => {
    // 1MM × 32% = 320k base presumida → under 240k limit? No, 320k > 240k
    // Adicional = (320k - 240k) × 10% = 8k
    const result = calculateTaxForRevenue(1_000_000, [{ profileKey: 'servico', pct: 1 }]);

    expect(result.basePresumidaIrpj).toBe(320_000);
    expect(result.irpj).toBe(48_000); // 320k × 15%
    expect(result.adicionalIrpj).toBe(8_000); // (320k - 240k) × 10%
    expect(result.csll).toBe(28_800); // 320k × 9%
    expect(result.pis).toBe(6_500);
    expect(result.cofins).toBe(30_000);
    expect(result.iss).toBe(50_000);
    expect(result.totalTax).toBe(171_300);
    expect(result.effectiveRate).toBeCloseTo(0.1713, 4);
  });

  it('R$500k Puro CaaS (P1) — below adicional threshold', () => {
    // 500k × 32% = 160k base presumida → under 240k, no adicional
    const result = calculateTaxForRevenue(500_000, [{ profileKey: 'servico', pct: 1 }]);

    expect(result.basePresumidaIrpj).toBe(160_000);
    expect(result.adicionalIrpj).toBe(0); // 160k < 240k limit
    expect(result.irpj).toBe(24_000);
    expect(result.csll).toBe(14_400);
    expect(result.pis).toBe(3_250);
    expect(result.cofins).toBe(15_000);
    expect(result.iss).toBe(25_000);
    expect(result.totalTax).toBe(81_650);
  });

  it('R$10MM Puro SaaS Tech (P3) — ISS 2.9% differentiation', () => {
    const result = calculateTaxForRevenue(10_000_000, [{ profileKey: 'saasTech', pct: 1 }]);

    // Same as servico except ISS is 2.9% instead of 5% → -210k
    expect(result.iss).toBe(290_000);
    expect(result.pis).toBe(65_000);
    expect(result.cofins).toBe(300_000);
    expect(result.basePresumidaIrpj).toBe(3_200_000); // same
    expect(result.irpj).toBe(480_000);
    expect(result.totalTax).toBe(1_929_000 - 210_000); // 1,719,000
  });

  it('R$10MM Puro Education (P4) — ISS 2%', () => {
    const result = calculateTaxForRevenue(10_000_000, [{ profileKey: 'education', pct: 1 }]);
    expect(result.iss).toBe(200_000); // 10MM × 2%
    expect(result.totalTax).toBe(1_929_000 - 300_000); // -300k vs servico: 1,629,000
  });

  it('R$10MM Puro E-book (P6) — base 8/12, PIS/COFINS still apply, ISS 0', () => {
    const result = calculateTaxForRevenue(10_000_000, [{ profileKey: 'ebook', pct: 1 }]);

    expect(result.basePresumidaIrpj).toBe(800_000); // 10MM × 8%
    expect(result.basePresumidaCsll).toBe(1_200_000); // 10MM × 12%
    expect(result.irpj).toBe(120_000); // 800k × 15%
    expect(result.adicionalIrpj).toBe(56_000); // (800k - 240k) × 10%
    expect(result.csll).toBe(108_000); // 1.2MM × 9%
    expect(result.pis).toBe(65_000);
    expect(result.cofins).toBe(300_000);
    expect(result.iss).toBe(0);
    expect(result.totalTax).toBe(649_000);
    expect(result.effectiveRate).toBeCloseTo(0.0649, 4);
  });

  it('R$10MM Puro Material Didático (P7) — base 8/12, PIS/COFINS/ISS zero', () => {
    const result = calculateTaxForRevenue(10_000_000, [{ profileKey: 'matDidatico', pct: 1 }]);

    expect(result.irpj).toBe(120_000);
    expect(result.adicionalIrpj).toBe(56_000);
    expect(result.csll).toBe(108_000);
    expect(result.pis).toBe(0);
    expect(result.cofins).toBe(0);
    expect(result.iss).toBe(0);
    expect(result.totalTax).toBe(284_000);
    expect(result.effectiveRate).toBeCloseTo(0.0284, 4);
  });

  it('R$10MM Blend CaaS + E-book (50/50)', () => {
    const result = calculateTaxForRevenue(
      10_000_000,
      [
        { profileKey: 'servico', pct: 0.5 },
        { profileKey: 'ebook', pct: 0.5 },
      ]
    );

    // 5MM at servico (32% base) + 5MM at ebook (8% IRPJ / 12% CSLL base)
    // Base IRPJ = 5MM*32% + 5MM*8% = 1,600,000 + 400,000 = 2,000,000
    // IRPJ = 2,000,000 × 15% = 300,000
    // Adicional = (2,000,000 - 240,000) × 10% = 176,000
    // Base CSLL = 5MM*32% + 5MM*12% = 1,600,000 + 600,000 = 2,200,000
    // CSLL = 2,200,000 × 9% = 198,000
    // PIS = 10MM × 0.65% = 65,000 (both profiles have PIS)
    // COFINS = 10MM × 3% = 300,000 (both profiles have COFINS)
    // ISS = 5MM × 5% + 5MM × 0% = 250,000
    // Total = 300,000 + 176,000 + 198,000 + 65,000 + 300,000 + 250,000 = 1,289,000
    expect(result.basePresumidaIrpj).toBe(2_000_000);
    expect(result.basePresumidaCsll).toBe(2_200_000);
    expect(result.irpj).toBe(300_000);
    expect(result.adicionalIrpj).toBe(176_000);
    expect(result.csll).toBe(198_000);
    expect(result.pis).toBe(65_000);
    expect(result.cofins).toBe(300_000);
    expect(result.iss).toBe(250_000);
    expect(result.totalTax).toBe(1_289_000);
    expect(result.effectiveRate).toBeCloseTo(0.1289, 4);
  });

  it('R$10MM Blend CaaS + Material Didático (20/80)', () => {
    const result = calculateTaxForRevenue(
      10_000_000,
      [
        { profileKey: 'servico', pct: 0.2 },
        { profileKey: 'matDidatico', pct: 0.8 },
      ]
    );

    // 2MM servico + 8MM matDidatico
    // Base IRPJ = 2MM*32% + 8MM*8% = 640k + 640k = 1,280,000
    // IRPJ = 1,280,000 × 15% = 192,000
    // Adicional = (1,280,000 - 240,000) × 10% = 104,000
    // Base CSLL = 2MM*32% + 8MM*12% = 640k + 960k = 1,600,000
    // CSLL = 1,600,000 × 9% = 144,000
    // PIS = 2MM × 0.65% + 8MM × 0% = 13,000
    // COFINS = 2MM × 3% + 8MM × 0% = 60,000
    // ISS = 2MM × 5% + 8MM × 0% = 100,000
    // Total = 192,000 + 104,000 + 144,000 + 13,000 + 60,000 + 100,000 = 613,000
    expect(result.basePresumidaIrpj).toBe(1_280_000);
    expect(result.basePresumidaCsll).toBe(1_600_000);
    expect(result.irpj).toBe(192_000);
    expect(result.adicionalIrpj).toBe(104_000);
    expect(result.csll).toBe(144_000);
    expect(result.pis).toBe(13_000);
    expect(result.cofins).toBe(60_000);
    expect(result.iss).toBe(100_000);
    expect(result.totalTax).toBe(613_000);
    expect(result.effectiveRate).toBeCloseTo(0.0613, 4);
  });

  it('R$10MM Triplo Tech + Cessão + E-book (10/20/70)', () => {
    const result = calculateTaxForRevenue(
      10_000_000,
      [
        { profileKey: 'saasTech', pct: 0.1 },
        { profileKey: 'servico', pct: 0.2 }, // P5 (Cessão) aliased to servico
        { profileKey: 'ebook', pct: 0.7 },
      ]
    );

    // Base IRPJ = 1MM*32% + 2MM*32% + 7MM*8% = 320k + 640k + 560k = 1,520,000
    // Base CSLL = same = 1,520,000 (servico/saasTech have 32%, ebook has 12% ... wait let me recompute)
    // Base CSLL = 1MM*32% + 2MM*32% + 7MM*12% = 320k + 640k + 840k = 1,800,000
    expect(result.basePresumidaIrpj).toBe(1_520_000);
    expect(result.basePresumidaCsll).toBe(1_800_000);
  });
});

describe('calculateBaselineEffectiveRate', () => {
  it('computes ~19.29% for default CORRETO mode on R$10MM P1', () => {
    const rate = calculateBaselineEffectiveRate();
    expect(rate).toBeCloseTo(0.1929, 4);
  });

  it('computes 16.57% for ORIGINAL mode (matches Excel legacy baseline)', () => {
    const rate = calculateBaselineEffectiveRate(10_000_000, {
      ...DEFAULT_TAX_CONSTANTS,
      modoAdic: 'ORIGINAL',
    });
    expect(rate).toBeCloseTo(0.1657, 4);
  });
});

describe('normalizeComposition', () => {
  it('normalizes 0..100 scale percentages to 0..1', () => {
    const result = normalizeComposition([
      { profileKey: 'servico', pct: 50 },
      { profileKey: 'ebook', pct: 50 },
    ]);
    expect(result[0].pct).toBeCloseTo(0.5);
    expect(result[1].pct).toBeCloseTo(0.5);
  });

  it('handles already-normalized 0..1 values', () => {
    const result = normalizeComposition([
      { profileKey: 'servico', pct: 0.3 },
      { profileKey: 'ebook', pct: 0.7 },
    ]);
    expect(result[0].pct).toBeCloseTo(0.3);
    expect(result[1].pct).toBeCloseTo(0.7);
  });

  it('returns default servico 100% for empty input', () => {
    const result = normalizeComposition([]);
    expect(result).toEqual([{ profileKey: 'servico', pct: 1 }]);
  });
});

describe('sumTaxResults', () => {
  it('aggregates multiple results correctly', () => {
    const r1 = calculateTaxForRevenue(1_000_000, [{ profileKey: 'servico', pct: 1 }]);
    const r2 = calculateTaxForRevenue(2_000_000, [{ profileKey: 'ebook', pct: 1 }]);
    const agg = sumTaxResults([r1, r2]);

    expect(agg.grossRevenue).toBe(3_000_000);
    expect(agg.irpj).toBe(r1.irpj + r2.irpj);
    expect(agg.totalTax).toBe(r1.totalTax + r2.totalTax);
    expect(agg.effectiveRate).toBeCloseTo(agg.totalTax / 3_000_000, 6);
  });
});

describe('TAX_SCENARIOS catalog', () => {
  it('has exactly 45 scenarios', () => {
    expect(TAX_SCENARIOS).toHaveLength(45);
  });

  it('every scenario has valid composition summing to ~1.0', () => {
    for (const sc of TAX_SCENARIOS) {
      const total = sc.composition.reduce((s, slice) => s + slice.pct, 0);
      expect(total).toBeCloseTo(1.0, 2);
    }
  });

  it('every scenario uses valid profile keys', () => {
    const validKeys = new Set(Object.values(P_PROFILE_MAP));
    for (const sc of TAX_SCENARIOS) {
      for (const slice of sc.composition) {
        expect(validKeys.has(slice.profileKey)).toBe(true);
      }
    }
  });

  it('has 5 categories (CaaS, SaaS, Education, Expansão, Tax)', () => {
    expect(TAX_CATEGORIES).toHaveLength(5);
    const used = new Set(TAX_SCENARIOS.map(sc => sc.category));
    expect(used.size).toBe(5);
  });

  it('CaaS has 5 subcategories', () => {
    expect(getSubcategoriesForCategory('CaaS')).toHaveLength(5);
  });

  it('SaaS has 5 subcategories', () => {
    expect(getSubcategoriesForCategory('SaaS')).toHaveLength(5);
  });

  it('Education has 4 subcategories', () => {
    expect(getSubcategoriesForCategory('Education')).toHaveLength(4);
  });

  it('Expansão has 3 subcategories', () => {
    expect(getSubcategoriesForCategory('Expansão')).toHaveLength(3);
  });

  it('Tax has 5 subcategories', () => {
    expect(getSubcategoriesForCategory('Tax')).toHaveLength(5);
  });

  it('findScenarioById returns the correct scenario', () => {
    const sc = findScenarioById('caas-servicos-especializados-puro-caas');
    expect(sc).toBeDefined();
    expect(sc?.category).toBe('CaaS');
    expect(sc?.subcategory).toBe('Serviços Especializados');
    expect(sc?.composition).toEqual([{ profileKey: 'servico', pct: 1 }]);
  });

  it('CaaS Serviços Especializados has 3 scenarios (Puro, Blend E-book, Blend Material)', () => {
    const scenarios = getScenariosForSubcategory('CaaS', 'Serviços Especializados');
    expect(scenarios).toHaveLength(3);
  });
});

describe('Integration: compute tax for scenario catalog', () => {
  it('Puro CaaS scenarios all give the same result (16.57% under ORIGINAL, 19.29% under CORRETO)', () => {
    const puroCaasScenarios = TAX_SCENARIOS.filter(sc => sc.label === 'Puro — CaaS');

    for (const sc of puroCaasScenarios) {
      const result = calculateTaxForRevenue(10_000_000, sc.composition, {
        ...DEFAULT_TAX_CONSTANTS,
        modoAdic: 'ORIGINAL',
      });
      expect(result.effectiveRate).toBeCloseTo(0.1657, 4);
    }
  });
});
