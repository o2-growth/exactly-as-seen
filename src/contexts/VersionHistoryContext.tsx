import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Assumptions, DEFAULT_ASSUMPTIONS, Scenario } from '@/lib/financialData';

export interface VersionSnapshot {
  id: string;
  version: string;
  timestamp: string;
  note: string;
  assumptions: Assumptions;
  scenario: Scenario;
}

export interface VersionDiff {
  field: string;
  oldValue: string | number;
  newValue: string | number;
}

interface VersionHistoryContextType {
  versions: VersionSnapshot[];
  currentVersion: string;
  previewVersion: VersionSnapshot | null;
  saveVersion: (note: string, assumptions: Assumptions, scenario: Scenario) => void;
  previewVersionById: (id: string | null) => void;
  restoreVersion: (id: string) => Assumptions;
  getDiff: (v1: VersionSnapshot, v2: VersionSnapshot) => VersionDiff[];
}

const VersionHistoryContext = createContext<VersionHistoryContextType | null>(null);

const STORAGE_KEY = 'o2_version_history';

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function getNextVersion(versions: VersionSnapshot[]): string {
  if (versions.length === 0) return '1.0';
  const last = versions[versions.length - 1].version;
  const [major, minor] = last.split('.').map(Number);
  return `${major}.${minor + 1}`;
}

function deepDiffAssumptions(a: Assumptions, b: Assumptions): VersionDiff[] {
  const diffs: VersionDiff[] = [];
  
  const compareRecord = (label: string, recA: Record<number, number>, recB: Record<number, number>) => {
    for (const key of Object.keys(recA)) {
      const k = Number(key);
      if (recA[k] !== recB[k]) {
        diffs.push({ field: `${label} ${k}`, oldValue: recA[k], newValue: recB[k] });
      }
    }
  };

  compareRecord('CaaS Clients', a.caasClients, b.caasClients);
  compareRecord('SaaS Clients', a.saasClients, b.saasClients);
  compareRecord('Education Clients', a.educationClients, b.educationClients);

  for (const key of Object.keys(a.tickets) as (keyof typeof a.tickets)[]) {
    if (a.tickets[key] !== b.tickets[key]) {
      diffs.push({ field: `Ticket ${key}`, oldValue: a.tickets[key], newValue: b.tickets[key] });
    }
  }

  if (a.churnCaas !== b.churnCaas) diffs.push({ field: 'Churn CaaS', oldValue: a.churnCaas, newValue: b.churnCaas });
  if (a.churnSaas !== b.churnSaas) diffs.push({ field: 'Churn SaaS', oldValue: a.churnSaas, newValue: b.churnSaas });
  if (a.sgaPercent !== b.sgaPercent) diffs.push({ field: 'SG&A %', oldValue: a.sgaPercent, newValue: b.sgaPercent });
  if (a.headcountGrowth !== b.headcountGrowth) diffs.push({ field: 'Headcount Growth', oldValue: a.headcountGrowth, newValue: b.headcountGrowth });

  return diffs;
}

export function VersionHistoryProvider({ children }: { children: React.ReactNode }) {
  const [versions, setVersions] = useState<VersionSnapshot[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    // Initial version
    return [{
      id: 'v1-initial',
      version: '1.0',
      timestamp: '2025-03-05T00:00:00.000Z',
      note: 'Modelo base (5 de Março 2025)',
      assumptions: DEFAULT_ASSUMPTIONS,
      scenario: 'BASE' as Scenario,
    }];
  });
  const [previewVersion, setPreviewVersion] = useState<VersionSnapshot | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
  }, [versions]);

  const currentVersion = versions.length > 0 ? versions[versions.length - 1].version : '1.0';

  const saveVersion = useCallback((note: string, assumptions: Assumptions, scenario: Scenario) => {
    const newVersion: VersionSnapshot = {
      id: generateId(),
      version: getNextVersion(versions),
      timestamp: new Date().toISOString(),
      note,
      assumptions,
      scenario,
    };
    setVersions(prev => [...prev, newVersion]);
  }, [versions]);

  const previewVersionById = useCallback((id: string | null) => {
    if (!id) { setPreviewVersion(null); return; }
    const v = versions.find(v => v.id === id) || null;
    setPreviewVersion(v);
  }, [versions]);

  const restoreVersion = useCallback((id: string): Assumptions => {
    const v = versions.find(v => v.id === id);
    return v ? v.assumptions : DEFAULT_ASSUMPTIONS;
  }, [versions]);

  const getDiff = useCallback((v1: VersionSnapshot, v2: VersionSnapshot): VersionDiff[] => {
    return deepDiffAssumptions(v1.assumptions, v2.assumptions);
  }, []);

  return (
    <VersionHistoryContext.Provider value={{
      versions, currentVersion, previewVersion,
      saveVersion, previewVersionById, restoreVersion, getDiff,
    }}>
      {children}
    </VersionHistoryContext.Provider>
  );
}

export function useVersionHistory() {
  const ctx = useContext(VersionHistoryContext);
  if (!ctx) throw new Error('useVersionHistory must be used within VersionHistoryProvider');
  return ctx;
}
