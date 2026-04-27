/**
 * Shared revenue calculation — single source of truth.
 *
 * Used by BOTH Assumptions page and FinancialModelContext (which feeds P&L).
 * Extracted to guarantee that revenue numbers are IDENTICAL everywhere.
 *
 * Logic per month:
 * - MRR historical with Supabase: uses apiEntry.total_revenue (exact Oxy value)
 * - Non-MRR historical with Supabase: uses apiEntry.total_revenue (exact)
 * - Non-MRR projected: newClients × ticket (from monthlyNewClientOverrides or engine delta)
 * - MRR projected: Base + Incremento − Churn (accumulated monthly)
 */

import { Year, Assumptions, TicketKey, isProductMrr } from './financialData';
import { getMonthlyClients } from './monthlyData';
import type { HistoricalClientData } from '@/hooks/useHistoricalClients';

type SubProductKey = string;
type HistoricalDataMap = Record<string, Record<string, HistoricalClientData>>;

function isHistorical(year: Year, monthIdx: number): boolean {
  if (year < 2026) return true;
  if (year === 2026) return monthIdx < 3;
  return false;
}

function toPeriod(year: Year, monthIdx: number): string {
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
}

function getChurnForMonth(key: string, data: Assumptions, year: Year, monthIndex: number): number {
  if ((data.churnNotApplicable as any)?.[key]) return 0;
  const stored = (data.monthlyChurnRates as any)?.[key]?.[year];
  if (stored !== undefined) {
    if (Array.isArray(stored)) {
      return (stored[monthIndex] ?? 0) / 100 / 12;
    }
    return stored / 100 / 12;
  }
  if (key === 'caasAssessoria' || key === 'caasEnterprise' || key === 'caasCorporate' || key === 'caasSetup' || key === 'caasParceiros') {
    return data.churnCaas / 100 / 12;
  }
  if (key === 'saasOxy' || key === 'saasOxyGenio' || key === 'saasSetup' || key === 'saasParceiros' || key === 'saasOxyGenioEsp') {
    return data.churnSaas / 100 / 12;
  }
  if (key === 'educationDonoCFO' || key === 'educationEN' || key === 'educationFR' || key === 'educationFSP') {
    return 0;
  }
  if (key === 'baas' || key === 'baasFranquia' || key === 'baasMasterFranquia') {
    return data.churnBaas / 100 / 12;
  }
  if (key === 'taxAT') return data.churnCaas / 100 / 12;
  if (key === 'taxGPT' || key === 'taxRCT' || key === 'taxRT' || key === 'taxDTC') return 0;
  return 0;
}

/**
 * Compute monthly revenue array (12 values) for a single sub-product.
 * This is the SINGLE SOURCE OF TRUTH for revenue — used by P&L (annual sum) and PMR projection (monthly distribution).
 */
