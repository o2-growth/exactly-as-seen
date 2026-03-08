import { useState, useCallback } from 'react';
import { useFinancialModel } from '@/contexts/FinancialModelContext';
import { useOxyData } from '@/hooks/useOxyData';
import { YEARS } from '@/lib/financialData';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/formatters';
import { Database, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fetchOxyActuals } from '@/services/oxyApi';

type ActualYear = 2025 | 2026 | 2027 | 2028 | 2029 | 2030;

interface MetricRow {
  key: string;
  label: string;
  getProjected: (year: ActualYear) => number;
  getActual: (year: ActualYear) => number | null;
  format: (v: number) => string;
  isPercent?: boolean;
}

export default function Actuals() {
  const { projections } = useFinancialModel();
  const { data, loading, error, isConfigured } = useOxyData();
  const [refreshing, setRefreshing] = useState(false);

  // Aggregate Oxy revenue by year
  const actualRevenueByYear = useCallback((year: ActualYear): number | null => {
    if (!data || data.revenue.length === 0) return null;
    const yearStr = `${year}-`;
    const yearRevenue = data.revenue
      .filter(r => r.month.startsWith(yearStr))
      .reduce((sum, r) => sum + r.grossRevenue, 0);
    return yearRevenue > 0 ? yearRevenue : null;
  }, [data]);

  const actualNetRevenueByYear = useCallback((year: ActualYear): number | null => {
    if (!data || data.revenue.length === 0) return null;
    const yearStr = `${year}-`;
    const yearRevenue = data.revenue
      .filter(r => r.month.startsWith(yearStr))
      .reduce((sum, r) => sum + r.netRevenue, 0);
    return yearRevenue > 0 ? yearRevenue : null;
  }, [data]);

  const actualClientsByYear = useCallback((year: ActualYear): number | null => {
    if (!data || data.clients.length === 0) return null;
    // Get last month of the year for total active clients
    const yearStr = `${year}-12`;
    const lastMonth = data.clients
      .filter(c => c.month === yearStr)
      .reduce((sum, c) => sum + c.activeClients, 0);
    return lastMonth > 0 ? lastMonth : null;
  }, [data]);

  const metrics: MetricRow[] = [
    {
      key: 'grossRevenue',
      label: 'Receita Bruta',
      getProjected: (y) => projections.grossRevenue[y],
      getActual: actualRevenueByYear,
      format: formatCurrency,
    },
    {
      key: 'netRevenue',
      label: 'Receita Líquida',
      getProjected: (y) => projections.netRevenue[y],
      getActual: actualNetRevenueByYear,
      format: formatCurrency,
    },
    {
      key: 'ebitda',
      label: 'EBITDA',
      getProjected: (y) => projections.ebitda[y],
      getActual: () => null, // EBITDA will need cost data from API
      format: formatCurrency,
    },
    {
      key: 'totalClients',
      label: 'Clientes Totais',
      getProjected: (y) => projections.totalClients[y],
      getActual: actualClientsByYear,
      format: formatNumber,
    },
  ];

  const handleRefresh = async () => {
    if (!isConfigured) return;
    setRefreshing(true);
    try {
      await fetchOxyActuals('2025-01', '2030-12');
    } finally {
      setRefreshing(false);
    }
  };

  const calcVariation = (actual: number | null, projected: number): number | null => {
    if (actual === null || projected === 0) return null;
    return ((actual - projected) / Math.abs(projected)) * 100;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Realizado vs Projetado</h2>
        </div>
        <button
          onClick={handleRefresh}
          disabled={!isConfigured || refreshing}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            isConfigured
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-secondary text-muted-foreground cursor-not-allowed'
          }`}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar Dados
        </button>
      </div>

      {/* API Status Banner */}
      {!isConfigured && (
        <div className="gradient-card p-5 border-l-4 border-l-yellow-500/60">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Conecte a API da Oxy para visualizar dados reais
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Configure a variável de ambiente <code className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono">VITE_OXY_API_URL</code> no
                arquivo <code className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono">.env</code> com a URL base da API da plataforma Oxy.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Enquanto a API não estiver conectada, a coluna "Realizado" mostrará "—" e os valores projetados do modelo financeiro serão exibidos normalmente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="gradient-card p-5 border-l-4 border-l-red-500/60">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Erro ao carregar dados</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Last Updated */}
      {data?.lastUpdated && (
        <p className="text-xs text-muted-foreground">
          Última atualização: {new Date(data.lastUpdated).toLocaleString('pt-BR')}
        </p>
      )}

      {/* Main Table by Year */}
      {YEARS.map(year => (
        <div key={year} className="gradient-card overflow-x-auto">
          <div className="flex items-center gap-2 p-5 pb-3">
            <h3 className="text-sm font-semibold">{year}</h3>
            {year <= 2025 && (
              <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                Ano corrente
              </span>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-muted-foreground font-medium min-w-[180px]">Métrica</th>
                <th className="text-right p-4 text-muted-foreground font-medium">Realizado</th>
                <th className="text-right p-4 text-muted-foreground font-medium">Projetado</th>
                <th className="text-right p-4 text-muted-foreground font-medium min-w-[120px]">Variação</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(metric => {
                const projected = metric.getProjected(year);
                const actual = metric.getActual(year);
                const variation = calcVariation(actual, projected);

                return (
                  <tr key={metric.key} className="border-b border-border/30 hover:bg-secondary/20 transition-colors">
                    <td className="p-4 font-medium">{metric.label}</td>
                    <td className="text-right p-4 tabular-nums">
                      {actual !== null ? (
                        <span className="font-semibold">{metric.format(actual)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-right p-4 tabular-nums text-muted-foreground">
                      {metric.format(projected)}
                    </td>
                    <td className="text-right p-4 tabular-nums">
                      {variation !== null ? (
                        <span className={`inline-flex items-center gap-1 font-semibold ${
                          variation > 0 ? 'text-positive' : variation < 0 ? 'text-negative' : 'text-muted-foreground'
                        }`}>
                          {variation > 0 ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : variation < 0 ? (
                            <TrendingDown className="h-3.5 w-3.5" />
                          ) : (
                            <Minus className="h-3.5 w-3.5" />
                          )}
                          {variation > 0 ? '+' : ''}{formatPercent(variation)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* Footer note */}
      <div className="text-center py-4">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Valores projetados calculados pelo modelo financeiro v7 · Valores realizados via API Oxy
          <br />
          Variação = (Realizado − Projetado) / |Projetado| × 100
        </p>
      </div>
    </div>
  );
}
