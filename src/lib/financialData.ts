export const YEARS = [2025, 2026, 2027, 2028, 2029, 2030] as const;
export type Year = typeof YEARS[number];

export interface SubProductClients {
  caasAssessoria: Record<Year, number>;
  caasEnterprise: Record<Year, number>;
  caasCorporate: Record<Year, number>;
  caasSetup: Record<Year, number>;
  caasParceiros: Record<Year, number>;
  saasOxy: Record<Year, number>;
  saasOxyGenio: Record<Year, number>;
  saasSetup: Record<Year, number>;
  saasParceiros: Record<Year, number>;
  saasOxyGenioEsp: Record<Year, number>;
  educationDonoCFO: Record<Year, number>;
  educationEN: Record<Year, number>;
  educationFR: Record<Year, number>;
  educationFSP: Record<Year, number>;
  baas: Record<Year, number>;
  baasFranquia: Record<Year, number>;
  baasMasterFranquia: Record<Year, number>;
  taxAT: Record<Year, number>;
  taxGPT: Record<Year, number>;
  taxRCT: Record<Year, number>;
  taxRT: Record<Year, number>;
  taxDTC: Record<Year, number>;
}

export interface Assumptions {
  caasClients: Record<Year, number>;
  saasClients: Record<Year, number>;
  educationClients: Record<Year, number>;
  taxClients: Record<Year, number>;
  subProductClients: SubProductClients;
  tickets: {
    caasAssessoria: number;
    caasEnterprise: number;
    caasCorporate: number;
    caasSetup: number;
    caasParceiros: number;
    saasOxy: number;
    saasOxyGenio: number;
    saasSetup: number;
    saasParceiros: number;
    saasOxyGenioEsp: number;
    educationDonoCFO: number;
    educationEN: number;
    educationFR: number;
    educationFSP: number;
    baas: number;
    baasFranquia: number;
    baasMasterFranquia: number;
    taxAT: number;
    taxGPT: number;
    taxRCT: number;
    taxRT: number;
    taxDTC: number;
  };
  // Item 1: Monthly ticket overrides (per product, per year, 12 months)
  monthlyTickets?: Partial<Record<TicketKey, Partial<Record<Year, number[]>>>>;
  // Monthly client overrides — direct per-month client counts that bypass geometric interpolation
  monthlyClientOverrides?: Partial<Record<TicketKey, Partial<Record<Year, (number | null)[]>>>>;
  // Monthly NEW client overrides — how many new clients enter each month (user-editable)
  monthlyNewClientOverrides?: Partial<Record<TicketKey, Partial<Record<Year, (number | null)[]>>>>;
  // Flags which monthly client overrides were manually edited by the user vs auto-generated previews
  manualMonthlyClientOverrideFlags?: Partial<Record<TicketKey, Partial<Record<Year, boolean[]>>>>;
  // Monthly churn rates per sub-product per year
  // Can be a single number (legacy: annual % flat) or an array of 12 monthly rates (progressive growth)
  monthlyChurnRates?: Partial<Record<TicketKey, Partial<Record<Year, number | number[]>>>>;
  churnCaas: number;
  churnSaas: number;
  churnBaas: number;
  pmrConfig: PmrConfig;
  sgaPercent: number;
  headcountGrowth: number;
  headcountSalaries: Record<string, number>;
  sgaGrowthRate: number;
  headcountRatios: {
    clientsPerCFO: number;
    clientsPerFPA: number;
    clientsPerPF: number;
    clientsPerProjectAnal: number;
    clientsPerDataAnal: number;
    clientsPerCSM: number;
    clientsPerSDR: number;
    clientsPerCommercialHead: number;
  };
  salaryRanges: Record<string, number>;
  // Item 4: Toggle to zero out taxes and sales deductions
  taxEnabled?: boolean;
  // Item 5: Marketing — PR and Events monthly costs
  marketingPR?: number;
  marketingEvents?: number;
  // Item 6: CAC per product (overrides sector-based CAC)
  cacPerProduct?: Partial<Record<TicketKey, number>>;
  // Item 8: legacy — replaced by cosConfig rates
  eduExpansaoTeamRate?: number;
  // Item 7: legacy — replaced by cosConfig
  squadConfig?: {
    cfoSalary: number;
    cfoAnalistaSalary: number;
    cfoAnalistasPerSquad: number;
    cfoClientsPerSquad: number;
    csPerClients: number;
    csSalary: number;
    setupAnalistaSalary: number;
    setupImplSalary: number;
    setupImplPerSquad: number;
    setupSetupsPerSquad: number;
    setupLiderSalary: number;
    setupSquadsPerLider: number;
  };
  // COS Config — premissas de custos variáveis por categoria (3.1–3.6)
  cosConfig?: CosConfig;
  // Editable Selic monthly rate (default 1.17% = 0.0117)
  selicMonthly?: number;
  // N/A flag for churn — products that are non-recurring don't have churn
  churnNotApplicable?: Partial<Record<TicketKey, boolean>>;
  // Lucro Presumido — tax config per BU (deprecated, kept for migration)
  buTaxConfigs?: BUTaxConfig[];
  // Lucro Presumido — per-subproduct tax rates
  subProductTaxRates?: Partial<Record<TicketKey, SubProductTaxConfig>>;

  // ─── Growth percentages (persisted for UX continuity) ───
  growthRates?: Record<number, Record<string, number[]>>;
  applyAllPct?: number;
  rowApplyPct?: Record<string, number | Record<number, number>>;
  rowTicketGrowthPct?: Record<string, number>;
  rowChurnPct?: Record<string, number>;

