import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { DateRange, YEARS, Year } from '@/lib/financialData';

// ─── Types ───────────────────────────────────────────────────────────────────

type PresetKey =
  | 'this_year'
  | 'last_year'
  | 'last_2_years'
  | 'last_3_years'
  | 'next_3_years'
  | 'historical'
  | 'projected'
  | 'all'
  | 'custom';

interface Preset {
  key: PresetKey;
  label: string;
  range: DateRange | undefined;
}

// Today = 2026-03-12
const CURRENT_YEAR = 2026;
const MIN_YEAR = YEARS[0];           // 2025
const MAX_YEAR = YEARS[YEARS.length - 1]; // 2030

function buildPresets(): Preset[] {
  return [
    {
      key: 'this_year',
      label: 'Ano Atual',
      range: { startYear: CURRENT_YEAR, endYear: CURRENT_YEAR },
    },
    {
      key: 'last_year',
      label: 'Ano Anterior',
      range: { startYear: CURRENT_YEAR - 1, endYear: CURRENT_YEAR - 1 },
    },
    {
      key: 'last_2_years',
      label: 'Últimos 2 Anos',
      range: { startYear: CURRENT_YEAR - 1, endYear: CURRENT_YEAR },
    },
    {
      key: 'last_3_years',
      label: 'Últimos 3 Anos',
      range: { startYear: Math.max(MIN_YEAR, CURRENT_YEAR - 2), endYear: CURRENT_YEAR },
    },
    {
      key: 'next_3_years',
      label: 'Próximos 3 Anos',
      range: { startYear: CURRENT_YEAR, endYear: Math.min(MAX_YEAR, CURRENT_YEAR + 2) },
    },
    {
      key: 'historical',
      label: 'Histórico',
      range: { startYear: MIN_YEAR, endYear: CURRENT_YEAR },
    },
    {
      key: 'projected',
      label: 'Projetado',
      range: { startYear: CURRENT_YEAR + 1, endYear: MAX_YEAR },
    },
    {
      key: 'all',
      label: 'Todo o Período',
      range: undefined,
    },
    {
      key: 'custom',
      label: 'Personalizar',
      range: undefined,
    },
  ];
}

const PRESETS = buildPresets();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rangesEqual(a: DateRange | undefined, b: DateRange | undefined): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.startYear === b.startYear && a.endYear === b.endYear;
}

function detectPreset(range: DateRange | undefined): PresetKey {
  for (const p of PRESETS) {
    if (p.key === 'custom') continue;
    if (rangesEqual(p.range, range)) return p.key;
  }
  return 'custom';
}

function formatRange(range: DateRange | undefined): string {
  if (!range) return 'Todo o Período';
  if (range.startYear === range.endYear) return String(range.startYear);
  return `${range.startYear} — ${range.endYear}`;
}

// ─── Year Grid ────────────────────────────────────────────────────────────────

interface YearGridProps {
  startYear: number;
  endYear: number;
  onChange: (start: number, end: number) => void;
}

