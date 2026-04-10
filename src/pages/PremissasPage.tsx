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
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { getSubProductTaxRate, type TicketKey, type SubProductTaxConfig, computeMixPresumido, TAX_PROFILES, TAX_PROFILE_KEYS, applyTaxProfile, getEffectivePresumido } from '@/lib/financialData';

const STORAGE_KEY = 'o2-premissas-overrides-v1';

// Mapping: TAX_PREMISES key → TicketKey (engine)
const PREMISE_TO_TICKET: Record<string, TicketKey> = {
  'CaaS/Serviços Especializados': 'caasAssessoria',
  'CaaS/Enterprise': 'caasEnterprise',
  'CaaS/Corporate': 'caasCorporate',
  'CaaS/Parceiros': 'caasParceiros',
  'CaaS/BPO Financeiro': 'caasSetup',
  'SaaS/Oxy': 'saasOxy',
  'SaaS/Oxy + Gênio': 'saasOxyGenio',
  'SaaS/Setup': 'saasSetup',
  'SaaS/Parceiros': 'saasParceiros',
  'SaaS/Oxy + Gênio + Especialista': 'saasOxyGenioEsp',
  'Education/Dono CFO': 'educationDonoCFO',
  'Education/Engenheiro de Negócios': 'educationEN',
  'Education/Financeiro Raiz': 'educationFR',
  'Education/Finance Sales Program': 'educationFSP',
  'Expansão/Oxy Hacker - Micro Franqueado': 'baas',
  'Expansão/Franquia': 'baasFranquia',
  'Expansão/Master Franquia': 'baasMasterFranquia',
  'Tax/Assessoria Tributária': 'taxAT',
  'Tax/Gestão Passivo Tributário': 'taxGPT',
  'Tax/Recuperação Crédito Tributário': 'taxRCT',
  'Tax/Reforma Tributária': 'taxRT',
  'Tax/Diagnóstico Tributário & Compliance': 'taxDTC',
};

const CATEGORIAS: Categoria[] = ['CaaS', 'SaaS', 'Education', 'Expansão', 'Tax', 'PT'];

const CAT_COLORS: Record<Categoria, { bg: string; text: string }> = {
  CaaS:      { bg: '#E8FBE8', text: '#2E7D32' },
  SaaS:      { bg: '#FFF9E6', text: '#9A6B00' },
  Education: { bg: '#E6F3FF', text: '#1565C0' },
  Expansão:  { bg: '#FFE6E6', text: '#C62828' },
  Tax:       { bg: '#F0E6FF', text: '#6A1B9A' },
  PT:        { bg: '#FFF3E0', text: '#E65100' },
};

// ============================================================
// TIPOS DE OVERRIDE
// ============================================================

type EditableField = 'pis' | 'cofins' | 'iss' | 'icms' | 'presumidoIRPJ' | 'presumidoCSLL' | 'mixServicoPct' | 'perfilTributario';
type PremiseOverride = Partial<Record<EditableField, number | string>>;
type AllOverrides = Record<string, PremiseOverride>;

// ============================================================
// HOOK — useEditablePremises
// ============================================================

