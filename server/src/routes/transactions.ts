import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { computeMetrics, type TxRow } from '../calculations.js';
import { getAllTxsForInvestment } from '../helpers.js';

const router = Router({ mergeParams: true });

const TX_TYPES = ['add', 'withdraw', 'value_update'] as const;

const CreateTxSchema = z.object({
  type: z.enum(TX_TYPES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive('Amount must be positive'),
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
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const investmentId = parseInt(req.params.id, 10);
    if (isNaN(investmentId)) { res.status(400).json({ error: 'Invalid investment id' }); return; }

    const { data: inv } = await supabase
      .from('investments')
      .select('id')
      .eq('id', investmentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!inv) { res.status(404).json({ error: 'Investment not found' }); return; }

    const { type, from, to, stock, q } = req.query as Record<string, string>;

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('investment_id', investmentId)
      .eq('user_id', userId);

    if (type && TX_TYPES.includes(type as typeof TX_TYPES[number])) {
      query = query.eq('type', type);
    }
    if (from) {
      query = query.gte('date', from);
    }
    if (to) {
      query = query.lte('date', to);
    }
    if (stock) {
      query = query.ilike('stock_name', `%${stock}%`);
    }
    if (q) {
      query = query.ilike('note', `%${q}%`);
    }

    query = query.order('date', { ascending: false }).order('id', { ascending: false });

    const { data: txs, error } = await query;
    if (error) throw error;

    const formatted = (txs || []).map(t => ({
      ...t,
      amount: Number(t.amount),
      price_per_share: t.price_per_share != null ? Number(t.price_per_share) : null,
      shares: t.shares != null ? Number(t.shares) : null,
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
});

// POST /api/investments/:id/transactions
router.post('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const investmentId = parseInt(req.params.id, 10);
    if (isNaN(investmentId)) { res.status(400).json({ error: 'Invalid investment id' }); return; }

    const { data: inv } = await supabase
      .from('investments')
      .select('id')
      .eq('id', investmentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!inv) { res.status(404).json({ error: 'Investment not found' }); return; }

    const parsed = CreateTxSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { type, date, amount, note, stock_name, shares, price_per_share } = parsed.data;

    const bizError = await validateBusinessRules(type, date, amount, investmentId, userId);
    if (bizError) { res.status(422).json({ error: bizError }); return; }

    const { data: tx, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        investment_id: investmentId,
        type,
        date,
        amount,
        note: note ?? null,
        stock_name: stock_name ?? null,
        shares: shares ?? null,
        price_per_share: price_per_share ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      ...tx,
      amount: Number(tx.amount),
      price_per_share: tx.price_per_share != null ? Number(tx.price_per_share) : null,
      shares: tx.shares != null ? Number(tx.shares) : null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
