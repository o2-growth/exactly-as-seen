// src/data/taxPremises.tsx
//
// ARQUIVO ISOLADO — premissas tributárias auditáveis por subcategoria
// Drop-in: importe <TaxPremiseInfo /> onde quiser exibir o ícone "i" de auditoria.
// Não depende de nada do resto do projeto além de React.
//
// COMO USAR:
//   import { TaxPremiseInfo } from '@/data/taxPremises';
//
//   // Forma 1: chave composta (recomendada — evita ambiguidade)
//   <TaxPremiseInfo chaveCompleta="CaaS/Parceiros" />
//   <TaxPremiseInfo chaveCompleta="SaaS/Parceiros" />
//
//   // Forma 2: subcategoria + categoria
//   <TaxPremiseInfo subcategoria="Parceiros" categoria="CaaS" />
//
//   // Forma 3: subcategoria sozinha (só se for nome único na árvore)
//   <TaxPremiseInfo subcategoria="Serviços Especializados" />
//
// Estrutura validada contra a árvore O2 (print do Lucas):
//   CaaS (5):       Serviços Especializados, Enterprise, Corporate, Parceiros, BPO Financeiro
//   SaaS (5):       Oxy, Oxy + Gênio, Setup, Parceiros, Oxy + Gênio + Especialista
//   Education (4):  Dono CFO, Engenheiro de Negócios, Financeiro Raiz, Finance Sales Program
//   Expansão (3):   Oxy Hacker - Micro Franqueado, Franquia, Master Franquia
//   Tax (5):        Assessoria Tributária, Gestão Passivo Tributário,
//                   Recuperação Crédito Tributário, Reforma Tributária,
//                   Diagnóstico Tributário & Compliance

import React, { useState } from 'react';

export type Categoria = 'CaaS' | 'SaaS' | 'Education' | 'Expansão' | 'Tax' | 'PT';

export interface TaxPremise {
  subcategoria: string;
  categoria: Categoria;
  perfilAplicado: string;
  presumidoIRPJ: number;
  presumidoCSLL: number;
  pis: number;
  cofins: number;
  iss: number;
  icms: number;
  irpjEfetivo: number;
  csllEfetivo: number;
  totalEfetivo: number;
  baseLegal: string;
  observacao: string;
  formula: string;
}

export const TAX_CONSTANTS = {
  IRPJ_BASE: 0.15,
  CSLL_BASE: 0.09,
  ADIC_RATE: 0.10,
  ADIC_LIMIT_MENSAL: 20000,
  MESES: 12,
};

function calc(
  presIRPJ: number, presCSLL: number,
  pis: number, cofins: number, iss: number, icms = 0
) {
  const irpjEf = presIRPJ * TAX_CONSTANTS.IRPJ_BASE;
  const csllEf = presCSLL * TAX_CONSTANTS.CSLL_BASE;
  const totalEf = pis + cofins + iss + icms + irpjEf + csllEf;
  return { irpjEfetivo: irpjEf, csllEfetivo: csllEf, totalEfetivo: totalEf };
}

// ============================================================
// PREMISSAS — chaves "Categoria/Subcategoria"
// ============================================================

