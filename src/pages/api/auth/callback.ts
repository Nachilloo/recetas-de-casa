import type { APIRoute } from 'astro';
import { supabase, setAuthCookies } from '../../../lib/supabase';

export const prerender = false;

/**
 * Callback OAuth.
 * Supabase, tras autenticarse contra Google, redirige aquí con un `?code=...`.
 * Intercambiamos el code por session y dejamos las cookies httpOnly.
 *
 * También se admite `?access_token=...&refresh_token=...` en el hash (flujo implícito)
 * — ese caso lo maneja el cliente vía `/api/auth/callback-token` (no implementado: usamos PKCE).
 */
export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const errorParam = url.searchParams.get('error_description') || url.searchParams.get('error');
  const next = sanitizeNext(url.searchParams.get('next'));

  if (errorParam) {
    return redirect(`/login?error=${encodeURIComponent(errorParam)}`);
  }

  if (!code) {
    return redirect(`/login?error=${encodeURIComponent('Sin código de autorización')}`);
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[auth/callback]', error);
    return redirect(
      `/login?error=${encodeURIComponent(error?.message ?? 'No se pudo completar el inicio de sesión')}`
    );
  }

  setAuthCookies(cookies, data.session.access_token, data.session.refresh_token);
  return redirect(next);
};

/** Evita open-redirect: solo aceptamos paths relativos. */
function sanitizeNext(input: string | null): string {
  if (!input) return '/';
  if (!input.startsWith('/') || input.startsWith('//')) return '/';
  return input;
}
