import { useState, useEffect } from 'react';


export interface OxyChartItem {
  month: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

export interface OxyDetailItem {
  label: string;
  type: string; // 'supplier' | 'customer'
  data: { period: string; value: number }[];
}

export interface OxyCashFlowData {
  chart: OxyChartItem[];
  recebido: OxyDetailItem[];
  pago: OxyDetailItem[];
  periods: string[];
}

export function useOxyCashFlow(startDate: string, endDate: string, enabled: boolean) {
  const [data, setData] = useState<OxyCashFlowData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const { data: raw, error: fnError } = await supabase.functions.invoke(
          'fetch-oxy-cashflow',
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            body: undefined,
          }
        );

        // Since invoke doesn't support query params natively, we'll use a POST approach
        // Actually let's call with the URL directly
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const url = `https://${projectId}.supabase.co/functions/v1/fetch-oxy-cashflow?startDate=${startDate}&endDate=${endDate}`;
        
        const response = await fetch(url, {
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();

        if (cancelled) return;

        // Parse chart data
        const chart: OxyChartItem[] = (result.chart?.data?.items || []).map((item: any) => {
          const values = item.values || [];
          const entradas = values.find((v: any) => v.label === 'Entradas')?.value || 0;
          const saidas = values.find((v: any) => v.label === 'Saídas')?.value || 0;
          const saldo = values.find((v: any) => v.label === 'Saldo')?.value || 0;
          return { month: item.month, entradas, saidas, saldo };
        });

        // Parse card details
        const recebido: OxyDetailItem[] = (result.cardRecebido?.data?.data || []).map((item: any) => ({
          label: item.label,
          type: item.type,
          data: (item.data || []).filter((d: any) => d.period !== 'Total'),
        }));

        const pago: OxyDetailItem[] = (result.cardPago?.data?.data || []).map((item: any) => ({
          label: item.label,
          type: item.type,
          data: (item.data || []).filter((d: any) => d.period !== 'Total'),
        }));

        const periods: string[] = result.cardRecebido?.data?.periods?.filter((p: string) => p !== 'Total') || [];

        setData({ chart, recebido, pago, periods });
      } catch (err: any) {
        if (!cancelled) {
          console.error('Error fetching Oxy cash flow:', err);
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [startDate, endDate, enabled]);

  return { data, loading, error };
}
