

## Plano: Adicionar ícones ℹ️ nas seções detalhadas de cada subproduto

O explicador de fórmulas foi adicionado apenas nos KPI cards e na tabela resumo, mas falta nas seções expandidas dentro de cada subproduto. Este plano adiciona os ícones em **todas** as seções detalhadas.

### Novas funções em `src/lib/formulaExplainer.ts`

Criar funções auxiliares que faltam:

- **`explainTicket(key, year, assumptions)`** — Ticket base + crescimento aplicado, mostrando ticket base flat, crescimento % a.m., ticket Jan vs Dez, e média ponderada
- **`explainChurn(key, year, assumptions)`** — Churn base flat + crescimento, taxa mensal, total de churns no ano, % anual resultante
- **`explainFaturamentoBase(key, year, assumptions)`** — Base = faturamento total do mês anterior (MRR), mostrando Dez do ano anterior como ponto de partida
- **`explainIncremento(key, year, assumptions)`** — Novos clientes × ticket do mês, total anual de incremento
- **`explainRevenueChurn(key, year, assumptions)`** — Clientes perdidos × ticket anterior, total anual de revenue churn e % sobre receita
- **`explainNovosClientes(key, year, assumptions)`** — Base flat + crescimento %, total novos no ano
- **`explainClientesAtivos(key, year, assumptions)`** — Fórmula Ativos(m) = Ativos(m-1) + Novos - Churn, com base Dez anterior, Jan e Dez do ano

### Integração em `src/pages/Assumptions.tsx`

Adicionar `<FormulaExplainer>` ao lado do título de cada seção expandida:

| Seção | Linha aprox. | Onde colocar |
|-------|-------------|--------------|
| **Clientes Ativos — {year}** | ~1323 | Ao lado do título `<p>` |
| **Novos Clientes — {year}** | ~1351 | Ao lado do título `<p>` |
| **Logo Churn — {year}** | ~1556 | Ao lado do título `<p>` |
| **Ticket (R$/mês) — {year}** | ~1901 | Ao lado do título `<p>` |
| **Faturamento Base — {year}** | ~2206 | Ao lado do título `<p>` |
| **Incremento — {year}** | ~2228 | Ao lado do título `<p>` |
| **Revenue Churn — {year}** | Após Incremento | Ao lado do título `<p>` |

Cada ícone chamará a função correspondente do `formulaExplainer.ts` passando `prodKey`, `selectedYear`, e `data` (assumptions).

### Detalhes técnicos

- As novas funções seguem o mesmo padrão das existentes: recebem `key, label, year, assumptions` e retornam `FormulaExplanation`
- O componente `FormulaExplainer` já existe e será reutilizado com `iconSize={11}`
- Nenhum arquivo novo — apenas edições em `formulaExplainer.ts` e `Assumptions.tsx`

