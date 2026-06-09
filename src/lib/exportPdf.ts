import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const PRINT_ROOT_ID = 'app-print-root';
const SCALE = 2;
const PX_TO_PT = 0.75; // 1 CSS px = 0.75 pt @ 96dpi

function getBackgroundColor(): string {
  const styles = getComputedStyle(document.documentElement);
  const bg = styles.getPropertyValue('--background').trim();
  if (bg) return `hsl(${bg})`;
  return '#ffffff';
}

function getPrimaryColor(): string {
  const styles = getComputedStyle(document.documentElement);
  const p = styles.getPropertyValue('--primary').trim();
  if (p) return `hsl(${p})`;
  return '#16a34a';
}

function slugifyRoute(): string {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '') || 'overview';
  return path.replace(/\//g, '-');
}

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function nextFrames(n = 2) {
  for (let i = 0; i < n; i++) {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
}

function collectUnbreakableBlocks(root: HTMLElement): Array<{ top: number; bottom: number }> {
  const rootTop = root.getBoundingClientRect().top;
  const selector = [
    '.gradient-card',
    '.kpi-card',
    '[data-pdf-block]',
    'table',
    'section',
    'article',
    '[class*="card"]',
    '.recharts-responsive-container',
    '.recharts-wrapper',
  ].join(',');

  const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector));
  const blocks = nodes.map((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top - rootTop, bottom: r.bottom - rootTop };
  });
  blocks.sort((a, b) => a.top - b.top);
  return blocks;
}

function computePageHeights(
  totalHeight: number,
  maxPageH: number,
  blocks: Array<{ top: number; bottom: number }>,
): number[] {
  const minPageH = Math.max(200, maxPageH * 0.4);
  const gap = 8;
  const usableBlocks = blocks.filter((b) => b.bottom - b.top <= maxPageH - gap * 2);
  const heights: number[] = [];
  let cursor = 0;

  const insideBlock = (y: number) => usableBlocks.some((b) => b.top < y - 0.5 && b.bottom > y + 0.5);

  while (cursor < totalHeight) {
    const remaining = totalHeight - cursor;
    if (remaining <= maxPageH) {
      heights.push(remaining);
      break;
    }

    let cut = cursor + maxPageH;
    const conflicting = usableBlocks.filter((b) => b.top < cut - 0.5 && b.bottom > cut + 0.5);

    if (conflicting.length > 0) {
      const viable = conflicting
        .map((b) => b.top - gap)
        .filter((candidate) => candidate > cursor + minPageH)
        .sort((a, b) => b - a);

      if (viable.length > 0) {
        cut = viable[0];
      } else {
        const safeBoundaries = usableBlocks
          .flatMap((b) => [b.top - gap, b.bottom + gap])
          .filter((candidate) => candidate > cursor + minPageH && candidate < cut && !insideBlock(candidate))
          .sort((a, b) => b - a);

        if (safeBoundaries.length > 0) cut = safeBoundaries[0];
      }
    }

    cut = Math.min(cut, totalHeight);
    heights.push(cut - cursor);
    cursor = cut;
  }

  return heights;
}

/**
 * Substitui inputs/selects/textareas no clone por elementos de texto estáticos,
 * porque html2canvas não renderiza confiavelmente o conteúdo de form controls.
 * Mantém dimensões, fontes e bordas copiando os estilos computados.
 */
