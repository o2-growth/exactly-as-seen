

## Plano: Fix análise vertical do P&L (linhas mostrando >100% da Receita Bruta) + build errors

### Diagnóstico do problema

A análise vertical divide cada linha por `grossRevenueByYear[ano]`. Para 2026, a Receita Bruta é **patchada no contexto** (`FinancialModelContext.tsx` linha 257-273) somando os subprodutos das BUs editáveis pelo usuário. Isso faz com que o valor patchado de Receita Bruta seja DIFERENTE do que o engine usou para calcular as outras linhas dependentes.

Resultado: nós que **NÃO foram repatchados** (RECEITA LÍQUIDA `code:'NR'`, LUCRO BRUTO `code:'GP'`, EBITDA, custos COGS de algumas BUs, deduções `code:'2'`, etc.) continuam com valores baseados na Receita Bruta original do engine. Quando dividimos esses valores antigos pela nova Receita Bruta menor (patchada), aparece **123,8%** ou outros percentuais > 100%.

Exemplo concreto:
- Engine calculou Receita Bruta 2026 = R$ 40M, NR = R$ 36M, Deduções = R$ 4M.
- User reduz tickets → contexto patcha node `'1'` para R$ 30M.
- Mas `NR` continua R$ 36M (não foi patchado).
- Análise vertical: 36/30 = **120%** ← bug.

### Correção

Em `src/contexts/FinancialModelContext.tsx`, dentro do mesmo `useMemo` que patcha node `'1'` (linhas 258-274), recalcular consistentemente para 2026+:

1. **Deduções (`code:'2'`)**: aplicar a alíquota de deduções (PIS+COFINS+ISS+desc) sobre a nova Receita Bruta patchada → `dedAn = -patchedRevenue × dedRate(year)`. Usar `salesDeductionsByYear` de `data/modelData.ts`.
2. **RECEITA LÍQUIDA (`code:'NR'`)**: `nr = patchedRevenue + dedAn` (deduções é negativo).
3. **LUCRO BRUTO (`code:'GP'`)**: `gp = nr + cogsTotal` (somar nodes 3.1 a 3.6 já patchados).
4. **GM% (`code:'GM%'`)**: `gp / nr × 100`.
5. **EBITDA (`code:'EBITDA'`)**: `gp + sga(4+5+6+7)` (sga nodes já são patchados nas linhas 292-303).
6. **EBITDA% (`code:'EBITDA%'`)**: `ebitda / nr × 100`.
7. **NI (`code:'NI'`)**, **NM%**, **FCR (`code:'FCR'`)**: recalcular de forma análoga somando os nodes financeiros já patchados (`8R`, `8D`, `OR`, `DNO`) e provisão tributária `TAX`.

Helper a adicionar:
```ts
const sumChildrenAnnual = (codes: string[], y: Year) =>
  codes.reduce((s, c) => s + (findNode(tree, c)?.annual[y] ?? 0), 0);
```

(Usaremos `findNode` exportado do engine ou uma lookup local sobre `tree`.)

### Build errors (pré-existentes)

Resolver os 18 erros de tipo em `src/engine/calculationsEngine.ts` e `src/lib/financialData.ts`:

- **Linhas 1247, 1264, 1404**: `node.monthly = {}` precisa cast: `node.monthly = {} as Record<Year, number[]>`.
- **Linha 1295**: `historicalRevenueItems[group] ?? {}` — o fallback `{}` precisa ser tipado como `Record<string, Record<string, number>>`.
- **Linhas 1478-1483**: `MonthlyPnL` não tem `cogsCaas/cogsSaas/cogsEdu/cogsCS/cogsBaas/cogsTax`. A flag `hasPerBuMonthly` (linha 1486) já garante que esse bloco nunca executa em runtime, mas o TS reclama. Solução: usar cast `(d as any).cogsCaas` nas funções `engineFn`.
- **Linhas 830-842 em `financialData.ts`**: `SubProductClients` precisa de index signature `[key: string]: Record<Year, number>` ou cast para o tipo esperado nas chamadas.

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/contexts/FinancialModelContext.tsx` | Adicionar repatch de NR, GP, GM%, EBITDA, EBITDA%, NI, NM%, FCR e Deduções (code '2') após o patch de node '1' |
| `src/engine/calculationsEngine.ts` | Casts de tipo em linhas 1247, 1264, 1295, 1404, 1478-1483 |
| `src/lib/financialData.ts` | Cast em linhas 830, 831, 842 para SubProductClients |

Nenhuma alteração visual — apenas a análise vertical passará a mostrar 100% para RECEITA BRUTA e percentuais corretos < 100% para as demais linhas.

