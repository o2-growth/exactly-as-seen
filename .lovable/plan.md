

# Corrigir edição mensal de clientes e ticket

## Problemas identificados

1. **Edição mensal não afeta o modelo**: `handleClientChange` atualiza apenas `growthRates` (estado local da página), mas nunca propaga o resultado para `assumptions.subProductClients[key][year]` — que é o que o engine usa. Resultado: editar clientes mês a mês não muda nada no modelo.

2. **Ticket é por mês, não geral**: O ticket exibido é um valor único por produto. O usuário quer poder definir ticket médio mensal, que já está correto no label ("Ticket R$/mês") — mas precisa validar que o engine usa corretamente como mensal.

## Solução

### `src/pages/Assumptions.tsx`

**A. Propagar edição mensal para o annual target:**
- No `handleClientChange`, após atualizar `growthRates`, recalcular o valor de Dezembro resultante e atualizar `assumptions.subProductClients[key][year]` com o novo valor de Dez. Isso faz o engine recalcular tudo.
- Lógica: depois de setar a nova growth rate, recomputar `computeProjectedClients` com a nova growth array e pegar `monthly[11]` (Dez) como o novo annual target.

**B. Propagar "Aplicar %" para o annual target também:**
- `handleApplyRow` e `handleApplyAll` devem igualmente recalcular o Dez resultante e atualizar `subProductClients`.

**C. Ticket — validar label e uso:**
- O label já diz "Ticket (R$/mês)" — está correto.
- Verificar no engine que `tickets[key]` é usado como valor mensal por cliente (multiplicado por clientes para dar MRR). Se estiver sendo usado como anual, corrigir a multiplicação.

### Detalhes técnicos

No `handleClientChange`:
```typescript
// Após atualizar growthRates, recalcular o Dec target
const newGrowthArr = [...currentGrowthArr];
newGrowthArr[monthIdx] = backCalcGrowth;
const newMonthly = computeProjectedClients(key, year, newGrowthArr, monthlyChurn, data.subProductClients, data.tickets);
const newDecTarget = newMonthly[11];

// Atualizar subProductClients com o novo target de Dezembro
setAssumptions(prev => ({
  ...prev,
  subProductClients: {
    ...prev.subProductClients,
    [key]: { ...prev.subProductClients[key], [year]: newDecTarget },
  },
}));
```

Mesma lógica para `handleApplyRow` e `handleApplyAll`.

