# Exportar PDF como "print" fiel da tela

## Problema
A exportação atual usa `html2canvas`, que não tira um print de verdade: ele tenta re-desenhar cada elemento da página manualmente. É por isso que botões, abas e campos vivem quebrando — e cada correção gera outro problema.

## Solução
Trocar a engine de captura por **`modern-screenshot`**, que usa a renderização nativa do navegador (SVG foreignObject). O resultado é um print pixel a pixel da tela, exatamente como você a vê — abas, botões, inputs, gráficos, tudo igual. Isso elimina de uma vez todos os hacks atuais.

## O que muda em `src/lib/exportPdf.ts`
1. **Adicionar dependência** `modern-screenshot` (leve, sem backend).
2. **Substituir a chamada `html2canvas(...)`** por `domToCanvas(target, { scale: 2 })`.
3. **Remover todo o código de contorno** que só existia por causa do html2canvas:
   - `replaceFormControlsWithText` (substituição de inputs/selects/botões) — ~140 linhas;
   - injeção de CSS no `onclone` (animações, bg-clip-text, etc.).
4. **Manter o que funciona bem**:
   - expansão de altura/overflow para capturar o conteúdo todo (não só o visível);
   - a paginação inteligente que evita cortar cards/tabelas no meio;
   - fatiamento do canvas em páginas e geração com jsPDF;
   - nome do arquivo `O2-<rota>-<data>.pdf`.

## Resultado esperado
O PDF fica idêntico à tela: o seletor "Cenários de Valuation", o input de múltiplo EBITDA, KPIs, tabelas e gráficos aparecem exatamente como no app, sem mais correções pontuais elemento por elemento.

## Detalhes técnicos
- `modern-screenshot` clona o DOM dentro de um `<foreignObject>` SVG e deixa o próprio navegador rasterizar — fidelidade muito superior ao html2canvas para CSS moderno (flex/grid, variáveis CSS, pseudo-elementos, form controls).
- Fontes e imagens são embutidas automaticamente; manteremos `scale: 2` para qualidade.
- `html2canvas` será removido das dependências se não for usado em outro lugar.