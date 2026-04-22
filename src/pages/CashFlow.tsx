import { useState } from 'react';
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { YEARS, Year } from '@/lib/financialData';
import { PnlNode } from '@/lib/pnlData';
import { formatCurrency } from '@/lib/formatters';
import { ChevronRight, ChevronDown, ChevronUp, Info, Timer, TrendingDown, TrendingUp, Wallet, Settings, BarChart2 } from 'lucide-react';
import { ProdutoPMR, DEFAULT_PMR_PRODUTOS, calcPMRDias } from '@/lib/financialData';
import PmrConfigurator from '@/components/cashflow/PmrConfigurator';
import { projectRecebimentos, annualTotals } from '@/lib/pmrProjection';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine, LineChart, Line,
} from 'recharts';
import {
  HISTORICAL_PERIODS,
  historicalRevenue,
  historicalDeductions,
  historicalCosts,
  historicalExpenses,
  historicalFinancial,
} from '@/data/historicalData';
import { DataSourceBadge } from '@/components/period/DataSourceBadge';
import { getYearDataSource } from '@/lib/periodResolution';

// ─── Period helpers ───────────────────────────────────────────────────────────

const HIST_2025 = HISTORICAL_PERIODS.filter(p => p.startsWith('2025'));
const HIST_2026 = HISTORICAL_PERIODS.filter(p => p.startsWith('2026'));

function sumFlat(data: Record<string, number>, periods: readonly string[]): number {
  return periods.reduce((acc, p) => acc + (data[p] ?? 0), 0) / 1000;
}

function sumFinancialCat(catCode: string, periods: readonly string[]): number {
  const cat = historicalFinancial[catCode];
  if (!cat) return 0;
  let total = 0;
  for (const group of Object.values(cat)) {
    for (const item of Object.values(group)) {
      for (const p of periods) {
        total += (item[p] ?? 0);
      }
    }
  }
  return total / 1000;
}

function sumFinancialItem(
  catCode: string,
  groupName: string,
  itemName: string,
  periods: readonly string[],
): number {
  const item = historicalFinancial[catCode]?.[groupName]?.[itemName];
  if (!item) return 0;
  return periods.reduce((acc, p) => acc + (item[p] ?? 0), 0) / 1000;
}

function sumDeductions(periods: readonly string[]): number {
  let total = 0;
  for (const item of Object.values(historicalDeductions)) {
    total += periods.reduce((acc, p) => acc + (item[p] ?? 0), 0);
  }
  return total / 1000;
}

function sumCosts(periods: readonly string[]): number {
  let total = 0;
  for (const group of Object.values(historicalCosts)) {
    total += periods.reduce((acc, p) => acc + (group[p] ?? 0), 0);
  }
  return total / 1000;
}

function sumExpenseGroup(groupName: string, periods: readonly string[]): number {
  const group = historicalExpenses[groupName];
  if (!group) return 0;
  return periods.reduce((acc, p) => acc + (group[p] ?? 0), 0) / 1000;
}

// ─── Engine helpers ───────────────────────────────────────────────────────────

function findNode(code: string, nodes: PnlNode[]): PnlNode | undefined {
  for (const n of nodes) {
    if (n.code === code) return n;
    if (n.children) {
      const found = findNode(code, n.children);
      if (found) return found;
    }
  }
  return undefined;
}

function getAnnual(code: string, year: Year, tree: PnlNode[]): number {
  const node = findNode(code, tree);
  if (!node) return 0;
  return node.annual[year];
}

/** Get all children of a node as CashFlowRows */
function childRows(parentCode: string, tree: PnlNode[]): CashFlowRow[] {
  const parent = findNode(parentCode, tree);
  if (!parent?.children) return [];
  return parent.children.map(child => ({
    code: child.code,
    label: child.label,
    getValues: (y: Year) => child.annual[y],
  }));
}

// ─── Blending logic ───────────────────────────────────────────────────────────

/** 2025 → full historical; 2026 → 3 months real + 9/12 engine; 2027+ → engine */
function blend(
  year: Year,
  histFn: (periods: readonly string[]) => number,
  engineVal: number,
): number {
  if (year === 2025) return histFn(HIST_2025);
  if (year === 2026) {
    const hist3m = histFn(HIST_2026);
    const engine9m = engineVal * (9 / 12);
    return hist3m + engine9m;
  }
  return engineVal;
}

// ─── Cash flow row type ───────────────────────────────────────────────────────

interface CashFlowRow {
  code: string;
  label: string;
  isSummary?: boolean;
  isHighlight?: boolean;
  getValues: (year: Year) => number;
  children?: CashFlowRow[];
}

// ─── PMP config ───────────────────────────────────────────────────────────────

interface PmpConfig {
  impostos: number;
  custos: number;
  despesas: number;
  irpjCsll: number;
}

const DEFAULT_PMP: PmpConfig = {
  impostos: 30,
  custos: 30,
  despesas: 30,
  irpjCsll: 30,
};

function getPmpConfig(assumptions: any): PmpConfig {
  return assumptions.pmpConfig ?? DEFAULT_PMP;
}

// ─── PMR/PMP adjustment (annual approximation) ──────────────────────────────

/** Shift an annual value by N days: positive delay reduces cash received this year */
function adjustByDays(value: number, days: number): number {
  if (days <= 0) return value;
  // Approximate: (365-days)/365 of this period's value received this period
  return value * (365 - days) / 365;
}

// ─── Tree builder ─────────────────────────────────────────────────────────────

