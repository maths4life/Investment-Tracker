// Shared types matching the server responses

export type Category = 'Stocks' | 'Mutual Funds' | 'Fixed Deposits' | 'Gold' | 'PPF/EPF' | 'Crypto' | 'Other';
export type TransactionType = 'add' | 'withdraw' | 'value_update';

export const CATEGORIES: Category[] = ['Stocks', 'Mutual Funds', 'Fixed Deposits', 'Gold', 'PPF/EPF', 'Crypto', 'Other'];

export interface Investment {
  id: number;
  name: string;
  category: Category;
  created_at: string;
}

export interface InvestmentWithMetrics extends Investment {
  totalAdded: number;
  totalWithdrawn: number;
  currentValue: number;
  profitLoss: number;
  returnPct: number | null;
  xirr: number | null;
  lastUpdated: string | null;
  updateDue: boolean;
}

export interface InvestmentDetail extends InvestmentWithMetrics {
  holdings: StockHolding[] | null;
  daysSinceUpdate: number | null;
}

export interface Transaction {
  id: number;
  investment_id: number;
  type: TransactionType;
  date: string;
  amount: number; // paise
  note: string | null;
  stock_name: string | null;
  shares: number | null;
  price_per_share: number | null;
  created_at: string;
}

export interface TransactionWithInvestment extends Transaction {
  investment_name: string;
  category: Category;
}

export interface StockHolding {
  stockName: string;
  sharesHeld: number;
  avgBuyPrice: number;
  totalCost: number;
  currentPrice?: number;
  currentValue?: number;
}

export interface DashboardData {
  totalValue: number;
  totalAdded: number;
  totalWithdrawn: number;
  profitLoss: number;
  returnPct: number | null;
  portfolioXIRR: number | null;
  allocation: AllocationItem[];
  targetAllocation?: Record<string, number>;
  best: PerformerItem | null;
  worst: PerformerItem | null;
  updatesDue: UpdateDueItem[];
  recentTransactions: TransactionWithInvestment[];
}

export interface AllocationItem {
  category: string;
  added: number;
  currentValue: number;
  pct: number;
}

export interface PerformerItem {
  id: number;
  name: string;
  category: string;
  returnPct: number | null;
  currentValue: number;
  profitLoss: number;
}

export interface UpdateDueItem {
  id: number;
  name: string;
  daysSince: number | null;
}

export interface PortfolioPoint {
  date: string;
  value: number;
}

export interface Settings {
  [key: string]: string;
}

