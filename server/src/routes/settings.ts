import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';

const router = Router();

const SettingsSchema = z.record(z.string());

// GET /api/settings
router.get('/', (req, res) => {
  const userId = req.userId;
  const rows = db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(userId) as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json(settings);
});

// PUT /api/settings
router.put('/', (req, res) => {
  const userId = req.userId;
  const parsed = SettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const upsert = db.prepare('INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value');
  const transaction = db.transaction((data: Record<string, string>) => {
    for (const [key, value] of Object.entries(data)) {
      upsert.run(userId, key, value);
    }
  });
  transaction(parsed.data);

  const rows = db.prepare('SELECT key, value FROM settings WHERE user_id = ?').all(userId) as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  res.json(settings);
});

export default router;

