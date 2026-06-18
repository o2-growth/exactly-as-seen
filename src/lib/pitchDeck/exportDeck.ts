import { domToPng } from 'modern-screenshot';
import jsPDF from 'jspdf';

const SLIDE_W = 1920;
const SLIDE_H = 1080;

/**
 * Render each slide DOM node to a PNG and assemble a 16:9 PDF, one slide per page.
 * Captures from elements with data-slide-id attribute, in DOM order.
 */
export async function exportDeckToPdf(): Promise<void> {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-slide-capture="true"]'));
  if (nodes.length === 0) throw new Error('Nenhum slide para exportar.');

  const pdf = new jsPDF({ unit: 'pt', format: [SLIDE_W, SLIDE_H], orientation: 'landscape' });

  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    // eslint-disable-next-line no-await-in-loop
    const dataUrl = await domToPng(el, {
      width: SLIDE_W,
      height: SLIDE_H,
      backgroundColor: '#0f172a',
      scale: 1,
    });
    if (i > 0) pdf.addPage([SLIDE_W, SLIDE_H], 'landscape');
    pdf.addImage(dataUrl, 'PNG', 0, 0, SLIDE_W, SLIDE_H);
  }

  pdf.save(`O2-Pitch-Deck-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Generate an editable PPTX by capturing each slide as a single full-bleed image.
 * Editable in PowerPoint/Google Slides (images can be replaced), but text inside
 * the image is rasterized. This keeps look identical to the on-screen deck.
 *
 * For now images are full-slide — a future iteration can split into text+chart
 * objects for true text editability.
 */
export async function exportDeckToPptx(): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-slide-capture="true"]'));
  if (nodes.length === 0) throw new Error('Nenhum slide para exportar.');

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.defineLayout({ name: 'O2_DECK', width: 13.333, height: 7.5 });
  pptx.layout = 'O2_DECK';

  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    // eslint-disable-next-line no-await-in-loop
    const dataUrl = await domToPng(el, {
      width: SLIDE_W,
      height: SLIDE_H,
      backgroundColor: '#0f172a',
      scale: 1,
    });
    const slide = pptx.addSlide();
    slide.background = { color: '0F172A' };
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: 13.333, h: 7.5 });
  }

  await pptx.writeFile({ fileName: `O2-Pitch-Deck-${new Date().toISOString().slice(0, 10)}.pptx` });
}
