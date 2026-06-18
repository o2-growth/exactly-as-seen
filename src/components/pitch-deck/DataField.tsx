import { CSSProperties, useState, useEffect } from 'react';
import { usePitchDeck } from '@/contexts/PitchDeckContext';

interface Props {
  fieldId: string;
  liveValue: string | number;
  format?: (v: number) => string;
  className?: string;
  style?: CSSProperties;
  as?: 'span' | 'div';
}

/**
 * Renders a field that can be edited (override) on top of a live computed value.
 * In edit mode (PitchDeckContext.editMode), clicking opens an inline input.
 */
export default function DataField({ fieldId, liveValue, format, className, style, as = 'span' }: Props) {
  const { editMode, getOverride, setOverride, clearOverride } = usePitchDeck();
  const override = getOverride(fieldId);
  const [editing, setEditing] = useState(false);

  const formatted =
    typeof liveValue === 'number'
      ? (format ? format(liveValue) : String(liveValue))
      : String(liveValue);

  const displayed = override ?? formatted;
  const Comp: any = as;

  const [draft, setDraft] = useState(displayed);
  useEffect(() => { setDraft(displayed); }, [displayed]);

  if (editing && editMode) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() === '' || draft === formatted) clearOverride(fieldId);
          else setOverride(fieldId, draft);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setDraft(displayed); setEditing(false); }
        }}
        className={className}
        style={{
          ...style,
          background: 'rgba(107,241,105,0.15)',
          border: '2px solid #6BF169',
          borderRadius: 6,
          padding: '0 8px',
          color: 'inherit',
          font: 'inherit',
          minWidth: 80,
        }}
      />
    );
  }

  return (
    <Comp
      className={className}
      style={{
        ...style,
        ...(editMode
          ? { outline: '2px dashed rgba(107,241,105,0.45)', outlineOffset: 4, cursor: 'pointer', borderRadius: 4 }
          : {}),
        ...(override ? { color: '#6BF169' } : {}),
      }}
      onClick={editMode ? () => setEditing(true) : undefined}
      title={editMode ? `Editar "${fieldId}"` : undefined}
    >
      {displayed}
    </Comp>
  );
}
