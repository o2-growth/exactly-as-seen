

## Auditoria: Assumptions como raiz primária de dados da plataforma

### Resultado da verificação

Após analisar todo o fluxo de dados, **a arquitetura está correta — Assumptions é a raiz primária**. O fluxo funciona assim:

```text
Assumptions (contexto global)
    │
    ▼
computeFullModel(assumptions, scenario)   ← src/engine/calculationsEngine.ts
    │
    ├── years[2025..2030]: AnnualOutput (receita, custos, margens, etc.)
    │     └── monthlyData[0..11]: MonthlyPnL por mês
    │
    └── pnlTree: PnlNode[] (árvore hierárquica do DRE)
          └── applyHistoricalOverrides() sobrescreve 2025 e parcial 2026 com dados reais
```

**Todas as páginas consomem dados via `useFinancialModel()`**, que expõe `model`, `projections`, e `pnlTree` — todos derivados do engine que recebe `assumptions` como input.

### Páginas verificadas e status

| Página | Fonte de dados | Status |
|--------|---------------|--------|
| **Assumptions** | Edita `assumptions` diretamente | ✅ Raiz |
| **P&L (DRE)** | `pnlTree` do engine | ✅ Derivado |
| **Overview** | `projections` + `resolveAnnualMetric` | ✅ Derivado |
| **Cash Flow** | `pnlTree` do engine | ✅ Derivado |
| **Clients Growth** | `assumptions.subProductClients` | ✅ Direto da raiz |
| **Valuation** | `model.years[y]` do engine | ✅ Derivado |
| **Debt/Finance** | `model` + dados estáticos de dívida | ✅ Derivado |

### Problemas encontrados (menores)

**1. Dados hardcoded legados em `pnlData.ts` — código morto**
Os arrays `PNL_TREE`, `MONTHLY_REVENUE_2025` e `MONTHLY_TOTALS_2025` em `src/lib/pnlData.ts` são **constantes hardcoded que NÃO são usadas por nenhum arquivo**. O engine gera seu próprio `pnlTree` via `buildPnlTree()`. Esses dados são vestígios da versão anterior e podem ser removidos para evitar confusão.

**2. Historical overrides para 2025 e 2026 parcial**
O `applyHistoricalOverrides()` sobrescreve os valores calculados pelo engine para 2025 (inteiro) e 2026 (Jan-Mar) com dados reais vindos de `historicalData.ts`. Isso é **correto e intencional** — anos passados devem refletir o realizado, não o projetado. Alterações nas premissas **só afetam anos projetados** (2026 Abr+ em diante, e 2027-2030 inteiros).

**3. Alguns custos usam escalas fixas de 2025**
COGS, SGA, Headcount e Despesas Comerciais para anos > 2025 escalam a partir de bases hardcoded de 2025 (`cogsMonthly2025`, `sgaMonthly2025`, etc.) multiplicadas por um fator de crescimento de receita. Isso é consistente com o modelo Excel de referência, mas significa que esses custos não têm premissas editáveis individuais — eles escalam automaticamente com a receita.

### Plano de ação

Limpar o código morto em `pnlData.ts`, removendo as constantes `PNL_TREE`, `MONTHLY_REVENUE_2025` e `MONTHLY_TOTALS_2025` que não são importadas por nenhum arquivo e podem gerar confusão sobre qual é a fonte real dos dados. Manter apenas o tipo `PnlNode` que é usado pelo engine.

**Nenhuma correção de lógica é necessária** — o fluxo Assumptions → Engine → Todas as páginas está íntegro.

