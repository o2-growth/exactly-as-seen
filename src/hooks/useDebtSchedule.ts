import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DebtScheduleRow {
  id: string;
  month: string; // YYYY-MM-DD
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
      const { data, error } = await supabase
        .from('debt_payment_schedule')
        .select('*')
        .order('month', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DebtScheduleRow[];
    },
  });
}
