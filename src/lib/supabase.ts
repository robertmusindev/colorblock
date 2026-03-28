import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'https://placeholder.supabase.co') {
  console.error(
    'CRITICAL: Supabase URL or Anon Key is missing or invalid! \n' +
    '1. Check your .env file locally for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
    '2. If on Netlify/Vercel: Go to your Project Settings > Environment Variables and manually add these two keys with your Supabase credentials.'
  );
}

export const supabase = (supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co')
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-anon-key');