  // ─── Actual data (planned vs actual client counts) ───
  actualData?: Record<string, Record<number, number>>;

  // ─── Headcount employees (editable named employees table) ───
  hcEmployees?: { name: string; role: string; code: string; bu: string; monthly: Record<string, number> }[];

  // ─── Valuation Config (persisted) ───
  valuationConfig?: {
    ebitdaMultiple: number;
    arrMultiple: number;
    raiseAmount: number;
    raiseValuation: number;
  };

  // ─── Cap Table (persisted — migrated from separate localStorage) ───
  capTable?: {
    shareholders: { id: string; name: string; type: string; ownershipPct: number; entryDate: string }[];
    totalShares: number;
  };

  // ─── PnL Customization (persisted — migrated from separate localStorage) ───
  pnlConfig?: {
    customLabels: Record<string, string>;
    hiddenItems: string[];
  };
}

export interface BUTaxConfig {
  buKey: string;
  tipoReceita: string;
  aliquotaIss: number;
}

export interface TaxSlice {
  profileKey: string; // key into TAX_PROFILES (e.g. 'servico', 'ebook', 'livroFisico')
  pct: number;        // 0–100  (percentage of revenue allocated to this slice)
}

export interface SubProductTaxConfig {
  pis: number;              // 2.04 PIS — default 0.65
  cofins: number;           // 2.05 COFINS — default 3.0
  iss: number;              // 2.03 ISS — default 2.9 (SaaS) ou 5.0 (demais)
  csllRetido: number;       // 2.01 CSLL (retido na fonte) — default 0
  pisRetido: number;        // 2.02 PIS (retido na fonte) — default 0
  icms: number;             // 2.06 ICMS — default 0
  irrfRetido: number;       // 2.07 IRRF (retido na fonte) — default 0
  cofinsRetido: number;     // 2.08 COFINS (retido na fonte) — default 0
  presumidoIRPJ: number;    // Base presumida IRPJ — default 32 (serviço, em %)
  presumidoCSLL: number;    // Base presumida CSLL — default 32 (serviço, em %)
  tipoReceita: string;      // 'servico' (default)
  perfilTributario?: string; // Tax profile key (e.g. 'servico', 'ebook', 'livroFisico', 'mix', 'custom')
  mixServicoPct?: number;   // LEGACY — migrated to taxSlices. Kept for backward compat loading.
  taxSlices?: TaxSlice[];   // Multi-profile slices. Used when perfilTributario='mix'. Each slice calculated independently.
}

// ─── TAX PROFILES ───

export interface TaxProfileDef {
  label: string;
  presumidoIRPJ: number; // em %
  presumidoCSLL: number; // em %
  pis: number;           // em %
  cofins: number;        // em %
  iss: number;           // em %
  icms: number;          // em %
  description: string;
}

export const TAX_PROFILES: Record<string, TaxProfileDef> = {
  servico:      { label: 'Serviço',           presumidoIRPJ: 32, presumidoCSLL: 32, pis: 0.65, cofins: 3,   iss: 5,   icms: 0, description: 'Serviço padrão — ISS 5%, base 32%' },
  saasTech:     { label: 'SaaS Tech',         presumidoIRPJ: 32, presumidoCSLL: 32, pis: 0.65, cofins: 3,   iss: 2.9, icms: 0, description: 'SaaS regime especial POA — ISS 2,9%' },
  education:    { label: 'Education',         presumidoIRPJ: 32, presumidoCSLL: 32, pis: 0.65, cofins: 3,   iss: 2,   icms: 0, description: 'Educação POA — ISS 2%' },
  ebook:        { label: 'E-book',            presumidoIRPJ: 8,  presumidoCSLL: 12, pis: 0.65, cofins: 3,   iss: 0,   icms: 0, description: 'Produto digital — base 8%/12%, PIS+COFINS, sem ISS' },
  livroFisico:  { label: 'Livro Físico',      presumidoIRPJ: 8,  presumidoCSLL: 12, pis: 0,    cofins: 0,   iss: 0,   icms: 0, description: 'Livro físico — imune PIS/COFINS/ISS (Art. 150 CF)' },
  matDidatico:  { label: 'Mat. Didático',     presumidoIRPJ: 8,  presumidoCSLL: 12, pis: 0,    cofins: 0,   iss: 0,   icms: 0, description: 'Material didático — imune PIS/COFINS/ISS' },
  mix:          { label: '⚖ Mix Multi-Perfil', presumidoIRPJ: 32, presumidoCSLL: 32, pis: 0.65, cofins: 3,   iss: 5,   icms: 0, description: 'Mix: múltiplas fatias com perfis independentes' },
  custom:       { label: 'Custom',            presumidoIRPJ: 32, presumidoCSLL: 32, pis: 0.65, cofins: 3,   iss: 5,   icms: 0, description: 'Alíquotas customizadas manualmente' },
};

export const TAX_PROFILE_KEYS = Object.keys(TAX_PROFILES);

// Profiles that can be used as slices inside a mix (excludes 'mix' and 'custom')
export const SLICE_PROFILE_KEYS = TAX_PROFILE_KEYS.filter(k => k !== 'mix' && k !== 'custom');

export const DEFAULT_MIX_TAX_SLICES: TaxSlice[] = [
  { profileKey: 'servico', pct: 50 },
  { profileKey: 'ebook', pct: 50 },
];

