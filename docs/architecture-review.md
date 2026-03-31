# Architecture Review - O2 Inc. Financial Modeling Dashboard

**Data:** 2026-03-31
**Fase:** 0.2 - Revisao de Arquitetura (Aria - Architect)

---

## A. Padrao Arquitetural Atual

**Context-Based Monolith com Estado Centralizado**

```
Input do Usuario (Assumptions.tsx - 137KB / 2425 linhas)
  → FinancialModelContext.tsx (estado central)
  → calculationsEngine.ts (1796 linhas, calculos puros)
  → FullModelOutput (P&L tree + metricas mensais/anuais)
  → 12+ paginas consomem via useFinancialModel()
  → Recharts renderiza graficos
```

### Provider Nesting
```
QueryClientProvider
  └─ TooltipProvider
      └─ Toaster/Sonner
          └─ FinancialModelProvider ← Todas as paginas subscrevem
              └─ VersionHistoryProvider
                  └─ BrowserRouter → Routes
```

**Problema**: Auth pages nao precisam do FinancialModelProvider.

---

## B. Gargalos de Escalabilidade

### 1. State Management (CRITICO)
- Qualquer mudanca de assumption re-renderiza TODOS os 86+ consumidores do contexto
- Nao ha subscricoes seletivas (Context API nao suporta)
- Limite: ~50+ edicoes/segundo ou 100+ componentes consumidores

### 2. Rendering Performance (MODERADO)
| Componente | Problema | Risco |
|-----------|---------|-------|
| Assumptions.tsx (137KB) | 300+ inputs, re-render completo | ALTO |
| Overview.tsx | 4+ Recharts sem memoization | MODERADO |
| PnL.tsx | Tree recursiva 400+ linhas | MODERADO |
| Valuation.tsx | Matriz sensibilidade 10x10 | MODERADO |

### 3. Engine (BAIXO)
- ~3600 operacoes atomicas por computeFullModel()
- ~5-15ms em hardware moderno
- useMemo previne recalculos desnecessarios
- Problema: sempre recalcula TUDO (sem granularidade)

---

## C. Postura de Seguranca

| Problema | Severidade | Detalhes |
|---------|-----------|---------|
| Chaves hardcoded em supabase-safe.ts | ALTA | Anon key exposta no source |
| XSS em custom labels (PnL.tsx) | MEDIA | Labels do localStorage sem sanitizacao |
| Sem session timeout | MEDIA | Sessoes idle permanecem autenticadas |
| localStorage como storage de tokens | MEDIA | Vulneravel a XSS |

---

## D. Melhorias Recomendadas (Priorizadas)

### Tier 1: Alto Impacto / Baixo Esforco (QUICK WINS)

| # | Melhoria | Esforco | Risco | Tempo |
|---|---------|---------|-------|-------|
| A1 | Separar FinancialModelContext em 3 contextos (Assumptions, ModelCompute, Persistence) | S | Baixo | 4-6h |
| A2 | React.memo() nos graficos Recharts | XS | Baixo | 1-2h |
| A3 | Mover blending historico para engine | S | Baixo | 2-3h |
| A4 | Remover chaves hardcoded do source | XS | Baixo | 30min |
| A5 | useCallback nos handlers de Assumptions | S | Baixo | 2-3h |

### Tier 2: Alto Impacto / Alto Esforco (ESTRATEGICO)

| # | Melhoria | Esforco | Risco | Tempo |
|---|---------|---------|-------|-------|
| B1 | Refatorar Assumptions.tsx em 7+ componentes modulares | L | Medio | 16-20h |
| B2 | Migrar Context API → Zustand | L | Medio | 20-25h |
| B3 | Engine incremental (cache por ano) | L | Medio | 15-18h |
| B4 | TypeScript strict mode (incremental) | M | Medio | 10-12h |

### Tier 3: Medio Impacto / Baixo Esforco (POLIMENTO)

| # | Melhoria | Esforco | Risco | Tempo |
|---|---------|---------|-------|-------|
| C1 | Memoizar PnL tree traversal | S | Baixo | 2-3h |
| C2 | Error boundaries por secao | S | Baixo | 2-3h |
| C3 | Sanitizar custom labels (XSS) | XS | Baixo | 30min |

---

## E. Roadmap de Migracao

### Fase 1: Fundacao (Semanas 1-2)
- [A4] Remover chaves hardcoded
- [A3] Mover blending historico para engine
- [A1] Separar FinancialModelContext
- [C3] Sanitizar labels
- [C2] Error boundaries

### Fase 2: Decomposicao (Semanas 3-4)
- [B1] Refatorar Assumptions.tsx
- [A2] React.memo nos charts
- [A5] useCallback nos handlers

### Fase 3: State Management (Semanas 5-7)
- [B2] Migrar para Zustand (gradual)

### Fase 4: Performance (Semanas 8-9)
- [B3] Engine incremental com cache

### Fase 5: TypeScript & Polish (Semanas 10-11)
- [B4] Strict mode incremental
- [C1] Memoizar PnL tree
- Testes abrangentes (>80% coverage)

### Resultado Esperado
| Metrica | Antes | Depois |
|---------|-------|--------|
| Render performance | Baseline | +50-80% |
| Assumptions.tsx | 2425 linhas | ~400 linhas |
| Runtime bugs | Baseline | -30% |
| Test coverage | ~10% | >80% |
| Security issues | 4 criticas | 0 |

---

## F. Resumo

A arquitetura atual e **solida para a escala presente** (12 paginas, 6 anos de projecao) mas precisa de melhorias para crescer. Os quick wins (Tier 1) podem ser implementados em 2 semanas com impacto imediato. As mudancas estrategicas (Tier 2) precisam de 2-3 meses mas transformam o projeto em production-grade.
