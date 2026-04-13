# O2 Inc Financial Dashboard — Business Overview

**Autor:** Atlas (Business Analyst)
**Data:** 2026-04-10
**Fontes:** docs/prd.md, docs/brownfield-assessment.md, src/pages/*, src/data/*, supabase/functions/*

---

## TL;DR (1 parágrafo)

O **O2 Inc Financial Dashboard** é uma plataforma proprietária de **modelagem financeira e FP&A** (Financial Planning & Analysis), desenhada para a O2 Inc — uma holding brasileira multi-BU com receita recorrente (CaaS, SaaS, Education, BaaS/Expansão e Tax Services). Ele substitui a dependência de planilhas Excel de 7+ versões por um dashboard web interativo em que o CFO/founder edita premissas (clientes por sub-produto, ticket, churn, crescimento de headcount) e vê em tempo real o impacto em Receita, P&L (DRE), Fluxo de Caixa, Valuation (DCF + múltiplos EBITDA/ARR) e Cap Table. Diferencial: mescla automaticamente dados **realizados** (puxados da base DRE histórica da empresa via Supabase Edge Functions) com **projeções** do motor de cálculo, suportando cenários BASE/BEAR/BULL e versionamento com diff.

---

## Produto

- **Nome:** O2 Inc Financial Dashboard (internamente também chamado "O2 Inc. Financial Modeling & BI Dashboard")
- **Categoria:** Ferramenta interna de **FP&A + BI financeiro** para SaaS/Services holding. Não é um produto comercial — é um "Excel em React" customizado para a realidade da O2 Inc.
- **Tagline sugerida:** "O modelo financeiro vivo da O2 Inc — premissas, DRE, cash flow e valuation em um só lugar, sempre sincronizados com o realizado."
- **Origem:** Gerado inicialmente via **Lovable.dev** (React + Vite + Tailwind + Shadcn/ui + Supabase), depois fortemente customizado manualmente. Migração em curso de planilha Excel v7 para plataforma web. Atualmente em fase brownfield (score de manutenibilidade 6.5/10, PRD de enhancement ativo — E-001/002/003 concluídos).

---

## Usuário-alvo & Contexto

**Perfil primário:** **Founders e C-level da O2 Inc** — Pedro Albite (founder, 70% cap table), Tiago Pisoni (founder, 30%), CFO e equipe de FP&A. O produto claramente foi desenhado para uso interno de um único cliente (a O2 Inc), não como SaaS multi-tenant.

**Perfis secundários esperados:**
- Controller / Analista de FP&A — editando premissas de crescimento, churn, headcount
- Investidores / board — visualizando Overview (KPIs), PnL e Valuation em modo read-only
- Candidatos a investidores em rounds futuros — vendo o Cap Table e projeções de diluição

**Quando é usado:**
- Reuniões mensais de board / management review
- Rodadas de revisão de budget / forecast (trimestral)
- Preparação de conversas com investidores (valuation, cap table, dilution)
- Análise ad-hoc de cenários ("e se crescermos 30% ao invés de 20% em SaaS?")
- Validação de impacto de contratações futuras no P&L

**Setor & tamanho:** Empresa brasileira (PT-BR em toda UI, BRL, tabela DRE no padrão brasileiro, tributação PIS/COFINS/ISS/IRPJ/CSLL). Porte médio — receita bruta na casa dos R$ 500k–800k/mês em 2025 crescendo para milhões, 5 BUs + 15+ sub-produtos, headcount crescendo via ratios cliente/CFO e cliente/FP&A.

---

## Problema que Resolve

### Pain points anteriores (inferidos)
1. **Excel v7 monolítico** — o modelo vivia em uma planilha "Assumptions - DB" que quebrava fórmulas, era difícil de versionar, e apenas 1 pessoa conseguia editar por vez. O código ainda tem comentários "from Excel v7" e replica a estrutura de abas.
2. **Desconexão realizado vs. projetado** — CFO tinha que atualizar manualmente o realizado toda vez que o mês fechava, e as projeções futuras não reaproveitavam o ponto de partida correto.
3. **Sem versionamento de cenários** — impossível comparar "e se alterar o churn agora vs. há 3 semanas" em Excel sem duplicar o arquivo.
4. **Sem drill-down cruzado** — difícil clicar num KPI de Revenue Churn e ver quais clientes específicos caíram ou fizeram downsell.
5. **Cap table em outra ferramenta** — valuation/dilution calculado à parte, sem conexão com EBITDA projetado.
6. **Sem múltiplos cenários coexistentes** — BEAR/BULL/BASE obrigava cópias de planilhas.

### Alternativas anteriores
- Excel (v1 → v7) — ainda é a fonte de verdade para dados históricos (`historicalData.ts` diz "auto-generated from Oxy database")
- Oxy.finance (API externa, ver `fetch-oxy-cashflow`) — fornece cash flow real, mas não modelagem forward-looking
- Banco DRE proprietário (PostgreSQL via `fetch-dre-data` e `explore-dre-db`) — armazena categorias, grupos e itens da DRE histórica

### O que o produto entrega
Uma **única fonte de verdade** onde o realizado vem do banco DRE (automático), as premissas são editadas inline com auto-save, e todas as visões (P&L, Cash Flow, Valuation, Clients Growth) recalculam instantaneamente respeitando a regra de blending (histórico real até onde existe, projeção a partir daí).

---

## Unidades de Negócio Modeladas

| BU | O que é | Sub-produtos modelados |
|----|---------|-----------------------|
| **CaaS** (CFO-as-a-Service) | Serviços de consultoria financeira/BPO para PMEs — o core business original da O2 | Serviços Especializados (Assessoria), Enterprise, Corporate, BPO Financeiro (Setup), Parceiros |
| **SaaS** | Produto de software financeiro (Oxy) vendido como assinatura, com tiers crescentes que incluem "Gênio" (IA) e "Especialista" (humano + IA) | Oxy, Oxy + Gênio, Oxy + Gênio + Especialista, Setup, Parceiros |
| **Education** | Braço de educação/formação em finanças para donos de empresa e profissionais | Dono CFO, Engenheiro de Negócios (EN), Financeiro Raiz (FR), Finance Sales Program (FSP) |
| **Expansão / BaaS** | Modelo de expansão via franquias e Oxy Hacker (marca branca / parcerias) | Oxy Hacker, Franquia, Master Franquia |
| **Tax** | Serviços tributários recorrentes | AT, GPT, RCT, RT, DTC |

Cada sub-produto tem: contagem mensal de clientes (12 meses × 5 anos), ticket médio mensal, taxa de churn e growth rate próprios. A fórmula base é `Receita = Qtd Clientes Mensal × Ticket Mensal`, agregada por BU e depois consolidada.

---

## Features por Página

| Página | Rota | Feature de Negócio | Valor entregue |
|--------|------|--------------------|----------------|
| **Overview** | `/` | Dashboard executivo com KPIs do ano selecionado: Receita Bruta, Receita Líquida, Lucro Bruto, EBITDA, Resultado Líquido, **Rule of 40** (growth % + EBITDA margin). Badges indicando se o ano é histórico, misto ou projetado. Gráficos DRE multi-ano. | Visão de 30s para o C-level: "como estamos?" |
| **P&L (DRE)** | `/pnl` | Árvore expansível do DRE completo (Receita Bruta → Deduções → RL → COGS → LB → Comissões/Mkt → CM → SG&A → EBITDA → Resultado Não Op → EBT → Impostos → Líquido). 3 modos: Annual, Monthly, Summary. **Chart of Accounts customizável** (labels editáveis, linhas ocultáveis). Análise vertical (% sobre receita). | Equivale ao "DRE editável" do Excel, com drill-down por linha e por mês |
| **Cash Flow** | `/cashflow` | Fluxo de caixa baseado em dados realizados da Oxy (via Edge Function) combinado com projeções. Blending histórico/projetado por ano. | Posição de caixa real + runway projetado |
| **Assumptions** | `/assumptions` | Editor central de premissas — 2.425 linhas, a página mais densa do sistema. Sub-seções: Clientes por sub-produto (base + growth % a.m. + churn % a.m.), Tickets médios, COGS config, Commissions, Marketing, **Headcount** (ratios cliente/função, salary ranges), SG&A growth, Macro (Selic, inflação, tax rates), Cenários BASE/BEAR/BULL, Edições manuais célula-a-célula com auto-save. | É o "motor" do modelo — tudo downstream é derivado daqui |
| **Debt & Finance** | `/debt` | Gestão de dívidas bancárias (puxadas de `debtSchedule`), dívidas tributárias, dívidas com investidores, e imóveis (Capex). Calcula Debt-to-EBITDA, serviço mensal total, taxa média ponderada. | Visão consolidada de endividamento e saúde financeira |
| **Valuation** | `/valuation` | **Cap Table** editável (founders, investors, SOP C-Level, SOP Team com % e datas de entrada). Cálculo de valuation por **múltiplo de EBITDA** e **múltiplo de ARR**. Simulação de rodada (raise amount + pre-money valuation → diluição). Projeção multi-ano. | "Quanto vale a O2 Inc hoje e quanto vale em 2028?" + simulação de dilution em funding rounds |
| **Clients Growth** | `/clients-growth` | Drill-down do crescimento de clientes por sub-produto. Segmentação visual por BU. Modo **Planned vs Actual**, drill-down de **Revenue Churn** (churned + downsell) e **Incremento** (novos + upsell). Cálculo de headcount projetado baseado em ratios (clients/CFO, clients/FP&A etc). | Liga o KPI de receita ao operacional: "pra entregar essa receita, preciso contratar quantos CFOs?" |
| **Version History** | `/history` | Timeline de snapshots salvos. Preview read-only de versão antiga, diff entre duas versões, restore. | "Quando e por que mudamos a premissa de churn de 3% pra 5%?" — auditoria de mudanças |
| **Auth / Reset Password** | `/auth`, `/reset-password` | Login/signup via Supabase Auth. | Controle de acesso básico |

---

## Conceitos Financeiros Modelados

| Conceito | Como é modelado | Por que importa |
|----------|-----------------|-----------------|
| **MRR / Receita Recorrente** | `Σ (clientes_mensais × ticket_mensal)` por sub-produto, por mês | Métrica-chave de SaaS/CaaS — define topline |
| **Growth Rate (% a.m.)** | Taxa de crescimento **mensal composta** de clientes, editável por sub-produto e por ano. Auto-aplicada ao blur. | Diferente de % a.a. — labels do UI foram corrigidas explicitamente para evitar confusão |
| **Churn Rate (% a.m.)** | Taxa mensal de saída de clientes. Churn base NÃO é replicada nos meses históricos (regra crítica corrigida no commit `b748a88` area). | Driver principal de shrinkage |
| **Revenue Churn** | Inclui clientes churned **+ downsell** (clientes que caíram de tier). Drill-down clicável mostra ambos. | Commits recentes (4ca4321, dc2cea4) mostram que esta é uma regra de negócio crítica e recém-corrigida |
| **Upsell / Incremento** | Clientes novos **+ upsell** (mudança para tier maior). Parte da linha "Incremento" na composição de receita. | Simétrico ao Revenue Churn |
| **Base de Faturamento** | Receita base do mês = **Total do mês anterior** (não só clientes retidos). Corrigido no commit `b748a88`. | Regra estrutural: evita subestimar a base e quebrar a decomposição Base + Incremento − Churn = Total |
| **Chart of Accounts (COA)** | Árvore hierárquica de contas (`PnlNode`) com labels customizáveis pelo usuário e capacidade de ocultar linhas. Persiste em `assumptions.pnlConfig`. | Permite adaptar o DRE ao vocabulário da empresa sem mexer em código |
| **Deduções (impostos sobre receita)** | PIS (0,65% Presumido / 1,65% Real), COFINS (3% / 7,6%), ISS (5%), Discounts (1%). Muda de regime tributário em 2027+ | Transição de Lucro Presumido para Lucro Real está modelada — decisão fiscal importante |
| **COGS / CPV** | Configuração via `CosConfig` — 6 categorias de custos variáveis com drivers distintos | Permite cenários de sensibilidade em custos |
| **EBITDA** | Calculado via árvore: CM − SG&A − Comercial − Outros | KPI central para valuation |
| **Headcount model** | Ratios `clientsPerCFO`, `clientsPerFPA`, `clientsPerCSM`, etc. Calcula quantas pessoas são necessárias para servir N clientes. `namedEmployees2025` é o baseline. | Liga crescimento de clientes ao custo de pessoal — a maior despesa típica |
| **Headcount cost** | `salaryRanges` por função × headcount projetado + benefícios + reembolsos + `payrollFaturamento` | Input do SG&A |
| **Rule of 40** | Growth % + EBITDA margin ≥ 40% — métrica de saúde SaaS | Card dedicado no Overview |
| **Valuation por múltiplos** | `Valuation = EBITDA × ebitdaMultiple` ou `ARR × arrMultiple`. Múltiplos editáveis. | Aproximação padrão M&A |
| **Cap Table & Dilution** | Ownership % por tipo (Founder/Investor/SOP), simulação de raise (raise amount + pre-money → post-money, dilution %) | Prepara conversas com investidores |
| **Cenários (BASE/BEAR/BULL)** | `SCENARIO_MULTIPLIERS` aplicados sobre premissas. Troca de cenário sem perder edições. | Análise de sensibilidade |
| **Debt-to-EBITDA** | Total debt / EBITDA 2025 | Covenant / health check |
| **Selic & Inflação** | Série histórica + projeção — influencia custo de dívida e financeiras | (Nota: `selicMonthly` está listado como dead field no PRD E-007 — ainda não 100% conectado) |

---

## Regras de Negócio Críticas

Estas são as regras que, se alteradas sem conhecimento de contexto, quebram o modelo:

1. **Blending de período (realizado vs projetado)** — 2025 = 100% histórico. 2026 = 3 meses reais (Jan–Mar 2026) + 9 meses projetados. 2027+ = 100% engine. Está hardcoded em `HISTORICAL_PERIODS` e na função `getYearDataSource`.
2. **Base do mês = Total do mês anterior**, não "retidos do mês anterior" (commit `b748a88`). Crítico pra composição Base + Incremento − Churn = Total fazer sentido.
3. **Receita histórica usa valores exatos por cliente**, não ticket médio (commit `905517a`). Garantir que cálculos retroativos batem com o DRE real.
4. **Revenue Churn inclui downsell; Incremento inclui upsell** (commit `4ca4321`). Essas não são categorias exclusivas — são agregações.
5. **Churn base NÃO pode replicar valores para meses históricos** — deve respeitar `isHistorical()`.
6. **Manual edits em células NÃO são sobrescritas** quando o usuário clica "Aplicar" growth rate — `manualFlags` preserva overrides explícitos.
7. **`setAssumptions` deve ser funcional** (`prev => ...`), nunca passar objeto direto — há risco de stale closure documentado no PRD.
8. **Regime tributário muda em 2027** (Lucro Presumido → Lucro Real) — PIS/COFINS sobem significativamente. Modelado mas não parametrizado pelo usuário.
9. **Anual = soma de 12 meses** (não valor de dezembro) — erro histórico documentado e corrigido.
10. **Engine deve ler de `assumptions`** — `sgaGrowthRate`, `headcountGrowth`, `headcountRatios`, `salaryRanges` precisam estar conectados (E-002 concluído).
11. **Snapshot ativo único por usuário + cenário** — só um `assumptions_snapshots.is_active = true` por combinação user_id + scenario.

---

## Integração com Dados Reais

Três Edge Functions Supabase conectam o dashboard a dados externos reais:

### `fetch-dre-data`
- Conecta em um **banco PostgreSQL externo** de DRE (host/porta/user via env vars `DRE_DB_*`)
- Queries: `dre_groups`, `dre_data` (valores por período), `dre_category_items` (detalhe por item), `categories`
- Retorna a estrutura completa da DRE histórica da O2 Inc para alimentar `historicalData.ts` (parece ser pré-processado em build time — arquivo tem header "Auto-generated from Oxy database — do not edit manually, Generated: 2026-03-12")
- **Vulnerabilidade conhecida:** SQL injection via template literals (PRD E-004)

### `fetch-oxy-cashflow`
- Conecta em **api.oxy.finance** (produto SaaS da própria O2) usando `OXY_API_KEY`
- Parâmetros: CNPJ da O2 (23.813.779/0001-60), startDate, endDate
- Busca 3 endpoints em paralelo: card/details (recebido), card/details (pago), chart/fluxo-caixa
- Alimenta a página `/cashflow` com posição de caixa real mensal
- Hook frontend: `useOxyCashFlow`

### `explore-dre-db`
- Função de exploração genérica do banco DRE — **alvo de remoção ou gating admin** (PRD E-004 story 3)
- Usada em dev/debug, não em produção

### Dados históricos pré-processados (`src/data/historicalData.ts`)
Contém 15 períodos de dados reais (2025-01 até 2026-03) já congelados no código — gerados a partir do banco DRE. Estruturas:
- `historicalMetrics` — RECEITA BRUTA, RECEITA LÍQUIDA, LUCRO BRUTO, EBITDA, etc por mês
- `historicalRevenue`, `historicalDeductions`, `historicalCosts`, `historicalExpenses`, `historicalFinancial`
- Total: ~15 meses de "verdade do campo" que o motor de blending usa pra substituir valores projetados

**Conclusão:** Sim, há integração com dados reais, mas ela é **semi-automática** — o snapshot histórico é regenerado periodicamente (último: 2026-03-12) e commitado no código. Cash flow em runtime via Oxy API. Não há (ainda) fetch em tempo real da DRE durante navegação.

---

## Questões em Aberto

1. **Multi-tenant ou single-tenant?** O produto tem autenticação Supabase com `user_id` no schema, mas todo o conteúdo (BUs, sub-produtos, base histórica, CNPJ, founders no cap table) é hardcoded pra O2 Inc. É uma ferramenta interna? Há planos de SaaS-ificar pra outros CFOs brasileiros?
2. **Dono do produto / governança** — quem define quando o `historicalData.ts` é regenerado? Há um job automatizado ou é manual? 2026-03-12 é a data do último refresh.
3. **Cenários BASE/BEAR/BULL** — os multipliers estão definidos, mas há uso real? Os usuários criam cenários nomeados ou só alternam entre os 3 fixos?
4. **Version History — retenção?** Há limite de versões armazenadas? Política de expiração?
5. **`selicMonthly`, `sgaPercent`, `hcEmployees`** — PRD E-007 lista como "dead fields" — estão na UI mas não impactam output. Devem ser conectados ou removidos? (Atlas nota: pode confundir o usuário se continuar lá "decorativo")
6. **Oxy é produto da O2 ou ferramenta independente?** `fetch-oxy-cashflow` usa `api.oxy.finance` com o CNPJ da O2 — é a própria O2 vendendo Oxy pra si mesma? Entender essa relação é importante para modelar receita de SaaS sem double-counting.
7. **Cap Table em localStorage** — `o2-cap-table` está em localStorage + `assumptions.capTable` no Supabase. Há risco de divergência entre browsers/dispositivos do mesmo founder. É consciente?
8. **Idioma** — 100% PT-BR na UI. Isso é restrição estratégica (clientes BR only) ou limitação temporária?
9. **"ClientsGrowth" com modo Actual** — a feature permite inserir actual data manualmente. Isso compete com o DRE fetch automático? Qual prevalece quando há conflito?
10. **Não há página de Forecast Accuracy** — como a equipe mede se as projeções estavam certas vs. realizado? Seria um próximo passo natural dada a existência do blending.

---

## Referências

- `docs/prd.md` — fonte canônica de epics e enhancement plan
- `docs/brownfield-assessment.md` — auditoria inicial de Atlas (2026-03-31)
- `docs/architecture-review.md` — auditoria de Aria (não lida neste discovery)
- `docs/database-audit.md` — auditoria de Dara (não lida neste discovery)
- `src/data/historicalData.ts` — snapshot DRE real (gen 2026-03-12)
- `src/data/modelData.ts` — baseline Excel v7 (tickets, churn, debt schedule, salary ranges)
- `supabase/functions/fetch-dre-data/` — integração com banco DRE proprietário
- `supabase/functions/fetch-oxy-cashflow/` — integração com api.oxy.finance