function sanitizeSliceProfileKey(profileKey?: string): string {
  return profileKey && SLICE_PROFILE_KEYS.includes(profileKey) ? profileKey : 'servico';
}

function sanitizeSlicePct(pct?: number): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct ?? 0));
}

export function getMixTaxSlices(slices?: TaxSlice[]): TaxSlice[] {
  const source = slices?.length ? slices : DEFAULT_MIX_TAX_SLICES;
  return source.map(slice => ({
    profileKey: sanitizeSliceProfileKey(slice.profileKey),
    pct: sanitizeSlicePct(slice.pct),
  }));
}

export function swapOrUpdateMixSliceProfile(slices: TaxSlice[] | undefined, idx: number, profileKey: string): TaxSlice[] {
  const currentSlices = getMixTaxSlices(slices);
  if (!currentSlices[idx]) return currentSlices;

  const safeProfileKey = sanitizeSliceProfileKey(profileKey);
  const existingIdx = currentSlices.findIndex((slice, sliceIdx) => sliceIdx !== idx && slice.profileKey === safeProfileKey);

  if (existingIdx >= 0) {
    const reordered = [...currentSlices];
    [reordered[idx], reordered[existingIdx]] = [reordered[existingIdx], reordered[idx]];
    return reordered;
  }

  return currentSlices.map((slice, sliceIdx) => (
    sliceIdx === idx ? { ...slice, profileKey: safeProfileKey } : slice
  ));
}

export function updateMixSlicePct(slices: TaxSlice[] | undefined, idx: number, pct: number): TaxSlice[] {
  return getMixTaxSlices(slices).map((slice, sliceIdx) => (
    sliceIdx === idx ? { ...slice, pct: sanitizeSlicePct(pct) } : slice
  ));
}

export function addMixTaxSlice(slices?: TaxSlice[]): TaxSlice[] {
  const currentSlices = getMixTaxSlices(slices);
  const remaining = Math.max(0, 100 - currentSlices.reduce((sum, slice) => sum + slice.pct, 0));
  return [...currentSlices, { profileKey: 'servico', pct: remaining }];
}

export function removeMixTaxSlice(slices: TaxSlice[] | undefined, idx: number): TaxSlice[] {
  const currentSlices = getMixTaxSlices(slices);
  return currentSlices.length <= 1 ? currentSlices : currentSlices.filter((_, sliceIdx) => sliceIdx !== idx);
}

// Constantes de base presumida por tipo de receita (em %)
export const PRESUMIDO_SERVICO = { irpj: 32, csll: 32 };
export const PRESUMIDO_PRODUTO = { irpj: 8, csll: 12 };

/** Compute blended presumido from mix percentage (serviço vs produto) — LEGACY */
export function computeMixPresumido(mixServicoPct: number): { irpj: number; csll: number } {
  const s = mixServicoPct / 100;
  const p = 1 - s;
  return {
    irpj: Math.round((s * PRESUMIDO_SERVICO.irpj + p * PRESUMIDO_PRODUTO.irpj) * 100) / 100,
    csll: Math.round((s * PRESUMIDO_SERVICO.csll + p * PRESUMIDO_PRODUTO.csll) * 100) / 100,
  };
}

/** Apply a tax profile to a SubProductTaxConfig, returning the updated config */
export function applyTaxProfile(cfg: SubProductTaxConfig, profileKey: string): SubProductTaxConfig {
  const profile = TAX_PROFILES[profileKey];
  if (!profile || profileKey === 'custom') {
    return { ...cfg, perfilTributario: profileKey, taxSlices: undefined };
  }
  if (profileKey === 'mix') {
    return {
      ...cfg,
      perfilTributario: 'mix',
      taxSlices: getMixTaxSlices(cfg.taxSlices),
      mixServicoPct: undefined,
    };
  }
  return {
    ...cfg,
    perfilTributario: profileKey,
    pis: profile.pis,
    cofins: profile.cofins,
    iss: profile.iss,
    icms: profile.icms,
    presumidoIRPJ: profile.presumidoIRPJ,
    presumidoCSLL: profile.presumidoCSLL,
    mixServicoPct: undefined,
    taxSlices: undefined,
  };
}

/** Resolve tax slices for a config. Returns array of slices with resolved profile data. */
export function resolveSlices(cfg: SubProductTaxConfig): { profile: TaxProfileDef; pct: number }[] {
  if (cfg.perfilTributario === 'mix') {
    return getMixTaxSlices(cfg.taxSlices).map(s => ({
      profile: TAX_PROFILES[s.profileKey] ?? TAX_PROFILES.servico,
      pct: s.pct / 100,
    }));
  }
  // Single-profile: use the config's own values as a virtual single slice
  return [{
    profile: {
      label: '', description: '',
      presumidoIRPJ: cfg.presumidoIRPJ ?? 32,
      presumidoCSLL: cfg.presumidoCSLL ?? 32,
      pis: cfg.pis,
      cofins: cfg.cofins,
      iss: cfg.iss,
      icms: cfg.icms,
    },
    pct: 1,
  }];
}

