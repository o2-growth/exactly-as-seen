import { useState, useCallback, useRef } from 'react';
import { getBackendClientSafe } from '@/lib/supabase-safe';
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

/**
 * Persistence hook — USER-SCOPED model.
 *
 * Each user has their own private workspace (scope='user', user_id=current).
 * On first login, when there's no user-scoped active snapshot yet, we BOOTSTRAP from
 * the most recent shared snapshot (the "master") so the user sees the latest team baseline.
 *
 * Daily flow: each user edits independently. No conflicts, no Realtime, no optimistic locking
 * — because the only writer to `(scope='user', user_id=X)` is user X themselves.
 *
 * Master sync: shared snapshots remain as a read-only reference. Pedro (or admin) can update
 * the master through the UI restore flow (which now writes user-scoped). To "publish" a
 * version as the new master, run an INSERT manually with scope='shared' (admin tool, not in UI).
 */
export function useAssumptionsPersistence() {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<AssumptionsSnapshot[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);

  // Last-saved reference for diff + skip-noop guard.
  // Always stored as the MERGED state ({...DEFAULT, ...loaded}) so byte-comparison with
  // React state is valid (FinancialModelContext applies the same merge on setAssumptions).
  const lastSavedAssumptions = useRef<Assumptions | null>(null);

  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getBackendClientSafe();
      if (!supabase) {
        setError('Supabase indisponível.');
        return null;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Sessão sem auth — faça login.');
        return null;
      }

      // Load: user's own snapshots + shared snapshots (for restore browsing + master bootstrap)
      const { data, error: fetchError } = await (supabase as any)
        .from('assumptions_snapshots')
        .select('*')
        .or(`user_id.eq.${user.id},scope.eq.shared`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      const mapped: AssumptionsSnapshot[] = (data || []).map((row: any) => ({
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

      // Priority:
      //  1) the user's own ACTIVE workspace
      //  2) the user's most recent snapshot (any state)
      //  3) the most recent SHARED snapshot (master) — bootstrap for new users
      const activeUserOwn = mapped.find(s => s.scope === 'user' && s.modified_by === user.id && s.is_active);
      const anyUserOwn = mapped.find(s => s.scope === 'user' && s.modified_by === user.id);
      const latestShared = mapped.find(s => s.scope === 'shared');
      const active = activeUserOwn ?? anyUserOwn ?? latestShared;

      if (active?.assumptions) {
        const merged = { ...DEFAULT_ASSUMPTIONS, ...active.assumptions };
        lastSavedAssumptions.current = merged;
        return active.assumptions;
      }
      return null;
    } catch (err: any) {
      console.error('Error loading assumptions:', err);
      setError(`Erro ao carregar: ${err.message}`);
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
      const supabase = getBackendClientSafe();
      if (!supabase) {
        setError('Supabase indisponível — edição não foi gravada.');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Sessão sem auth — edição não foi gravada.');
        return;
      }

      // Skip-noop: byte-equal local vs lastSaved → nothing to write.
      if (
        lastSavedAssumptions.current &&
        JSON.stringify(lastSavedAssumptions.current) === JSON.stringify(assumptions)
      ) {
        return;
      }

      const diff = lastSavedAssumptions.current
        ? computeAssumptionsDiff(lastSavedAssumptions.current, assumptions)
        : null;
      const changeSummary = diff ? buildChangeSummary(diff) : null;
      const auditValues = diff ? buildAuditValues(diff) : null;

      // Deactivate this user's previous active workspace (only their own — never touch others')
      await (supabase as any)
        .from('assumptions_snapshots')
        .update({ is_active: false })
        .eq('scope', 'user')
        .eq('user_id', user.id)
        .eq('is_active', true);

      // INSERT new user-scoped active snapshot (history preserved — never UPDATE)
      const { data: newSnapshot, error: insertError } = await (supabase as any)
        .from('assumptions_snapshots')
        .insert({
          user_id: user.id,
          scope: 'user',
          scenario,
          name: name || `Auto-save ${new Date().toLocaleString('pt-BR')}`,
          assumptions: assumptions as any,
          is_active: true,
          modified_by: user.id,
          change_summary: changeSummary,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Audit log
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
    } catch (err: any) {
      console.error('Error saving assumptions:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, []);

  const loadSnapshot = useCallback(async (snapshotId: string): Promise<Assumptions | null> => {
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
      if (loaded) {
        lastSavedAssumptions.current = { ...DEFAULT_ASSUMPTIONS, ...loaded };
      }
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

      // Load the snapshot to restore (can be user-scoped or shared — both readable)
      const { data: snapshotData, error: fetchError } = await (supabase as any)
        .from('assumptions_snapshots')
        .select('*')
        .eq('id', snapshotId)
        .single();

      if (fetchError) throw fetchError;
      if (!snapshotData) return null;

      const restoredAssumptions = snapshotData.assumptions as Assumptions;

      // Deactivate this user's current workspace
      await (supabase as any)
        .from('assumptions_snapshots')
        .update({ is_active: false })
        .eq('scope', 'user')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const diff = lastSavedAssumptions.current
        ? computeAssumptionsDiff(lastSavedAssumptions.current, restoredAssumptions)
        : null;

      // INSERT new user-scoped active snapshot as a copy of the restored content
      const { data: newSnapshot, error: insertError } = await (supabase as any)
        .from('assumptions_snapshots')
        .insert({
          user_id: user.id,
          scope: 'user',
          scenario: snapshotData.scenario,
          name: `Restaurado de ${snapshotData.name || new Date(snapshotData.created_at).toLocaleDateString('pt-BR')}`,
          assumptions: restoredAssumptions as any,
          is_active: true,
          modified_by: user.id,
          change_summary: diff ? buildChangeSummary(diff) : null,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

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

      lastSavedAssumptions.current = { ...DEFAULT_ASSUMPTIONS, ...restoredAssumptions };
      return restoredAssumptions;
    } catch (err: any) {
      console.error('Error restoring snapshot:', err);
      setError(err.message);
      return null;
    }
  }, []);

  /**
   * Pull the latest "master" (most recent shared snapshot) into this user's workspace.
   * Use this when you want to refresh from the team baseline (overwrites the user's local edits).
   * Returns the loaded assumptions on success, null otherwise.
   */
  const syncFromMaster = useCallback(async (): Promise<Assumptions | null> => {
    try {
      const supabase = getBackendClientSafe();
      if (!supabase) return null;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: master } = await (supabase as any)
        .from('assumptions_snapshots')
        .select('*')
        .eq('scope', 'shared')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!master?.assumptions) {
        setError('Nenhum snapshot master disponível.');
        return null;
      }

      // Deactivate user's current workspace
      await (supabase as any)
        .from('assumptions_snapshots')
        .update({ is_active: false })
        .eq('scope', 'user')
        .eq('user_id', user.id)
        .eq('is_active', true);

      // Create a user-scoped copy of the master
      const { error: insertError } = await (supabase as any)
        .from('assumptions_snapshots')
        .insert({
          user_id: user.id,
          scope: 'user',
          scenario: master.scenario,
          name: `Sync do master ${new Date().toLocaleString('pt-BR')}`,
          assumptions: master.assumptions,
          is_active: true,
          modified_by: user.id,
          change_summary: { fields_changed: [], count: 0, summary: 'Sincronizado com master' },
        });

      if (insertError) throw insertError;

      lastSavedAssumptions.current = { ...DEFAULT_ASSUMPTIONS, ...master.assumptions };
      return master.assumptions as Assumptions;
    } catch (err: any) {
      console.error('Error syncing from master:', err);
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

  const getLastSaved = useCallback(() => lastSavedAssumptions.current, []);

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
    syncFromMaster,
    loadAuditLog,
    getLastSaved,
  };
}
