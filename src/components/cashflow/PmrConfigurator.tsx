import { useState } from 'react';
import { ProdutoPMR, DEFAULT_PMR_PRODUTOS, calcPMRDias } from '@/lib/financialData';
import { Plus, Minus, Check, X } from 'lucide-react';

interface Props {
  produtos: ProdutoPMR[];
  onSave: (produtos: ProdutoPMR[]) => void;
  onCancel: () => void;
}

const GRUPOS = ['CaaS', 'SaaS', 'Education', 'Expansao', 'Tax'] as const;
const GRUPO_LABELS: Record<string, string> = {
  CaaS: 'CaaS', SaaS: 'SaaS', Education: 'Education', Expansao: 'Expansão', Tax: 'Tax',
};

function ParcelasEditor({ parcelas, onChange }: { parcelas: number[]; onChange: (p: number[]) => void }) {
  const total = parcelas.reduce((s, v) => s + v, 0);
  const isValid = total === 100;

  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5 flex-wrap">
        {parcelas.map((pct, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="text-[9px] text-muted-foreground">{i + 1}x</span>
            <input
              type="number"
              min="0"
              max="100"
              className="w-9 h-7 text-center text-[11px] bg-secondary border border-border rounded outline-none focus:ring-1 focus:ring-primary tabular-nums"
              value={pct}
              onChange={e => {
                const next = [...parcelas];
                next[i] = Number(e.target.value) || 0;
                onChange(next);
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-0.5 ml-1">
        <button
          onClick={() => onChange([...parcelas, 0])}
          className="p-0.5 rounded hover:bg-secondary text-muted-foreground"
          title="Adicionar parcela"
        >
          <Plus className="h-3 w-3" />
        </button>
        {parcelas.length > 1 && (
          <button
            onClick={() => onChange(parcelas.slice(0, -1))}
            className="p-0.5 rounded hover:bg-secondary text-muted-foreground"
            title="Remover parcela"
          >
            <Minus className="h-3 w-3" />
          </button>
        )}
      </div>
      <span className={`text-[10px] font-semibold ml-1 ${isValid ? 'text-positive' : 'text-destructive'}`}>
        {total}%
      </span>
    </div>
  );
}

export default function PmrConfigurator({ produtos, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<ProdutoPMR[]>(() => JSON.parse(JSON.stringify(produtos)));

  const updateProduto = (id: string, updates: Partial<ProdutoPMR>) => {
    setDraft(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(produtos);
  const allValid = draft.every(p => p.parcelas.reduce((s, v) => s + v, 0) === 100);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 text-muted-foreground font-medium" style={{ minWidth: 180 }}>Produto</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium" style={{ minWidth: 220 }}>Parcelas (%)</th>
              <th className="text-center px-3 py-2 text-muted-foreground font-medium" style={{ width: 80 }}>Antecipa?</th>
              <th className="text-center px-3 py-2 text-muted-foreground font-medium" style={{ width: 70 }}>Custo ant.</th>
              <th className="text-center px-3 py-2 text-muted-foreground font-medium" style={{ width: 70 }}>Inadimp.</th>
              <th className="text-center px-3 py-2 text-muted-foreground font-medium" style={{ width: 60 }}>PMR</th>
            </tr>
          </thead>
          <tbody>
            {GRUPOS.map(grupo => {
              const items = draft.filter(p => p.grupo === grupo);
              return (
                <tr key={`group-${grupo}`} className="contents">
                  <td colSpan={6}>
                    <table className="w-full">
                      <tbody>
                        <tr className="bg-secondary/30 border-b border-border/30">
                          <td colSpan={6} className="px-3 py-1.5 font-semibold text-muted-foreground text-xs">
                            {GRUPO_LABELS[grupo]}
                          </td>
                        </tr>
                        {items.map(prod => (
                          <tr key={prod.id} className="border-b border-border/20 hover:bg-secondary/10">
                            <td className="px-3 py-2 pl-6" style={{ minWidth: 180 }}>{prod.nome}</td>
                            <td className="px-3 py-2" style={{ minWidth: 220 }}>
                              <ParcelasEditor
                                parcelas={prod.parcelas}
                                onChange={p => updateProduto(prod.id, { parcelas: p })}
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => updateProduto(prod.id, { antecipa: !prod.antecipa, custoAntecipacao: prod.antecipa ? 0 : prod.custoAntecipacao })}
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                                  prod.antecipa ? 'bg-blue-500/20 text-blue-400' : 'bg-secondary text-muted-foreground'
                                }`}
                              >
                                {prod.antecipa ? 'SIM' : 'NÃO'}
                              </button>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {prod.antecipa ? (
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.1"
                                  className="w-14 h-6 text-center text-[11px] bg-secondary border border-border rounded outline-none focus:ring-1 focus:ring-primary"
                                  value={prod.custoAntecipacao}
                                  onChange={e => updateProduto(prod.id, { custoAntecipacao: Number(e.target.value) || 0 })}
                                />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-0.5">
                                <input
                                  type="number"
                                  min="0"
                                  max="30"
                                  step="0.5"
                                  className="w-12 h-6 text-center text-[11px] bg-secondary border border-border rounded outline-none focus:ring-1 focus:ring-primary"
                                  value={prod.inadimplencia}
                                  onChange={e => updateProduto(prod.id, { inadimplencia: Number(e.target.value) || 0 })}
                                />
                                <span className="text-[10px] text-muted-foreground">%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center font-semibold text-[11px]">
                              {calcPMRDias(prod.parcelas)}d
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => allValid && onSave(draft)}
          disabled={!allValid}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            allValid
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          <Check className="h-3.5 w-3.5" /> Salvar configuração
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" /> Cancelar
        </button>
        {!allValid && (
          <span className="text-[10px] text-destructive">Todas as parcelas devem somar 100%</span>
        )}
        {hasChanges && allValid && (
          <span className="text-[10px] text-amber-400">Alterações não salvas</span>
        )}
      </div>
    </div>
  );
}
