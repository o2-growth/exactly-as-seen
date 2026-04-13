

## Lógica atual do COS e plano de melhoria

### Como funciona hoje

A aba COS (Cost of Service) calcula custos operacionais em 6 categorias, todas derivadas das premissas (Assumptions):

```text
Assumptions (clientes, receita, cosConfig)
    │
    ▼
calcCOSFromConfig() — engine mensal
    │
    ├── 3.1 CaaS: Headcount por ratio (PFD 1:100, CFO 1:15, FP&A 1:7.5) × salário
    ├── 3.2 SaaS: Dev Sr + CS por base ativa; Squad Setup por novos/mês
    ├── 3.3 Education: 15% da receita bruta
    ├── 3.4 Customer Success: CX Analyst 1:100 clientes CaaS
    ├── 3.5 Expansão: 15% da receita bruta
    └── 3.6 Tax: 15% da receita bruta
    │
    ▼
P&L → Lucro Bruto → restante da plataforma
```

A tabela "Impacto COS por Ano" mostra os custos anuais e o % da receita, mas falta: (1) o detalhamento de headcount/squads projetados, (2) o custo real líquido considerando impostos, e (3) uma visão consolidada de margem bruta real.

### O que será adicionado

**1. Tabela de Squads Projetados por Ano** — abaixo dos cards de configuração, uma tabela mostrando para cada ano (2025–2030):
- Clientes CaaS ativos → PFDs, CFOs, FP&As necessários → Total headcount CaaS
- Clientes SaaS ativos → Dev Srs, CSs necessários
- Novos clientes/mês → Squads Setup, Head of Data
- Clientes CaaS → CX Analysts
- **Total de pessoas no COS** por ano

**2. Resumo Financeiro Real (final da página)** — tabela consolidada por ano:
- Receita Bruta (do engine)
- Impostos (usando as premissas tributárias já configuradas na plataforma — `subProductTaxRates`)
- Receita Líquida (após deduções)
- COS Total (valor absoluto)
- **Lucro Bruto** (Receita Líquida - COS)
- **Margem Bruta %** (Lucro Bruto / Receita Líquida)
- Headcount total COS

Todos os valores são lidos diretamente de `model.years[y]` (que já processa impostos das premissas tributárias).

### Detalhes técnicos

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Assumptions.tsx` | Adicionar tabela de squads projetados e resumo financeiro real no final do `TabsContent value="cos"` |

Nenhuma alteração no engine ou em `financialData.ts` — todos os dados necessários já existem em `model.years[y]` (grossRevenue, deductions, netRevenue, grossProfit, grossMarginPct) e a lógica de headcount já está calculada no `yearImpact` existente. É puramente uma adição de UI na aba COS.

