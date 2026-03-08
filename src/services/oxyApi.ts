/**
 * Oxy Platform API Integration
 * Endpoints will be provided by CTO João Freitas.
 * For now, uses mock data structure ready for real API swap.
 */

// API base URL — will be set when API is available
const OXY_API_BASE = import.meta.env.VITE_OXY_API_URL || '';

export interface OxyClientData {
  month: string; // "2024-01", "2024-02", etc.
  bu: 'caas' | 'saas' | 'education' | 'baas';
  product: string;
  activeClients: number;
  newClients: number;
  churnedClients: number;
}

export interface OxyRevenueData {
  month: string;
  bu: 'caas' | 'saas' | 'education' | 'baas';
  product: string;
  grossRevenue: number;
  netRevenue: number;
}

export interface OxyActualData {
  clients: OxyClientData[];
  revenue: OxyRevenueData[];
  lastUpdated: string;
}

// Check if API is configured
export function isOxyApiConfigured(): boolean {
  return !!OXY_API_BASE;
}

// Fetch actual data from Oxy
export async function fetchOxyActuals(startDate: string, endDate: string): Promise<OxyActualData> {
  if (!isOxyApiConfigured()) {
    return getMockData();
  }

  const [clients, revenue] = await Promise.all([
    fetch(`${OXY_API_BASE}/clients/active?start=${startDate}&end=${endDate}`).then(r => r.json()),
    fetch(`${OXY_API_BASE}/revenue/monthly?start=${startDate}&end=${endDate}`).then(r => r.json()),
  ]);

  return { clients, revenue, lastUpdated: new Date().toISOString() };
}

// Mock data for development (shows structure, zero values)
function getMockData(): OxyActualData {
  return {
    clients: [],
    revenue: [],
    lastUpdated: '',
  };
}

// Transform Oxy data into format compatible with our model
export function transformOxyToModel(data: OxyActualData) {
  const monthlyRevenue: Record<string, Record<string, number>> = {};
  const monthlyClients: Record<string, Record<string, number>> = {};

  for (const r of data.revenue) {
    if (!monthlyRevenue[r.month]) monthlyRevenue[r.month] = {};
    monthlyRevenue[r.month][`${r.bu}_${r.product}`] = r.grossRevenue;
  }

  for (const c of data.clients) {
    if (!monthlyClients[c.month]) monthlyClients[c.month] = {};
    monthlyClients[c.month][`${c.bu}_${c.product}`] = c.activeClients;
  }

  return { monthlyRevenue, monthlyClients };
}
