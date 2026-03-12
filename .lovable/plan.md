

# Simplificar Fluxo de Caixa — Manter apenas Bancário

## Objetivo
Remover as opções "Modelo" e "Realizado" da página de Fluxo de Caixa, mantendo apenas a visão "Bancário" como única fonte de dados.

## Alterações em `src/pages/CashFlow.tsx`

1. **Remover o toggle de fonte de dados** — Eliminar os 3 botões (Modelo/Realizado/Bancário) e o estado `cfSource`
2. **Renderizar sempre o `OxyBankingView`** — Sem condicionais, o componente bancário é renderizado diretamente
3. **Remover código morto** — Todo o bloco condicional do modelo/realizado (PMR, tabela de árvore, gráficos de waterfall do modelo, balanço) que ficava no `else` do `cfSource === 'banking'` (linhas ~829–997)
4. **Limpar imports não utilizados** — Remover imports de `Calculator`, `Database`, `useDreData`, `historicalData`, funções auxiliares do modelo (`sumFlat`, `sumDeductions`, etc.), e as funções `buildCashFlowTree`/`buildCashFlowTreeFromDb` se ficarem sem uso
5. **Simplificar estado** — Remover `pmrOpen`, `editingPmr`, `pmrDraft`, `cfSource` e variáveis derivadas (`tree`, `balanceData`, `waterfallData`, etc.)

O header ficará apenas com o título "Fluxo de Caixa" e o `OxyBankingView` será renderizado logo abaixo com as datas dinâmicas (histórico 12 meses + projeção 12 meses).

