

# Mapeamento: Blocos Atuais → Novos 5 Blocos

## Estrutura Atual (4 tabs)

### TAB 1: Revenue (linhas 706-1373)
1. **Número de Clientes** — tabela com subprodutos por grupo (CaaS, SaaS, Education, Expansão, Tax), expandível mês a mês
2. **Ticket Médio** — flat ou por mês, editável
3. **Finance KPI** — Selic mensal, R$ em Custódia
4. **Churn Médio** — taxas por BU (CaaS, SaaS, Education, BaaS)

### TAB 2: COGS & Marketing (linhas 1375-1612)
5. **Marketing Planejado vs Realizado** — toggle planned/actual, tabela histórica
6. **PR e Eventos Marketing** — custo mensal (PR + Eventos)
7. **CAC por Produto** — custo de aquisição por subproduto
8. **Unit Economics** — Ticket Medio, Churn, LTV, LTV:CAC, CAC Medio, Comissão

### TAB 3: SG&A & Financeiro (linhas 1614-2107)
9. **Config Fiscais e Operacionais** — toggle IRPJ/CSLL, taxa equipe Education/Expansão
10. **Resumo Operacional Mensal** — despesas fixas, despesas comerciais, financeiras, provisões (hist vs projetado)
11. **Cost Assumptions** — SG&A % Revenue, SG&A Growth, Headcount Growth
12. **Regime Tributário** — Lucro Presumido vs Lucro Real, taxas PIS/COFINS/ISS
13. **Custos e Margens** — Comissão de Vendas, SG&A Growth, CAPEX, BaaS COGS, PDD
14. **Resumo de Dívidas** — contratos de dívida, parcelas, saldo

### TAB 4: Pessoal & Squad (linhas 2109-2618)
15. **Squad Operação Config** — Squad CaaS, Squad Setup SaaS, impacto por ano
16. **Indicadores de Folha** — Faturamento Folha, Payroll / Gross Revenue, Benefícios
17. **Reembolsos por Centro de Custo** — tabela mensal detalhada
18. **Headcount Projetado por Área** — pessoas vs custo mensal por cargo
19. **Regras de Contratação** — proporções (clientes/cargo) e faixas salariais

---

## Proposta de Mapeamento para os 5 Novos Blocos

### Bloco 1: Revenue
**Manter:**
- Número de Clientes (item 1) — core do modelo de receita
- Ticket Médio (item 2) — define MRR
- Churn Médio (item 4) — impacta diretamente receita

**Remover:**
- Finance KPI / Selic (item 3) — mover para bloco 5

### Bloco 2: Tax Deductions
**Manter (vindo da Tab 3):**
- Regime Tributário (item 12) — Lucro Presumido / Lucro Real, taxas PIS/COFINS/ISS
- Toggle IRPJ/CSLL (parte do item 9) — liga/desliga imposto sobre lucro

**Remover:**
- Custo Equipe Education/Expansão (parte do item 9) — mover para bloco 3

### Bloco 3: COS (Cost of Service)
**Manter:**
- Squad CaaS e Squad Setup SaaS (item 15) — custo direto de entrega
- Headcount Projetado por Área (item 18) — pessoas que entregam o serviço
- Regras de Contratação (item 19) — proporções clientes/cargo e salários
- CAPEX, BaaS COGS/cliente, PDD (partes do item 13) — custos diretos

**Remover:**
- Indicadores de Folha (item 16) — mover para bloco 4 ou excluir
- Reembolsos por Centro de Custo (item 17) — mover para bloco 4

### Bloco 4: SG&A (Sales, General and Administration)
**Manter:**
- Marketing Planejado vs Realizado (item 5) — despesa comercial
- PR e Eventos (item 6) — despesa de marketing
- CAC por Produto (item 7) — custo de aquisição
- Comissão de Vendas (parte do item 13)
- SG&A % Revenue, SG&A Growth (item 11)
- Resumo Operacional Mensal (item 10) — despesas fixas e comerciais
- Indicadores de Folha (item 16) — payroll como % receita
- Reembolsos (item 17) — despesas administrativas

**Remover:**
- Unit Economics (item 8) — é derivado, não premissa; pode ficar na Overview ou ser excluído

### Bloco 5: Economic and Financial Results
**Manter:**
- Finance KPI / Selic (item 3) — rendimentos financeiros
- Resumo de Dívidas (item 14) — custo financeiro
- Headcount Growth % (parte do item 11)

**Remover/Excluir definitivamente:**
- Nada de novo, apenas reagrupar

---

## Itens candidatos a exclusão total
- **Unit Economics** (item 8) — é resultado calculado, não premissa editável. Pode ser excluído ou mantido como "resumo" em Revenue.
- **Custos e Margens** (item 13) — boa parte é info repetida de outros cards. Pode ser desmembrado e redistribuído.
- **R$ em Custódia** (dentro de Finance KPI) — sempre mostra R$ 0, parece placeholder sem uso.

---

Gostaria de confirmar esses mapeamentos e exclusões antes de implementar. Algum item que queira mover de bloco ou manter/remover diferente?

