import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import {
  Assumptions, DEFAULT_ASSUMPTIONS, Scenario, Year, YEARS,
  ProjectionData,
} from '@/lib/financialData';
import { PnlNode } from '@/lib/pnlData';
import { computeFullModel, FullModelOutput } from '@/engine/calculationsEngine';

interface FinancialModelContextType {
  assumptions: Assumptions;
  scenario: Scenario;
  selectedYear: Year;
  projections: ProjectionData;
  model: FullModelOutput;
  pnlTree: PnlNode[];
  setAssumptions: (a: Assumptions) => void;
  updateAssumption: <K extends keyof Assumptions>(key: K, value: Assumptions[K]) => void;
  setScenario: (s: Scenario) => void;
  setSelectedYear: (y: Year) => void;
  resetAssumptions: () => void;
}

const FinancialModelContext = createContext<FinancialModelContextType | null>(null);

export function FinancialModelProvider({ children }: { children: React.ReactNode }) {
  const [assumptions, setAssumptions] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [scenario, setScenario] = useState<Scenario>('BASE');
  const [selectedYear, setSelectedYear] = useState<Year>(2025);

  // Compute full model from engine
  const model = useMemo(
    () => computeFullModel(assumptions, scenario),
    [assumptions, scenario]
  );

  // Derive projections from engine output (backwards-compatible interface)
  const projections: ProjectionData = useMemo(() => {
    const p: ProjectionData = {
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
    for (const y of YEARS) {
      const yr = model.years[y];
      p.grossRevenue[y] = yr.grossRevenue;
      p.netRevenue[y] = yr.netRevenue;
      p.grossProfit[y] = yr.grossProfit;
      p.ebitda[y] = yr.ebitda;
      p.netIncome[y] = yr.netIncome;
      p.operatingCashFlow[y] = yr.finalResult;
      p.totalClients[y] = yr.totalClients;
      p.grossMargins[y] = yr.grossMarginPct;
      p.netMargins[y] = yr.netMarginPct;
    }
    return p;
  }, [model]);

  const pnlTree = model.pnlTree;

  const updateAssumption = useCallback(<K extends keyof Assumptions>(key: K, value: Assumptions[K]) => {
    setAssumptions(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetAssumptions = useCallback(() => {
    setAssumptions(DEFAULT_ASSUMPTIONS);
  }, []);

  return (
    <FinancialModelContext.Provider value={{
      assumptions, scenario, selectedYear, projections, model, pnlTree,
      setAssumptions, updateAssumption, setScenario, setSelectedYear, resetAssumptions,
    }}>
      {children}
    </FinancialModelContext.Provider>
  );
}

export function useFinancialModel() {
  const ctx = useContext(FinancialModelContext);
  if (!ctx) throw new Error('useFinancialModel must be used within FinancialModelProvider');
  return ctx;
}
