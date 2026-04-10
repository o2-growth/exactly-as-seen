// src/pages/PremissasPage.tsx
//
// ABA "PREMISSAS" v2 — EDITÁVEL com persistência localStorage
//
// Diferenças vs v1:
//   - Cada alíquota (PIS, COFINS, ISS, ICMS, % Pres. IRPJ/CSLL) é editável inline
//   - Mudanças persistem em localStorage (chave: "o2-premissas-overrides-v1")
//   - Botão "Resetar para padrão" volta tudo aos valores do taxPremises.tsx
//   - Botão "Exportar JSON" gera backup das premissas atuais
//   - Indicador visual de "modificado" em células alteradas vs padrão
//   - IRPJ efetivo, CSLL efetivo e Total efetivo recalculam em tempo real
//
// IMPORTANTE — duas camadas de fonte da verdade:
//   1. taxPremises.tsx        = padrão (defaults imutáveis no código)
//   2. localStorage overrides = customizações do usuário (podem ser resetadas)
//
// O hook useEditablePremises mescla as duas. Outras partes do app que precisem
// das premissas editadas podem importar e usar o hook diretamente.
//
// Drop-in: importe e adicione como rota/aba no seu app Lovable.
//   import PremissasPage from '@/pages/PremissasPage';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  TAX_PREMISES,
  PREMISES_LIST,
  TAX_CONSTANTS,
  AD_IRPJ_NOTE,
  TaxPremise,
  Categoria,
} from '@/data/taxPremises';

const STORAGE_KEY = 'o2-premissas-overrides-v1';

const CATEGORIAS: Categoria[] = ['CaaS', 'SaaS', 'Education', 'Expansão', 'Tax'];

const CAT_COLORS: Record<Categoria, { bg: string; text: string }> = {
  CaaS:      { bg: '#E8FBE8', text: '#2E7D32' },
  SaaS:      { bg: '#FFF9E6', text: '#9A6B00' },
  Education: { bg: '#E6F3FF', text: '#1565C0' },
  Expansão:  { bg: '#FFE6E6', text: '#C62828' },
  Tax:       { bg: '#F0E6FF', text: '#6A1B9A' },
};

// ============================================================
// TIPOS DE OVERRIDE
// ============================================================

type EditableField = 'pis' | 'cofins' | 'iss' | 'icms' | 'presumidoIRPJ' | 'presumidoCSLL';
type PremiseOverride = Partial<Record<EditableField, number>>;
type AllOverrides = Record<string, PremiseOverride>;

// ============================================================
// HOOK — useEditablePremises
// ============================================================

export function useEditablePremises() {
  const [overrides, setOverrides] = useState<AllOverrides>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOverrides(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch { /* ignore */ }
  }, [overrides]);

  const updateField = useCallback(
    (chave: string, field: EditableField, valor: number) => {
      setOverrides((prev) => ({
        ...prev,
        [chave]: { ...prev[chave], [field]: valor },
      }));
    },
    []
  );

  const resetField = useCallback((chave: string, field: EditableField) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (next[chave]) {
        const { [field]: _, ...rest } = next[chave];
        if (Object.keys(rest).length === 0) delete next[chave];
        else next[chave] = rest;
      }
      return next;
    });
  }, []);

  const resetAll = useCallback(() => setOverrides({}), []);

  const getMerged = useCallback(
    (chave: string): TaxPremise | null => {
      const base = TAX_PREMISES[chave];
      if (!base) return null;
      const ov = overrides[chave];
      if (!ov || Object.keys(ov).length === 0) return base;

      const merged: TaxPremise = {
        ...base,
        pis: ov.pis ?? base.pis,
        cofins: ov.cofins ?? base.cofins,
        iss: ov.iss ?? base.iss,
        icms: ov.icms ?? base.icms,
        presumidoIRPJ: ov.presumidoIRPJ ?? base.presumidoIRPJ,
        presumidoCSLL: ov.presumidoCSLL ?? base.presumidoCSLL,
        irpjEfetivo: 0, csllEfetivo: 0, totalEfetivo: 0,
      };
      merged.irpjEfetivo = merged.presumidoIRPJ * TAX_CONSTANTS.IRPJ_BASE;
      merged.csllEfetivo = merged.presumidoCSLL * TAX_CONSTANTS.CSLL_BASE;
      merged.totalEfetivo =
        merged.pis + merged.cofins + merged.iss + merged.icms +
        merged.irpjEfetivo + merged.csllEfetivo;
      return merged;
    },
    [overrides]
  );

  const isFieldOverridden = useCallback(
    (chave: string, field: EditableField): boolean =>
      overrides[chave]?.[field] !== undefined,
    [overrides]
  );

  const totalOverrides = useMemo(
    () => Object.values(overrides).reduce((s, ov) => s + Object.keys(ov).length, 0),
    [overrides]
  );

  return {
    overrides,
    updateField,
    resetField,
    resetAll,
    getMerged,
    isFieldOverridden,
    totalOverrides,
  };
}

