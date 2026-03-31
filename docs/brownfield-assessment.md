# Brownfield Assessment - O2 Inc. Financial Modeling Dashboard

**Data:** 2026-03-31
**Fase:** 0.1 - Analise do Codebase (Atlas - Analyst)

---

## 1. Visao Geral do Projeto

**Nome:** O2 Inc. - Financial Modeling & BI Dashboard
**Dominio:** Modelagem financeira, projecoes de receita multi-BU, analise P&L, fluxo de caixa e valuation para empresas brasileiras.
**Publico-alvo:** CFOs, analistas financeiros, fundadores de empresas.

---

## 2. Stack Tecnologico

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Framework | React | 18.3.1 |
| Linguagem | TypeScript | 5.8.3 |
| Build Tool | Vite | 5.4.19 |
| Estilizacao | Tailwind CSS | 3.4.17 |
| UI Components | Shadcn/ui (Radix UI) | Diversas |
| Graficos | Recharts | 2.15.4 |
| Roteamento | React Router | 6.30.1 |
| Server State | TanStack React Query | 5.83.0 |
| Backend/Auth | Supabase | 2.99.1 |
| Formularios | React Hook Form + Zod | 7.61.1 / 3.25.76 |
| Testes | Vitest + Testing Library | 3.2.4 / 16.0.0 |
| Gerador | Lovable.dev | - |

---

## 3. Estrutura de Arquivos

```
src/
├── App.tsx                    # Router principal
├── main.tsx                   # Entry point
├── contexts/
│   ├── FinancialModelContext.tsx  # Estado central (assumptions, calculos, cenarios)
│   └── VersionHistoryContext.tsx  # Historico de versoes com diff
├── engine/
│   └── calculationsEngine.ts     # Motor de calculos financeiros (~1000+ linhas)
├── pages/
│   ├── Overview.tsx           # Dashboard KPIs
│   ├── PnL.tsx                # Demonstracao de resultados (DRE)
│   ├── CashFlow.tsx           # Fluxo de caixa
│   ├── Assumptions.tsx        # Editor de premissas (41KB+)
│   ├── Valuation.tsx          # Cap table e valuation
│   ├── ClientsGrowth.tsx      # Crescimento de clientes
│   ├── VersionHistory.tsx     # Timeline de versoes
│   ├── Auth.tsx               # Login/Signup
│   └── ResetPassword.tsx      # Reset de senha
├── components/
│   ├── ui/                    # 50+ componentes Shadcn/ui
│   ├── layout/                # AppLayout, AppHeader, AppSidebar, PeriodFilter
│   ├── auth/                  # ProtectedRoute
│   ├── assumptions/           # InlineEditCell, CurrencyInput, ExpandableMonthRow
│   ├── overview/              # RuleOf40
│   └── period/                # DataSourceBadge
├── hooks/
│   ├── useAssumptionsPersistence.ts  # Persistencia localStorage + Supabase
│   ├── useOxyCashFlow.ts      # Dados de cash flow da API
│   ├── useDreData.ts          # Dados DRE da API
│   └── use-mobile.tsx         # Responsividade
├── lib/
│   ├── calculationsEngine.ts  # (ou em engine/)
│   ├── financialData.ts       # Dados financeiros auxiliares
│   ├── monthlyData.ts         # Dados mensais
│   ├── pnlData.ts             # Dados de P&L
│   ├── periodResolution.ts    # Logica de blending (realizado vs projetado)
│   ├── formatters.ts          # Formatacao de valores
│   ├── supabase-safe.ts       # Wrapper seguro do Supabase
│   └── utils.ts               # Utilidades gerais
├── data/
│   ├── modelData.ts           # Dados do modelo financeiro
│   ├── historicalData.ts      # Dados historicos
│   └── headcountData.ts       # Dados de headcount
├── integrations/supabase/
│   ├── client.ts              # Configuracao do cliente Supabase
│   └── types.ts               # Tipos gerados do Supabase
└── test/                      # Testes unitarios
    ├── setup.ts
    ├── example.test.ts
    ├── contexts/              # Testes de contexto
    ├── components/            # Testes de componentes
    ├── lib/                   # Testes de utilidades
    ├── data/                  # Testes de dados
    └── engine/                # Testes do motor de calculos
```

---

## 4. Arquitetura de Dados

### Fluxo de Dados (Unidirecional)
```
Input do Usuario (Assumptions)
  → FinancialModelContext.setAssumptions()
  → Calculation Engine (processa assumptions + dados historicos)
  → FullModelOutput (arvore P&L, metricas anuais/mensais)
  → Context deriva visoes especializadas (projecoes, cenarios)
  → Componentes de pagina consomem via useFinancialModel()
  → UI renderiza graficos, tabelas, KPIs
```

### Logica de Blending (Periodo)
- **2025:** Dados historicos completos (Jan-Dez)
- **2026:** 3 meses historicos + 9 meses projetados (modo misto)
- **2027+:** Apenas projecoes do motor

### Persistencia
| Chave localStorage | Conteudo |
|---------------------|---------|
| `o2_assumptions` | Snapshot de premissas ativo |
| `o2_version_history` | Timeline de versoes |
| `o2_coa_labels` | Labels customizados do plano de contas |
| `o2_coa_hidden` | Visibilidade de linhas do COA |
| `o2-cap-table` | Cap table de acionistas |
| `o2-total-shares` | Total de acoes |

