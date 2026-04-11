# Bug: Engine trata todos produtos como MRR no cálculo de receita projetada

> Descoberto em 2026-04-11 durante investigação da divergência de receita 2026
> no dashboard (Header R$ 70.293k vs Chart R$ 69.065k).

## TL;DR

O engine (`src/engine/calculationsEngine.ts:calcMonthlyRevenue`) calcula a receita
mensal de **todos** os sub-produtos usando a fórmula `clientesAtivos × ticket`,
sem distinguir entre produtos MRR (recorrente) e produtos não-MRR (one-shot).

Isso **superestima** severamente a receita projetada de 15 dos 21 sub-produtos
em todos os anos/meses projetados (2026 Apr-Dec + 2027-2030 completo).

O bug fica **invisível** em 2025 e em Q1 2026 porque `applyHistoricalOverrides`
substitui os valores do engine pelos dados reais da Oxy. Aparece apenas em
períodos puramente projetados.

## Fórmula errada

**Arquivo:** `src/engine/calculationsEngine.ts`, linhas 177-208

```ts
const caasAssessoria = getMonthlyClientCount('caas', 'assessoria', month, year, assumptions)
                     * getTicketForMonth('caasAssessoria', month, year, assumptions);
const taxGPT = getMonthlyClientCount('tax', 'gpt', month, year, assumptions)
             * getTicketForMonth('taxGPT', month, year, assumptions);
// ... mesmo padrão para TODOS os produtos
```

Para MRR (clientes recorrentes), essa fórmula está correta:
`receita_mês = clientes_ativos_no_mês × mensalidade`

Para não-MRR (projetos one-shot), essa fórmula está **errada**:
- `getMonthlyClientCount` retorna o número de clientes **acumulados** que já
  passaram pelo funil (via interpolação linear entre `start` e `end`)
- Multiplicar isso por `ticket` trata cada cliente como se estivesse pagando
  todo mês, quando na realidade um cliente one-shot paga uma única vez

### Fórmula correta para não-MRR

```ts
const novosNoMes = (subProductClients[key][year] - subProductClients[key][year-1]) / 12;
const receitaMes = novosNoMes × valorDoProjeto;
```

## Produtos afetados

### MRR (6) — cálculo correto
- `caasEnterprise`
- `caasCorporate`
- `saasOxy`
- `saasOxyGenio`
- `saasOxyGenioEsp`
- `taxAT` (Assessoria Tributária)

### Não-MRR (15) — cálculo errado
- `caasAssessoria` (Serviços Especializados)
- `caasSetup` (BPO Financeiro)
- `caasParceiros`
- `saasSetup`
- `saasParceiros`
- `educationDonoCFO`
- `educationEN`
- `educationFR`
- `educationFSP`
- `baas` (Oxy Hacker)
- `baasFranquia`
- `baasMasterFranquia`
- `taxGPT` (Gestão Passivo Tributário)
- `taxRCT` (Recuperação Crédito Tributário)
- `taxRT` (Reforma Tributária)
- `taxDTC` (Diagnóstico Tributário)

## Magnitude do erro — Q1 2026

Teste empírico com `DEFAULT_ASSUMPTIONS` comparando engine vs Oxy real:

| BU | Engine Q1 | Real Q1 (Oxy) | Ratio |
|----|-----------|---------------|-------|
| CaaS | R$ 4.885k | R$ 2.178k | 2.24x over |
| SaaS | R$ 18.515k | R$ 720k | 25.7x over |
| Education | R$ 69k | R$ 0 | ∞ over |
| Expansão | R$ 0 | R$ 158k | subestima (seed errado) |
| Tax | R$ 198k | R$ 131k | 1.52x over |
| **Total** | **R$ 23.667k** | **R$ 3.187k** | **7.4x over** |

O engine produz ~7.4x a receita real em Q1 2026 (com assumptions default).
Em assumptions reais do usuário o fator pode ser diferente, mas o viés está presente.

## Por que o bug passou despercebido

