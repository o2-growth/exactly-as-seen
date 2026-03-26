import { useState } from 'react';
import { ChevronDown, ChevronRight, Lock, Pencil } from 'lucide-react';
import { formatCurrencyFull } from '@/lib/formatters';

export interface MonthRowData {
  month: string;
  monthIdx: number;
  /** Main columns displayed in collapsed row */
  columns: { key: string; value: number; editable?: boolean }[];
  /** Is this month historical (read-only)? */
  isHistorical?: boolean;
  /** Expanded detail: meta vs realizado */
  detail?: {
    meta: number;
    realizado: number;
    /** Funnel items shown when expanded */
    funnel?: { label: string; meta: number; actual: number }[];
  };
}

export interface ExpandableMonthRowProps {
  data: MonthRowData;
  columnHeaders: string[];
  onCellChange?: (monthIdx: number, key: string, value: number) => void;
  formatValue?: (value: number) => string;
}

function pctColor(pct: number): string {
  if (pct >= 100) return 'text-emerald-500';
  if (pct >= 80) return 'text-amber-500';
  return 'text-red-400';
}

export function ExpandableMonthRow({ data, columnHeaders, onCellChange, formatValue }: ExpandableMonthRowProps) {
  const [expanded, setExpanded] = useState(false);
  const fmt = formatValue ?? formatCurrencyFull;
  const hasDetail = !!data.detail;

  return (
    <>
      {/* Collapsed row */}
      <tr
        className={`border-b border-border/30 transition-colors hover:bg-secondary/20 ${expanded ? 'bg-secondary/10' : ''}`}
      >
        {/* Month + chevron */}
        <td className="px-4 py-2.5 whitespace-nowrap">
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            onClick={() => hasDetail && setExpanded(!expanded)}
          >
            {hasDetail ? (
              expanded
                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <span className="w-3.5" />
            )}
            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md border border-border text-xs font-semibold bg-card min-w-[40px]">
              {data.month}
            </span>
          </div>
        </td>

        {/* Value columns */}
        {data.columns.map((col, i) => (
          <td key={col.key} className="text-right px-3 py-2.5 tabular-nums text-sm">
            {col.editable && onCellChange ? (
              <div className="inline-flex items-center gap-1">
                {data.isHistorical ? (
                  <>
                    <Lock className="h-3 w-3 text-muted-foreground/50" />
                    <span>{fmt(col.value)}</span>
                  </>
                ) : (
                  <span className="relative group">
                    <input
                      type="number"
                      className="w-28 bg-transparent border-b border-transparent hover:border-primary/30 focus:border-primary text-right text-sm tabular-nums text-foreground outline-none transition-colors"
                      value={col.value}
                      onChange={e => onCellChange(data.monthIdx, col.key, Number(e.target.value) || 0)}
                    />
                    <Pencil className="absolute right-0 top-1/2 -translate-y-1/2 -translate-x-full h-3 w-3 text-primary/0 group-hover:text-primary/40 transition-colors pointer-events-none" />
                  </span>
                )}
              </div>
            ) : (
              <span className={col.value < 0 ? 'text-red-400' : ''}>{fmt(col.value)}</span>
            )}
          </td>
        ))}
      </tr>

      {/* Expanded detail */}
      {expanded && data.detail && (
        <tr className="border-b border-border/20">
          <td colSpan={columnHeaders.length + 1} className="px-6 py-4 bg-secondary/5">
            {/* Summary bar */}
            <div className="flex items-center gap-6 flex-wrap mb-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-500/10">
                  {data.detail.realizado >= data.detail.meta
                    ? <span className="text-emerald-500 text-xs font-bold">&#10003;</span>
                    : <span className="text-amber-500 text-xs font-bold">!</span>
                  }
                </span>
                <div>
                  <p className="text-[10px] text-muted-foreground">A Vender (Meta)</p>
                  <p className="text-sm font-bold">{fmt(data.detail.meta)}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Realizado</p>
                <p className={`text-sm font-bold ${data.detail.realizado >= data.detail.meta ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {fmt(data.detail.realizado)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Atingimento</p>
                <p className={`text-sm font-bold px-2 py-0.5 rounded ${
                  data.detail.meta > 0
                    ? (data.detail.realizado / data.detail.meta >= 1 ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500')
                    : 'bg-secondary text-muted-foreground'
                }`}>
                  {data.detail.meta > 0 ? `${((data.detail.realizado / data.detail.meta) * 100).toFixed(1)}%` : '—'}
                </p>
              </div>
              {/* Progress bar */}
              <div className="flex-1 min-w-[200px]">
                <p className="text-[10px] text-muted-foreground mb-1">Progresso</p>
                <div className="w-full h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      data.detail.meta > 0 && data.detail.realizado / data.detail.meta >= 1
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, data.detail.meta > 0 ? (data.detail.realizado / data.detail.meta) * 100 : 0)}%` }}
                  />
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Gap</p>
                <p className={`text-sm font-bold ${data.detail.realizado - data.detail.meta >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                  {data.detail.realizado - data.detail.meta >= 0 ? '+' : ''}{fmt(data.detail.realizado - data.detail.meta)}
                </p>
              </div>
            </div>

            {/* Funnel */}
            {data.detail.funnel && data.detail.funnel.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Funil Realizado</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {data.detail.funnel.map(f => {
                    const pct = f.meta > 0 ? (f.actual / f.meta) * 100 : 0;
                    return (
                      <div key={f.label} className="text-center space-y-1">
                        <p className="text-[10px] text-muted-foreground">{f.label}</p>
                        <p className="text-[10px] text-muted-foreground/60">Meta: {f.meta.toLocaleString('pt-BR')}</p>
                        <p className={`text-lg font-bold ${pctColor(pct)}`}>{f.actual.toLocaleString('pt-BR')}</p>
                        <p className={`text-xs font-semibold ${pctColor(pct)}`}>{pct.toFixed(0)}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/** Full expandable monthly table */
export interface ExpandableMonthTableProps {
  title: string;
  year: number;
  columnHeaders: string[];
  rows: MonthRowData[];
  onCellChange?: (monthIdx: number, key: string, value: number) => void;
  formatValue?: (value: number) => string;
  /** Optional totals row */
  totals?: { key: string; value: number }[];
}

export function ExpandableMonthTable({ title, year, columnHeaders, rows, onCellChange, formatValue, totals }: ExpandableMonthTableProps) {
  const fmt = formatValue ?? formatCurrencyFull;

  return (
    <div className="gradient-card overflow-x-auto">
      <h3 className="text-sm font-semibold p-5 pb-3">{title} — {year}</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-2 text-muted-foreground font-medium min-w-[100px]">Mês</th>
            {columnHeaders.map(h => (
              <th key={h} className="text-right px-3 py-2 text-muted-foreground font-medium min-w-[100px]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <ExpandableMonthRow
              key={row.month}
              data={row}
              columnHeaders={columnHeaders}
              onCellChange={onCellChange}
              formatValue={fmt}
            />
          ))}
          {totals && (
            <tr className="border-t-2 border-border bg-primary/5 font-bold">
              <td className="px-4 py-2.5 text-xs font-bold">TOTAL</td>
              {totals.map(t => (
                <td key={t.key} className="text-right px-3 py-2.5 tabular-nums text-sm font-bold">
                  {fmt(t.value)}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
