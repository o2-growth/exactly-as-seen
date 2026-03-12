

# Plano: Adicionar Projeção de Caixa na Visão Bancária

## Situação atual
A visão "Bancário" mostra: cards de resumo, gráfico mensal e tabela de contrapartes. Mas **não** inclui a tabela expandível de projeção de caixa (Saldo Inicial → Entradas → Saídas → Saldo Final) que existe nas views "Modelo" e "Realizado".

## O que será feito

1. **Adicionar tabela de projeção na visão Bancário** — Reutilizar a mesma estrutura de tabela expandível (`CashFlowExpandableRow`) mas alimentada com os dados da API Oxy:
   - Mapear os dados mensais do chart Oxy (entradas/saídas/saldo) para uma estrutura `CashFlowRow[]` compatível
   - Colunas = meses (Jan/25, Fev/25, etc.) ao invés de anos
   - Linhas: Total Entradas (com sub-itens do "recebido"), Total Saídas (com sub-itens do "pago"), Saldo Inicial/Final

2. **Adicionar gráfico cascata mensal** — Waterfall chart mensal com Entradas, Saídas e Saldo, seguindo o mesmo padrão visual do waterfall anual existente.

3. **Manter os componentes existentes** — Os cards de resumo, gráfico e tabela de contrapartes continuam, com a tabela de projeção adicionada entre o gráfico e a tabela de detalhes.

## Estrutura técnica

- Criar função `buildCashFlowTreeFromOxy(data: OxyCashFlowData)` que retorna `CashFlowRow[]` com colunas mensais
- Criar componente `OxyProjectionTable` dentro do `OxyBankingView` que renderiza a tabela com linhas expandíveis
- As colunas serão os períodos mensais retornados pela API (ao invés dos anos 2025-2030)

