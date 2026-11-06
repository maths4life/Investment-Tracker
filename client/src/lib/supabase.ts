import { createClient } from '@supabase/supabase-js';

// Fallback to project credentials so it always works even if Vercel env vars were omitted
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xlrnebbbdtmzpbwpiyib.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_GUbOiJBCecM3wfqq_o94nQ_kt_1zNc6';

export const isSupabaseConfigured = () => {
  return true;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

