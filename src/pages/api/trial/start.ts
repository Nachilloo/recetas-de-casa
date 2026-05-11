import type { APIRoute } from 'astro';
import { createServerClient, supabaseAdmin } from '../../../lib/supabase';
import { computeTrialEnd } from '../../../lib/plan';

export const prerender = false;

/**
 * Activa el trial de 10 días para el usuario actual.
 *
 * Reglas:
 *   - Debe estar autenticado.
 *   - Debe estar en plan 'free' (no ya en trial o pro).
 *   - Si ya tiene `trial_used_at`, no puede volver a activar.
 *   - El plan y los timestamps los escribe SOLO el service_role (RLS los bloquea).
 *
 * Acepta GET y POST para que el botón pueda ser <form method=POST> o <a href>.
 */

async function handle(cookies: Parameters<typeof createServerClient>[0]) {
  if (!supabaseAdmin) {
    return json(
      {
        error: 'SUPABASE_SERVICE_ROLE_KEY no configurada en el servidor; no se puede activar el trial.',
      },
      500
    );
  }

  const client = await createServerClient(cookies);
  const { data: userData } = await client.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: 'No autenticado' }, 401);

  const { data: profile } = (await supabaseAdmin
    .from('profiles')
    .select('id, plan, trial_used_at')
    .eq('id', user.id)
    .maybeSingle()) as {
    data: { id: string; plan: string; trial_used_at: string | null } | null;
  };

  if (!profile) return json({ error: 'Perfil no encontrado' }, 404);

  if (profile.trial_used_at) {
    return json(
      {
        error: 'Ya usaste tu trial. Suscríbete a Pro para acceder a las funciones avanzadas.',
        upgrade: '/precios',
      },
      400
    );
  }

  if (profile.plan === 'pro') {
    return json({ error: 'Ya tienes plan Pro.' }, 400);
  }

  const now = new Date();
  const ends = computeTrialEnd(now);

  const { error } = await (supabaseAdmin as any)
    .from('profiles')
    .update({
      plan: 'trial',
      trial_started_at: now.toISOString(),
      trial_ends_at: ends.toISOString(),
      trial_used_at: now.toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    console.error('[trial/start]', error);
    return json({ error: 'No se pudo activar el trial.' }, 500);
  }

  return new Response(null, {
    status: 303,
    headers: { Location: '/perfil/plan' },
  });
}

export const POST: APIRoute = async ({ cookies }) => handle(cookies);
export const GET: APIRoute = async ({ cookies }) => handle(cookies);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
