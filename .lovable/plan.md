

# Ajustar versão exibida de v1.0 para v1.1

## O que será feito

Alterar a versão base inicial do modelo de `'1.0'` para `'1.1'` no `VersionHistoryContext`.

## Alteração

**`src/contexts/VersionHistoryContext.tsx`** — 3 pontos:

1. **Linha 38** — fallback de `getNextVersion`: `'1.0'` → `'1.1'`
2. **Linha 101** — versão do snapshot inicial: `version: '1.0'` → `version: '1.1'`
3. **Linha 114** — fallback de `currentVersion`: `'1.0'` → `'1.1'`

**Nota:** Como as versões são salvas no localStorage, o usuário pode precisar limpar o localStorage (ou o código pode incluir lógica para atualizar o snapshot existente) para que a mudança surta efeito imediatamente.

