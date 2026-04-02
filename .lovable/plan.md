

# SaaS — Tributação como Produto (Lucro Presumido 8%/12%)

## Contexto
SaaS está sendo tratado como serviço (base 32%) quando deveria usar bases presumidas de produto: **IRPJ 8%, CSLL 12%**. ISS também deve ser 0% para SaaS.

## Alterações

### 1. `src/lib/financialData.ts` — Defaults SaaS

Em `getDefaultSubProductTaxConfig` (linha 182):
- SaaS: `iss: 0` (não incide), `tipoReceita: 'produto_saas'`
- Demais: mantém `iss: 5.0`, `tipoReceita: 'servico'`

### 2. `src/engine/calculationsEngine.ts` — `getBasePresumida` (linha 592)

Adicionar caso `'produto_saas'` retornando `{ irpj: 0.08, csll: 0.12 }`.

### 3. `src/engine/calculationsEngine.ts` — Adicional IRPJ (linha 869)

O cálculo atual usa `grossRev * 0.32` (flat). Precisa acumular a base presumida por subproduto ao longo do trimestre, respeitando as bases distintas (8% SaaS vs 32% serviços). Mudar para:
- Acumular `quarterBasePresumidaIRPJ` (soma ponderada por subproduto)
- No fim do trimestre: `adicional = max(0, (quarterBasePresumidaIRPJ - 60) * 0.10)`

### 4. `src/pages/Assumptions.tsx` — Nota explicativa

Atualizar texto na seção Tax Deductions para indicar que SaaS usa base presumida de 8%/12%.

### 5. Testes

Atualizar testes para validar que subprodutos SaaS geram impostos menores (base 8%/12%) vs serviços (32%).

## Impacto
- Carga tributária de IRPJ/CSLL sobre SaaS cai significativamente (de ~7.68% efetivo para ~2.28%)
- ISS zerado para SaaS reduz deduções de vendas
- Adicional IRPJ passa a considerar bases mistas corretamente

