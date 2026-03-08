import { useState, useCallback, useMemo } from 'react';
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { useVersionHistory } from '@/contexts/VersionHistoryContext';
import { YEARS, Year, Assumptions as AssumptionsType, HEADCOUNT, SUB_PRODUCT_LABELS, SubProductClients } from '@/lib/financialData';
import { formatCurrency, formatCurrencyFull } from '@/lib/formatters';
import { Lock, Unlock, Save, X, RotateCcw, Scale, Receipt, Users, Landmark, Info, BadgePercent, Building2, CreditCard, Calendar, UserCheck } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { debtSchedule, headcountRatios, salaryRanges, commissionRate } from '@/data/modelData';

type TicketKey = keyof AssumptionsType['tickets'];
type SubProductKey = keyof SubProductClients;

function CellInput({ value, editing, onChange }: { value: number; editing: boolean; onChange: (v: number) => void }) {
  if (!editing) {
    return <span className="tabular-nums">{value.toLocaleString('pt-BR')}</span>;
  }
  return (
    <input
      type="number"
      className="w-full bg-secondary border border-primary/30 rounded px-2 py-1 text-right text-sm tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
      value={value}
      onChange={e => onChange(Number(e.target.value) || 0)}
    />
  );
}

export default function Assumptions() {
  const { assumptions, setAssumptions, resetAssumptions, scenario } = useFinancialModel();
  const { saveVersion } = useVersionHistory();

  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<AssumptionsType>(assumptions);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveNote, setSaveNote] = useState('');

  const startEditing = () => {
    setEditState({ ...assumptions });
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditState(assumptions);
    setEditing(false);
  };

  const handleSave = () => {
    setShowSaveModal(true);
  };

  const confirmSave = () => {
    if (!saveNote.trim()) return;
    setAssumptions(editState);
    saveVersion(saveNote.trim(), editState, scenario);
    setSaveNote('');
    setShowSaveModal(false);
    setEditing(false);
  };

  // Update helpers
  const updateSubProduct = (key: SubProductKey, year: Year, val: number) => {
    setEditState(prev => ({
      ...prev,
      subProductClients: {
        ...prev.subProductClients,
        [key]: { ...prev.subProductClients[key], [year]: val },
      },
    }));
  };

  const updateTicket = (key: TicketKey, val: number) => {
    setEditState(prev => ({
      ...prev,
      tickets: { ...prev.tickets, [key]: val },
    }));
  };

  const updateSalary = (role: string, val: number) => {
    setEditState(prev => ({
      ...prev,
      headcountSalaries: { ...prev.headcountSalaries, [role]: val },
    }));
  };

  const data = editing ? editState : assumptions;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Assumptions</h2>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                <Save className="h-3.5 w-3.5" /> Save
              </button>
              <button onClick={cancelEditing} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={startEditing} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-primary/40 rounded-lg text-primary hover:bg-primary/10 transition-colors">
                <Unlock className="h-3.5 w-3.5" /> Edit Assumptions
              </button>
              <button onClick={resetAssumptions} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </>
          )}
        </div>
      </div>

      {!editing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Cells are locked. Click "Edit Assumptions" to modify.
        </div>
      )}

      {/* 1. Client Growth */}
      <div className="gradient-card overflow-x-auto">
        <h3 className="text-sm font-semibold p-5 pb-3">Client Growth — Monthly New Targets</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-muted-foreground font-medium min-w-[180px]">Sub-Product</th>
              {YEARS.map(y => (
                <th key={y} className="text-right p-3 text-muted-foreground font-medium min-w-[90px]">{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(SUB_PRODUCT_LABELS) as SubProductKey[]).map(key => (
              <tr key={key} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                <td className="p-3 font-medium">{SUB_PRODUCT_LABELS[key]}</td>
                {YEARS.map(y => (
                  <td key={y} className="text-right p-3">
                    <CellInput
                      value={data.subProductClients[key][y]}
                      editing={editing}
                      onChange={v => updateSubProduct(key, y, v)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2. Average Tickets */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold mb-4">Average Ticket (BRL/month)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.keys(SUB_PRODUCT_LABELS) as TicketKey[]).map(key => (
            <div key={key} className="space-y-1">
              <p className="text-xs text-muted-foreground">{SUB_PRODUCT_LABELS[key as SubProductKey]}</p>
              <div className="text-sm font-semibold">
                {editing ? (
                  <input
                    type="number"
                    className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm tabular-nums text-foreground outline-none focus:ring-1 focus:ring-primary"
                    value={data.tickets[key]}
                    onChange={e => updateTicket(key, Number(e.target.value) || 0)}
                  />
                ) : (
                  <span>R$ {data.tickets[key].toLocaleString('pt-BR')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Churn Rate */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold mb-4">Churn Rate (Annual %)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">CaaS</p>
            <div className="text-sm font-semibold">
              {editing ? (
                <input type="number" step="0.5" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                  value={data.churnCaas} onChange={e => setEditState(p => ({ ...p, churnCaas: Number(e.target.value) || 0 }))} />
              ) : <span>{data.churnCaas}%</span>}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">SaaS</p>
            <div className="text-sm font-semibold">
              {editing ? (
                <input type="number" step="0.5" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                  value={data.churnSaas} onChange={e => setEditState(p => ({ ...p, churnSaas: Number(e.target.value) || 0 }))} />
              ) : <span>{data.churnSaas}%</span>}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Headcount & Salaries */}
      <div className="gradient-card overflow-x-auto">
        <h3 className="text-sm font-semibold p-5 pb-3">Headcount & Salaries</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 text-muted-foreground font-medium">Role</th>
              <th className="text-left p-3 text-muted-foreground font-medium">BU</th>
              {YEARS.map(y => (
                <th key={y} className="text-right p-3 text-muted-foreground font-medium">{y}</th>
              ))}
              <th className="text-right p-3 text-muted-foreground font-medium">Salary/mo</th>
              <th className="text-right p-3 text-muted-foreground font-medium">Total Cost/mo</th>
            </tr>
          </thead>
          <tbody>
            {HEADCOUNT.map(h => {
              const salary = data.headcountSalaries[h.role] || 0;
              const lastYearHC = (h as any)[YEARS[YEARS.length - 1]] || 0;
              return (
                <tr key={h.role} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                  <td className="p-3 font-medium">{h.role}</td>
                  <td className="p-3 text-muted-foreground">{h.bu}</td>
                  {YEARS.map(y => (
                    <td key={y} className="text-right p-3 tabular-nums">{(h as any)[y].toLocaleString('pt-BR')}</td>
                  ))}
                  <td className="text-right p-3">
                    {editing ? (
                      <input type="number" className="w-24 bg-secondary border border-primary/30 rounded px-2 py-1 text-right text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                        value={salary} onChange={e => updateSalary(h.role, Number(e.target.value) || 0)} />
                    ) : (
                      <span className="tabular-nums">{formatCurrency(salary)}</span>
                    )}
                  </td>
                  <td className="text-right p-3 tabular-nums text-muted-foreground">
                    {formatCurrency(lastYearHC * salary)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 5. Cost Assumptions */}
      <div className="gradient-card p-5">
        <h3 className="text-sm font-semibold mb-4">Cost Assumptions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">SG&A % of Revenue</p>
            <div className="text-sm font-semibold">
              {editing ? (
                <input type="number" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                  value={data.sgaPercent} onChange={e => setEditState(p => ({ ...p, sgaPercent: Number(e.target.value) || 0 }))} />
              ) : <span>{data.sgaPercent}%</span>}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">SG&A Annual Growth %</p>
            <div className="text-sm font-semibold">
              {editing ? (
                <input type="number" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                  value={data.sgaGrowthRate} onChange={e => setEditState(p => ({ ...p, sgaGrowthRate: Number(e.target.value) || 0 }))} />
              ) : <span>{data.sgaGrowthRate}%</span>}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Headcount Cost Growth/yr</p>
            <div className="text-sm font-semibold">
              {editing ? (
                <input type="number" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                  value={data.headcountGrowth} onChange={e => setEditState(p => ({ ...p, headcountGrowth: Number(e.target.value) || 0 }))} />
              ) : <span>{data.headcountGrowth}%</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 6. Regime Tributário ─── */}
      <div className="gradient-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Scale className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Regime Tributário</h3>
          <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary">Transição em 2027</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <BadgePercent className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-foreground">Lucro Presumido (2025–2026)</p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>PIS 0,65% + COFINS 3,0% + ISS 5,0% + Descontos 1,0%</p>
              <p className="text-sm font-semibold text-foreground">Taxa total: 9,65%</p>
            </div>
          </div>
          <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <BadgePercent className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-foreground">Lucro Real (2027–2030)</p>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>PIS 1,65% + COFINS 7,6% + ISS 5,0% + Descontos 1,0%</p>
              <p className="text-sm font-semibold text-foreground">Taxa total: 15,25%</p>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2 mt-3 text-[11px] text-muted-foreground">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          <span>IRPJ 25% + CSLL 9% = 34% sobre lucro tributável (EBT). Aplicado em ambos os regimes.</span>
        </div>
      </div>

      {/* ─── 7. Custos e Margens ─── */}
      <div className="gradient-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Custos e Margens</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Comissão de Vendas</p>
            <p className="text-sm font-semibold">{(commissionRate.caas * 100).toFixed(0)}% da receita bruta</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Crescimento SG&A/ano</p>
            <p className="text-sm font-semibold">
              {editing ? (
                <input type="number" step="1" className="w-full bg-secondary border border-primary/30 rounded px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                  value={data.sgaGrowthRate} onChange={e => setEditState(p => ({ ...p, sgaGrowthRate: Number(e.target.value) || 0 }))} />
              ) : <span>{data.sgaGrowthRate}%</span>}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">CAPEX % do COGS SaaS</p>
            <p className="text-sm font-semibold">50% (2025–26) → 30% (2027+)</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">BaaS COGS/cliente</p>
            <p className="text-sm font-semibold">R$ 25/mês (a partir de 2027)</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">PDD (Provisão p/ Devedores)</p>
            <p className="text-sm font-semibold">2% da receita bruta</p>
          </div>
        </div>
      </div>

      {/* ─── 8. Regras de Headcount ─── */}
      <div className="gradient-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <UserCheck className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Regras de Contratação (Headcount)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ratios table */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Proporção por clientes CaaS ativos</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 text-muted-foreground font-medium text-xs">Função</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium text-xs">1 por cada</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'CFO', ratio: headcountRatios.clientsPerCFO },
                  { label: 'FP&A Analyst', ratio: headcountRatios.clientsPerFPA },
                  { label: 'Project Finance Director', ratio: headcountRatios.clientsPerPF },
                  { label: 'Project Analyst', ratio: headcountRatios.clientsPerProjectAnal },
                  { label: 'Data Processes Analyst', ratio: headcountRatios.clientsPerDataAnal },
                  { label: 'Customer Service Manager', ratio: headcountRatios.clientsPerCSM },
                ].map(row => (
                  <tr key={row.label} className="border-b border-border/30">
                    <td className="py-1.5 text-xs font-medium">{row.label}</td>
                    <td className="py-1.5 text-right text-xs tabular-nums">{row.ratio} clientes</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Salary ranges */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Faixas salariais para novas contratações</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 text-muted-foreground font-medium text-xs">Cargo</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium text-xs">Salário/mês</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(salaryRanges).map(([role, salary]) => (
                  <tr key={role} className="border-b border-border/30">
                    <td className="py-1.5 text-xs font-medium">{role}</td>
                    <td className="py-1.5 text-right text-xs tabular-nums">{formatCurrencyFull(salary)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── 9. Resumo de Dívidas ─── */}
      <div className="gradient-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Landmark className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Resumo de Dívidas</h3>
        </div>
        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Saldo Total Devedor</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrencyFull(debtSchedule.reduce((s, d) => s + d.outstanding, 0))}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Parcela Mensal Total</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrencyFull(debtSchedule.reduce((s, d) => s + d.monthlyPayment, 0))}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Nº de Contratos</p>
            <p className="text-sm font-semibold tabular-nums">{debtSchedule.length}</p>
          </div>
        </div>
        {/* Debt table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium text-xs">Contrato</th>
                <th className="text-left py-2 text-muted-foreground font-medium text-xs">Credor</th>
                <th className="text-right py-2 text-muted-foreground font-medium text-xs">Saldo (R$)</th>
                <th className="text-right py-2 text-muted-foreground font-medium text-xs">Parcela/mês</th>
                <th className="text-right py-2 text-muted-foreground font-medium text-xs">Parcelas rest.</th>
                <th className="text-right py-2 text-muted-foreground font-medium text-xs">Previsão final</th>
              </tr>
            </thead>
            <tbody>
              {debtSchedule.map(d => (
                <tr key={d.name} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                  <td className="py-2 text-xs font-medium">{d.name}</td>
                  <td className="py-2 text-xs text-muted-foreground">{d.creditor}</td>
                  <td className="py-2 text-right text-xs tabular-nums">{formatCurrencyFull(d.outstanding)}</td>
                  <td className="py-2 text-right text-xs tabular-nums">{formatCurrencyFull(d.monthlyPayment)}</td>
                  <td className="py-2 text-right text-xs tabular-nums">{d.remainingInstallments}</td>
                  <td className="py-2 text-right text-xs tabular-nums">{d.finalDate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Modal */}
      <Dialog open={showSaveModal} onOpenChange={setShowSaveModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save Assumptions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">
                Why are you changing this assumption? <span className="text-negative">*</span>
              </label>
              <textarea
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
                rows={3}
                placeholder="Describe the rationale for this change..."
                value={saveNote}
                onChange={e => setSaveNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
              <button
                disabled={!saveNote.trim()}
                onClick={confirmSave}
                className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Confirm & Save Version
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
