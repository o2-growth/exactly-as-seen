import { useState, useCallback } from 'react';
import { hasBackendConfig, getBackendClientSafe } from '@/lib/supabase-safe';
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
      const supabase = getBackendClientSafe();
      if (!supabase) {
        const stored = localStorage.getItem('o2_assumptions');
        if (stored) {
          const parsed = JSON.parse(stored);
          setSnapshots([{
            id: 'local',
            name: 'Local Save',
            scenario: 'BASE',
            assumptions: parsed,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);
          return parsed;
        }
        return null;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const stored = localStorage.getItem('o2_assumptions');
        if (stored) {
          const parsed = JSON.parse(stored);
          setSnapshots([{
            id: 'local',
            name: 'Local Save',
            scenario: 'BASE',
            assumptions: parsed,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);
          return parsed;
        }
        return null;
      }

      // Load with user_id filter and limit for performance
      const { data, error: fetchError } = await (supabase as any)
        .from('assumptions_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(20);

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

      // Return the active snapshot, or the most recent one, or fall back to localStorage
      const active = mapped.find(s => s.is_active) ?? mapped[0];
      if (active?.assumptions) return active.assumptions;

      // Fallback to localStorage if Supabase has no data
      const stored = localStorage.getItem('o2_assumptions');
      return stored ? JSON.parse(stored) : null;
    } catch (err: any) {
      console.error('Error loading assumptions:', err);
      setError(err.message);
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
      // Always save to localStorage first (instant, reliable)
      localStorage.setItem('o2_assumptions', JSON.stringify(assumptions));

      const supabase = getBackendClientSafe();
      if (!supabase) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try to find existing active snapshot to UPDATE (not create new rows)
      const { data: existing } = await (supabase as any)
        .from('assumptions_snapshots')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (existing?.id) {
        // UPDATE existing row (no table bloat)
        const { error: updateError } = await (supabase as any)
          .from('assumptions_snapshots')
          .update({
            scenario,
            assumptions: assumptions as any,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
      } else {
        // No active snapshot exists — INSERT one
        const { error: insertError } = await (supabase as any)
          .from('assumptions_snapshots')
          .insert({
            user_id: user.id,
            scenario,
            name: name || `Save ${new Date().toLocaleString('pt-BR')}`,
            assumptions: assumptions as any,
            is_active: true,
          });

        if (insertError) throw insertError;
      }
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
      const supabase = getBackendClientSafe();
      if (!supabase) return null;

      const { data, error: fetchError } = await (supabase as any)
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
