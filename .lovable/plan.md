

## Sistema de Mix Multi-Perfil por Subcategoria

### Conceito

Substituir o campo único `mixServicoPct` (número) por um array de **fatias tributárias** (`taxSlices`), onde cada fatia tem um perfil e um peso percentual. Cada fatia é calculada separadamente — seus impostos sobre receita (PIS, COFINS, ISS) e sobre lucro (IRPJ, CSLL) são computados de forma independente — e depois somados proporcionalmente.

**Exemplo**: CaaS com 50% Serviço + 50% E-book:
- Fatia 1 (50%): R$50k × base 32% × 15% IRPJ + PIS 0,65% + COFINS 3% + ISS 5%
- Fatia 2 (50%): R$50k × base 8% × 15% IRPJ + PIS 0,65% + COFINS 3% + ISS 0%
- Total = soma dos dois

### Arquivos e Alterações

#### 1. `src/lib/financialData.ts` — Modelo de Dados

- Criar interface `TaxSlice = { profileKey: string; pct: number }` (pct de 0–100)
- Adicionar `taxSlices?: TaxSlice[]` ao `SubProductTaxConfig`
- Quando `perfilTributario` é um perfil fixo → equivale a uma fatia única de 100%
- Quando `perfilTributario = 'mix'` → ler do array `taxSlices`
- Manter `mixServicoPct` para retrocompatibilidade (migrado para `taxSlices` no load)
- Atualizar `getEffectivePresumido()` para calcular média ponderada das fatias
- Criar `getEffectiveTaxRates(cfg)` que retorna as alíquotas ponderadas (PIS, COFINS, ISS, presumidoIRPJ, presumidoCSLL) considerando todas as fatias

#### 2. `src/engine/calculationsEngine.ts` — Motor de Cálculo

- Em `calcularDeducoesPorSubproduto`: para cada subproduto, iterar pelas fatias e calcular PIS/COFINS/ISS separadamente por fatia, somando os resultados ponderados
- Em IRPJ/CSLL (linhas 856-865): iterar pelas fatias de cada subproduto, calculando `fat × pct × base_fatia × alíquota` separadamente
- No acumulador do adicional IRPJ (linhas 868-886): mesma lógica — acumular `fat × pct × base_irpj_fatia` por fatia

#### 3. `src/pages/PremissasPage.tsx` — UI de Edição de Fatias

- Quando `perfilTributario = 'mix'`, exibir um mini-editor de fatias abaixo da linha do subproduto:
  - Cada fatia: dropdown de perfil + input de % + botão remover
  - Botão "Adicionar fatia"
  - Validação: soma dos % deve ser 100%
  - Mostrar totais ponderados resultantes (PIS, COFINS, ISS, base IRPJ/CSLL efetiva)

#### 4. `src/pages/Assumptions.tsx` — Aba Tax Deductions

- Para subprodutos com mix multi-perfil, exibir indicador visual das fatias ativas
- Valores de alíquota mostram os ponderados resultantes (read-only quando mix ativo)

#### 5. `src/contexts/FinancialModelContext.tsx` — Migração

- No carregamento, migrar configs antigas com `mixServicoPct` para `taxSlices`:
  - `mixServicoPct: 50` → `taxSlices: [{ profileKey: 'servico', pct: 50 }, { profileKey: 'ebook', pct: 50 }]`
  - Perfil fixo sem mix → sem `taxSlices` (equivale a fatia única implícita)

### Fluxo de Cálculo

```text
Receita subproduto: R$100k (ex: caasAssessoria)
taxSlices: [{ servico: 50% }, { ebook: 50% }]

Fatia 1 — Serviço (50% = R$50k):
  PIS    = 50k × 0,65%  = 325
  COFINS = 50k × 3,00%  = 1.500
  ISS    = 50k × 5,00%  = 2.500
  IRPJ   = 50k × 32% × 15% = 2.400
  CSLL   = 50k × 32% × 9%  = 1.440

Fatia 2 — E-book (50% = R$50k):
  PIS    = 50k × 0,65%  = 325
  COFINS = 50k × 3,00%  = 1.500
  ISS    = 50k × 0,00%  = 0
  IRPJ   = 50k × 8% × 15%  = 600
  CSLL   = 50k × 12% × 9%  = 540

TOTAL:
  PIS=650, COFINS=3.000, ISS=2.500, IRPJ=3.000, CSLL=1.980
```

