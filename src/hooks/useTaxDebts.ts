import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TaxDebt {
  id: string;
  category: string; // sief_matriz | empresas_vinculadas | pgfn | municipal
  subcategory: string;
  detail: string | null;
  outstanding: number;
  items_count: number;
  status: string; // a_regularizar | em_parcelamento | a_pagar
  monthly_payment: number;
  adhesion_date: string | null;
  note: string | null;
  sort_order: number;
}

const KEY = ['tax_debts'];

export function useTaxDebts() {
  return useQuery<TaxDebt[]>({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase
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
