

## Corrigir build error e garantir sincronização Premissas → Tax Deductions

### 1. Build Error (bloqueante)

Em `src/lib/taxCalc.ts` linha 117, `compositionFromConfig()` chama `resolveSlices(cfg)` que retorna `{ profile: TaxProfileDef; pct: number }[]`, mas tenta acessar `s.profileKey` que não existe nesse tipo (a propriedade é `profile`, não `profileKey`).

**Correção:** Mudar `compositionFromConfig` para extrair o `profileKey` corretamente. Como `resolveSlices` retorna o objeto `TaxProfileDef` resolvido (não a key), precisamos buscar a key reversamente ou reestruturar. A solução mais simples: em vez de usar `resolveSlices`, usar `getMixTaxSlices` diretamente (que retorna `TaxSlice[]` com `profileKey`), e para perfis únicos, retornar o profileKey do config.

**Arquivo:** `src/lib/taxCalc.ts` — linhas 114-120

```typescript
export function compositionFromConfig(cfg: SubProductTaxConfig): TaxSlice[] {
  if (cfg.perfilTributario === 'mix') {
    const slices = getMixTaxSlices(cfg.taxSlices);
    const total = slices.reduce((s, sl) => s + sl.pct, 0) || 100;
    return slices.map(s => ({ profileKey: s.profileKey, pct: s.pct / total }));
  }
  // Single profile — find the matching profile key or use 'servico' as default
  const profileKey = cfg.perfilTributario && cfg.perfilTributario !== 'custom'
    ? cfg.perfilTributario
    : 'servico';
  return [{ profileKey, pct: 1 }];
}
```

### 2. Sincronização Premissas Tributárias → Tax Deductions

A sincronização **já está funcionando corretamente**. Ambas as páginas leem e escrevem no mesmo local: `assumptions.subProductTaxRates` via `useFinancialModel()`. A PremissasPage usa `useEditablePremises()` que internamente chama `setAssumptions`, e o Tax Deductions na Assumptions lê via `getSubProductTaxRate()` — mesma fonte de dados.

Não é necessária nenhuma alteração de lógica de sincronização. A única ação necessária é corrigir o build error acima para que a plataforma volte a compilar.

### Resumo

| Arquivo | Ação |
|---------|------|
| `src/lib/taxCalc.ts` | Corrigir `compositionFromConfig` — usar `getMixTaxSlices` ao invés de `resolveSlices` |

