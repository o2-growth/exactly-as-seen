# Exportar PDF — print fiel da tela atual

## Objetivo
Ativar o botão "Export PDF" (hoje desabilitado no `AppHeader`) para gerar um PDF que reproduz **exatamente** o que está visível na tela atual — como um print da área de conteúdo (`<main>`), funcionando em todas as rotas (`/`, `/pnl`, `/cashflow`, `/assumptions`, `/premissas`, `/simulador-tributario`, `/debt`, `/valuation`, `/history`).

## Abordagem
Captura client-side via **html2canvas + jsPDF** (sem backend, sem edge functions, sem mudar dados):

1. Adicionar dependências: `html2canvas`, `jspdf`.
2. Criar `src/lib/exportPdf.ts` com função `exportCurrentViewToPdf(filename)`:
   - Seleciona o elemento `<main>` do `AppLayout`.
   - Renderiza com `html2canvas` (scale 2 para nitidez, `backgroundColor` lendo `--background`, `useCORS: true`).
   - Cria PDF A4 paisagem em `jsPDF`, escala a imagem proporcionalmente à largura útil e **quebra automaticamente em múltiplas páginas** se a altura exceder uma página (loop fatiando o canvas).
   - Gera nome: `O2-{rota}-{YYYY-MM-DD}.pdf`.
3. Marcar o `<main>` em `AppLayout.tsx` com `id="app-print-root"` para seleção determinística.
4. Em `AppHeader.tsx`:
   - Remover `opacity-60 cursor-not-allowed` do botão.
   - Adicionar `onClick` chamando a função, com estado `isExporting` (spinner + disable) e `toast` de sucesso/erro.
   - Mostrar o botão também no mobile (ícone-only) — hoje está `hidden lg:flex`.
5. Antes da captura, adicionar classe utilitária temporária `.printing` no `<html>` para:
   - Expandir áreas com scroll interno (`overflow: visible !important` em tabelas/containers) para que o print não corte conteúdo "abaixo da dobra" dentro de cards roláveis.
   - Esconder elementos puramente de UI de navegação dentro do main, se houver (ex.: tooltips abertos).
   - Remover a classe no `finally`.

## Detalhes técnicos
- **Fidelidade visual**: `html2canvas` respeita o tema atual (dark/light) porque lê o DOM renderizado. Cores via tokens HSL funcionam.
- **Charts (Recharts)**: são SVG dentro do DOM — `html2canvas` captura corretamente.
- **Páginas longas (PnL, Assumptions)**: o fatiamento por altura cobre N páginas A4 mantendo proporção.
- **Sem alterações em**: contextos, engine de cálculo, dados, schema, edge functions, design tokens.
- **Não inclui**: sidebar nem header no PDF (apenas o conteúdo da `<main>`), pois é o "conteúdo da tela" que importa. Confirmar se prefere incluir o header também.

## Arquivos tocados
- `package.json` (deps)
- `src/lib/exportPdf.ts` (novo)
- `src/components/layout/AppLayout.tsx` (id no main + classe printing)
- `src/components/layout/AppHeader.tsx` (ativar botão + handler)
- `src/index.css` (regras `.printing` para overflow)

## Fora de escopo
- Templates customizados por tela, capa, paginação numerada, logo no rodapé.
- Geração server-side / agendada.
- Pitch deck Teaser/Book (fica para projeto separado já discutido).

## Pergunta rápida
Incluir o header da aplicação (com filtro de período, badge BASE, versão) no topo do PDF, ou só o conteúdo da `<main>`?
