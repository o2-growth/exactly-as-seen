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

export async function exportCurrentViewToPdf(): Promise<void> {
  const target = document.getElementById(PRINT_ROOT_ID) as HTMLElement | null;
  if (!target) throw new Error('Conteúdo da tela não encontrado para exportar.');

  // Save and expand only the print root — não tocar em descendentes
  const prevHeight = target.style.height;
  const prevMaxHeight = target.style.maxHeight;
  const prevOverflow = target.style.overflow;
  target.style.height = 'auto';
  target.style.maxHeight = 'none';
  target.style.overflow = 'visible';

  // Aguardar Recharts re-medir após mudança de altura
  await nextFrames(2);
  await wait(250);

  try {
    const bg = getBackgroundColor();
    const canvas = await html2canvas(target, {
      scale: SCALE,
      backgroundColor: bg,
      useCORS: true,
      logging: false,
    });

    const cssWidth = canvas.width / SCALE;
    const cssHeight = canvas.height / SCALE;
    const pageW = cssWidth * PX_TO_PT;
    // Cada página = uma "tela" cheia (ou todo o conteúdo, se couber)
    const viewportH = Math.max(600, window.innerHeight);
    const pageCssH = Math.min(cssHeight, viewportH);
    const pageH = pageCssH * PX_TO_PT;

    const pdf = new jsPDF({ unit: 'pt', format: [pageW, pageH], orientation: pageW >= pageH ? 'landscape' : 'portrait' });

    const sliceHpx = pageCssH * SCALE; // altura de cada slice no canvas-fonte
    let renderedPx = 0;
    let pageIndex = 0;

    while (renderedPx < canvas.height) {
      const remainingPx = canvas.height - renderedPx;
      const currentSlicePx = Math.min(sliceHpx, remainingPx);
      const currentSlicePt = (currentSlicePx / SCALE) * PX_TO_PT;

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = currentSlicePx;
      const ctx = sliceCanvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível obter contexto 2D.');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        renderedPx,
        canvas.width,
        currentSlicePx,
        0,
        0,
        canvas.width,
        currentSlicePx,
      );

      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.95);

      if (pageIndex > 0) {
        // Última página pode ser menor — ajustar formato
        pdf.addPage([pageW, currentSlicePt], pageW >= currentSlicePt ? 'landscape' : 'portrait');
      }
      pdf.addImage(imgData, 'JPEG', 0, 0, pageW, currentSlicePt);

      renderedPx += currentSlicePx;
      pageIndex += 1;
    }

    pdf.save(`O2-${slugifyRoute()}-${todayStamp()}.pdf`);
  } finally {
    target.style.height = prevHeight;
    target.style.maxHeight = prevMaxHeight;
    target.style.overflow = prevOverflow;
  }
}
