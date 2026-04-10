/**
 * Tax Calculation — Pure Functions
 *
 * Core Lucro Presumido calculation logic, extracted from calculationsEngine.ts
 * to be reusable by the Simulador Tributário pages and any other future module.
 *
 * Covers:
 * - IRPJ (15% on presumed base)
 * - Adicional IRPJ (10% on presumed base exceeding R$240k/year, CORRETO interpretation)
 * - CSLL (9% on presumed base)
 * - PIS/COFINS (cumulative regime)
 * - ISS (per profile)
 * - ICMS (per profile)
 *
 * All rates are read from the TAX_PROFILES catalog and optional TaxConstants overrides.
 */

import {
  TAX_PROFILES,
  TaxSlice,
  SubProductTaxConfig,
  resolveSlices,
  getMixTaxSlices,
} from './financialData';

// ─── Tax Constants (editable defaults matching Excel's Named Ranges) ───

export interface TaxConstants {
  /** IRPJ base rate — 15% */
  irpjBase: number;
  /** CSLL base rate — 9% */
  csllBase: number;
  /** Adicional IRPJ rate — 10% */
  adicRate: number;
  /** Monthly adicional exemption limit — R$20.000 */
  adicLimitMensal: number;
  /** Months in year — 12 */
  meses: number;
  /**
   * Adicional IRPJ calculation mode:
   * - 'CORRETO': adicional is computed on the PRESUMED BASE exceeding R$240k/year (legally correct)
   * - 'ORIGINAL': adicional is computed on the IRPJ PAID exceeding R$240k/year (legally wrong, Excel legacy)
   */
  modoAdic: 'CORRETO' | 'ORIGINAL';
}

export const DEFAULT_TAX_CONSTANTS: TaxConstants = {
  irpjBase: 0.15,
  csllBase: 0.09,
  adicRate: 0.10,
  adicLimitMensal: 20000,
  meses: 12,
  modoAdic: 'CORRETO',
};

// ─── Output Types ───

/** Breakdown of taxes for a single revenue calculation */
export interface TaxBreakdown {
  /** IRPJ base (before adicional) */
  irpj: number;
  /** Adicional IRPJ (10% on excess) */
  adicionalIrpj: number;
  /** CSLL */
  csll: number;
  /** PIS (cumulative) */
  pis: number;
  /** COFINS (cumulative) */
  cofins: number;
  /** ISS */
  iss: number;
  /** ICMS */
  icms: number;
  /** Sum of all taxes above */
  totalTax: number;
}

/** Full result of a tax calculation */
export interface TaxResult extends TaxBreakdown {
  /** Input: gross revenue */
  grossRevenue: number;
  /** grossRevenue - totalTax */
  netRevenue: number;
  /** totalTax / grossRevenue (0..1) */
  effectiveRate: number;
  /** Base presumida IRPJ (for audit/debugging) */
  basePresumidaIrpj: number;
  /** Base presumida CSLL (for audit/debugging) */
  basePresumidaCsll: number;
}

// ─── Helpers ───

/**
 * Normalizes a composition array so percentages sum to 1 (100%).
 * Accepts slices with pct in 0..100 or 0..1 — detects automatically.
 */
export function normalizeComposition(composition: TaxSlice[]): TaxSlice[] {
  if (!composition.length) return [{ profileKey: 'servico', pct: 1 }];
  const total = composition.reduce((s, sl) => s + (sl.pct ?? 0), 0);
  if (total <= 0) return [{ profileKey: 'servico', pct: 1 }];
  // Detect scale: if any pct > 1, assume 0..100 scale
  const scale = composition.some(s => (s.pct ?? 0) > 1) ? 100 : 1;
  return composition.map(sl => ({
    profileKey: sl.profileKey,
    pct: (sl.pct ?? 0) / total * scale / scale, // normalize to 0..1 regardless of input scale
  })).map(sl => ({ ...sl, pct: sl.pct }));
}

/**
 * Converts a SubProductTaxConfig into a composition array (0..1 scale).
 * Handles single profiles, mix profiles, and custom profiles.
 */
export function compositionFromConfig(cfg: SubProductTaxConfig): TaxSlice[] {
  if (cfg.perfilTributario === 'mix') {
    const slices = getMixTaxSlices(cfg.taxSlices);
    const total = slices.reduce((s, sl) => s + sl.pct, 0) || 100;
    return slices.map(s => ({ profileKey: s.profileKey, pct: s.pct / total }));
  }
  const profileKey = cfg.perfilTributario && cfg.perfilTributario !== 'custom'
    ? cfg.perfilTributario
    : 'servico';
  return [{ profileKey, pct: 1 }];
}

// ─── Main Calculation ───

/**
 * Calculates taxes for an ANNUAL revenue figure with a given tax composition.
 *
 * This is the single source of truth for Lucro Presumido tax math.
 *
 * @param annualRevenue — revenue in BRL (R$), annual amount
 * @param composition — array of tax slices (profileKey + pct in 0..1). Must sum to 1.
 * @param constants — tax constants (defaults to DEFAULT_TAX_CONSTANTS)
 * @returns TaxResult with breakdown + effective rate
 *
 * @example
 * // Puro CaaS (P1) on R$10MM → R$1.657.000 tax → 16.57% effective rate
 * calculateTaxForRevenue(10_000_000, [{ profileKey: 'servico', pct: 1 }])
 */
