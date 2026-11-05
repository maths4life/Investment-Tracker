/**
 * Pure calculation module — no DB calls, no side effects.
 * All amounts are stored and passed as integer paise (1 INR = 100 paise).
 */

export type TransactionType = 'add' | 'withdraw' | 'value_update';

export interface TxRow {
  id: number;
  type: TransactionType;
  date: string; // ISO date string YYYY-MM-DD
  amount: number; // paise
  stock_name?: string | null;
  shares?: number | null;
  price_per_share?: number | null;
  note?: string | null;
}

export interface InvestmentMetrics {
  totalAdded: number;       // paise
  totalWithdrawn: number;   // paise
  currentValue: number;     // paise
  profitLoss: number;       // paise
  returnPct: number | null; // null if division by zero
  xirr: number | null;      // annualised, e.g. 0.12 = 12%
}

export interface StockHolding {
  stockName: string;
  sharesHeld: number;
  avgBuyPrice: number; // paise per share
  totalCost: number;   // paise
  currentPrice?: number; // paise, if provided
  currentValue?: number; // paise, if provided
}

export interface PortfolioPoint {
  date: string;        // YYYY-MM-DD
  value: number;       // paise
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseDate(d: string): Date {
  // Accepts YYYY-MM-DD
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86_400_000;
}

// ─── Core metrics ───────────────────────────────────────────────────────────

export function computeMetrics(txs: TxRow[], today: Date = new Date()): InvestmentMetrics {
  const todayStr = today.toISOString().slice(0, 10);

  let totalAdded = 0;
  let totalWithdrawn = 0;
  let lastValueUpdate: { date: string; amount: number } | null = null;

  for (const tx of txs) {
    if (tx.type === 'add') totalAdded += tx.amount;
    else if (tx.type === 'withdraw') totalWithdrawn += tx.amount;
    else if (tx.type === 'value_update') {
      if (!lastValueUpdate || tx.date >= lastValueUpdate.date) {
        lastValueUpdate = { date: tx.date, amount: tx.amount };
      }
    }
  }

  let currentValue: number;
  if (lastValueUpdate) {
    // Start from last known value, then adjust for cash flows AFTER that date
    let adjustment = 0;
    for (const tx of txs) {
      if (tx.date > lastValueUpdate.date && tx.date <= todayStr) {
        if (tx.type === 'add') adjustment += tx.amount;
        else if (tx.type === 'withdraw') adjustment -= tx.amount;
      }
    }
    currentValue = lastValueUpdate.amount + adjustment;
  } else {
    currentValue = totalAdded - totalWithdrawn;
  }

  currentValue = Math.max(0, currentValue);

  const profitLoss = currentValue + totalWithdrawn - totalAdded;
  const returnPct = totalAdded === 0 ? null : profitLoss / totalAdded;
  const xirr = computeXIRR(txs, currentValue, today);

  return { totalAdded, totalWithdrawn, currentValue, profitLoss, returnPct, xirr };
}

// ─── XIRR ───────────────────────────────────────────────────────────────────

interface CashFlow {
  date: Date;
  amount: number; // positive = inflow, negative = outflow
}

function xnpv(rate: number, flows: CashFlow[], t0: Date): number {
  return flows.reduce((sum, f) => {
    const t = daysBetween(t0, f.date) / 365;
    return sum + f.amount / Math.pow(1 + rate, t);
  }, 0);
}

function xnpvDeriv(rate: number, flows: CashFlow[], t0: Date): number {
  return flows.reduce((sum, f) => {
    const t = daysBetween(t0, f.date) / 365;
    return sum - (t * f.amount) / Math.pow(1 + rate, t + 1);
  }, 0);
}

export function computeXIRR(txs: TxRow[], currentValue: number, today: Date = new Date()): number | null {
  if (txs.length === 0 || currentValue <= 0) return null;

  const todayStr = today.toISOString().slice(0, 10);
  const flows: CashFlow[] = [];

  for (const tx of txs) {
    if (tx.type === 'add') {
      flows.push({ date: parseDate(tx.date), amount: -tx.amount }); // outflow
    } else if (tx.type === 'withdraw') {
      flows.push({ date: parseDate(tx.date), amount: tx.amount }); // inflow
    }
  }

  // Final inflow: current value today
  flows.push({ date: parseDate(todayStr), amount: currentValue });

  if (flows.length < 2) return null;

  // Need both positive and negative flows for XIRR to converge
  const hasPositive = flows.some(f => f.amount > 0);
  const hasNegative = flows.some(f => f.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const t0 = flows.reduce((min, f) => f.date < min ? f.date : min, flows[0].date);

  // Newton-Raphson
  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const npv = xnpv(rate, flows, t0);
    const deriv = xnpvDeriv(rate, flows, t0);
    if (Math.abs(deriv) < 1e-10) return null;
    const newRate = rate - npv / deriv;
    if (Math.abs(newRate - rate) < 1e-7) return newRate;
    rate = newRate;
    if (rate <= -1) rate = -0.999;
  }

  return null; // did not converge
}

// ─── Portfolio history (carry-forward) ──────────────────────────────────────

export interface InvestmentTxSet {
  investmentId: number;
  txs: TxRow[];
}

export function computePortfolioHistory(
  investments: InvestmentTxSet[],
  fromDate: string,
  toDate: string,
  today: Date = new Date()
): PortfolioPoint[] {
  // Build daily series for each investment, then sum
  const dates = eachDay(fromDate, toDate);
  const todayStr = today.toISOString().slice(0, 10);

  const series: number[] = dates.map(() => 0);

  for (const inv of investments) {
    const dailyValues = computeInvestmentDailySeries(inv.txs, dates, todayStr);
    for (let i = 0; i < dates.length; i++) {
      series[i] += dailyValues[i];
    }
  }

  return dates.map((d, i) => ({ date: d, value: series[i] }));
}

function eachDay(from: string, to: string): string[] {
  const result: string[] = [];
  const cur = parseDate(from);
  const end = parseDate(to);
  while (cur <= end) {
    result.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return result;
}

function computeInvestmentDailySeries(txs: TxRow[], dates: string[], todayStr: string): number[] {
  if (txs.length === 0) return dates.map(() => 0);

  // Sort txs by date
  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));

