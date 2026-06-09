## Diagnóstico

Comparando os dois prints:

1. **Inputs aparecem vazios no PDF** (ex.: "Pedro Albite", "90.00", "90.000", "2017-08" somem e ficam só os placeholders/linhas). Causa: o `html2canvas` renderiza o **atributo** `value` do HTML, não a **propriedade** `.value` do DOM controlada pelo React. Como o React seta via propriedade, o atributo fica vazio e o clone exportado mostra o input em branco.
2. **Selects (`Founder`, `SOP C-Level`, `Investor`) somem** pelo mesmo motivo — o `<option selected>` não está marcado no HTML.
3. **Cores desbotadas / título verde claro** (Valuation & Cap Table apagado, header sumido, botão "Salvar" cortado em verde claro): o `html2canvas` está aplicando opacidade/transform herdados de animações (`animate-fade-in` no `<main>`) que ainda estão "em curso" ou foram congeladas no meio. Também perde o gradiente do título (`bg-clip-text`).
4. **Botão "Salvar" e "Total Shares" cortados na lateral direita**: o print root tem `overflow:auto`; ao forçar `height:auto` o conteúdo expande, mas a largura permanece a do viewport sem considerar o conteúdo horizontal real / scrollbar.

## Solução — apenas em `src/lib/exportPdf.ts`

Manter toda a lógica de paginação inteligente já implementada. Mudanças cirúrgicas no pipeline de captura:

### 1. Sincronizar valores de form no `onclone` do html2canvas
Antes do html2canvas tirar o snapshot, percorrer o clone e:
- Para cada `<input>` (exceto checkbox/radio): `el.setAttribute('value', originalEl.value)`.
- Para cada `<textarea>`: setar `textContent` com o valor atual.
- Para cada `<select>`: encontrar a `<option>` correspondente ao `value` atual e adicionar `selected` + `setAttribute('selected','selected')`; remover de outras.
- Pareamento original↔clone via `querySelectorAll` na mesma ordem (mesma árvore).

### 2. Neutralizar animações/opacidade no clone
No `onclone`, no elemento raiz clonado:
- Remover classes `animate-fade-in`, `animate-*`.
- Forçar `opacity: 1`, `transform: none`, `filter: none` em todos os descendentes via um `<style>` injetado:
  ```css
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    opacity: 1 !important;
  }
  ```
  (sem mexer em `transform` global para não quebrar gráficos Recharts; aplicar `transform:none` apenas no root).
- Garantir que `bg-clip-text` mantenha cor visível: para elementos com classe contendo `bg-clip-text` ou `text-transparent`, setar `color` para a cor do primary (`hsl(var(--primary))`) como fallback, removendo `-webkit-text-fill-color: transparent`.

### 3. Captura com largura real do conteúdo
Antes do `html2canvas`:
- Usar `target.scrollWidth` como `width` e `windowWidth` explícitos no html2canvas para evitar corte do "Salvar"/"Total Shares".
- Definir `windowHeight: target.scrollHeight`.

### 4. Sem mudanças
- Nenhum CSS, layout, componente ou contexto alterado.
- Paginação inteligente (cards inquebráveis) permanece como está.

## Resultado esperado
- Valores de inputs/selects aparecem no PDF.
- Cores e título com gradiente renderizam corretamente.
- Lateral direita (botão Salvar, Total Shares) não é cortada.
- Layout idêntico à tela, mantendo as quebras de página entre cards.
