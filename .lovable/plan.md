

# Corrigir período da visão Bancária para projeção futura

## Problema
As datas estão hardcoded como `2025-01-01` a `2025-12-31` na linha 814 do CashFlow.tsx. Como estamos em março de 2026, isso mostra dados passados ao invés de projeção futura.

## Solução
Alterar as datas para mostrar o período futuro a partir do mês atual:
- `startDate` = mês atual (2026-03-01)
- `endDate` = 12 meses à frente (2027-02-28)

Isso será feito dinamicamente usando `new Date()` para calcular, de forma que sempre mostre projeção futura independente de quando o usuário acessar.

## Alteração
**`src/pages/CashFlow.tsx`** — Na renderização do `OxyBankingView` (linha ~814), substituir as datas hardcoded por datas dinâmicas calculadas a partir da data atual.

