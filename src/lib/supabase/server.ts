import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';
import type { Database } from '../types';
import { supabaseAnonKey, supabaseServiceKey, supabaseUrl } from './env';
import { nodeRealtime } from './realtime-node';

/**
 * Cliente público (anon) en servidor. Útil para datos públicos (recetas).
 * NO lo uses para operaciones autenticadas; usa `createServerClient(cookies)`.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  realtime: nodeRealtime,
});

/**
 * Cliente admin con service_role. SOLO servidor.
 */
export const supabaseAdmin: SupabaseClient<Database> | null = supabaseServiceKey
  ? createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: nodeRealtime,
    })
  : null;

export const ACCESS_TOKEN_COOKIE = 'sb-access-token';
export const REFRESH_TOKEN_COOKIE = 'sb-refresh-token';

const ACCESS_TOKEN_MAX_AGE = 60 * 60;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30;

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

export async function createServerClient(
  cookies: AstroCookies
): Promise<SupabaseClient<Database>> {
  const accessToken = cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: nodeRealtime,
  });

  if (accessToken && refreshToken) {
    const { data, error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (!error && data.session) {
      if (
        data.session.access_token !== accessToken ||
        data.session.refresh_token !== refreshToken
      ) {
        setAuthCookies(cookies, data.session.access_token, data.session.refresh_token);
      }
    } else if (error) {
      clearAuthCookies(cookies);
    }
  }

  return client;
}

export async function getUserAndProfile(cookies: AstroCookies): Promise<{
  user: import('@supabase/supabase-js').User | null;
  profile: import('../types').Profile | null;
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

/**
 * @deprecated Usa `createServerClient(Astro.cookies)` en su lugar.
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
    realtime: nodeRealtime,
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });

  if (accessToken && refreshToken) {
    void client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  return client;
}
