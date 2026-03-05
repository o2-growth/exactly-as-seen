import { useState } from 'react';
import { useVersionHistory, VersionSnapshot } from '@/contexts/VersionHistoryContext';
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { Clock, RotateCcw, ChevronRight, ArrowLeftRight } from 'lucide-react';

export default function VersionHistory() {
  const { versions, previewVersion, previewVersionById, restoreVersion, getDiff } = useVersionHistory();
  const { setAssumptions } = useFinancialModel();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [diffPair, setDiffPair] = useState<[string, string] | null>(null);

  const selected = versions.find(v => v.id === selectedId);
  const prevVersion = selected ? versions[versions.indexOf(selected) - 1] : null;

  const handleRestore = (id: string) => {
    const restored = restoreVersion(id);
    setAssumptions(restored);
    previewVersionById(null);
  };

  const diffs = diffPair
    ? getDiff(
        versions.find(v => v.id === diffPair[0])!,
        versions.find(v => v.id === diffPair[1])!
      )
    : selected && prevVersion
      ? getDiff(prevVersion, selected)
      : [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Clock className="h-6 w-6 text-primary" />
        Histórico de Versões
      </h2>

      {previewVersion && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-warning">
            Visualizando v{previewVersion.version} (somente leitura)
          </p>
          <button
            onClick={() => previewVersionById(null)}
            className="text-xs font-medium text-warning hover:underline"
          >
            Voltar ao atual
          </button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Version List */}
        <div className="lg:col-span-1 space-y-2">
          {[...versions].reverse().map((v, i) => (
            <button
              key={v.id}
              onClick={() => { setSelectedId(v.id); setDiffPair(null); }}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                selectedId === v.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold">v{v.version}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">{v.note}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {new Date(v.timestamp).toLocaleString('pt-BR')}
              </p>
              {i === 0 && (
                <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 bg-primary/20 text-primary rounded">
                  ATUAL
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="gradient-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">v{selected.version}</h3>
                  <p className="text-xs text-muted-foreground">
                    {new Date(selected.timestamp).toLocaleString('pt-BR')} · Cenário: {selected.scenario}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => previewVersionById(selected.id)}
                    className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => handleRestore(selected.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restaurar
                  </button>
                </div>
              </div>

              <div className="bg-secondary/30 rounded-lg p-3">
                <p className="text-sm">{selected.note}</p>
              </div>

              {/* Diff Table */}
              {diffs.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Alterações vs versão anterior
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-2 text-muted-foreground">Campo</th>
                          <th className="text-right p-2 text-muted-foreground">Anterior</th>
                          <th className="text-right p-2 text-muted-foreground">Novo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diffs.map((d, i) => (
                          <tr key={i} className="border-b border-border/30">
                            <td className="p-2 font-medium">{d.field}</td>
                            <td className="text-right p-2 text-negative tabular-nums">{String(d.oldValue)}</td>
                            <td className="text-right p-2 text-positive tabular-nums">{String(d.newValue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  {prevVersion ? 'Sem alterações em relação à versão anterior.' : 'Versão base do modelo.'}
                </p>
              )}
            </div>
          ) : (
            <div className="gradient-card p-8 text-center text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Selecione uma versão para ver detalhes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
