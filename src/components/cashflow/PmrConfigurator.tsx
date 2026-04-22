import { useState } from 'react';
import { ProdutoPMR, DEFAULT_PMR_PRODUTOS, calcPMRDias } from '@/lib/financialData';
import { Check, X, ChevronDown, ChevronRight, Plus, Minus, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  produtos: ProdutoPMR[];
  onSave: (produtos: ProdutoPMR[]) => void;
  onCancel: () => void;
}

const GRUPOS = ['CaaS', 'SaaS', 'Education', 'Expansao', 'Tax'] as const;
const GRUPO_LABELS: Record<string, string> = {
  CaaS: 'CaaS', SaaS: 'SaaS', Education: 'Education', Expansao: 'Expansão', Tax: 'Tax',
};

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help inline-flex"><Info className="h-3 w-3 text-primary/50 hover:text-primary" /></span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[250px] text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/** Compact parcelas display */
function parcelasLabel(parcelas: number[]): string {
  if (parcelas.length === 1) return `À vista (${parcelas[0]}%)`;
  return `${parcelas.length}x (${parcelas.join('/')})`;
}

export default function PmrConfigurator({ produtos, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<ProdutoPMR[]>(() => JSON.parse(JSON.stringify(produtos)));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedGrupos, setExpandedGrupos] = useState<Record<string, boolean>>({ CaaS: true, SaaS: true, Education: true, Expansao: true, Tax: true });

  const updateProduto = (id: string, updates: Partial<ProdutoPMR>) => {
    setDraft(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(produtos);
  const allValid = draft.every(p => p.parcelas.reduce((s, v) => s + v, 0) === 100);

  const toggleGrupo = (g: string) => setExpandedGrupos(prev => ({ ...prev, [g]: !prev[g] }));

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 text-muted-foreground font-medium w-[180px]">Produto</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium w-[200px]">
                <span className="flex items-center gap-1">Parcelas <InfoTip text="Distribuição % do recebimento por mês. Ex: [33,33,34] = 3 parcelas iguais. Deve somar 100%." /></span>
              </th>
              <th className="text-center px-3 py-2 text-muted-foreground font-medium w-[75px]">
                <span className="flex items-center justify-center gap-1">Antecipa? <InfoTip text="Se SIM, parcelas futuras são antecipadas com deságio (custo financeiro). A primeira parcela não sofre deságio." /></span>
              </th>
              <th className="text-center px-3 py-2 text-muted-foreground font-medium w-[75px]">
                <span className="flex items-center justify-center gap-1">Custo ant. <InfoTip text="% ao mês cobrado pela antecipação de recebíveis. Aplicado nas parcelas futuras (2ª em diante)." /></span>
              </th>
              <th className="text-center px-3 py-2 text-muted-foreground font-medium w-[75px]">
                <span className="flex items-center justify-center gap-1">Inadimp. <InfoTip text="% da receita bruta que não será recebida. Alimenta a linha 4.26 (Provisão para Devedores Duvidosos)." /></span>
              </th>
              <th className="text-center px-3 py-2 text-muted-foreground font-medium w-[55px]">
                <span className="flex items-center justify-center gap-1">PMR <InfoTip text="Prazo Médio de Recebimento em dias. Calculado automaticamente: média ponderada das parcelas × 30 dias." /></span>
              </th>
            </tr>
          </thead>
          <tbody>
            {GRUPOS.map(grupo => {
              const items = draft.filter(p => p.grupo === grupo);
              const isOpen = expandedGrupos[grupo];
              const avgPmr = items.length > 0 ? Math.round(items.reduce((s, p) => s + calcPMRDias(p.parcelas), 0) / items.length) : 0;

              return (
                <>{/* Fragment for grupo */}
                  <tr
                    key={`g-${grupo}`}
                    className="bg-secondary/30 border-b border-border/30 cursor-pointer hover:bg-secondary/40"
                    onClick={() => toggleGrupo(grupo)}
                  >
                    <td colSpan={5} className="px-3 py-2 font-semibold text-xs">
                      <div className="flex items-center gap-1.5">
                        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {GRUPO_LABELS[grupo]}
                        <span className="text-muted-foreground font-normal ml-2">{items.length} produtos</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center font-semibold text-xs">{avgPmr}d</td>
                  </tr>
                  {isOpen && items.map(prod => {
                    const total = prod.parcelas.reduce((s, v) => s + v, 0);
                    const isValid = total === 100;
                    const isExpanded = expandedId === prod.id;

                    return (
                      <tr key={prod.id} className="border-b border-border/15 hover:bg-secondary/10">
                        <td className="px-3 py-2 pl-7 text-foreground/90">{prod.nome}</td>
                        <td className="px-3 py-1.5">
                          {isExpanded ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {prod.parcelas.map((pct, i) => (
                                <input
                                  key={i}
                                  type="number"
                                  min="0"
                                  max="100"
                                  className="w-10 h-6 text-center text-[11px] bg-secondary border border-border rounded outline-none focus:ring-1 focus:ring-primary tabular-nums"
                                  value={pct}
                                  placeholder={`${i + 1}ª`}
                                  onChange={e => {
                                    const next = [...prod.parcelas];
                                    next[i] = Number(e.target.value) || 0;
                                    updateProduto(prod.id, { parcelas: next });
                                  }}
                                />
                              ))}
                              <button onClick={() => updateProduto(prod.id, { parcelas: [...prod.parcelas, 0] })} className="p-0.5 rounded hover:bg-secondary text-muted-foreground" title="Adicionar parcela"><Plus className="h-3 w-3" /></button>
                              {prod.parcelas.length > 1 && <button onClick={() => updateProduto(prod.id, { parcelas: prod.parcelas.slice(0, -1) })} className="p-0.5 rounded hover:bg-secondary text-muted-foreground" title="Remover última"><Minus className="h-3 w-3" /></button>}
                              <span className={`text-[10px] font-semibold ${isValid ? 'text-positive' : 'text-destructive'}`}>{total}%</span>
                              <button onClick={() => setExpandedId(null)} className="text-[10px] text-muted-foreground hover:text-foreground ml-1">fechar</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setExpandedId(prod.id)}
                              className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${isValid ? 'border-border hover:border-primary/40 text-foreground/80' : 'border-destructive/40 text-destructive'}`}
                            >
                              {parcelasLabel(prod.parcelas)}
                            </button>
                          )}
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
                            <div className="flex items-center justify-center gap-0.5">
                              <input
                                type="number" min="0" max="10" step="0.1"
                                className="w-12 h-6 text-center text-[11px] bg-secondary border border-border rounded outline-none focus:ring-1 focus:ring-primary"
                                value={prod.custoAntecipacao}
                                onChange={e => updateProduto(prod.id, { custoAntecipacao: Number(e.target.value) || 0 })}
                              />
                              <span className="text-[10px] text-muted-foreground">%</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <input
                              type="number" min="0" max="30" step="0.5"
                              className="w-11 h-6 text-center text-[11px] bg-secondary border border-border rounded outline-none focus:ring-1 focus:ring-primary"
                              value={prod.inadimplencia}
                              onChange={e => updateProduto(prod.id, { inadimplencia: Number(e.target.value) || 0 })}
                            />
                            <span className="text-[10px] text-muted-foreground">%</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center font-semibold text-[11px] tabular-nums">
                          {calcPMRDias(prod.parcelas)}d
                        </td>
                      </tr>
                    );
                  })}
                </>
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
            allValid ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground cursor-not-allowed'
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
        {!allValid && <span className="text-[10px] text-destructive">Todas as parcelas devem somar 100%</span>}
        {hasChanges && allValid && <span className="text-[10px] text-amber-400">Alterações não salvas</span>}
      </div>
    </div>
  );
}
