import { useEffect, useState, useCallback } from 'react';
import { PitchDeckProvider, usePitchDeck } from '@/contexts/PitchDeckContext';
import ScaledSlide from '@/components/pitch-deck/ScaledSlide';
import SlideLayout from '@/components/pitch-deck/SlideLayout';
import { SLIDES } from '@/components/pitch-deck/slides';
import { Edit3, Eye, Play, FileDown, Presentation, RotateCcw, EyeOff, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportDeckToPdf, exportDeckToPptx } from '@/lib/pitchDeck/exportDeck';
import { toast } from 'sonner';

function PitchDeckInner() {
  const { editMode, setEditMode, hiddenSlides, toggleHidden, resetAll } = usePitchDeck();
  const [current, setCurrent] = useState(0);
  const [presenter, setPresenter] = useState(false);
  const [exporting, setExporting] = useState<null | 'pdf' | 'pptx'>(null);

  const visibleSlides = SLIDES.filter(s => !hiddenSlides.includes(s.id));
  const total = visibleSlides.length;
  const slide = visibleSlides[current] ?? visibleSlides[0];

  const go = useCallback((delta: number) => {
    setCurrent(c => Math.max(0, Math.min(total - 1, c + delta)));
  }, [total]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || (presenter && e.key === ' ')) { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'Escape' && presenter) { setPresenter(false); document.exitFullscreen?.().catch(() => {}); }
      else if (e.key === 'F5') { e.preventDefault(); enterPresenter(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, presenter]);

  const enterPresenter = async () => {
    setPresenter(true);
    setEditMode(false);
    try { await document.documentElement.requestFullscreen?.(); } catch {}
  };

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setPresenter(false);
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const handleExport = async (kind: 'pdf' | 'pptx') => {
    setExporting(kind);
    toast.info(`Gerando ${kind.toUpperCase()}… isso pode levar alguns segundos.`);
    try {
      if (kind === 'pdf') await exportDeckToPdf();
      else await exportDeckToPptx();
      toast.success(`${kind.toUpperCase()} gerado com sucesso!`);
    } catch (e: any) {
      toast.error(`Erro ao gerar ${kind}: ${e.message ?? e}`);
    } finally {
      setExporting(null);
    }
  };

  // Render all slides off-screen for export captures
  const OffscreenSlides = () => (
    <div style={{ position: 'fixed', top: -100000, left: -100000, pointerEvents: 'none' }} aria-hidden>
      {visibleSlides.map((s, i) => (
        <div
          key={s.id}
          data-slide-capture="true"
          style={{ width: 1920, height: 1080, position: 'relative', overflow: 'hidden' }}
        >
          <SlideLayout page={i + 1} total={total} variant={s.variant ?? 'dark'}>
            <s.Component />
          </SlideLayout>
        </div>
      ))}
    </div>
  );

  if (presenter) {
    return (
      <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
        <div className="relative w-screen h-screen">
          <ScaledSlide>
            <SlideLayout page={current + 1} total={total} variant={slide.variant ?? 'dark'}>
              <slide.Component />
            </SlideLayout>
          </ScaledSlide>
        </div>
        <button
          onClick={() => { setPresenter(false); document.exitFullscreen?.().catch(() => {}); }}
          className="absolute top-6 right-6 text-white/60 hover:text-white p-2"
          title="Sair (Esc)"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 text-sm">
          {current + 1} / {total} · ← → para navegar · Esc para sair
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-4 md:-m-6">
      <OffscreenSlides />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={editMode ? 'default' : 'outline'}
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? <Eye className="w-4 h-4 mr-2" /> : <Edit3 className="w-4 h-4 mr-2" />}
            {editMode ? 'Visualizar' : 'Editar'}
          </Button>
          <Button size="sm" variant="outline" onClick={enterPresenter}>
            <Play className="w-4 h-4 mr-2" /> Apresentar (F5)
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport('pdf')} disabled={!!exporting}>
            {exporting === 'pdf' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
            PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleExport('pptx')} disabled={!!exporting}>
            {exporting === 'pptx' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Presentation className="w-4 h-4 mr-2" />}
            PPTX
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { if (confirm('Resetar todos os overrides e voltar aos dados ao vivo?')) resetAll(); }}>
            <RotateCcw className="w-4 h-4 mr-2" /> Resetar
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => go(-1)} disabled={current === 0}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {current + 1} / {total}
          </span>
          <Button size="sm" variant="ghost" onClick={() => go(1)} disabled={current >= total - 1}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Thumbnail strip */}
        <aside className="w-56 border-r border-border bg-card overflow-y-auto">
          <div className="p-2 space-y-2">
            {SLIDES.map((s, i) => {
              const visibleIdx = visibleSlides.findIndex(v => v.id === s.id);
              const isHidden = hiddenSlides.includes(s.id);
              const isActive = !isHidden && visibleIdx === current;
              return (
                <button
                  key={s.id}
                  onClick={() => { if (!isHidden) setCurrent(visibleIdx); }}
                  className={`w-full text-left rounded-md p-2 transition-all ${
                    isActive ? 'bg-primary/15 border border-primary/40' : 'hover:bg-secondary/60 border border-transparent'
                  } ${isHidden ? 'opacity-40' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                      {String(s.id).padStart(2, '0')}
                    </span>
                    <span className="text-xs flex-1 leading-tight">{s.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleHidden(s.id); }}
                      className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                      title={isHidden ? 'Mostrar' : 'Ocultar'}
                      style={{ opacity: editMode ? 1 : 0.3 }}
                    >
                      {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Canvas */}
        <main className="flex-1 bg-muted/30 relative overflow-hidden">
          <ScaledSlide>
            <SlideLayout page={current + 1} total={total} variant={slide.variant ?? 'dark'}>
              <slide.Component />
            </SlideLayout>
          </ScaledSlide>
          {editMode && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-primary/15 text-primary border border-primary/40 px-3 py-1.5 rounded-full text-xs">
              Modo Edição · clique nos campos com borda tracejada para editar
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function PitchDeckPage() {
  return (
    <PitchDeckProvider>
      <PitchDeckInner />
    </PitchDeckProvider>
  );
}
