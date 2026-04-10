import React from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { FormulaExplanation } from '@/lib/formulaExplainer';

interface FormulaExplainerProps {
  explanation: FormulaExplanation;
  className?: string;
  iconSize?: number;
}

export function FormulaExplainer({ explanation, className = '', iconSize = 13 }: FormulaExplainerProps) {
  if (!explanation.title) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center rounded-full hover:bg-primary/10 transition-colors p-0.5 ${className}`}
          onClick={e => e.stopPropagation()}
        >
          <Info className="text-primary/60 hover:text-primary" style={{ width: iconSize, height: iconSize }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-80 p-0 shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-foreground leading-tight">
              📐 {explanation.title}
            </h4>
            <p className="text-[10px] text-primary font-mono bg-primary/5 rounded px-2 py-1">
              {explanation.formula}
            </p>
          </div>

          {/* Steps */}
          <div className="space-y-1.5">
            {explanation.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <span className="text-muted-foreground min-w-[120px] shrink-0">{step.label}</span>
                <span className="font-semibold tabular-nums text-foreground">{step.value}</span>
                <span className="text-[9px] text-muted-foreground/70 ml-auto shrink-0 italic">{step.source}</span>
              </div>
            ))}
          </div>

          {/* Example */}
          {explanation.example && (
            <div className="bg-muted/50 rounded px-2 py-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground">EXEMPLO</span>
              <p className="text-[11px] font-mono text-foreground mt-0.5">{explanation.example}</p>
            </div>
          )}

          {/* Result */}
          <div className="border-t border-border pt-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground">RESULTADO</span>
            <span className="text-sm font-bold text-primary tabular-nums">{explanation.result}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
