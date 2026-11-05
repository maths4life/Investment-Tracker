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
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithMasterKey: (profileName: string, key: string) => boolean;
  addProfile: (name: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isConfigured: false,
  profiles: [],
  currentProfile: 'Default Portfolio',
  signOut: async () => {},
  signInWithGoogle: async () => ({ error: null }),
  signInWithMasterKey: () => false,
  addProfile: () => {},
});

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
    ];
  });
  const [currentProfile, setCurrentProfile] = useState<string>(() => {
    return localStorage.getItem('app_current_profile') || 'Personal';
  });

  const configured = isSupabaseConfigured();

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
      if (session?.user?.email) {
        setCurrentProfile(session.user.email);
        localStorage.setItem('app_current_profile', session.user.email);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (localStorage.getItem('app_master_auth') === 'true') return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.email) {
        setCurrentProfile(session.user.email);
        localStorage.setItem('app_current_profile', session.user.email);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [configured]);

  const addProfile = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const exists = profiles.some(p => p.id.toLowerCase() === clean.toLowerCase());
    if (exists) return;
    const updated = [...profiles, { id: clean, name: `${clean} Portfolio` }];
    setProfiles(updated);
    localStorage.setItem('app_saved_profiles', JSON.stringify(updated));
  };

  const signOut = async () => {
    localStorage.removeItem('app_master_auth');
    if (configured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
  };

  // 1. One-click Google Sign-in
  const signInWithGoogle = async () => {
    try {
      if (!configured) throw new Error('Supabase is not configured.');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) return { error };
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // 2. Profile + Master Key Sign-in
  const signInWithMasterKey = (profileId: string, inputKey: string): boolean => {
    const configuredKey = import.meta.env.VITE_MASTER_KEY || 'admin123';
    if (inputKey && inputKey === configuredKey) {
      const activeId = profileId.trim() || 'Personal';
      localStorage.setItem('app_master_auth', 'true');
      localStorage.setItem('app_current_profile', activeId);

      // Add to saved profiles list if new
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
        signInWithGoogle,
        signInWithMasterKey,
        addProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