export function calculateTaxForRevenue(
  annualRevenue: number,
  composition: TaxSlice[],
  constants: TaxConstants = DEFAULT_TAX_CONSTANTS
): TaxResult {
  if (annualRevenue <= 0 || !composition.length) {
    return emptyTaxResult(annualRevenue);
  }

  const normalized = normalizeComposition(composition);

  // Annual exemption limit for Adicional IRPJ: R$240k (R$20k × 12 months)
  const adicionalLimitAnual = constants.adicLimitMensal * constants.meses;

  let irpj = 0;
  let csll = 0;
  let pis = 0;
  let cofins = 0;
  let iss = 0;
  let icms = 0;
  let basePresumidaIrpjTotal = 0;
  let basePresumidaCsllTotal = 0;

  for (const slice of normalized) {
    const profile = TAX_PROFILES[slice.profileKey];
    if (!profile) continue; // skip invalid profile keys defensively

    const sliceRevenue = annualRevenue * slice.pct;

    // Base presumida
    const basePresumidaIrpj = sliceRevenue * (profile.presumidoIRPJ / 100);
    const basePresumidaCsll = sliceRevenue * (profile.presumidoCSLL / 100);
    basePresumidaIrpjTotal += basePresumidaIrpj;
    basePresumidaCsllTotal += basePresumidaCsll;

    // IRPJ base (15%)
    irpj += basePresumidaIrpj * constants.irpjBase;

    // CSLL (9%)
    csll += basePresumidaCsll * constants.csllBase;

    // Direct taxes on revenue (cumulative regime)
    pis += sliceRevenue * (profile.pis / 100);
    cofins += sliceRevenue * (profile.cofins / 100);
    iss += sliceRevenue * (profile.iss / 100);
    icms += sliceRevenue * (profile.icms / 100);
  }

  // Adicional IRPJ — applied ONCE on the consolidated presumed base across all slices
  // (correct per legislation — Art. 3, §1º, Lei 9.249/1995)
  let adicionalIrpj = 0;
  if (constants.modoAdic === 'CORRETO') {
    // Legal interpretation: 10% on (base presumida anual - R$240k)
    adicionalIrpj = Math.max(0, basePresumidaIrpjTotal - adicionalLimitAnual) * constants.adicRate;
  } else {
    // ORIGINAL (Excel legacy, legally wrong): 10% on (IRPJ paid - R$240k)
    adicionalIrpj = Math.max(0, irpj - adicionalLimitAnual) * constants.adicRate;
  }

  const totalTax = irpj + adicionalIrpj + csll + pis + cofins + iss + icms;
  const netRevenue = annualRevenue - totalTax;
  const effectiveRate = annualRevenue > 0 ? totalTax / annualRevenue : 0;

  return {
    grossRevenue: annualRevenue,
    irpj: round2(irpj),
    adicionalIrpj: round2(adicionalIrpj),
    csll: round2(csll),
    pis: round2(pis),
    cofins: round2(cofins),
    iss: round2(iss),
    icms: round2(icms),
    totalTax: round2(totalTax),
    netRevenue: round2(netRevenue),
    effectiveRate,
    basePresumidaIrpj: round2(basePresumidaIrpjTotal),
    basePresumidaCsll: round2(basePresumidaCsllTotal),
  };
}

/**
 * Calculates the "all CaaS baseline" — effective tax rate if 100% of revenue
 * were taxed under profile P1 (servico). Computed dynamically so it stays
 * correct if TAX_PROFILES are edited.
 *
 * The Excel hard-codes this at 16.57% but derives it from default values,
 * which makes it fragile. This function computes it on the fly.
 *
 * @param sampleRevenue — sample revenue (default R$10MM, matching Excel's reference)
 * @returns effective rate in 0..1 (e.g. 0.1657 for 16.57%)
 */
export function calculateBaselineEffectiveRate(
  sampleRevenue: number = 10_000_000,
  constants: TaxConstants = DEFAULT_TAX_CONSTANTS
): number {
  const result = calculateTaxForRevenue(
    sampleRevenue,
    [{ profileKey: 'servico', pct: 1 }],
    constants
  );
  return result.effectiveRate;
}

// ─── Utilities ───

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyTaxResult(annualRevenue: number): TaxResult {
  return {
    grossRevenue: annualRevenue,
    irpj: 0,
    adicionalIrpj: 0,
    csll: 0,
    pis: 0,
    cofins: 0,
    iss: 0,
    icms: 0,
    totalTax: 0,
    netRevenue: annualRevenue,
    effectiveRate: 0,
    basePresumidaIrpj: 0,
    basePresumidaCsll: 0,
  };
}

/**
 * Aggregates multiple TaxResults into a combined total.
 * Useful for computing annual totals across multiple subcategories/scenarios.
 */
export function sumTaxResults(results: TaxResult[]): TaxResult {
  if (!results.length) return emptyTaxResult(0);

  const agg = results.reduce((sum, r) => ({
    grossRevenue: sum.grossRevenue + r.grossRevenue,
    irpj: sum.irpj + r.irpj,
    adicionalIrpj: sum.adicionalIrpj + r.adicionalIrpj,
    csll: sum.csll + r.csll,
    pis: sum.pis + r.pis,
    cofins: sum.cofins + r.cofins,
    iss: sum.iss + r.iss,
    icms: sum.icms + r.icms,
    totalTax: sum.totalTax + r.totalTax,
    netRevenue: sum.netRevenue + r.netRevenue,
    basePresumidaIrpj: sum.basePresumidaIrpj + r.basePresumidaIrpj,
    basePresumidaCsll: sum.basePresumidaCsll + r.basePresumidaCsll,
    effectiveRate: 0, // recalculated below
  }), emptyTaxResult(0));

  agg.effectiveRate = agg.grossRevenue > 0 ? agg.totalTax / agg.grossRevenue : 0;
  return agg;
}
