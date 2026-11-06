import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ProfileAccount {
  id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  profiles: ProfileAccount[];
  currentProfile: string;
  signOut: () => Promise<void>;
  signInWithMasterKey: (profileName: string, key: string) => boolean;
  addProfile: (name: string) => Promise<void>;
  removeProfile: (profileId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isConfigured: false,
  profiles: [],
  currentProfile: 'Personal',
  signOut: async () => {},
  signInWithMasterKey: () => false,
  addProfile: async () => {},
  removeProfile: async () => {},
});

async function loadProfilesFromSupabase(): Promise<ProfileAccount[]> {
  try {
    const { data: settingRow } = await supabase
      .from('settings')
      .select('value')
      .eq('user_id', '__global__')
      .eq('key', 'profiles')
      .maybeSingle();

    const profileMap = new Map<string, ProfileAccount>();
    profileMap.set('personal', { id: 'Personal', name: 'Personal Portfolio' });
    profileMap.set('family', { id: 'Family', name: 'Family Portfolio' });
    profileMap.set('malhar', { id: 'Malhar', name: 'Malhar Portfolio' });

    if (settingRow?.value) {
      try {
        const parsed = JSON.parse(settingRow.value);
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            if (p?.id) profileMap.set(p.id.toLowerCase(), p);
          }
        }
      } catch {}
    }

    const { data: invRows } = await supabase
      .from('investments')
      .select('user_id');

    for (const row of invRows || []) {
      if (row.user_id && row.user_id !== '__global__') {
        if (!profileMap.has(row.user_id.toLowerCase())) {
          profileMap.set(row.user_id.toLowerCase(), { id: row.user_id, name: `${row.user_id} Portfolio` });
        }
      }
    }

    return Array.from(profileMap.values());
  } catch (err) {
    console.error('Failed to load profiles from Supabase:', err);
    return [
      { id: 'Personal', name: 'Personal Portfolio' },
      { id: 'Family', name: 'Family Portfolio' },
      { id: 'Malhar', name: 'Malhar Portfolio' },
    ];
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ProfileAccount[]>(() => {
    try {
      const saved = localStorage.getItem('app_saved_profiles');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'Personal', name: 'Personal Portfolio' },
      { id: 'Family', name: 'Family Portfolio' },
      { id: 'Malhar', name: 'Malhar Portfolio' },
    ];
  });
  const [currentProfile, setCurrentProfile] = useState<string>(() => {
    return localStorage.getItem('app_current_profile') || 'Personal';
  });

  const configured = isSupabaseConfigured();

  // Load profiles directly from Supabase cloud
  useEffect(() => {
    loadProfilesFromSupabase()
      .then(fetched => {
        if (Array.isArray(fetched) && fetched.length > 0) {
          setProfiles(fetched);
          localStorage.setItem('app_saved_profiles', JSON.stringify(fetched));
        }
      })
      .catch(err => console.error('Failed to load cloud profiles:', err));
  }, []);

  // Load active session
  useEffect(() => {
    const isMasterAuth = localStorage.getItem('app_master_auth');
    const savedActiveProfile = localStorage.getItem('app_current_profile') || 'Personal';

    if (isMasterAuth === 'true') {
      const mockUser: any = {
        id: savedActiveProfile,
        email: `${savedActiveProfile.toLowerCase()}@portfolio.local`,
        user_metadata: { full_name: `${savedActiveProfile} Portfolio` },
      };
      setUser(mockUser);
      setCurrentProfile(savedActiveProfile);
      setLoading(false);
      return;
    }

    if (!configured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (localStorage.getItem('app_master_auth') === 'true') return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [configured]);

  const addProfile = async (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const exists = profiles.some(p => p.id.toLowerCase() === clean.toLowerCase());
    let updated = profiles;
    if (!exists) {
      const newP: ProfileAccount = { id: clean, name: `${clean} Portfolio` };
      updated = [...profiles, newP];
      setProfiles(updated);
      localStorage.setItem('app_saved_profiles', JSON.stringify(updated));
    }
    try {
      await supabase
        .from('settings')
        .upsert({ user_id: '__global__', key: 'profiles', value: JSON.stringify(updated) });
    } catch (e) {
      console.error('Failed to sync new profile to cloud:', e);
    }
  };

  const removeProfile = async (profileId: string) => {
    const updated = profiles.filter(p => p.id.toLowerCase() !== profileId.toLowerCase());
    setProfiles(updated);
    localStorage.setItem('app_saved_profiles', JSON.stringify(updated));
    try {
      await supabase
        .from('settings')
        .upsert({ user_id: '__global__', key: 'profiles', value: JSON.stringify(updated) });
      await supabase.from('holdings_prices').delete().eq('user_id', profileId);
      await supabase.from('transactions').delete().eq('user_id', profileId);
      await supabase.from('investments').delete().eq('user_id', profileId);
      await supabase.from('settings').delete().eq('user_id', profileId);
    } catch (e) {
      console.error('Failed to delete profile from cloud:', e);
    }
  };

  const signOut = async () => {
    localStorage.removeItem('app_master_auth');
    if (configured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
  };

  // Profile + Master Key Sign-in
  const signInWithMasterKey = (profileId: string, inputKey: string): boolean => {
    const configuredKey = import.meta.env.VITE_MASTER_KEY || 'admin123';
    if (inputKey && inputKey === configuredKey) {
      const activeId = profileId.trim() || 'Personal';
      localStorage.setItem('app_master_auth', 'true');
      localStorage.setItem('app_current_profile', activeId);

      addProfile(activeId);

      const masterUser: any = {
        id: activeId,
        email: `${activeId.toLowerCase()}@portfolio.local`,
        user_metadata: { full_name: `${activeId} Portfolio` },
      };
      setUser(masterUser);
      setCurrentProfile(activeId);
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: configured,
        profiles,
        currentProfile,
        signOut,
        signInWithMasterKey,
        addProfile,
        removeProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
