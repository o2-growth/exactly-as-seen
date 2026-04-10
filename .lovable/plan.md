

## Corrigir valor de receita na barra de título dos subprodutos

### Problema
A barra de título de cada subproduto (coluna de receita, ex: "R$ 2.544.610") usa a função `getAnnualRevenue()` que calcula `clientes × ticket` de forma simplificada. Porém, o "Total ano" dentro da seção expandida usa a lógica detalhada `faturamentoTotal = Base + Incremento - Churn`, que é o valor correto. Os dois divergem.

### Solução
Refatorar `getAnnualRevenue()` (linhas 348-365) para usar a mesma lógica de `faturamentoTotal` que já existe na seção expandida. Isso significa:

1. Para meses históricos com dados da API: usar `apiEntry.total_revenue`
2. Para meses projetados de produtos MRR: calcular `Base + Incremento - Churn` acumulando mês a mês
3. Para meses projetados de produtos não-MRR: calcular `novosClientes × ticket`

A lógica já existe no bloco expandido (linhas ~2130-2296). Ela será extraída para dentro de `getAnnualRevenue()` para que ambos os locais usem o mesmo cálculo.

### Arquivo alterado
| Arquivo | Ação |
|---------|------|
| `src/pages/Assumptions.tsx` | Editar `getAnnualRevenue()` para replicar a lógica de `faturamentoTotal` |

