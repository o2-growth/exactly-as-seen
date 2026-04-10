import { Year } from './financialData';

export interface PnlNode {
  code: string;
  label: string;
  annual: Record<Year, number>; // R$ thousands
  monthly?: Record<Year, number[]>; // 12 monthly values per year, R$ thousands
  isSummary?: boolean;
  isMargin?: boolean;
  isHeader?: boolean;
  children?: PnlNode[];
}
