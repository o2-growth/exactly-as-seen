import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const PRINT_ROOT_ID = 'app-print-root';

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

export async function exportCurrentViewToPdf(): Promise<void> {
  const target = document.getElementById(PRINT_ROOT_ID);
  if (!target) throw new Error('Conteúdo da tela não encontrado para exportar.');

  document.documentElement.classList.add('printing');
  // Allow layout to settle after expanding overflow
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const bg = getBackgroundColor();
    const canvas = await html2canvas(target, {
      scale: 2,
      backgroundColor: bg,
      useCORS: true,
      logging: false,
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight,
    });

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const imgW = pageW;
    const ratio = canvas.width / imgW;
    const sliceHpx = pageH * ratio; // pixels of source canvas per PDF page

    let renderedPx = 0;
    let pageIndex = 0;
    while (renderedPx < canvas.height) {
      const remainingPx = canvas.height - renderedPx;
      const currentSlicePx = Math.min(sliceHpx, remainingPx);

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

      const imgData = sliceCanvas.toDataURL('image/jpeg', 0.92);
      const sliceHpt = currentSlicePx / ratio;
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, imgW, sliceHpt);

      renderedPx += currentSlicePx;
      pageIndex += 1;
    }

    const filename = `O2-${slugifyRoute()}-${todayStamp()}.pdf`;
    pdf.save(filename);
  } finally {
    document.documentElement.classList.remove('printing');
  }
}
