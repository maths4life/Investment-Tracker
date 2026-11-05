import { db } from './db.js';
import { computeMetrics, computeStockHoldings, daysSinceLastValueUpdate, type TxRow } from './calculations.js';

export interface InvestmentRow {
  id: number;
  user_id: string;
  name: string;
  category: string;
  created_at: string;
}

export function getInvestmentWithMetrics(id: number, userId: string = 'default-profile', today: Date = new Date()) {
  const inv = db.prepare('SELECT * FROM investments WHERE id = ? AND user_id = ?').get(id, userId) as InvestmentRow | undefined;
  if (!inv) return null;

  const txs = db.prepare('SELECT * FROM transactions WHERE investment_id = ? AND user_id = ? ORDER BY date').all(id, userId) as TxRow[];
  const metrics = computeMetrics(txs, today);

  // stock holdings if category is Stocks
  let holdings = null;
  if (inv.category === 'Stocks') {
    const priceRows = db.prepare('SELECT stock_name, price_per_share FROM holdings_prices WHERE investment_id = ? AND user_id = ?').all(id, userId) as { stock_name: string; price_per_share: number }[];
    const priceMap: Record<string, number> = {};
    for (const p of priceRows) priceMap[p.stock_name] = p.price_per_share;
    holdings = computeStockHoldings(txs, priceMap);
  }

  const lastUpdated = txs.filter(t => t.type === 'value_update').sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? null;
  const daysSince = daysSinceLastValueUpdate(txs, today);

  return {
    ...inv,
    ...metrics,
    holdings,
    lastUpdated,
    updateDue: metrics.currentValue > 0 && (daysSince === null || daysSince > 30),
    daysSinceUpdate: daysSince !== null ? Math.floor(daysSince) : null,
  };
}

export function getAllTxsForInvestment(id: number, userId: string = 'default-profile'): TxRow[] {
  return db.prepare('SELECT * FROM transactions WHERE investment_id = ? AND user_id = ? ORDER BY date, id').all(id, userId) as TxRow[];
}
