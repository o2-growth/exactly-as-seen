

# Fix: Cor do texto do item selecionado no sidebar

O item ativo usa `text-sidebar-primary-foreground` que resolve para a cor escura (preta). Basta trocar para `text-primary` para que o texto fique verde como o ícone e a borda.

## Alteração

**`src/components/layout/AppSidebar.tsx` linha 34:**
- De: `'bg-sidebar-accent text-sidebar-primary-foreground border border-primary/20'`
- Para: `'bg-sidebar-accent text-primary border border-primary/20'`

Uma única linha alterada.

