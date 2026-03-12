import { useState, useCallback, useMemo } from 'react';
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS, Year } from '@/lib/financialData';
import { PnlNode } from '@/lib/pnlData';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import { ChevronRight, ChevronDown, Settings2, Eye, EyeOff, Plus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

type ViewMode = 'annual' | 'monthly' | 'summary';

function formatPnlValue(value: number, isMargin: boolean): string {
  if (isMargin) return formatPercent(value);
  if (value === 0) return '—';
  return formatCurrency(value * 1000);
}

// Chart of Accounts customization
function useChartOfAccounts() {
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('o2_coa_labels') || '{}'); } catch { return {}; }
  });
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('o2_coa_hidden') || '[]')); } catch { return new Set(); }
  });

  const setLabel = useCallback((code: string, label: string) => {
    setCustomLabels(prev => {
      const next = { ...prev, [code]: label };
      localStorage.setItem('o2_coa_labels', JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleHidden = useCallback((code: string) => {
    setHiddenItems(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      localStorage.setItem('o2_coa_hidden', JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { customLabels, hiddenItems, setLabel, toggleHidden };
}

interface ExpandableRowProps {
  node: PnlNode;
  depth: number;
  columns: (Year | string)[];
  viewMode: ViewMode;
  selectedYear: Year;
  customLabels: Record<string, string>;
  hiddenItems: Set<string>;
}

function ExpandableRow({ node, depth, columns, viewMode, selectedYear, customLabels, hiddenItems }: ExpandableRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  const label = customLabels[node.code] || node.label;

  if (hiddenItems.has(node.code)) return null;

  // Engine already applies scenario — no double-multiplication needed
  const getValue = (col: Year | string): number => {
    if (viewMode === 'monthly' && typeof col === 'string') {
      const monthIdx = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(col);
      if (node.monthly?.[selectedYear]) {
        return node.monthly[selectedYear][monthIdx] || 0;
      }
      if (node.isMargin) return node.annual[selectedYear];
      return Math.round(node.annual[selectedYear] / 12);
    }
    return node.annual[col as Year];
  };

  return (
    <>
      <tr
        className={`border-b border-border/30 transition-colors ${
          node.isSummary
            ? 'bg-primary/5 font-bold'
            : node.isMargin
              ? 'bg-transparent'
              : node.isHeader
                ? 'bg-secondary/30 font-bold'
                : 'hover:bg-secondary/20'
        }`}
      >
        <td
          className="p-3 whitespace-nowrap cursor-pointer select-none"
          style={{ paddingLeft: `${12 + depth * 20}px` }}
          onClick={() => hasChildren && setExpanded(!expanded)}
        >
          <div className="flex items-center gap-1.5">
            {hasChildren ? (
              expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <span className="w-3.5" />
            )}
            {!node.isHeader && (
              <span className="text-[11px] text-muted-foreground font-mono mr-1.5">{node.code}</span>
            )}
            <span className={`text-sm ${
              node.isHeader
                ? 'text-xs font-bold uppercase tracking-wider text-muted-foreground'
                : node.isSummary ? 'text-foreground' : node.isMargin ? 'text-muted-foreground italic' : 'text-foreground/90'
            }`}>
              {label}
            </span>
          </div>
        </td>
        {columns.map((col) => {
          const val = getValue(col);
          return (
            <td key={String(col)} className="text-right p-3 tabular-nums text-sm">
              {node.isMargin ? (
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                  val > 70 ? 'bg-success/20 text-positive' : val > 0 ? 'bg-warning/20 text-warning' : 'bg-destructive/20 text-negative'
                }`}>
                  {formatPercent(val)}
                </span>
              ) : (
                <span className={val < 0 ? 'text-negative' : ''}>
                  {formatPnlValue(val, false)}
                </span>
              )}
            </td>
          );
        })}
      </tr>
      {expanded && node.children?.map(child => (
        <ExpandableRow
          key={child.code}
          node={child}
          depth={depth + 1}
          columns={columns}
          viewMode={viewMode}
          selectedYear={selectedYear}
          customLabels={customLabels}
          hiddenItems={hiddenItems}
        />
      ))}
    </>
  );
}

function CoaModal({ customLabels, hiddenItems, setLabel, toggleHidden, pnlTree }: {
  customLabels: Record<string, string>;
  hiddenItems: Set<string>;
  setLabel: (code: string, label: string) => void;
  toggleHidden: (code: string) => void;
  pnlTree: PnlNode[];
}) {
  const renderItems = (nodes: PnlNode[], depth = 0): React.ReactNode => {
    return nodes.map(node => (
      <div key={node.code}>
        <div className="flex items-center gap-2 py-1.5" style={{ paddingLeft: `${depth * 16}px` }}>
          <button onClick={() => toggleHidden(node.code)} className="text-muted-foreground hover:text-foreground">
            {hiddenItems.has(node.code) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <span className="text-[10px] text-muted-foreground font-mono w-10">{node.code}</span>
          <input
            className="flex-1 bg-secondary/50 border border-border rounded px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-primary"
            value={customLabels[node.code] || node.label}
            onChange={(e) => setLabel(node.code, e.target.value)}
          />
        </div>
        {node.children && renderItems(node.children, depth + 1)}
      </div>
    ));
  };

  return (
    <DialogContent className="max-w-xl max-h-[70vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-lg">Plano de Contas</DialogTitle>
      </DialogHeader>
      <div className="space-y-0.5 mt-2">
        {renderItems(pnlTree)}
      </div>
      <div className="pt-3 border-t border-border mt-3">
        <button className="flex items-center gap-1.5 text-xs text-primary hover:underline">
          <Plus className="h-3 w-3" /> Adicionar linha
        </button>
      </div>
    </DialogContent>
  );
}

// Transform isHeader nodes into expandable parents that group subsequent items
function groupByHeaders(nodes: PnlNode[]): PnlNode[] {
  const result: PnlNode[] = [];
  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    if (node.isHeader) {
      // Collect subsequent non-summary, non-margin, non-header nodes as children
      const children: PnlNode[] = [];
      let j = i + 1;
      while (j < nodes.length && !nodes[j].isSummary && !nodes[j].isMargin && !nodes[j].isHeader) {
        children.push(nodes[j]);
        j++;
      }
      // Compute sum of children for annual/monthly values
      const groupAnnual = {} as Record<Year, number>;
      const groupMonthly = {} as Record<Year, number[]>;
      for (const y of YEARS) {
        groupAnnual[y] = children.reduce((sum, c) => sum + (c.annual[y] || 0), 0);
        groupMonthly[y] = Array.from({ length: 12 }, (_, m) =>
          children.reduce((sum, c) => sum + (c.monthly?.[y]?.[m] || 0), 0)
        );
      }
      result.push({
        code: node.code,
        label: node.label,
        annual: groupAnnual,
        monthly: groupMonthly,
        isHeader: true,
        children,
      });
      i = j;
    } else {
      result.push(node);
      i++;
    }
  }
  return result;
}

export default function PnL() {
  const { scenario, selectedYear, pnlTree: rawPnlTree, filteredYears } = useFinancialModel();
  const pnlTree = useMemo(() => groupByHeaders(rawPnlTree), [rawPnlTree]);
  const [viewMode, setViewMode] = useState<ViewMode>('annual');
  const { customLabels, hiddenItems, setLabel, toggleHidden } = useChartOfAccounts();

  // Use filteredYears for annual view; fall back to all YEARS if empty
  const activeYears: Year[] = filteredYears.length > 0 ? filteredYears : [...YEARS];

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const columns: (Year | string)[] = viewMode === 'monthly'
    ? months
    : viewMode === 'summary'
      ? ([activeYears[0], activeYears[activeYears.length - 1]] as Year[])
      : [...activeYears];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">P&L — Demonstração de Resultado</h2>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-secondary rounded-lg p-0.5 border border-border">
            {(['annual', 'monthly', 'summary'] as const).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${
                  viewMode === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {v === 'summary' ? '5-Year' : v}
              </button>
            ))}
          </div>

          {/* CoA Modal */}
          <Dialog>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                <Settings2 className="h-3.5 w-3.5" />
                Plano de Contas
              </button>
            </DialogTrigger>
            <CoaModal customLabels={customLabels} hiddenItems={hiddenItems} setLabel={setLabel} toggleHidden={toggleHidden} pnlTree={pnlTree} />
          </Dialog>
        </div>
      </div>

      {viewMode === 'monthly' && (
        <p className="text-xs text-muted-foreground">Detalhamento mensal — {selectedYear}</p>
      )}

      <div className="gradient-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-muted-foreground font-medium min-w-[260px] sticky left-0 bg-card">
                Descrição
              </th>
              {columns.map(col => {
                const isHistorical = typeof col === 'number' && col === 2025;
                const isPartial    = typeof col === 'number' && col === 2026;
                return (
                  <th key={String(col)} className="text-right p-3 text-muted-foreground font-medium min-w-[100px]">
                    <div className="flex flex-col items-end gap-0.5">
                      <span>{String(col)}</span>
                      {isHistorical && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 tracking-wide">
                          Realizado
                        </span>
                      )}
                      {isPartial && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 tracking-wide">
                          Parcial
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pnlTree.map(node => (
              <ExpandableRow
                key={node.code}
                node={node}
                depth={0}
                columns={columns}
                viewMode={viewMode}
                selectedYear={selectedYear}
                customLabels={customLabels}
                hiddenItems={hiddenItems}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Valores em R$ mil (000's) · {scenario} scenario · Projeções estimadas
      </p>
    </div>
  );
}
