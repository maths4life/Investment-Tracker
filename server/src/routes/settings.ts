import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';

const router = Router();

const SettingsSchema = z.record(z.string());

// GET /api/settings
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { data: rows, error } = await supabase
      .from('settings')
      .select('key, value')
      .eq('user_id', userId);

    if (error) throw error;

    const settings: Record<string, string> = {};
    for (const row of rows || []) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings
router.put('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const parsed = SettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const upserts = Object.entries(parsed.data).map(([key, value]) => ({
      user_id: userId,
      key,
      value,
    }));

    if (upserts.length > 0) {
      const { error } = await supabase
        .from('settings')
        .upsert(upserts, { onConflict: 'user_id,key' });

      if (error) throw error;
    }

    const { data: rows } = await supabase
      .from('settings')
      .select('key, value')
      .eq('user_id', userId);

    const settings: Record<string, string> = {};
    for (const row of rows || []) settings[row.key] = row.value;
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/settings/account - Delete all account data for this profile
router.delete('/account', async (req, res, next) => {
  try {
    const userId = req.userId;
    await supabase.from('holdings_prices').delete().eq('user_id', userId);
    await supabase.from('transactions').delete().eq('user_id', userId);
    await supabase.from('investments').delete().eq('user_id', userId);
    await supabase.from('settings').delete().eq('user_id', userId);
    res.json({ success: true, message: `Account ${userId} deleted successfully.` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Failed to delete account', details: msg });
  }
});

export default router;
