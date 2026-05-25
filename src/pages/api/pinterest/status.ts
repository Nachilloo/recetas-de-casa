import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { getPinterestEnv, verifyCronSecret } from '../../../lib/pinterest/pinterestClient';
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
  const envStatus = {
    CRON_SECRET: !!import.meta.env.CRON_SECRET?.trim(),
    PINTEREST_ACCESS_TOKEN: !!env.accessToken,
    PINTEREST_REFRESH_TOKEN: !!env.refreshToken,
    PINTEREST_BOARD_ID: !!env.boardId,
    PINTEREST_APP_ID: !!env.appId,
    PINTEREST_APP_SECRET: !!env.appSecret,
    PUBLIC_SITE_URL: !!import.meta.env.PUBLIC_SITE_URL?.trim(),
    SUPABASE_SERVICE_ROLE_KEY: !!import.meta.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  };

  const missing = Object.entries(envStatus)
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

  const ready =
    missing.length === 0 &&
    pinHistory.exists &&
    envStatus.SUPABASE_SERVICE_ROLE_KEY;

  return json({
    ok: ready,
    message: ready
      ? 'Configuración completa. Puedes llamar a /api/pinterest/publish-daily'
      : 'Faltan variables o la tabla pin_history no existe',
    env: envStatus,
    missing,
    pinHistory,
    endpoints: {
      image: '/api/pinterest-image?slug=SLUG',
      publish: '/api/pinterest/publish-daily',
    },
  });
};
