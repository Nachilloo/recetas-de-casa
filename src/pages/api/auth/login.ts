import type { APIRoute } from 'astro';
import { supabase, setAuthCookies } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return json({ success: false, error: 'Email y contraseña son obligatorios' }, 400);
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      return json(
        { success: false, error: error?.message ?? 'No se pudo iniciar sesión' },
        401
      );
    }

    setAuthCookies(cookies, data.session.access_token, data.session.refresh_token);

    return json({ success: true, user: data.user });
  } catch (err) {
    console.error('[login]', err);
    return json({ success: false, error: 'Error al procesar la solicitud' }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
