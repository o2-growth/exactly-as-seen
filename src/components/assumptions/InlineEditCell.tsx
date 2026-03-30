import { useState, useRef, useEffect } from 'react';

interface InlineEditCellProps {
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  className?: string;
  step?: number;
  disabled?: boolean;
}

export function InlineEditCell({ value, onChange, format, className = '', step = 1, disabled = false }: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  if (!editing) {
    return (
      <span
        className={`${disabled ? '' : 'cursor-pointer hover:bg-primary/10'} rounded px-1.5 py-0.5 transition-colors tabular-nums ${className}`}
        onClick={() => { if (!disabled) setEditing(true); }}
        title={disabled ? undefined : "Clique para editar"}
      >
        {format ? format(value) : value.toLocaleString('pt-BR')}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      type="number"
      step={step}
      className="w-full bg-secondary border border-primary/30 rounded px-2 py-0.5 text-right text-sm tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
      value={localValue}
      onChange={e => setLocalValue(Number(e.target.value) || 0)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { setLocalValue(value); setEditing(false); }
      }}
    />
  );
}
