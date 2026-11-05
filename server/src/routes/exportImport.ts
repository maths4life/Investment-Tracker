import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';

const router = Router();

// GET /api/export/json
router.get('/json', (_req, res) => {
  const investments = db.prepare('SELECT * FROM investments').all();
  const transactions = db.prepare('SELECT * FROM transactions').all();
  const settings = db.prepare('SELECT * FROM settings').all();
  const holdingsPrices = db.prepare('SELECT * FROM holdings_prices').all();

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="investment-tracker-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ version: 1, exportedAt: new Date().toISOString(), investments, transactions, settings, holdingsPrices });
});

// GET /api/export/csv
router.get('/csv', (_req, res) => {
  const transactions = db.prepare(`
    SELECT t.id, i.name as investment_name, i.category, t.type, t.date, t.amount, t.note, t.stock_name, t.shares, t.price_per_share, t.created_at
    FROM transactions t
    JOIN investments i ON i.id = t.investment_id
    ORDER BY t.date DESC, t.id DESC
  `).all() as Record<string, unknown>[];

  const headers = ['id', 'investment_name', 'category', 'type', 'date', 'amount_paise', 'amount_inr', 'note', 'stock_name', 'shares', 'price_per_share', 'created_at'];
  const rows = transactions.map(t => [
    t.id, t.investment_name, t.category, t.type, t.date, t.amount,
    ((t.amount as number) / 100).toFixed(2),
    t.note ?? '', t.stock_name ?? '', t.shares ?? '',
    t.price_per_share != null ? ((t.price_per_share as number) / 100).toFixed(2) : '',
    t.created_at,
  ]);

  const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="investment-tracker-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv);
});

// Schema for JSON import
const ImportSchema = z.object({
  version: z.number(),
  investments: z.array(z.object({
    id: z.number(),
    name: z.string(),
    category: z.string(),
    created_at: z.string(),
  })),
  transactions: z.array(z.object({
    id: z.number(),
    investment_id: z.number(),
    type: z.string(),
    date: z.string(),
    amount: z.number(),
    note: z.string().nullable().optional(),
    stock_name: z.string().nullable().optional(),
    shares: z.number().nullable().optional(),
    price_per_share: z.number().nullable().optional(),
    created_at: z.string(),
  })),
  settings: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  holdingsPrices: z.array(z.object({
    investment_id: z.number(),
    stock_name: z.string(),
    price_per_share: z.number(),
    updated_at: z.string(),
  })).optional(),
});

// POST /api/import/json
router.post('/json', (req, res) => {
  const parsed = ImportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid backup file format', details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;

  try {
    db.exec('BEGIN');
    db.exec('DELETE FROM holdings_prices');
    db.exec('DELETE FROM transactions');
    db.exec('DELETE FROM investments');
    db.exec('DELETE FROM settings');

    for (const inv of data.investments) {
      db.prepare('INSERT INTO investments (id, name, category, created_at) VALUES (?, ?, ?, ?)').run(inv.id, inv.name, inv.category, inv.created_at);
    }
    for (const tx of data.transactions) {
      db.prepare('INSERT INTO transactions (id, investment_id, type, date, amount, note, stock_name, shares, price_per_share, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
        tx.id, tx.investment_id, tx.type, tx.date, tx.amount, tx.note ?? null, tx.stock_name ?? null, tx.shares ?? null, tx.price_per_share ?? null, tx.created_at
      );
    }
    if (data.settings) {
      for (const s of data.settings) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(s.key, s.value);
      }
    }
    if (data.holdingsPrices) {
      for (const p of data.holdingsPrices) {
        db.prepare('INSERT OR REPLACE INTO holdings_prices (investment_id, stock_name, price_per_share, updated_at) VALUES (?, ?, ?, ?)').run(p.investment_id, p.stock_name, p.price_per_share, p.updated_at);
      }
    }

    // Reset sqlite sequences
    try {
      const maxInvId = data.investments.reduce((m, i) => Math.max(m, i.id), 0);
      const maxTxId = data.transactions.reduce((m, t) => Math.max(m, t.id), 0);
      if (maxInvId > 0) db.prepare(`UPDATE sqlite_sequence SET seq = ? WHERE name = 'investments'`).run(maxInvId);
      if (maxTxId > 0) db.prepare(`UPDATE sqlite_sequence SET seq = ? WHERE name = 'transactions'`).run(maxTxId);
    } catch {}

    db.exec('COMMIT');
    res.json({ success: true, invested: data.investments.length, transactions: data.transactions.length });
  } catch (err: unknown) {
    try { db.exec('ROLLBACK'); } catch {}
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Import failed', details: msg });
  }
});

export default router;
