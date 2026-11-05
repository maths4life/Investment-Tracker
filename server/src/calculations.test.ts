import { describe, it, expect } from 'vitest';
import {
  computeMetrics,
  computeXIRR,
  computePortfolioHistory,
  computeStockHoldings,
  type TxRow,
  type InvestmentTxSet,
} from './calculations.js';

// Helper to build a TxRow
function tx(
  id: number,
  type: 'add' | 'withdraw' | 'value_update',
  date: string,
  amount: number, // paise
  extras: Partial<TxRow> = {}
): TxRow {
  return { id, type, date, amount, ...extras };
}

const paise = (inr: number) => Math.round(inr * 100);

// ─── computeMetrics ───────────────────────────────────────────────────────────

describe('computeMetrics', () => {
  it('no transactions → all zeros', () => {
    const m = computeMetrics([]);
    expect(m.totalAdded).toBe(0);
    expect(m.totalWithdrawn).toBe(0);
    expect(m.currentValue).toBe(0);
    expect(m.profitLoss).toBe(0);
    expect(m.returnPct).toBeNull();
  });

  it('no value_update → current value = added − withdrawn', () => {
    const txs = [
      tx(1, 'add', '2024-01-01', paise(10000)),
      tx(2, 'withdraw', '2024-06-01', paise(2000)),
    ];
    const m = computeMetrics(txs, new Date('2024-12-01'));
    expect(m.totalAdded).toBe(paise(10000));
    expect(m.totalWithdrawn).toBe(paise(2000));
    expect(m.currentValue).toBe(paise(8000));
    expect(m.profitLoss).toBe(0);
  });

  it('withdrawal after growth', () => {
    const txs = [
      tx(1, 'add', '2024-01-01', paise(100000)),
      tx(2, 'value_update', '2024-06-01', paise(130000)),
      tx(3, 'withdraw', '2024-07-01', paise(20000)),
    ];
    const m = computeMetrics(txs, new Date('2024-09-01'));
    // current value = 130000 + 0 (no adds after Jun) - 20000 (withdraw after Jun) = 110000
    expect(m.currentValue).toBe(paise(110000));
    expect(m.profitLoss).toBe(paise(110000) + paise(20000) - paise(100000));
  });

  it('division by zero when no money added', () => {
    const m = computeMetrics([]);
    expect(m.returnPct).toBeNull();
  });

  it('P&L formula: currentValue + withdrawn - added', () => {
    const txs = [
      tx(1, 'add', '2024-01-01', paise(50000)),
      tx(2, 'value_update', '2024-12-01', paise(60000)),
    ];
    const m = computeMetrics(txs, new Date('2024-12-15'));
    expect(m.profitLoss).toBe(paise(60000) + 0 - paise(50000));
    expect(m.returnPct).toBeCloseTo(0.2, 5);
  });

  it('current value cannot go below zero', () => {
    // Withdraw more than value (should not happen in practice, but guard anyway)
    const txs = [
      tx(1, 'add', '2024-01-01', paise(1000)),
      tx(2, 'value_update', '2024-06-01', paise(500)),
      tx(3, 'withdraw', '2024-07-01', paise(900)),
    ];
    const m = computeMetrics(txs, new Date('2024-08-01'));
    expect(m.currentValue).toBeGreaterThanOrEqual(0);
  });
});

// ─── computeXIRR ─────────────────────────────────────────────────────────────

describe('computeXIRR', () => {
  it('returns null with empty transactions', () => {
    expect(computeXIRR([], 0)).toBeNull();
  });

  it('known example: invest ₹1 lakh, get ₹1.1 lakh in exactly 1 year → ~10%', () => {
    const txs = [tx(1, 'add', '2023-01-01', paise(100000))];
    const result = computeXIRR(txs, paise(110000), new Date('2024-01-01'));
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(0.1, 2);
  });

  it('returns null when all flows are same sign', () => {
    const txs = [tx(1, 'add', '2023-01-01', paise(100000))];
    // Current value is zero — no sign change
    expect(computeXIRR(txs, 0)).toBeNull();
  });

  it('SIP-like: 12 monthly investments of ₹5000, final value ₹68000 after 1 year → reasonable return', () => {
    const txs: TxRow[] = [];
    for (let m = 0; m < 12; m++) {
      const date = `2023-${String(m + 1).padStart(2, '0')}-01`;
      txs.push(tx(m + 1, 'add', date, paise(5000)));
    }
    const r = computeXIRR(txs, paise(68000), new Date('2024-01-01'));
    // Should be a positive return for 68000 from 60000 total invested
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(0);
  });
});

