

# Corrigir cálculo do Setup: usar soma absoluta, não deltas

## Problema
O código atual calcula Setup como a soma dos **deltas mensais** (novos clientes = mês atual - mês anterior) dos 5 produtos. Isso dá valores muito pequenos (ex: 3 em abril). O correto é que Setup = soma dos **valores absolutos de clientes** dos 5 produtos naquele mês.

Exemplo abril: Enterprise(~10) + Corporate(~5) + Oxy(~25) + OxyGenio(~8) + OxyGenioEsp(~5) = ~53.

## Alteração

### `src/engine/calculationsEngine.ts` (linhas 183-196)

Substituir a lógica de deltas pela soma direta:

```ts
// SaaS setup: sum of absolute client counts from 5 products
const setupSources: [string, string][] = [
  ['caas', 'enterprise'], ['caas', 'corporate'],
  ['saas', 'oxy'], ['saas', 'oxyGenio'], ['saas', 'oxyGenioEsp'],
];
let setupNewClients = 0;
for (const [bu, prod] of setupSources) {
  setupNewClients += getMonthlyClientCount(bu, prod, month, year, assumptions);
}
const saasSetup = setupNewClients * getTicketForMonth('saasSetup', month, year, assumptions);
```

Remove o cálculo de `prev` e `Math.max(0, curr - prev)`. Simplesmente soma os clientes dos 5 produtos no mês.