function replaceFormControlsWithText(originalRoot: HTMLElement, clonedRoot: HTMLElement) {
  // (inlineAllStyles foi removido — copiar todos os estilos computados
  // de buttons quebrava o layout dos painéis de Tabs adjacentes.)


  const copyVisualStyles = (src: HTMLElement, dst: HTMLElement) => {
    const cs = getComputedStyle(src);
    const rect = src.getBoundingClientRect();
    dst.style.display = 'inline-flex';
    dst.style.alignItems = 'center';
    dst.style.boxSizing = 'border-box';
    dst.style.width = `${rect.width}px`;
    dst.style.height = `${rect.height}px`;
    dst.style.minHeight = `${rect.height}px`;
    dst.style.padding = cs.padding;
    dst.style.fontSize = cs.fontSize;
    dst.style.fontFamily = cs.fontFamily;
    dst.style.fontWeight = cs.fontWeight;
    dst.style.color = cs.color;
    dst.style.background = cs.backgroundColor;
    dst.style.border = cs.border;
    dst.style.borderRadius = cs.borderRadius;
    dst.style.textAlign = cs.textAlign as string;
    dst.style.lineHeight = cs.lineHeight;
    dst.style.whiteSpace = 'nowrap';
    dst.style.overflow = 'hidden';
    dst.style.verticalAlign = 'middle';
    // garantir que o texto fique alinhado ao mesmo lado do input original
    if (cs.textAlign === 'right' || cs.textAlign === 'end') {
      dst.style.justifyContent = 'flex-end';
    } else if (cs.textAlign === 'center') {
      dst.style.justifyContent = 'center';
    } else {
      dst.style.justifyContent = 'flex-start';
    }
  };

  // Inputs
  const origInputs = originalRoot.querySelectorAll<HTMLInputElement>('input');
  const cloneInputs = clonedRoot.querySelectorAll<HTMLInputElement>('input');
  origInputs.forEach((orig, i) => {
    const clone = cloneInputs[i];
    if (!clone || !clone.parentNode) return;
    const type = (orig.type || 'text').toLowerCase();
    if (type === 'checkbox' || type === 'radio') return; // deixar como está
    const span = clone.ownerDocument!.createElement('span');
    span.textContent = orig.value ?? '';
    copyVisualStyles(orig, span);
    clone.parentNode.replaceChild(span, clone);
  });

  // Textareas
  const origTextareas = originalRoot.querySelectorAll<HTMLTextAreaElement>('textarea');
  const cloneTextareas = clonedRoot.querySelectorAll<HTMLTextAreaElement>('textarea');
  origTextareas.forEach((orig, i) => {
    const clone = cloneTextareas[i];
    if (!clone || !clone.parentNode) return;
    const div = clone.ownerDocument!.createElement('div');
    div.textContent = orig.value ?? '';
    copyVisualStyles(orig, div);
    div.style.whiteSpace = 'pre-wrap';
    clone.parentNode.replaceChild(div, clone);
  });

  // Selects
  const origSelects = originalRoot.querySelectorAll<HTMLSelectElement>('select');
  const cloneSelects = clonedRoot.querySelectorAll<HTMLSelectElement>('select');
  origSelects.forEach((orig, i) => {
    const clone = cloneSelects[i];
    if (!clone || !clone.parentNode) return;
    const selectedOpt = orig.options[orig.selectedIndex];
    const label = selectedOpt ? selectedOpt.text : '';
    const span = clone.ownerDocument!.createElement('span');
    span.textContent = label;
    copyVisualStyles(orig, span);
    clone.parentNode.replaceChild(span, clone);
  });

  // Botões (html2canvas falha ao renderizar texto de alguns <button>,
  // ex.: abas/TabsTrigger). Substituímos por <div> com um <span> interno
  // que carrega cor/tipografia explícitas — assim o texto não depende mais
  // de herança no clone (que perde seletores data-[state=active]).
  const origButtons = originalRoot.querySelectorAll<HTMLButtonElement>('button');
  const cloneButtons = clonedRoot.querySelectorAll<HTMLButtonElement>('button');
  origButtons.forEach((orig, i) => {
    const clone = cloneButtons[i];
    if (!clone || !clone.parentNode) return;
    const cs = getComputedStyle(orig);
    const rect = orig.getBoundingClientRect();
    const doc = clone.ownerDocument!;

    // Captura texto visível (ignora sr-only/hidden) e ícones SVG.
    const text = (orig.innerText || orig.textContent || '').trim();
    const svgs = Array.from(orig.querySelectorAll('svg')).map(
      (svg) => svg.cloneNode(true) as SVGElement,
    );

    const div = doc.createElement('div');
    div.style.display = cs.display === 'none' ? 'none' : 'inline-flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = cs.justifyContent || 'center';
    div.style.gap = cs.gap && cs.gap !== 'normal' ? cs.gap : '6px';
    div.style.boxSizing = 'border-box';
    div.style.width = `${rect.width}px`;
    div.style.height = `${rect.height}px`;
    div.style.padding = cs.padding;
    div.style.margin = cs.margin;
    div.style.background = cs.backgroundColor;
    div.style.borderRadius = cs.borderRadius;
    div.style.border = cs.border;
    div.style.boxShadow = cs.boxShadow;
    div.style.whiteSpace = 'nowrap';
    div.style.overflow = 'hidden';
    div.style.verticalAlign = 'middle';

    // SVGs primeiro (best-effort: ícones costumam vir antes do texto).
    svgs.forEach((svg) => {
      // Preserva cor do ícone via currentColor.
      svg.setAttribute('style', `color: ${cs.color}; flex: none;`);
      div.appendChild(svg);
    });

    if (text) {
      const span = doc.createElement('span');
      span.textContent = text;
      span.style.color = cs.color;
      span.style.fontSize = cs.fontSize;
      span.style.fontFamily = cs.fontFamily;
      span.style.fontWeight = cs.fontWeight;
      span.style.lineHeight = cs.lineHeight;
      span.style.letterSpacing = cs.letterSpacing;
      span.style.textAlign = cs.textAlign as string;
      span.style.whiteSpace = 'nowrap';
      div.appendChild(span);
    }

    clone.parentNode.replaceChild(div, clone);
  });
}

