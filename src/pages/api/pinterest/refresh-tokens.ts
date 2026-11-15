import type { APIRoute } from 'astro';
import { refreshAndPersistTokens, verifyCronSecret } from '../../../lib/pinterest/pinterestClient';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Red de seguridad mensual: fuerza un refresh y persiste el nuevo refresh_token. */
export const GET: APIRoute = async ({ request }) => {
  if (!verifyCronSecret(request)) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  try {
    const stored = await refreshAndPersistTokens();
    return json({
      ok: true,
      message: 'Tokens refrescados y guardados en Supabase',
      accessExpiresAt: stored.accessExpiresAt.toISOString(),
      refreshExpiresAt: stored.refreshExpiresAt?.toISOString() ?? null,
      scope: stored.scope,
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Refresh falló',
        hint: 'Si el refresh token caducó, repite OAuth y POST /api/pinterest/seed-tokens',
      },
      500,
    );
  }
};

export const POST: APIRoute = GET;
