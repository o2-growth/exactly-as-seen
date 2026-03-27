

# Reestruturar aba Assumptions em 5 blocos

## O que será feito

1. **Atualizar cabeçalho** — adicionar descrição explicativa abaixo do título "Assumptions":
   > "Premissas da modelagem financeira. Os valores definidos aqui alimentam o P&L projetado, Cash Flow e demais demonstrações."

2. **Substituir as 4 tabs atuais** (Revenue, COGS & Marketing, SG&A & Financeiro, Pessoal & Squad) por **5 tabs**:
   - **Revenue** — premissas de receita (clientes, tickets, churn)
   - **Tax Deductions** — deduções fiscais (impostos sobre receita)
   - **COS (Cost of Service)** — custos diretos de serviço
   - **SG&A** — despesas gerais, administrativas e comerciais
   - **Economic and Financial Results** — resultados econômicos e financeiros

3. **Conteúdo inicial dos blocos** — cada tab terá apenas um placeholder com título e descrição, pronto para ser preenchido bloco a bloco nas próximas iterações. O conteúdo atual das tabs será removido (poderemos recuperar o que for necessário ao implementar cada bloco).

4. **Manter elementos acima das tabs** — header com botões Edit/Save/Reset, seletor de ano, KPI cards e gráficos permanecem inalterados.

## Arquivo alterado
- `src/pages/Assumptions.tsx` — substituir o bloco `<Tabs>` (linhas 697-2619) pelos 5 novos blocos com placeholders, e adicionar descrição no header (linha 578).

## Detalhe técnico
- Grid de tabs muda de `grid-cols-4` para `grid-cols-5`
- Cada `TabsContent` terá um card vazio com título do bloco e texto "Em construção — configurar premissas bloco a bloco"
- Todo o conteúdo antigo das tabs será removido nesta etapa

