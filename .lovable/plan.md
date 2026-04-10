

## Funcionalidade: "Como chegamos nesse número?" — Explicador de Fórmulas

### Objetivo
Adicionar um botão/ícone de info (ℹ️) ao lado de cada métrica calculada na página Assumptions. Ao clicar, abre um popover/tooltip que mostra a decomposição da fórmula, os valores de entrada e de onde vieram.

### Métricas cobertas

**Revenue tab:**
- **Faturamento (Receita Bruta)** por subproduto → `Clientes × Ticket Médio`
- **Clientes por ano** → soma dos 12 meses (mensal = ativo anterior + novos - churn)
- **Ticket Médio** → ticket base × (1 + crescimento%)^mês
- **Churn** → taxa mensal × base ativa = clientes perdidos
- **Nova Receita** → novos clientes × ticket

**Tax Deductions tab:**
- **Total Efetivo** → PIS + COFINS + ISS + IRPJ efetivo + CSLL efetivo
- **IRPJ efetivo** → base presumida × 15%
- **CSLL efetivo** → base presumida × 9%
- **Mix ponderado** → Σ(fatia% × alíquota do perfil)

**COS tab:**
- Custo por BU → headcount × salário (ex: `ceil(clientes/ratio) × salário`)

**KPI Cards (topo):**
- Receita Bruta → soma de todas as BUs
- EBITDA → Receita Líq - COGS - Despesas Operacionais
- Margem Bruta → Lucro Bruto / Receita Líq × 100

### Implementação

#### 1. Novo componente `FormulaExplainer`
Arquivo: `src/components/assumptions/FormulaExplainer.tsx`

- Componente que recebe um array de `{ label, value, source }` (as parcelas da fórmula) e o resultado final
- Renderiza um ícone `Info` (lucide) que ao ser clicado abre um `Popover` mostrando:
  - A fórmula textual (ex: `Receita = Clientes × Ticket`)
  - Tabela com cada parcela, seu valor e a origem (ex: "Aba Revenue, linha CaaS/Assessoria")
  - O resultado final

```text
┌──────────────────────────────────────────┐
│ 📐 Como chegamos em R$ 6.300.000        │
│                                          │
│ Fórmula: Clientes × Ticket Médio        │
│                                          │
│  Clientes (dez/2025):  21               │
│  Fonte: Premissa "Novos Clientes"       │
│                                          │
│  Ticket Médio:   R$ 25.000              │
│  Fonte: Premissa "Ticket base (flat)"   │
│                                          │
│  = 21 × R$ 25.000 × 12 = R$ 6.300.000  │
└──────────────────────────────────────────┘
```

#### 2. Helper `buildExplanation()`
Arquivo: `src/lib/formulaExplainer.ts`

Funções que, dado um subproduto/ano/assumptions, retornam a decomposição:
- `explainRevenue(key, year, assumptions, model)` — clientes × ticket, mês a mês
- `explainClients(key, year, assumptions)` — base anterior + novos - churn por mês
- `explainTicket(key, year, assumptions)` — ticket base + crescimento aplicado
- `explainChurn(key, year, assumptions)` — taxa base + crescimento linear
- `explainTaxEffective(key, assumptions)` — fatias × alíquotas → total ponderado
- `explainCOS(buKey, year, assumptions, model)` — headcount × salário
- `explainKPI(kpiCode, year, model)` — decomposição de EBITDA, margem, etc.

Cada função retorna:
```ts
interface FormulaExplanation {
  title: string;           // "Receita CaaS/Assessoria — 2025"
  formula: string;         // "Clientes × Ticket Médio"
  steps: { label: string; value: string; source: string }[];
  result: string;          // "R$ 6.300.000"
}
```

#### 3. Integração na UI (`Assumptions.tsx`)
- Nos KPI cards do topo: adicionar `<FormulaExplainer>` ao lado de cada valor
- Na tabela de clientes: ícone ao lado do total anual de cada subproduto
- Na tabela de tickets: ícone ao lado do ticket médio
- Na tabela de churn: ícone ao lado da taxa
- Na seção Tax Deductions: ícone ao lado do "Total Efetivo"
- Na seção COS: ícone ao lado do custo total por BU

#### Resumo de arquivos
| Arquivo | Ação |
|---------|------|
| `src/lib/formulaExplainer.ts` | **Novo** — lógica de decomposição de fórmulas |
| `src/components/assumptions/FormulaExplainer.tsx` | **Novo** — componente Popover com a explicação |
| `src/pages/Assumptions.tsx` | **Editar** — adicionar `<FormulaExplainer>` ao lado das métricas calculadas |

