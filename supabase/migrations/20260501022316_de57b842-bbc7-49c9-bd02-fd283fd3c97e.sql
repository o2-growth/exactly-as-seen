-- ============= TABLES =============
CREATE TABLE public.financial_debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  creditor text,
  original_amount numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  outstanding numeric NOT NULL DEFAULT 0,
  total_installments integer DEFAULT 0,
  paid_installments integer DEFAULT 0,
  remaining_installments integer DEFAULT 0,
  overdue_installments integer DEFAULT 0,
  overdue_amount numeric DEFAULT 0,
  monthly_payment numeric DEFAULT 0,
  interest_rate numeric DEFAULT 0,
  start_date date,
  next_due_date date,
  last_payment_date date,
  status text DEFAULT 'em_dia',
  notes text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tax_debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  subcategory text NOT NULL,
  detail text,
  outstanding numeric NOT NULL DEFAULT 0,
  items_count integer DEFAULT 0,
  status text DEFAULT 'a_regularizar',
  monthly_payment numeric DEFAULT 0,
  adhesion_date date,
  note text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.debt_payment_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL UNIQUE,
  karen_debentures numeric NOT NULL DEFAULT 0,
  paulo_edi numeric NOT NULL DEFAULT 0,
  santander numeric NOT NULL DEFAULT 0,
  cef_pronampe numeric NOT NULL DEFAULT 0,
  guardian numeric NOT NULL DEFAULT 0,
  pgfn_total numeric NOT NULL DEFAULT 0,
  municipal_total numeric NOT NULL DEFAULT 0,
  total_month numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============= RLS =============
ALTER TABLE public.financial_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read financial_debts" ON public.financial_debts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert financial_debts" ON public.financial_debts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update financial_debts" ON public.financial_debts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete financial_debts" ON public.financial_debts FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read tax_debts" ON public.tax_debts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert tax_debts" ON public.tax_debts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update tax_debts" ON public.tax_debts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete tax_debts" ON public.tax_debts FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated read debt_schedule" ON public.debt_payment_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert debt_schedule" ON public.debt_payment_schedule FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update debt_schedule" ON public.debt_payment_schedule FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated delete debt_schedule" ON public.debt_payment_schedule FOR DELETE TO authenticated USING (true);

-- ============= TRIGGERS updated_at =============
CREATE TRIGGER trg_financial_debts_updated_at BEFORE UPDATE ON public.financial_debts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_tax_debts_updated_at BEFORE UPDATE ON public.tax_debts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============= SEED financial_debts =============
INSERT INTO public.financial_debts (name, category, creditor, original_amount, total_paid, outstanding, total_installments, paid_installments, remaining_installments, overdue_installments, overdue_amount, monthly_payment, interest_rate, start_date, next_due_date, status, notes, sort_order) VALUES
('Debênture - HUB (Karen Lopes)', 'debenture', 'Karen Lopes', 91896, 73379, 18517, 45, 36, 9, 0, 0, 2057.47, 0, '2023-01-31', '2026-05-13', 'em_dia', 'Renegociação Debentures HUB - última parcela 13/01/2027', 1),
('Debênture - Sócio Paulo Edi', 'debenture', 'Paulo Edi', 150000, 37500, 112500, 48, 12, 36, 0, 0, 3125.00, 0, '2025-04-30', '2026-04-30', 'em_dia', 'Última parcela 30/03/2029', 2),
('Banco Santander - Contrato 251183310', 'bank', 'Santander', 197071, 44265, 152806, 61, 14, 47, 0, 0, 3251.19, 0, '2025-02-28', '2026-04-28', 'em_dia', 'Contrato IPCD - última parcela 28/02/2030', 3),
('Caixa Econômica Federal - Pronampe/Fampe', 'bank', 'CEF', 217657, 151666, 67099, 60, 44, 16, 1, 4194, 4193.68, 0, '2023-01-20', '2026-04-20', 'atraso', '1 parcela em atraso - última 20/07/2027', 4),
('Guardian Capital Securitizadora', 'securitizadora', 'Guardian Capital', 152630, 60000, 92630, 22, 14, 8, 7, 88630, 13855.00, 0, '2023-12-22', '2025-02-21', 'atraso', '7 parcelas em atraso - recebimentos Caramello + EPG', 5);

