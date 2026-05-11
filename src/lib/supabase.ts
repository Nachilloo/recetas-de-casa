import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';
import type { Database } from './types';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan las variables de entorno de Supabase. Configura PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY en tu archivo .env'
  );
}

/**
 * Cliente público (anon) genérico. Útil para datos públicos (recetas).
 * NO lo uses para operaciones autenticadas; usa `createServerClient(cookies)`.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: typeof window !== 'undefined',
    storageKey: 'sb-auth-token',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

/**
 * Cliente admin con service_role. SOLO servidor.
 * Bypasea RLS, úsalo para escribir plan/trial/stripe o leer datos públicos en API routes.
 */
export const supabaseAdmin: SupabaseClient<Database> | null = supabaseServiceKey
  ? createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// ─────────────────────────────────────────────────────────────────
// Cookies utilities
// ─────────────────────────────────────────────────────────────────

export const ACCESS_TOKEN_COOKIE = 'sb-access-token';
export const REFRESH_TOKEN_COOKIE = 'sb-refresh-token';

const ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hora
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

const isProd = import.meta.env.PROD;

const cookieBase = {
  path: '/',
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax' as const,
};

export function setAuthCookies(
  cookies: AstroCookies,
  accessToken: string,
  refreshToken: string
) {
  cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...cookieBase,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...cookieBase,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

export function clearAuthCookies(cookies: AstroCookies) {
  cookies.delete(ACCESS_TOKEN_COOKIE, { path: '/' });
  cookies.delete(REFRESH_TOKEN_COOKIE, { path: '/' });
}

// ─────────────────────────────────────────────────────────────────
// Server-side client tied to a request's cookies
// ─────────────────────────────────────────────────────────────────

/**
 * Crea un cliente Supabase ligado a las cookies de la request actual.
 * Si hay tokens en cookies, establece la sesión antes de devolver.
 * Si Supabase refresca el token, lo escribe de vuelta a las cookies.
 */
export async function createServerClient(
  cookies: AstroCookies
): Promise<SupabaseClient<Database>> {
  const accessToken = cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (accessToken && refreshToken) {
    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (!error && data.session) {
      // Si los tokens cambiaron (refresh), persistir los nuevos
      if (
        data.session.access_token !== accessToken ||
        data.session.refresh_token !== refreshToken
      ) {
        setAuthCookies(cookies, data.session.access_token, data.session.refresh_token);
      }
    } else if (error) {
      // Tokens inválidos: limpiar para que el visitante quede como anónimo
      clearAuthCookies(cookies);
    }
  }

  return client;
}

/**
 * Devuelve { user, profile } a partir del estado actual de cookies.
 * No lanza nunca; visitante anónimo o tokens inválidos → ambos null.
 */
export async function getUserAndProfile(cookies: AstroCookies): Promise<{
  user: import('@supabase/supabase-js').User | null;
  profile: import('./types').Profile | null;
}> {
  const client = await createServerClient(cookies);
  const { data: userData } = await client.auth.getUser();
  const user = userData.user ?? null;

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return { user, profile: profile ?? null };
}

// ─────────────────────────────────────────────────────────────────
// Legacy helper (compat con código existente en /admin)
// ─────────────────────────────────────────────────────────────────

/**
 * @deprecated Usa `createServerClient(Astro.cookies)` en su lugar.
 * Esta versión recibe la Request directamente; se mantiene para no romper
 * los endpoints del admin que ya la usan.
 */
export function createServerSupabaseClient(request: Request): SupabaseClient<Database> {
  const cookieHeader = request.headers.get('cookie') || '';
  const cookieMap = new Map<string, string>();
  cookieHeader.split(';').forEach((c) => {
    const [k, ...v] = c.trim().split('=');
    if (k && v.length) cookieMap.set(k, v.join('='));
  });

  const accessToken = cookieMap.get(ACCESS_TOKEN_COOKIE);
  const refreshToken = cookieMap.get(REFRESH_TOKEN_COOKIE);

  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });

  if (accessToken && refreshToken) {
    // No await — el helper legacy mantiene comportamiento previo (fire-and-forget).
    void client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  return client;
}