1. **Overrides históricos escondem o bug pra 2025 e Q1 2026.**
   A função `applyHistoricalOverrides` substitui os valores do engine no PnL tree
   pelos dados reais da Oxy para esses períodos. O engine roda mas seu output é
   descartado.

2. **2026 Apr-Dec e 2027+ mostram valores agregados.**
   O usuário vê "Receita Projetada por BU" como totais por BU, não por sub-produto.
   Os totais parecem plausíveis (crescem ano a ano) mesmo estando inflados.

3. **`validateOutputs` só emite warnings.**
   Os warnings mostram "computed 44,119 vs expected 13,777 (220% deviation)" mas
   não bloqueiam nada. Foram ignorados por muito tempo.

## Fix implementado pra Tax (workaround parcial)

**Arquivo:** `src/engine/calculationsEngine.ts:1434`

Volta a usar `getHistoricalAnnual` em vez de `mixedYear` para Tax 2026.
Consequência: Tax 2026 no tree P&L mostra apenas Q1 histórico real, Apr-Dec = 0.

```ts
const tax2026 = getHistoricalAnnual(historicalRevenue, 'Tax', 2026) ?? 0;
```

Tradeoff:
- ✅ Dado honesto (apenas o que foi confirmado na Oxy)
- ❌ Divergência visível de ~R$ 1.228k entre Header e Chart
- ❌ Não contabiliza a projeção Apr-Dec

As outras BUs (CaaS, SaaS, Education, Expansão) **continuam usando `mixedYear`** e
portanto **continuam com valores inflados** em seus totais projetados. O fix do
Tax foi feito de forma isolada porque foi o único commit de divergência
diretamente investigado.

## Fix definitivo — plano

Refatorar `calcMonthlyRevenue` para distinguir MRR vs não-MRR:

```ts
function calcMonthlyRevenueForProduct(
  key: TicketKey,
  month: number,
  year: number,
  assumptions: Assumptions,
): number {
  const ticket = getTicketForMonth(key, month, year, assumptions);

  if (isProductMrr(key)) {
    // MRR: receita_mês = clientes_ativos × mensalidade
    const activeClients = getMonthlyClientCount(buFromKey(key), productFromKey(key), month, year, assumptions);
    return activeClients * ticket;
  } else {
    // Não-MRR: receita_mês = novos_clientes_no_mês × valor_do_projeto
    const newClientsInMonth = getMonthlyNewClients(key, month, year, assumptions);
    return newClientsInMonth * ticket;
  }
}
```

Onde `getMonthlyNewClients` calcula:
- Meses históricos: usar `historical_clients.client_count` diff ano-a-ano ou API direta
- Meses projetados: `(endClients - startClients) / 12`

## Validação requerida antes de aplicar o fix definitivo

1. Testes comparando engine vs Oxy real para Q1 2026 em todas as BUs
2. Validação com usuário dos valores projetados 2026 Apr-Dec para cada BU
3. Regression check do P&L completo (impacto em EBITDA, deduções, IRPJ/CSLL, cash flow)
4. Atualizar `expectedOutputs` em `src/data/modelData.ts`

## Estimativa de trabalho

- Refactor de `calcMonthlyRevenue`: ~1-2 horas
- Implementação de `getMonthlyNewClients`: ~1 hora
- Testes + validação: ~2-3 horas
- Regressão P&L/CashFlow/Valuation: ~1-2 horas

**Total: 5-8 horas de trabalho focado**

## Referências

- Linha da fórmula errada: `src/engine/calculationsEngine.ts:177-234`
- Linha do workaround do Tax: `src/engine/calculationsEngine.ts:1434`
- Commit que introduziu o workaround original: `78fdfc4` (2026-03-26)
- Commit que adicionou Tax como BU no engine: `9308b3b` (sem update do workaround)
- Commit do meu fix quebrado: `a39dfc7` (revertido)
- Historical real data: `src/data/historicalData.ts:77` (RECEITA BRUTA), por-BU em `historicalRevenue`
