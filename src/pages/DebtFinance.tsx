import { useState, useMemo } from 'react';
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { formatCurrency, formatPercent } from '@/lib/formatters';
import {
  useFinancialDebts, useUpdateFinancialDebt, useDeleteFinancialDebt, useInsertFinancialDebt,
  type FinancialDebt,
} from '@/hooks/useFinancialDebts';
import {
  useTaxDebts, useUpdateTaxDebt, useDeleteTaxDebt, useInsertTaxDebt,
  type TaxDebt,
} from '@/hooks/useTaxDebts';
import { useDebtSchedule } from '@/hooks/useDebtSchedule';
import { Plus, Trash2, Pencil, Save, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatDate = (d: string | null) => {
  if (!d) return '-';
  try { return format(parseISO(d), 'dd/MM/yyyy'); } catch { return d; }
};

const categoryLabels: Record<string, string> = {
  debenture: 'Debênture',
  bank: 'Bancário',
  securitizadora: 'Securitizadora',
};

const taxCategoryLabels: Record<string, string> = {
  sief_matriz: 'SIEF (RFB)',
  empresas_vinculadas: 'Empresas Vinculadas',
  pgfn: 'PGFN',
  municipal: 'Municipal',
};

const statusBadge = (status: string) => {
  if (status === 'atraso') return <Badge variant="destructive">Em Atraso</Badge>;
  if (status === 'em_parcelamento') return <Badge className="bg-primary/20 text-primary border-primary/30">Em Parcelamento</Badge>;
  if (status === 'a_regularizar') return <Badge variant="destructive" className="bg-warning/20 text-warning border-warning/30">A Regularizar</Badge>;
  if (status === 'a_pagar') return <Badge className="bg-warning/20 text-warning border-warning/30">A Pagar</Badge>;
  return <Badge variant="outline">Em Dia</Badge>;
};

export default function DebtFinance() {
  const { projections } = useFinancialModel();
  const { data: financialDebts = [] } = useFinancialDebts();
  const { data: taxDebts = [] } = useTaxDebts();
  const { data: schedule = [] } = useDebtSchedule();

  const updateFinDebt = useUpdateFinancialDebt();
  const deleteFinDebt = useDeleteFinancialDebt();
  const insertFinDebt = useInsertFinancialDebt();
  const updateTaxDebt = useUpdateTaxDebt();
  const deleteTaxDebt = useDeleteTaxDebt();
  const insertTaxDebt = useInsertTaxDebt();

  const [editingFinId, setEditingFinId] = useState<string | null>(null);
  const [editFinDraft, setEditFinDraft] = useState<Partial<FinancialDebt>>({});
  const [editingTaxId, setEditingTaxId] = useState<string | null>(null);
  const [editTaxDraft, setEditTaxDraft] = useState<Partial<TaxDebt>>({});

  // ===== KPIs =====
  const kpis = useMemo(() => {
    const totalFin = financialDebts.reduce((s, d) => s + Number(d.outstanding), 0);
    const totalTax = taxDebts.reduce((s, d) => s + Number(d.outstanding), 0);
    const total = totalFin + totalTax;
    const overdue = financialDebts.reduce((s, d) => s + Number(d.overdue_amount || 0), 0);
    const monthlyPgfn = taxDebts
      .filter(d => d.category === 'pgfn')
      .reduce((s, d) => s + Number(d.monthly_payment), 0);
    const ebitda2025 = projections.ebitda?.[2025] ?? 0;
    const debtToEbitda = ebitda2025 > 0 ? total / ebitda2025 : 0;
    const monthlyService =
      financialDebts.reduce((s, d) => s + Number(d.monthly_payment), 0) +
      taxDebts.reduce((s, d) => s + Number(d.monthly_payment), 0);
    return { totalFin, totalTax, total, overdue, monthlyPgfn, debtToEbitda, monthlyService };
  }, [financialDebts, taxDebts, projections]);

  // ===== Categoria breakdown =====
  const breakdown = useMemo(() => {
    const total = kpis.total || 1;
    const rows: Array<{ cat: string; sub: string; saldo: number; pct: number; status: string; detail: string }> = [];
    financialDebts.forEach(d => rows.push({
      cat: 'FINANCEIRO', sub: categoryLabels[d.category] ?? d.category,
      saldo: Number(d.outstanding), pct: Number(d.outstanding) / total,
      status: d.status, detail: d.creditor ?? d.name,
    }));
    // Agrupar tributários por categoria
    const taxGroups: Record<string, { saldo: number; details: string[]; status: string }> = {};
    taxDebts.forEach(d => {
      const k = d.category;
      if (!taxGroups[k]) taxGroups[k] = { saldo: 0, details: [], status: d.status };
      taxGroups[k].saldo += Number(d.outstanding);
      taxGroups[k].details.push(d.subcategory);
    });
    Object.entries(taxGroups).forEach(([k, g]) => rows.push({
      cat: 'TRIBUTÁRIO', sub: taxCategoryLabels[k] ?? k,
      saldo: g.saldo, pct: g.saldo / total, status: g.status,
      detail: g.details.length > 2 ? `${g.details.length} itens` : g.details.join(', '),
    }));
    return rows;
  }, [financialDebts, taxDebts, kpis.total]);

  // ===== Schedule chart =====
  const chartData = useMemo(() => schedule.map(r => ({
    period: format(parseISO(r.month), 'MMM/yy', { locale: ptBR }),
    'Karen': Number(r.karen_debentures),
    'Paulo': Number(r.paulo_edi),
    'Santander': Number(r.santander),
    'CEF': Number(r.cef_pronampe),
    'Guardian': Number(r.guardian),
    'PGFN': Number(r.pgfn_total),
    'Municipais': Number(r.municipal_total),
  })), [schedule]);

  const seriesColors: Record<string, string> = {
    Karen: 'hsl(217 91% 60%)',
    Paulo: 'hsl(280 70% 60%)',
    Santander: 'hsl(0 84% 60%)',
    CEF: 'hsl(38 92% 50%)',
    Guardian: 'hsl(0 70% 40%)',
    PGFN: 'hsl(150 60% 45%)',
    Municipais: 'hsl(195 70% 50%)',
  };

  const pieData = [
    { name: 'Financeiro', value: kpis.totalFin, color: 'hsl(217 91% 60%)' },
    { name: 'Tributário', value: kpis.totalTax, color: 'hsl(38 92% 50%)' },
  ];

  const sief = taxDebts.filter(d => d.category === 'sief_matriz' || d.category === 'empresas_vinculadas');
  const pgfn = taxDebts.filter(d => d.category === 'pgfn');
  const municipal = taxDebts.filter(d => d.category === 'municipal');

  const startEditFin = (d: FinancialDebt) => { setEditingFinId(d.id); setEditFinDraft(d); };
  const cancelEditFin = () => { setEditingFinId(null); setEditFinDraft({}); };
  const saveEditFin = async () => {
    if (!editingFinId) return;
    await updateFinDebt.mutateAsync({ id: editingFinId, ...editFinDraft });
    cancelEditFin();
  };

  const startEditTax = (d: TaxDebt) => { setEditingTaxId(d.id); setEditTaxDraft(d); };
  const cancelEditTax = () => { setEditingTaxId(null); setEditTaxDraft({}); };
  const saveEditTax = async () => {
    if (!editingTaxId) return;
    await updateTaxDebt.mutateAsync({ id: editingTaxId, ...editTaxDraft });
    cancelEditTax();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-primary">Endividamento O2 Inc</h2>
        <p className="text-xs text-muted-foreground mt-1">Posição em 26/04/2026 · Dívidas financeiras + débitos e parcelamentos tributários</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">Dívida Total</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.total)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Financeiro + Tributário</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">Financeiro</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.totalFin)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{formatPercent((kpis.totalFin / (kpis.total || 1)) * 100)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">Tributário</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(kpis.totalTax)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{formatPercent((kpis.totalTax / (kpis.total || 1)) * 100)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-destructive" /> Em Atraso (Fin.)
          </p>
          <p className="text-2xl font-bold text-destructive">{formatCurrency(kpis.overdue)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">PGFN mensal: {formatCurrency(kpis.monthlyPgfn)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="kpi-card md:col-span-2">
          <p className="text-xs text-muted-foreground mb-1">Serviço Mensal Total</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(kpis.monthlyService)}</p>
        </div>
        <div className="kpi-card">
          <p className="text-xs text-muted-foreground mb-1">Dívida / EBITDA 2025</p>
          <p className="text-xl font-bold text-foreground">{kpis.debtToEbitda.toFixed(1)}x</p>
        </div>
      </div>

      {/* Composição por Categoria */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Composição por Categoria</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 text-muted-foreground font-medium">Categoria</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Subcategoria</th>
                <th className="text-right p-3 text-muted-foreground font-medium">Saldo</th>
                <th className="text-right p-3 text-muted-foreground font-medium">% Total</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Detalhe</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((r, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="p-3 text-xs font-semibold text-primary">{r.cat}</td>
                  <td className="p-3 font-medium text-foreground">{r.sub}</td>
                  <td className="text-right p-3 tabular-nums">{formatCurrency(r.saldo)}</td>
                  <td className="text-right p-3 tabular-nums text-muted-foreground">{(r.pct * 100).toFixed(1)}%</td>
                  <td className="p-3">{statusBadge(r.status)}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.detail}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-primary/40 font-bold">
                <td className="p-3 text-primary" colSpan={2}>TOTAL GERAL</td>
                <td className="text-right p-3 tabular-nums text-primary">{formatCurrency(kpis.total)}</td>
                <td className="text-right p-3">100%</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Dívidas Financeiras */}
      <div className="gradient-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Dívidas Financeiras — Detalhe</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Saldo total: {formatCurrency(kpis.totalFin)}</p>
          </div>
          <Button
            variant="outline" size="sm" className="gap-1.5"
            onClick={() => insertFinDebt.mutate({
              name: 'Nova Dívida', category: 'bank', creditor: '', original_amount: 0,
              total_paid: 0, outstanding: 0, monthly_payment: 0, sort_order: financialDebts.length + 1,
              status: 'em_dia',
            })}
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 text-muted-foreground font-medium">Dívida</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Tipo</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Original</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Pago</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Saldo</th>
                <th className="text-left p-2 text-muted-foreground font-medium">% Pago</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Parc. Rest.</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Parc. Mensal</th>
                <th className="text-right p-2 text-muted-foreground font-medium">Próx. Vcto</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Status</th>
                <th className="p-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {financialDebts.map(d => {
                const isEdit = editingFinId === d.id;
                const draft = isEdit ? editFinDraft : d;
                const pctPaid = Number(d.original_amount) > 0
                  ? (Number(d.total_paid) / Number(d.original_amount)) * 100 : 0;
                return (
                  <tr key={d.id} className="border-b border-border/50">
                    <td className="p-2">
                      {isEdit
                        ? <Input className="h-8 text-xs" value={draft.name ?? ''}
                            onChange={e => setEditFinDraft({ ...draft, name: e.target.value })} />
                        : <span className="font-medium text-foreground text-xs">{d.name}</span>}
                    </td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-[10px]">{categoryLabels[d.category] ?? d.category}</Badge>
                    </td>
                    <td className="text-right p-2 tabular-nums text-xs">
                      {isEdit
                        ? <Input type="number" className="h-8 text-xs text-right"
                            value={draft.original_amount ?? 0}
                            onChange={e => setEditFinDraft({ ...draft, original_amount: +e.target.value })} />
                        : formatCurrency(Number(d.original_amount))}
                    </td>
                    <td className="text-right p-2 tabular-nums text-xs">
                      {isEdit
                        ? <Input type="number" className="h-8 text-xs text-right"
                            value={draft.total_paid ?? 0}
                            onChange={e => setEditFinDraft({ ...draft, total_paid: +e.target.value })} />
                        : formatCurrency(Number(d.total_paid))}
                    </td>
                    <td className="text-right p-2 tabular-nums text-xs font-semibold">
                      {isEdit
                        ? <Input type="number" className="h-8 text-xs text-right"
                            value={draft.outstanding ?? 0}
                            onChange={e => setEditFinDraft({ ...draft, outstanding: +e.target.value })} />
                        : formatCurrency(Number(d.outstanding))}
                    </td>
                    <td className="p-2 min-w-[100px]">
                      <div className="flex items-center gap-2">
                        <Progress value={pctPaid} className="h-1.5" />
                        <span className="text-[10px] text-muted-foreground tabular-nums">{pctPaid.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="text-right p-2 tabular-nums text-xs">
                      {isEdit
                        ? <Input type="number" className="h-8 text-xs text-right w-16"
                            value={draft.remaining_installments ?? 0}
                            onChange={e => setEditFinDraft({ ...draft, remaining_installments: +e.target.value })} />
                        : d.remaining_installments}
                    </td>
                    <td className="text-right p-2 tabular-nums text-xs text-destructive">
                      {isEdit
                        ? <Input type="number" className="h-8 text-xs text-right"
                            value={draft.monthly_payment ?? 0}
                            onChange={e => setEditFinDraft({ ...draft, monthly_payment: +e.target.value })} />
                        : formatCurrency(-Number(d.monthly_payment))}
                    </td>
                    <td className="text-right p-2 text-xs text-muted-foreground">{formatDate(d.next_due_date)}</td>
                    <td className="p-2">{statusBadge(d.status)}</td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        {isEdit ? (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEditFin}><Save className="h-3.5 w-3.5 text-primary" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEditFin}><X className="h-3.5 w-3.5" /></Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditFin(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteFinDebt.mutate(d.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tributário - 3 sub-blocos */}
      <TaxBlock title="A Regularizar (SIEF + Empresas Vinculadas)" subtitle={`Saldo: ${formatCurrency(sief.reduce((s, d) => s + Number(d.outstanding), 0))}`}
        debts={sief} editingId={editingTaxId} editDraft={editTaxDraft}
        onStartEdit={startEditTax} onCancel={cancelEditTax} onSave={saveEditTax} setDraft={setEditTaxDraft}
        onDelete={(id) => deleteTaxDebt.mutate(id)}
        onAdd={() => insertTaxDebt.mutate({ category: 'sief_matriz', subcategory: 'Novo Débito', outstanding: 0, items_count: 1, status: 'a_regularizar', sort_order: taxDebts.length + 1 })}
      />

      <TaxBlock title={`PGFN — 4 parcelamentos · Mensal R$ ${kpis.monthlyPgfn.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
        subtitle={`Saldo: ${formatCurrency(pgfn.reduce((s, d) => s + Number(d.outstanding), 0))}`}
        debts={pgfn} editingId={editingTaxId} editDraft={editTaxDraft}
        onStartEdit={startEditTax} onCancel={cancelEditTax} onSave={saveEditTax} setDraft={setEditTaxDraft}
        onDelete={(id) => deleteTaxDebt.mutate(id)}
        onAdd={() => insertTaxDebt.mutate({ category: 'pgfn', subcategory: 'PGFN Novo', outstanding: 0, items_count: 60, monthly_payment: 0, status: 'em_parcelamento', sort_order: taxDebts.length + 1 })}
      />

      <TaxBlock title="Parcelamentos Municipais" subtitle={`Saldo: ${formatCurrency(municipal.reduce((s, d) => s + Number(d.outstanding), 0))}`}
        debts={municipal} editingId={editingTaxId} editDraft={editTaxDraft}
        onStartEdit={startEditTax} onCancel={cancelEditTax} onSave={saveEditTax} setDraft={setEditTaxDraft}
        onDelete={(id) => deleteTaxDebt.mutate(id)}
        onAdd={() => insertTaxDebt.mutate({ category: 'municipal', subcategory: 'Município Novo', outstanding: 0, items_count: 1, monthly_payment: 0, status: 'em_parcelamento', sort_order: taxDebts.length + 1 })}
      />

      {/* Cronograma de Pagamentos */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Cronograma de Pagamentos — Projeção Mensal</h3>
        <p className="text-xs text-muted-foreground mb-4">Saldo a vencer agrupado por mês — Dívidas financeiras + parcelamentos PGFN/Municipais</p>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 22%)" />
            <XAxis dataKey="period" stroke="hsl(215 20% 55%)" fontSize={10} interval={2} angle={-45} textAnchor="end" height={60} />
            <YAxis stroke="hsl(215 20% 55%)" fontSize={11}
              tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: 'hsl(210 40% 98%)' }}
              formatter={(v: number) => formatCurrency(v)}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {Object.keys(seriesColors).map((name) => (
              <Bar key={name} dataKey={name} stackId="a" fill={seriesColors[name]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pizza Financeiro vs Tributário */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Composição: Financeiro vs Tributário</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => `${e.name}: ${formatCurrency(e.value)}`}>
                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)}
                contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="gradient-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Notas</h3>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li>• Endividamento financeiro extraído das exportações de "Visão Contas a Pagar".</li>
            <li>• Endividamento tributário consolidado a partir do relatório de Débitos Tributários O2 INC (RFB / PGFN / Municipais).</li>
            <li>• Saldos tributários incluem multa, juros e encargos quando aplicável (saldo consolidado).</li>
            <li>• Parcelamentos PGFN: saldo devedor com juros — posição mais recente disponível.</li>
            <li>• "Em atraso" no KPI principal refere-se apenas às dívidas financeiras (Guardian + 1 parcela CEF).</li>
            <li className="text-primary">• Edite qualquer linha clicando no ícone de lápis. Alterações são salvas no banco.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ===== Sub-block para tributário =====
function TaxBlock({
  title, subtitle, debts, editingId, editDraft, setDraft,
  onStartEdit, onCancel, onSave, onDelete, onAdd,
}: {
  title: string; subtitle: string; debts: TaxDebt[];
  editingId: string | null; editDraft: Partial<TaxDebt>;
  setDraft: (d: Partial<TaxDebt>) => void;
  onStartEdit: (d: TaxDebt) => void; onCancel: () => void; onSave: () => void;
  onDelete: (id: string) => void; onAdd: () => void;
}) {
  if (debts.length === 0 && !editingId) return null;
  return (
    <div className="gradient-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-2 text-muted-foreground font-medium">Subcategoria</th>
              <th className="text-left p-2 text-muted-foreground font-medium">Detalhe</th>
              <th className="text-right p-2 text-muted-foreground font-medium">Saldo</th>
              <th className="text-right p-2 text-muted-foreground font-medium">Itens</th>
              <th className="text-right p-2 text-muted-foreground font-medium">Parc. Mensal</th>
              <th className="text-left p-2 text-muted-foreground font-medium">Status</th>
              <th className="p-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {debts.map(d => {
              const isEdit = editingId === d.id;
              const draft = isEdit ? editDraft : d;
              return (
                <tr key={d.id} className="border-b border-border/50">
                  <td className="p-2 text-xs font-medium text-foreground">
                    {isEdit
                      ? <Input className="h-8 text-xs" value={draft.subcategory ?? ''}
                          onChange={e => setDraft({ ...draft, subcategory: e.target.value })} />
                      : d.subcategory}
                  </td>
                  <td className="p-2 text-xs text-muted-foreground max-w-[300px]">
                    {isEdit
                      ? <Input className="h-8 text-xs" value={draft.detail ?? ''}
                          onChange={e => setDraft({ ...draft, detail: e.target.value })} />
                      : d.detail}
                  </td>
                  <td className="text-right p-2 tabular-nums text-xs font-semibold">
                    {isEdit
                      ? <Input type="number" className="h-8 text-xs text-right"
                          value={draft.outstanding ?? 0}
                          onChange={e => setDraft({ ...draft, outstanding: +e.target.value })} />
                      : formatCurrency(Number(d.outstanding))}
                  </td>
                  <td className="text-right p-2 tabular-nums text-xs">
                    {isEdit
                      ? <Input type="number" className="h-8 text-xs text-right w-16"
                          value={draft.items_count ?? 0}
                          onChange={e => setDraft({ ...draft, items_count: +e.target.value })} />
                      : d.items_count}
                  </td>
                  <td className="text-right p-2 tabular-nums text-xs text-destructive">
                    {isEdit
                      ? <Input type="number" className="h-8 text-xs text-right"
                          value={draft.monthly_payment ?? 0}
                          onChange={e => setDraft({ ...draft, monthly_payment: +e.target.value })} />
                      : Number(d.monthly_payment) > 0 ? formatCurrency(-Number(d.monthly_payment)) : '-'}
                  </td>
                  <td className="p-2">{statusBadge(d.status)}</td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      {isEdit ? (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSave}><Save className="h-3.5 w-3.5 text-primary" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}><X className="h-3.5 w-3.5" /></Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onStartEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(d.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
