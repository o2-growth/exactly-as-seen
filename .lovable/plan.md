

# Corrigir edição mensal: stale closures + validação

## Diagnóstico

Analisando o código, identifiquei **dois problemas reais**:

### 1. Stale closure em `handleClientChange` e no ticket mensal
Todas as funções de update direto usam `setAssumptions({...assumptions, ...})` capturando `assumptions` do closure. Se o React não re-renderizar entre chamadas, o `assumptions` fica desatualizado e a edição anterior é sobrescrita. Isso faz parecer que "nada acontece".

**Correção**: trocar todas as chamadas por forma funcional `setAssumptions(prev => ({...prev, ...}))`.

### 2. `directUpdateClients` e `directUpdateTicket` também usam closure stale
Linhas 708-722: mesma pattern `setAssumptions({...assumptions, ...})`.

## Arquivos a alterar

### `src/pages/Assumptions.tsx`

1. **`handleClientChange`** (linha 413-431): trocar por `setAssumptions(prev => ...)`
2. **`handleApplyAll`** (linha 433-467): trocar `setAssumptions({...assumptions, ...})` por `setAssumptions(prev => ...)`
3. **`handleApplyRow`** (linha 469-498): idem
4. **`directUpdateClients`** (linha 708-716): trocar por `setAssumptions(prev => ...)`
5. **`directUpdateTicket`** (linha 717-722): trocar por `setAssumptions(prev => ...)`
6. **Ticket mensal `onCommit`** (linhas 813-830): trocar por `setAssumptions(prev => ...)`
7. **Adicionar `console.log`** temporário no `handleClientChange` para confirmar que o override foi salvo, para debug

### Exemplo da correção central:
```typescript
// ANTES (stale closure):
setAssumptions({
  ...assumptions,
  monthlyClientOverrides: { ... },
});

// DEPOIS (sempre pega o valor mais recente):
setAssumptions(prev => ({
  ...prev,
  monthlyClientOverrides: {
    ...(prev.monthlyClientOverrides ?? {}),
    [key]: {
      ...((prev.monthlyClientOverrides ?? {})[key] ?? {}),
      [year]: yearArr,
    },
  },
}));
```

## Resultado esperado
- Selecionar 2027+ → meses editáveis (sem 🔒)
- Digitar valor e sair do campo → valor persiste e MRR/total atualizam
- 2025 e jan-mar/2026 continuam travados (comportamento correto)

