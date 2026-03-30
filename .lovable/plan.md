

# Refazer bloco COS nas Assumptions — Premissas de Custos Variáveis por Categoria

## Resumo
Substituir o bloco COS atual por um sistema de premissas completo com 6 categorias (3.1–3.6), onde CaaS e Setup usam lógica de **squad por clientes** e Education, Expansão e Tax usam **% da receita bruta**. Inclui também ajuste automático de clientes Setup (1.2.3).

## Estrutura das premissas

```text
3.1 Custos CaaS — Squad por clientes CaaS
  • Project Finance Director: 1 a cada 100 clientes (R$ 30.000)
  • CFO: 1 a cada 15 clientes (R$ 20.000)
  • FP&A Analyst: 1 a cada 7,5 clientes (R$ 8.000)
  → Squad = 1 CFO + 2 FP&A. Diretor cobre ~6-7 squads.

3.2 Custos SaaS — Squad por clientes SaaS (assinatura)
  • Dev Senior: 1 a cada 100 clientes assinatura (R$ 10.000)
  • Customer Success: 1 a cada 100 clientes assinatura (R$ 5.000)
  Assinaturas = saasOxy + saasOxyGenio + saasOxyGenioEsp

3.2 (Setup — subcategoria) — Squad por novos clientes/mês
  • Data Analyst: 2 a cada 32 novos clientes/mês (R$ 8.000)
  • Process Analyst: 1 a cada 32 novos clientes/mês (R$ 5.000)
  • Head of Data: 1 a cada 64 novos clientes/mês (R$ 15.000)
  Novos = novos CaaS Enterprise/Corporate + novos SaaS assinatura

3.3 Custos Education — 15% receita bruta Education
3.4 Custos Customer Success — Customer Experience Analyst
  • 1 a cada 100 clientes CaaS (R$ 5.000)
3.5 Custos Expansão — 15% receita bruta Expansão
3.6 Custos Tax — 15% receita bruta Tax
```

## Ajuste Setup (1.2.3) — clientes automáticos
Clientes Setup de cada mês = novos clientes CaaS Enterprise + CaaS Corporate + SaaS Oxy + SaaS Oxy+Gênio + SaaS Oxy+Gênio+Especialista daquele mês. Setup não acumula (não é recorrente).

## Alterações por arquivo

### 1. `src/lib/financialData.ts`
- Substituir `squadConfig` por novo `cosConfig` com toda a estrutura:
  - CaaS squad: `pfdClientsPerOne`, `pfdSalary`, `cfoClientsPerOne`, `cfoSalary`, `fpaClientsPerOne`, `fpaSalary`
  - SaaS assinatura: `devSrClientsPerOne`, `devSrSalary`, `csClientsPerOne`, `csSalary`
  - Setup squad: `setupClientsPerSquad`, `dataAnalystPerSquad`, `dataAnalystSalary`, `processAnalystPerSquad`, `processAnalystSalary`, `headDataClientsPerOne`, `headDataSalary`
  - Customer Success: `cxAnalystClientsPerOne`, `cxAnalystSalary`
  - Education/Expansão/Tax: `eduCostRate`, `expansaoCostRate`, `taxCostRate`
- Remover `eduExpansaoTeamRate` (substituído pelos rates individuais)
- Manter `squadConfig` no tipo para migração, mas defaults usam `cosConfig`

### 2. `src/engine/calculationsEngine.ts`
- Criar `calcCOSFromConfig()` que substitui `calcMonthlyCOGS`:
  - **3.1 CaaS**: PFD + CFO + FP&A baseado em clientes CaaS acumulados do mês
  - **3.2 SaaS**: Dev Sr + CS baseado em clientes SaaS assinatura acumulados; Setup squad baseado em novos clientes/mês
  - **3.3 Education**: `eduCostRate × receita Education do mês`
  - **3.4 Customer Success**: CX Analyst baseado em clientes CaaS
  - **3.5 Expansão**: `expansaoCostRate × receita Expansão`
  - **3.6 Tax**: `taxCostRate × receita Tax`
- Ajustar cálculo de clientes Setup (1.2.3): novos = delta mensal de CaaS Enterprise + Corporate + SaaS assinaturas
- Atualizar `cogsDetail` para incluir `tax` (hoje é zero)
- Remover referência a `eduExpansaoTeamRate` na margem de contribuição

### 3. `src/pages/Assumptions.tsx`
- Substituir todo o bloco COS (L1342–1542) por:
  - **Cards por categoria** (3.1 a 3.6) com inputs editáveis para cada parâmetro
  - Cards CaaS/SaaS/CS: inputs de "1 a cada N clientes" + salário, com tabela de impacto por ano
  - Cards Education/Expansão/Tax: input de % da receita bruta
  - Tabela resumo com custo total COS por ano e % da receita
- Manter lógica de `editing` gate em todos os inputs
- Remover seções "Headcount Projetado por Área" e "Regras de Contratação" duplicadas (se existirem separadamente)

## Arquivos alterados
1. `src/lib/financialData.ts` — novo `CosConfig` + defaults
2. `src/engine/calculationsEngine.ts` — novo cálculo COS por categoria + Setup automático
3. `src/pages/Assumptions.tsx` — novo bloco COS completo

