import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PnlNode } from '@/lib/pnlData';
import { Year, YEARS } from '@/lib/financialData';

interface DreDataResponse {
  pnlTree: RawPnlNode[];
  years: number[];
  periods: string[];
  meta: { groupCount: number; dataRowCount: number; itemCount: number };
}

interface RawPnlNode {
  code: string;
  label: string;
  annual: Record<string, number>;
  monthly?: Record<string, number[]>;
  isSummary?: boolean;
  isMargin?: boolean;
  isHeader?: boolean;
  children?: RawPnlNode[];
}

// Convert raw DB node (with string keys, values in R$) to PnlNode (Year keys, values in R$ mil)
function convertNode(raw: RawPnlNode): PnlNode {
  const annual = {} as Record<Year, number>;
  const monthly = {} as Record<Year, number[]>;

  for (const y of YEARS) {
    const key = String(y);
    // DB values are in R$, P&L displays in R$ mil (thousands)
    annual[y] = raw.annual[key] != null ? raw.annual[key] / 1000 : 0;

    if (raw.monthly && raw.monthly[key]) {
      monthly[y] = raw.monthly[key].map(v => (v || 0) / 1000);
    } else {
      // Distribute annual evenly if no monthly data
      monthly[y] = Array(12).fill(annual[y] / 12);
    }
  }

  const node: PnlNode = {
    code: raw.code,
    label: raw.label,
    annual,
    monthly,
    ...(raw.isSummary ? { isSummary: true } : {}),
    ...(raw.isMargin ? { isMargin: true } : {}),
    ...(raw.isHeader ? { isHeader: true } : {}),
  };

  if (raw.children && raw.children.length > 0) {
    node.children = raw.children.map(convertNode);
  }

  return node;
}

export function useDreData() {
  const [dreTree, setDreTree] = useState<PnlNode[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dreYears, setDreYears] = useState<number[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fnError } = await supabase.functions.invoke('fetch-dre-data');

        if (fnError) throw new Error(fnError.message);

        const response = data as DreDataResponse;
        const converted = response.pnlTree.map(convertNode);

        setDreTree(converted);
        setDreYears(response.years);
      } catch (err: any) {
        console.error('Error fetching DRE data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return { dreTree, loading, error, dreYears };
}
