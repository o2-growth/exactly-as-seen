import { useState, useCallback, useRef } from 'react';
import { hasBackendConfig, getBackendClientSafe } from '@/lib/supabase-safe';
import { Assumptions, DEFAULT_ASSUMPTIONS, Scenario } from '@/lib/financialData';
import { computeAssumptionsDiff, buildChangeSummary, buildAuditValues } from '@/lib/assumptionsDiff';

export interface AssumptionsSnapshot {
  id: string;
  name: string;
  scenario: Scenario;
  assumptions: Assumptions;
  is_active: boolean;
  scope: 'shared' | 'user';
  modified_by: string | null;
  change_summary: { fields_changed: string[]; count: number; summary: string } | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  snapshot_id: string;
  user_id: string | null;
  user_email: string | null;
  action: 'create' | 'update' | 'restore';
  changed_fields: string[] | null;
  previous_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  created_at: string;
}

export function useAssumptionsPersistence() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<AssumptionsSnapshot[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);

  // Keep reference to last-saved assumptions for diff computation
  const lastSavedAssumptions = useRef<Assumptions | null>(null);

  // Optimistic locking: track the created_at of the active snapshot we last loaded.
  // Before saving, we check if the server's active snapshot is newer (someone else saved).
  // If so, we abort to prevent overwriting their work with stale state.
  const lastKnownActiveCreatedAt = useRef<string | null>(null);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getBackendClientSafe();
      if (!supabase) {
        const stored = localStorage.getItem('o2_assumptions');
        if (stored) {
          const parsed = JSON.parse(stored);
          lastSavedAssumptions.current = parsed;
          setSnapshots([{
            id: 'local',
            name: 'Local Save',
            scenario: 'BASE',
            assumptions: parsed,
            is_active: true,
            scope: 'user',
            modified_by: null,
            change_summary: null,
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
          lastSavedAssumptions.current = parsed;
          setSnapshots([{
            id: 'local',
            name: 'Local Save',
            scenario: 'BASE',
            assumptions: parsed,
            is_active: true,
            scope: 'user',
            modified_by: null,
            change_summary: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }]);
          return parsed;
        }
        return null;
      }

      // Load ALL snapshots the user can see (shared + own)
      const { data, error: fetchError } = await (supabase as any)
        .from('assumptions_snapshots')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        scenario: row.scenario as Scenario,
        assumptions: row.assumptions as Assumptions,
        is_active: row.is_active,
        scope: (row.scope || 'user') as 'shared' | 'user',
        modified_by: row.modified_by,
        change_summary: row.change_summary,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
      setSnapshots(mapped);

      // Priority: active shared → active user → most recent → localStorage
      const activeShared = mapped.find(s => s.scope === 'shared' && s.is_active);
      const activeUser = mapped.find(s => s.is_active);
      const active = activeShared ?? activeUser ?? mapped[0];
      if (active?.assumptions) {
        lastSavedAssumptions.current = active.assumptions;
        lastKnownActiveCreatedAt.current = active.created_at;
        return active.assumptions;
      }

      const stored = localStorage.getItem('o2_assumptions');
      if (stored) {
        const parsed = JSON.parse(stored);
        lastSavedAssumptions.current = parsed;
        return parsed;
      }
      return null;
    } catch (err: any) {
      console.error('Error loading assumptions:', err);
      setError(err.message);
      const stored = localStorage.getItem('o2_assumptions');
      if (stored) {
        const parsed = JSON.parse(stored);
        lastSavedAssumptions.current = parsed;
        return parsed;
      }
      return null;
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

      // Compute diff against last saved state (used for audit log + skip-noop)
      const diff = lastSavedAssumptions.current
        ? computeAssumptionsDiff(lastSavedAssumptions.current, assumptions)
        : null;

      // Skip only if local state is provably identical to last save (catch-all guard).
      // Cannot rely on diff.changes.length alone — diff is field-by-field and may miss future fields.
      if (lastSavedAssumptions.current && JSON.stringify(lastSavedAssumptions.current) === JSON.stringify(assumptions)) {
        return;
      }

      const changeSummary = diff ? buildChangeSummary(diff) : null;
      const auditValues = diff ? buildAuditValues(diff) : null;

      // Find existing active shared snapshot — fetch created_at for optimistic-lock check
      const { data: existing } = await (supabase as any)
        .from('assumptions_snapshots')
        .select('id, created_at')
        .eq('scope', 'shared')
        .eq('is_active', true)
        .limit(1)
        .single();

      // OPTIMISTIC LOCKING: if the server's active snapshot is newer than what we loaded,
      // another session/user wrote first. Abort to prevent overwriting their work with stale state.
      if (
        existing?.created_at &&
        lastKnownActiveCreatedAt.current &&
        existing.created_at > lastKnownActiveCreatedAt.current
      ) {
        console.warn(
          '[saveAssumptions] Concurrent write detected — server has newer snapshot.',
          { localKnownAt: lastKnownActiveCreatedAt.current, serverActiveAt: existing.created_at },
        );
        setError('Outra sessão salvou primeiro. Recarregue para ver a versão mais nova.');
        return; // Do not overwrite — caller should reload via loadSnapshots()
      }

      if (existing?.id) {
        // Deactivate current active snapshot
        await (supabase as any)
          .from('assumptions_snapshots')
          .update({ is_active: false })
          .eq('id', existing.id);
      }

      // INSERT new snapshot (never UPDATE — preserves full history)
      const { data: newSnapshot, error: insertError } = await (supabase as any)
        .from('assumptions_snapshots')
        .insert({
          user_id: user.id,
          scope: 'shared',
          scenario,
          name: name || `Auto-save ${new Date().toLocaleString('pt-BR')}`,
          assumptions: assumptions as any,
          is_active: true,
          modified_by: user.id,
          change_summary: changeSummary,
        })
        .select('id, created_at')
        .single();

      if (insertError) throw insertError;

      // Insert audit log entry
      if (newSnapshot?.id && diff && diff.changes.length > 0) {
        await (supabase as any)
          .from('assumptions_audit_log')
          .insert({
            snapshot_id: newSnapshot.id,
            user_id: user.id,
            user_email: user.email,
            action: lastSavedAssumptions.current ? 'update' : 'create',
            changed_fields: diff.changedFields,
            previous_values: auditValues?.previous_values,
            new_values: auditValues?.new_values,
          });
      }

      lastSavedAssumptions.current = assumptions;
      if (newSnapshot?.created_at) {
        lastKnownActiveCreatedAt.current = newSnapshot.created_at;
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
      const loaded = (data as any)?.assumptions ?? null;
      if (loaded) lastSavedAssumptions.current = loaded;
      return loaded;
    } catch (err: any) {
      console.error('Error loading snapshot:', err);
      return null;
    }
  }, []);

  const restoreSnapshot = useCallback(async (snapshotId: string): Promise<Assumptions | null> => {
    try {
      const supabase = getBackendClientSafe();
      if (!supabase) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Load the snapshot to restore
      const { data: snapshotData, error: fetchError } = await (supabase as any)
        .from('assumptions_snapshots')
        .select('*')
        .eq('id', snapshotId)
        .single();

      if (fetchError) throw fetchError;
      if (!snapshotData) return null;

      const restoredAssumptions = snapshotData.assumptions as Assumptions;

      // Deactivate current active
      await (supabase as any)
        .from('assumptions_snapshots')
        .update({ is_active: false })
        .eq('scope', 'shared')
        .eq('is_active', true);

      // Create new snapshot as a copy (never overwrite history)
      const diff = lastSavedAssumptions.current
        ? computeAssumptionsDiff(lastSavedAssumptions.current, restoredAssumptions)
        : null;

      const { data: newSnapshot, error: insertError } = await (supabase as any)
        .from('assumptions_snapshots')
        .insert({
          user_id: user.id,
          scope: 'shared',
          scenario: snapshotData.scenario,
          name: `Restaurado de ${snapshotData.name || new Date(snapshotData.created_at).toLocaleDateString('pt-BR')}`,
          assumptions: restoredAssumptions as any,
          is_active: true,
          modified_by: user.id,
          change_summary: diff ? buildChangeSummary(diff) : null,
        })
        .select('id, created_at')
        .single();

      if (insertError) throw insertError;

      // Audit log for restore
      if (newSnapshot?.id) {
        await (supabase as any)
          .from('assumptions_audit_log')
          .insert({
            snapshot_id: newSnapshot.id,
            user_id: user.id,
            user_email: user.email,
            action: 'restore',
            changed_fields: diff?.changedFields || [],
            previous_values: diff ? buildAuditValues(diff).previous_values : null,
            new_values: diff ? buildAuditValues(diff).new_values : null,
          });
      }

      lastSavedAssumptions.current = restoredAssumptions;
      if (newSnapshot?.created_at) {
        lastKnownActiveCreatedAt.current = newSnapshot.created_at;
      }
      localStorage.setItem('o2_assumptions', JSON.stringify(restoredAssumptions));
      return restoredAssumptions;
    } catch (err: any) {
      console.error('Error restoring snapshot:', err);
      setError(err.message);
      return null;
    }
  }, []);

  const loadAuditLog = useCallback(async (limit = 50) => {
    try {
      const supabase = getBackendClientSafe();
      if (!supabase) return;

      const { data, error: fetchError } = await (supabase as any)
        .from('assumptions_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) throw fetchError;

      setAuditLog((data || []).map((row: any) => ({
        id: row.id,
        snapshot_id: row.snapshot_id,
        user_id: row.user_id,
        user_email: row.user_email,
        action: row.action,
        changed_fields: row.changed_fields,
        previous_values: row.previous_values,
        new_values: row.new_values,
        created_at: row.created_at,
      })));
    } catch (err: any) {
      console.error('Error loading audit log:', err);
    }
  }, []);

  return {
    saving,
    loading,
    error,
    snapshots,
    auditLog,
    loadSnapshots,
    saveAssumptions,
    loadSnapshot,
    restoreSnapshot,
    loadAuditLog,
  };
}
