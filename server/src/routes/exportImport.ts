import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';

const router = Router();

// GET /api/export/json
router.get('/json', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { data: investments } = await supabase.from('investments').select('*').eq('user_id', userId);
    const { data: transactions } = await supabase.from('transactions').select('*').eq('user_id', userId);
    const { data: settings } = await supabase.from('settings').select('*').eq('user_id', userId);
    const { data: holdingsPrices } = await supabase.from('holdings_prices').select('*').eq('user_id', userId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="investment-tracker-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({
      version: 1,
      exportedAt: new Date().toISOString(),
      investments: investments || [],
      transactions: transactions || [],
      settings: settings || [],
      holdingsPrices: holdingsPrices || [],
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/export/csv
router.get('/csv', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, investments(name, category)')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .order('id', { ascending: false });

    const headers = ['id', 'investment_name', 'category', 'type', 'date', 'amount_paise', 'amount_inr', 'note', 'stock_name', 'shares', 'price_per_share', 'created_at'];
    const rows = (transactions || []).map((t: any) => [
      t.id,
      t.investments?.name || '',
      t.investments?.category || '',
      t.type,
      t.date,
      t.amount,
      (Number(t.amount) / 100).toFixed(2),
      t.note ?? '',
      t.stock_name ?? '',
      t.shares ?? '',
      t.price_per_share != null ? (Number(t.price_per_share) / 100).toFixed(2) : '',
      t.created_at,
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="investment-tracker-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// Schema for JSON import
const ImportSchema = z.object({
  version: z.number(),
  investments: z.array(z.object({
    id: z.number().optional(),
    name: z.string(),
    category: z.string(),
    created_at: z.string().optional(),
  })),
  transactions: z.array(z.object({
    id: z.number().optional(),
    investment_id: z.number(),
    type: z.string(),
    date: z.string(),
    amount: z.number(),
    note: z.string().nullable().optional(),
    stock_name: z.string().nullable().optional(),
    shares: z.number().nullable().optional(),
    price_per_share: z.number().nullable().optional(),
    created_at: z.string().optional(),
  })),
  settings: z.array(z.object({ key: z.string(), value: z.string() })).optional(),
  holdingsPrices: z.array(z.object({
    investment_id: z.number(),
    stock_name: z.string(),
    price_per_share: z.number(),
    updated_at: z.string().optional(),
  })).optional(),
});

// POST /api/import/json
router.post('/json', async (req, res, next) => {
  try {
    const userId = req.userId;
    const parsed = ImportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid backup file format', details: parsed.error.flatten() });
      return;
    }

    const data = parsed.data;

    // Clear existing for this profile
    await supabase.from('holdings_prices').delete().eq('user_id', userId);
    await supabase.from('transactions').delete().eq('user_id', userId);
    await supabase.from('investments').delete().eq('user_id', userId);
    await supabase.from('settings').delete().eq('user_id', userId);

    if (data.investments.length > 0) {
      const invToInsert = data.investments.map(i => ({ ...i, user_id: userId }));
      const { error } = await supabase.from('investments').insert(invToInsert);
      if (error) throw error;
    }

    if (data.transactions.length > 0) {
      const txToInsert = data.transactions.map(t => ({ ...t, user_id: userId }));
      const { error } = await supabase.from('transactions').insert(txToInsert);
      if (error) throw error;
    }

    if (data.settings && data.settings.length > 0) {
      const setToInsert = data.settings.map(s => ({ ...s, user_id: userId }));
      const { error } = await supabase.from('settings').insert(setToInsert);
      if (error) throw error;
    }

    if (data.holdingsPrices && data.holdingsPrices.length > 0) {
      const hpToInsert = data.holdingsPrices.map(h => ({ ...h, user_id: userId }));
      const { error } = await supabase.from('holdings_prices').insert(hpToInsert);
      if (error) throw error;
    }

    res.json({ success: true, invested: data.investments.length, transactions: data.transactions.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Import failed', details: msg });
  }
});

export default router;
