

# Separar período histórico e futuro na visão Bancária

## Problema
Atualmente toda a visão Bancária usa o mesmo range de datas (futuro). O usuário quer que apenas a **tabela de Projeção de Caixa** mostre dados futuros — os cards de resumo, gráficos e tabela de contrapartes devem mostrar dados históricos/recentes.

## Solução
Fazer **duas chamadas** à API Oxy com ranges diferentes:

1. **Dados históricos** (últimos 12 meses) → alimenta cards de resumo, gráfico mensal, cascata e tabela de contrapartes
2. **Dados futuros** (próximos 12 meses) → alimenta apenas a tabela expandível de Projeção de Caixa

## Alterações em `src/pages/CashFlow.tsx`

1. **`OxyBankingView`** passa a receber 4 props: `historicalStart`, `historicalEnd`, `projectionStart`, `projectionEnd`
2. Dentro do componente, chamar `useOxyCashFlow` duas vezes — uma para histórico e outra para projeção
3. Cards, gráficos e tabela de contrapartes usam os dados históricos
4. Tabela "Projeção de Caixa — Visão Expandível" usa os dados de projeção (futuros)
5. Na invocação (linha ~814), calcular as 4 datas: histórico = últimos 12 meses, projeção = próximos 12 meses