export function useEditablePremises() {
  const { assumptions, setAssumptions } = useFinancialModel();

  // Convert SubProductTaxConfig values to TAX_PREMISES-style overrides
  // TAX_PREMISES uses decimals (0.0065 for PIS), SubProductTaxConfig uses percentage (0.65 for PIS)
  // presumidoIRPJ/CSLL: TAX_PREMISES uses 0.32, SubProductTaxConfig uses 32

  const updateField = useCallback(
    (chave: string, field: EditableField, valor: number) => {
      const ticketKey = PREMISE_TO_TICKET[chave];
      if (!ticketKey) return;

      // Convert from TAX_PREMISES decimal format to SubProductTaxConfig percentage format
      let engineValue: number;
      if (field === 'presumidoIRPJ' || field === 'presumidoCSLL') {
        // TAX_PREMISES stores 0.32, engine config stores 32
        engineValue = valor * 100;
      } else if (field === 'mixServicoPct') {
        // mixServicoPct: TAX_PREMISES passes 0-1 range, engine stores 0-100
        engineValue = valor * 100;
      } else {
        // TAX_PREMISES stores 0.0065, engine config stores 0.65
        engineValue = valor * 100;
      }

      const current = getSubProductTaxRate(ticketKey, assumptions);
      const updated: SubProductTaxConfig = { ...current, [field]: engineValue };
      setAssumptions(prev => ({
        ...prev,
        subProductTaxRates: { ...(prev.subProductTaxRates ?? {}), [ticketKey]: updated },
      }));
    },
    [assumptions, setAssumptions]
  );

  const resetField = useCallback((chave: string, field: EditableField) => {
    const ticketKey = PREMISE_TO_TICKET[chave];
    if (!ticketKey) return;

    // Remove override by deleting the field from the stored config
    const current = assumptions.subProductTaxRates?.[ticketKey];
    if (!current) return;
    const updated = { ...current };
    delete (updated as any)[field];
    const rates = { ...(assumptions.subProductTaxRates ?? {}) };
    if (Object.keys(updated).length === 0) {
      delete rates[ticketKey];
    } else {
      rates[ticketKey] = updated;
    }
    setAssumptions(prev => ({ ...prev, subProductTaxRates: rates }));
  }, [assumptions, setAssumptions]);

  const resetAll = useCallback(() => {
    setAssumptions(prev => {
      const { subProductTaxRates: _, ...rest } = prev;
      return rest as typeof prev;
    });
  }, [setAssumptions]);

  const getMerged = useCallback(
    (chave: string): TaxPremise | null => {
      const base = TAX_PREMISES[chave];
      if (!base) return null;
      const ticketKey = PREMISE_TO_TICKET[chave];
      if (!ticketKey) return base;

      const cfg = getSubProductTaxRate(ticketKey, assumptions);
      // Convert engine config back to TAX_PREMISES decimal format
      const merged: TaxPremise = {
        ...base,
        pis: cfg.pis / 100,           // 0.65 → 0.0065
        cofins: cfg.cofins / 100,     // 3.0 → 0.03
        iss: cfg.iss / 100,           // 5.0 → 0.05
        icms: cfg.icms / 100,         // 0 → 0
        presumidoIRPJ: cfg.presumidoIRPJ / 100,  // 32 → 0.32
        presumidoCSLL: cfg.presumidoCSLL / 100,   // 32 → 0.32
        irpjEfetivo: 0, csllEfetivo: 0, totalEfetivo: 0,
      };
      merged.irpjEfetivo = merged.presumidoIRPJ * TAX_CONSTANTS.IRPJ_BASE;
      merged.csllEfetivo = merged.presumidoCSLL * TAX_CONSTANTS.CSLL_BASE;
      merged.totalEfetivo =
        merged.pis + merged.cofins + merged.iss + merged.icms +
        merged.irpjEfetivo + merged.csllEfetivo;
      return merged;
    },
    [assumptions]
  );

  const isFieldOverridden = useCallback(
    (chave: string, field: EditableField): boolean => {
      const ticketKey = PREMISE_TO_TICKET[chave];
      if (!ticketKey) return false;
      return assumptions.subProductTaxRates?.[ticketKey]?.[field as keyof SubProductTaxConfig] !== undefined;
    },
    [assumptions]
  );

  const totalOverrides = useMemo(() => {
    const rates = assumptions.subProductTaxRates;
    if (!rates) return 0;
    return Object.values(rates).reduce((s, cfg) => s + Object.keys(cfg).length, 0);
  }, [assumptions.subProductTaxRates]);

  return {
    overrides: assumptions.subProductTaxRates ?? {},
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
  const { assumptions, setAssumptions } = useFinancialModel();
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
          campo. <br/><br/>
          <b>📋 Perfil Tributário:</b> Use o dropdown para selecionar um perfil pré-definido (Serviço, E-book,
          Livro Físico, Mat. Didático, etc.). Ao selecionar um perfil, as alíquotas PIS/COFINS/ISS/ICMS e bases
          presumidas são preenchidas automaticamente e ficam travadas. Use <b>Custom</b> para editar manualmente.
          <b>⚖ Mix Serv/Prod:</b> permite definir % serviço vs produto com base ponderada.
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
                    <th style={{ ...thNum, background: '#FF9800', color: '#FFFFFF', minWidth: 130 }}>📋 Perfil Tributário</th>
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
                    const ticketKey = PREMISE_TO_TICKET[chave];
                    const cfg = ticketKey ? getSubProductTaxRate(ticketKey, assumptions) : null;
                    const eff = cfg ? getEffectivePresumido(cfg) : { irpj: p.presumidoIRPJ * 100, csll: p.presumidoCSLL * 100 };
                    const displayPresIRPJ = eff.irpj / 100;
                    const displayPresCSLL = eff.csll / 100;
                    const displayIrpjEfetivo = eff.irpj / 100 * 0.15;
                    const displayCsllEfetivo = eff.csll / 100 * 0.09;
                    const currentPis = cfg ? cfg.pis / 100 : p.pis;
                    const currentCofins = cfg ? cfg.cofins / 100 : p.cofins;
                    const currentIss = cfg ? cfg.iss / 100 : p.iss;
                    const currentIcms = cfg ? cfg.icms / 100 : p.icms;
                    const displayTotal = currentPis + currentCofins + currentIss + currentIcms + displayIrpjEfetivo + displayCsllEfetivo;
                    const currentProfile = cfg?.perfilTributario || '';
                    const isProfileLocked = currentProfile && currentProfile !== 'custom' && currentProfile !== 'mix';
                    return (
                      <tr key={chave} style={{
                        background: i % 2 === 0 ? '#FFFFFF' : '#F9F9F9',
                        borderBottom: '1px solid #F2F2F2',
                      }}>
                        <td style={{ ...td, fontWeight: 700 }}>{p.subcategoria}</td>
                        <td style={{ ...td, color: '#787878', fontSize: 10 }}>{p.perfilAplicado}</td>
                        {/* Profile dropdown column */}
                        <ProfileDropdownCell
                          chave={chave}
                          currentProfile={currentProfile}
                          mixValue={cfg?.mixServicoPct}
                          onSelectProfile={(chave, profileKey) => {
                            if (!ticketKey) return;
                            const current = getSubProductTaxRate(ticketKey, assumptions);
                            const updated = applyTaxProfile(current, profileKey);
                            setAssumptions(prev => ({
                              ...prev,
                              subProductTaxRates: { ...(prev.subProductTaxRates ?? {}), [ticketKey]: updated },
                            }));
                          }}
                          onUpdateMix={(chave, val) => {
                            if (!ticketKey) return;
                            const current = getSubProductTaxRate(ticketKey, assumptions);
                            const mix = computeMixPresumido(val);
                            setAssumptions(prev => ({
                              ...prev,
                              subProductTaxRates: {
                                ...(prev.subProductTaxRates ?? {}),
                                [ticketKey]: { ...current, mixServicoPct: val, presumidoIRPJ: mix.irpj, presumidoCSLL: mix.csll, perfilTributario: 'mix' },
                              },
                            }));
                          }}
                        />
                        <EditableCell chave={chave} field="pis" valor={p.pis}
                          modificado={isFieldOverridden(chave, 'pis')}
                          onUpdate={updateField} onReset={resetField} locked={!!isProfileLocked} />
                        <EditableCell chave={chave} field="cofins" valor={p.cofins}
                          modificado={isFieldOverridden(chave, 'cofins')}
                          onUpdate={updateField} onReset={resetField} locked={!!isProfileLocked} />
                        <EditableCell chave={chave} field="iss" valor={p.iss}
                          modificado={isFieldOverridden(chave, 'iss')}
                          onUpdate={updateField} onReset={resetField} locked={!!isProfileLocked} />
                        <EditableCell chave={chave} field="icms" valor={p.icms}
                          modificado={isFieldOverridden(chave, 'icms')}
                          onUpdate={updateField} onReset={resetField} locked={!!isProfileLocked} />
                        <td style={{ ...tdNum, fontWeight: currentProfile === 'mix' ? 700 : 400, color: currentProfile === 'mix' ? '#FF6F00' : '#494949' }}>
                          {fmtPct(displayPresIRPJ)} {currentProfile === 'mix' && <span style={{ fontSize: 8, color: '#FF6F00' }}>mix</span>}
                        </td>
                        <td style={{ ...tdNum, fontWeight: currentProfile === 'mix' ? 700 : 400, color: currentProfile === 'mix' ? '#FF6F00' : '#494949' }}>
                          {fmtPct(displayPresCSLL)} {currentProfile === 'mix' && <span style={{ fontSize: 8, color: '#FF6F00' }}>mix</span>}
                        </td>
                        <td style={tdNumCalc}>{fmtPct(displayIrpjEfetivo)}</td>
                        <td style={tdNumCalc}>{fmtPct(displayCsllEfetivo)}</td>
                        <td style={{
                          ...tdNum, background: '#E8FBE8', fontWeight: 800,
                          color: '#2E7D32', fontSize: 12,
                        }}>
                          {fmtPct(displayTotal)}
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
  locked?: boolean;
}

function EditableCell({
  chave, field, valor, modificado, onUpdate, onReset, digits = 2, locked = false,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  if (locked) {
    return (
      <td style={{ ...tdNum, background: '#F5F5F5', color: '#999' }}>
        {(valor * 100).toFixed(digits).replace('.', ',')}%
      </td>
    );
  }

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
// DROPDOWN DE PERFIL TRIBUTÁRIO
// ============================================================

interface ProfileDropdownCellProps {
  chave: string;
  currentProfile: string;
  mixValue: number | undefined;
  onSelectProfile: (chave: string, profileKey: string) => void;
  onUpdateMix: (chave: string, val: number) => void;
}

function ProfileDropdownCell({ chave, currentProfile, mixValue, onSelectProfile, onUpdateMix }: ProfileDropdownCellProps) {
  const [editingMix, setEditingMix] = useState(false);
  const [mixInput, setMixInput] = useState('');
  const isMix = currentProfile === 'mix';
  const profileLabel = currentProfile ? (TAX_PROFILES[currentProfile]?.label || currentProfile) : '—';

  const handleMixCommit = () => {
    const v = parseFloat(mixInput.replace(',', '.'));
    if (!isNaN(v) && v >= 0 && v <= 100) {
      onUpdateMix(chave, v);
    }
    setEditingMix(false);
  };

  return (
    <td style={{
      ...tdNum,
      background: currentProfile ? '#FFF3E0' : '#FFF9E6',
      border: currentProfile ? '2px solid #FF9800' : '1px solid #E0C800',
      padding: '4px 4px',
      minWidth: 130,
    }}>
      <select
        value={currentProfile || ''}
        onChange={e => onSelectProfile(chave, e.target.value)}
        style={{
          width: '100%', fontSize: 10, fontWeight: 700, fontFamily: 'Montserrat, sans-serif',
          border: '1px solid #CCC', borderRadius: 3, padding: '2px 4px',
          background: '#FFFFFF', color: '#494949', cursor: 'pointer',
        }}
      >
        <option value="">— Padrão —</option>
        {TAX_PROFILE_KEYS.map(k => (
          <option key={k} value={k} title={TAX_PROFILES[k].description}>
            {TAX_PROFILES[k].label}
          </option>
        ))}
      </select>
      {isMix && (
        <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          {editingMix ? (
            <input
              type="text"
              value={mixInput}
              onChange={e => setMixInput(e.target.value)}
              onBlur={handleMixCommit}
              onKeyDown={e => { if (e.key === 'Enter') handleMixCommit(); if (e.key === 'Escape') setEditingMix(false); }}
              autoFocus
              placeholder="% serviço"
              style={{
                width: 60, fontSize: 10, fontWeight: 700, textAlign: 'center',
                border: '2px solid #FF9800', borderRadius: 2, padding: '1px 2px',
                background: '#FFF', color: '#494949', outline: 'none',
              }}
            />
          ) : (
            <span
              onClick={() => { setMixInput(String(mixValue ?? 50)); setEditingMix(true); }}
              style={{ fontSize: 10, fontWeight: 700, color: '#E65100', cursor: 'pointer' }}
              title="Clique para editar % serviço"
            >
              {mixValue ?? 50}% serv / {100 - (mixValue ?? 50)}% prod
            </span>
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
