-- Historical client data per subcategory per month
-- Populated once from Oxy API, immutable after that

CREATE TABLE IF NOT EXISTS public.historical_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period TEXT NOT NULL,              -- '2025-01', '2025-02', etc.
  category TEXT NOT NULL,            -- API category name: 'Enterprise', 'Corporate', etc.
  assumption_key TEXT NOT NULL,      -- Matches Assumptions type: 'caasEnterprise', 'saasOxy', etc.
  is_mrr BOOLEAN NOT NULL DEFAULT false,
  client_count INTEGER NOT NULL DEFAULT 0,
  total_revenue NUMERIC(15,2) NOT NULL DEFAULT 0,
  avg_ticket NUMERIC(15,2) NOT NULL DEFAULT 0,
  churned_clients INTEGER NOT NULL DEFAULT 0,  -- clients from prev month not in this month
  churn_rate NUMERIC(8,4) NOT NULL DEFAULT 0,  -- churned / prev_month_count * 100
  client_names JSONB,               -- array of { name, value } for drill-down
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_hist_clients_period_key ON public.historical_clients(period, assumption_key);
CREATE INDEX idx_hist_clients_period ON public.historical_clients(period);
CREATE INDEX idx_hist_clients_key ON public.historical_clients(assumption_key);

-- RLS
ALTER TABLE public.historical_clients ENABLE ROW LEVEL SECURITY;

-- Read-only for all authenticated users (historical data is immutable)
CREATE POLICY "Anyone can read historical clients"
  ON public.historical_clients FOR SELECT
  USING (true);

-- Only service role can insert (via migration script)
CREATE POLICY "Service role can insert historical clients"
  ON public.historical_clients FOR INSERT
  WITH CHECK (true);