export const TAX_PREMISES: Record<string, TaxPremise> = {
  // ========== CaaS (5) ==========
  'CaaS/Serviços Especializados': {
    subcategoria: 'Serviços Especializados', categoria: 'CaaS',
    perfilAplicado: 'CaaS / Tax (serviço normal)',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.05, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.05),
    baseLegal: 'Lei 9.249/1995 art. 15 §1º III; LC 116/2003 (ISS)',
    observacao: 'Prestação de serviços técnicos especializados. Presumido máximo de 32% para IRPJ e CSLL. ISS 5% (alíquota máxima de POA).',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 5%) + (receita × 32% × 15%) + (receita × 32% × 9%)',
  },
  'CaaS/Enterprise': {
    subcategoria: 'Enterprise', categoria: 'CaaS',
    perfilAplicado: 'CaaS / Tax (serviço normal)',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.05, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.05),
    baseLegal: 'Lei 9.249/1995 art. 15 §1º III; LC 116/2003',
    observacao: 'Mesma natureza de serviços técnicos especializados, segmento enterprise.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 5%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'CaaS/Corporate': {
    subcategoria: 'Corporate', categoria: 'CaaS',
    perfilAplicado: 'CaaS / Tax (serviço normal)',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.05, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.05),
    baseLegal: 'Lei 9.249/1995 art. 15 §1º III; LC 116/2003',
    observacao: 'Serviços corporativos. Tratamento tributário igual ao Enterprise.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 5%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'CaaS/Parceiros': {
    subcategoria: 'Parceiros', categoria: 'CaaS',
    perfilAplicado: 'CaaS / Tax (serviço normal)',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.05, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.05),
    baseLegal: 'Lei 9.249/1995 art. 15 §1º III',
    observacao: 'Receita auferida em modelo de parceria comercial. Tributada como serviço.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 5%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'CaaS/BPO Financeiro': {
    subcategoria: 'BPO Financeiro', categoria: 'CaaS',
    perfilAplicado: 'CaaS / Tax (serviço normal)',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.05, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.05),
    baseLegal: 'Lei 9.249/1995 art. 15 §1º III; LC 116/2003 lista 17.19',
    observacao: 'Business Process Outsourcing financeiro. Tributação como serviço administrativo.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 5%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },

  // ========== SaaS (5) ==========
  'SaaS/Oxy': {
    subcategoria: 'Oxy', categoria: 'SaaS',
    perfilAplicado: 'SaaS Tech',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.029, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.029),
    baseLegal: 'SC COSIT 269/2019; ADI RFB 4/2014; LC 116/2003 lista 1.05',
    observacao: 'Software as a Service. ISS especial de 2,9% em Porto Alegre para empresas de tecnologia.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 2,9%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'SaaS/Oxy + Gênio': {
    subcategoria: 'Oxy + Gênio', categoria: 'SaaS',
    perfilAplicado: 'SaaS Tech',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.029, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.029),
    baseLegal: 'SC COSIT 269/2019; ADI RFB 4/2014',
    observacao: 'Combo software + inteligência artificial. Mesma natureza de SaaS Tech.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 2,9%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'SaaS/Setup': {
    subcategoria: 'Setup', categoria: 'SaaS',
    perfilAplicado: 'SaaS Tech',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.029, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.029),
    baseLegal: 'SC COSIT 269/2019; LC 116/2003 lista 1.05',
    observacao: 'Implementação técnica de software. Tributada junto com a licença SaaS.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 2,9%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'SaaS/Parceiros': {
    subcategoria: 'Parceiros', categoria: 'SaaS',
    perfilAplicado: 'SaaS Tech',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.029, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.029),
    baseLegal: 'SC COSIT 269/2019',
    observacao: 'Receita SaaS auferida via canais de parceria. Mesma alíquota efetiva.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 2,9%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'SaaS/Oxy + Gênio + Especialista': {
    subcategoria: 'Oxy + Gênio + Especialista', categoria: 'SaaS',
    perfilAplicado: 'SaaS Tech',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.029, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.029),
    baseLegal: 'SC COSIT 269/2019; ADI RFB 4/2014',
    observacao: 'Pacote completo: software + IA + acompanhamento humano especializado.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 2,9%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },

  // ========== Education (4) ==========
  'Education/Dono CFO': {
    subcategoria: 'Dono CFO', categoria: 'Education',
    perfilAplicado: 'Education (mentoria/curso)',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.02, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.02),
    baseLegal: 'Lei 9.249/1995 art. 15 §1º III; SC COSIT 99/2019',
    observacao: 'Curso/mentoria. ISS 2% em POA para educação. Pode ser otimizada via blend com E-book/Material Didático.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 2%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'Education/Engenheiro de Negócios': {
    subcategoria: 'Engenheiro de Negócios', categoria: 'Education',
    perfilAplicado: 'Education (mentoria/curso)',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.02, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.02),
    baseLegal: 'Lei 9.249/1995 art. 15 §1º III; SC COSIT 99/2019',
    observacao: 'Programa formativo. Mesmo tratamento de Education puro.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 2%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'Education/Financeiro Raiz': {
    subcategoria: 'Financeiro Raiz', categoria: 'Education',
    perfilAplicado: 'Education (mentoria/curso)',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.02, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.02),
    baseLegal: 'Lei 9.249/1995 art. 15 §1º III; SC COSIT 99/2019',
    observacao: 'Curso introdutório. Mesmo perfil Education.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 2%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'Education/Finance Sales Program': {
    subcategoria: 'Finance Sales Program', categoria: 'Education',
    perfilAplicado: 'Education (mentoria/curso)',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.02, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.02),
    baseLegal: 'Lei 9.249/1995 art. 15 §1º III; SC COSIT 99/2019',
    observacao: 'Programa de vendas. Mesma natureza educacional.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 2%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },

  // ========== Expansão (3) ==========
  'Expansão/Oxy Hacker - Micro Franqueado': {
    subcategoria: 'Oxy Hacker - Micro Franqueado', categoria: 'Expansão',
    perfilAplicado: 'Franquia',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.05, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.05),
    baseLegal: 'Lei 13.966/2019 (Lei de Franquia); SC COSIT 84/2018',
    observacao: 'Microfranquia. Tributada como royalties + serviços (32% presumido).',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 5%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'Expansão/Franquia': {
    subcategoria: 'Franquia', categoria: 'Expansão',
    perfilAplicado: 'Franquia',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.05, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.05),
    baseLegal: 'Lei 13.966/2019; SC COSIT 84/2018',
    observacao: 'Contrato de franquia padrão. Atenção: separar royalties e material didático em cláusulas distintas.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 5%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'Expansão/Master Franquia': {
    subcategoria: 'Master Franquia', categoria: 'Expansão',
    perfilAplicado: 'Franquia',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.05, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.05),
    baseLegal: 'Lei 13.966/2019; SC COSIT 84/2018',
    observacao: 'Master franqueador. Mesmo perfil tributário, valores nominais maiores.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 5%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },

  // ========== Tax (5) ==========
  'Tax/Assessoria Tributária': {
    subcategoria: 'Assessoria Tributária', categoria: 'Tax',
    perfilAplicado: 'CaaS / Tax (serviço normal)',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.05, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.05),
    baseLegal: 'Lei 9.249/1995 art. 15 §1º III; LC 116/2003 lista 17.19',
    observacao: 'Consultoria tributária recorrente. Tributada como serviço técnico.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 5%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'Tax/Gestão Passivo Tributário': {
    subcategoria: 'Gestão Passivo Tributário', categoria: 'Tax',
    perfilAplicado: 'CaaS / Tax (serviço normal)',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.05, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.05),
    baseLegal: 'Lei 9.249/1995 art. 15 §1º III',
    observacao: 'Gestão de passivo tributário e parcelamentos. Serviço técnico.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 5%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'Tax/Recuperação Crédito Tributário': {
    subcategoria: 'Recuperação Crédito Tributário', categoria: 'Tax',
    perfilAplicado: 'CaaS / Tax (serviço normal)',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.05, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.05),
    baseLegal: 'Lei 9.249/1995 art. 15 §1º III; CTN art. 165',
    observacao: 'Recuperação de créditos via PERDCOMP/restituição. Serviço técnico.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 5%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'Tax/Reforma Tributária': {
    subcategoria: 'Reforma Tributária', categoria: 'Tax',
    perfilAplicado: 'CaaS / Tax (serviço normal)',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.05, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.05),
    baseLegal: 'Lei 9.249/1995 art. 15 §1º III; EC 132/2023',
    observacao: 'Adequação à reforma tributária (IBS/CBS). Consultoria técnica.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 5%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  'Tax/Diagnóstico Tributário & Compliance': {
    subcategoria: 'Diagnóstico Tributário & Compliance', categoria: 'Tax',
    perfilAplicado: 'CaaS / Tax (serviço normal)',
    presumidoIRPJ: 0.32, presumidoCSLL: 0.32,
    pis: 0.0065, cofins: 0.03, iss: 0.05, icms: 0,
    ...calc(0.32, 0.32, 0.0065, 0.03, 0.05),
    baseLegal: 'Lei 9.249/1995 art. 15 §1º III',
    observacao: 'Auditoria tributária e compliance. Serviço técnico recorrente ou pontual.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3% + ISS 5%) + (base IRPJ × 15%) + (base CSLL × 9%)',
  },
  // ========== PT — Planejamento Tributário (perfis) ==========
  'PT/E-book': {
    subcategoria: 'E-book', categoria: 'PT',
    perfilAplicado: 'Produto Digital (E-book)',
    presumidoIRPJ: 0.08, presumidoCSLL: 0.12,
    pis: 0.0065, cofins: 0.03, iss: 0, icms: 0,
    ...calc(0.08, 0.12, 0.0065, 0.03, 0),
    baseLegal: 'Lei 9.249/1995 art. 15; Lei 10.833/2003',
    observacao: 'E-book: produto digital. Base presumida 8%/12%. PIS e COFINS incidem normalmente.',
    formula: 'Imposto = receita × (PIS 0,65% + COFINS 3%) + (receita × 8% × 15%) + (receita × 12% × 9%)',
  },
  'PT/Mat. Didático': {
    subcategoria: 'Mat. Didático', categoria: 'PT',
    perfilAplicado: 'Material Didático (imune)',
    presumidoIRPJ: 0.08, presumidoCSLL: 0.12,
    pis: 0, cofins: 0, iss: 0, icms: 0,
    ...calc(0.08, 0.12, 0, 0, 0),
    baseLegal: 'CF art. 150 VI-d; Lei 10.753/2003',
    observacao: 'Material didático: imunidade de PIS, COFINS, ISS e ICMS.',
    formula: 'Imposto = (receita × 8% × 15%) + (receita × 12% × 9%)',
  },
  'PT/Livro Físico': {
    subcategoria: 'Livro Físico', categoria: 'PT',
    perfilAplicado: 'Livro Físico (imune)',
    presumidoIRPJ: 0.08, presumidoCSLL: 0.12,
    pis: 0, cofins: 0, iss: 0, icms: 0,
    ...calc(0.08, 0.12, 0, 0, 0),
    baseLegal: 'CF art. 150 VI-d; Lei 10.753/2003',
    observacao: 'Livro físico: imunidade tributária sobre livros, jornais e periódicos.',
    formula: 'Imposto = (receita × 8% × 15%) + (receita × 12% × 9%)',
  },
};

