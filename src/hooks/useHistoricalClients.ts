import { useState, useEffect } from 'react';
import { getBackendClientSafe } from '@/lib/supabase-safe';

export interface HistoricalClientData {
  period: string;           // '2025-01'
  assumption_key: string;   // 'caasEnterprise'
  category: string;         // 'Enterprise'
  is_mrr: boolean;
  client_count: number;
  total_revenue: number;
  avg_ticket: number;
  churned_clients: number;
  churn_rate: number;
}

type HistoricalDataMap = Record<string, Record<string, HistoricalClientData>>;

export function useHistoricalClients(): {
  data: HistoricalDataMap;
  loading: boolean;
} {
  const [data, setData] = useState<HistoricalDataMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      const supabase = getBackendClientSafe();
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const { data: rows, error } = await (supabase as any)
          .from('historical_clients')
          .select('*')
          .order('period', { ascending: true })
          .order('assumption_key', { ascending: true });

        if (error) {
          console.error('Error fetching historical_clients:', error);
          setLoading(false);
          return;
        }

        if (cancelled) return;

        const grouped: HistoricalDataMap = {};
        for (const row of (rows || [])) {
          const key = row.assumption_key as string;
          const period = row.period as string;
          if (!grouped[key]) grouped[key] = {};
          grouped[key][period] = {
            period,
            assumption_key: key,
            category: row.category ?? '',
            is_mrr: row.is_mrr ?? false,
            client_count: row.client_count ?? 0,
            total_revenue: row.total_revenue ?? 0,
            avg_ticket: row.avg_ticket ?? 0,
            churned_clients: row.churned_clients ?? 0,
            churn_rate: row.churn_rate ?? 0,
          };
        }

        setData(grouped);
      } catch (err) {
        console.error('Error fetching historical_clients:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}
