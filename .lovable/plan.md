## Problema
A paginação atual fatia o conteúdo a cada altura de viewport, cortando cards/gráficos no meio (faixa preta na imagem = corte sobre o gráfico "Margin Evolution").

## Solução — quebras inteligentes em `src/lib/exportPdf.ts`

1. **Marcar blocos "inquebráveis"**: antes do `html2canvas`, percorrer `#app-print-root` e coletar os retângulos (top/bottom em px CSS, relativo ao topo do print root) dos elementos candidatos a "card":
   - `.gradient-card`, `.kpi-card`, `[data-pdf-block]`, `table`, e qualquer filho direto de `<main>` que tenha `class*="card"` ou seja um `section`/`article`.
   - Usar `getBoundingClientRect()` + `target.getBoundingClientRect().top` para normalizar.

2. **Calcular pontos de corte ótimos**:
   - `maxPageH = window.innerHeight` (em px CSS).
   - Algoritmo guloso: a partir de `cursor = 0`, candidato inicial `cut = cursor + maxPageH`. Se `cut` cai dentro de algum bloco (`block.top < cut < block.bottom`), recuar `cut` para `block.top` (desde que `block.top > cursor + minPageH`, com `minPageH = maxPageH * 0.4` para evitar páginas minúsculas).
   - Se nenhum recuo é viável (bloco maior que página inteira, ex.: gráfico muito alto), aceitar o corte original — não há como evitar.
   - Adicionar pequeno `gap` (8px) acima da quebra para respiro visual.
   - Resultado: array de alturas de página `[h1, h2, …]` em px CSS, somando `cssHeight` total.

3. **Renderização**: manter o pipeline atual (slice canvas → JPEG → `addImage`), mas usar as alturas calculadas em vez de `Math.min(viewportH, cssHeight)` fixo. Cada `addPage` usa `[pageW, hN * pxToPt]`.

4. **Sem mudanças** em `AppLayout.tsx`, `AppHeader.tsx`, `index.css`, contextos ou engine.

## Resultado
Quebras de página passam preferencialmente entre cards/gráficos, nunca cortando um bloco no meio quando há espaço razoável acima.
