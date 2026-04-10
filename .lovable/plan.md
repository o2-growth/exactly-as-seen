

## Corrigir exemplos do Formula Explainer: usar mês representativo em vez de sempre Janeiro

### Problema
Os exemplos numéricos no popover do Formula Explainer sempre usam `monthly[0]` (Janeiro) para montar a string. Em 2025, muitos subprodutos começam apenas em Abril (Jan-Mar = 0), então o exemplo mostra valores zerados ou irrelevantes. O exemplo deveria usar o **primeiro mês com dados significativos** (não-zero).

### Solução

#### `src/lib/formulaExplainer.ts`

1. Criar um helper interno `findRepresentativeMonth(monthly: number[]): number` que retorna o índice do primeiro mês com valor > 0 (fallback para 0 se todos forem zero).

2. Atualizar as 8 funções que geram `example` para usar esse mês representativo em vez de sempre `[0]`:

| Função | Antes | Depois |
|--------|-------|--------|
| `explainRevenue` | Usa média fixa | Usa mês representativo para o exemplo pontual |
| `explainClients` | `monthly[0]` (Jan) | `monthly[m]` onde m = primeiro mês > 0 |
| `explainChurn` | `monthly[0]` | `monthly[m]` com nome do mês correto |
| `explainNovosClientes` | `monthly[0] - prevDec` | `monthly[m] - monthly[m-1]` |
| `explainClientesAtivos` | `prevDec → Jan` | `monthly[m-1] → monthly[m]` |
| `explainFaturamentoBase` | `fatBase[0]` | `fatBase[m]` |
| `explainIncremento` | `incremento[0]` (Jan) | `incremento[m]` |
| `explainRevenueChurn` | `prevDec × rate[0]` | `monthly[m-1] × rate[m]` |

3. As strings de exemplo passarão a mostrar o nome do mês correto (ex: "Abr/2025" em vez de "Jan/2025") usando o array `MONTHS` de `monthlyData.ts`.

### Exemplo de resultado esperado
Antes: `"Ex: 0 ativos × 2.00% = 0.0 churns (Jan/2025)"`
Depois: `"Ex: 6 ativos × 2.00% = 0.1 churns (Abr/2025)"`

### Arquivos alterados
| Arquivo | Ação |
|---------|------|
| `src/lib/formulaExplainer.ts` | Editar — helper `findRepresentativeMonth` + atualizar `example` em 8 funções |

