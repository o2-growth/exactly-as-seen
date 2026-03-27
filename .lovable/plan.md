

# Remover bloco "Ticket Médio" standalone da aba Revenue

## O que será feito
Remover o bloco "Section 2: Ticket Médio" (linhas 1193-1323 de `src/pages/Assumptions.tsx`) que exibe a tabela grande de tickets por subproduto. Essa informação agora já está dentro de cada subproduto expandido, tornando este bloco redundante.

## Arquivo alterado
- `src/pages/Assumptions.tsx` — deletar linhas 1193-1323 (o `div` com comentário `{/* ── Section 2: Ticket Médio ── */}` até o fechamento antes de `{/* ── Section 3: Churn Médio ── */}`)

## O que permanece
- Ticket editável dentro de cada subproduto expandido (com crescimento % e Receita Bruta)
- Seção de Churn Médio (Section 3) continua intacta
- Seção de Clientes (Section 1) continua intacta

