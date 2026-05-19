import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types';
import { supabaseAnonKey, supabaseUrl } from './env';

/** Cliente Supabase solo para el navegador (formularios de auth, etc.). */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'sb-auth-token',
    storage: window.localStorage,
    flowType: 'pkce',
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
