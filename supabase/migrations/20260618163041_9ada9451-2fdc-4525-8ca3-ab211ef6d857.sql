
CREATE TABLE public.pitch_deck_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  slide_order jsonb,
  hidden_slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pitch_deck_overrides TO authenticated;
GRANT ALL ON public.pitch_deck_overrides TO service_role;
ALTER TABLE public.pitch_deck_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own pitch overrides"
  ON public.pitch_deck_overrides FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER pitch_deck_overrides_updated_at
  BEFORE UPDATE ON public.pitch_deck_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
