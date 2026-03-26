/**
 * Period Resolution — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  getYearDataSource, getRangeDataSource, getSourceLabel, getFocalYear,
} from '@/lib/periodResolution';
import { Year } from '@/lib/financialData';

describe('getYearDataSource', () => {
  it('2025 is actual (12 months historical)', () => {
    expect(getYearDataSource(2025)).toBe('actual');
  });

  it('2026 is mixed (partial historical)', () => {
    expect(getYearDataSource(2026)).toBe('mixed');
  });

  it('2027+ are projected', () => {
    expect(getYearDataSource(2027)).toBe('projected');
    expect(getYearDataSource(2030)).toBe('projected');
  });
});

describe('getRangeDataSource', () => {
  it('all projected years returns projected', () => {
    expect(getRangeDataSource([2027, 2028, 2029] as Year[])).toBe('projected');
  });

  it('mixed years returns mixed', () => {
    expect(getRangeDataSource([2025, 2026, 2027] as Year[])).toBe('mixed');
  });

  it('single actual year returns actual', () => {
    expect(getRangeDataSource([2025] as Year[])).toBe('actual');
  });
});

describe('getSourceLabel', () => {
  it('returns correct Portuguese labels', () => {
    expect(getSourceLabel('actual')).toBe('Realizado');
    expect(getSourceLabel('mixed')).toBe('Combinado');
    expect(getSourceLabel('projected')).toBe('Projetado');
  });
});

describe('getFocalYear', () => {
  it('returns last year with historical data', () => {
    const focal = getFocalYear([2025, 2026, 2027, 2028] as Year[]);
    expect(focal).toBe(2026); // 2026 has Jan-Mar historical
  });

  it('returns first year when no history', () => {
    expect(getFocalYear([2027, 2028, 2029] as Year[])).toBe(2027);
  });
});
