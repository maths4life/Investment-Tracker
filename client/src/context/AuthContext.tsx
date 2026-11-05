import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithMasterKey: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isConfigured: false,
  signOut: async () => {},
  signInWithGoogle: async () => ({ error: null }),
  signInWithMasterKey: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  // Check master key session in localStorage
  useEffect(() => {
    const isMasterAuth = localStorage.getItem('app_master_auth');
    if (isMasterAuth === 'true') {
      const mockUser: any = {
        id: 'master-owner',
        email: 'owner@portfolio.local',
        user_metadata: { full_name: 'Portfolio Owner' },
      };
      setUser(mockUser);
      setLoading(false);
      return;
    }

    if (!configured) {
      setLoading(false);
      return;
    }

    // Get current Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen to Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (localStorage.getItem('app_master_auth') === 'true') return;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [configured]);

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

  // 2. Direct Master Key Sign-in
  const signInWithMasterKey = (inputKey: string): boolean => {
    const configuredKey = import.meta.env.VITE_MASTER_KEY || 'admin123';
    if (inputKey && inputKey === configuredKey) {
      localStorage.setItem('app_master_auth', 'true');
      const masterUser: any = {
        id: 'master-owner',
        email: 'owner@portfolio.local',
        user_metadata: { full_name: 'Portfolio Owner' },
      };
      setUser(masterUser);
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
        signOut,
        signInWithGoogle,
        signInWithMasterKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