export async function exportCurrentViewToPdf(): Promise<void> {
  const target = document.getElementById(PRINT_ROOT_ID) as HTMLElement | null;
  if (!target) throw new Error('Conteúdo da tela não encontrado para exportar.');

  const prevHeight = target.style.height;
  const prevMaxHeight = target.style.maxHeight;
  const prevOverflow = target.style.overflow;
  target.style.height = 'auto';
  target.style.maxHeight = 'none';
  target.style.overflow = 'visible';

  // Neutralizar overflow:auto/scroll/hidden em descendentes para que o
  // scrollWidth real do conteúdo seja medido (caso contrário a captura
  // corta os elementos que estavam atrás de scrollbars internos).
  const overflowRestorers: Array<() => void> = [];
  const allDescendants = target.querySelectorAll<HTMLElement>('*');
  allDescendants.forEach((el) => {
    const cs = getComputedStyle(el);
    const ox = cs.overflowX;
    const oy = cs.overflowY;
    if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' ||
        oy === 'auto' || oy === 'scroll' || oy === 'hidden') {
      const prevOX = el.style.overflowX;
      const prevOY = el.style.overflowY;
      const prevO = el.style.overflow;
      el.style.overflow = 'visible';
      el.style.overflowX = 'visible';
      el.style.overflowY = 'visible';
      overflowRestorers.push(() => {
        el.style.overflow = prevO;
        el.style.overflowX = prevOX;
        el.style.overflowY = prevOY;
      });
    }
  });

  await nextFrames(2);
  await wait(300);

  try {
    const bg = getBackgroundColor();
    const primary = getPrimaryColor();
    const blocks = collectUnbreakableBlocks(target);

    const captureWidth = Math.max(
      target.scrollWidth,
      target.offsetWidth,
      document.documentElement.scrollWidth,
    );
    const captureHeight = Math.max(target.scrollHeight, target.offsetHeight);

    const canvas = await html2canvas(target, {
      scale: SCALE,
      backgroundColor: bg,
      useCORS: true,
      logging: false,
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
      onclone: (clonedDoc, clonedEl) => {
        // 1) Injetar CSS para neutralizar animações/transições/opacidade,
        //    preservar gradientes de texto e forçar overflow visível.
        const style = clonedDoc.createElement('style');
        style.textContent = `
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
            opacity: 1 !important;
          }
          #${PRINT_ROOT_ID}, #${PRINT_ROOT_ID} * {
            overflow: visible !important;
          }
          .bg-clip-text, [class*="bg-clip-text"], .text-transparent {
            -webkit-text-fill-color: ${primary} !important;
            color: ${primary} !important;
            background: none !important;
          }
        `;
        clonedDoc.head.appendChild(style);

        // 2) Garantir que o root clonado não tem transform/opacity residuais
        if (clonedEl instanceof HTMLElement) {
          clonedEl.classList.remove('animate-fade-in');
          clonedEl.style.transform = 'none';
          clonedEl.style.opacity = '1';
          clonedEl.style.overflow = 'visible';
          clonedEl.style.height = 'auto';
          clonedEl.style.maxHeight = 'none';
          clonedEl.style.width = `${captureWidth}px`;
        }

        // 3) Substituir form controls por texto estático
        replaceFormControlsWithText(target, clonedEl as HTMLElement);
      },
    });

    const cssWidth = canvas.width / SCALE;
    const cssHeight = canvas.height / SCALE;
    const pageW = cssWidth * PX_TO_PT;

    const viewportH = Math.max(600, window.innerHeight);
    const maxPageH = Math.min(cssHeight, viewportH);

    const pageHeightsCss = computePageHeights(cssHeight, maxPageH, blocks);

    const pageH = maxPageH * PX_TO_PT;
    const pageCanvasHeight = Math.round(maxPageH * SCALE);
    const pdf = new jsPDF({
      unit: 'pt',
      format: [pageW, pageH],
      orientation: pageW >= pageH ? 'landscape' : 'portrait',
    });

    let renderedCss = 0;
    pageHeightsCss.forEach((hCss, idx) => {
      const sourceY = Math.round(renderedCss * SCALE);
      const slicePx = Math.min(canvas.height - sourceY, Math.round(hCss * SCALE));

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = pageCanvasHeight;
      const ctx = sliceCanvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível obter contexto 2D.');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(canvas, 0, sourceY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);

      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);

      if (idx > 0) {
        pdf.addPage([pageW, pageH], pageW >= pageH ? 'landscape' : 'portrait');
      }
      pdf.addImage(imgData, 'JPEG', 0, 0, pageW, pageH);

      renderedCss += hCss;
    });

    pdf.save(`O2-${slugifyRoute()}-${todayStamp()}.pdf`);
  } finally {
    target.style.height = prevHeight;
    target.style.maxHeight = prevMaxHeight;
    target.style.overflow = prevOverflow;
    overflowRestorers.forEach((restore) => restore());
  }
}
