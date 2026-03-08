import { useState, useEffect } from 'react';
import { OxyActualData, fetchOxyActuals, isOxyApiConfigured } from '@/services/oxyApi';

export function useOxyData(startYear: number = 2024, endYear: number = 2026) {
  const [data, setData] = useState<OxyActualData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured] = useState(isOxyApiConfigured);

  useEffect(() => {
    if (!isConfigured) return;

    setLoading(true);
    fetchOxyActuals(`${startYear}-01`, `${endYear}-12`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [startYear, endYear, isConfigured]);

  return { data, loading, error, isConfigured };
}