// ============================================================
// HELPERS
// ============================================================

function fmtPct(value: number, digits = 2): string {
  return (value * 100).toFixed(digits) + '%';
}

function fmtBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value);
}

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================

export default function PremissasPage() {
  const {
    overrides,
    updateField,
    resetField,
    resetAll,
    getMerged,
    isFieldOverridden,
    totalOverrides,
  } = useEditablePremises();

  const [filtroCategoria, setFiltroCategoria] = useState<Categoria | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');

  const premissasMescladas = useMemo(() => {
    return PREMISES_LIST.map((p) => {
      const chave = `${p.categoria}/${p.subcategoria}`;
      return getMerged(chave) || p;
    });
  }, [getMerged]);

  const premissasFiltradas = useMemo(() => {
    return premissasMescladas.filter((p) => {
      if (filtroCategoria !== 'TODAS' && p.categoria !== filtroCategoria) return false;
      if (busca && !p.subcategoria.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [premissasMescladas, filtroCategoria, busca]);

  const grupos = useMemo(() => {
    const map = new Map<Categoria, TaxPremise[]>();
    for (const p of premissasFiltradas) {
      if (!map.has(p.categoria)) map.set(p.categoria, []);
      map.get(p.categoria)!.push(p);
    }
    return map;
  }, [premissasFiltradas]);

  const handleReset = () => {
    if (totalOverrides === 0) {
      alert('Não há customizações para resetar.');
      return;
    }
    if (window.confirm(
      `Você tem ${totalOverrides} customização${totalOverrides > 1 ? 'ões' : ''}. Resetar tudo para o padrão? Essa ação não pode ser desfeita.`
    )) {
      resetAll();
    }
  };

  const handleExport = () => {
    const data = {
      exportadoEm: new Date().toISOString(),
      constantesGlobais: TAX_CONSTANTS,
      overrides,
      premissasFinais: PREMISES_LIST.map((p) => {
        const chave = `${p.categoria}/${p.subcategoria}`;
        return getMerged(chave);
      }),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `premissas-o2-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#F8F8F8',
      fontFamily: 'Montserrat, sans-serif', color: '#494949', padding: 20,
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* HEADER */}
        <header style={{
          marginBottom: 20, display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-start', flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, color: '#494949', letterSpacing: '-0.5px' }}>
              Premissas Tributárias
            </h1>
            <p style={{ fontSize: 13, color: '#787878', margin: '4px 0 0 0' }}>
              O2 Inc. — Lucro Presumido | Edite as alíquotas clicando nas células amarelas
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {totalOverrides > 0 && (
              <span style={{
                padding: '6px 12px', background: '#FFF9E6', border: '1px solid #FFEB3B',
                borderRadius: 6, fontSize: 11, fontWeight: 700, color: '#494949',
              }}>
                ⚠ {totalOverrides} customização{totalOverrides > 1 ? 'ões' : ''}
              </span>
            )}
            <button onClick={handleExport} style={btnSecondary}>📥 Exportar JSON</button>
            <button onClick={handleReset} style={{
              ...btnSecondary,
              borderColor: totalOverrides > 0 ? '#C62828' : '#CCCCCC',
              color: totalOverrides > 0 ? '#C62828' : '#787878',
            }}>
              ↺ Resetar Padrão
            </button>
          </div>
        </header>

        {/* CONSTANTES GLOBAIS */}
        <section style={{
          background: '#FFFFFF', border: '2px solid #6BF169', borderRadius: 8,
          padding: 16, marginBottom: 20,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5,
            color: '#494949', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid #E8FBE8',
          }}>
            ⚙ Constantes Globais (Lucro Presumido) — não editáveis
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <Constante label="IRPJ alíq. base" value={fmtPct(TAX_CONSTANTS.IRPJ_BASE)} />
            <Constante label="CSLL alíq. base" value={fmtPct(TAX_CONSTANTS.CSLL_BASE)} />
            <Constante label="AD.IRPJ alíq." value={fmtPct(TAX_CONSTANTS.ADIC_RATE)} />
            <Constante label="Limite mensal AD" value={fmtBRL(TAX_CONSTANTS.ADIC_LIMIT_MENSAL)} />
            <Constante label="Meses no ano" value={String(TAX_CONSTANTS.MESES)} />
          </div>
        </section>

        {/* AVISO AD.IRPJ */}
        <section style={{
          background: '#FFF9E6', border: '1px solid #FFEB3B', borderRadius: 8,
          padding: 12, marginBottom: 20, fontSize: 11, color: '#494949', lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>⚠ Regra do Adicional de IRPJ — Global Mensal</div>
          {AD_IRPJ_NOTE}
        </section>

        {/* INSTRUÇÕES */}
        <section style={{
          background: '#E8FBE8', border: '1px solid #6BF169', borderRadius: 8,
          padding: 12, marginBottom: 20, fontSize: 11, color: '#494949', lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>💡 Como editar</div>
          Clique em qualquer célula <b>amarela</b> de alíquota para editar. Digite valores em
          <b> percentual</b> (ex: <code>0,65</code> para 0,65%). Células com <b>borda laranja</b>
          indicam valor customizado vs padrão. Use <b>↺</b> ao lado da célula para reverter aquele
          campo. Tudo é salvo automaticamente no navegador.
        </section>

        {/* FILTROS */}
        <section style={{
          display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap',
        }}>
          <div>
            <label style={labelStyle}>Filtro por categoria</label>
            <div style={{ display: 'flex', gap: 4 }}>
              <FilterButton ativo={filtroCategoria === 'TODAS'} onClick={() => setFiltroCategoria('TODAS')}>
                Todas
              </FilterButton>
              {CATEGORIAS.map((cat) => (
                <FilterButton
                  key={cat}
                  ativo={filtroCategoria === cat}
                  onClick={() => setFiltroCategoria(cat)}
                  bgColor={CAT_COLORS[cat].bg}
                  textColor={CAT_COLORS[cat].text}
                >
                  {cat}
                </FilterButton>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Buscar subcategoria</label>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="ex: BPO, Dono CFO, Franquia..."
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid #CCCCCC',
                borderRadius: 6, fontSize: 12, fontFamily: 'Montserrat, sans-serif',
                color: '#494949', outline: 'none',
              }}
            />
          </div>

          <div style={{ fontSize: 11, color: '#787878' }}>
            <b>{premissasFiltradas.length}</b> de <b>{PREMISES_LIST.length}</b> subcategorias
          </div>
        </section>

        {/* TABELAS POR CATEGORIA */}
        {Array.from(grupos.entries()).map(([cat, lista]) => (
          <section key={cat} style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              padding: '8px 12px', background: CAT_COLORS[cat].bg, borderRadius: 6,
              borderLeft: `4px solid ${CAT_COLORS[cat].text}`,
            }}>
              <h2 style={{
                fontSize: 16, fontWeight: 900, color: CAT_COLORS[cat].text, margin: 0,
                textTransform: 'uppercase', letterSpacing: 0.3,
              }}>
                {cat}
              </h2>
              <span style={{ fontSize: 11, color: '#787878' }}>
                · {lista.length} subcategoria{lista.length > 1 ? 's' : ''}
              </span>
            </div>

            <div style={{
              background: '#FFFFFF', border: '1px solid #CCCCCC', borderRadius: 8,
              overflowX: 'auto',
            }}>
              <table style={{
                width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 1100,
              }}>
                <thead>
                  <tr style={{ background: '#494949', color: '#FFFFFF' }}>
                    <th style={{ ...th, minWidth: 200 }}>Subcategoria</th>
                    <th style={th}>Perfil</th>
                    <th style={thNum}>PIS</th>
                    <th style={thNum}>COFINS</th>
                    <th style={thNum}>ISS</th>
                    <th style={thNum}>ICMS</th>
                    <th style={thNum}>Pres. IRPJ</th>
                    <th style={thNum}>Pres. CSLL</th>
                    <th style={thNum}>IRPJ efet.</th>
                    <th style={thNum}>CSLL efet.</th>
                    <th style={{ ...thNum, background: '#6BF169', color: '#494949' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p, i) => {
                    const chave = `${p.categoria}/${p.subcategoria}`;
                    return (
                      <tr key={chave} style={{
                        background: i % 2 === 0 ? '#FFFFFF' : '#F9F9F9',
                        borderBottom: '1px solid #F2F2F2',
                      }}>
                        <td style={{ ...td, fontWeight: 700 }}>{p.subcategoria}</td>
                        <td style={{ ...td, color: '#787878', fontSize: 10 }}>{p.perfilAplicado}</td>
                        <EditableCell chave={chave} field="pis" valor={p.pis}
                          modificado={isFieldOverridden(chave, 'pis')}
                          onUpdate={updateField} onReset={resetField} />
                        <EditableCell chave={chave} field="cofins" valor={p.cofins}
                          modificado={isFieldOverridden(chave, 'cofins')}
                          onUpdate={updateField} onReset={resetField} />
                        <EditableCell chave={chave} field="iss" valor={p.iss}
                          modificado={isFieldOverridden(chave, 'iss')}
                          onUpdate={updateField} onReset={resetField} />
                        <EditableCell chave={chave} field="icms" valor={p.icms}
                          modificado={isFieldOverridden(chave, 'icms')}
                          onUpdate={updateField} onReset={resetField} />
                        <EditableCell chave={chave} field="presumidoIRPJ" valor={p.presumidoIRPJ}
                          modificado={isFieldOverridden(chave, 'presumidoIRPJ')}
                          onUpdate={updateField} onReset={resetField} digits={0} />
                        <EditableCell chave={chave} field="presumidoCSLL" valor={p.presumidoCSLL}
                          modificado={isFieldOverridden(chave, 'presumidoCSLL')}
                          onUpdate={updateField} onReset={resetField} digits={0} />
                        <td style={tdNumCalc}>{fmtPct(p.irpjEfetivo)}</td>
                        <td style={tdNumCalc}>{fmtPct(p.csllEfetivo)}</td>
                        <td style={{
                          ...tdNum, background: '#E8FBE8', fontWeight: 800,
                          color: '#2E7D32', fontSize: 12,
                        }}>
                          {fmtPct(p.totalEfetivo)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {/* FÓRMULAS */}
        <section style={{
          background: '#FFFFFF', border: '1px solid #CCCCCC', borderRadius: 8,
          padding: 16, marginTop: 20,
        }}>
          <h3 style={{
            fontSize: 13, fontWeight: 800, margin: '0 0 12px 0', color: '#494949',
            textTransform: 'uppercase', letterSpacing: 0.3,
          }}>
            📐 Fórmulas Detalhadas por Subcategoria
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {premissasFiltradas.map((p) => (
              <div key={`f-${p.categoria}/${p.subcategoria}`} style={{
                padding: 8, background: '#F9F9F9', borderRadius: 4,
                borderLeft: `3px solid ${CAT_COLORS[p.categoria].text}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#494949', marginBottom: 2 }}>
                  {p.categoria} · {p.subcategoria}
                </div>
                <code style={{
                  display: 'block', fontSize: 10, fontFamily: 'monospace', color: '#494949',
                  background: '#FFFFFF', padding: '4px 8px', borderRadius: 3, marginTop: 4,
                }}>
                  {p.formula}
                </code>
                <div style={{ fontSize: 9, color: '#787878', marginTop: 4 }}>
                  <b>Base legal:</b> {p.baseLegal}
                </div>
              </div>
            ))}
          </div>
        </section>

        <footer style={{
          marginTop: 24, paddingTop: 16, borderTop: '1px solid #CCCCCC',
          fontSize: 10, color: '#787878', textAlign: 'center',
        }}>
          O2 Inc. — Premissas Tributárias | Customizações salvas em{' '}
          <code style={{ background: '#F2F2F2', padding: '1px 4px', borderRadius: 2 }}>
            localStorage["{STORAGE_KEY}"]
          </code>
        </footer>
      </div>
    </div>
  );
}

// ============================================================
// CÉLULA EDITÁVEL
// ============================================================

interface EditableCellProps {
  chave: string;
  field: EditableField;
  valor: number;
  modificado: boolean;
  onUpdate: (chave: string, field: EditableField, valor: number) => void;
  onReset: (chave: string, field: EditableField) => void;
  digits?: number;
}

function EditableCell({
  chave, field, valor, modificado, onUpdate, onReset, digits = 2,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleStartEdit = () => {
    setInputValue((valor * 100).toFixed(digits).replace('.', ','));
    setEditing(true);
  };

  const handleCommit = () => {
    const normalized = inputValue.replace(',', '.').replace('%', '').trim();
    const num = parseFloat(normalized);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      onUpdate(chave, field, num / 100);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCommit();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <td
      style={{
        ...tdNum,
        background: modificado ? '#FFE0B2' : '#FFEB3B',
        cursor: 'text',
        position: 'relative',
        border: modificado ? '2px solid #F57C00' : '1px solid #E0C800',
        padding: '4px 8px',
      }}
      onClick={!editing ? handleStartEdit : undefined}
    >
      {editing ? (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{
            width: '100%', padding: 2, fontSize: 11, fontFamily: 'Montserrat, sans-serif',
            fontWeight: 700, border: '2px solid #6BF169', borderRadius: 2,
            textAlign: 'center', outline: 'none', background: '#FFFFFF', color: '#494949',
          }}
        />
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 4, position: 'relative',
        }}>
          <span style={{ fontWeight: 700, color: '#494949' }}>
            {(valor * 100).toFixed(digits).replace('.', ',')}%
          </span>
          {modificado && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReset(chave, field); }}
              title="Reverter para o padrão"
              style={{
                position: 'absolute', right: -6, top: -10, width: 14, height: 14,
                borderRadius: '50%', border: '1px solid #C62828', background: '#FFFFFF',
                color: '#C62828', fontSize: 9, fontWeight: 700, cursor: 'pointer',
                padding: 0, lineHeight: 1, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              ↺
            </button>
          )}
        </div>
      )}
    </td>
  );
}

