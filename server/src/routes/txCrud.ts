import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { computeMetrics, type TxRow } from '../calculations.js';
import { getAllTxsForInvestment } from '../helpers.js';

const router = Router();

const TX_TYPES = ['add', 'withdraw', 'value_update'] as const;

const UpdateTxSchema = z.object({
  type: z.enum(TX_TYPES).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.number().positive().optional(),
  note: z.string().max(500).optional().nullable(),
  stock_name: z.string().max(100).optional().nullable(),
  shares: z.number().positive().optional().nullable(),
  price_per_share: z.number().positive().optional().nullable(),
});

async function validateBusinessRules(
  type: string,
  date: string,
  amount: number,
  investmentId: number,
  userId: string,
  excludeTxId?: number
): Promise<string | null> {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const txDate = new Date(date + 'T00:00:00');
  if (txDate > today) return 'Transaction date cannot be in the future.';
  if (amount <= 0) return 'Amount must be positive.';

  if (type === 'withdraw') {
    let txs = await getAllTxsForInvestment(investmentId, userId);
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
router.patch('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

    const { data: existing } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

    const parsed = UpdateTxSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const merged = {
      type: parsed.data.type ?? existing.type,
      date: parsed.data.date ?? existing.date,
      amount: parsed.data.amount ?? Number(existing.amount),
      note: 'note' in parsed.data ? parsed.data.note : existing.note,
      stock_name: 'stock_name' in parsed.data ? parsed.data.stock_name : existing.stock_name,
      shares: 'shares' in parsed.data ? parsed.data.shares : (existing.shares != null ? Number(existing.shares) : null),
      price_per_share: 'price_per_share' in parsed.data ? parsed.data.price_per_share : (existing.price_per_share != null ? Number(existing.price_per_share) : null),
    };

    const bizError = await validateBusinessRules(merged.type, merged.date, merged.amount, existing.investment_id, userId, id);
    if (bizError) { res.status(422).json({ error: bizError }); return; }

    const { data: updated, error } = await supabase
      .from('transactions')
      .update({
        type: merged.type,
        date: merged.date,
        amount: merged.amount,
        note: merged.note ?? null,
        stock_name: merged.stock_name ?? null,
        shares: merged.shares ?? null,
        price_per_share: merged.price_per_share ?? null,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      ...updated,
      amount: Number(updated.amount),
      price_per_share: updated.price_per_share != null ? Number(updated.price_per_share) : null,
      shares: updated.shares != null ? Number(updated.shares) : null,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
