import type { APIRoute } from 'astro';
import { supabase, setAuthCookies } from '../../../lib/supabase';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { email, password, displayName } = await request.json();

    if (!email || !password) {
      return json({ success: false, error: 'Email y contraseña son obligatorios' }, 400);
    }
    if (typeof password !== 'string' || password.length < 8) {
      return json({ success: false, error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: displayName ?? undefined },
      },
    });

    if (error) {
      return json({ success: false, error: traducirError(error.message) }, 400);
    }

    // Si el proyecto tiene confirmación de email activada, no llega session.
    if (data.session) {
      setAuthCookies(cookies, data.session.access_token, data.session.refresh_token);
      return json({ success: true, requiresEmailConfirmation: false, user: data.user });
    }

    return json({
      success: true,
      requiresEmailConfirmation: true,
      message: 'Te hemos enviado un email para confirmar la cuenta.',
    });
  } catch (err) {
    console.error('[signup]', err);
    return json({ success: false, error: 'Error al procesar la solicitud' }, 500);
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function traducirError(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes('already registered')) return 'Este email ya está registrado.';
  if (lower.includes('invalid email')) return 'El email no es válido.';
  if (lower.includes('password')) return 'La contraseña no cumple los requisitos.';
  return msg;
}
