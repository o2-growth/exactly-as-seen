/**
 * FinancialModelContext — Integration Tests
 * Note: 2025 is fully historical — engine AnnualOutput.grossRevenue = 0 for 2025.
 * Real values come from pnlTree (applyHistoricalOverrides). Tests that check engine
 * output use 2026+ where the engine computes projected values.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { FinancialModelProvider, useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS } from '@/lib/financialData';

const PROJECTED_YEARS = YEARS.filter(y => y >= 2026);

function wrapper({ children }: { children: React.ReactNode }) {
  return <FinancialModelProvider>{children}</FinancialModelProvider>;
}

describe('FinancialModelContext', () => {
  it('provides default assumptions', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });
    expect(result.current.assumptions).toBeDefined();
    expect(result.current.assumptions.caasClients[2025]).toBe(167);
  });

  it('provides model output with projected years having positive revenue', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });
    expect(result.current.model).toBeDefined();
    for (const y of PROJECTED_YEARS) {
      expect(result.current.model.years[y].grossRevenue).toBeGreaterThan(0);
    }
  });

  it('2025 revenue comes from pnlTree (historical override)', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });
    const node1 = result.current.pnlTree.find(n => n.code === '1');
    expect(node1).toBeDefined();
    expect(node1!.annual[2025]).toBeGreaterThan(9000);
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

  it('updateAssumption triggers recomputation (2026+)', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });
    const initialRevenue = result.current.model.years[2026].grossRevenue;

    act(() => {
      result.current.updateAssumption('tickets', {
        ...result.current.assumptions.tickets,
        caasAssessoria: 4000,
      });
    });

    expect(result.current.model.years[2026].grossRevenue).not.toBe(initialRevenue);
  });

  it('setScenario changes model output (2026+)', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });
    const baseRevenue = result.current.model.years[2026].grossRevenue;

    act(() => {
      result.current.setScenario('BULL');
    });

    expect(result.current.model.years[2026].grossRevenue).toBeGreaterThan(baseRevenue);
  });

  it('resetAssumptions restores defaults', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });

    act(() => {
      result.current.updateAssumption('churnCaas', 50);
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

  it('projections are derived from pnlTree (patched values)', () => {
    const { result } = renderHook(() => useFinancialModel(), { wrapper });
    const node1 = result.current.pnlTree.find(n => n.code === '1');
    for (const y of PROJECTED_YEARS) {
      // projections now come from pnlTree, not raw engine output
      const treeVal = node1?.annual[y] ?? 0;
      if (treeVal > 0) {
        expect(result.current.projections.grossRevenue[y]).toBe(treeVal);
      } else {
        // Fallback to engine if tree has no value
        expect(result.current.projections.grossRevenue[y]).toBe(
          result.current.model.years[y].grossRevenue
        );
      }
    }
  });
});