// ============================================================
// SUBCOMPONENTES
// ============================================================

function Constante({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '8px 12px', background: '#F2F2F2', borderRadius: 4, textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: '#787878', textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#494949', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function FilterButton({
  ativo, onClick, children, bgColor, textColor,
}: {
  ativo: boolean; onClick: () => void; children: React.ReactNode;
  bgColor?: string; textColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px', fontSize: 11, fontWeight: 700,
        fontFamily: 'Montserrat, sans-serif',
        border: ativo ? `2px solid ${textColor || '#494949'}` : '1px solid #CCCCCC',
        borderRadius: 6,
        background: ativo ? bgColor || '#6BF169' : '#FFFFFF',
        color: ativo ? textColor || '#494949' : '#787878',
        cursor: 'pointer', transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

// ============================================================
// STYLES
// ============================================================

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  color: '#787878', display: 'block', marginBottom: 4,
};

const btnSecondary: React.CSSProperties = {
  padding: '8px 14px', fontSize: 11, fontWeight: 700,
  fontFamily: 'Montserrat, sans-serif', border: '1px solid #CCCCCC',
  borderRadius: 6, background: '#FFFFFF', color: '#494949', cursor: 'pointer',
};

const th: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: 0.3,
};

const thNum: React.CSSProperties = { ...th, textAlign: 'center' };

const td: React.CSSProperties = {
  padding: '8px 12px', fontSize: 11, color: '#494949',
  borderBottom: '1px solid #F2F2F2',
};

const tdNum: React.CSSProperties = {
  ...td, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
};

const tdNumCalc: React.CSSProperties = {
  ...tdNum, background: '#F2F2F2', color: '#787878', fontStyle: 'italic',
};
