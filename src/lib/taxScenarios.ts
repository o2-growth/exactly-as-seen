/**
 * Tax Scenarios Catalog
 *
 * Pre-defined tax scenarios extracted from `Simulador_Tributario_O2.xlsx`
 * (tab `Mapeamento`, rows 4-48). 45 scenarios across 22 subcategories in 5 categories.
 *
 * Each scenario is a named combination of tax profile slices (e.g., "P1 50% + P6 50%")
 * that represents a specific fiscal optimization strategy.
 *
 * The P1..P8 IDs come from the Excel's perfil catalog (`Premissas` tab) and are mapped
 * to the existing TAX_PROFILES keys from financialData.ts:
 *
 * - P1 CaaS/Tax           → servico       (32/32, 0.65/3, 5% ISS)
 * - P2 Franquia           → servico       (same rates; semantic alias)
 * - P3 SaaS Tech          → saasTech      (32/32, 0.65/3, 2.9% ISS)
 * - P4 Education          → education     (32/32, 0.65/3, 2% ISS)
 * - P5 Cessão de Direitos → servico       (same rates; semantic alias)
 * - P6 E-book             → ebook         (8/12, 0.65/3, 0% ISS)
 * - P7 Material Didático  → matDidatico   (8/12, 0/0, 0% ISS)
 * - P8 Livro Físico       → livroFisico   (8/12, 0/0, 0% ISS)
 */

import { TaxSlice } from './financialData';

export type TaxCategory = 'CaaS' | 'SaaS' | 'Education' | 'Expansão' | 'Tax';

export interface TaxScenario {
  /** Unique id, e.g., 'caas-servicos-puro' */
  id: string;
  /** Top-level category */
  category: TaxCategory;
  /** Subcategory label (human-readable, matches Excel) */
  subcategory: string;
  /** Optional mapping to the financial model's subproduct key (TicketKey) */
  subProductKey?: string;
  /** Scenario name (e.g., "Puro — CaaS", "Blend CaaS + E-book (50/50)") */
  label: string;
  /** Composition: array of tax slices (pct in 0..1, sums to 1) */
  composition: TaxSlice[];
  /** Excel-style composition string for display (e.g., "P1 50% + P6 50%") */
  compositionString: string;
}

/**
 * Mapping from Excel perfil ID (P1..P8) to the financial model's profile key.
 */
export const P_PROFILE_MAP: Record<string, string> = {
  P1: 'servico',
  P2: 'servico',
  P3: 'saasTech',
  P4: 'education',
  P5: 'servico',
  P6: 'ebook',
  P7: 'matDidatico',
  P8: 'livroFisico',
};

/**
 * Mapping from Excel subcategory labels to the financial model's subproduct keys.
 */
export const SUBCATEGORY_TO_SUBPRODUCT_KEY: Record<string, string> = {
  'Serviços Especializados': 'caasAssessoria',
  'Enterprise': 'caasEnterprise',
  'Corporate': 'caasCorporate',
  'Parceiros': 'caasParceiros', // CaaS Parceiros; disambiguated by category
  'BPO Financeiro': 'caasSetup',
  'Oxy': 'saasOxy',
  'Oxy + Gênio': 'saasOxyGenio',
  'Oxy + Gênio + Especialista': 'saasOxyGenioEsp',
  'Setup': 'saasSetup',
  'Dono CFO': 'educationDonoCFO',
  'Engenheiro de Negócios': 'educationEN',
  'Financeiro Raiz': 'educationFR',
  'Finance Sales Program': 'educationFSP',
  'Oxy Hacker - Micro Franqueado': 'baas',
  'Franquia': 'baasFranquia',
  'Master Franquia': 'baasMasterFranquia',
  'Assessoria Tributária': 'taxAT',
  'Gestão Passivo Tributário': 'taxGPT',
  'Recuperação Crédito Tributário': 'taxRCT',
  'Reforma Tributária': 'taxRT',
  'Diagnóstico Tributário & Compliance': 'taxDTC',
};

/**
 * Resolve the subproduct key for a given (category, subcategory) pair.
 * Handles the "Parceiros" ambiguity (CaaS Parceiros vs SaaS Parceiros).
 */