  // Find value_updates
  const valueUpdates = sorted.filter(t => t.type === 'value_update');

  const result: number[] = [];
  for (const date of dates) {
    // Find the latest value_update on or before this date
    let baseValue = 0;
    let baseDate = '';
    for (const vu of valueUpdates) {
      if (vu.date <= date) {
        baseValue = vu.amount;
        baseDate = vu.date;
      }
    }

    if (baseDate === '') {
      // No value update yet — use total adds - withdraws up to this date
      let adds = 0;
      let withdraws = 0;
      for (const tx of sorted) {
        if (tx.date > date) break;
        if (tx.type === 'add') adds += tx.amount;
        else if (tx.type === 'withdraw') withdraws += tx.amount;
      }
      result.push(Math.max(0, adds - withdraws));
    } else {
      // Carry-forward: start from base, add/subtract cash flows after base date and up to this date
      let adj = 0;
      for (const tx of sorted) {
        if (tx.date <= baseDate) continue;
        if (tx.date > date) break;
        if (tx.type === 'add') adj += tx.amount;
        else if (tx.type === 'withdraw') adj -= tx.amount;
      }
      result.push(Math.max(0, baseValue + adj));
    }
  }

  return result;
}

// ─── Single investment history (for chart) ──────────────────────────────────

export function computeInvestmentHistory(txs: TxRow[], fromDate: string, toDate: string): PortfolioPoint[] {
  const dates = eachDay(fromDate, toDate);
  const todayStr = toDate;
  const values = computeInvestmentDailySeries(txs, dates, todayStr);
  return dates.map((d, i) => ({ date: d, value: values[i] }));
}

// ─── Stock holdings ──────────────────────────────────────────────────────────

export function computeStockHoldings(
  txs: TxRow[],
  priceMap: Record<string, number> = {} // stockName → paise per share
): StockHolding[] {
  // Group by stock_name
  const stocks = new Map<string, { shares: number; totalCost: number }>();

  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));

  for (const tx of sorted) {
    if (!tx.stock_name || tx.shares == null) continue;
    const name = tx.stock_name;
    if (!stocks.has(name)) stocks.set(name, { shares: 0, totalCost: 0 });
    const s = stocks.get(name)!;

    if (tx.type === 'add') {
      const cost = tx.price_per_share != null ? tx.shares * tx.price_per_share : tx.amount;
      s.shares += tx.shares;
      s.totalCost += cost;
    } else if (tx.type === 'withdraw') {
      // Reduce shares at average cost
      const avgCost = s.shares > 0 ? s.totalCost / s.shares : 0;
      const soldShares = Math.min(tx.shares, s.shares);
      s.shares -= soldShares;
      s.totalCost -= soldShares * avgCost;
    }
  }

  const result: StockHolding[] = [];
  for (const [stockName, { shares, totalCost }] of stocks) {
    if (shares < 0.0001) continue; // effectively zero
    const avgBuyPrice = shares > 0 ? Math.round(totalCost / shares) : 0;
    const holding: StockHolding = {
      stockName,
      sharesHeld: shares,
      avgBuyPrice,
      totalCost: Math.round(totalCost),
    };
    if (priceMap[stockName] != null) {
      holding.currentPrice = priceMap[stockName];
      holding.currentValue = Math.round(shares * priceMap[stockName]);
    }
    result.push(holding);
  }

  return result;
}

// ─── Portfolio XIRR ─────────────────────────────────────────────────────────

export function computePortfolioXIRR(
  allTxs: TxRow[],
  totalCurrentValue: number,
  today: Date = new Date()
): number | null {
  return computeXIRR(allTxs, totalCurrentValue, today);
}

// ─── Last updated / update due ───────────────────────────────────────────────

export function daysSinceLastValueUpdate(txs: TxRow[], today: Date = new Date()): number | null {
  const valueUpdates = txs.filter(t => t.type === 'value_update');
  if (valueUpdates.length === 0) return null;
  const latest = valueUpdates.reduce((max, t) => t.date > max ? t.date : max, valueUpdates[0].date);
  return daysBetween(parseDate(latest), today);
}

export function isUpdateDue(txs: TxRow[], today: Date = new Date()): boolean {
  const days = daysSinceLastValueUpdate(txs, today);
  return days === null || days > 30;
}

