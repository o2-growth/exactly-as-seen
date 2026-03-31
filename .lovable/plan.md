

# Corrigir: crescimento de churn deve começar no ano selecionado

## Problema
Na linha 1404, quando `y === selectedYear`, o código mantém o valor base sem aplicar crescimento. O usuário espera que, se está em 2025 com churn 5% e crescimento 10%, o churn de 2025 já mude para 5.5%.

## Alteração

### `src/pages/Assumptions.tsx` — linhas 1401-1410

Trocar a lógica para aplicar o crescimento **a partir do ano selecionado**, inclusive:

```typescript
const newRates: Record<number, number> = {};
let base = baseVal;
for (const y of yearsToApply) {
  base = Math.max(0, Math.round(base * (1 + growthRate) * 100) / 100);
  newRates[y] = base;
}
```

Removemos o `if (y === selectedYear)` que preservava o valor original. Agora o primeiro ano já recebe `base * (1 + growthRate)`.

## Resultado
Com churn base 5% e crescimento 10%, ao clicar "Aplicar" em 2025:
- 2025: 5.5% | 2026: 6.05% | 2027: 6.66% | ...