/** Get the effective presumido values for a config, considering profile and mix slices */
export function getEffectivePresumido(cfg: SubProductTaxConfig): { irpj: number; csll: number } {
  if (cfg.perfilTributario === 'mix') {
    let irpj = 0, csll = 0;
    for (const s of getMixTaxSlices(cfg.taxSlices)) {
      const p = TAX_PROFILES[s.profileKey] ?? TAX_PROFILES.servico;
      irpj += p.presumidoIRPJ * (s.pct / 100);
      csll += p.presumidoCSLL * (s.pct / 100);
    }
    return { irpj: Math.round(irpj * 100) / 100, csll: Math.round(csll * 100) / 100 };
  }
  // Legacy mix support
  if (cfg.perfilTributario === 'mix' && cfg.mixServicoPct !== undefined && cfg.mixServicoPct !== null) {
    return computeMixPresumido(cfg.mixServicoPct);
  }
  if (cfg.mixServicoPct !== undefined && cfg.mixServicoPct !== null && !cfg.perfilTributario) {
    return computeMixPresumido(cfg.mixServicoPct);
  }
  return { irpj: cfg.presumidoIRPJ ?? 32, csll: cfg.presumidoCSLL ?? 32 };
}

/** Get effective weighted tax rates for display (PIS, COFINS, ISS, etc.) */
export function getEffectiveTaxRates(cfg: SubProductTaxConfig): { pis: number; cofins: number; iss: number; icms: number; presumidoIRPJ: number; presumidoCSLL: number } {
  if (cfg.perfilTributario === 'mix') {
    let pis = 0, cofins = 0, iss = 0, icms = 0, pIRPJ = 0, pCSLL = 0;
    for (const s of getMixTaxSlices(cfg.taxSlices)) {
      const p = TAX_PROFILES[s.profileKey] ?? TAX_PROFILES.servico;
      const w = s.pct / 100;
      pis += p.pis * w;
      cofins += p.cofins * w;
      iss += p.iss * w;
      icms += p.icms * w;
      pIRPJ += p.presumidoIRPJ * w;
      pCSLL += p.presumidoCSLL * w;
    }
    return {
      pis: Math.round(pis * 1000) / 1000,
      cofins: Math.round(cofins * 1000) / 1000,
      iss: Math.round(iss * 1000) / 1000,
      icms: Math.round(icms * 1000) / 1000,
      presumidoIRPJ: Math.round(pIRPJ * 100) / 100,
      presumidoCSLL: Math.round(pCSLL * 100) / 100,
    };
  }
  const eff = getEffectivePresumido(cfg);
  return { pis: cfg.pis, cofins: cfg.cofins, iss: cfg.iss, icms: cfg.icms, presumidoIRPJ: eff.irpj, presumidoCSLL: eff.csll };
}

/** All TicketKey values grouped by product category */
export const CAAS_KEYS: TicketKey[] = ['caasAssessoria', 'caasEnterprise', 'caasCorporate', 'caasParceiros', 'caasSetup'];
export const SAAS_KEYS: TicketKey[] = ['saasOxy', 'saasOxyGenio', 'saasSetup', 'saasParceiros', 'saasOxyGenioEsp'];
export const EDUCATION_KEYS: TicketKey[] = ['educationDonoCFO', 'educationEN', 'educationFR', 'educationFSP'];
export const EXPANSAO_KEYS: TicketKey[] = ['baas', 'baasFranquia', 'baasMasterFranquia'];
export const TAX_KEYS: TicketKey[] = ['taxAT', 'taxGPT', 'taxRCT', 'taxRT', 'taxDTC'];
export const ALL_SUBPRODUCT_KEYS: TicketKey[] = [...CAAS_KEYS, ...SAAS_KEYS, ...EDUCATION_KEYS, ...EXPANSAO_KEYS, ...TAX_KEYS];

/** Products with Monthly Recurring Revenue (MRR) — used for ARR/MRR calculations and Faturamento Base */
export const MRR_KEYS: TicketKey[] = ['caasEnterprise', 'caasCorporate', 'saasOxy', 'saasOxyGenio', 'saasOxyGenioEsp', 'taxAT'];

/** Check if a product key is MRR */
export function isProductMrr(key: TicketKey): boolean {
  return MRR_KEYS.includes(key);
}

