import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { getBackendClientSafe } from '@/lib/supabase-safe';

interface PitchDeckState {
  overrides: Record<string, string>;
  slideOrder: number[] | null;
  hiddenSlides: number[];
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  getOverride: (fieldId: string) => string | undefined;
  setOverride: (fieldId: string, value: string) => void;
  clearOverride: (fieldId: string) => void;
  resetAll: () => void;
  toggleHidden: (slideId: number) => void;
  setSlideOrder: (order: number[] | null) => void;
}

const PitchDeckContext = createContext<PitchDeckState | null>(null);

const LS_KEY = 'o2_pitch_overrides_v1';

export function PitchDeckProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverridesState] = useState<Record<string, string>>({});
  const [slideOrder, setSlideOrderState] = useState<number[] | null>(null);
  const [hiddenSlides, setHiddenSlides] = useState<number[]>([]);
  const [editMode, setEditMode] = useState(false);
  const loaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load on mount
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    (async () => {
      // localStorage fallback first
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const p = JSON.parse(raw);
          setOverridesState(p.overrides ?? {});
          setSlideOrderState(p.slideOrder ?? null);
          setHiddenSlides(p.hiddenSlides ?? []);
        }
      } catch {}
      const sb = getBackendClientSafe();
      if (!sb) return;
      const { data: u } = await sb.auth.getUser();
      if (!u?.user) return;
      const { data } = await (sb as any)
        .from('pitch_deck_overrides')
        .select('overrides, slide_order, hidden_slides')
        .eq('user_id', u.user.id)
        .maybeSingle();
      if (data) {
        setOverridesState(data.overrides ?? {});
        setSlideOrderState(data.slide_order ?? null);
        setHiddenSlides(data.hidden_slides ?? []);
      }
    })();
  }, []);

  // Auto-save (debounced)
  const persist = useCallback((next: { overrides: Record<string, string>; slideOrder: number[] | null; hiddenSlides: number[] }) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const sb = getBackendClientSafe();
      if (!sb) return;
      const { data: u } = await sb.auth.getUser();
      if (!u?.user) return;
      await (sb as any).from('pitch_deck_overrides').upsert({
        user_id: u.user.id,
        overrides: next.overrides,
        slide_order: next.slideOrder,
        hidden_slides: next.hiddenSlides,
      }, { onConflict: 'user_id' });
    }, 1200);
  }, []);

  const getOverride = (id: string) => overrides[id];

  const setOverride = (id: string, value: string) => {
    setOverridesState(prev => {
      const next = { ...prev, [id]: value };
      persist({ overrides: next, slideOrder, hiddenSlides });
      return next;
    });
  };
  const clearOverride = (id: string) => {
    setOverridesState(prev => {
      const next = { ...prev };
      delete next[id];
      persist({ overrides: next, slideOrder, hiddenSlides });
      return next;
    });
  };
  const resetAll = () => {
    setOverridesState({});
    setHiddenSlides([]);
    setSlideOrderState(null);
    persist({ overrides: {}, slideOrder: null, hiddenSlides: [] });
  };
  const toggleHidden = (id: number) => {
    setHiddenSlides(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      persist({ overrides, slideOrder, hiddenSlides: next });
      return next;
    });
  };
  const setSlideOrder = (order: number[] | null) => {
    setSlideOrderState(order);
    persist({ overrides, slideOrder: order, hiddenSlides });
  };

  return (
    <PitchDeckContext.Provider value={{
      overrides, slideOrder, hiddenSlides, editMode, setEditMode,
      getOverride, setOverride, clearOverride, resetAll, toggleHidden, setSlideOrder,
    }}>
      {children}
    </PitchDeckContext.Provider>
  );
}

export function usePitchDeck() {
  const ctx = useContext(PitchDeckContext);
  if (!ctx) throw new Error('usePitchDeck must be used inside PitchDeckProvider');
  return ctx;
}
