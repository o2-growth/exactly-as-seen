

# Fix: edição de um mês alterando todos os outros

## Problema

Quando você edita um mês (ex: coloca 6 em Abril), TODOS os meses seguintes também ficam com ~6. Isso acontece porque a função `computeProjectedClients` usa uma lógica de crescimento sequencial: `prev * (1 + growth - churn)`. Quando o override muda `prev` para 6, os meses seguintes calculam a partir de 6.

A interpolação geométrica correta (que distribui os valores entre a base e o target de dezembro) está em `getMonthlyClients` no `monthlyData.ts` — mas o grid da UI usa `computeProjectedClients` que sobrescreve essa lógica com growth rates.

## Solução

Eliminar `computeProjectedClients` do grid de exibição do card expandido. Usar diretamente `getMonthlyClients` (que já aplica overrides corretamente sobre a interpolação geométrica).

### `src/pages/Assumptions.tsx`

1. **Linha ~677**: trocar `computeProjectedClients(...)` por `getMonthlyClients(key, year, data.subProductClients, data.tickets, data.monthlyClientOverrides).map(v => Math.round(v))`

2. **Linhas ~880, ~924, ~965** (seções de new clients, churn, totals): mesma troca — usar `getMonthlyClients` em vez de `computeProjectedClients`

3. **Linhas ~449, ~483** (`handleApplyAll` e `handleApplyRow`): estas usam `computeProjectedClients` para calcular o target de dezembro ao aplicar crescimento uniforme. Aqui faz sentido manter a lógica de crescimento, mas o resultado deve ser salvo como overrides mensais completos (12 meses) em vez de apenas atualizar o Dec target.

4. **Remover** ou deprecar `computeProjectedClients` se não for mais usada em nenhum lugar.

### Resultado
- Editar Abril para 6 → só Abril muda para 6
- Os outros meses mantêm a interpolação geométrica normal do `getMonthlyClients`
- `handleApplyRow` (botão "Aplicar" com %) continua funcionando — aplica crescimento uniforme salvando como overrides