export function getDefaultSubProductTaxConfig(key: TicketKey): SubProductTaxConfig {
  const base: Omit<SubProductTaxConfig, 'pis' | 'cofins' | 'iss' | 'icms' | 'presumidoIRPJ' | 'presumidoCSLL' | 'perfilTributario' | 'tipoReceita'> = {
    csllRetido: 0, pisRetido: 0, irrfRetido: 0, cofinsRetido: 0,
  };

  // ── CaaS (all 5): Mix Serviço 50% + E-book 50% ──
  if (CAAS_KEYS.includes(key)) {
    const p = TAX_PROFILES.servico;
    return {
      ...base, pis: p.pis, cofins: p.cofins, iss: p.iss, icms: p.icms,
      presumidoIRPJ: p.presumidoIRPJ, presumidoCSLL: p.presumidoCSLL,
      tipoReceita: 'servico', perfilTributario: 'mix',
      taxSlices: [{ profileKey: 'servico', pct: 50 }, { profileKey: 'ebook', pct: 50 }],
    };
  }

  // ── SaaS ──
  if (SAAS_KEYS.includes(key)) {
    // Setup: E-book (single profile)
    if (key === 'saasSetup') {
      const p = TAX_PROFILES.ebook;
      return {
        ...base, pis: p.pis, cofins: p.cofins, iss: p.iss, icms: p.icms,
        presumidoIRPJ: p.presumidoIRPJ, presumidoCSLL: p.presumidoCSLL,
        tipoReceita: 'servico', perfilTributario: 'ebook',
      };
    }
    // Oxy+Gênio+Especialista: Mix Serviço 30% + E-book 70%
    if (key === 'saasOxyGenioEsp') {
      const p = TAX_PROFILES.servico;
      return {
        ...base, pis: p.pis, cofins: p.cofins, iss: p.iss, icms: p.icms,
        presumidoIRPJ: p.presumidoIRPJ, presumidoCSLL: p.presumidoCSLL,
        tipoReceita: 'servico', perfilTributario: 'mix',
        taxSlices: [{ profileKey: 'servico', pct: 15 }, { profileKey: 'ebook', pct: 70 }, { profileKey: 'servico', pct: 15 }],
      };
    }
    // Oxy, Oxy+Gênio, Parceiros: Mix Serviço 20% + E-book 80%
    const p = TAX_PROFILES.servico;
    return {
      ...base, pis: p.pis, cofins: p.cofins, iss: p.iss, icms: p.icms,
      presumidoIRPJ: p.presumidoIRPJ, presumidoCSLL: p.presumidoCSLL,
      tipoReceita: 'servico', perfilTributario: 'mix',
      taxSlices: [{ profileKey: 'servico', pct: 20 }, { profileKey: 'ebook', pct: 80 }],
    };
  }

  // ── Education (all 4): E-book (single profile) ──
  if (EDUCATION_KEYS.includes(key)) {
    const p = TAX_PROFILES.ebook;
    return {
      ...base, pis: p.pis, cofins: p.cofins, iss: p.iss, icms: p.icms,
      presumidoIRPJ: p.presumidoIRPJ, presumidoCSLL: p.presumidoCSLL,
      tipoReceita: 'servico', perfilTributario: 'ebook',
    };
  }

  // ── Expansão (all 3): Mix Serviço 10% + Education 10% + E-book 80% ──
  if (EXPANSAO_KEYS.includes(key)) {
    const p = TAX_PROFILES.servico;
    return {
      ...base, pis: p.pis, cofins: p.cofins, iss: p.iss, icms: p.icms,
      presumidoIRPJ: p.presumidoIRPJ, presumidoCSLL: p.presumidoCSLL,
      tipoReceita: 'servico', perfilTributario: 'mix',
      taxSlices: [
        { profileKey: 'servico', pct: 10 },
        { profileKey: 'education', pct: 10 },
        { profileKey: 'ebook', pct: 80 },
      ],
    };
  }

  // ── Tax ──
  if (TAX_KEYS.includes(key)) {
    // Assessoria Tributária: Serviço (single profile)
    if (key === 'taxAT') {
      const p = TAX_PROFILES.servico;
      return {
        ...base, pis: p.pis, cofins: p.cofins, iss: p.iss, icms: p.icms,
        presumidoIRPJ: p.presumidoIRPJ, presumidoCSLL: p.presumidoCSLL,
        tipoReceita: 'servico', perfilTributario: 'servico',
      };
    }
    // All others: Mix Serviço 50% + E-book 50%
    const p = TAX_PROFILES.servico;
    return {
      ...base, pis: p.pis, cofins: p.cofins, iss: p.iss, icms: p.icms,
      presumidoIRPJ: p.presumidoIRPJ, presumidoCSLL: p.presumidoCSLL,
      tipoReceita: 'servico', perfilTributario: 'mix',
      taxSlices: [{ profileKey: 'servico', pct: 50 }, { profileKey: 'ebook', pct: 50 }],
    };
  }

  // Fallback: Serviço
  const p = TAX_PROFILES.servico;
  return {
    ...base, pis: p.pis, cofins: p.cofins, iss: p.iss, icms: p.icms,
    presumidoIRPJ: p.presumidoIRPJ, presumidoCSLL: p.presumidoCSLL,
    tipoReceita: 'servico', perfilTributario: 'servico',
  };
}

export function getSubProductTaxRate(key: TicketKey, assumptions: Assumptions): SubProductTaxConfig {
  return assumptions.subProductTaxRates?.[key] ?? getDefaultSubProductTaxConfig(key);
}

export type TicketKey = keyof Assumptions['tickets'];

// ─── COS CONFIG (Premissas de Custos Variáveis 3.1–3.6) ───

export interface CosConfig {
  // 3.1 Custos CaaS — Squad por clientes CaaS
  pfdClientsPerOne: number;    // Project Finance Director: 1 a cada N clientes CaaS
  pfdSalary: number;
  cfoClientsPerOne: number;    // CFO: 1 a cada N clientes CaaS
  cfoSalary: number;
  fpaClientsPerOne: number;    // FP&A Analyst: 1 a cada N clientes CaaS
  fpaSalary: number;

  // 3.2 Custos SaaS — Assinatura
  devSrClientsPerOne: number;  // Dev Senior: 1 a cada N clientes SaaS assinatura
  devSrSalary: number;
  csClientsPerOne: number;     // Customer Success: 1 a cada N clientes SaaS assinatura
  csSaaSalary: number;

  // 3.2 Setup — Squad por novos clientes/mês
  setupClientsPerSquad: number;      // 1 squad a cada N novos clientes/mês
  dataAnalystPerSquad: number;       // Data Analysts por squad
  dataAnalystSalary: number;
  processAnalystPerSquad: number;    // Process Analysts por squad
  processAnalystSalary: number;
  headDataClientsPerOne: number;     // Head of Data: 1 a cada N novos clientes/mês
  headDataSalary: number;

