

# Restaurar valores originais de caasAssessoria

## Problema
Os valores de `caasAssessoria` foram alterados acidentalmente na UI (2025: 21→5, 2026: 78→19) e esses valores foram persistidos automaticamente no banco de dados e localStorage.

## Solução
Limpar os dados persistidos e os overrides mensais de `caasAssessoria` para que o sistema volte a usar os valores padrão do `DEFAULT_ASSUMPTIONS`:
- **2025**: 21
- **2026**: 78

### Alteração em `src/pages/Assumptions.tsx`
Adicionar um `useEffect` temporário (ou chamar `resetAssumptions()` seletivamente) que:
1. No mount, verifica se `subProductClients.caasAssessoria[2025] !== 21` ou `[2026] !== 78`
2. Se sim, corrige os valores e limpa os `monthlyClientOverrides` de `caasAssessoria` para 2025 e 2026

**Abordagem mais simples**: corrigir diretamente no `DEFAULT_ASSUMPTIONS` não resolve porque o valor persistido sobrescreve os defaults no load. Então vamos adicionar um one-time fix no `FinancialModelContext.tsx`:

### `src/contexts/FinancialModelContext.tsx`
Após o `loadSnapshots` no useEffect de mount, adicionar uma correção pontual:

```typescript
loadSnapshots().then(saved => {
  if (saved) {
    // One-time fix: restore accidentally changed caasAssessoria values
    const fixed = { ...saved };
    let needsFix = false;
    if (fixed.subProductClients?.caasAssessoria?.[2025] === 5) {
      fixed.subProductClients.caasAssessoria[2025] = 21;
      needsFix = true;
    }
    if (fixed.subProductClients?.caasAssessoria?.[2026] === 19) {
      fixed.subProductClients.caasAssessoria[2026] = 78;
      needsFix = true;
    }
    // Also clear any monthly overrides for these years
    if (needsFix && fixed.monthlyClientOverrides?.caasAssessoria) {
      delete fixed.monthlyClientOverrides.caasAssessoria[2025];
      delete fixed.monthlyClientOverrides.caasAssessoria[2026];
    }
    setAssumptions(fixed);
  }
});
```

Também limpar o localStorage para garantir consistência.

### Arquivos alterados
- `src/contexts/FinancialModelContext.tsx` — one-time data fix no load

