

## Corrigir totais de receita por BU (Total SaaS, Total Education, etc.)

### Problema
Os subtotais de receita por categoria (linhas "Total SaaS", "Total Education", etc.) usam a fórmula simplificada `clientes × ticket` (linhas 2750-2754), enquanto os valores individuais na barra de título de cada subproduto já usam `getAnnualRevenue()` com a lógica correta de `Base + Incremento - Churn`. Isso causa divergência entre a soma visual das linhas e o total exibido.

### Solução
Substituir o cálculo inline nas linhas 2750-2754 por uma soma de `getAnnualRevenue()` para cada subproduto do grupo — a mesma função já usada nas barras de título individuais.

### Alteração

**`src/pages/Assumptions.tsx`** — linhas 2749-2755

Antes:
```tsx
{formatCurrency(group.items.reduce((sum, row) => {
  if (!row.dataKey || excludedFromTotal[row.dataKey]) return sum;
  const mc = getMonthlyClients(...);
  const tk = data.tickets[...] ?? 0;
  return sum + mc.reduce((s, v, i) => s + v * (...), 0);
}, 0))}
```

Depois:
```tsx
{formatCurrency(group.items.reduce((sum, row) => {
  if (!row.dataKey || excludedFromTotal[row.dataKey]) return sum;
  return sum + getAnnualRevenue(row.dataKey as SubProductKey, selectedYear);
}, 0))}
```

Isso garante que o total da BU seja exatamente a soma dos valores mostrados em cada linha individual.