  // 3.3 Education — % da receita bruta
  eduCostRate: number;

  // 3.4 Customer Success — CX Analyst por clientes CaaS
  cxAnalystClientsPerOne: number;
  cxAnalystSalary: number;

  // 3.5 Expansão — % da receita bruta
  expansaoCostRate: number;

  // 3.6 Tax — % da receita bruta
  taxCostRate: number;
}

export const DEFAULT_COS_CONFIG: CosConfig = {
  // 3.1 CaaS
  pfdClientsPerOne: 100,
  pfdSalary: 30000,
  cfoClientsPerOne: 15,
  cfoSalary: 20000,
  fpaClientsPerOne: 7.5,
  fpaSalary: 8000,
  // 3.2 SaaS Assinatura
  devSrClientsPerOne: 100,
  devSrSalary: 10000,
  csClientsPerOne: 100,
  csSaaSalary: 5000,
  // 3.2 Setup
  setupClientsPerSquad: 32,
  dataAnalystPerSquad: 2,
  dataAnalystSalary: 8000,
  processAnalystPerSquad: 1,
  processAnalystSalary: 5000,
  headDataClientsPerOne: 64,
  headDataSalary: 15000,
  // 3.3 Education
  eduCostRate: 0.15,
  // 3.4 Customer Success
  cxAnalystClientsPerOne: 100,
  cxAnalystSalary: 5000,
  // 3.5 Expansão
  expansaoCostRate: 0.15,
  // 3.6 Tax
  taxCostRate: 0.15,
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  caasClients: { 2025: 167, 2026: 272, 2027: 768, 2028: 2136, 2029: 4171, 2030: 6472 },
  saasClients: { 2025: 226, 2026: 631, 2027: 2293, 2028: 7992, 2029: 19471, 2030: 37918 },
  educationClients: { 2025: 49, 2026: 145, 2027: 605, 2028: 2373, 2029: 5292, 2030: 9504 },
  taxClients: { 2025: 11, 2026: 41, 2027: 110, 2028: 280, 2029: 570, 2030: 1010 },
  subProductClients: {
    caasAssessoria:  { 2025: 21, 2026: 78, 2027: 188, 2028: 525, 2029: 1127, 2030: 1886 },
    caasEnterprise:  { 2025: 65, 2026: 130, 2027: 315, 2028: 879, 2029: 1887, 2030: 3157 },
    caasCorporate:   { 2025: 6, 2026: 15, 2027: 37, 2028: 104, 2029: 223, 2030: 373 },
    caasSetup:       { 2025: 75, 2026: 49, 2027: 228, 2028: 628, 2029: 934, 2030: 1056 },
    caasParceiros:   { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 },
    saasOxy:         { 2025: 55, 2026: 289, 2027: 936, 2028: 3358, 2029: 8177, 2030: 15709 },
    saasOxyGenio:    { 2025: 47, 2026: 186, 2027: 539, 2028: 1824, 2029: 4061, 2030: 7849 },
    saasSetup:       { 2025: 7, 2026: 25, 2027: 97, 2028: 361, 2029: 787, 2030: 1345 },
    saasParceiros:   { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 },
    saasOxyGenioEsp: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 },
    educationDonoCFO:{ 2025: 26, 2026: 101, 2027: 394, 2028: 1562, 2029: 3952, 2030: 7570 },
    educationEN:     { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 },
    educationFR:     { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 },
    educationFSP:    { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 },
    baas:            { 2025: 0, 2026: 0, 2027: 960, 2028: 6840, 2029: 25264, 2030: 65340 },
    baasFranquia:    { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 },
    baasMasterFranquia: { 2025: 0, 2026: 0, 2027: 0, 2028: 0, 2029: 0, 2030: 0 },
    taxAT:           { 2025: 5, 2026: 15, 2027: 40, 2028: 100, 2029: 200, 2030: 350 },
    taxGPT:          { 2025: 2, 2026: 8, 2027: 20, 2028: 50, 2029: 100, 2030: 180 },
    taxRCT:          { 2025: 3, 2026: 10, 2027: 25, 2028: 60, 2029: 120, 2030: 200 },
    taxRT:           { 2025: 1, 2026: 5, 2027: 15, 2028: 40, 2029: 80, 2030: 150 },
    taxDTC:          { 2025: 0, 2026: 3, 2027: 10, 2028: 30, 2029: 70, 2030: 130 },
  },
  tickets: {
    caasAssessoria: 2000,
    caasEnterprise: 9210,
    caasCorporate: 15570,
    caasSetup: 15000,
    caasParceiros: 0,
    saasOxy: 1297,
    saasOxyGenio: 1997,
    saasSetup: 15000,
    saasParceiros: 0,
    saasOxyGenioEsp: 0,
    educationDonoCFO: 397,
    educationEN: 7500,
    educationFR: 2997,
    educationFSP: 497,
    baas: 229,
    baasFranquia: 0,
    baasMasterFranquia: 0,
    taxAT: 5000,
    taxGPT: 3000,
    taxRCT: 4000,
    taxRT: 3500,
    taxDTC: 2500,
  },
  manualMonthlyClientOverrideFlags: {},
  churnCaas: 5,
  churnSaas: 5,
  churnBaas: 0,
  pmrConfig: { caas: 30, saas: 15, education: 30, baas: 0 },
  sgaPercent: 15,
  headcountGrowth: 10,
  headcountSalaries: {
    'CFOs': 8500,
    'PMO Directors': 12000,
    'Sales Team': 6000,
    'Tech Team': 9000,
    'Customer Service': 4500,
    'Operations': 5500,
  },
  sgaGrowthRate: 10,
  headcountRatios: {
    clientsPerCFO: 15,
    clientsPerFPA: 15,
    clientsPerPF: 100,
    clientsPerProjectAnal: 50,
    clientsPerDataAnal: 50,
    clientsPerCSM: 54,
    clientsPerSDR: 200,
    clientsPerCommercialHead: 500,
  },
  salaryRanges: {
    'Project Finance Director': 25000,
    'CFO': 15000,
    'FP&A Analyst': 5000,
    'Project Analyst': 3500,
    'Data Processes Analyst': 5000,
    'Customer Service': 4000,
    'Senior Fullstack': 8300,
    'Pleno Fullstack': 5500,
    'AI Engineer': 18000,
    'DevOps': 11500,
    'UX Designer': 8000,
    'PMO': 16000,
    'SDR': 4000,
    'Head Comercial': 12500,
  },
  // Item 4: Tax toggle (IRPJ/CSLL only — sales deductions ISS/PIS/COFINS always apply)
  taxEnabled: true,
  // Item 5: Marketing PR and Events (R$/month)
  marketingPR: 0,
  marketingEvents: 0,
  // Item 6: CAC per product
  cacPerProduct: {
    caasAssessoria: 11462,
    caasEnterprise: 11462,
    caasCorporate: 11462,
    caasSetup: 11462,
    saasOxy: 8766,
    saasOxyGenio: 8766,
    educationDonoCFO: 2046,
    baas: 2415,
    taxAT: 5000,
    taxGPT: 5000,
    taxRCT: 5000,
    taxRT: 5000,
    taxDTC: 5000,
  },
  // Item 8: legacy rate
  eduExpansaoTeamRate: 0.15,
  // Item 7: legacy Squad config
  squadConfig: {
    cfoSalary: 15000,
    cfoAnalistaSalary: 8000,
    cfoAnalistasPerSquad: 2,
    cfoClientsPerSquad: 15,
    csPerClients: 100,
    csSalary: 5000,
    setupAnalistaSalary: 8000,
    setupImplSalary: 8000,
    setupImplPerSquad: 2,
    setupSetupsPerSquad: 16,
    setupLiderSalary: 12000,
    setupSquadsPerLider: 2,
  },
  // COS Config (new)
  cosConfig: { ...DEFAULT_COS_CONFIG },
  // Editable Selic monthly rate (default 1.17%)
  selicMonthly: 0.0117,
  // Lucro Presumido — tax config per BU
  buTaxConfigs: [
    { buKey: 'caas',  tipoReceita: 'servico', aliquotaIss: 5 },
    { buKey: 'saas',  tipoReceita: 'servico', aliquotaIss: 2.9 },
    { buKey: 'setup', tipoReceita: 'servico', aliquotaIss: 2.9 },
  ],
};

