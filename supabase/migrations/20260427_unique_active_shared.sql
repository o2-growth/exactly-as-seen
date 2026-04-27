-- Garante no-mais-de-1 snapshot ativo por scope.
-- Pre-condicao: tabela nao deve ter 2 ou mais rows com (scope='shared', is_active=true).
-- Caso esteja, fazer cleanup pontual ANTES de aplicar este index (UPDATE em is_active
-- de UMA das duplicatas para false). Esse cleanup nao toca em "assumptions" (JSONB).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_shared_snapshot
  ON public.assumptions_snapshots (scope)
  WHERE is_active = true;

-- Habilita Supabase Realtime na tabela para sync entre sessoes.
ALTER PUBLICATION supabase_realtime ADD TABLE public.assumptions_snapshots;
