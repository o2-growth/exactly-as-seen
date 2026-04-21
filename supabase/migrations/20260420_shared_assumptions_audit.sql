-- Shared Assumptions + Audit Trail Migration
-- ADDITIVE ONLY: no DELETE, DROP, TRUNCATE or UPDATE on existing data

-- 1. Add scope column to distinguish shared vs user-specific snapshots
ALTER TABLE public.assumptions_snapshots ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'user';

-- 2. Add modified_by to track who last modified a shared snapshot
ALTER TABLE public.assumptions_snapshots ADD COLUMN IF NOT EXISTS modified_by UUID;

-- 3. Add change_summary JSONB for quick diff preview
ALTER TABLE public.assumptions_snapshots ADD COLUMN IF NOT EXISTS change_summary JSONB;

-- 4. Index for fast shared scope lookups
CREATE INDEX IF NOT EXISTS idx_assumptions_scope_active
  ON public.assumptions_snapshots(scope, is_active);

-- 5. Audit log table for detailed change tracking
CREATE TABLE IF NOT EXISTS public.assumptions_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES public.assumptions_snapshots(id),
  user_id UUID,
  user_email TEXT,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'restore')),
  changed_fields JSONB,
  previous_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_snapshot
  ON public.assumptions_audit_log(snapshot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_user
  ON public.assumptions_audit_log(user_id, created_at DESC);

-- 6. RLS for audit log
ALTER TABLE public.assumptions_audit_log ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view audit log (shared data = shared history)
CREATE POLICY "Authenticated users can view audit log"
  ON public.assumptions_audit_log FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert audit log"
  ON public.assumptions_audit_log FOR INSERT
  WITH CHECK (true);

-- 7. Update RLS on assumptions_snapshots to allow shared scope access
-- Shared snapshots are readable/writable by all authenticated users
CREATE POLICY "Users can view shared assumptions"
  ON public.assumptions_snapshots FOR SELECT
  USING (scope = 'shared');

CREATE POLICY "Users can update shared assumptions"
  ON public.assumptions_snapshots FOR UPDATE
  USING (scope = 'shared');

CREATE POLICY "Users can insert shared assumptions"
  ON public.assumptions_snapshots FOR INSERT
  WITH CHECK (scope = 'shared');
