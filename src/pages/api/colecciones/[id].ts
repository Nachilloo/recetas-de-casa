import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase';

export const prerender = false;

/**
 * PATCH { nombre?, descripcion?, is_public?, slugs?, addSlug?, removeSlug? }
 *   - Si recibe addSlug o removeSlug, manipula el array slugs sin pisar el resto.
 *   - En otro caso, hace update parcial con los campos enviados.
 * DELETE → borra.
 */

export const PATCH: APIRoute = async ({ params, cookies, request }) => {
  const id = params.id;
  if (!id) return json({ error: 'id requerido' }, 400);

  const client = await createServerClient(cookies);
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return json({ error: 'No autenticado' }, 401);

  let body: {
    nombre?: string;
    descripcion?: string;
    is_public?: boolean;
    slugs?: string[];
    addSlug?: string;
    removeSlug?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body inválido' }, 400);
  }

  if (body.addSlug || body.removeSlug) {
    const { data: current, error: fetchErr } = (await client
      .from('colecciones')
      .select('slugs')
      .eq('id', id)
      .eq('user_id', userData.user.id)
      .single()) as { data: { slugs: string[] } | null; error: { message: string } | null };
    if (fetchErr || !current) return json({ error: 'No encontrada' }, 404);

    let newSlugs: string[] = current.slugs ?? [];
    if (body.addSlug && !newSlugs.includes(body.addSlug)) {
      newSlugs = [body.addSlug, ...newSlugs];
    }
    if (body.removeSlug) {
      newSlugs = newSlugs.filter((s: string) => s !== body.removeSlug);
    }
    const { data, error } = await (client as any)
      .from('colecciones')
      .update({ slugs: newSlugs })
      .eq('id', id)
      .eq('user_id', userData.user.id)
      .select()
      .single();
    if (error) return json({ error: error.message }, 500);
    return json({ coleccion: data });
  }

  const patch: Record<string, unknown> = {};
  if (body.nombre !== undefined) patch.nombre = body.nombre.trim().slice(0, 80);
  if (body.descripcion !== undefined) patch.descripcion = body.descripcion;
  if (body.is_public !== undefined) patch.is_public = !!body.is_public;
  if (body.slugs !== undefined) patch.slugs = body.slugs.slice(0, 200);

  if (Object.keys(patch).length === 0) return json({ error: 'Nada que actualizar' }, 400);

  const { data, error } = await (client as any)
    .from('colecciones')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .select()
    .single();
  if (error) return json({ error: error.message }, 500);
  return json({ coleccion: data });
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  const id = params.id;
  if (!id) return json({ error: 'id requerido' }, 400);

  const client = await createServerClient(cookies);
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return json({ error: 'No autenticado' }, 401);

  const { error } = await client
    .from('colecciones')
    .delete()
    .eq('id', id)
    .eq('user_id', userData.user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ success: true });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
