import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { computeMetrics, type TxRow } from '../calculations.js';
import { getAllTxsForInvestment } from '../helpers.js';

const router = Router({ mergeParams: true });

const TX_TYPES = ['add', 'withdraw', 'value_update'] as const;

const CreateTxSchema = z.object({
  type: z.enum(TX_TYPES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive('Amount must be positive').int('Amount must be an integer (paise)'),
  note: z.string().max(500).optional().nullable(),
  stock_name: z.string().max(100).optional().nullable(),
  shares: z.number().positive().optional().nullable(),
  price_per_share: z.number().positive().int().optional().nullable(),
});

function validateBusinessRules(
  type: string,
  date: string,
  amount: number,
  investmentId: number,
  excludeTxId?: number
): string | null {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const txDate = new Date(date + 'T00:00:00');
  if (txDate > today) return 'Transaction date cannot be in the future.';
  if (amount <= 0) return 'Amount must be positive.';

  if (type === 'withdraw') {
    let txs = getAllTxsForInvestment(investmentId);
    if (excludeTxId) txs = txs.filter(t => t.id !== excludeTxId);
    // Value as of date
    const txsUpToDate = txs.filter(t => t.date <= date);
    const metrics = computeMetrics(txsUpToDate, new Date(date + 'T23:59:59'));
    if (amount > metrics.currentValue) {
      const inr = (metrics.currentValue / 100).toFixed(2);
      return `Withdrawal (₹${(amount / 100).toFixed(2)}) exceeds current value as of that date (₹${inr}).`;
    }
  }
  return null;
}

// GET /api/investments/:id/transactions
router.get('/', (req, res) => {
  const userId = req.userId;
  const investmentId = parseInt(req.params.id, 10);
  if (isNaN(investmentId)) { res.status(400).json({ error: 'Invalid investment id' }); return; }

  const inv = db.prepare('SELECT id FROM investments WHERE id = ? AND user_id = ?').get(investmentId, userId);
  if (!inv) { res.status(404).json({ error: 'Investment not found' }); return; }

  const { type, from, to, stock, q } = req.query as Record<string, string>;

  // Build query with filters
  let sql = 'SELECT * FROM transactions WHERE investment_id = ? AND user_id = ?';
  const params: (string | number)[] = [investmentId, userId];

  if (type && TX_TYPES.includes(type as typeof TX_TYPES[number])) {
    sql += ' AND type = ?'; params.push(type);
  }
  if (from) { sql += ' AND date >= ?'; params.push(from); }
  if (to) { sql += ' AND date <= ?'; params.push(to); }
  if (stock) { sql += ' AND stock_name LIKE ?'; params.push(`%${stock}%`); }
  if (q) { sql += ' AND note LIKE ?'; params.push(`%${q}%`); }

  sql += ' ORDER BY date DESC, id DESC';

  const txs = db.prepare(sql).all(...params) as TxRow[];
  res.json(txs);
});

// POST /api/investments/:id/transactions
router.post('/', (req, res) => {
  const userId = req.userId;
  const investmentId = parseInt(req.params.id, 10);
  if (isNaN(investmentId)) { res.status(400).json({ error: 'Invalid investment id' }); return; }

  const inv = db.prepare('SELECT id FROM investments WHERE id = ? AND user_id = ?').get(investmentId, userId);
  if (!inv) { res.status(404).json({ error: 'Investment not found' }); return; }

  const parsed = CreateTxSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { type, date, amount, note, stock_name, shares, price_per_share } = parsed.data;

  const bizError = validateBusinessRules(type, date, amount, investmentId);
  if (bizError) { res.status(422).json({ error: bizError }); return; }

  const result = db.prepare(`
    INSERT INTO transactions (user_id, investment_id, type, date, amount, note, stock_name, shares, price_per_share)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, investmentId, type, date, amount, note ?? null, stock_name ?? null, shares ?? null, price_per_share ?? null);

  const tx = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(Number(result.lastInsertRowid), userId);
  res.status(201).json(tx);
});

export default router;
