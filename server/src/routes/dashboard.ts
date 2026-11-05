import { Router } from 'express';
import { db } from '../db.js';
import {
  computeMetrics,
  computePortfolioHistory,
  computePortfolioXIRR,
  type TxRow,
  type InvestmentTxSet,
} from '../calculations.js';
import { getAllTxsForInvestment, type InvestmentRow } from '../helpers.js';

const router = Router();

router.get('/', (_req, res) => {
  const today = new Date();
  const investments = db.prepare('SELECT * FROM investments').all() as InvestmentRow[];

  let totalAdded = 0;
  let totalWithdrawn = 0;
  let totalCurrentValue = 0;

  const categoryMap = new Map<string, { added: number; currentValue: number }>();
  const allTxs: TxRow[] = [];
  const perInvMetrics: { inv: InvestmentRow; metrics: ReturnType<typeof computeMetrics>; txs: TxRow[] }[] = [];
  const updateDueList: { id: number; name: string; daysSince: number | null }[] = [];

  for (const inv of investments) {
    const txs = getAllTxsForInvestment(inv.id);
    allTxs.push(...txs);
    const metrics = computeMetrics(txs, today);
    perInvMetrics.push({ inv, metrics, txs });

    totalAdded += metrics.totalAdded;
    totalWithdrawn += metrics.totalWithdrawn;
    totalCurrentValue += metrics.currentValue;

    if (!categoryMap.has(inv.category)) categoryMap.set(inv.category, { added: 0, currentValue: 0 });
    const cat = categoryMap.get(inv.category)!;
    cat.added += metrics.totalAdded;
    cat.currentValue += metrics.currentValue;

    // Update due check
    if (metrics.currentValue > 0) {
      const valueUpdates = txs.filter(t => t.type === 'value_update');
      const lastVU = valueUpdates.sort((a, b) => b.date.localeCompare(a.date))[0];
      const daysSince = lastVU
        ? (today.getTime() - new Date(lastVU.date + 'T00:00:00').getTime()) / 86400000
        : null;
      if (daysSince === null || daysSince > 30) {
        updateDueList.push({ id: inv.id, name: inv.name, daysSince: daysSince !== null ? Math.floor(daysSince) : null });
      }
    }
  }

  const profitLoss = totalCurrentValue + totalWithdrawn - totalAdded;
  const returnPct = totalAdded === 0 ? null : profitLoss / totalAdded;
  const portfolioXIRR = computePortfolioXIRR(allTxs, totalCurrentValue, today);

  const allocation = Array.from(categoryMap.entries()).map(([category, { added, currentValue }]) => ({
    category,
    added,
    currentValue,
    pct: totalCurrentValue > 0 ? currentValue / totalCurrentValue : 0,
  }));

  const performers = perInvMetrics
    .filter(p => p.metrics.totalAdded > 0)
    .map(p => ({
      id: p.inv.id,
      name: p.inv.name,
      category: p.inv.category,
      returnPct: p.metrics.returnPct,
      currentValue: p.metrics.currentValue,
      profitLoss: p.metrics.profitLoss,
    }))
    .sort((a, b) => (b.returnPct ?? -Infinity) - (a.returnPct ?? -Infinity));

  const best = performers[0] ?? null;
  const worst = performers[performers.length - 1] ?? null;

  const recentTxs = db.prepare(`
    SELECT t.*, i.name as investment_name, i.category
    FROM transactions t
    JOIN investments i ON i.id = t.investment_id
    ORDER BY t.date DESC, t.id DESC
    LIMIT 8
  `).all();

  // Settings: target allocation
  const targetRow = db.prepare("SELECT value FROM settings WHERE key = 'target_allocation'").get() as { value: string } | undefined;
  let targetAllocation: Record<string, number> = {};
  if (targetRow?.value) {
    try {
      targetAllocation = JSON.parse(targetRow.value);
    } catch {}
  }

  res.json({
    totalValue: totalCurrentValue,
    totalAdded,
    totalWithdrawn,
    profitLoss,
    returnPct,
    portfolioXIRR,
    allocation,
    targetAllocation,
    best,
    worst,
    updatesDue: updateDueList,
    recentTransactions: recentTxs,
  });
});

// GET /api/portfolio/history
router.get('/history', (req, res) => {
  const range = (req.query.range as string) || 'ALL';
  const today = new Date();
  const toDate = today.toISOString().slice(0, 10);

  const investments = db.prepare('SELECT * FROM investments').all() as InvestmentRow[];
  const sets: InvestmentTxSet[] = investments.map(inv => ({
    investmentId: inv.id,
    txs: getAllTxsForInvestment(inv.id),
  }));

  const allTxs = sets.flatMap(s => s.txs);
  if (allTxs.length === 0) { res.json([]); return; }

  const earliestDate = allTxs.reduce((min, t) => t.date < min ? t.date : min, allTxs[0].date);

  let fromDate: string;
  if (range === '1M') {
    const d = new Date(today); d.setMonth(d.getMonth() - 1);
    fromDate = d.toISOString().slice(0, 10);
  } else if (range === '6M') {
    const d = new Date(today); d.setMonth(d.getMonth() - 6);
    fromDate = d.toISOString().slice(0, 10);
  } else if (range === '1Y') {
    const d = new Date(today); d.setFullYear(d.getFullYear() - 1);
    fromDate = d.toISOString().slice(0, 10);
  } else {
    fromDate = earliestDate;
  }

  if (fromDate < earliestDate) fromDate = earliestDate;

  const history = computePortfolioHistory(sets, fromDate, toDate, today);

  // Downsample for large ranges
  const maxPoints = 200;
  if (history.length > maxPoints) {
    const step = Math.ceil(history.length / maxPoints);
    const sampled = history.filter((_, i) => i % step === 0 || i === history.length - 1);
    res.json(sampled);
    return;
  }

  res.json(history);
});

export default router;