function buildCashFlowTree(tree: PnlNode[], pmrConfig: any, pmpConfig: PmpConfig): CashFlowRow[] {

  // ── (2) ENTRADAS OPERACIONAIS ───────────────────────────────────────────────
  const revenueSubProducts = (parentCode: string, tree: PnlNode[]): CashFlowRow[] => {
    const parent = findNode(parentCode, tree);
    if (!parent?.children) return [];
    return parent.children.map(c => ({
      code: c.code, label: c.label,
      getValues: (y: Year) => c.annual[y],
    }));
  };

  const entradaGroups: CashFlowRow[] = [
    { code: 'E.1', label: 'CaaS',
      getValues: (y) => blend(y, (ps) => sumFlat(historicalRevenue['CaaS'] ?? {}, ps), getAnnual('1.1', y, tree)),
      children: revenueSubProducts('1.1', tree),
    },
    { code: 'E.2', label: 'SaaS',
      getValues: (y) => blend(y, (ps) => sumFlat(historicalRevenue['SaaS'] ?? {}, ps), getAnnual('1.2', y, tree)),
      children: revenueSubProducts('1.2', tree),
    },
    { code: 'E.3', label: 'Education',
      getValues: (y) => blend(y, (ps) => sumFlat(historicalRevenue['Education'] ?? {}, ps), getAnnual('1.3', y, tree)),
      children: revenueSubProducts('1.3', tree),
    },
    { code: 'E.4', label: 'Expansão',
      getValues: (y) => blend(y, (ps) => sumFlat(historicalRevenue['Expansão'] ?? {}, ps), getAnnual('1.5', y, tree)),
      children: revenueSubProducts('1.5', tree),
    },
    { code: 'E.5', label: 'Tax',
      getValues: (y) => blend(y, (ps) => sumFlat(historicalRevenue['Tax'] ?? {}, ps), getAnnual('1.6', y, tree)),
      children: revenueSubProducts('1.6', tree),
    },
    { code: 'E.6', label: 'Outras Receitas (OR)',
      getValues: (y) => getAnnual('OR', y, tree),
    },
  ];

  const entradas: CashFlowRow = {
    code: '(2)', label: '(2) ENTRADAS OPERACIONAIS', isSummary: true,
    getValues: (y) => entradaGroups.reduce((s, r) => s + r.getValues(y), 0),
    children: entradaGroups,
  };

  // ── (3) SAÍDAS OPERACIONAIS ─────────────────────────────────────────────────

  // 3A. Impostos sobre receita (grupo 2 do P&L)
  const impostoItems = childRows('2', tree);
  const saida3A: CashFlowRow = {
    code: '3A', label: '3A. Impostos sobre Receita', isSummary: false,
    getValues: (y) => blend(y, (ps) => -sumDeductions(ps), getAnnual('2', y, tree)),
    children: impostoItems,
  };

  // 3B. Custos variáveis (grupo 3 do P&L)
  const custoItems: CashFlowRow[] = [
    { code: '3B.1', label: 'Custos CaaS', getValues: (y) => blend(y, (ps) => -sumFlat(historicalCosts['Custos Caas'] ?? {}, ps), getAnnual('3.1', y, tree)), children: childRows('3.1', tree) },
    { code: '3B.2', label: 'Custos SaaS', getValues: (y) => blend(y, (ps) => -sumFlat(historicalCosts['Custos SaaS'] ?? {}, ps), getAnnual('3.2', y, tree)), children: childRows('3.2', tree) },
    { code: '3B.3', label: 'Custos Education', getValues: (y) => blend(y, (ps) => -sumFlat(historicalCosts['Custos Education'] ?? {}, ps), getAnnual('3.3', y, tree)), children: childRows('3.3', tree) },
    { code: '3B.4', label: 'Custos Customer Success', getValues: (y) => blend(y, (ps) => -sumFlat(historicalCosts['Custos Customer Success'] ?? {}, ps), getAnnual('3.4', y, tree)), children: childRows('3.4', tree) },
    { code: '3B.5', label: 'Custos Expansão', getValues: (y) => blend(y, (ps) => -sumFlat(historicalCosts['Custos Expansão'] ?? {}, ps), getAnnual('3.5', y, tree)), children: childRows('3.5', tree) },
    { code: '3B.6', label: 'Custos Tax', getValues: (y) => blend(y, (ps) => -sumFlat(historicalCosts['Custos Tax'] ?? {}, ps), getAnnual('3.6', y, tree)), children: childRows('3.6', tree) },
  ];
  const saida3B: CashFlowRow = {
    code: '3B', label: '3B. Custos Variáveis',
    getValues: (y) => custoItems.reduce((s, r) => s + r.getValues(y), 0),
    children: custoItems,
  };

  // 3C. Despesas fixas (grupos 4, 5, 6, 7 do P&L)
  const despesaItems: CashFlowRow[] = [
    { code: '3C.1', label: 'Despesas Administrativas', getValues: (y) => blend(y, (ps) => -sumExpenseGroup('Despesas Administrativas', ps), getAnnual('4', y, tree)), children: childRows('4', tree) },
    { code: '3C.2', label: 'Despesas com Pessoal', getValues: (y) => blend(y, (ps) => -sumExpenseGroup('Despesas com Pessoal', ps), getAnnual('5', y, tree)), children: childRows('5', tree) },
    { code: '3C.3', label: 'Despesas Comerciais', getValues: (y) => blend(y, (ps) => -sumExpenseGroup('Despesas Comerciais', ps), getAnnual('6', y, tree)), children: childRows('6', tree) },
    { code: '3C.4', label: 'Despesas de Marketing', getValues: (y) => blend(y, (ps) => -sumExpenseGroup('Despesas de Marketing', ps), getAnnual('7', y, tree)), children: childRows('7', tree) },
  ];
  const saida3C: CashFlowRow = {
    code: '3C', label: '3C. Despesas Fixas',
    getValues: (y) => despesaItems.reduce((s, r) => s + r.getValues(y), 0),
    children: despesaItems,
  };

  // 3D. Provisão IRPJ/CSLL (grupo 10 do P&L)
  const saida3D: CashFlowRow = {
    code: '3D', label: '3D. Provisão IRPJ/CSLL',
    getValues: (y) => blend(y, (ps) => -sumFinancialCat('PROV', ps), getAnnual('TAX', y, tree)),
    children: childRows('TAX', tree),
  };

  const saidaGroups = [saida3A, saida3B, saida3C, saida3D];
  const totalSaidas: CashFlowRow = {
    code: '(3)', label: '(3) SAÍDAS OPERACIONAIS', isSummary: true,
    getValues: (y) => saidaGroups.reduce((s, r) => s + r.getValues(y), 0),
    children: saidaGroups,
  };

  // ── (5) RESULTADO FINANCEIRO LÍQUIDO ────────────────────────────────────────
  const finItems: CashFlowRow[] = [
    { code: '5.R', label: 'Receitas Financeiras',
      getValues: (y) => blend(y, (ps) => sumFinancialCat('RF', ps), getAnnual('8R', y, tree)),
    },
    { code: '5.D', label: 'Despesas Financeiras',
      getValues: (y) => blend(y, (ps) => -sumFinancialCat('DF', ps), getAnnual('8D', y, tree)),
      children: childRows('8D', tree),
    },
  ];
  const resultadoFinanceiro: CashFlowRow = {
    code: '(5)', label: '(5) RESULTADO FINANCEIRO', isSummary: true,
    getValues: (y) => finItems.reduce((s, r) => s + r.getValues(y), 0),
    children: finItems,
  };

  // ── (7) AMORTIZAÇÃO DE DÍVIDAS ──────────────────────────────────────────────
  const amortItems = childRows('11', tree);
  const amortizacao: CashFlowRow = {
    code: '(7)', label: '(7) AMORTIZAÇÃO DE DÍVIDAS', isSummary: true,
    getValues: (y) => blend(
      y,
      (ps) => -sumFinancialCat('AD', ps),
      getAnnual('11', y, tree),
    ),
    children: amortItems,
  };

  // ── (8) INVESTIMENTOS — CAPEX ───────────────────────────────────────────────
  const capexItems = childRows('12', tree);
  const capex: CashFlowRow = {
    code: '(8)', label: '(8) INVESTIMENTOS — CAPEX', isSummary: true,
    getValues: (y) => blend(
      y,
      (ps) => -sumFinancialCat('INV', ps),
      getAnnual('12', y, tree),
    ),
    children: capexItems,
  };

  return [entradas, totalSaidas, resultadoFinanceiro, amortizacao, capex];
}


