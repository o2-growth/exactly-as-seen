/**
 * FinancialModelContext — Integration Tests
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { FinancialModelProvider, useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS } from '@/lib/financialData';

function wrapper({ children }: { children: React.ReactNode }) {
  return <FinancialModelProvider>{children}</FinancialModelProvider>;
}

describe('FinancialModelContext', () => {
  it('provides default assumptions', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });
    expect(result.current.assumptions).toBeDefined();
    expect(result.current.assumptions.caasClients[2025]).toBe(167);
  });

  it('provides model output', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });
    expect(result.current.model).toBeDefined();
    expect(result.current.model.years).toBeDefined();
    for (const y of YEARS) {
      expect(result.current.model.years[y]).toBeDefined();
      expect(result.current.model.years[y].grossRevenue).toBeGreaterThan(0);
    }
  });

  it('provides pnl tree', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });
    expect(result.current.pnlTree).toBeDefined();
    expect(result.current.pnlTree.length).toBeGreaterThan(0);
  });

  it('default scenario is BASE', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });
    expect(result.current.scenario).toBe('BASE');
  });

  it('updateAssumption triggers recomputation', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });
    const initialRevenue = result.current.model.years[2025].grossRevenue;

    act(() => {
      result.current.updateAssumption('tickets', {
        ...result.current.assumptions.tickets,
        caasAssessoria: 4000, // doubled
      });
    });

    // Revenue should change
    expect(result.current.model.years[2025].grossRevenue).not.toBe(initialRevenue);
  });

  it('setScenario changes model output', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });
    const baseRevenue = result.current.model.years[2025].grossRevenue;

    act(() => {
      result.current.setScenario('BULL');
    });

    expect(result.current.model.years[2025].grossRevenue).toBeGreaterThan(baseRevenue);
  });

  it('resetAssumptions restores defaults', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });

    act(() => {
      result.current.updateAssumption('churnCaas', 50); // extreme churn
    });

    act(() => {
      result.current.resetAssumptions();
    });

    expect(result.current.assumptions.churnCaas).toBe(5);
  });

  it('filteredYears defaults to all years', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });
    expect(result.current.filteredYears).toEqual([...YEARS]);
  });

  it('projections are derived from model', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });
    for (const y of YEARS) {
      expect(result.current.projections.grossRevenue[y]).toBe(
        result.current.model.years[y].grossRevenue
      );
    }
  });
});
