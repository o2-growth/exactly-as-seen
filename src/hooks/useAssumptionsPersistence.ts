import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Assumptions, DEFAULT_ASSUMPTIONS, Scenario } from '@/lib/financialData';

export interface AssumptionsSnapshot {
  id: string;
  name: string;
  scenario: Scenario;
  assumptions: Assumptions;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useAssumptionsPersistence() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<AssumptionsSnapshot[]>([]);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Not logged in — use localStorage fallback
        const stored = localStorage.getItem('o2_assumptions');
        if (stored) {
          setSnapshots([{
            id: 'local',
            name: 'Local Save',
            scenario: 'BASE',
            assumptions: JSON.parse(stored),
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);
        }
        return null;
      }

      const { data, error: fetchError } = await (supabase as any)
        .from('assumptions_snapshots')
        .select('*')
        .order('updated_at', { ascending: false });

      if (fetchError) throw fetchError;

      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        scenario: row.scenario as Scenario,
        assumptions: row.assumptions as Assumptions,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
      setSnapshots(mapped);

      // Return the active one
      const active = mapped.find(s => s.is_active);
      return active?.assumptions ?? null;
    } catch (err: any) {
      console.error('Error loading assumptions:', err);
      setError(err.message);
      // Fallback to localStorage
      const stored = localStorage.getItem('o2_assumptions');
      return stored ? JSON.parse(stored) : null;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAssumptions = useCallback(async (
    assumptions: Assumptions,
    scenario: Scenario,
    name?: string,
  ) => {
    setSaving(true);
    setError(null);
    try {
      // Always save to localStorage as backup
      localStorage.setItem('o2_assumptions', JSON.stringify(assumptions));

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Not logged in — localStorage only
        return;
      }

      // Deactivate all existing for this user
      await supabase
        .from('assumptions_snapshots')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // Upsert active snapshot
      const { error: upsertError } = await supabase
        .from('assumptions_snapshots')
        .insert({
          user_id: user.id,
          scenario,
          name: name || `Save ${new Date().toLocaleString('pt-BR')}`,
          assumptions: assumptions as any,
          is_active: true,
        });

      if (upsertError) throw upsertError;
    } catch (err: any) {
      console.error('Error saving assumptions:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, []);

  const loadSnapshot = useCallback(async (snapshotId: string): Promise<Assumptions | null> => {
    if (snapshotId === 'local') {
      const stored = localStorage.getItem('o2_assumptions');
      return stored ? JSON.parse(stored) : null;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('assumptions_snapshots')
        .select('assumptions')
        .eq('id', snapshotId)
        .single();

      if (fetchError) throw fetchError;
      return (data as any)?.assumptions ?? null;
    } catch (err: any) {
      console.error('Error loading snapshot:', err);
      return null;
    }
  }, []);

  return {
    saving,
    loading,
    error,
    snapshots,
    loadSnapshots,
    saveAssumptions,
    loadSnapshot,
  };
}
