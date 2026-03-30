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

  it('has sub-product clients for all products × 6 years', () => {
    const products = Object.keys(a.subProductClients) as (keyof typeof a.subProductClients)[];
    expect(products.length).toBeGreaterThanOrEqual(8);
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
    // Squad CFO
    expect(sq.cfoSalary).toBe(15000);
    expect(sq.cfoAnalistaSalary).toBe(8000);
    expect(sq.cfoAnalistasPerSquad).toBe(2);
    expect(sq.cfoClientsPerSquad).toBe(15);
    // CS
    expect(sq.csPerClients).toBe(100);
    expect(sq.csSalary).toBe(5000);
    // Squad Setup SaaS
    expect(sq.setupAnalistaSalary).toBe(8000);
    expect(sq.setupImplSalary).toBe(8000);
    expect(sq.setupImplPerSquad).toBe(2);
    expect(sq.setupSetupsPerSquad).toBe(16);
    // Líder Setup
    expect(sq.setupLiderSalary).toBe(12000);
    expect(sq.setupSquadsPerLider).toBe(2);
  });

  it('cosConfig has all required fields with correct defaults', () => {
    const cos = a.cosConfig!;
    expect(cos.pfdClientsPerOne).toBe(100);
    expect(cos.pfdSalary).toBe(30000);
    expect(cos.cfoClientsPerOne).toBe(15);
    expect(cos.cfoSalary).toBe(20000);
    expect(cos.fpaClientsPerOne).toBe(7.5);
    expect(cos.fpaSalary).toBe(8000);
    expect(cos.eduCostRate).toBe(0.15);
    expect(cos.expansaoCostRate).toBe(0.15);
    expect(cos.taxCostRate).toBe(0.15);
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
