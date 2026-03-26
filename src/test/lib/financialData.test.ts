/**
 * Financial Data Types & Defaults — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ASSUMPTIONS, YEARS, Assumptions, Year, TicketKey,
  SCENARIO_MULTIPLIERS, DEFAULT_PMR, getFilteredYears, isYearInRange,
} from '@/lib/financialData';

describe('Financial Data: Constants', () => {
  it('YEARS contains 2025-2030', () => {
    expect(YEARS).toEqual([2025, 2026, 2027, 2028, 2029, 2030]);
  });

  it('SCENARIO_MULTIPLIERS has correct values', () => {
    expect(SCENARIO_MULTIPLIERS.BASE).toBe(1.0);
    expect(SCENARIO_MULTIPLIERS.BULL).toBe(1.20);
    expect(SCENARIO_MULTIPLIERS.BEAR).toBe(0.80);
  });

  it('DEFAULT_PMR has correct values', () => {
    expect(DEFAULT_PMR.caas).toBe(30);
    expect(DEFAULT_PMR.saas).toBe(15);
    expect(DEFAULT_PMR.education).toBe(30);
    expect(DEFAULT_PMR.baas).toBe(0);
  });
});

describe('Financial Data: Default Assumptions', () => {
  const a = DEFAULT_ASSUMPTIONS;

  it('has client projections for all years', () => {
    for (const y of YEARS) {
      expect(a.caasClients[y]).toBeGreaterThanOrEqual(0);
      expect(a.saasClients[y]).toBeGreaterThanOrEqual(0);
      expect(a.educationClients[y]).toBeGreaterThanOrEqual(0);
    }
  });

  it('client counts grow each year', () => {
    for (let i = 1; i < YEARS.length; i++) {
      expect(a.caasClients[YEARS[i]]).toBeGreaterThan(a.caasClients[YEARS[i - 1]]);
      expect(a.saasClients[YEARS[i]]).toBeGreaterThan(a.saasClients[YEARS[i - 1]]);
    }
  });

  it('has all 8 ticket values', () => {
    const keys: TicketKey[] = [
      'caasAssessoria', 'caasEnterprise', 'caasCorporate', 'caasSetup',
      'saasOxy', 'saasOxyGenio', 'educationDonoCFO', 'baas',
    ];
    for (const k of keys) {
      expect(a.tickets[k]).toBeGreaterThan(0);
    }
  });

  it('has sub-product clients for all 8 products × 6 years', () => {
    const products = Object.keys(a.subProductClients) as (keyof typeof a.subProductClients)[];
    expect(products).toHaveLength(8);
    for (const p of products) {
      for (const y of YEARS) {
        expect(typeof a.subProductClients[p][y]).toBe('number');
      }
    }
  });

  it('churn rates are reasonable (0-20%)', () => {
    expect(a.churnCaas).toBeGreaterThanOrEqual(0);
    expect(a.churnCaas).toBeLessThanOrEqual(20);
    expect(a.churnSaas).toBeGreaterThanOrEqual(0);
    expect(a.churnSaas).toBeLessThanOrEqual(20);
    expect(a.churnBaas).toBeGreaterThanOrEqual(0);
    expect(a.churnBaas).toBeLessThanOrEqual(20);
  });

  // ─── Brownfield fields ───

  it('taxEnabled defaults to true', () => {
    expect(a.taxEnabled).toBe(true);
  });

  it('marketingPR and marketingEvents default to 0', () => {
    expect(a.marketingPR).toBe(0);
    expect(a.marketingEvents).toBe(0);
  });

  it('cacPerProduct has all 8 products with positive values', () => {
    const cac = a.cacPerProduct!;
    expect(cac.caasAssessoria).toBeGreaterThan(0);
    expect(cac.saasOxy).toBeGreaterThan(0);
    expect(cac.educationDonoCFO).toBeGreaterThan(0);
    expect(cac.baas).toBeGreaterThan(0);
  });

  it('eduExpansaoTeamRate defaults to 15%', () => {
    expect(a.eduExpansaoTeamRate).toBe(0.15);
  });

  it('squadConfig has all required fields', () => {
    const sq = a.squadConfig!;
    expect(sq.diretorSalary).toBeGreaterThan(0);
    expect(sq.cfoOperacaoSalary).toBeGreaterThan(0);
    expect(sq.analistaSalary).toBeGreaterThan(0);
    expect(sq.numAnalistas).toBeGreaterThanOrEqual(1);
    expect(sq.csPerClients).toBeGreaterThan(0);
    expect(sq.csSalary).toBeGreaterThan(0);
    expect(sq.saasSquadImpl).toBeGreaterThanOrEqual(1);
    expect(sq.saasSquadLider).toBeGreaterThanOrEqual(1);
    expect(sq.sparePerAnalyst).toBeGreaterThan(0);
  });

  it('headcountRatios are all positive', () => {
    const r = a.headcountRatios;
    expect(r.clientsPerCFO).toBeGreaterThan(0);
    expect(r.clientsPerFPA).toBeGreaterThan(0);
    expect(r.clientsPerPF).toBeGreaterThan(0);
    expect(r.clientsPerProjectAnal).toBeGreaterThan(0);
    expect(r.clientsPerDataAnal).toBeGreaterThan(0);
    expect(r.clientsPerCSM).toBeGreaterThan(0);
    expect(r.clientsPerSDR).toBeGreaterThan(0);
    expect(r.clientsPerCommercialHead).toBeGreaterThan(0);
  });

  it('salary ranges are all positive', () => {
    for (const [role, salary] of Object.entries(a.salaryRanges)) {
      expect(salary).toBeGreaterThan(0);
    }
  });
});

describe('Financial Data: Period filtering', () => {
  it('getFilteredYears returns all years when no range', () => {
    expect(getFilteredYears(undefined)).toEqual([...YEARS]);
  });

  it('getFilteredYears filters correctly', () => {
    expect(getFilteredYears({ startYear: 2027, endYear: 2029 })).toEqual([2027, 2028, 2029]);
  });

  it('getFilteredYears falls back to all years on empty result', () => {
    expect(getFilteredYears({ startYear: 2040, endYear: 2050 })).toEqual([...YEARS]);
  });

  it('isYearInRange works correctly', () => {
    expect(isYearInRange(2025, undefined)).toBe(true);
    expect(isYearInRange(2025, { startYear: 2025, endYear: 2027 })).toBe(true);
    expect(isYearInRange(2028, { startYear: 2025, endYear: 2027 })).toBe(false);
  });
});