-- ============= SEED tax_debts =============
INSERT INTO public.tax_debts (category, subcategory, detail, outstanding, items_count, status, monthly_payment, adhesion_date, note, sort_order) VALUES
('sief_matriz', 'SIEF (RFB) - Matriz', 'Débitos Matriz - PIS, COFINS, IRPJ, CSLL, MAED', 567166, 29, 'a_regularizar', 0, NULL, 'Inclui débitos a vencer e vencidos', 1),
('empresas_vinculadas', 'Empresas Vinculadas', 'O2 POA, O2 FLN, O2 CWB (incorporadas)', 37075, 23, 'a_regularizar', 0, NULL, 'Débitos das filiais incorporadas', 2),
('pgfn', 'PGFN 12996693', 'Inscrições antigas IRPJ/Contrib. Social - 60 parc.', 48734, 60, 'em_parcelamento', 873.52, '2025-06-11', 'Adesão 11/06/2025 - Parcela R$ 873,52', 3),
('pgfn', 'PGFN 13396849', 'Múltiplas inscrições IRPJ/CONTRIB/COFINS/PIS - 60 parc.', 301342, 60, 'em_parcelamento', 5309.72, '2025-08-01', 'Adesão 01/08/2025 - Parcela R$ 5.309,72', 4),
('pgfn', 'PGFN 15516190', 'IRPJ/Contrib. Social/COFINS - 60 parc.', 95819, 60, 'em_parcelamento', 1607.96, '2026-03-16', 'Adesão 16/03/2026 - Parcela R$ 1.607,96', 5),
('pgfn', 'PGFN 15574311', 'IRPJ/Contrib. Social - 60 parc.', 275519, 60, 'em_parcelamento', 4623.58, '2026-03-24', 'Adesão 24/03/2026 - Parcela R$ 4.623,58', 6),
('municipal', 'Mun. Curitiba (CWB)', 'Parcelamento Municipal - 48 parc.', 22805, 45, 'em_parcelamento', 506.78, NULL, '3 quitadas, 45 a vencer (até dez/2029)', 7),
('municipal', 'Mun. Florianópolis (FLN)', 'I-SFA 2025 - Pedido 8195155', 2114, 1, 'a_pagar', 0, NULL, 'Pendência única', 8),
('municipal', 'Mun. Porto Alegre (POA)', '3 termos de parcelamento (500872/502217/502218)', 94660, 105, 'em_parcelamento', 2629.44, NULL, '36 parcelas em cada termo', 9);