export const PREMISES_LIST: TaxPremise[] = Object.values(TAX_PREMISES);

export const AD_IRPJ_NOTE = `O Adicional de IRPJ (10% sobre o que exceder R$ 20.000/mês de base presumida) NÃO é calculado por subcategoria. É aplicado de forma GLOBAL sobre a soma de todas as bases IRPJ presumido do CNPJ, na média mensal. Fórmula: AD = MAX(0, base_IRPJ_mensal_consolidada - R$ 20.000) × 10% × 12. Esse valor entra como ajuste único no consolidado da empresa.`;

// ============================================================
// RESOLVER de chave (suporta 3 formas de chamada)
// ============================================================

function resolvePremise(
  chaveCompleta?: string,
  subcategoria?: string,
  categoria?: Categoria
): TaxPremise | null {
  if (chaveCompleta && TAX_PREMISES[chaveCompleta]) {
    return TAX_PREMISES[chaveCompleta];
  }
  if (subcategoria && categoria) {
    const key = `${categoria}/${subcategoria}`;
    if (TAX_PREMISES[key]) return TAX_PREMISES[key];
  }
  if (subcategoria) {
    const matches = PREMISES_LIST.filter(p => p.subcategoria === subcategoria);
    if (matches.length === 1) return matches[0];
  }
  return null;
}

