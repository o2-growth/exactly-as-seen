

# Trazer conteúdo antigo para as 5 abas novas

## Situação atual

O conteúdo das 4 tabs antigas (~1900 linhas) foi removido na reestruturação anterior. O arquivo `Assumptions.tsx` mantém todas as funções auxiliares, tipos e constantes (CLIENTS_ROWS, TICKETS_ROWS, helpers de projeção, headcount, etc.) mas as tabs estão vazias (placeholders).

## Abordagem recomendada

**Reverter para a versão anterior** (antes da reestruturação das tabs) e então refazer a mudança preservando o conteúdo. Isso é mais seguro do que tentar reescrever ~1900 linhas de memória.

### Passo a passo:
1. **Você reverte** para a versão anterior usando o botão de revert no chat (a mensagem onde as tabs foram substituídas por placeholders)
2. **Eu refaço** a reestruturação, desta vez redistribuindo o conteúdo existente nas 5 novas tabs:

| Tab nova | Conteúdo que receberá |
|---|---|
| **Revenue** | Tabela de clientes (CLIENTS_ROWS), tickets (TICKETS_ROWS), churn, growth rates, botões Apply All |
| **Tax Deductions** | Placeholder (será construído depois — não havia conteúdo equivalente antes) |
| **COS** | Seção de Custos da tab COGS & Marketing (historicalCosts, custos operacionais) |
| **SG&A** | Seção de Despesas (historicalExpenses), Marketing/CAC, e conteúdo da tab SG&A & Financeiro |
| **Econ. & Financial** | Seção Financeiro (dívida, juros, Selic), depreciação |

3. O header atualizado e a descrição permanecem como estão.

## Ação necessária

Reverta para a versão anterior clicando no botão de revert da mensagem onde as tabs foram reestruturadas. Depois me avise e eu faço a redistribuição correta.

<lov-actions>
  <lov-open-history>View History</lov-open-history>
</lov-actions>

