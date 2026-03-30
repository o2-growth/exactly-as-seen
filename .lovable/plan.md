

# Corrigir exibição de clientes Setup na grid mensal

## Problema
O motor de cálculos (`calculationsEngine.ts`) já calcula Setup como soma dos 5 produtos. Porém a **grid mensal na UI** usa `getMonthlyClients('saasSetup', ...)` de `monthlyData.ts`, que lê dados estáticos de `subProductClients.saasSetup` — não reflete o cálculo dinâmico.

## Solução

### `src/lib/monthlyData.ts` — função `getMonthlyClients`
Adicionar lógica especial no início da função: quando `key === 'saasSetup'`, calcular o valor como soma dos clientes mensais dos 5 produtos fonte:

```ts
if (key === 'saasSetup') {
  const sources: SubProductKey[] = [
    'caasEnterprise', 'caasCorporate', 
    'saasOxy', 'saasOxyGenio', 'saasOxyGenioEsp'
  ];
  return Array.from({ length: 12 }, (_, m) => {
    let total = 0;
    for (const src of sources) {
      const srcMonthly = getMonthlyClients(src, year, subProductClients, ticketPrices, monthlyClientOverrides);
      total += Math.round(srcMonthly[m]);
    }
    return total;
  });
}
```

Isso garante que a grid de clientes do Setup mostre os mesmos valores que o motor usa para receita — a soma absoluta de Enterprise + Corporate + Oxy + Oxy+Gênio + Oxy+Gênio+Esp para cada mês.

