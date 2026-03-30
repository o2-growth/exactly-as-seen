

# Corrigir "Aplicar Crescimento" para respeitar valores manuais

## Problema
Quando o usuário edita manualmente os clientes de Abr-Jun (ex: 3, 3, 3) e depois clica "Aplicar" com 4% de crescimento, o código **recalcula todos os meses não-históricos desde o último mês realizado**, ignorando os valores manuais já inseridos. Resultado: os valores de Abr-Jun são sobrescritos e zerados.

## Causa raiz
Em `handleApplyRow` (L529-541) e `handleApplyAll` (L474-486), a projeção sequencial usa como base o último mês histórico (`prev`) e aplica crescimento a **todos** os meses futuros. Os overrides manuais existentes são ignorados no cálculo.

## Solução
Alterar a lógica de projeção para **preservar meses que já possuem override manual** e só aplicar crescimento a partir do primeiro mês sem override.

### Lógica corrigida (ambas funções):
1. Ler os overrides atuais do subproduto: `currentOverrides = monthlyClientOverrides[key]?.[year]`
2. Para cada mês não-histórico:
   - Se o mês **já tem override manual** (valor não-null no array atual), manter esse valor e usá-lo como `prev` para o próximo mês
   - Se o mês **não tem override**, aplicar crescimento: `prev * (1 + rate - churn)`
3. Isso garante que Abr=3, Mai=3, Jun=3 ficam intactos e Jul em diante cresce a partir de 3

## Arquivo alterado
- `src/pages/Assumptions.tsx` — `handleApplyRow` (~L528-541) e `handleApplyAll` (~L473-486)

