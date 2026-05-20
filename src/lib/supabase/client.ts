import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types';
import { supabaseAnonKey, supabaseUrl } from './env';

let browserClient: SupabaseClient<Database> | undefined;

/** Cliente Supabase solo para el navegador (OAuth PKCE, localStorage, etc.). */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (typeof window === 'undefined') {
    throw new Error('getSupabaseBrowserClient() is only available in the browser');
  }
  browserClient ??= createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      storageKey: 'sb-auth-token',
      storage: window.localStorage,
      flowType: 'pkce',
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return browserClient;
}
