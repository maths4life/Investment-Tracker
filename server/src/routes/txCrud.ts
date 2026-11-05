import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { computeMetrics, type TxRow } from '../calculations.js';
import { getAllTxsForInvestment } from '../helpers.js';

const router = Router();

const TX_TYPES = ['add', 'withdraw', 'value_update'] as const;

const UpdateTxSchema = z.object({
  type: z.enum(TX_TYPES).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.number().positive().int().optional(),
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
    const txsUpToDate = txs.filter(t => t.date <= date);
    const metrics = computeMetrics(txsUpToDate, new Date(date + 'T23:59:59'));
    if (amount > metrics.currentValue) {
      const inr = (metrics.currentValue / 100).toFixed(2);
      return `Withdrawal (₹${(amount / 100).toFixed(2)}) exceeds current value as of that date (₹${inr}).`;
    }
  }
  return null;
}

interface DbTxRow {
  id: number;
  investment_id: number;
  type: string;
  date: string;
  amount: number;
  note: string | null;
  stock_name: string | null;
  shares: number | null;
  price_per_share: number | null;
  created_at: string;
}

// PATCH /api/transactions/:id
router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as DbTxRow | undefined;
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const parsed = UpdateTxSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const merged = {
    type: (parsed.data.type ?? existing.type),
    date: parsed.data.date ?? existing.date,
    amount: parsed.data.amount ?? existing.amount,
    note: 'note' in parsed.data ? parsed.data.note : existing.note,
    stock_name: 'stock_name' in parsed.data ? parsed.data.stock_name : existing.stock_name,
    shares: 'shares' in parsed.data ? parsed.data.shares : existing.shares,
    price_per_share: 'price_per_share' in parsed.data ? parsed.data.price_per_share : existing.price_per_share,
  };

  const bizError = validateBusinessRules(merged.type, merged.date, merged.amount, existing.investment_id, id);
  if (bizError) { res.status(422).json({ error: bizError }); return; }

  db.prepare(`
    UPDATE transactions
    SET type = ?, date = ?, amount = ?, note = ?, stock_name = ?, shares = ?, price_per_share = ?
    WHERE id = ?
  `).run(merged.type, merged.date, merged.amount, merged.note ?? null, merged.stock_name ?? null, merged.shares ?? null, merged.price_per_share ?? null, id);

  res.json(db.prepare('SELECT * FROM transactions WHERE id = ?').get(id));
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  res.status(204).end();
});

export default router;
