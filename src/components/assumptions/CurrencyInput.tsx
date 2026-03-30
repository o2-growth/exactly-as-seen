import { useState, useRef, useEffect } from 'react';

interface CurrencyInputProps {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  className?: string;
}

/** Formats number as R$ 30.000 for display, raw number for editing */
export function CurrencyInput({ value, onChange, disabled = false, className = '' }: CurrencyInputProps) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setRaw(String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const formatted = `R$ ${value.toLocaleString('pt-BR')}`;

  const commit = () => {
    setEditing(false);
    const parsed = Number(raw) || 0;
    if (parsed !== value) onChange(parsed);
  };

  if (disabled || !editing) {
    return (
      <div
        className={`w-full bg-card border border-border rounded px-2 py-1 text-right text-xs tabular-nums ${disabled ? 'opacity-70' : 'cursor-pointer hover:border-primary/50'} ${className}`}
        onClick={() => { if (!disabled) setEditing(true); }}
        title={disabled ? undefined : 'Clique para editar'}
      >
        {formatted}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type="number"
      className={`w-full bg-card border border-primary/30 rounded px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-1 focus:ring-primary ${className}`}
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { setRaw(String(value)); setEditing(false); }
      }}
    />
  );
}
