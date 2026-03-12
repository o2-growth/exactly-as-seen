

# Mobile-friendly Fluxo de Caixa

## Problemas atuais
- A sidebar ja esconde em mobile (`hidden md:flex`), mas nao ha menu hamburger para navegar
- As tabelas com muitas colunas (12 meses + total) nao tem tratamento mobile — `min-w-[240px]` e `min-w-[100px]` forçam scroll horizontal largo
- Cards de resumo ja sao responsivos (`grid-cols-1 md:grid-cols-3`)
- Graficos ja usam `ResponsiveContainer` — ok
- `main` tem `p-6` fixo, ocupa espaço demais em mobile

## Alterações

### 1. `src/components/layout/AppLayout.tsx`
- Reduzir padding em mobile: `p-3 md:p-6`

### 2. `src/components/layout/AppHeader.tsx`
- Adicionar botao hamburger (Menu icon) visivel apenas em mobile (`md:hidden`)
- Controlar estado de sidebar mobile aberta/fechada

### 3. `src/components/layout/AppSidebar.tsx`
- Adicionar overlay mobile: quando aberto, renderizar sidebar como drawer/overlay com backdrop em telas `< md`
- Fechar ao clicar em link ou backdrop

### 4. `src/pages/CashFlow.tsx`
- Reduzir `min-w` das colunas em tabelas para mobile (`min-w-[80px]` nas colunas de meses)
- Reduzir font e padding em mobile nas celulas: `p-2 md:p-3`, `text-xs md:text-sm`
- Reduzir altura dos graficos em mobile: `h-[240px] md:h-[320px]` via classe ou prop condicional
- Header da pagina: `text-xl md:text-2xl`
- Botoes Recebido/Pago: stack vertical em mobile se necessario

### 5. `src/components/layout/AppLayout.tsx`
- Aceitar e propagar estado do sidebar mobile via state lifting ou contexto simples (useState no AppLayout passado como props)