export function computeProductMonthlyRevenue(
  key: SubProductKey,
  year: Year,
  assumptions: Assumptions,
  historicalData: HistoricalDataMap,
): number[] {
  const monthly = getMonthlyClients(
    key as any, year,
    assumptions.subProductClients,
    assumptions.tickets,
    assumptions.monthlyClientOverrides,
    assumptions.monthlyNewClientOverrides,
  );
  const ticketVal = (assumptions.tickets as any)[key] ?? 0;
  const hcIsMrr = isProductMrr(key as TicketKey);
  const churnApplicable = hcIsMrr && !(assumptions.churnNotApplicable as any)?.[key];

  // Previous year December data
  const prevYrMonthly = year > 2025
    ? getMonthlyClients(key as any, (year - 1) as Year, assumptions.subProductClients, assumptions.tickets, assumptions.monthlyClientOverrides, assumptions.monthlyNewClientOverrides)
    : null;
  const prevDecPeriod = year > 2025 ? toPeriod((year - 1) as Year, 11) : '';
  const prevDecApi = year > 2025 ? historicalData[key]?.[prevDecPeriod] : undefined;

  let prevMonthTotal = 0;
  if (year > 2025) {
    if (prevDecApi && prevDecApi.total_revenue > 0) {
      prevMonthTotal = prevDecApi.total_revenue;
    } else {
      const prevDecClients = prevYrMonthly ? Math.round(prevYrMonthly[11]) : 0;
      const prevDecTk = (assumptions.monthlyTickets as any)?.[key]?.[(year - 1) as Year]?.[11] ?? ticketVal;
      prevMonthTotal = prevDecClients * prevDecTk;
    }
  }

  const faturamentoTotal: number[] = [];

  for (let i = 0; i < 12; i++) {
    const hist = isHistorical(year, i);
    const monthTicket = (assumptions.monthlyTickets as any)?.[key]?.[year]?.[i] ?? ticketVal;
    const period = toPeriod(year, i);
    const apiEntry = hist ? historicalData[key]?.[period] : undefined;

    if (hist && apiEntry && (!hcIsMrr || (apiEntry.total_revenue > 0 && apiEntry.client_names))) {
      faturamentoTotal.push(apiEntry.total_revenue);
    } else if (!hcIsMrr) {
      const storedNew = (assumptions.monthlyNewClientOverrides as any)?.[key]?.[year]?.[i];
      const newClients = (storedNew !== null && storedNew !== undefined)
        ? storedNew
        : Math.round(monthly[i]);
      const monthRevenue = newClients * monthTicket;
      if (hist && apiEntry && apiEntry.total_revenue > 0) {
        faturamentoTotal.push(apiEntry.total_revenue);
      } else {
        faturamentoTotal.push(monthRevenue);
      }
    } else {
      // MRR projected: Base + Incremento - Churn
      const base = i === 0 ? prevMonthTotal : faturamentoTotal[i - 1];

      let prevClients = 0;
      if (i > 0) {
        prevClients = monthly[i - 1];
      } else if (prevDecApi) {
        prevClients = prevDecApi.client_count;
      } else if (prevYrMonthly) {
        prevClients = Math.round(prevYrMonthly[11]);
      }

      const storedNew = (assumptions.monthlyNewClientOverrides as any)?.[key]?.[year]?.[i];
      let newClients = 0;
      if (storedNew !== null && storedNew !== undefined) {
        newClients = storedNew;
      } else {
        const activeCur = monthly[i];
        const churnRate = getChurnForMonth(key, assumptions, year, i);
        const churned = Math.round(prevClients * churnRate);
        newClients = Math.max(0, Math.round(activeCur) - Math.round(prevClients) + churned);
      }

      const inc = newClients * monthTicket;

      let revChurn = 0;
      if (churnApplicable) {
        const prevTk = i > 0
          ? ((assumptions.monthlyTickets as any)?.[key]?.[year]?.[i - 1] ?? ticketVal)
          : (year > 2025 ? ((assumptions.monthlyTickets as any)?.[key]?.[(year - 1) as Year]?.[11] ?? ticketVal) : ticketVal);
        const churnRate = getChurnForMonth(key, assumptions, year, i);
        const logoChurn = Math.round(prevClients * churnRate);
        revChurn = logoChurn * prevTk;
      }

      if (hist && apiEntry && apiEntry.total_revenue > 0) {
        faturamentoTotal.push(apiEntry.total_revenue);
      } else {
        faturamentoTotal.push(base + inc - revChurn);
      }
    }
  }

  return faturamentoTotal;
}

/**
 * Compute annual revenue for a single sub-product.
 * Sums the 12 monthly values from computeProductMonthlyRevenue.
 */
export function computeProductAnnualRevenue(
  key: SubProductKey,
  year: Year,
  assumptions: Assumptions,
  historicalData: HistoricalDataMap,
): number {
  return computeProductMonthlyRevenue(key, year, assumptions, historicalData).reduce((s, v) => s + v, 0);
}
