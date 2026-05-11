import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const prerender = false;

/**
 * Inicia el flujo OAuth con Google.
 * Devuelve un redirect a la URL de autorización generada por Supabase.
 *
 * Configuración requerida (una sola vez, manual):
 *   - Supabase Dashboard → Authentication → Providers → Google: pegar Client ID/Secret de Google Cloud Console.
 *   - Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:
 *       https://<dominio>/api/auth/callback
 *       http://localhost:4321/api/auth/callback
 *   - Google Cloud Console → Authorized redirect URIs:
 *       https://<proyecto>.supabase.co/auth/v1/callback
 */
export const GET: APIRoute = async ({ url, redirect }) => {
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || url.origin;
  const next = url.searchParams.get('next') || '/';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}/api/auth/callback?next=${encodeURIComponent(next)}`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return new Response(
      JSON.stringify({ success: false, error: error?.message ?? 'No se pudo iniciar OAuth' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return redirect(data.url);
};
