import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase';

export const prerender = false;

/**
 * GET /api/favoritos  → lista de slugs favoritos del usuario actual.
 * POST /api/favoritos { slug: string } → toggle (añade si no estaba, quita si sí).
 */

export const GET: APIRoute = async ({ cookies }) => {
  const client = await createServerClient(cookies);
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) {
    return json({ favoritos: [] });
  }
  const { data, error } = (await client
    .from('favoritos')
    .select('receta_slug, created_at')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false })) as {
    data: { receta_slug: string; created_at: string }[] | null;
    error: { message: string } | null;
  };

  if (error) return json({ error: error.message }, 500);
  return json({ favoritos: (data ?? []).map((f) => f.receta_slug) });
};

export const POST: APIRoute = async ({ cookies, request }) => {
  const client = await createServerClient(cookies);
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) {
    return json({ error: 'No autenticado' }, 401);
  }

  let body: { slug?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body inválido' }, 400);
  }
  const slug = body.slug?.trim();
  if (!slug) return json({ error: 'slug requerido' }, 400);

  // ¿ya existe?
  const { data: existing } = await client
    .from('favoritos')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .eq('receta_slug', slug)
    .maybeSingle();

  if (existing) {
    const { error } = await client
      .from('favoritos')
      .delete()
      .eq('user_id', userData.user.id)
      .eq('receta_slug', slug);
    if (error) return json({ error: error.message }, 500);
    return json({ favorito: false });
  } else {
    const { error } = await (client as any)
      .from('favoritos')
      .insert({ user_id: userData.user.id, receta_slug: slug });
    if (error) return json({ error: error.message }, 500);
    return json({ favorito: true });
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
