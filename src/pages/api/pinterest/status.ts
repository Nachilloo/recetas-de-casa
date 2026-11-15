import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import {
  getPinterestEnv,
  getPinterestMode,
  verifyCronSecret,
  verifyPinterestTokens,
} from '../../../lib/pinterest/pinterestClient';
import { loadStoredPinterestTokens } from '../../../lib/pinterest/pinterestTokens';
import type { Database } from '../../../lib/types';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Diagnóstico: qué env vars faltan y estado de pin_history (sin exponer secretos). */
export const GET: APIRoute = async ({ request }) => {
  if (!verifyCronSecret(request)) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const env = getPinterestEnv();
  const has = (v: unknown) => String(v ?? '').trim().length > 0;
  const sandbox = getPinterestMode() === 'sandbox';

  let stored:
    | {
        exists: boolean;
        accessExpiresAt?: string;
        refreshExpiresAt?: string | null;
        scope?: string | null;
        error?: string;
      }
    | null = null;

  try {
    const row = await loadStoredPinterestTokens();
    stored = row
      ? {
          exists: true,
          accessExpiresAt: row.accessExpiresAt.toISOString(),
          refreshExpiresAt: row.refreshExpiresAt?.toISOString() ?? null,
          scope: row.scope,
        }
      : { exists: false };
  } catch (err) {
    stored = { exists: false, error: err instanceof Error ? err.message : 'Error leyendo pinterest_oauth' };
  }

  const envStatus = {
    CRON_SECRET: has(import.meta.env.CRON_SECRET),
    PINTEREST_USE_SANDBOX: sandbox,
    PINTEREST_ACCESS_TOKEN: !!env.accessToken,
    PINTEREST_REFRESH_TOKEN: !!env.refreshToken,
    PINTEREST_BOARD_ID: !!env.boardId,
    PINTEREST_APP_ID: !!env.appId,
    PINTEREST_APP_SECRET: !!env.appSecret,
    PUBLIC_SITE_URL: has(import.meta.env.PUBLIC_SITE_URL),
    SUPABASE_SERVICE_ROLE_KEY: has(import.meta.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  const requiredChecks: Record<string, boolean> = {
    CRON_SECRET: envStatus.CRON_SECRET,
    PINTEREST_BOARD_ID: envStatus.PINTEREST_BOARD_ID,
    PUBLIC_SITE_URL: envStatus.PUBLIC_SITE_URL,
    SUPABASE_SERVICE_ROLE_KEY: envStatus.SUPABASE_SERVICE_ROLE_KEY,
  };
  if (!sandbox) {
    requiredChecks.PINTEREST_APP_ID = envStatus.PINTEREST_APP_ID;
    requiredChecks.PINTEREST_APP_SECRET = envStatus.PINTEREST_APP_SECRET;
    if (!stored?.exists) {
      requiredChecks.PINTEREST_ACCESS_TOKEN = envStatus.PINTEREST_ACCESS_TOKEN;
      requiredChecks.PINTEREST_REFRESH_TOKEN = envStatus.PINTEREST_REFRESH_TOKEN;
    }
  } else if (!stored?.exists) {
    requiredChecks.PINTEREST_ACCESS_TOKEN = envStatus.PINTEREST_ACCESS_TOKEN;
  }

  const missing = Object.entries(requiredChecks)
    .filter(([, set]) => !set)
    .map(([key]) => key);

  let pinHistory: { exists: boolean; total?: number; lastPosted?: string | null; lastError?: string | null } = {
    exists: false,
  };

  if (supabaseAdmin) {
    const client = supabaseAdmin as import('@supabase/supabase-js').SupabaseClient<Database>;
    const { count, error } = await client
      .from('pin_history')
      .select('id', { count: 'exact', head: true });

    if (!error) {
      pinHistory.exists = true;
      pinHistory.total = count ?? 0;

      const { data: lastPosted } = await client
        .from('pin_history')
        .select('posted_at, receta_slug')
        .eq('status', 'posted')
        .order('posted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: lastFailed } = await client
        .from('pin_history')
        .select('posted_at, error_message, receta_slug')
        .eq('status', 'failed')
        .order('posted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      pinHistory.lastPosted = lastPosted
        ? `${(lastPosted as { posted_at: string; receta_slug: string }).posted_at} (${(lastPosted as { receta_slug: string }).receta_slug})`
        : null;
      pinHistory.lastError = lastFailed
        ? `${(lastFailed as { error_message: string | null }).error_message} [${(lastFailed as { receta_slug: string }).receta_slug}]`
        : null;
    } else {
      pinHistory = { exists: false, lastError: error.message };
    }
  }

  let pinterest: Awaited<ReturnType<typeof verifyPinterestTokens>> | null = null;
  if (missing.length === 0) {
    pinterest = await verifyPinterestTokens();
  }

  const ready =
    missing.length === 0 &&
    pinHistory.exists &&
    envStatus.SUPABASE_SERVICE_ROLE_KEY &&
    stored?.exists === true &&
    pinterest?.accessTokenWorks === true &&
    pinterest?.canWritePins === true &&
    pinterest?.refreshTokenPrefixOk === true;

  let message = 'Faltan variables o la tabla pin_history no existe';
  if (stored && stored.error) {
    message = stored.error;
  } else if (!stored?.exists && missing.length === 0) {
    message = 'No hay tokens en Supabase. POST /api/pinterest/seed-tokens tras el OAuth.';
  } else if (missing.length === 0 && sandbox) {
    message =
      'Modo Sandbox activo. Usa token Sandbox y board ID de api-sandbox.pinterest.com';
  } else if (missing.length === 0 && pinterest?.refreshTokenIssue && pinterest.accessTokenWorks) {
    message = pinterest.error ?? pinterest.refreshTokenIssue;
  } else if (missing.length === 0 && pinterest?.error) {
    message = pinterest.error;
  } else if (ready) {
    message = 'Tokens en Supabase OK. El cron los renovará solo.';
  } else if (missing.length === 0 && pinterest?.accessTokenWorks && !pinterest.canWritePins) {
    message = 'Token válido pero sin pins:write — repite OAuth con scope pins:write';
  }

  return json({
    ok: ready,
    message,
    mode: getPinterestMode(),
    env: envStatus,
    missing,
    stored,
    pinterest,
    pinHistory,
    endpoints: {
      image: '/api/pinterest-image?slug=SLUG',
      publish: '/api/pinterest/publish-daily',
      seed: '/api/pinterest/seed-tokens',
      refresh: '/api/pinterest/refresh-tokens',
    },
  });
};