function YearGrid({ startYear, endYear, onChange }: YearGridProps) {
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  function handleClick(year: number) {
    if (!selectingEnd) {
      onChange(year, year);
      setSelectingEnd(true);
    } else {
      const s = Math.min(startYear, year);
      const e = Math.max(startYear, year);
      onChange(s, e);
      setSelectingEnd(false);
    }
  }

  function isInRange(year: number): boolean {
    if (selectingEnd && hovered !== null) {
      const s = Math.min(startYear, hovered);
      const e = Math.max(startYear, hovered);
      return year >= s && year <= e;
    }
    return year >= startYear && year <= endYear;
  }

  function isStart(year: number): boolean {
    if (selectingEnd && hovered !== null) return year === Math.min(startYear, hovered);
    return year === startYear;
  }

  function isEnd(year: number): boolean {
    if (selectingEnd && hovered !== null) return year === Math.max(startYear, hovered);
    return year === endYear;
  }

  return (
    <div>
      <p className="text-[10px] text-muted-foreground font-medium mb-2 uppercase tracking-wide">
        {selectingEnd ? 'Selecione o ano final' : 'Selecione o ano inicial'}
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {YEARS.map((year) => {
          const inRange = isInRange(year);
          const start = isStart(year);
          const end = isEnd(year);
          const isEdge = start || end;

          return (
            <button
              key={year}
              type="button"
              onMouseEnter={() => selectingEnd && setHovered(year)}
              onMouseLeave={() => selectingEnd && setHovered(null)}
              onClick={() => handleClick(year)}
              className={[
                'px-3 py-2 text-xs font-semibold rounded-md transition-all duration-150',
                isEdge
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : inRange
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80',
              ].join(' ')}
            >
              {year}
            </button>
          );
        })}
      </div>
      {startYear !== endYear && !selectingEnd && (
        <p className="text-[10px] text-primary/80 mt-2">
          {startYear} — {endYear}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PeriodFilter() {
  const { dateRange, setDateRange } = useFinancialModel();

  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(dateRange);
  const [activePreset, setActivePreset] = useState<PresetKey>(() => detectPreset(dateRange));
  const [showCustom, setShowCustom] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync draft when context changes externally
  useEffect(() => {
    setDraftRange(dateRange);
    setActivePreset(detectPreset(dateRange));
  }, [dateRange]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  function handlePresetClick(preset: Preset) {
    setActivePreset(preset.key);
    if (preset.key === 'custom') {
      setShowCustom(true);
      // keep current draftRange so user can refine it
    } else {
      setShowCustom(false);
      setDraftRange(preset.range);
    }
  }

  function handleApply() {
    setDateRange(draftRange);
    setOpen(false);
  }

  function handleOpen() {
    // Reset draft to current committed range when opening
    setDraftRange(dateRange);
    setActivePreset(detectPreset(dateRange));
    setShowCustom(detectPreset(dateRange) === 'custom');
    setOpen(true);
  }

  const displayLabel = formatRange(dateRange);

  return (
    <div ref={containerRef} className="relative hidden md:block">
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-border rounded-lg text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors"
      >
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <span>{displayLabel}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute top-full right-0 mt-2 z-50 rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="flex">
            {/* Left: Preset list */}
            <div className="w-44 border-r border-border py-2">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Período
              </p>
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={[
                    'w-full flex items-center justify-between px-4 py-2 text-xs font-medium transition-colors',
                    activePreset === preset.key
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                  ].join(' ')}
                >
                  <span>{preset.label}</span>
                  {activePreset === preset.key && (
                    <Check className="h-3 w-3 shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* Right: Custom range picker */}
            <div className="w-56 p-4 flex flex-col gap-4">
              {showCustom ? (
                <>
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-3">Personalizar</p>
                    <YearGrid
                      startYear={draftRange?.startYear ?? MIN_YEAR}
                      endYear={draftRange?.endYear ?? MAX_YEAR}
                      onChange={(s, e) => setDraftRange({ startYear: s as Year, endYear: e as Year })}
                    />
                  </div>

                  {/* Manual selectors */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-10">De</span>
                      <select
                        value={draftRange?.startYear ?? MIN_YEAR}
                        onChange={(e) =>
                          setDraftRange(prev => ({
                            startYear: Number(e.target.value) as Year,
                            endYear: Math.max(prev?.endYear ?? MAX_YEAR, Number(e.target.value)),
                          }))
                        }
                        className="flex-1 bg-secondary border border-border text-foreground text-xs rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
                      >
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-10">Até</span>
                      <select
                        value={draftRange?.endYear ?? MAX_YEAR}
                        onChange={(e) =>
                          setDraftRange(prev => ({
                            startYear: Math.min(prev?.startYear ?? MIN_YEAR, Number(e.target.value)),
                            endYear: Number(e.target.value) as Year,
                          }))
                        }
                        className="flex-1 bg-secondary border border-border text-foreground text-xs rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
                      >
                        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col justify-center h-full">
                  <p className="text-xs font-semibold text-foreground mb-1">
                    {PRESETS.find(p => p.key === activePreset)?.label ?? 'Período selecionado'}
                  </p>
                  <p className="text-sm font-bold text-primary">
                    {formatRange(draftRange)}
                  </p>
                  {draftRange && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {draftRange.endYear - draftRange.startYear + 1} ano
                      {draftRange.endYear - draftRange.startYear + 1 !== 1 ? 's' : ''}
                    </p>
                  )}
                  {!draftRange && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {YEARS.length} anos (2025–2030)
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/30">
            <button
              type="button"
              onClick={() => {
                setDraftRange(undefined);
                setActivePreset('all');
                setShowCustom(false);
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 transition-colors"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
