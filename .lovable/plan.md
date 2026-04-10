

## Diagnóstico: Por que o split/mix de tributação não funciona

### Problema 1 — `getBasePresumida()` ignora tudo e retorna 32% fixo
No `calculationsEngine.ts` linha 594-597:
```text
function getBasePresumida(_tipoReceita: string) {
  return { irpj: 0.32, csll: 0.32 };  // ← HARDCODED, ignora o parâmetro
}
```
Mesmo que `taxPremises.tsx` defina bases presumidas diferentes por subcategoria, o motor **nunca as lê**. Todas as 22 subcategorias são tributadas a 32%/32%.

### Problema 2 — `SubProductTaxConfig` não tem campos de base presumida
A interface em `financialData.ts` (linha 164-174) tem PIS, COFINS, ISS, ICMS... mas **não tem** `presumidoIRPJ` nem `presumidoCSLL`. Portanto, mesmo que o usuário edite na aba Tax Deductions do Assumptions, não há como persistir bases presumidas diferentes por subproduto.

### Problema 3 — PremissasPage está isolada
A `PremissasPage.tsx` salva overrides em `localStorage('o2-premissas-overrides-v1')`, mas o motor de cálculo lê de `assumptions.subProductTaxRates` (via `getSubProductTaxRate`). As duas fontes **nunca se cruzam**.

### Problema 4 — UI do Assumptions mostra base fixa
Na aba Tax Deductions do Assumptions (linha 2693-2704), `PRES_IRPJ` e `PRES_CSLL` são `const 0.32` — não são editáveis e não variam por subcategoria.

---

## Plano de Correção

### Passo 1 — Adicionar `presumidoIRPJ` e `presumidoCSLL` ao `SubProductTaxConfig`
Em `src/lib/financialData.ts`, adicionar os dois campos à interface. Atualizar `getDefaultSubProductTaxConfig()` para retornar os defaults corretos do `taxPremises.tsx` por subcategoria (32% para todos hoje, mas a arquitetura suportará valores diferentes).

### Passo 2 — `getBasePresumida()` ler do config ao invés de hardcoded
No `calculationsEngine.ts`, alterar para usar `cfg.presumidoIRPJ` e `cfg.presumidoCSLL` que já estão disponíveis via `getSubProductTaxRate`. Eliminar a função `getBasePresumida` separada.

### Passo 3 — Unificar PremissasPage com o motor de cálculo
Duas opções (recomendo A):

**A) PremissasPage alimenta `assumptions.subProductTaxRates`**: quando o usuário edita na PremissasPage, os valores são gravados no `FinancialModelContext` (mesma fonte que o motor lê). A PremissasPage deixa de usar localStorage próprio e passa a usar o contexto.

**B) Motor lê de ambas as fontes**: mais complexo e propenso a conflitos.

### Passo 4 — UI do Assumptions refletir valores dinâmicos
Na aba Tax Deductions, as linhas "Pres. IRPJ" e "Pres. CSLL" passam a ler do `cfg.presumidoIRPJ`/`cfg.presumidoCSLL` de cada subproduto (editáveis), ao invés de exibir `const 0.32`.

### Passo 5 — Mapa de chaves PremissasPage ↔ TicketKey
Criar mapeamento entre as chaves do `TAX_PREMISES` (ex: `'CaaS/Serviços Especializados'`) e os `TicketKey` do motor (ex: `'caasAssessoria'`), para que edições na PremissasPage atualizem o subproduto correto.

### Resumo de arquivos alterados
- `src/lib/financialData.ts` — interface + defaults
- `src/engine/calculationsEngine.ts` — eliminar hardcode
- `src/pages/PremissasPage.tsx` — conectar ao contexto
- `src/pages/Assumptions.tsx` — UI dinâmica para presumido

