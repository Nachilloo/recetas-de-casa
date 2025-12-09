import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan las variables de entorno de Supabase. Por favor, configura PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY en tu archivo .env');
}

// Cliente público para operaciones de lectura (seguro para usar en el cliente)
// Con persistSession para que guarde la sesión en localStorage
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'sb-auth-token',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }
});

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
  
  console.log('[Supabase Server] Cookies recibidas:', cookies ? 'Sí' : 'No');
  
  // Extraer los tokens de las cookies
  const cookieMap = new Map();
  cookies.split(';').forEach(cookie => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      cookieMap.set(key, value);
    }
  });
  
  const accessToken = cookieMap.get('sb-access-token');
  const refreshToken = cookieMap.get('sb-refresh-token');
  
  console.log('[Supabase Server] Tokens encontrados:', {
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken
  });
  
  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: accessToken ? {
        Authorization: `Bearer ${accessToken}`
      } : {}
    }
  });

  // Si tenemos ambos tokens, intentar establecer la sesión
  if (accessToken && refreshToken) {
    console.log('[Supabase Server] Intentando establecer sesión con tokens');
    // Esto es asíncrono pero no podemos await aquí
    client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    }).then(({ data, error }) => {
      console.log('[Supabase Server] Resultado de setSession:', {
        hasSession: !!data.session,
        error: error?.message
      });
    });
  }
  
  return client;
}