function resolveSubProductKey(category: TaxCategory, subcategory: string): string | undefined {
  if (subcategory === 'Parceiros') {
    return category === 'CaaS' ? 'caasParceiros' : 'saasParceiros';
  }
  return SUBCATEGORY_TO_SUBPRODUCT_KEY[subcategory];
}

/**
 * Helper to build a scenario from a compact "P1 50% + P6 50%" string.
 */
function parseComposition(compositionString: string): TaxSlice[] {
  const parts = compositionString.split('+').map(p => p.trim());
  const slices: TaxSlice[] = [];
  for (const part of parts) {
    const match = part.match(/^(P\d)\s+(\d+(?:\.\d+)?)%?$/);
    if (!match) continue;
    const [, pId, pctStr] = match;
    const profileKey = P_PROFILE_MAP[pId];
    if (!profileKey) continue;
    slices.push({ profileKey, pct: parseFloat(pctStr) / 100 });
  }
  return slices;
}

/**
 * Builds a scenario id from category + subcategory + label.
 */
function buildScenarioId(category: TaxCategory, subcategory: string, label: string): string {
  const slug = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  return `${slug(category)}-${slug(subcategory)}-${slug(label)}`;
}

/**
 * The 45 pre-defined scenarios from the Excel (tab Mapeamento).
 */
const RAW_SCENARIOS: Array<[TaxCategory, string, string, string]> = [
  // CaaS
  ['CaaS', 'Serviços Especializados', 'Puro — CaaS', 'P1 100%'],
  ['CaaS', 'Serviços Especializados', 'Blend CaaS + E-book (50/50)', 'P1 50% + P6 50%'],
  ['CaaS', 'Serviços Especializados', 'Blend CaaS + Material Didático (20/80)', 'P1 20% + P7 80%'],
  ['CaaS', 'Enterprise', 'Puro — CaaS', 'P1 100%'],
  ['CaaS', 'Enterprise', 'Blend CaaS + E-book (50/50)', 'P1 50% + P6 50%'],
  ['CaaS', 'Enterprise', 'Blend CaaS + Material Didático (20/80)', 'P1 20% + P7 80%'],
  ['CaaS', 'Corporate', 'Puro — CaaS', 'P1 100%'],
  ['CaaS', 'Corporate', 'Blend CaaS + E-book (50/50)', 'P1 50% + P6 50%'],
  ['CaaS', 'Corporate', 'Blend CaaS + Material Didático (20/80)', 'P1 20% + P7 80%'],
  ['CaaS', 'Parceiros', 'Puro — CaaS', 'P1 100%'],
  ['CaaS', 'Parceiros', 'Blend CaaS + E-book (50/50)', 'P1 50% + P6 50%'],
  ['CaaS', 'BPO Financeiro', 'Puro — CaaS', 'P1 100%'],
  // SaaS
  ['SaaS', 'Oxy', 'Puro — SaaS Tech', 'P3 100%'],
  ['SaaS', 'Oxy', 'Blend Tech + E-book (20/80)', 'P3 20% + P6 80%'],
  ['SaaS', 'Oxy', 'Blend Tech + Material Didático (20/80)', 'P3 20% + P7 80%'],
  ['SaaS', 'Oxy + Gênio', 'Puro — SaaS Tech', 'P3 100%'],
  ['SaaS', 'Oxy + Gênio', 'Blend Tech + E-book (20/80)', 'P3 20% + P6 80%'],
  ['SaaS', 'Setup', 'Puro — SaaS Tech', 'P3 100%'],
  ['SaaS', 'Parceiros', 'Puro — SaaS Tech', 'P3 100%'],
  ['SaaS', 'Oxy + Gênio + Especialista', 'Puro — SaaS Tech', 'P3 100%'],
  ['SaaS', 'Oxy + Gênio + Especialista', 'Blend Tech + E-book (20/80)', 'P3 20% + P6 80%'],
  ['SaaS', 'Oxy + Gênio + Especialista', 'Triplo Tech + Cessão + E-book (10/20/70)', 'P3 10% + P5 20% + P6 70%'],
  // Education
  ['Education', 'Dono CFO', 'Puro — Education', 'P4 100%'],
  ['Education', 'Dono CFO', 'Blend Cessão + E-book (20/80)', 'P5 20% + P6 80%'],
  ['Education', 'Dono CFO', 'Blend Cessão + Material Didático (20/80)', 'P5 20% + P7 80%'],
  ['Education', 'Dono CFO', 'Blend Tech + E-book (20/80)', 'P3 20% + P6 80%'],
  ['Education', 'Dono CFO', 'Triplo Education + Cessão + E-book (20/20/60)', 'P4 20% + P5 20% + P6 60%'],
  ['Education', 'Engenheiro de Negócios', 'Puro — Education', 'P4 100%'],
  ['Education', 'Engenheiro de Negócios', 'Blend Cessão + E-book (20/80)', 'P5 20% + P6 80%'],
  ['Education', 'Engenheiro de Negócios', 'Blend Cessão + Material Didático (20/80)', 'P5 20% + P7 80%'],
  ['Education', 'Financeiro Raiz', 'Puro — Education', 'P4 100%'],
  ['Education', 'Financeiro Raiz', 'Blend Cessão + E-book (20/80)', 'P5 20% + P6 80%'],
  ['Education', 'Financeiro Raiz', 'Blend Cessão + Material Didático (20/80)', 'P5 20% + P7 80%'],
  ['Education', 'Finance Sales Program', 'Puro — Education', 'P4 100%'],
  ['Education', 'Finance Sales Program', 'Blend Cessão + E-book (20/80)', 'P5 20% + P6 80%'],
  // Expansão
  ['Expansão', 'Oxy Hacker - Micro Franqueado', 'Puro — Franquia', 'P2 100%'],
  ['Expansão', 'Franquia', 'Puro — Franquia', 'P2 100%'],
  ['Expansão', 'Franquia', 'Blend Franquia + Material Didático (20/80)', 'P2 20% + P7 80%'],
  ['Expansão', 'Master Franquia', 'Puro — Franquia', 'P2 100%'],
  ['Expansão', 'Master Franquia', 'Blend Franquia + Material Didático (20/80)', 'P2 20% + P7 80%'],
  // Tax
  ['Tax', 'Assessoria Tributária', 'Puro — CaaS/Tax', 'P1 100%'],
  ['Tax', 'Gestão Passivo Tributário', 'Puro — CaaS/Tax', 'P1 100%'],
  ['Tax', 'Recuperação Crédito Tributário', 'Puro — CaaS/Tax', 'P1 100%'],
  ['Tax', 'Reforma Tributária', 'Puro — CaaS/Tax', 'P1 100%'],
  ['Tax', 'Diagnóstico Tributário & Compliance', 'Puro — CaaS/Tax', 'P1 100%'],
];

