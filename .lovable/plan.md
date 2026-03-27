

# Substituir bloco Tax Deductions pela lógica Lucro Presumido por BU

## Resumo
Substituir o conteúdo atual da aba "Tax Deductions" (toggle IRPJ/CSLL + cards estáticos de regime tributário) pela nova lógica tributária **Lucro Presumido por BU** (CaaS, SaaS, Setup), com cálculo de PIS, COFINS, ISS, IRPJ e CSLL por unidade de negócio, e alíquotas de ISS configuráveis.

## Situação atual
- **Engine** (`calculationsEngine.ts` L578-581): aplica uma taxa flat `salesDeductionsByYear` sobre receita bruta total (9,65% presumido / 15,25% real)
- **Engine** (L692-698): aplica IRPJ 25% + CSLL 9% = 34% sobre EBT
- **modelData.ts**: `salesDeductions` e `salesDeductionsByYear` com taxas flat; `taxRates` com IRPJ 25% e CSLL 9%
- **UI** (Assumptions.tsx L1277-1341): toggle taxEnabled + 2 cards informativos estáticos

## Alterações

### 1. Modelo de dados — `src/lib/financialData.ts`
- Adicionar interface `BUTaxConfig` com `buKey`, `tipoReceita`, `aliquotaIss`
- Adicionar campo `buTaxConfigs?: BUTaxConfig[]` na interface `Assumptions`
- Default: `[{buKey:'caas', tipoReceita:'servico', aliquotaIss:5}, {buKey:'saas', tipoReceita:'servico', aliquotaIss:2.9}, {buKey:'setup', tipoReceita:'servico', aliquotaIss:2.9}]`
- Manter `taxEnabled` existente (toggle IRPJ/CSLL)

### 2. Engine — `src/engine/calculationsEngine.ts`
- Criar função `calcularDeducoesPorBU(revenueByBU, buConfigs)` que calcula PIS (0,65%), COFINS (3%), ISS (configurável por BU) separadamente
- **Deduções (L578-581)**: substituir taxa flat por soma de PIS+COFINS+ISS calculados por BU usando as receitas de CaaS, SaaS e Setup do mês
- **IRPJ/CSLL (L692-698)**: substituir taxa flat 34% sobre EBT por **base presumida 32% × (IRPJ 15% + CSLL 9%)** sobre faturamento por BU. IRPJ/CSLL só se EBT > 0 e `taxEnabled`
- Isso muda a alíquota efetiva de IRPJ+CSLL de 34% s/ EBT para 7,68% s/ faturamento (serviços)

### 3. UI — `src/pages/Assumptions.tsx` (L1277-1341)
Substituir o conteúdo da aba Tax Deductions por:

**Card 1: Toggle IRPJ/CSLL** (manter existente)

**Card 2: Configuração por BU** — tabela editável:
| BU | Tipo Receita | ISS (%) | PIS | COFINS | IRPJ efetivo | CSLL efetivo | Total efetivo |
|---|---|---|---|---|---|---|---|
| CaaS | Serviço | [5.0] | 0,65% | 3,00% | 4,80% | 2,88% | 16,33% |
| SaaS | Serviço | [2.9] | 0,65% | 3,00% | 4,80% | 2,88% | 14,23% |
| Setup | Serviço | [2.9] | 0,65% | 3,00% | 4,80% | 2,88% | 14,23% |

- Coluna ISS editável (input numérico)
- Demais colunas são calculadas/read-only
- Info box explicando: "Deduções (PIS+COFINS+ISS) abatidas da Receita Bruta. IRPJ+CSLL abatidos abaixo do EBITDA, somente se EBT > 0."

**Card 3: Resumo projetado** — mostrar para cada ano o total de deduções e IRPJ/CSLL estimados usando as receitas do modelo

### 4. P&L Tree — atualizar detalhes
- Na árvore P&L, quebrar a linha "Deduções" em sub-linhas: PIS, COFINS, ISS (por BU)
- Quebrar "Impostos" em IRPJ e CSLL com base presumida

## Arquivos alterados
1. `src/lib/financialData.ts` — tipos + defaults
2. `src/engine/calculationsEngine.ts` — cálculo por BU
3. `src/pages/Assumptions.tsx` — nova UI da aba Tax Deductions
4. `src/data/modelData.ts` — possível limpeza de `salesDeductions`/`salesDeductionsByYear` (manter como fallback ou remover)

