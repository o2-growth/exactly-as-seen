

## Adicionar Exemplo Numérico ao Explicador de Fórmulas

### Objetivo
Incluir uma seção "Exemplo" em cada popover do Formula Explainer, mostrando a conta com os números reais substituídos na fórmula.

### Alterações

#### 1. `src/lib/formulaExplainer.ts` — Adicionar campo `example` ao `FormulaExplanation`

- Adicionar `example?: string` à interface `FormulaExplanation`
- Em cada função (`explainRevenue`, `explainClients`, `explainTicket`, `explainChurn`, `explainTaxEffective`, `explainCOS`, `explainKPI`, `explainNovosClientes`, `explainClientesAtivos`, `explainFaturamentoBase`, `explainIncremento`, `explainRevenueChurn`), gerar uma string de exemplo com os números reais:
  - `explainRevenue`: `"Ex: 21 clientes × R$ 25.000 = R$ 525.000/mês → R$ 6.300.000/ano"`
  - `explainClients`: `"Ex: 18 (Dez/2024) + 5 novos − 2 churn = 21 (Jan/2025)"`
  - `explainTicket`: `"Ex: R$ 25.000 × (1 + 0,5%)^12 = R$ 26.534 (Dez)"`
  - `explainChurn`: `"Ex: 21 ativos × 2,00% = 0,42 churns (Jan)"`
  - `explainTaxEffective`: `"Ex: 0,65% + 3,00% + 5,00% + (32% × 15%) + (32% × 9%) = 16,33%"`
  - `explainCOS`: `"Ex: ceil(21/7) = 3 PFDs × R$ 8.000 × 12 = R$ 288.000"`
  - `explainKPI`: cada KPI com seus números somados
  - `explainFaturamentoBase`: `"Ex: 18 clientes × R$ 25.000 = R$ 450.000 (Jan)"`
  - `explainIncremento`: `"Ex: 3 novos × R$ 25.000 = R$ 75.000 (Jan)"`
  - `explainRevenueChurn`: `"Ex: 0,42 churns × R$ 25.000 = R$ 10.500 (Jan)"`
  - `explainNovosClientes`: `"Ex: 21 (Jan) − 18 (Dez anterior) + 0 churn = 3 novos"`
  - `explainClientesAtivos`: `"Ex: 18 (Dez/2024) + 3 novos − 0 churn = 21 (Jan/2025)"`

Cada example usará os valores reais já calculados dentro da função (jan, dec, prevDec, ticketBase, rates etc.), montando uma string legível.

#### 2. `src/components/assumptions/FormulaExplainer.tsx` — Renderizar o exemplo

- Após a seção de steps e antes do resultado, adicionar um bloco condicional:
```text
{explanation.example && (
  <div className="bg-muted/50 rounded px-2 py-1.5">
    <span className="text-[10px] font-semibold text-muted-foreground">EXEMPLO</span>
    <p className="text-[11px] font-mono text-foreground mt-0.5">{explanation.example}</p>
  </div>
)}
```

### Resumo
| Arquivo | Ação |
|---------|------|
| `src/lib/formulaExplainer.ts` | Editar — adicionar campo `example` com cálculo numérico real em todas as 12 funções |
| `src/components/assumptions/FormulaExplainer.tsx` | Editar — renderizar bloco "EXEMPLO" no popover |

