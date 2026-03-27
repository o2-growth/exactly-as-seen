

# Adicionar linha de Churn dentro de cada subproduto + remover bloco "Churn Médio" standalone

## Resumo
Adicionar uma 4ª linha em cada subproduto expandido: **Churn (clientes/mês)**, com controle "Taxa de churn (%)" + botão "Aplicar" (mesma UX do crescimento). Depois, remover o bloco standalone "Churn Médio" (Section 3, linhas 1199-1259) e o bloco "Churn por produto" na tabela principal (linhas 1093-1132), pois ficam redundantes.

## Modelo de dados

**`src/lib/financialData.ts`**:
- Adicionar campo `monthlyChurnRates?: Partial<Record<SubProductKey, Partial<Record<Year, number[]>>>>` na interface `Assumptions` — armazena taxa de churn mensal (%) por subproduto/ano (12 valores). Quando não definido, usa o valor flat atual (`churnCaas`, `churnSaas`, etc.) dividido por 12.
- Adicionar defaults vazios em `DEFAULT_ASSUMPTIONS`.

## UI — dentro de cada subproduto expandido

**`src/pages/Assumptions.tsx`**:

Após a seção "Receita Bruta" (linha ~1037), adicionar bloco **Churn**:

```
┌─ Churn (clientes/mês) — 2025 ──────────── Taxa de churn: [ 5 ] % [Aplicar] ─┐
│  Jan 🔒  Fev 🔒  ...  Dez                                                    │
│  0       0            3                                                       │
│  Total ano: XX                                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Cálculo**: Para cada mês, `churn[m] = Math.round(clientes[m-1] * taxaMensal[m])`, onde `taxaMensal` vem de `monthlyChurnRates` ou do flat rate da BU.
- **"Aplicar"**: preenche todos os meses projetados com a taxa digitada (valor anual em %, convertido para mensal /12). Meses históricos ficam 🔒.
- Os valores de churn são exibidos em vermelho (text-negative), read-only (são calculados).

## Estado local
- Adicionar `rowChurnPct` state (similar a `rowApplyPct`) para armazenar a taxa digitada por subproduto.
- Função `handleApplyChurnRate(key, year)` que distribui a taxa para todos os meses projetados em `monthlyChurnRates`.

## Remoções
1. **Bloco "Churn por produto"** (linhas 1093-1132) — tabela de churn por subproduto na seção principal.
2. **Bloco "Churn Médio" standalone** (linhas 1199-1259) — Section 3 com CaaS/SaaS/Education/BaaS.
3. Manter os totais de Churn na seção "Totais: Novos Clientes e Churn" (linhas 1134-1193), recalculando com as novas taxas mensais.

## Integração com o engine
- Atualizar `getChurnMonthly` para aceitar mês e retornar a taxa mensal do `monthlyChurnRates` quando disponível, senão fallback para o flat rate atual. Isso garante que o cálculo de projeção de clientes use as taxas mensais personalizadas.

## Arquivos alterados
1. `src/lib/financialData.ts` — novo campo `monthlyChurnRates` na interface + defaults
2. `src/pages/Assumptions.tsx` — adicionar bloco Churn por subproduto, remover Section 3 e bloco Churn por produto

