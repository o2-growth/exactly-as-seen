-- Assumptions persistence table
-- Stores serialized JSON of the full Assumptions object per user/scenario

CREATE TABLE IF NOT EXISTS public.assumptions_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario TEXT NOT NULL DEFAULT 'BASE' CHECK (scenario IN ('BASE', 'BULL', 'BEAR')),
  name TEXT NOT NULL DEFAULT 'Default',
  assumptions JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by user + active
CREATE INDEX idx_assumptions_user_active ON public.assumptions_snapshots(user_id, is_active);

-- RLS: users can only see their own snapshots
ALTER TABLE public.assumptions_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assumptions"
  ON public.assumptions_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assumptions"
  ON public.assumptions_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assumptions"
  ON public.assumptions_snapshots FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own assumptions"
  ON public.assumptions_snapshots FOR DELETE
  USING (auth.uid() = user_id);

-- Allow anon access for dev (remove in production)
CREATE POLICY "Anon can do everything (dev only)"
  ON public.assumptions_snapshots FOR ALL
  USING (true) WITH CHECK (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assumptions_snapshots_updated_at
  BEFORE UPDATE ON public.assumptions_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
