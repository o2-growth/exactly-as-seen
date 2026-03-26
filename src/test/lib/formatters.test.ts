/**
 * Formatters — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCurrencyFull, formatPercent, formatNumber } from '@/lib/formatters';

describe('formatCurrency', () => {
  it('formats billions', () => {
    expect(formatCurrency(1_500_000_000)).toBe('R$ 1.50B');
    expect(formatCurrency(-2_000_000_000)).toBe('-R$ 2.00B');
  });

  it('formats millions', () => {
    expect(formatCurrency(13_777_000)).toBe('R$ 13.8MM');
    expect(formatCurrency(-5_500_000)).toBe('-R$ 5.5MM');
  });

  it('formats thousands', () => {
    expect(formatCurrency(50_000)).toBe('R$ 50.0k');
    expect(formatCurrency(-1_200)).toBe('-R$ 1.2k');
  });

  it('formats small values', () => {
    expect(formatCurrency(500)).toBe('R$ 500');
    expect(formatCurrency(0)).toBe('R$ 0');
  });

  it('handles negative values', () => {
    expect(formatCurrency(-100)).toBe('-R$ 100');
  });
});

describe('formatCurrencyFull', () => {
  it('formats with locale pt-BR', () => {
    const result = formatCurrencyFull(1234567);
    expect(result).toContain('R$');
    expect(result).toContain('1');
  });
});

describe('formatPercent', () => {
  it('formats with 1 decimal place', () => {
    expect(formatPercent(77.8)).toBe('77.8%');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(-5.5)).toBe('-5.5%');
  });
});
