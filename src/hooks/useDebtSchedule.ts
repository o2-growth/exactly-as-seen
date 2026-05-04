import { useQuery } from '@tanstack/react-query';
import { getBackendClientSafe } from '@/lib/supabase-safe';

export interface DebtScheduleRow {
  id: string;
  month: string;
  karen_debentures: number;
  paulo_edi: number;
  santander: number;
  cef_pronampe: number;
  guardian: number;
  pgfn_total: number;
  municipal_total: number;
  total_month: number;
}

export function useDebtSchedule() {
  return useQuery<DebtScheduleRow[]>({
    queryKey: ['debt_payment_schedule'],
    queryFn: async () => {
      const supabase = getBackendClientSafe();
      if (!supabase) return [];
      const { data, error } = await (supabase as any)
        .from('debt_payment_schedule')
        .select('*')
        .order('month', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DebtScheduleRow[];
    },
  });
}
