import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBackendClientSafe } from '@/lib/supabase-safe';
import { toast } from 'sonner';

export interface FinancialDebt {
  id: string;
  name: string;
  category: string;
  creditor: string | null;
  original_amount: number;
  total_paid: number;
  outstanding: number;
  total_installments: number;
  paid_installments: number;
  remaining_installments: number;
  overdue_installments: number;
  overdue_amount: number;
  monthly_payment: number;
  interest_rate: number;
  start_date: string | null;
  next_due_date: string | null;
  last_payment_date: string | null;
  status: string;
  notes: string | null;
  sort_order: number;
}

const KEY = ['financial_debts'];

function requireClient() {
  const supabase = getBackendClientSafe();
  if (!supabase) throw new Error('Backend indisponível');
  return supabase as any;
}

export function useFinancialDebts() {
  return useQuery<FinancialDebt[]>({
    queryKey: KEY,
    queryFn: async () => {
      const supabase = getBackendClientSafe();
      if (!supabase) return [];
      const { data, error } = await (supabase as any)
        .from('financial_debts')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as FinancialDebt[];
    },
  });
}

export function useUpdateFinancialDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<FinancialDebt> & { id: string }) => {
      const supabase = requireClient();
      const { id, ...rest } = payload;
      const { error } = await supabase.from('financial_debts').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Dívida atualizada');
    },
    onError: (e: any) => toast.error('Erro ao salvar: ' + e.message),
  });
}

export function useDeleteFinancialDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = requireClient();
      const { error } = await supabase.from('financial_debts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Dívida removida');
    },
    onError: (e: any) => toast.error('Erro ao remover: ' + e.message),
  });
}

export function useInsertFinancialDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Partial<FinancialDebt>, 'id'> & { name: string; category: string }) => {
      const supabase = requireClient();
      const { error } = await supabase.from('financial_debts').insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Dívida adicionada');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}
