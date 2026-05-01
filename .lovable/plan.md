## Plano: Reformulação completa da página /debt + persistência editável no banco

### Objetivo
Substituir os dados estáticos hard-coded em `src/data/modelData.ts` (`debtSchedule`, `taxDebtItems`) por tabelas editáveis no Lovable Cloud, espelhando exatamente o dashboard do XLSX `Endividamento_O2_Inc_2026.xlsx` (posição 26/04/2026), e usar o cronograma mensal real para o gráfico de amortização.

---

### 1. Schema do banco (3 tabelas novas)

#### `financial_debts` — dívidas financeiras (5 itens)
```
id uuid pk
name text             -- "Banco Santander - Contrato 251183310"
category text         -- 'debenture' | 'bank' | 'securitizadora'
creditor text         -- "Santander", "Karen Lopes", etc
original_amount numeric
total_paid numeric
outstanding numeric
total_installments int
paid_installments int
remaining_installments int
overdue_installments int default 0
overdue_amount numeric default 0
monthly_payment numeric
interest_rate numeric default 0
start_date date
last_payment_date date
next_due_date date
status text           -- 'em_dia' | 'atraso'
notes text
sort_order int
created_at, updated_at
```

#### `tax_debts` — dívidas tributárias (9 itens)
```
id uuid pk
category text         -- 'sief_matriz' | 'empresas_vinculadas' | 'pgfn' | 'municipal'
subcategory text      -- "PGFN 13396849", "Mun. Curitiba (CWB)", etc
detail text           -- "Múltiplas inscrições IRPJ/CONTRIB/COFINS/PIS - 60 parc."
outstanding numeric
items_count int       -- 60 parcelas, 29 itens, etc
status text           -- 'a_regularizar' | 'em_parcelamento' | 'a_pagar'
monthly_payment numeric default 0    -- só PGFN/municipal
adhesion_date date    -- para PGFN
note text             -- "Adesão 01/08/2025 - Parcela R$ 5,309.72"
sort_order int
created_at, updated_at
```

#### `debt_payment_schedule` — cronograma mensal consolidado (aba "Cronograma De Pagamentos" do XLSX, ~50 linhas mês a mês fev/2025–jan/2030)
```
id uuid pk
month date                       -- 2026-04-01
karen_debentures numeric default 0
paulo_edi numeric default 0
santander numeric default 0
cef_pronampe numeric default 0
guardian numeric default 0
pgfn_total numeric default 0
municipal_total numeric default 0
total_month numeric              -- soma das 7 colunas acima
created_at
```

Esta tabela serve para o **gráfico de amortização real** (substitui o cálculo simplificado atual) e alimenta o Cash Flow com `parcela mensal PGFN R$ 12.415` e parcelas bancárias mês a mês.

### 2. RLS
Como o app é interno (login restrito), todas as 3 tabelas usam o padrão já existente em `historical_clients`:
- `SELECT`: qualquer usuário autenticado
- `INSERT/UPDATE/DELETE`: qualquer usuário autenticado

### 3. Migration + seed
A migration cria as 3 tabelas e faz **seed inicial** com os 14 itens de dívida + ~50 linhas do cronograma mensal extraídos do XLSX. Um script Node lê `/tmp/divida.xlsx` localmente e gera o arquivo de migration com os `INSERT INTO ... VALUES (...)` prontos.

### 4. Frontend — `src/pages/DebtFinance.tsx` reescrita

Layout novo espelhando o XLSX:

**Bloco 1 — KPIs (4 cards)**
- Dívida Total: R$ 1.888.786
- Financeiro: R$ 443.552 (23,5%)
- Tributário: R$ 1.445.234 (76,5%)
- Em Atraso (financeiro): R$ 92.824 ⚠️ badge vermelho

**Bloco 2 — Composição por Categoria**
Tabela 6 colunas: Categoria | Subcategoria | Saldo | % Total | Status (badge) | Detalhe

**Bloco 3 — Dívidas Financeiras (detalhe)**
Tabela editável (botão "Editar" → modo edição com inputs):
Dívida | Tipo (badge) | Valor Original | Pago | Saldo | % Pago (barra de progresso) | Parc. Restantes | Próx. Vcto | Status

**Bloco 4 — Dívidas Tributárias (detalhe)**
Subdividida em 3 sub-blocos com sub-headers:
- 4a) SIEF/Empresas Vinculadas (a regularizar) — R$ 604.241
- 4b) PGFN — 4 parcelamentos — R$ 721.413, parcela mensal total R$ 12.415
- 4c) Municipais — R$ 119.579

**Bloco 5 — Gráfico de Amortização Mensal Real**
`BarChart` empilhado lendo `debt_payment_schedule`:
- 7 séries empilhadas (Karen, Paulo, Santander, CEF, Guardian, PGFN, Municipais)
- Eixo X: meses (fev/2025 → jan/2030)
- Eixo Y: R$ por mês
- Tooltip mostra detalhamento por dívida + total

**Bloco 6 — Pizza Financeiro vs Tributário** (já existe variação, ajustar)

**Bloco 7 — Timeline Finance Cycle** (mantém atual)

### 5. Edição no banco (CRUD)
- Botão "Editar" em cada bloco abre inputs inline + botão "Salvar"
- `useFinancialDebts()` hook com React Query: `select`, `update`, `insert`, `delete`
- Após salvar, refresh dos KPIs (recalculados client-side)
- Toast de confirmação

### 6. Limpar dados antigos
- Remover `taxDebtItems` de `src/data/modelData.ts` (não é mais usado em lugar nenhum após a refatoração)
- Manter `debtSchedule` apenas se outros lugares usarem (verificar com grep) — caso contrário, remover
- `DebtFinance.tsx` deixa de importar de `modelData` e passa a usar os hooks do banco

### 7. Integração com Cash Flow (opcional, fora deste escopo se preferir)
A `debt_payment_schedule.total_month` pode ser somada ao output de saída de caixa do mês correspondente em `useOxyCashFlow` — fica como pergunta no final.

---

### Detalhes técnicos

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<ts>_debt_tables.sql` | CREATE TABLE financial_debts, tax_debts, debt_payment_schedule + RLS + seed completo |
| `src/hooks/useFinancialDebts.ts` (novo) | React Query: list, update, insert, delete |
| `src/hooks/useTaxDebts.ts` (novo) | idem |
| `src/hooks/useDebtSchedule.ts` (novo) | apenas SELECT do cronograma mensal |
| `src/pages/DebtFinance.tsx` | Reescrita completa (~400 linhas) com 7 blocos |
| `src/components/debt/EditableDebtRow.tsx` (novo) | Linha editável reutilizável |
| `src/components/debt/AmortizationChart.tsx` (novo) | Extrai gráfico mensal para componente |
| `src/data/modelData.ts` | Remover `taxDebtItems` e `debtSchedule` se não usados em outro lugar |

### Dados a inserir no seed (resumo)

**14 dívidas financeiras + tributárias:**
- 5 financeiras: Karen, Paulo, Santander, CEF, Guardian
- 2 tributárias a regularizar: SIEF Matriz (R$ 567k), Empresas Vinculadas (R$ 37k)
- 4 PGFN: 12996693, 13396849, 15516190, 15574311
- 3 municipais: CWB, FLN, POA

**~50 meses de cronograma** (fev/2025 a jan/2030) com 7 colunas cada.

---

### Pergunta final antes de implementar
A integração do cronograma com o Cash Flow (somar a parcela mensal de dívida ao output de caixa do mês) entra agora ou fica para depois? Sugiro **deixar para depois** — primeiro validamos a página /debt isolada.