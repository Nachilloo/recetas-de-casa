/** Entrada servidor: API routes, middleware, páginas .astro. */
export {
  supabase,
  supabaseAdmin,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  setAuthCookies,
  clearAuthCookies,
  createServerClient,
  getUserAndProfile,
  createServerSupabaseClient,
} from './supabase/server';
