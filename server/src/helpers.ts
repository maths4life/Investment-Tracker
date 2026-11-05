import { supabase } from './supabase.js';
import { computeMetrics, computeStockHoldings, daysSinceLastValueUpdate, type TxRow } from './calculations.js';

export interface InvestmentRow {
  id: number;
  user_id: string;
  name: string;
  category: string;
  created_at: string;
}

export async function getInvestmentWithMetrics(id: number, userId: string = 'default-profile', today: Date = new Date()) {
  const { data: inv } = await supabase
    .from('investments')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!inv) return null;

  const { data: txsData } = await supabase
    .from('transactions')
    .select('*')
    .eq('investment_id', id)
    .eq('user_id', userId)
    .order('date', { ascending: true })
    .order('id', { ascending: true });

  const txs: TxRow[] = (txsData || []).map(t => ({
    ...t,
    amount: Number(t.amount),
    price_per_share: t.price_per_share != null ? Number(t.price_per_share) : null,
    shares: t.shares != null ? Number(t.shares) : null,
  }));

  const metrics = computeMetrics(txs, today);

  // stock holdings if category is Stocks
  let holdings = null;
  if (inv.category === 'Stocks') {
    const { data: priceRows } = await supabase
      .from('holdings_prices')
      .select('stock_name, price_per_share')
      .eq('investment_id', id)
      .eq('user_id', userId);

    const priceMap: Record<string, number> = {};
    for (const p of priceRows || []) {
      priceMap[p.stock_name] = Number(p.price_per_share);
    }
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

export async function getAllTxsForInvestment(id: number, userId: string = 'default-profile'): Promise<TxRow[]> {
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('investment_id', id)
    .eq('user_id', userId)
    .order('date', { ascending: true })
    .order('id', { ascending: true });

  return (data || []).map(t => ({
    ...t,
    amount: Number(t.amount),
    price_per_share: t.price_per_share != null ? Number(t.price_per_share) : null,
    shares: t.shares != null ? Number(t.shares) : null,
  }));
}
