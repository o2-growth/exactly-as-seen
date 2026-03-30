

# Corrigir Ticket Base (flat) e Churn — não respeitam modo de edição

## Problemas identificados

1. **Ticket base (flat)** (L1076-1082): O input não tem `disabled={!editing}`, então parece editável mas a função `directUpdateTicket` (L912-917) escreve direto em `setAssumptions` em vez de respeitar o guard `editing ? setEditState : setAssumptions`.

2. **Churn — botão N/A** (L1138): O toggle N/A usa `setAssumptions` direto, ignorando o `editState`.

3. **Churn — input taxa + botão Aplicar** (L1152-1184): O input da taxa está correto com `disabled={!editing}`, mas o botão "Aplicar" (L1174) também usa `setAssumptions` direto em vez do guard.

## Solução

### Arquivo: `src/pages/Assumptions.tsx`

1. **`directUpdateTicket` (~L912)**: Adicionar guard `if (editing) setEditState(...) else setAssumptions(...)` e adicionar `disabled={!editing}` ao input (L1076).

2. **Botão N/A do churn (~L1138)**: Trocar `setAssumptions` pelo guard de edição.

3. **Botão Aplicar do churn (~L1174)**: Trocar `setAssumptions` pelo guard de edição.

Todas as 3 correções seguem o mesmo padrão já usado nos outros campos: verificar `editing` e direcionar para `setEditState` ou `setAssumptions`.

