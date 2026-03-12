

# Menu Mobile - Diagnóstico

## Situação atual do código
O código está corretamente implementado:
- **AppLayout** gerencia `sidebarOpen` state e passa props corretas
- **AppHeader** tem o botão hamburger com `md:hidden` (visível apenas < 768px)
- **AppSidebar** tem o overlay mobile com `mobileOpen && md:hidden`

O wiring está correto: `setSidebarOpen(true)` → `mobileOpen={sidebarOpen}` → overlay renderiza.

## Possível problema
O viewport atual do preview é **1017px**, que está acima do breakpoint `md` (768px). Nesse tamanho, o sidebar desktop aparece e o hamburger fica escondido — comportamento esperado.

Para testar mobile, clique no **ícone de celular** acima do preview para reduzir o viewport para ~375px. Nesse tamanho o hamburger deve aparecer.

**Se mesmo assim não funcionar**, o problema pode ser que o botão hamburger existe mas não é visualmente perceptível (está em `text-muted-foreground` com borda fina). 

## Plano de ajuste (caso confirme o bug)
1. Aumentar destaque visual do hamburger no header mobile
2. Garantir que o z-index do overlay (z-50) não conflite com outros elementos
3. Testar em viewport 375px

Nenhuma alteração de código é necessária neste momento — o código está correto. O teste precisa ser feito em viewport mobile (< 768px).

