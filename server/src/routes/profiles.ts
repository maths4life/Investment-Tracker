import { Router } from 'express';
import { supabase } from '../supabase.js';

const router = Router();

export interface ProfileItem {
  id: string;
  name: string;
}

const DEFAULT_PROFILES: ProfileItem[] = [
  { id: 'Personal', name: 'Personal Portfolio' },
  { id: 'Family', name: 'Family Portfolio' },
];

async function getStoredProfiles(): Promise<ProfileItem[]> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('user_id', '__global__')
    .eq('key', 'profiles')
    .maybeSingle();

  if (data?.value) {
    try {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  // If not yet saved in settings, check for existing user_ids in investments
  const { data: invRows } = await supabase
    .from('investments')
    .select('user_id');

  const existingUserIds = new Set<string>();
  for (const row of invRows || []) {
    if (row.user_id && row.user_id !== '__global__') {
      existingUserIds.add(row.user_id);
    }
  }

  const profilesMap = new Map<string, ProfileItem>();
  for (const p of DEFAULT_PROFILES) {
    profilesMap.set(p.id.toLowerCase(), p);
  }

  for (const userId of existingUserIds) {
    if (!profilesMap.has(userId.toLowerCase())) {
      profilesMap.set(userId.toLowerCase(), { id: userId, name: `${userId} Portfolio` });
    }
  }

  const combined = Array.from(profilesMap.values());
  // Save combined to Supabase so it's initialized
  await supabase
    .from('settings')
    .upsert({ user_id: '__global__', key: 'profiles', value: JSON.stringify(combined) });

  return combined;
}

// GET /api/profiles - Get all accounts/profiles from Supabase cloud
router.get('/', async (_req, res, next) => {
  try {
    const profiles = await getStoredProfiles();
    res.json(profiles);
  } catch (err) {
    next(err);
  }
});

// POST /api/profiles - Add a new profile
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    const clean = (name || '').trim();
    if (!clean) {
      res.status(400).json({ error: 'Profile name is required' });
      return;
    }

    const profiles = await getStoredProfiles();
    const existing = profiles.find(p => p.id.toLowerCase() === clean.toLowerCase());
    if (existing) {
      res.json(existing);
      return;
    }

    const newProfile: ProfileItem = { id: clean, name: `${clean} Portfolio` };
    const updated = [...profiles, newProfile];

    await supabase
      .from('settings')
      .upsert({ user_id: '__global__', key: 'profiles', value: JSON.stringify(updated) });

    res.status(201).json(newProfile);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/profiles/:id - Delete a profile and purge all its data
router.delete('/:id', async (req, res, next) => {
  try {
    const profileId = req.params.id;
    if (!profileId) {
      res.status(400).json({ error: 'Profile id is required' });
      return;
    }

    // 1. Remove from global profiles list
    const profiles = await getStoredProfiles();
    const updated = profiles.filter(p => p.id.toLowerCase() !== profileId.toLowerCase());
    await supabase
      .from('settings')
      .upsert({ user_id: '__global__', key: 'profiles', value: JSON.stringify(updated) });

    // 2. Wipe data in Supabase for this profile
    await supabase.from('holdings_prices').delete().eq('user_id', profileId);
    await supabase.from('transactions').delete().eq('user_id', profileId);
    await supabase.from('investments').delete().eq('user_id', profileId);
    await supabase.from('settings').delete().eq('user_id', profileId);

    res.json({ success: true, message: `Profile ${profileId} deleted successfully.` });
  } catch (err) {
    next(err);
  }
});

export default router;

