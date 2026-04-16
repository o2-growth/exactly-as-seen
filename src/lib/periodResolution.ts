import { HISTORICAL_PERIODS, historicalMetrics } from '@/data/historicalData';
import { YEARS, Year } from '@/lib/financialData';

export type YearDataSource = 'actual' | 'mixed' | 'projected';

const historicalMonthCountByYear = HISTORICAL_PERIODS.reduce<Record<number, number>>((acc, period) => {
  const year = Number(period.slice(0, 4));
  acc[year] = (acc[year] ?? 0) + 1;
  return acc;
}, {});

export const LATEST_HISTORICAL_YEAR = Math.max(
  ...Object.keys(historicalMonthCountByYear).map(Number),
  YEARS[0]
) as Year;

export function getHistoricalMonthCount(year: number): number {
  return historicalMonthCountByYear[year] ?? 0;
}

export function getYearDataSource(year: Year): YearDataSource {
  const months = getHistoricalMonthCount(year);
  if (months >= 12) return 'actual';
  if (months > 0) return 'mixed';
  return 'projected';
}

export function getRangeDataSource(years: Year[]): YearDataSource {
  const unique = new Set(years.map(getYearDataSource));
  if (unique.size === 1) {
    return years.length > 0 ? getYearDataSource(years[0]) : 'projected';
  }
  return 'mixed';
}

export function getSourceLabel(source: YearDataSource): string {
  if (source === 'actual') return 'Realizado';
  if (source === 'mixed') return 'Combinado';
  return 'Projetado';
}

export function getFocalYear(years: Year[]): Year {
  const yearsWithHistory = years.filter((year) => getHistoricalMonthCount(year) > 0);
  if (yearsWithHistory.length > 0) {
    return yearsWithHistory[yearsWithHistory.length - 1];
  }
  return years[0] ?? YEARS[0];
}

export function resolveAnnualMetric(metric: string, year: Year, engineAnnualValue: number): number {
  const months = getHistoricalMonthCount(year);
  if (months === 0) return engineAnnualValue;

  const metricData = historicalMetrics[metric];
  if (!metricData) return engineAnnualValue;

  let historicalSum = 0;
  for (let month = 1; month <= months; month += 1) {
    historicalSum += metricData[`${year}-${String(month).padStart(2, '0')}`] ?? 0;
  }

  if (months >= 12) {
    return historicalSum / 1000;
  }

  // Engine annual value includes all 12 months. Subtract the engine's Q1 portion
  // (approximated as months/12 of annual) and add the real Q1 sum instead.
  const engineQ1Estimate = engineAnnualValue * (months / 12);
  return historicalSum / 1000 + (engineAnnualValue - engineQ1Estimate);
}

export function resolveMonthlyMetric(metric: string, year: Year, projectedMonthlyValues: number[]): number[] {
  const metricData = historicalMetrics[metric];

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const period = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    const historicalValue = metricData?.[period];

    if (historicalValue != null) {
      return historicalValue;
    }

    return (projectedMonthlyValues[monthIndex] ?? 0) * 1000;
  });
}
