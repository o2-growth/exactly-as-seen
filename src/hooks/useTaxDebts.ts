import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBackendClientSafe } from '@/lib/supabase-safe';
import { toast } from 'sonner';

export interface TaxDebt {
  id: string;
  category: string;
  subcategory: string;
  detail: string | null;
  outstanding: number;
  items_count: number;
  status: string;
  monthly_payment: number;
  adhesion_date: string | null;
  note: string | null;
  sort_order: number;
}

const KEY = ['tax_debts'];

function requireClient() {
  const supabase = getBackendClientSafe();
  if (!supabase) throw new Error('Backend indisponível');
  return supabase as any;
}

export function useTaxDebts() {
  return useQuery<TaxDebt[]>({
    queryKey: KEY,
    queryFn: async () => {
      const supabase = getBackendClientSafe();
      if (!supabase) return [];
      const { data, error } = await (supabase as any)
        .from('tax_debts')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaxDebt[];
    },
  });
}

export function useUpdateTaxDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<TaxDebt> & { id: string }) => {
      const supabase = requireClient();
      const { id, ...rest } = payload;
      const { error } = await supabase.from('tax_debts').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Dívida tributária atualizada');
    },
    onError: (e: any) => toast.error('Erro ao salvar: ' + e.message),
  });
}

export function useDeleteTaxDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = requireClient();
      const { error } = await supabase.from('tax_debts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Dívida removida');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export function useInsertTaxDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Partial<TaxDebt>, 'id'> & { category: string; subcategory: string }) => {
      const supabase = requireClient();
      const { error } = await supabase.from('tax_debts').insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Dívida adicionada');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}
