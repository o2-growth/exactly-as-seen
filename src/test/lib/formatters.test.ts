/**
 * Formatters — Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCurrencyFull, formatPercent, formatNumber } from '@/lib/formatters';

describe('formatCurrency', () => {
  it('formats billions', () => {
    expect(formatCurrency(1_500_000_000)).toBe('R$ 1.500.000.000,00');
    expect(formatCurrency(-2_000_000_000)).toBe('-R$ 2.000.000.000,00');
  });

  it('formats millions', () => {
    expect(formatCurrency(13_777_000)).toBe('R$ 13.777.000,00');
    expect(formatCurrency(-5_500_000)).toBe('-R$ 5.500.000,00');
  });

  it('formats thousands', () => {
    expect(formatCurrency(50_000)).toBe('R$ 50.000,00');
    expect(formatCurrency(-1_200)).toBe('-R$ 1.200,00');
  });

  it('formats small values', () => {
    expect(formatCurrency(500)).toBe('R$ 500,00');
    expect(formatCurrency(0)).toBe('R$ 0,00');
  });

  it('handles negative values', () => {
    expect(formatCurrency(-100)).toBe('-R$ 100,00');
  });

  it('formats with 2 decimal places', () => {
    expect(formatCurrency(1234.56)).toBe('R$ 1.234,56');
    expect(formatCurrency(99.9)).toBe('R$ 99,90');
  });
});

describe('formatCurrencyFull', () => {
  it('formats with locale pt-BR and 2 decimals', () => {
    const result = formatCurrencyFull(1234567);
    expect(result).toContain('R$');
    expect(result).toContain('1');
    expect(result).toContain(',00');
  });
});

describe('formatPercent', () => {
  it('formats with 1 decimal place', () => {
    expect(formatPercent(77.8)).toBe('77.8%');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(-5.5)).toBe('-5.5%');
  });
});
