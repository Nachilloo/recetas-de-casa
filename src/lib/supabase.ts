import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno de Supabase. Por favor, configura PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY en tu archivo .env');
}

// Cliente público para operaciones de lectura (seguro para usar en el cliente)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

// Cliente admin con service role key para operaciones privilegiadas (SOLO SERVIDOR)
// Este cliente bypasea RLS, úsalo solo en API routes y código del servidor
export const supabaseAdmin = supabaseServiceKey 
  ? createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

// Helper para crear un cliente con contexto de request (para cookies de sesión)
export function createServerSupabaseClient(request: Request) {
  const cookies = request.headers.get('cookie') || '';
  
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        cookie: cookies
      }
    }
  });
}

