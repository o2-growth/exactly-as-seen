

# Diagnóstico: Cash Flow vs Banco DRE

## Dados que o Cash Flow precisa

A página de Cash Flow usa **19 linhas** organizadas em Entradas e Saídas. Para o ano de 2025, os dados vêm de `historicalData.ts` (hardcoded). Mapeei cada linha para o banco DRE:

### ENTRADAS (Inflows)
| Linha | Fonte atual (hardcoded) | Banco DRE | Status |
|-------|------------------------|-----------|--------|
| Receita CaaS | `historicalRevenue['CaaS']` | Categoria `RB`, grupo "CaaS" | Disponível |
| Receita SaaS | `historicalRevenue['SaaS']` | Categoria `RB`, grupo "SaaS" | Disponível |
| Receita Education | `historicalRevenue['Education']` | Categoria `RB`, grupo "Education" | Disponível |
| Receita BaaS | Engine only (0 em 2025) | Sem dados no DB | N/A (engine) |
| Receita Expansão | `historicalRevenue['Expansão']` | Categoria `RB`, grupo "Expansão" | Disponível |
| Outras Receitas | `historicalRevenue['Tax']` + `historicalFinancial['RNO']` | Categoria `RB` grupo "Tax" + Categoria `OR` | Disponível |
| Receitas Financeiras | `historicalFinancial['RF']` | Categoria `RF` | Disponível |
| Variação Contas a Receber | Engine (PMR calc) | Sem dados no DB | N/A (engine) |

### SAÍDAS (Outflows)
| Linha | Fonte atual (hardcoded) | Banco DRE | Status |
|-------|------------------------|-----------|--------|
| Deduções de Vendas | `historicalDeductions` | Categoria `DC` (total) | Disponível |
| Custos Variáveis | `historicalCosts` | Categoria `CV` (total) | Disponível |
| Despesas Administrativas | `historicalExpenses['Despesas Administrativas']` | Categoria `DX`, grupo "Despesas Administrativas" | Disponível |
| Despesas Comerciais | `historicalExpenses['Despesas Comerciais']` | Categoria `DX`, grupo "Despesas Comerciais" | Disponível |
| Despesas com Pessoal | `historicalExpenses['Despesas com Pessoal']` | Categoria `DX`, grupo "Despesas com Pessoal" | Disponível |
| Despesas de Marketing | `historicalExpenses['Despesas de Marketing']` | Categoria `DX`, grupo "Despesas de Marketing" | Disponível |
| Despesas Financeiras | `historicalFinancial['DF']` | Categoria `DF` | Disponível |
| Despesas Não Operacionais | `historicalFinancial['DNO']` | Categoria `DN` | Disponível |
| Provisões (IRPJ/CSLL) | `historicalFinancial['PROV']` | Categoria `IR` | Disponível |
| Amortização de Dívida | `historicalFinancial['AD']` | Categoria `AM` | Disponível |
| Investimentos (Capex) | `historicalFinancial['INV']` | Categoria `IN` | Disponível |

## Conclusao

**17 de 19 linhas** podem ser alimentadas 100% pelo banco DRE. As 2 restantes (Receita BaaS e Variação de Contas a Receber) são calculadas pelo engine de projeção e nao existem no DRE -- isso e correto.

**O banco DRE consegue alimentar o Cash Flow de maneira 100% correta.**

## Plano de execucao

1. **Criar/atualizar a edge function `fetch-dre-data`** para retornar, alem da arvore P&L, um objeto `cashFlowData` com os valores agregados por periodo para cada linha do Cash Flow, separando:
   - Revenue por BU (CaaS, SaaS, Education, Expansao, Tax)
   - Deducoes (total categoria DC)
   - Custos (total categoria CV)
   - Despesas por grupo dentro de DX (Administrativas, Comerciais, Pessoal, Marketing)
   - Financeiras (RF, DF), DNO, Provisoes (IR), Amortizacao (AM), Investimentos (IN)

2. **Atualizar `useDreData.ts`** para expor os dados de Cash Flow alem do P&L tree

3. **Atualizar `CashFlow.tsx`** para:
   - Adicionar toggle Realizado/Modelo (como ja feito no P&L)
   - Quando "Realizado", usar dados do banco para 2025 e 2026 em vez do `historicalData.ts` hardcoded
   - Manter engine para anos projetados (2027+) e para PMR/receivables