---

## 5. Modelo de Negocios (Unidades de Negocio)

### Produtos por BU
| BU | Sub-produtos |
|----|-------------|
| **CaaS** | Assessoria, Enterprise, Corporate, Setup |
| **SaaS** | Oxy, Oxy+Genio, Oxy+Genio+Especialista, Setup, Platform |
| **Education** | Dono CFO, CAC |
| **Expansao/BaaS** | Assinatura |
| **Tax** | AT, GPT, RCT, RT, DTC |

### Formula de Receita
```
Receita = Qtd Clientes Mensal × Ticket Mensal (por sub-produto)
```

### Arvore P&L
```
1. Receita Bruta
2. (-) Deducoes (PIS, COFINS, ISS, CSLL, ICMS, IRRF)
NR. Receita Liquida
3. (-) CPV/COGS (6 categorias)
GP. Lucro Bruto
4. (-) Comissoes
5. (-) Marketing
CM. Margem de Contribuicao
6. (-) SG&A (Salarios, beneficios, admin)
7. (-) Comercial
8. (-) Outros
EBITDA
9. (+/-) Resultado Nao Operacional
EBT
10. (-) Impostos (IRPJ, CSLL)
11. Resultado Liquido
```

---

## 6. Integracao Supabase

### Tabela: `assumptions_snapshots`
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| scenario | enum | BASE, BEAR, BULL |
| name | text | Nome do snapshot |
| assumptions | jsonb | Objeto Assumptions completo |
| is_active | boolean | Snapshot ativo |
| created_at | timestamp | Criacao |
| updated_at | timestamp | Atualizacao |

### Edge Functions
- `fetch-oxy-cashflow` - Busca dados de cash flow
- `fetch-dre-data` - Busca dados da DRE
- `explore-dre-db` - Exploracao do banco DRE

---

## 7. Rotas da Aplicacao

| Rota | Pagina | Acesso |
|------|--------|--------|
| `/` | Overview (Dashboard) | Protegido |
| `/pnl` | P&L (DRE) | Protegido |
| `/cashflow` | Cash Flow | Protegido |
| `/assumptions` | Premissas | Protegido |
| `/debt` | Divida | Protegido |
| `/valuation` | Valuation & Cap Table | Protegido |
| `/history` | Historico de Versoes | Protegido |
| `/auth` | Login/Signup | Publico |
| `/reset-password` | Reset Senha | Publico |

---

## 8. Divida Tecnica Identificada

### Critica
1. **TypeScript frouxo:** `strictNullChecks: false`, `noImplicitAny: false` — risco de bugs em runtime
2. **Credenciais hardcoded:** `supabase-safe.ts` contem chaves fallback no codigo
3. **Componentes monoliticos:** `Assumptions.tsx` (41KB+), `calculationsEngine.ts` (1000+ linhas)

### Alta Prioridade
4. **Cobertura de testes insuficiente:** Motor de calculos financeiros com testes limitados
5. **Context overloaded:** `FinancialModelContext` gerencia state + calculos + migracoes + cenarios
6. **localStorage fragil:** Chaves hardcoded, sem tratamento de erros, sem sync entre abas
7. **Sem resolucao de conflitos:** Edits simultaneos em abas/dispositivos nao tratados

### Media Prioridade
8. **Recalculo completo:** Qualquer mudanca recalcula todo o modelo P&L (sem granularidade)
9. **Baseline historico hardcoded:** Dez 2025 como referencia — fragil para anos futuros
10. **Mapeamento de sub-produtos por string:** Propenso a erros de typo no engine
11. **Logica de migracoes no Context:** Deveria ser utilidade separada

### Baixa Prioridade
12. **Sem caching de calculos:** P&L tree recalculada a cada mudanca de assumption
13. **Sem error boundaries:** Erros em componentes podem crashar a app inteira
14. **Imports nao organizados:** Sem regras de ordenacao de imports no ESLint

---

## 9. Pontos Fortes

- Separacao clara de responsabilidades (pages, components, contexts, utils)
- Logica de negocios abrangente (15+ sub-produtos, cenarios, versionamento)
- UI responsiva e moderna com Tailwind/Shadcn
- Degradacao graceful (fallback localStorage quando Supabase indisponivel)
- Estruturas de dados financeiros tipadas
- Versionamento com diff tracking
- Gerado via Lovable.dev com customizacoes manuais

---

## 10. Score de Manutenibilidade

**Nota: 6.5/10**

| Aspecto | Score | Comentario |
|---------|-------|-----------|
| Estrutura e naming | 8/10 | Clara e consistente |
| Cobertura funcional | 8/10 | Modelo financeiro completo |
| Type safety | 4/10 | Settings frouxos |
| Testes | 3/10 | Cobertura minima |
| Performance | 5/10 | Recalculos desnecessarios |
| Seguranca | 5/10 | Credenciais no codigo |
| Modularidade | 6/10 | Alguns arquivos muito grandes |
| Escalabilidade | 5/10 | Context API tem limites |

---

## Proximos Passos (Fase 0.2)

→ Revisao de Arquitetura com `/agents:architect` (Aria)
→ Auditoria de Banco de Dados com `/agents:data-engineer` (Dara)
