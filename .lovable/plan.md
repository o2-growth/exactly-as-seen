

# Crescimento de churn mensal linear (não composto anual)

## Mudança de lógica

Atualmente o crescimento de churn é **composto por ano** (ex: 5% → 5.5% → 6.05%). O usuário quer que o crescimento seja **linear e mensal**: pega o % de crescimento, divide por 12, e soma essa fração à taxa base a cada mês.

**Exemplo**: churn base 5% a.a., crescimento 12%:
- Incremento mensal = 12% / 12 = 1 ponto percentual por mês
- Mês 1: 5.0% | Mês 2: 6.0% | Mês 3: 7.0% | ... | Mês 12: 16.0%
- Ano seguinte continua de onde parou: Mês 13: 17.0% | etc.

## Alterações

### 1. `src/pages/Assumptions.tsx` — Botão "Aplicar" (linhas 1395-1417)

Em vez de calcular taxas anuais compostas, calcular **churn por mês** e armazenar no `monthlyChurnRates` como array de 12 valores por ano:

```
const monthlyIncrement = growthPct / 12;  // incremento em p.p. por mês
let currentRate = baseVal;  // taxa anual base (ex: 5)
for each year:
  for each month (0-11):
    currentRate += monthlyIncrement;
    monthlyRates[year][month] = currentRate;
```

### 2. `src/lib/financialData.ts` — Tipo `monthlyChurnRates`

Alterar de `Partial<Record<TicketKey, Partial<Record<Year, number>>>>` para suportar **arrays de 12 valores**: `Partial<Record<TicketKey, Partial<Record<Year, number | number[]>>>>`.

### 3. `src/pages/Assumptions.tsx` — `getChurnMonthly` → `getChurnForMonth`

Aceitar `monthIndex` como parâmetro. Se `monthlyChurnRates[key][year]` for um array, retornar `array[monthIndex] / 100 / 12`. Se for um número (legado), manter comportamento atual.

### 4. Atualizar todos os call sites de `getChurnMonthly`

Passar o índice do mês em cada uso (loops de projeção, grid de churn, display de resumo). São ~10 call sites, todos em `Assumptions.tsx`.

### 5. `reprojectWithChurn` — usar churn variável por mês

Na linha 752, em vez de `churnRate` fixo, usar a taxa do mês corrente.

### 6. Preview "Churn por ano" — mostrar range

Em vez de "2025: 5%", mostrar "2025: 5.0→16.0%" para indicar a evolução mensal.

## Resultado
Com churn base 5% e crescimento 12%: cada mês aumenta 1 p.p., visível imediatamente na grid mensal.

