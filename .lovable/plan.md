

# Corrigir edição de clientes mensais no Assumptions

## Problema
Os inputs de clientes mensais (grid 12 meses) estão com `value={monthly[i]}` ligado a um valor **calculado/derivado**. Quando o usuário digita, o `onChange` atualiza `growthRates`, o componente re-renderiza, e `monthly[i]` é recalculado com arredondamentos — fazendo o valor "voltar" ou piscar. O input nunca mantém o que o usuário digitou.

## Solução
Usar estado local temporário no input (padrão do `InlineEditCell` já existente no projeto): o usuário edita livremente e o valor só é commitado no `blur` ou `Enter`.

## Alteração

### `src/pages/Assumptions.tsx`
1. Criar um pequeno componente interno `MonthlyClientInput` que:
   - Recebe `value` (computed) e `onCommit` (callback)
   - Mantém `localValue` em estado interno
   - Sincroniza `localValue` com `value` via `useEffect` (quando não está em foco)
   - No `onChange`: atualiza apenas `localValue`
   - No `onBlur` / `Enter`: chama `onCommit(localValue)` → que dispara `handleClientChange`
   
2. Substituir o `<input>` nas linhas ~727-733 pelo novo `MonthlyClientInput`

Isso segue exatamente o mesmo padrão do `InlineEditCell` já usado no projeto.

