/**
 * Model Data — Unit Tests
 * Validates raw data integrity from the Excel model.
 */
import { describe, it, expect } from 'vitest';
import {
  clientsBase2025, avgTicket, churnAnnual, salesDeductionsByYear,
  cogsMonthly2025, commissionRate, cacPerClient, debtSchedule,
  namedEmployees2025, salaryRanges, headcountRatios, taxRates,
  benefitsMonthly2025, basePayroll2025, expectedOutputs,
} from '@/data/modelData';

describe('Model Data: Client base 2025', () => {
  it('CaaS has 4 product lines with 12 months each', () => {
    expect(clientsBase2025.caas.assessoria).toHaveLength(12);
    expect(clientsBase2025.caas.enterprise).toHaveLength(12);
    expect(clientsBase2025.caas.corporate).toHaveLength(12);
    expect(clientsBase2025.caas.setup).toHaveLength(12);
  });

  it('SaaS has product lines with 12 months', () => {
    expect(clientsBase2025.saas.oxy).toHaveLength(12);
    expect(clientsBase2025.saas.oxyGenio).toHaveLength(12);
  });

  it('client counts are non-negative', () => {
    for (const month of clientsBase2025.caas.enterprise) {
      expect(month).toBeGreaterThanOrEqual(0);
    }
  });

  it('enterprise clients grow through 2025', () => {
    const ent = clientsBase2025.caas.enterprise;
    expect(ent[11]).toBeGreaterThan(ent[0]);
  });
});

describe('Model Data: Average tickets', () => {
  it('all tickets are positive', () => {
    expect(avgTicket.caas.assessoria).toBeGreaterThan(0);
    expect(avgTicket.caas.enterprise).toBeGreaterThan(0);
    expect(avgTicket.saas.oxy).toBeGreaterThan(0);
    expect(avgTicket.education.donoCfo).toBeGreaterThan(0);
    expect(avgTicket.baas.assinatura).toBeGreaterThan(0);
  });
});

describe('Model Data: Churn rates', () => {
  it('churn rates are between 0 and 1', () => {
    expect(churnAnnual.caas).toBeGreaterThanOrEqual(0);
    expect(churnAnnual.caas).toBeLessThanOrEqual(1);
    expect(churnAnnual.saas).toBeGreaterThanOrEqual(0);
    expect(churnAnnual.saas).toBeLessThanOrEqual(1);
  });
});

describe('Model Data: Sales deductions', () => {
  it('Lucro Presumido rate for 2025-2026', () => {
    expect(salesDeductionsByYear[2025]).toBeCloseTo(0.0965, 4);
    expect(salesDeductionsByYear[2026]).toBeCloseTo(0.0965, 4);
  });

  it('Lucro Real rate for 2027+', () => {
    expect(salesDeductionsByYear[2027]).toBeCloseTo(0.1525, 4);
    expect(salesDeductionsByYear[2030]).toBeCloseTo(0.1525, 4);
  });
});

describe('Model Data: COGS 2025', () => {
  it('all COGS arrays have 12 months', () => {
    expect(cogsMonthly2025.caas).toHaveLength(12);
    expect(cogsMonthly2025.customerService).toHaveLength(12);
    expect(cogsMonthly2025.saas).toHaveLength(12);
  });

  it('COGS values are non-positive (costs)', () => {
    for (const val of cogsMonthly2025.caas) {
      expect(val).toBeLessThanOrEqual(0);
    }
  });
});

describe('Model Data: Commission rates', () => {
  it('all commission rates are 3%', () => {
    expect(commissionRate.caas).toBe(0.03);
    expect(commissionRate.saas).toBe(0.03);
    expect(commissionRate.education).toBe(0.03);
  });
});

describe('Model Data: CAC per client', () => {
  it('all CAC values are positive', () => {
    expect(cacPerClient.caas).toBeGreaterThan(0);
    expect(cacPerClient.saas).toBeGreaterThan(0);
    expect(cacPerClient.education).toBeGreaterThan(0);
    expect(cacPerClient.baas).toBeGreaterThan(0);
  });

  it('CaaS has highest CAC', () => {
    expect(cacPerClient.caas).toBeGreaterThan(cacPerClient.saas);
    expect(cacPerClient.caas).toBeGreaterThan(cacPerClient.education);
  });
});

describe('Model Data: Tax rates', () => {
  it('IRPJ is 25%, CSLL is 9%', () => {
    expect(taxRates.irpj).toBe(0.25);
    expect(taxRates.csll).toBe(0.09);
  });

  it('combined EBT rate is 34%', () => {
    expect(taxRates.combinedEBT).toBe(0.34);
  });
});

describe('Model Data: Debt schedule', () => {
  it('has multiple debt items', () => {
    expect(debtSchedule.length).toBeGreaterThan(0);
  });

  it('each debt has required fields', () => {
    for (const d of debtSchedule) {
      expect(d.name).toBeTruthy();
      expect(d.outstanding).toBeGreaterThan(0);
      expect(d.monthlyPayment).toBeGreaterThan(0);
      expect(d.remainingInstallments).toBeGreaterThan(0);
    }
  });
});

describe('Model Data: Employees', () => {
  it('has named employees', () => {
    expect(namedEmployees2025.length).toBeGreaterThan(20);
  });

  it('all employees have salary > 0', () => {
    for (const e of namedEmployees2025) {
      expect(e.salary).toBeGreaterThan(0);
    }
  });

  it('base payroll 2025 is sum of code 5.01 salaries', () => {
    const sum = namedEmployees2025
      .filter(e => e.costCode === '5.01')
      .reduce((s, e) => s + e.salary, 0);
    expect(basePayroll2025).toBe(sum);
  });
});

describe('Model Data: Benefits 2025', () => {
  it('has 12 months', () => {
    expect(benefitsMonthly2025).toHaveLength(12);
  });

  it('benefits grow through the year', () => {
    expect(benefitsMonthly2025[11]).toBeGreaterThan(benefitsMonthly2025[0]);
  });
});

describe('Model Data: Expected outputs', () => {
  it('gross revenue grows each year', () => {
    for (let i = 1; i < 6; i++) {
      const years = [2025, 2026, 2027, 2028, 2029, 2030];
      expect(expectedOutputs.grossRevenue[years[i]]).toBeGreaterThan(
        expectedOutputs.grossRevenue[years[i - 1]]
      );
    }
  });

  it('2025 gross revenue is ~13.8M (R$ thousands)', () => {
    expect(expectedOutputs.grossRevenue[2025]).toBeCloseTo(13777, -1);
  });

  it('2030 gross revenue is ~1.46B (R$ thousands)', () => {
    expect(expectedOutputs.grossRevenue[2030]).toBeCloseTo(1460172, -2);
  });
});
