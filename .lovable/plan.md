

# Plano: Headcount, Salarios e Proporcoes por Cliente

## O que o usuario pediu (do mapa mental)
1. Headcount mensal vinculado a salarios base com opcao de alternar visualizacao
2. Proporcao de atendimento por cargo editavel (ex: cada CFO atende 15 clientes)
3. Administracao deve poder editar proporcoes para recalcular necessidades de pessoal
4. Headcount por area (Comercial, Marketing etc.) refletindo funil e metas de vendas
5. Premissas de headcount mensais editaveis por admin, com regras de proporcao por cliente e por area

## O que ja existe
- Tab "Headcount" no Assumptions.tsx com: Colaboradores Nomeados, Indicadores de Folha, Reembolsos e "Regras de Contratacao" (tabela estatica de proporcoes e salarios)
- `headcountRatios` e `salaryRanges` em `modelData.ts` (somente leitura)
- `getMonthlyHeadcount()` em `monthlyData.ts` que calcula headcount por role baseado em total de clientes e ratios

## O que sera feito

### 1. Tornar proporcoes e salarios editaveis
Na secao "Regras de Contratacao" (linha 1796), transformar as tabelas de proporcao e salarios em inputs editaveis quando `editing === true`. As alteracoes serao salvas no estado de `editState` (Assumptions).

Adicionar ao tipo `Assumptions`:
- `headcountRatios`: Record com os ratios editaveis (clientsPerCFO, clientsPerFPA, etc.)

### 2. Adicionar tabela "Headcount Projetado por Area" (nova secao)
Inserir antes da secao "Regras de Contratacao" uma tabela mensal que mostra, para cada area/role, o numero de pessoas necessarias mes a mes, calculado dinamicamente com base nos clientes projetados e nas proporcoes editaveis.

Colunas: Jan...Dez + Total
Linhas agrupadas por BU: CaaS (CFOs, FP&A, PF Director, Project Analyst), SaaS (Data Analyst), Operations (CSM), Commercial (Head, SDR), Marketing, Admin, Management
Cada celula = `ceil(totalClients / ratio)` com `Math.max(base, calculado)`

### 3. Toggle de visualizacao: Qtd Pessoas vs Custo Mensal
Adicionar um botao toggle no header da tabela projetada que alterna entre:
- **Pessoas**: mostra quantidade (ex: 6 CFOs)
- **Custo**: mostra quantidade x salario base (ex: R$ 90.000)

### 4. Headcount Comercial vinculado ao funil
Adicionar linhas de SDR e Head Comercial na tabela projetada, usando `commercialHeadcountRatios` (ja existente no modelData.ts: 1 SDR/200 clientes, 1 Head/500 clientes).

## Alteracoes por arquivo

**`src/lib/financialData.ts`** — Adicionar `headcountRatios` ao tipo `Assumptions` e `DEFAULT_ASSUMPTIONS`

**`src/pages/Assumptions.tsx`**:
- Tornar inputs editaveis na secao "Regras de Contratacao" (ratios e salarios)
- Criar nova secao "Headcount Projetado por Area" com tabela mensal + toggle pessoas/custo
- Incluir linhas de Commercial (SDR, Head) usando `commercialHeadcountRatios`
- Usar os ratios do `editState` ao inves dos importados de `modelData`

