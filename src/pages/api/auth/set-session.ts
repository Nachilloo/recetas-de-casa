import type { APIRoute } from 'astro';
import { setAuthCookies, supabase } from '../../../lib/supabase';

export const prerender = false;

/**
 * Recibe { access_token, refresh_token } desde el cliente (después de un
 * OAuth con Supabase, hecho íntegramente en el navegador con PKCE), y los
 * persiste como cookies httpOnly para que el servidor pueda leer la sesión
 * en los siguientes requests (middleware, API, SSR de páginas).
 *
 * Verifica que el access_token sea válido antes de aceptarlo.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  let body: { access_token?: string; refresh_token?: string };
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'Body inválido' }, 400);
  }

  const accessToken = body.access_token;
  const refreshToken = body.refresh_token;

  if (!accessToken || !refreshToken) {
    return json({ success: false, error: 'Faltan tokens' }, 400);
  }

  // Verificar que el access_token es válido contra Supabase
  const { data: userData, error } = await supabase.auth.getUser(accessToken);
  if (error || !userData.user) {
    console.error('[set-session] token inválido:', error?.message);
    return json({ success: false, error: 'Token inválido' }, 401);
  }

  setAuthCookies(cookies, accessToken, refreshToken);
  return json({ success: true, user: { id: userData.user.id, email: userData.user.email } });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
