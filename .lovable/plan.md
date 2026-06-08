# Corrigir PDF — print fiel (mesma fonte, mesmo espaçamento)

## Causa do problema
- `.printing * { overflow: visible !important }` quebrou cards/tabelas internas e fez o `ResponsiveContainer` do Recharts re-medir errado (gráficos cortados, legenda solta).
- `windowWidth: scrollWidth` forçou layout em largura diferente da real.
- Reescala para A4 paisagem comprimiu/esticou fontes.

## Correção

### 1. `src/lib/exportPdf.ts` — reescrita
- Sem `windowWidth`/`windowHeight` override.
- Não tocar em descendentes. Apenas no próprio `<main>#app-print-root`: salvar `style.height`/`overflow`, setar `height: auto` e `overflow: visible` para revelar todo o conteúdo abaixo da dobra. Restaurar no `finally`.
- Aguardar `2× requestAnimationFrame` + 200ms para Recharts re-medir.
- `html2canvas(target, { scale: 2, backgroundColor, useCORS: true, logging: false })`.
- PDF em **dimensões do conteúdo**, não A4:
  - `cssWidth = canvas.width / 2` (px CSS), `cssHeight = canvas.height / 2`.
  - `pxToPt = 0.75`; `pageW = cssWidth * pxToPt`.
  - `pageH = Math.min(cssHeight, window.innerHeight) * pxToPt` → cada página = "uma tela".
  - `new jsPDF({ unit: 'pt', format: [pageW, pageH] })`.
- Fatiamento: para cada slice, criar canvas auxiliar com `width = canvas.width`, `height = sliceHpx` (= `pageH/pxToPt*2`), desenhar a faixa correspondente, inserir em 1:1 com `pdf.addImage(jpeg, 'JPEG', 0, 0, pageW, sliceHpx/2*pxToPt)`. Última página com altura proporcional ao resto.
- JPEG qualidade 0.95.
- Nome: `O2-{rota}-{YYYY-MM-DD}.pdf`.

### 2. `src/index.css`
- Remover o bloco `html.printing ...` adicionado anteriormente (não é mais usado).

### 3. Sem mudanças em
- `AppHeader.tsx`, `AppLayout.tsx`, contextos, engine, dados.

## Resultado esperado
Cada página do PDF é literalmente uma "tela" do app — mesma largura em pixels CSS, mesmas fontes, mesmos espaçamentos, gráficos com o tamanho que o Recharts mediu. Rolagem virtual da página vira páginas sequenciais.
