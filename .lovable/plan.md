

# Propagar crescimento % até 2030 ao aplicar por linha

## Problema
`handleApplyRow` aplica o crescimento apenas ao ano selecionado. O usuário espera que ao definir 6% de crescimento a partir de Jul/2025, o modelo progrida automaticamente até Dez/2030.

## Nota
`handleApplyAll` já itera todos os anos (`for (const y of YEARS)`), então já funciona corretamente. A correção é necessária apenas em `handleApplyRow`.

## Solução
Modificar `handleApplyRow` para iterar de `year` até 2030 (inclusive), encadeando o `prev` do último mês de cada ano como base do primeiro mês do ano seguinte.

### Lógica
```text
Para cada ano Y de [year ... 2030]:
  - Se Y > year: prev = último valor projetado do ano anterior
  - Para cada mês M de 0..11:
    - Se histórico: prev = base[m]
    - Se manual flag: preserva valor, prev = manual
    - Senão: prev *= (1 + rate - churn), projected[m] = round(prev)
  - Salva overrides[key][Y] e decTarget[key][Y]
```

### Alteração
- `src/pages/Assumptions.tsx` — `handleApplyRow` (~L546-611): envolver o bloco de projeção num loop `for (const y of yearsToApply)` onde `yearsToApply = YEARS.filter(y => y >= year)`, acumulando overrides e decTargets para todos os anos, similar ao que `handleApplyAll` já faz.

