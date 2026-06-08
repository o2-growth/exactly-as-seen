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

/**
 * Coleta retângulos (top/bottom em px CSS, relativos ao topo do print root)
 * dos blocos que não devem ser cortados entre páginas.
 */
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
  ].join(',');

  const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector));
  const blocks = nodes.map((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top - rootTop, bottom: r.bottom - rootTop };
  });
  // Ordenar por top ascendente
  blocks.sort((a, b) => a.top - b.top);
  return blocks;
}

/**
 * Calcula alturas de página (px CSS) preferindo cortar entre blocos.
 */
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

    // Procurar blocos que estão sendo cortados por `cut`
    const conflicting = usableBlocks.filter((b) => b.top < cut - 0.5 && b.bottom > cut + 0.5);

    if (conflicting.length > 0) {
      // Recuar para o topo viável mais próximo do corte, evitando páginas minúsculas.
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

export async function exportCurrentViewToPdf(): Promise<void> {
  const target = document.getElementById(PRINT_ROOT_ID) as HTMLElement | null;
  if (!target) throw new Error('Conteúdo da tela não encontrado para exportar.');

  const prevHeight = target.style.height;
  const prevMaxHeight = target.style.maxHeight;
  const prevOverflow = target.style.overflow;
  target.style.height = 'auto';
  target.style.maxHeight = 'none';
  target.style.overflow = 'visible';

  await nextFrames(2);
  await wait(250);

  try {
    const bg = getBackgroundColor();

    // Coletar blocos ANTES do canvas, com layout já estabilizado
    const blocks = collectUnbreakableBlocks(target);

    const canvas = await html2canvas(target, {
      scale: SCALE,
      backgroundColor: bg,
      useCORS: true,
      logging: false,
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
  }
}
