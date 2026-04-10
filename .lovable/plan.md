

## Plano: Aplicar arquivos taxPremises.tsx e PremissasPage.tsx

### Contexto

Você enviou dois arquivos:
1. **`taxPremises.tsx`** — dados de referência de premissas tributárias (já existe em `src/data/taxPremises.tsx` com conteúdo idêntico, não precisa alterar)
2. **`PremissasPage.tsx`** — nova página editável de premissas tributárias com tabela interativa, filtros e persistência via localStorage

Além disso, há **3 erros de build** pré-existentes em `src/pages/Assumptions.tsx` que precisam ser corrigidos (tipos incompatíveis no sistema de growth por ano).

### O que será feito

**Passo 1 — Corrigir erros de build em Assumptions.tsx**
- A função `setGrowthForYear` retorna `Record<string, number | Record<number, number>>` mas `setRowApplyPctPersist` espera `Record<string, number>`. Atualizar a tipagem de `setRowApplyPctPersist` (e similares) para aceitar `Record<string, number | Record<number, number>>`.

**Passo 2 — Criar `src/pages/PremissasPage.tsx`**
- Copiar o arquivo enviado para o projeto. A página já importa de `@/data/taxPremises` que já existe.

**Passo 3 — Adicionar rota e link na sidebar**
- Adicionar rota `/premissas` no `App.tsx` apontando para `PremissasPage`
- Adicionar item "Premissas Tributárias" na sidebar (`AppSidebar.tsx`) com ícone apropriado (ex: `Receipt` do Lucide)

### Detalhes técnicos

- `taxPremises.tsx` já está no projeto e é idêntico ao enviado — sem alteração necessária
- `PremissasPage.tsx` é self-contained, usa apenas React + `@/data/taxPremises` — sem dependências novas
- O fix de tipos em Assumptions.tsx é expandir a assinatura para `Record<string, number | Record<number, number>>`

