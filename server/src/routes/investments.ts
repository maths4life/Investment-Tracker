import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { getInvestmentWithMetrics, getAllTxsForInvestment, type InvestmentRow } from '../helpers.js';
import { computeMetrics, computeInvestmentHistory, isUpdateDue, daysSinceLastValueUpdate } from '../calculations.js';

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
router.get('/', (req, res) => {
  const userId = req.userId;
  const rows = db.prepare('SELECT * FROM investments WHERE user_id = ? ORDER BY created_at DESC').all(userId) as InvestmentRow[];
  const today = new Date();
  const investments = rows.map(inv => {
    const txs = getAllTxsForInvestment(inv.id, userId);
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
  });
  res.json(investments);
});

// POST /api/investments
router.post('/', (req, res) => {
  const userId = req.userId;
  const parsed = CreateInvestmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { name, category } = parsed.data;
  const result = db.prepare('INSERT INTO investments (user_id, name, category) VALUES (?, ?, ?)').run(userId, name, category);
  const inv = db.prepare('SELECT * FROM investments WHERE id = ? AND user_id = ?').get(Number(result.lastInsertRowid), userId);
  res.status(201).json(inv);
});

// GET /api/investments/:id
router.get('/:id', (req, res) => {
  const userId = req.userId;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  const inv = getInvestmentWithMetrics(id, userId);
  if (!inv) { res.status(404).json({ error: 'Not found' }); return; }
  res.json(inv);
});

// PATCH /api/investments/:id
router.patch('/:id', (req, res) => {
  const userId = req.userId;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  const existing = db.prepare('SELECT * FROM investments WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }

  const parsed = UpdateInvestmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const { name, category } = parsed.data;
  if (name) db.prepare('UPDATE investments SET name = ? WHERE id = ? AND user_id = ?').run(name, id, userId);
  if (category) db.prepare('UPDATE investments SET category = ? WHERE id = ? AND user_id = ?').run(category, id, userId);

  res.json(getInvestmentWithMetrics(id, userId));
});

// DELETE /api/investments/:id
router.delete('/:id', (req, res) => {
  const userId = req.userId;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }
  const existing = db.prepare('SELECT * FROM investments WHERE id = ? AND user_id = ?').get(id, userId);
  if (!existing) { res.status(404).json({ error: 'Not found' }); return; }
  db.prepare('DELETE FROM investments WHERE id = ? AND user_id = ?').run(id, userId);
  res.status(204).end();
});

// GET /api/investments/:id/history
router.get('/:id/history', (req, res) => {
  const userId = req.userId;
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return; }

  const inv = db.prepare('SELECT * FROM investments WHERE id = ? AND user_id = ?').get(id, userId);
  if (!inv) { res.status(404).json({ error: 'Not found' }); return; }

  const txs = getAllTxsForInvestment(id, userId);
  if (txs.length === 0) { res.json([]); return; }

  const range = req.query.range as string || 'ALL';
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
});

export default router;
