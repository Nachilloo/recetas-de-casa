import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase';

export const prerender = false;

/**
 * GET → lista de colecciones del usuario actual.
 * POST { nombre, descripcion?, is_public?, slugs? } → crea una colección nueva.
 */

export const GET: APIRoute = async ({ cookies }) => {
  const client = await createServerClient(cookies);
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return json({ colecciones: [] });

  const { data, error } = await client
    .from('colecciones')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json({ colecciones: data });
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const client = await createServerClient(cookies);
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return json({ error: 'No autenticado' }, 401);

  let body: { nombre?: string; descripcion?: string; is_public?: boolean; slugs?: string[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body inválido' }, 400);
  }

  const nombre = body.nombre?.trim();
  if (!nombre) return json({ error: 'nombre requerido' }, 400);
  if (nombre.length > 80) return json({ error: 'nombre demasiado largo' }, 400);

  const { data, error } = await (client as any)
    .from('colecciones')
    .insert({
      user_id: userData.user.id,
      nombre,
      descripcion: body.descripcion ?? null,
      is_public: !!body.is_public,
      slugs: Array.isArray(body.slugs) ? body.slugs.slice(0, 200) : [],
    })
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ coleccion: data });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
