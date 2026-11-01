import { createClient } from '@supabase/supabase-js';

const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
// Ensure no trailing slash or invalid subpath
const supabaseUrl = rawUrl.replace(/\/+$/, '');
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') &&
  supabaseUrl !== 'https://your-project.supabase.co'
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
