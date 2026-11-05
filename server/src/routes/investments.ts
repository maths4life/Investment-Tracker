import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { getInvestmentWithMetrics, getAllTxsForInvestment, type InvestmentRow } from '../helpers.js';
import { computeMetrics, computeInvestmentHistory, daysSinceLastValueUpdate } from '../calculations.js';

const router = Router();

const CATEGORIES = ['Stocks', 'Mutual Funds', 'Fixed Deposits', 'Gold', 'PPF/EPF', 'Crypto', 'Other'] as const;

const CreateInvestmentSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(CATEGORIES),
});

const UpdateInvestmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.enum(CATEGORIES).optional(),
});

// GET /api/investments
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { data: rows, error } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const today = new Date();
    const investments = await Promise.all(
      (rows as InvestmentRow[] || []).map(async (inv) => {
        const txs = await getAllTxsForInvestment(inv.id, userId);
        const metrics = computeMetrics(txs, today);
        const valueUpdates = txs.filter(t => t.type === 'value_update');
        const lastUpdated = valueUpdates.sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? null;
        const days = daysSinceLastValueUpdate(txs, today);
        return {
          ...inv,
          ...metrics,
          lastUpdated,
          updateDue: metrics.currentValue > 0 && (days === null || days > 30),
        };
      })
    );
    res.json(investments);
  } catch (err) {
    next(err);
  }
});

// POST /api/investments
router.post('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const parsed = CreateInvestmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }
    const { name, category } = parsed.data;
    const { data, error } = await supabase
      .from('investments')
      .insert({ user_id: userId, name, category })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/investments/:id
router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
    const inv = await getInvestmentWithMetrics(id, userId);
    if (!inv) { res.status(404).json({ error: 'Not found' }); return; }
    res.json(inv);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/investments/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

    const parsed = UpdateInvestmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { name, category } = parsed.data;
    const updates: Record<string, string> = {};
    if (name) updates.name = name;
    if (category) updates.category = category;

    const { error } = await supabase
      .from('investments')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    const updated = await getInvestmentWithMetrics(id, userId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/investments/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

    const { error } = await supabase
      .from('investments')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/investments/:id/history
router.get('/:id/history', async (req, res, next) => {
  try {
    const userId = req.userId;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

    const { data: inv } = await supabase
      .from('investments')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    if (!inv) { res.status(404).json({ error: 'Not found' }); return; }

    const txs = await getAllTxsForInvestment(id, userId);
    if (txs.length === 0) { res.json([]); return; }

    const range = (req.query.range as string) || 'ALL';
    const today = new Date();
    const toDate = today.toISOString().slice(0, 10);
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
      fromDate = txs[0].date;
    }

    const history = computeInvestmentHistory(txs, fromDate, toDate);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

export default router;
