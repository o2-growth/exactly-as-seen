import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import {
  Assumptions, DEFAULT_ASSUMPTIONS, Scenario, Year, YEARS,
  ProjectionData, calculateProjections,
} from '@/lib/financialData';

interface FinancialModelContextType {
  assumptions: Assumptions;
  scenario: Scenario;
  selectedYear: Year;
  projections: ProjectionData;
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

  const projections = useMemo(
    () => calculateProjections(assumptions, scenario),
    [assumptions, scenario]
  );

  const updateAssumption = useCallback(<K extends keyof Assumptions>(key: K, value: Assumptions[K]) => {
    setAssumptions(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetAssumptions = useCallback(() => {
    setAssumptions(DEFAULT_ASSUMPTIONS);
  }, []);

  return (
    <FinancialModelContext.Provider value={{
      assumptions, scenario, selectedYear, projections,
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
