

# Corrigir edição mensal de clientes (e ticket) — abordagem com overrides diretos

## Problema raiz

O grid mensal de clientes usa duas camadas de cálculo que se anulam:

1. `getMonthlyClients()` faz interpolação geométrica do target Dec → gera base mensal
2. `computeProjectedClients()` aplica growth rates + churn sobre essa base
3. Quando o usuário edita um mês, o código back-calcula growth rate E atualiza o target Dec
4. Mas ao atualizar o Dec target, a interpolação geométrica muda TODOS os meses → o valor editado é sobrescrito

É por isso que "não funciona" — o valor entra mas é imediatamente recalculado.

## Solução: overrides mensais diretos

Em vez de tentar converter edição mensal em growth rates + Dec target, vamos guardar os valores mensais editados diretamente (como já se faz com `monthlyTickets`).

### 1. Adicionar `monthlyClientOverrides` ao tipo Assumptions

Em `src/lib/financialData.ts`:
```typescript
monthlyClientOverrides?: Partial<Record<SubProductKey, Partial<Record<Year, number[]>>>>;
```

Um array de 12 posições por produto/ano. Se existir, o mês usa o valor do override. Se não, usa a projeção geométrica normal.

### 2. Atualizar `getMonthlyClients` para respeitar overrides

Em `src/lib/monthlyData.ts`: aceitar parâmetro opcional `monthlyClientOverrides`. Se o produto/ano tiver override para o mês, usar esse valor. Senão, projeção normal.

### 3. Simplificar `handleClientChange`

Em `src/pages/Assumptions.tsx`: quando o usuário edita um mês, simplesmente gravar no `monthlyClientOverrides[key][year][monthIdx]` via `setAssumptions`. Remover toda a lógica de back-calculate growth rate + update Dec target.

### 4. Atualizar o engine para usar os overrides

Em `src/engine/calculationsEngine.ts`: passar `monthlyClientOverrides` para `getMonthlyClients` para que a receita mensal reflita os valores editados.

### 5. Ticket mensal — já funciona via `monthlyTickets`, apenas garantir que o grid no card expandido está usando `setAssumptions` direto (não `updateModel`)

## Arquivos

- `src/lib/financialData.ts` — adicionar tipo `monthlyClientOverrides`
- `src/lib/monthlyData.ts` — `getMonthlyClients` aceitar e usar overrides
- `src/pages/Assumptions.tsx` — simplificar `handleClientChange`, usar overrides diretos
- `src/engine/calculationsEngine.ts` — passar overrides ao calcular receita mensal

## Resultado esperado

- Editar cliente no mês 5 → valor fica no mês 5, não é recalculado
- Outros meses sem override continuam com projeção geométrica normal
- Receita, MRR e KPIs refletem os valores editados
- Meses históricos continuam travados (🔒)

