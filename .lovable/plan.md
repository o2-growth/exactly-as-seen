

# Corrigir cálculo de crescimento para números pequenos

## Problema
Quando o usuário define Apr-Jun = 3 e aplica 6% de crescimento, o sistema usa `Math.round` em cada passo e **reatribui o valor arredondado como base** do próximo mês. Resultado: `3 × 1.06 = 3.18 → round → 3`, e `prev` volta para 3. O crescimento nunca acumula.

Antes de clicar "Aplicar", os meses Jul-Dec usam **interpolação geométrica** entre o último mês histórico e o target de Dezembro (que pode ser alto, ex: 80), gerando saltos como 3→5→9→15.

## Solução
Manter `prev` como **float** (sem arredondar) durante o loop de crescimento. Arredondar apenas o valor salvo em `projected[m]`, sem reatribuir o arredondado ao `prev`.

### Antes (bug):
```ts
const next = Math.round(prev * (1 + rate - churn));
projected[m] = next;
prev = next; // ← prev perde a fração
```

### Depois (fix):
```ts
prev = prev * (1 + rate - churn); // prev mantém precisão float
projected[m] = Math.max(0, Math.round(prev));
// prev NÃO é reatribuído ao arredondado
```

Com 6% a partir de 3: Jul=3.18→3, Aug=3.37→3, Sep=3.57→4, Oct=3.78→4, Nov=4.01→4, Dec=4.25→4.
Crescimento gradual e realista.

Para overrides manuais, o `prev` assume o valor manual (float):
```ts
prev = manual; // usa o valor manual como base float para próximo mês
```

## Alterações
- `src/pages/Assumptions.tsx`:
  - `handleApplyRow` (~L548-552): separar `prev` float de `projected[m]` arredondado
  - `handleApplyAll` (~L478-492): mesma correção

## Arquivo alterado
- `src/pages/Assumptions.tsx` — 2 blocos de ~5 linhas cada