// Base annual data (R$ thousands)
export const BASE_ANNUAL_DATA = {
  grossRevenue:     { 2025: 13777, 2026: 34250, 2027: 103707, 2028: 337072, 2029: 785967, 2030: 1460172 },
  netRevenue:       { 2025: 12447, 2026: 30945, 2027: 87892,  2028: 285669, 2029: 666107, 2030: 1237496 },
  grossProfit:      { 2025: 9679,  2026: 23643, 2027: 68276,  2028: 229690, 2029: 540218, 2030: 1010705 },
  ebitda:           { 2025: 1360,  2026: 7136,  2027: 6605,   2028: 18606,  2029: 41855,  2030: 118380  },
  netIncome:        { 2025: -174,  2026: 3409,  2027: 4357,   2028: 12268,  2029: 27589,  2030: 78046   },
  operatingCashFlow:{ 2025: -730,  2026: 2216,  2027: 2878,   2028: 9173,   2029: 21896,  2030: 68736   },
};

export const TOTAL_CLIENTS: Record<Year, number> = {
  2025: 442, 2026: 1048, 2027: 5439, 2028: 23634, 2029: 66172, 2030: 143059
};

export const GROSS_MARGINS: Record<Year, number> = {
  2025: 77.8, 2026: 76.4, 2027: 77.7, 2028: 80.4, 2029: 81.1, 2030: 81.7
};

export const NET_MARGINS: Record<Year, number> = {
  2025: -1.4, 2026: 11.0, 2027: 5.0, 2028: 4.3, 2029: 4.1, 2030: 6.3
};

export type Scenario = 'BASE' | 'BULL' | 'BEAR';

export type PeriodPreset = 'all' | '3y' | '5y' | 'historical' | 'projected';
export type DataSource = 'model' | 'actual' | 'blended';

export const HISTORICAL_CUTOFF_YEAR = 2025;

export interface PmrConfig {
  caas: number;   // days receivable outstanding — CaaS
  saas: number;   // days receivable outstanding — SaaS
  education: number;
  baas: number;
}

export const DEFAULT_PMR: PmrConfig = {
  caas: 30,
  saas: 15,
  education: 30,
  baas: 0,
};

export const SCENARIO_MULTIPLIERS: Record<Scenario, number> = {
  BASE: 1.0,
  BULL: 1.20,
  BEAR: 0.80,
};

