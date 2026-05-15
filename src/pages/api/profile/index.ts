import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase';

export const prerender = false;

/**
 * PATCH { username?, display_name?, bio?, is_public? }
 *
 * `username` se valida con regex: 3-30 chars, [a-z0-9-], no empieza con '-'.
 * Si el username ya está cogido por otro usuario, devolvemos 409.
 *
 * El `plan`, `trial_*` y `stripe_*` NO se pueden cambiar desde aquí (RLS lo bloquea).
 */

const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{2,29}$/;
const RESERVED = new Set([
  'admin', 'api', 'login', 'logout', 'registro', 'register', 'perfil',
  'profile', 'precios', 'pricing', 'menu-semanal', 'recetas', 'buscar',
  'about', 'u', 'usuarios', 'user', 'cuenta', 'soporte', 'help',
  'contacto', 'sugerencias',
]);

export const PATCH: APIRoute = async ({ cookies, request }) => {
  const client = await createServerClient(cookies);
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return json({ error: 'No autenticado' }, 401);
  const userId = userData.user.id;

  let body: {
    username?: string | null;
    display_name?: string;
    bio?: string;
    is_public?: boolean;
    avatar_url?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body inválido' }, 400);
  }

  const patch: Record<string, unknown> = {};

  if (body.username !== undefined) {
    if (body.username === null || body.username === '') {
      patch.username = null;
      patch.is_public = false;
    } else {
      const u = body.username.trim().toLowerCase();
      if (!USERNAME_REGEX.test(u)) {
        return json(
          {
            error:
              'El username debe tener entre 3 y 30 caracteres, solo letras minúsculas, números y guiones, y no empezar con guión.',
          },
          400
        );
      }
      if (RESERVED.has(u)) {
        return json({ error: 'Ese username está reservado.' }, 400);
      }
      const { data: collision } = await client
        .from('profiles')
        .select('id')
        .eq('username', u)
        .neq('id', userId)
        .maybeSingle();
      if (collision) return json({ error: 'Ese username ya está cogido.' }, 409);
      patch.username = u;
    }
  }

  if (body.display_name !== undefined) {
    patch.display_name = body.display_name.trim().slice(0, 60) || null;
  }
  if (body.bio !== undefined) {
    patch.bio = body.bio.trim().slice(0, 280) || null;
  }
  if (body.is_public !== undefined) {
    patch.is_public = !!body.is_public;
  }
  if (body.avatar_url !== undefined) {
    patch.avatar_url = body.avatar_url || null;
  }

  if (Object.keys(patch).length === 0) {
    return json({ error: 'Nada que actualizar' }, 400);
  }

  // Si pide is_public=true pero todavía no tiene username, lo rechazamos.
  if (patch.is_public === true) {
    const { data: current } = (await client
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .maybeSingle()) as { data: { username: string | null } | null };
    const finalUsername = (patch.username as string | null | undefined) ?? current?.username ?? null;
    if (!finalUsername) {
      return json(
        { error: 'Elige primero un username para poder hacer público tu perfil.' },
        400
      );
    }
  }

  const { data, error } = await (client as any)
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single();
  if (error) return json({ error: error.message }, 500);
  return json({ profile: data });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
