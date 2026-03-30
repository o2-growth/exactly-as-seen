

# Corrigir botão "Edit Assumptions" e persistência de alterações

## Problemas identificados

1. **Campos editáveis sem clicar "Edit Assumptions"**: Os componentes `MonthlyClientInput` e `InlineEditCell` (usados nos subprodutos, tickets, churn, tax) **não verificam** o estado `editing`. Apenas o antigo `CellInput` respeita esse flag. Resultado: tudo é editável mesmo com "Cells are locked".

2. **Alterações não salvas no histórico**: Quando se edita sem o modo edit, as mudanças vão direto para `assumptions` via `setAssumptions` (auto-save com debounce de 2s). Porém, o auto-save usa `saveAssumptions` do persistence hook, que **não cria uma versão no histórico** — apenas grava no localStorage/Supabase. Somente `confirmSave` (botão Save) chama `saveVersion`. Resultado: alterações feitas fora do modo edit podem ser perdidas se o snapshot for sobrescrito.

## Solução

### 1. Bloquear inputs quando `editing = false`

**Arquivo: `src/pages/Assumptions.tsx`**

- Passar prop `editing` para `MonthlyClientInput` — quando `false`, renderizar `<span>` read-only em vez de `<input>`
- Fazer o mesmo para todas as ocorrências de `InlineEditCell` — adicionar prop `disabled` ou `readOnly`
- Bloquear campos de taxa de crescimento, churn, ticket base, e tax rates quando `editing = false`
- Bloquear botões "Aplicar" de crescimento/churn quando `editing = false`

Componentes afetados:
- `MonthlyClientInput` (~15 usos) — adicionar prop `readOnly`
- `InlineEditCell` — já tem prop `className`, adicionar `disabled?: boolean`
- Inputs de taxa de crescimento/churn (inputs diretos com `onChange`)
- Inputs de tax rates (inputs na tabela de deduções)
- Botões "Aplicar" (crescimento e churn)

### 2. Auto-salvar no histórico a cada edição confirmada

**Arquivo: `src/pages/Assumptions.tsx`**

- No `confirmSave`, manter o fluxo atual (modal com nota obrigatória + `saveVersion`)
- Este é o comportamento correto — cada Save cria uma versão

**Arquivo: `src/contexts/FinancialModelContext.tsx`**

- O auto-save (debounce 2s) já persiste no backend/localStorage — isso garante que mudanças não se percam entre sessões
- Garantir que o `loadSnapshots` no mount não sobrescreve edições feitas na sessão atual (o `hasLoaded` ref já previne isso)

### 3. Garantir consistência do estado

- Remover o caminho `else` do `updateModel` que faz `setAssumptions(updater(assumptions))` direto — todas as edições devem passar pelo modo editing
- Quando `editing = false`, nenhum handler de mudança deve ser chamado

## Arquivos alterados
1. `src/pages/Assumptions.tsx` — gate de `editing` em todos os inputs
2. `src/components/assumptions/InlineEditCell.tsx` — prop `disabled`