// ============================================================
// COMPONENTE — ícone "i" + tooltip de auditoria
// ============================================================

interface TaxPremiseInfoProps {
  chaveCompleta?: string;
  subcategoria?: string;
  categoria?: Categoria;
  position?: 'top' | 'bottom' | 'left' | 'right';
  iconColor?: string;
}

export function TaxPremiseInfo({
  chaveCompleta,
  subcategoria,
  categoria,
  position = 'top',
  iconColor = '#6BF169',
}: TaxPremiseInfoProps) {
  const [open, setOpen] = useState(false);
  const premise = resolvePremise(chaveCompleta, subcategoria, categoria);

  if (!premise) {
    const ref = chaveCompleta || subcategoria || 'desconhecida';
    return (
      <span
        title={`Premissa não encontrada para "${ref}". Se for "Parceiros", informe a categoria (ex: categoria="CaaS").`}
        style={{ color: '#C62828', fontSize: 12, marginLeft: 4, cursor: 'help' }}
      >
        ⚠
      </span>
    );
  }

  const positionStyles: React.CSSProperties =
    position === 'top'
      ? { bottom: '125%', left: '50%', transform: 'translateX(-50%)' }
      : position === 'bottom'
      ? { top: '125%', left: '50%', transform: 'translateX(-50%)' }
      : position === 'left'
      ? { right: '125%', top: '50%', transform: 'translateY(-50%)' }
      : { left: '125%', top: '50%', transform: 'translateY(-50%)' };

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: 6 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
    >
      <button
        type="button"
        aria-label={`Premissa tributária de ${premise.subcategoria}`}
        style={{
          width: 16, height: 16, borderRadius: '50%',
          border: `1.5px solid ${iconColor}`, background: 'transparent',
          color: iconColor, fontSize: 11, fontWeight: 700,
          fontFamily: 'Montserrat, sans-serif', cursor: 'help',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, lineHeight: 1,
        }}
      >
        i
      </button>

      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute', ...positionStyles, zIndex: 9999, width: 360,
            background: '#FFFFFF', border: `2px solid ${iconColor}`, borderRadius: 8,
            padding: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: '#494949',
            textAlign: 'left', lineHeight: 1.4, pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 4, color: '#494949', borderBottom: `1px solid ${iconColor}`, paddingBottom: 4 }}>
            {premise.subcategoria}
          </div>
          <div style={{ color: '#787878', fontSize: 10, marginBottom: 8 }}>
            {premise.categoria} · {premise.perfilAplicado}
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 2 }}>ALÍQUOTAS APLICADAS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', fontSize: 10 }}>
              <div>PIS: <b>{(premise.pis * 100).toFixed(2)}%</b></div>
              <div>COFINS: <b>{(premise.cofins * 100).toFixed(2)}%</b></div>
              <div>ISS: <b>{(premise.iss * 100).toFixed(2)}%</b></div>
              <div>ICMS: <b>{(premise.icms * 100).toFixed(2)}%</b></div>
              <div>Pres. IRPJ: <b>{(premise.presumidoIRPJ * 100).toFixed(0)}%</b></div>
              <div>Pres. CSLL: <b>{(premise.presumidoCSLL * 100).toFixed(0)}%</b></div>
              <div>IRPJ efet.: <b>{(premise.irpjEfetivo * 100).toFixed(2)}%</b></div>
              <div>CSLL efet.: <b>{(premise.csllEfetivo * 100).toFixed(2)}%</b></div>
            </div>
            <div style={{ marginTop: 6, padding: '4px 6px', background: '#E8FBE8', borderRadius: 4, fontWeight: 700, fontSize: 11, textAlign: 'center' }}>
              TOTAL EFETIVO (sem AD.IRPJ): {(premise.totalEfetivo * 100).toFixed(2)}%
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 2 }}>FÓRMULA</div>
            <code style={{ display: 'block', background: '#F2F2F2', padding: '4px 6px', borderRadius: 4, fontSize: 9, fontFamily: 'monospace', wordBreak: 'break-word' }}>
              {premise.formula}
            </code>
          </div>

          <div style={{ marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 10 }}>BASE LEGAL</div>
            <div style={{ fontSize: 10, color: '#494949' }}>{premise.baseLegal}</div>
          </div>

          <div style={{ marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 10 }}>OBSERVAÇÃO</div>
            <div style={{ fontSize: 10, color: '#494949', fontStyle: 'italic' }}>{premise.observacao}</div>
          </div>

          <div style={{ marginTop: 6, padding: '4px 6px', background: '#FFF9E6', border: '1px solid #FFEB3B', borderRadius: 4, fontSize: 9, color: '#494949' }}>
            <b>⚠ AD.IRPJ:</b> não incluso aqui — calculado de forma global mensal sobre a empresa.
          </div>
        </div>
      )}
    </span>
  );
}

export default TaxPremiseInfo;
