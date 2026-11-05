import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  signOut: () => Promise<void>;
  signInWithPasskey: () => Promise<{ error: Error | null }>;
  registerPasskey: (name?: string) => Promise<{ error: Error | null }>;
  listPasskeys: () => Promise<{ factors: any[]; error: Error | null }>;
  deletePasskey: (factorId: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isConfigured: false,
  signOut: async () => {},
  signInWithPasskey: async () => ({ error: null }),
  registerPasskey: async () => ({ error: null }),
  listPasskeys: async () => ({ factors: [], error: null }),
  deletePasskey: async () => ({ error: null }),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [configured]);

  const signOut = async () => {
    if (configured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
  };

  // WebAuthn / Passkey Sign-in via Supabase MFA/WebAuthn
  const signInWithPasskey = async () => {
    try {
      if (!configured) throw new Error('Supabase is not configured.');
      // WebAuthn sign in with Supabase
      const { data, error } = await (supabase.auth as any).signInWithPasskey();
      if (error) return { error };
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  // Register a new passkey factor for the current logged-in user
  const registerPasskey = async (name: string = 'My Security Key') => {
    try {
      if (!configured) throw new Error('Supabase is not configured.');
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'webauthn',
        friendlyName: name,
      } as any);

      if (error) return { error };

      // Challenge confirmation is triggered by the browser WebAuthn prompt
      if (data && (data as any).challenge) {
        const challengeId = (data as any).id;
        const verifyRes = await supabase.auth.mfa.challengeAndVerify({
          factorId: challengeId,
        } as any);
        if (verifyRes.error) return { error: verifyRes.error };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const listPasskeys = async () => {
    try {
      if (!configured) return { factors: [], error: null };
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return { factors: [], error };
      const webauthnFactors = (data?.all || []).filter((f: any) => f.factor_type === 'webauthn');
      return { factors: webauthnFactors, error: null };
    } catch (err: any) {
      return { factors: [], error: err };
    }
  };

  const deletePasskey = async (factorId: string) => {
    try {
      if (!configured) throw new Error('Supabase is not configured.');
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      return { error };
    } catch (err: any) {
      return { error: err };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: configured,
        signOut,
        signInWithPasskey,
        registerPasskey,
        listPasskeys,
        deletePasskey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