export const TAX_SCENARIOS: TaxScenario[] = RAW_SCENARIOS.map(
  ([category, subcategory, label, compositionString]) => ({
    id: buildScenarioId(category, subcategory, label),
    category,
    subcategory,
    subProductKey: resolveSubProductKey(category, subcategory),
    label,
    composition: parseComposition(compositionString),
    compositionString,
  })
);

// ─── Query helpers ───

export const TAX_CATEGORIES: TaxCategory[] = ['CaaS', 'SaaS', 'Education', 'Expansão', 'Tax'];

/**
 * All subcategories in a given category (from the scenarios catalog).
 */
export function getSubcategoriesForCategory(category: TaxCategory): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const sc of TAX_SCENARIOS) {
    if (sc.category === category && !seen.has(sc.subcategory)) {
      seen.add(sc.subcategory);
      result.push(sc.subcategory);
    }
  }
  return result;
}

/**
 * All scenarios for a given (category, subcategory) pair.
 */
export function getScenariosForSubcategory(category: TaxCategory, subcategory: string): TaxScenario[] {
  return TAX_SCENARIOS.filter(sc => sc.category === category && sc.subcategory === subcategory);
}

/**
 * Find a scenario by id.
 */
export function findScenarioById(id: string): TaxScenario | undefined {
  return TAX_SCENARIOS.find(sc => sc.id === id);
}

/**
 * All unique subcategories across all categories (flat list).
 */
export function getAllSubcategories(): Array<{ category: TaxCategory; subcategory: string; subProductKey?: string }> {
  const seen = new Set<string>();
  const result: Array<{ category: TaxCategory; subcategory: string; subProductKey?: string }> = [];
  for (const sc of TAX_SCENARIOS) {
    const key = `${sc.category}|${sc.subcategory}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({
        category: sc.category,
        subcategory: sc.subcategory,
        subProductKey: sc.subProductKey,
      });
    }
  }
  return result;
}
