import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://xlrnebbbdtmzpbwpiyib.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_GUbOiJBCecM3wfqq_o94nQ_kt_1zNc6';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