// ─── Expandable row component ─────────────────────────────────────────────────

function CashFlowExpandableRow({ row, depth, activeYears }: { row: CashFlowRow; depth: number; activeYears: Year[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = row.children && row.children.length > 0;

  return (
    <>
      <tr
        className={`border-b border-border/30 transition-colors ${
          row.isHighlight
            ? 'bg-primary/10 font-bold'
            : row.isSummary
              ? 'bg-primary/5 font-semibold'
              : 'hover:bg-secondary/20'
        }`}
      >
        <td
          className="p-3 whitespace-nowrap cursor-pointer select-none sticky left-0 bg-card"
          style={{ paddingLeft: `${12 + depth * 20}px` }}
          onClick={() => hasChildren && setExpanded(!expanded)}
        >
          <div className="flex items-center gap-1.5">
            {hasChildren ? (
              expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <span className="w-3.5" />
            )}
            <span className={`text-sm ${row.isSummary ? 'text-foreground' : 'text-foreground/90'}`}>
              {row.label}
            </span>
          </div>
        </td>
        {activeYears.map(y => {
          const val = row.getValues(y);
          return (
            <td key={y} className="text-right p-3 tabular-nums text-sm">
              <span className={val < -0.5 ? 'text-negative' : val > 0.5 ? 'text-positive' : ''}>
                {Math.abs(val) < 0.5 ? '—' : formatCurrency(val * 1000)}
              </span>
            </td>
          );
        })}
      </tr>
      {expanded && row.children?.map(child => (
        <CashFlowExpandableRow key={child.code} row={child} depth={depth + 1} activeYears={activeYears} />
      ))}
    </>
  );
}

// ─── Summary row (non-expandable, highlighted) ────────────────────────────────

function SummaryRow({ label, getValue, activeYears, highlight }: {
  label: string;
  getValue: (y: Year) => number;
  activeYears: Year[];
  highlight?: boolean;
}) {
  return (
    <tr className={`border-b border-border/30 font-bold ${highlight ? 'bg-primary/10' : 'bg-primary/5'}`}>
      <td className="p-3 sticky left-0 bg-card text-sm text-foreground">{label}</td>
      {activeYears.map(y => {
        const val = getValue(y);
        return (
          <td key={y} className={`text-right p-3 tabular-nums text-sm ${val < -0.5 ? 'text-negative' : val > 0.5 ? 'text-positive' : ''}`}>
            {Math.abs(val) < 0.5 ? '—' : formatCurrency(val * 1000)}
          </td>
        );
      })}
    </tr>
  );
}

// ─── Axis formatter ───────────────────────────────────────────────────────────

const formatAxis = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1000) return `R$${(v / 1000).toFixed(0)}M`;
  return `R$${v.toFixed(0)}k`;
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CashFlow() {
  const { scenario, pnlTree, assumptions, setAssumptions, filteredYears, rangeDataSource } = useFinancialModel();
  const [pmrOpen, setPmrOpen] = useState(false);
  const [pmrSubTab, setPmrSubTab] = useState<'config' | 'projecao'>('config');
  const [pmpOpen, setPmpOpen] = useState(false);
  const [editingPmp, setEditingPmp] = useState(false);
  const [pmpDraft, setPmpDraft] = useState<PmpConfig>(getPmpConfig(assumptions));

  // PMR Granular por produto
  const pmrProdutos: ProdutoPMR[] = assumptions.pmrProdutos ?? DEFAULT_PMR_PRODUTOS;
  const [projecaoYear, setProjecaoYear] = useState<Year>(2026);

  const activeYears: Year[] = filteredYears.length > 0 ? filteredYears : [...YEARS];

  const pmpConfig = getPmpConfig(assumptions);
  const sections = buildCashFlowTree(pnlTree, assumptions.pmrConfig, pmpConfig);

  // sections: [0]=Entradas, [1]=Saídas, [2]=ResultadoFinanceiro, [3]=Amortização, [4]=Capex
  const getEntradas = (y: Year) => sections[0].getValues(y);
  const getSaidas = (y: Year) => sections[1].getValues(y);
  const getResultadoFin = (y: Year) => sections[2].getValues(y);
  const getAmortizacao = (y: Year) => sections[3].getValues(y);
  const getCapex = (y: Year) => sections[4].getValues(y);

  // (4) FCO = Saldo Inicial + Entradas + Saídas
  const getFCO = (y: Year, saldoInicial: number) => saldoInicial + getEntradas(y) + getSaidas(y);
  // (6) FCF = FCO + Resultado Financeiro
  const getFCF = (y: Year, saldoInicial: number) => getFCO(y, saldoInicial) + getResultadoFin(y);
  // (9) Saldo Final = FCF + Amortização + Capex (amortização e capex já são negativos)
  const getSaldoFinal = (y: Year, saldoInicial: number) => getFCF(y, saldoInicial) + getAmortizacao(y) + getCapex(y);

  // Compute balances chain
  const initialCash = (assumptions as any).initialCashBalance ?? 0;
  let runningBalance = initialCash;
  const balances: Record<Year, { opening: number; fco: number; fcf: number; closing: number }> = {} as any;
  for (const y of YEARS) {
    const opening = runningBalance;
    const fco = getFCO(y, opening);
    const fcf = getFCF(y, opening);
    const closing = getSaldoFinal(y, opening);
    balances[y] = { opening, fco, fcf, closing };
    runningBalance = closing;
  }

  // Chart data
  const chartData = activeYears.map(y => ({
    year: y.toString(),
    Entradas: getEntradas(y),
    Saídas: getSaidas(y),
    FCO: balances[y].fco - balances[y].opening,
    'Resultado Financeiro': getResultadoFin(y),
    'Saldo Final': balances[y].closing,
  }));

  const savePmrProdutos = (produtos: ProdutoPMR[]) => {
    setAssumptions({ ...assumptions, pmrProdutos: produtos });
    setPmrSubTab('config');
  };

  const savePmp = () => {
    setAssumptions({ ...assumptions, pmpConfig: pmpDraft } as any);
    setEditingPmp(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-primary">Fluxo de Caixa</h2>
          <p className="text-xs text-muted-foreground mt-1">Regime de caixa: receitas ajustadas pelo PMR, custos e despesas pelo PMP.</p>
        </div>
        <DataSourceBadge source={rangeDataSource} />
      </div>

      {/* PMR + PMP Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PMR Panel — Granular por produto */}
        <div className="gradient-card">
          <button className="w-full flex items-center justify-between p-5 text-left" onClick={() => setPmrOpen(o => !o)}>
            <div>
              <h3 className="text-sm font-semibold">PMR — Prazo Médio de Recebimento</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(['CaaS', 'SaaS', 'Education', 'Expansao', 'Tax'] as const).map(g => {
                  const items = pmrProdutos.filter(p => p.grupo === g);
                  const avg = items.length > 0 ? Math.round(items.reduce((s, p) => s + calcPMRDias(p.parcelas), 0) / items.length) : 0;
                  return `${g === 'Expansao' ? 'Expansão' : g} ${avg}d`;
                }).join(' · ')}
              </p>
            </div>
            {pmrOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {pmrOpen && (
            <div className="border-t border-border">
              {/* Sub-tabs */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => setPmrSubTab('config')}
                  className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-medium transition-colors ${pmrSubTab === 'config' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Settings className="h-3.5 w-3.5" /> Configuração de prazos
                </button>
                <button
                  onClick={() => setPmrSubTab('projecao')}
                  className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-medium transition-colors ${pmrSubTab === 'projecao' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <BarChart2 className="h-3.5 w-3.5" /> Projeção de recebimentos
                </button>
              </div>
              <div className="p-5">
                {pmrSubTab === 'config' ? (
                  <PmrConfigurator
                    produtos={pmrProdutos}
                    onSave={savePmrProdutos}
                    onCancel={() => setPmrOpen(false)}
                  />
                ) : (
                  (() => {
                    const proj = projectRecebimentos(projecaoYear, pmrProdutos, pnlTree);
                    const totals = annualTotals(proj);
                    const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                    const GRUPO_ORDER = ['CaaS','SaaS','Education','Expansao','Tax'];
                    const GRUPO_LABELS: Record<string, string> = { CaaS: 'CaaS', SaaS: 'SaaS', Education: 'Education', Expansao: 'Expansão', Tax: 'Tax' };

                    return (
                      <div className="space-y-4">
                        {/* Year selector */}
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">Ano:</span>
                          <div className="flex bg-secondary rounded-lg p-0.5 border border-border">
                            {YEARS.map(y => (
                              <button key={y} onClick={() => setProjecaoYear(y)}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${projecaoYear === y ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                {y}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Summary cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="bg-secondary/30 rounded-lg p-3">
                            <p className="text-[10px] text-muted-foreground">Total faturado</p>
                            <p className="text-sm font-bold">{formatCurrency(totals.faturado * 1000)}</p>
                          </div>
                          <div className="bg-secondary/30 rounded-lg p-3">
                            <p className="text-[10px] text-muted-foreground">Total recebido líquido</p>
                            <p className="text-sm font-bold text-positive">{formatCurrency(totals.recebido * 1000)}</p>
                          </div>
                          <div className="bg-secondary/30 rounded-lg p-3">
                            <p className="text-[10px] text-muted-foreground">Perda por inadimplência</p>
                            <p className="text-sm font-bold text-negative">{formatCurrency(totals.inadimplencia * 1000)} ({totals.faturado > 0 ? ((totals.inadimplencia / totals.faturado) * 100).toFixed(1) : '0'}%)</p>
                          </div>
                          <div className="bg-secondary/30 rounded-lg p-3">
                            <p className="text-[10px] text-muted-foreground">Cobertura de caixa</p>
                            <p className="text-sm font-bold">{totals.cobertura.toFixed(1)}%</p>
                          </div>
                        </div>

                        {/* Monthly grid */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left px-2 py-1.5 text-muted-foreground font-medium sticky left-0 bg-card min-w-[160px]">Produto</th>
                                {MONTHS.map(m => <th key={m} className="text-right px-2 py-1.5 text-muted-foreground font-medium min-w-[75px]">{m}</th>)}
                                <th className="text-right px-2 py-1.5 text-muted-foreground font-medium min-w-[90px]">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {GRUPO_ORDER.map(grupo => {
                                const items = proj.produtoResumo.filter(p => p.grupo === grupo);
                                if (items.every(p => p.faturado < 0.01 && p.recebido < 0.01)) return null;
                                return [
                                  <tr key={`g-${grupo}`} className="bg-secondary/20 border-b border-border/30">
                                    <td colSpan={14} className="px-2 py-1 font-semibold text-muted-foreground">{GRUPO_LABELS[grupo] ?? grupo}</td>
                                  </tr>,
                                  ...items.filter(p => p.faturado > 0.01 || p.recebido > 0.01).map(p => (
                                    <tr key={p.id} className="border-b border-border/10 hover:bg-secondary/10">
                                      <td className="px-2 py-1 pl-5 sticky left-0 bg-card">{p.nome}</td>
                                      {(proj.recebimentos[p.id] ?? []).map((v, i) => (
                                        <td key={i} className="text-right px-2 py-1 tabular-nums">
                                          {Math.abs(v) < 0.01 ? '—' : formatCurrency(v * 1000)}
                                        </td>
                                      ))}
                                      <td className="text-right px-2 py-1 tabular-nums font-medium">{formatCurrency(p.recebido * 1000)}</td>
                                    </tr>
                                  )),
                                ];
                              })}
                              {/* Totals */}
                              <tr className="border-t-2 border-primary/30 bg-primary/5 font-bold">
                                <td className="px-2 py-1.5 sticky left-0 bg-card text-positive">Total recebimentos</td>
                                {proj.totalRecebido.map((v, i) => <td key={i} className="text-right px-2 py-1.5 tabular-nums text-positive">{Math.abs(v) < 0.01 ? '—' : formatCurrency(v * 1000)}</td>)}
                                <td className="text-right px-2 py-1.5 tabular-nums text-positive">{formatCurrency(totals.recebido * 1000)}</td>
                              </tr>
                              <tr className="border-b border-border/30">
                                <td className="px-2 py-1 sticky left-0 bg-card text-negative">(−) Inadimplência</td>
                                {proj.totalInadimplencia.map((v, i) => <td key={i} className="text-right px-2 py-1 tabular-nums text-negative">{Math.abs(v) < 0.01 ? '—' : formatCurrency(-v * 1000)}</td>)}
                                <td className="text-right px-2 py-1 tabular-nums text-negative">{formatCurrency(-totals.inadimplencia * 1000)}</td>
                              </tr>
                              <tr className="border-b border-border/30">
                                <td className="px-2 py-1 sticky left-0 bg-card text-muted-foreground">Receita bruta faturada</td>
                                {proj.totalFaturado.map((v, i) => <td key={i} className="text-right px-2 py-1 tabular-nums text-muted-foreground">{Math.abs(v) < 0.01 ? '—' : formatCurrency(v * 1000)}</td>)}
                                <td className="text-right px-2 py-1 tabular-nums text-muted-foreground">{formatCurrency(totals.faturado * 1000)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          )}
        </div>

        {/* PMP Panel */}
        <div className="gradient-card">
          <button className="w-full flex items-center justify-between p-5 text-left" onClick={() => setPmpOpen(o => !o)}>
            <div>
              <h3 className="text-sm font-semibold">PMP — Prazo Médio de Pagamento</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Impostos {pmpConfig.impostos}d · Custos {pmpConfig.custos}d · Despesas {pmpConfig.despesas}d · IRPJ/CSLL {pmpConfig.irpjCsll}d
              </p>
            </div>
            {pmpOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {pmpOpen && (
            <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {([
                  { key: 'impostos' as const, label: 'Impostos' },
                  { key: 'custos' as const, label: 'Custos' },
                  { key: 'despesas' as const, label: 'Despesas' },
                  { key: 'irpjCsll' as const, label: 'IRPJ/CSLL' },
                ]).map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{label} (dias)</p>
                    {editingPmp ? (
                      <input type="number" min="0" max="180"
                        className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                        value={pmpDraft[key]} onChange={e => setPmpDraft(p => ({ ...p, [key]: Number(e.target.value) || 0 }))} />
                    ) : (
                      <p className="text-sm font-semibold">{pmpConfig[key]} dias</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                {editingPmp ? (
                  <>
                    <button onClick={savePmp} className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">Salvar</button>
                    <button onClick={() => { setPmpDraft(pmpConfig); setEditingPmp(false); }} className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
                  </>
                ) : (
                  <button onClick={() => { setPmpDraft(pmpConfig); setEditingPmp(true); }} className="px-3 py-1.5 text-xs font-semibold border border-primary/40 rounded-lg text-primary hover:bg-primary/10 transition-colors">Editar PMP</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Cash Flow Table */}
      <div className="gradient-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-muted-foreground font-medium min-w-[300px] sticky left-0 bg-card">Descrição</th>
              {activeYears.map(y => (
                <th key={y} className="text-right p-3 text-muted-foreground font-medium min-w-[130px]">
                  <div className="flex flex-col items-end gap-1">
                    <span>{y}</span>
                    <DataSourceBadge source={getYearDataSource(y)} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* (1) SALDO INICIAL */}
            <SummaryRow label="(1) SALDO INICIAL" getValue={(y) => balances[y].opening} activeYears={activeYears} />

            {/* (2) ENTRADAS OPERACIONAIS */}
            <CashFlowExpandableRow row={sections[0]} depth={0} activeYears={activeYears} />

            {/* (3) SAÍDAS OPERACIONAIS */}
            <CashFlowExpandableRow row={sections[1]} depth={0} activeYears={activeYears} />

            {/* (4) FCO */}
            <SummaryRow label="(4) FCO — FLUXO DE CAIXA OPERACIONAL" getValue={(y) => balances[y].fco} activeYears={activeYears} highlight />

            {/* Separator */}
            <tr><td colSpan={activeYears.length + 1} className="py-1 border-b border-border/10" /></tr>

            {/* (5) RESULTADO FINANCEIRO */}
            <CashFlowExpandableRow row={sections[2]} depth={0} activeYears={activeYears} />

            {/* (6) FCF */}
            <SummaryRow label="(6) FCF — FLUXO DE CAIXA DO PERÍODO" getValue={(y) => balances[y].fcf} activeYears={activeYears} highlight />

            {/* Separator */}
            <tr><td colSpan={activeYears.length + 1} className="py-1 border-b border-border/10" /></tr>

            {/* (7) AMORTIZAÇÃO */}
            <CashFlowExpandableRow row={sections[3]} depth={0} activeYears={activeYears} />

            {/* (8) CAPEX */}
            <CashFlowExpandableRow row={sections[4]} depth={0} activeYears={activeYears} />

            {/* (9) SALDO FINAL */}
            <tr className="border-b border-border bg-primary/10 font-bold">
              <td className="p-3 sticky left-0 bg-card text-sm text-foreground">(9) SALDO FINAL</td>
              {activeYears.map(y => {
                const val = balances[y].closing;
                return (
                  <td key={y} className={`text-right p-3 tabular-nums text-sm ${val < -0.5 ? 'text-negative' : 'text-positive'}`}>
                    {formatCurrency(val * 1000)}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Waterfall Chart */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold mb-4">Fluxo de Caixa Anual — Cascata (R$ mil)</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22% / 0.5)" />
            <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={13} />
            <YAxis stroke="hsl(215 20% 55%)" fontSize={13} tickFormatter={formatAxis} />
            <Tooltip
              contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 13 }}
              labelStyle={{ color: 'hsl(210 40% 98%)', fontWeight: 700 }}
              formatter={(v: number, name: string) => [formatCurrency(v * 1000), name]}
            />
            <ReferenceLine y={0} stroke="hsl(215 20% 55%)" strokeDasharray="3 3" />
            <Bar dataKey="Entradas" fill="hsl(166 72% 28%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Saídas" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="FCO" fill="hsl(221 83% 53%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Resultado Financeiro" fill="hsl(45 93% 47%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Saldo Final" fill="hsl(280 60% 50%)" radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-start gap-2 text-[11px] text-muted-foreground px-1">
        <Info className="h-3 w-3 mt-0.5 shrink-0" />
        <span>
          Valores em R$ mil (000's) · {scenario} · Saldo Final = FCF − Amortização − CAPEX.
          Saldo Inicial do próximo período = Saldo Final do período anterior (encadeamento automático).
        </span>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          FINANCE CYCLE — DSO, DPO, CCC, Aging, Cash Sweep
          ═══════════════════════════════════════════════════════════════════════ */}
      {(() => {
        // Compute cycle metrics from pnlTree
        interface CycleMetrics {
          year: Year; grossRevenue: number; totalCogs: number; totalOpex: number;
          receivablesBalance: number; payablesBalance: number; workingCapital: number;
          dso: number; dpo: number; ccc: number;
          receivablesChange: number; payablesChange: number; netWorkingCapitalChange: number;
        }

        const pmr = assumptions.pmrConfig;
        const pmp = pmpConfig;
        const cycleMetrics: CycleMetrics[] = [];
        let prevRec = 0, prevPay = 0;

        for (const y of YEARS) {
          const grossRevenue = Math.abs(getAnnual('1', y, pnlTree));
          const caasRev = Math.abs(getAnnual('1.1', y, pnlTree));
          const saasRev = Math.abs(getAnnual('1.2', y, pnlTree));
          const eduRev = Math.abs(getAnnual('1.3', y, pnlTree));
          const expRev = Math.abs(getAnnual('1.5', y, pnlTree));
          const taxRev = Math.abs(getAnnual('1.6', y, pnlTree));

          const totalRevForPmr = caasRev + saasRev + eduRev + expRev + taxRev;
          const dso = totalRevForPmr > 0
            ? Math.round((caasRev * pmr.caas + saasRev * pmr.saas + eduRev * pmr.education + (expRev + taxRev) * pmr.baas) / totalRevForPmr * 10) / 10
            : 0;

          const totalCogs = Math.abs(
            getAnnual('3.1', y, pnlTree) + getAnnual('3.2', y, pnlTree) + getAnnual('3.3', y, pnlTree) +
            getAnnual('3.4', y, pnlTree) + getAnnual('3.5', y, pnlTree) + getAnnual('3.6', y, pnlTree)
          );
          const totalOpex = Math.abs(getAnnual('4', y, pnlTree) + getAnnual('5', y, pnlTree) + getAnnual('6', y, pnlTree) + getAnnual('7', y, pnlTree));
          const totalOut = totalCogs + totalOpex;

          const cogsW = totalOut > 0 ? totalCogs / totalOut : 0.5;
          const opexW = totalOut > 0 ? totalOpex / totalOut : 0.5;
          const dpo = Math.round((cogsW * pmp.custos + opexW * pmp.despesas) * 10) / 10;

          const receivablesBalance = grossRevenue * (dso / 365);
          const payablesBalance = totalOut * (dpo / 365);
          const workingCapital = receivablesBalance - payablesBalance;
          const receivablesChange = -(receivablesBalance - prevRec);
          const payablesChange = payablesBalance - prevPay;
          const ccc = Math.round((dso - dpo) * 10) / 10;

          cycleMetrics.push({
            year: y, grossRevenue, totalCogs, totalOpex,
            receivablesBalance, payablesBalance, workingCapital,
            dso, dpo, ccc,
            receivablesChange, payablesChange,
            netWorkingCapitalChange: receivablesChange + payablesChange,
          });
          prevRec = receivablesBalance;
          prevPay = payablesBalance;
        }

        const activeCycle = cycleMetrics.filter(m => activeYears.includes(m.year));
        const latest = activeCycle[activeCycle.length - 1];
        const prev = activeCycle.length > 1 ? activeCycle[activeCycle.length - 2] : null;
        if (!latest) return null;

        const daysChart = activeCycle.map(m => ({ year: m.year.toString(), DSO: m.dso, DPO: m.dpo, 'Ciclo de Caixa': m.ccc }));
        const balChart = activeCycle.map(m => ({ year: m.year.toString(), 'Contas a Receber': m.receivablesBalance, 'Contas a Pagar': -m.payablesBalance, 'Capital de Giro': m.workingCapital }));

        return (
          <>
            {/* Section header */}
            <div className="border-t-2 border-primary/20 pt-6">
              <h2 className="text-xl font-bold text-primary">Finance Cycle</h2>
              <p className="text-xs text-muted-foreground mt-1">DSO, DPO, ciclo de conversão de caixa, aging e cash sweep.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'DSO — Prazo de Recebimento', value: `${latest.dso.toFixed(1)}`, unit: 'dias', sub: prev ? `${prev.dso.toFixed(1)}d em ${prev.year}` : '', icon: Timer, color: 'text-blue-400' },
                { label: 'DPO — Prazo de Pagamento', value: `${latest.dpo.toFixed(1)}`, unit: 'dias', sub: prev ? `${prev.dpo.toFixed(1)}d em ${prev.year}` : '', icon: Timer, color: 'text-amber-400' },
                { label: 'Ciclo de Caixa (CCC)', value: `${latest.ccc.toFixed(1)}`, unit: 'dias', sub: latest.ccc > 0 ? 'Paga antes de receber' : 'Recebe antes de pagar', icon: latest.ccc > 0 ? TrendingDown : TrendingUp, color: latest.ccc > 0 ? 'text-negative' : 'text-positive' },
                { label: 'Capital de Giro', value: formatCurrency(latest.workingCapital * 1000), unit: '', sub: `AR ${formatCurrency(latest.receivablesBalance * 1000)} − AP ${formatCurrency(latest.payablesBalance * 1000)}`, icon: Wallet, color: latest.workingCapital > 0 ? 'text-positive' : 'text-negative' },
              ].map(kpi => (
                <div key={kpi.label} className="gradient-card p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                    <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</span>
                    {kpi.unit && <span className="text-xs text-muted-foreground">{kpi.unit}</span>}
                  </div>
                  {kpi.sub && <p className="text-[10px] text-muted-foreground">{kpi.sub}</p>}
                </div>
              ))}
            </div>

            {/* DSO vs DPO Chart */}
            <div className="gradient-card p-5">
              <h3 className="text-sm font-semibold mb-4">DSO vs DPO vs Ciclo de Caixa (dias)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={daysChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22% / 0.5)" />
                  <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={13} />
                  <YAxis stroke="hsl(215 20% 55%)" fontSize={13} unit="d" />
                  <Tooltip contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 13 }} formatter={(v: number) => [`${v.toFixed(1)} dias`]} />
                  <ReferenceLine y={0} stroke="hsl(215 20% 55%)" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="DSO" stroke="hsl(221 83% 53%)" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="DPO" stroke="hsl(45 93% 47%)" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Ciclo de Caixa" stroke="hsl(0 72% 51%)" strokeWidth={2.5} dot={{ r: 5 }} strokeDasharray="5 5" />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Receivables vs Payables Chart */}
            <div className="gradient-card p-5">
              <h3 className="text-sm font-semibold mb-4">Contas a Receber vs Contas a Pagar (R$ mil)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={balChart} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22% / 0.5)" />
                  <XAxis dataKey="year" stroke="hsl(215 20% 55%)" fontSize={13} />
                  <YAxis stroke="hsl(215 20% 55%)" fontSize={13} tickFormatter={formatAxis} />
                  <Tooltip contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 13 }} formatter={(v: number, name: string) => [formatCurrency(Math.abs(v) * 1000), name]} />
                  <ReferenceLine y={0} stroke="hsl(215 20% 55%)" strokeDasharray="3 3" />
                  <Bar dataKey="Contas a Receber" fill="hsl(221 83% 53%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Contas a Pagar" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Capital de Giro" fill="hsl(166 72% 28%)" radius={[4, 4, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed Table */}
            <div className="gradient-card overflow-x-auto">
              <div className="p-5 pb-3"><h3 className="text-sm font-semibold">Detalhamento Finance Cycle por Ano</h3></div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-4 py-2 text-muted-foreground font-medium min-w-[220px]">Indicador</th>
                    {activeCycle.map(m => <th key={m.year} className="text-right px-4 py-2 text-muted-foreground font-medium min-w-[120px]">{m.year}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/30 bg-secondary/10"><td className="px-4 py-2 font-semibold text-muted-foreground" colSpan={activeCycle.length + 1}>Prazos (dias)</td></tr>
                  <tr className="border-b border-border/20"><td className="px-4 py-1.5">DSO</td>{activeCycle.map(m => <td key={m.year} className="text-right px-4 py-1.5 tabular-nums">{m.dso.toFixed(1)}d</td>)}</tr>
                  <tr className="border-b border-border/20"><td className="px-4 py-1.5">DPO</td>{activeCycle.map(m => <td key={m.year} className="text-right px-4 py-1.5 tabular-nums">{m.dpo.toFixed(1)}d</td>)}</tr>
                  <tr className="border-b border-border/20 font-semibold"><td className="px-4 py-1.5">CCC (DSO − DPO)</td>{activeCycle.map(m => <td key={m.year} className={`text-right px-4 py-1.5 tabular-nums ${m.ccc > 0 ? 'text-negative' : 'text-positive'}`}>{m.ccc.toFixed(1)}d</td>)}</tr>

                  <tr className="border-b border-border/30 bg-secondary/10"><td className="px-4 py-2 font-semibold text-muted-foreground" colSpan={activeCycle.length + 1}>Saldos (R$ mil)</td></tr>
                  <tr className="border-b border-border/20"><td className="px-4 py-1.5">Contas a Receber (AR)</td>{activeCycle.map(m => <td key={m.year} className="text-right px-4 py-1.5 tabular-nums">{formatCurrency(m.receivablesBalance * 1000)}</td>)}</tr>
                  <tr className="border-b border-border/20"><td className="px-4 py-1.5">Contas a Pagar (AP)</td>{activeCycle.map(m => <td key={m.year} className="text-right px-4 py-1.5 tabular-nums">{formatCurrency(m.payablesBalance * 1000)}</td>)}</tr>
                  <tr className="border-b border-border/20 font-semibold"><td className="px-4 py-1.5">Capital de Giro (AR − AP)</td>{activeCycle.map(m => <td key={m.year} className={`text-right px-4 py-1.5 tabular-nums ${m.workingCapital > 0 ? 'text-positive' : 'text-negative'}`}>{formatCurrency(m.workingCapital * 1000)}</td>)}</tr>

                  <tr className="border-b border-border/30 bg-secondary/10"><td className="px-4 py-2 font-semibold text-muted-foreground" colSpan={activeCycle.length + 1}>Variação no Período</td></tr>
                  <tr className="border-b border-border/20"><td className="px-4 py-1.5">Variação Recebíveis</td>{activeCycle.map(m => <td key={m.year} className={`text-right px-4 py-1.5 tabular-nums ${m.receivablesChange < 0 ? 'text-negative' : 'text-positive'}`}>{formatCurrency(m.receivablesChange * 1000)}</td>)}</tr>
                  <tr className="border-b border-border/20"><td className="px-4 py-1.5">Variação Payables</td>{activeCycle.map(m => <td key={m.year} className={`text-right px-4 py-1.5 tabular-nums ${m.payablesChange > 0 ? 'text-positive' : 'text-negative'}`}>{formatCurrency(m.payablesChange * 1000)}</td>)}</tr>
                  <tr className="border-b border-border font-semibold"><td className="px-4 py-1.5">Impacto Líquido no Caixa</td>{activeCycle.map(m => <td key={m.year} className={`text-right px-4 py-1.5 tabular-nums ${m.netWorkingCapitalChange > 0 ? 'text-positive' : 'text-negative'}`}>{formatCurrency(m.netWorkingCapitalChange * 1000)}</td>)}</tr>
                </tbody>
              </table>
            </div>

            {/* Aging de Recebíveis */}
            <div className="gradient-card p-5 space-y-3">
              <h3 className="text-sm font-semibold">Aging de Recebíveis — Projeção por Faixa</h3>
              <p className="text-[10px] text-muted-foreground">Distribuição estimada baseada no DSO ponderado.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2 text-muted-foreground font-medium min-w-[180px]">Faixa</th>
                      {activeCycle.map(m => <th key={m.year} className="text-right px-4 py-2 text-muted-foreground font-medium min-w-[120px]">{m.year}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {['A vencer (current)', '1-30 dias', '31-60 dias', '61-90 dias', '90+ dias'].map((bucket, i) => {
                      const colors = ['text-positive', 'text-foreground', 'text-amber-400', 'text-orange-400', 'text-negative'];
                      const getDist = (dso: number) => dso <= 15 ? [0.90,0.10,0,0,0] : dso <= 30 ? [0.70,0.25,0.05,0,0] : dso <= 60 ? [0.50,0.30,0.15,0.05,0] : [0.40,0.25,0.20,0.10,0.05];
                      return (
                        <tr key={bucket} className="border-b border-border/20">
                          <td className={`px-4 py-1.5 ${colors[i]}`}>{bucket}</td>
                          {activeCycle.map(m => {
                            const val = m.receivablesBalance * getDist(m.dso)[i];
                            return <td key={m.year} className={`text-right px-4 py-1.5 tabular-nums ${colors[i]}`}>{val < 0.5 ? '—' : formatCurrency(val * 1000)}</td>;
                          })}
                        </tr>
                      );
                    })}
                    <tr className="border-t border-border font-semibold">
                      <td className="px-4 py-1.5">Total Recebíveis</td>
                      {activeCycle.map(m => <td key={m.year} className="text-right px-4 py-1.5 tabular-nums">{formatCurrency(m.receivablesBalance * 1000)}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Cash Sweep */}
            <div className="gradient-card p-5 space-y-3">
              <h3 className="text-sm font-semibold">Simulação Cash Sweep</h3>
              <p className="text-[10px] text-muted-foreground">Se saldo excede o mínimo, excedente amortiza dívida. Se fica abaixo, puxa linha de crédito.</p>
              <div className="overflow-x-auto">
                {(() => {
                  const minCash = (assumptions as any).minCashBalance ?? 500;
                  let bal = (assumptions as any).initialCashBalance ?? 0;
                  const sweepRows = activeCycle.map(m => {
                    const cashGen = m.grossRevenue - m.totalCogs - m.totalOpex;
                    const pre = bal + cashGen;
                    let sweep = 0, draw = 0;
                    if (pre > minCash) sweep = pre - minCash;
                    else if (pre < minCash) draw = Math.min(minCash - pre, 5000);
                    const post = pre - sweep + draw;
                    bal = post;
                    return { year: m.year, pre, sweep, draw, post, minCash };
                  });
                  return (
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-border">
                        <th className="text-left px-4 py-2 text-muted-foreground font-medium min-w-[200px]">Item</th>
                        {sweepRows.map(d => <th key={d.year} className="text-right px-4 py-2 text-muted-foreground font-medium min-w-[120px]">{d.year}</th>)}
                      </tr></thead>
                      <tbody>
                        <tr className="border-b border-border/20"><td className="px-4 py-1.5">Saldo Pré-Sweep</td>{sweepRows.map(d => <td key={d.year} className={`text-right px-4 py-1.5 tabular-nums ${d.pre < d.minCash ? 'text-negative' : ''}`}>{formatCurrency(d.pre * 1000)}</td>)}</tr>
                        <tr className="border-b border-border/20"><td className="px-4 py-1.5 text-muted-foreground">Saldo Mínimo Target</td>{sweepRows.map(d => <td key={d.year} className="text-right px-4 py-1.5 tabular-nums text-muted-foreground">{formatCurrency(d.minCash * 1000)}</td>)}</tr>
                        <tr className="border-b border-border/20"><td className="px-4 py-1.5 text-positive">Amortização Extra (sweep)</td>{sweepRows.map(d => <td key={d.year} className="text-right px-4 py-1.5 tabular-nums text-positive">{d.sweep > 0.5 ? formatCurrency(d.sweep * 1000) : '—'}</td>)}</tr>
                        <tr className="border-b border-border/20"><td className="px-4 py-1.5 text-negative">Drawdown Linha de Crédito</td>{sweepRows.map(d => <td key={d.year} className="text-right px-4 py-1.5 tabular-nums text-negative">{d.draw > 0.5 ? formatCurrency(d.draw * 1000) : '—'}</td>)}</tr>
                        <tr className="border-t border-border font-semibold"><td className="px-4 py-1.5">Saldo Pós-Sweep</td>{sweepRows.map(d => <td key={d.year} className={`text-right px-4 py-1.5 tabular-nums ${d.post >= d.minCash ? 'text-positive' : 'text-negative'}`}>{formatCurrency(d.post * 1000)}</td>)}</tr>
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
