

# Adicionar crescimento de ticket + linha de Receita Bruta por subproduto

## O que será feito

Para cada subproduto expandido na aba Revenue:

### 1. Botão "Crescimento %" no bloco de Ticket mensal
Adicionar o mesmo controle de crescimento que já existe na linha de Clientes (input + botão "Aplicar") ao bloco de Ticket (R$/mês). Ao clicar "Aplicar", os meses projetados (não históricos) recebem crescimento composto sobre o ticket base, com interpolação geométrica até Dezembro.

### 2. Nova linha: Receita Bruta Total
Abaixo do bloco de Ticket, adicionar uma 3ª seção "Receita Bruta (R$/mês) — {ano}" que exibe para cada mês:
- **Valor = clientes[mês] × ticket[mês]**
- Somente leitura (sem inputs editáveis)
- Linha de totais: Total Ano (soma dos 12 meses) e MRR Dez (já existente, pode ser movido para cá)

### Arquivo alterado
- `src/pages/Assumptions.tsx` — dentro do bloco expandido de cada subproduto (linhas ~860-932):
  1. **Linhas 861-862**: Adicionar `flex justify-between` com controle de crescimento % (input + Aplicar) ao lado do título "Ticket (R$/mês)"
  2. **Após linha 932**: Inserir novo bloco `<div>` com grid 12 colunas mostrando `clientes × ticket` por mês, formatado como moeda, sem inputs
  3. **Lógica do "Aplicar" no ticket**: similar a `handleApplyRow` — lê o % informado, calcula crescimento composto mês a mês sobre os meses projetados, salva em `monthlyTickets`

### Estado adicional
- `rowTicketGrowthPct: Record<string, number>` — armazena o % de crescimento de ticket por subproduto (default 0)
- `handleApplyTicketGrowth(prodKey, year)` — aplica crescimento composto nos meses projetados do ticket

### Estrutura visual de cada subproduto expandido (após mudança)

```text
┌─ Clientes por ano (target fim de ano) ────────────────────────┐
│  [2025: 21]  [2026: 78]  [2027: 188]  ...                    │
└───────────────────────────────────────────────────────────────┘

┌─ Clientes mensais — 2025 ─────────── Crescimento: [6] % [Aplicar] ─┐
│  Jan 🔒  Fev 🔒  ...  Dez                                          │
│    0       0          58                                            │
│    —       —         21%                                            │
└────────────────────────────────────────────────────────────────────┘

┌─ Ticket (R$/mês) — 2025 ──────────── Crescimento: [0] % [Aplicar] ─┐
│  Jan 🔒  Fev 🔒  ...  Dez                                           │
│  R$2.000  R$2.000     R$2.000                                        │
│  Ticket base (flat): [2000]   Total ano: 246   Dez: 58              │
└─────────────────────────────────────────────────────────────────────┘

┌─ Receita Bruta (R$/mês) — 2025 ────────────────────────────────────┐
│  Jan 🔒  Fev 🔒  ...  Dez                                          │
│  R$ 0    R$ 0        R$ 116.000                                     │
│  Total ano: R$ XXX.XXX   MRR Dez: R$ 116.000                       │
└────────────────────────────────────────────────────────────────────┘
```

Replicado para todos os subprodutos que possuem `dataKey` (editáveis).