// ─── computePortfolioHistory (carry-forward) ──────────────────────────────────

describe('computePortfolioHistory — carry-forward', () => {
  it('single investment value carries forward', () => {
    const inv: InvestmentTxSet = {
      investmentId: 1,
      txs: [
        tx(1, 'add', '2024-01-01', paise(50000)),
        tx(2, 'value_update', '2024-01-15', paise(55000)),
      ],
    };
    const history = computePortfolioHistory([inv], '2024-01-14', '2024-01-16');
    // Jan 14: before value_update → 50000
    expect(history[0].value).toBe(paise(50000));
    // Jan 15: value_update → 55000
    expect(history[1].value).toBe(paise(55000));
    // Jan 16: carry-forward → 55000
    expect(history[2].value).toBe(paise(55000));
  });

  it('two investments sum daily', () => {
    const inv1: InvestmentTxSet = {
      investmentId: 1,
      txs: [tx(1, 'add', '2024-01-01', paise(10000))],
    };
    const inv2: InvestmentTxSet = {
      investmentId: 2,
      txs: [tx(2, 'add', '2024-01-01', paise(20000))],
    };
    const history = computePortfolioHistory([inv1, inv2], '2024-01-01', '2024-01-01');
    expect(history[0].value).toBe(paise(30000));
  });

  it('never drops to zero when no transactions', () => {
    const inv: InvestmentTxSet = { investmentId: 1, txs: [] };
    const history = computePortfolioHistory([inv], '2024-01-01', '2024-01-03');
    expect(history.every(p => p.value === 0)).toBe(true); // zero is correct for no data
  });

  it('cash flow after value_update adjusts carry-forward', () => {
    const inv: InvestmentTxSet = {
      investmentId: 1,
      txs: [
        tx(1, 'add', '2024-01-01', paise(100000)),
        tx(2, 'value_update', '2024-03-01', paise(110000)),
        tx(3, 'add', '2024-03-15', paise(10000)),
      ],
    };
    const history = computePortfolioHistory([inv], '2024-03-14', '2024-03-16');
    // Mar 14: before add → carry from value_update = 110000
    expect(history[0].value).toBe(paise(110000));
    // Mar 15: after add → 110000 + 10000 = 120000
    expect(history[1].value).toBe(paise(120000));
    // Mar 16: carry-forward → 120000
    expect(history[2].value).toBe(paise(120000));
  });
});

// ─── computeStockHoldings ────────────────────────────────────────────────────

describe('computeStockHoldings', () => {
  it('tracks avg cost through buys and sells', () => {
    const txs: TxRow[] = [
      tx(1, 'add', '2024-01-01', paise(10000), {
        stock_name: 'HDFC', shares: 10, price_per_share: paise(1000),
      }),
      tx(2, 'add', '2024-02-01', paise(12000), {
        stock_name: 'HDFC', shares: 10, price_per_share: paise(1200),
      }),
      // Sell 5 shares at avg price
      tx(3, 'withdraw', '2024-03-01', paise(5000), {
        stock_name: 'HDFC', shares: 5,
      }),
    ];
    const holdings = computeStockHoldings(txs);
    const hdfc = holdings.find(h => h.stockName === 'HDFC');
    expect(hdfc).toBeDefined();
    expect(hdfc!.sharesHeld).toBeCloseTo(15, 2);
    // avg = (10000+12000)/20 = 1100 per share
    expect(hdfc!.avgBuyPrice).toBeCloseTo(paise(1100), 0);
  });

  it('zero shares after full sell', () => {
    const txs: TxRow[] = [
      tx(1, 'add', '2024-01-01', paise(5000), {
        stock_name: 'INFY', shares: 5, price_per_share: paise(1000),
      }),
      tx(2, 'withdraw', '2024-02-01', paise(5000), {
        stock_name: 'INFY', shares: 5,
      }),
    ];
    const holdings = computeStockHoldings(txs);
    expect(holdings.find(h => h.stockName === 'INFY')).toBeUndefined();
  });

  it('applies manual current price to give currentValue', () => {
    const txs: TxRow[] = [
      tx(1, 'add', '2024-01-01', paise(10000), {
        stock_name: 'TCS', shares: 10, price_per_share: paise(1000),
      }),
    ];
    const holdings = computeStockHoldings(txs, { TCS: paise(1200) });
    const tcs = holdings.find(h => h.stockName === 'TCS');
    expect(tcs!.currentValue).toBe(paise(12000));
  });
});