-- ============= SEED debt_payment_schedule =============
INSERT INTO public.debt_payment_schedule (month,karen_debentures,paulo_edi,santander,cef_pronampe,guardian,pgfn_total,municipal_total,total_month) VALUES
('2025-03-01',0,0,0,0,5500,0,0,5500),
('2025-04-01',0,0,0,0,13855,0,0,13855),
('2025-05-01',0,0,0,0,13855,0,0,13855),
('2025-06-01',0,0,0,0,13855,0,0,13855),
('2025-07-01',0,0,0,0,13855,873.52,0,14728.52),
('2025-08-01',0,0,0,0,13855,6183.24,0,20038.24),
('2025-09-01',0,0,0,0,13855,6183.24,0,20038.24),
('2025-10-01',0,0,0,0,0,6183.24,0,6183.24),
('2025-11-01',0,0,0,0,0,6183.24,0,6183.24),
('2025-12-01',0,0,0,0,0,6183.24,0,6183.24),
('2026-01-01',0,0,0,0,0,6183.24,0,6183.24),
('2026-02-01',0,0,0,0,0,6183.24,0,6183.24),
('2026-03-01',0,0,0,0,0,6183.24,0,6183.24),
('2026-04-01',0,3125,3251.19,4193.68,0,12414.78,506.78,23491.43),
('2026-05-01',2057.47,3125,3251.19,4193.68,0,12414.78,5250.22,30292.34),
('2026-06-01',2057.47,3125,3251.19,4193.68,0,12414.78,3136.22,28178.34),
('2026-07-01',2057.47,3125,3251.19,4193.68,0,12414.78,3136.22,28178.34),
('2026-08-01',2057.47,3125,3251.19,4193.68,0,12414.78,3136.22,28178.34),
('2026-09-01',2057.47,3125,3251.19,4193.68,0,12414.78,3136.22,28178.34),
('2026-10-01',2057.47,3125,3251.19,4193.68,0,12414.78,3136.22,28178.34),
('2026-11-01',2057.47,3125,3251.19,4193.68,0,12414.78,3136.22,28178.34),
('2026-12-01',2057.47,3125,3251.19,4193.68,0,12414.78,3136.22,28178.34),
('2027-01-01',2057.35,3125,3251.19,4193.68,0,12414.78,3136.22,28178.22),
('2027-02-01',0,3125,3251.19,4193.68,0,12414.78,3136.22,26120.87),
('2027-03-01',0,3125,3251.19,4193.68,0,12414.78,3136.22,26120.87),
('2027-04-01',0,3125,3251.19,4193.68,0,12414.78,3136.22,26120.87),
('2027-05-01',0,3125,3251.19,4193.68,0,12414.78,3136.22,26120.87),
('2027-06-01',0,3125,3251.19,4193.68,0,12414.78,3136.22,26120.87),
('2027-07-01',0,3125,3251.19,4193.68,0,12414.78,3136.22,26120.87),
('2027-08-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2027-09-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2027-10-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2027-11-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2027-12-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2028-01-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2028-02-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2028-03-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2028-04-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2028-05-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2028-06-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2028-07-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2028-08-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2028-09-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2028-10-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2028-11-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2028-12-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2029-01-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2029-02-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2029-03-01',0,3125,3251.19,0,0,12414.78,3136.22,21927.19),
('2029-04-01',0,0,3251.19,0,0,12414.78,3136.22,18802.19),
('2029-05-01',0,0,3251.19,0,0,12414.78,506.78,16172.75),
('2029-06-01',0,0,3251.19,0,0,12414.78,506.78,16172.75),
('2029-07-01',0,0,3251.19,0,0,12414.78,506.78,16172.75),
('2029-08-01',0,0,3251.19,0,0,12414.78,506.78,16172.75),
('2029-09-01',0,0,3251.19,0,0,12414.78,506.78,16172.75),
('2029-10-01',0,0,3251.19,0,0,12414.78,506.78,16172.75),
('2029-11-01',0,0,3251.19,0,0,12414.78,506.78,16172.75),
('2029-12-01',0,0,3251.19,0,0,12414.78,506.78,16172.75),
('2030-01-01',0,0,3251.19,0,0,12414.78,0,15665.97),
('2030-02-01',0,0,3251.19,0,0,12414.78,0,15665.97),
('2030-03-01',0,0,0,0,0,12414.78,0,12414.78),
('2030-04-01',0,0,0,0,0,12414.78,0,12414.78),
('2030-05-01',0,0,0,0,0,12414.78,0,12414.78),
('2030-06-01',0,0,0,0,0,12414.78,0,12414.78),
('2030-07-01',0,0,0,0,0,11541.26,0,11541.26),
('2030-08-01',0,0,0,0,0,6231.54,0,6231.54),
('2030-09-01',0,0,0,0,0,6231.54,0,6231.54),
('2030-10-01',0,0,0,0,0,6231.54,0,6231.54),
('2030-11-01',0,0,0,0,0,6231.54,0,6231.54),
('2030-12-01',0,0,0,0,0,6231.54,0,6231.54),
('2031-01-01',0,0,0,0,0,6231.54,0,6231.54),
('2031-02-01',0,0,0,0,0,6231.54,0,6231.54),
('2031-03-01',0,0,0,0,0,6231.54,0,6231.54);