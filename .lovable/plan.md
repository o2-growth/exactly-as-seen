

# Corrigir botão "Aplicar" do Ticket — leitura/escrita ignorando editState

## Problema
O `handleApplyTicketGrowth` atualiza corretamente o `editState`, mas a **exibição dos valores do ticket** (linha 1022) lê de `assumptions` em vez de `data` (que aponta para `editState` quando em modo de edição). Resultado: o estado é atualizado internamente mas a UI não reflete a mudança, parecendo que o botão "não funciona".

Além disso, o `onCommit` do input manual do ticket (linhas 1036-1060) também lê/escreve direto em `assumptions`, ignorando `editState`.

## Solução
Alterar 3 pontos no bloco de ticket mensal (~linhas 1019-1065):

1. **Linha 1022**: Trocar `assumptions.monthlyTickets` → `data.monthlyTickets`
2. **Linhas 1036-1038**: Trocar `assumptions.monthlyTickets` → `data.monthlyTickets` no `onCommit`
3. **Linha 1054**: Usar a mesma lógica de guarda `if (editing) setEditState(...) else setAssumptions(...)` no `onCommit`

## Arquivo alterado
- `src/pages/Assumptions.tsx` — bloco de ticket mensal (~linhas 1022-1065)

