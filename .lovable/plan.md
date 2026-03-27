

# Adicionar opção N/A (não se aplica) na linha de Churn por subproduto

## Contexto
Produtos não-recorrentes (ex: Setup, Parceiros) não possuem churn. Precisamos de um toggle N/A que oculte os controles de churn e exiba "N/A" ao invés de valores calculados.

## Alterações

### 1. Modelo de dados — `src/lib/financialData.ts`
- Adicionar campo `churnNotApplicable?: Partial<Record<SubProductKey, boolean>>` na interface `Assumptions`
- Default vazio `{}` em `DEFAULT_ASSUMPTIONS`

### 2. UI — `src/pages/Assumptions.tsx`
Na linha de Churn de cada subproduto (linhas ~1044-1116):

- Adicionar botão/toggle **"N/A"** ao lado do título "Churn (clientes/mês)":
  - Quando ativado: esconde input de taxa + botão Aplicar, grid mostra "N/A" em cinza, total mostra "Não se aplica"
  - Quando desativado: comportamento atual (taxa + grid de valores)
- O toggle salva em `assumptions.churnNotApplicable[prodKey] = true/false`

### 3. Cálculo — `getChurnMonthly` e totais
- Quando `churnNotApplicable[prodKey]` é `true`, retornar 0 (sem churn)
- Na seção "Totais: Novos Clientes e Churn" (linha ~1175), ignorar produtos com N/A no somatório de churn

## Arquivos alterados
1. `src/lib/financialData.ts` — novo campo `churnNotApplicable`
2. `src/pages/Assumptions.tsx` — toggle N/A no bloco de churn + lógica condicional

