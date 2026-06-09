## Problema

No PDF, a área "Valuation Scenarios" ainda aparece como uma pílula cinza vazia — sem os rótulos "EBITDA Multiple" / "ARR Multiple". Na tela ao vivo os botões aparecem normalmente.

Causa raiz: o flatten atual move os filhos do `<button>` para um `<div>`, mas:

1. Os filhos originais herdavam `color` via `data-[state=active]:text-foreground` aplicado no botão. Ao serem movidos para o `<div>` (que não tem `data-state`), o seletor CSS deixa de aplicar e a cor herdada cai para a do `TabsList` pai (`text-muted-foreground` sobre `bg-muted` ≈ invisível).
2. Texto solto (text node direto) dentro do `<div>` flatten herda estilos do TabsList em vez dos estilos copiados do botão original, porque `setProperty` no `style` do `<div>` afeta o `<div>`, não o text node — e o text node herda do ancestral mais próximo (que continua sendo o TabsList no clone).
3. Para buttons que html2canvas falhava em renderizar, mover children não basta — é preciso recriar o texto em um wrapper que carregue as cores/tipografia explicitamente.

## Solução (apenas `src/lib/exportPdf.ts`)

Reescrever o loop de buttons em `replaceFormControlsWithText` para:

1. Capturar o texto visível com `orig.innerText` (fallback `textContent`) — captura corretamente apenas o que o usuário vê, ignorando filhos `display:none` / `sr-only`.
2. Capturar SVGs filhos (ícones em botões com ícone, ex.: chevrons). Se houver SVGs, cloná-los e preservar; caso contrário, ignorar.
3. Criar `<div>` wrapper com layout (`inline-flex`, dimensões via `getBoundingClientRect`, padding, border, background, border-radius, box-shadow), tudo a partir de `getComputedStyle(orig)` que **já reflete o estado ativo via `data-state`** (ele é lido na live DOM antes de qualquer alteração).
4. Dentro do `<div>`, inserir um `<span>` explícito com o texto, e copiar nele `color`, `fontSize`, `fontFamily`, `fontWeight`, `lineHeight`, `letterSpacing`. Assim a cor não depende mais de herança no clone.
5. Adicionar os SVGs clonados (se houver) antes/depois do span conforme posição original (best-effort: antes do texto).
6. Manter `whiteSpace: nowrap`, `overflow: hidden`, `boxSizing: border-box`, `verticalAlign: middle`.
7. Não copiar `display: none`, `position`, `transform` do original — apenas o conjunto controlado acima — para evitar quebrar layout dos painéis vizinhos (como já ajustado anteriormente).

Tudo o resto do pipeline (overflow neutralization, onclone CSS, paginação, unbreakable blocks) permanece inalterado.

## Verificação

Testar pelo preview clicando "Exportar PDF" na rota `/valuation` e conferir que os tabs "EBITDA Multiple" e "ARR Multiple" aparecem com texto legível no PDF, além de o conteúdo do painel ativo (input, KPI Base, tabela e gráfico) continuar renderizando.

## Arquivos afetados

- `src/lib/exportPdf.ts` (somente o bloco de flatten de `<button>`)
