import type { APIRoute } from 'astro';
import { verifyCronSecret } from '../../../lib/pinterest/pinterestClient';
import {
  envTokensAsConservativeGrant,
  loadStoredPinterestTokens,
  persistGrant,
  pinterestTokenRowId,
  type PinterestTokenGrant,
} from '../../../lib/pinterest/pinterestTokens';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Siembra o sustituye tokens OAuth en Supabase.
 * POST con CRON_SECRET. Body opcional:
 * { access_token, refresh_token, expires_in, refresh_token_expires_in, refresh_token_expires_at, scope }
 * Si el body va vacío, usa PINTEREST_ACCESS_TOKEN / PINTEREST_REFRESH_TOKEN del env.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!verifyCronSecret(request)) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  let body: Partial<PinterestTokenGrant> = {};
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      body = (await request.json()) as Partial<PinterestTokenGrant>;
    } catch {
      return json({ ok: false, error: 'JSON inválido' }, 400);
    }
  }

  const fromEnv = envTokensAsConservativeGrant();
  const grant: PinterestTokenGrant | null =
    body.access_token && body.refresh_token
      ? {
          access_token: body.access_token,
          refresh_token: body.refresh_token,
          expires_in: body.expires_in,
          refresh_token_expires_in: body.refresh_token_expires_in,
          refresh_token_expires_at: body.refresh_token_expires_at,
          scope: body.scope,
        }
      : fromEnv;

  if (!grant) {
    return json(
      {
        ok: false,
        error:
          'Pasa access_token y refresh_token en el body, o configura PINTEREST_ACCESS_TOKEN y PINTEREST_REFRESH_TOKEN en el entorno',
      },
      400,
    );
  }

  try {
    const stored = await persistGrant(grant);
    return json({
      ok: true,
      message: 'Tokens guardados en Supabase. El cron los renovará solo.',
      id: pinterestTokenRowId(),
      accessExpiresAt: stored.accessExpiresAt.toISOString(),
      refreshExpiresAt: stored.refreshExpiresAt?.toISOString() ?? null,
      scope: stored.scope,
      accessPrefix: stored.accessToken.slice(0, 5),
      refreshPrefix: stored.refreshToken.slice(0, 5),
    });
  } catch (err) {
    return json(
      { ok: false, error: err instanceof Error ? err.message : 'Error al guardar tokens' },
      500,
    );
  }
};

export const GET: APIRoute = async ({ request }) => {
  if (!verifyCronSecret(request)) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  try {
    const stored = await loadStoredPinterestTokens();
    if (!stored) {
      return json({
        ok: false,
        id: pinterestTokenRowId(),
        stored: false,
        message: 'No hay fila en pinterest_oauth. POST /api/pinterest/seed-tokens con los tokens del OAuth.',
      });
    }
    return json({
      ok: true,
      id: pinterestTokenRowId(),
      stored: true,
      source: stored.source,
      accessExpiresAt: stored.accessExpiresAt.toISOString(),
      refreshExpiresAt: stored.refreshExpiresAt?.toISOString() ?? null,
      scope: stored.scope,
      accessPrefix: stored.accessToken.slice(0, 5),
      refreshPrefix: stored.refreshToken.slice(0, 5),
    });
  } catch (err) {
    return json(
      { ok: false, error: err instanceof Error ? err.message : 'Error al leer tokens' },
      500,
    );
  }
};