export interface ProjectionData {
  grossRevenue: Record<Year, number>;
  netRevenue: Record<Year, number>;
  grossProfit: Record<Year, number>;
  ebitda: Record<Year, number>;
  netIncome: Record<Year, number>;
  operatingCashFlow: Record<Year, number>;
  totalClients: Record<Year, number>;
  grossMargins: Record<Year, number>;
  netMargins: Record<Year, number>;
}

export function calculateProjections(
  assumptions: Assumptions,
  scenario: Scenario
): ProjectionData {
  const multiplier = SCENARIO_MULTIPLIERS[scenario];
  
  // Scale revenue based on client changes relative to defaults
  const projections: ProjectionData = {
    grossRevenue: {} as Record<Year, number>,
    netRevenue: {} as Record<Year, number>,
    grossProfit: {} as Record<Year, number>,
    ebitda: {} as Record<Year, number>,
    netIncome: {} as Record<Year, number>,
    operatingCashFlow: {} as Record<Year, number>,
    totalClients: {} as Record<Year, number>,
    grossMargins: {} as Record<Year, number>,
    netMargins: {} as Record<Year, number>,
  };

  for (const year of YEARS) {
    const clientRatio = (
      (assumptions.caasClients[year] + assumptions.saasClients[year] + assumptions.educationClients[year] + (assumptions.taxClients?.[year] ?? 0)) /
      (DEFAULT_ASSUMPTIONS.caasClients[year] + DEFAULT_ASSUMPTIONS.saasClients[year] + DEFAULT_ASSUMPTIONS.educationClients[year] + (DEFAULT_ASSUMPTIONS.taxClients?.[year] ?? 0))
    );

    const revenueScale = clientRatio * multiplier;

    projections.grossRevenue[year] = Math.round(BASE_ANNUAL_DATA.grossRevenue[year] * revenueScale);
    projections.netRevenue[year] = Math.round(BASE_ANNUAL_DATA.netRevenue[year] * revenueScale);
    projections.grossProfit[year] = Math.round(BASE_ANNUAL_DATA.grossProfit[year] * revenueScale);
    projections.ebitda[year] = Math.round(BASE_ANNUAL_DATA.ebitda[year] * revenueScale);
    projections.netIncome[year] = Math.round(BASE_ANNUAL_DATA.netIncome[year] * revenueScale);
    projections.operatingCashFlow[year] = Math.round(BASE_ANNUAL_DATA.operatingCashFlow[year] * revenueScale);
    projections.totalClients[year] = assumptions.caasClients[year] + assumptions.saasClients[year] + assumptions.educationClients[year] + (assumptions.taxClients?.[year] ?? 0);
    projections.grossMargins[year] = GROSS_MARGINS[year];
    projections.netMargins[year] = NET_MARGINS[year];
  }

  return projections;
}



export const SUB_PRODUCT_LABELS: Record<keyof SubProductClients, string> = {
  caasAssessoria: 'Serviços Especializados',
  caasEnterprise: 'Enterprise',
  caasCorporate: 'Corporate',
  caasSetup: 'BPO Financeiro',
  caasParceiros: 'Parceiros',
  saasOxy: 'Oxy',
  saasOxyGenio: 'Oxy + Gênio',
  saasSetup: 'Setup',
  saasParceiros: 'Parceiros',
  saasOxyGenioEsp: 'Oxy + Gênio + Especialista',
  educationDonoCFO: 'Dono CFO',
  educationEN: 'Engenheiro de Negócios',
  educationFR: 'Financeiro Raiz',
  educationFSP: 'Finance Sales Program',
  baas: 'Oxy Hacker',
  baasFranquia: 'Franquia',
  baasMasterFranquia: 'Master Franquia',
  taxAT: 'Assessoria Tributária',
  taxGPT: 'Gestão Passivo Tributário',
  taxRCT: 'Recuperação Crédito Tributário',
  taxRT: 'Reforma Tributária',
  taxDTC: 'Diagnóstico Tributário & Compliance',
};

// ─── HEADCOUNT (derived from namedEmployees2025) ───
import { namedEmployees2025 } from '@/data/modelData';

interface HeadcountRow {
  role: string;
  bu: string;
  [key: number]: number;
}

function buildHeadcount(): HeadcountRow[] {
  const grouped = new Map<string, { role: string; bu: string; count: number }>();
  for (const emp of namedEmployees2025) {
    const key = `${emp.role}|${emp.bu}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(key, { role: emp.role, bu: emp.bu, count: 1 });
    }
  }
  return Array.from(grouped.values()).map(({ role, bu, count }) => {
    const row: HeadcountRow = { role, bu };
    for (const y of YEARS) {
      row[y] = y === 2025 ? count : count; // future years start at same base; engine scales dynamically
    }
    return row;
  });
}

export const HEADCOUNT = buildHeadcount();

// ─── Date Range / Period Filter ────────────────────────────────────────────────

export interface DateRange {
  startYear: number;
  endYear: number;
}

/**
 * Returns the subset of YEARS that fall within the given DateRange.
 * Falls back to all YEARS if the range is undefined or yields no results.
 */
export function getFilteredYears(range: DateRange | undefined): Year[] {
  if (!range) return [...YEARS];
  const filtered = YEARS.filter(y => y >= range.startYear && y <= range.endYear);
  return filtered.length > 0 ? filtered : [...YEARS];
}

/**
 * Returns true if the given year falls within the DateRange.
 * If range is undefined, all years are considered in-range.
 */
export function isYearInRange(year: number, range: DateRange | undefined): boolean {
  if (!range) return true;
  return year >= range.startYear && year <= range.endYear;
}
