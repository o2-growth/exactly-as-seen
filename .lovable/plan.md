

# Incluir Oxy+Gênio+Especialista na receita do motor de cálculos

## Problema
O produto **Oxy+Gênio+Especialista** (`saasOxyGenioEsp`) existe nas premissas (clientes e ticket) e aparece na aba Assumptions, mas o motor de cálculos (`calculationsEngine.ts`) **não inclui sua receita** no total SaaS. Dois pontos:

1. **Linha 193**: `saasTotal = saasOxy + saasOxyGenio + saasSetup` — falta `saasOxyGenioEsp`
2. **Linha 710**: `saasOxyGenioEsp: 0` — hardcoded zero na árvore P&L

Isso explica a diferença de ~17M entre o que Assumptions mostra e o que P&L/Overview reportam.

## Alterações

### `src/engine/calculationsEngine.ts`

**1. Calcular receita de saasOxyGenioEsp (após linha 182)**
```ts
const saasOxyGenioEsp = getMonthlyClientCount('saas', 'oxyGenioEsp', month, year, assumptions) 
  * getTicketForMonth('saasOxyGenioEsp', month, year, assumptions);
```

**2. Incluir no saasTotal (linha 193)**
```ts
const saasTotal = saasOxy + saasOxyGenio + saasOxyGenioEsp + saasSetup;
```

**3. Retornar no objeto de resultado (após linha 216)**
```ts
saasOxyGenioEsp: saasOxyGenioEsp * scenarioMult,
```

**4. Corrigir árvore P&L (linha 710)**
```ts
saasOxyGenioEsp: rev.saasOxyGenioEsp / 1000,
```

Isso sincroniza o motor com as premissas, eliminando a discrepância de receita entre Assumptions e P&L/Overview.

