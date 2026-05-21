import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import {
  assertPinterestConfig,
  createPinterestPin,
  PinterestConfigError,
  verifyCronSecret,
} from '../../../lib/pinterest/pinterestClient';
import { formatPinTitle } from '../../../lib/pinterest/pinCopy';
import {
  hasPostedPinToday,
  NoRecipeAvailableError,
  selectDailyRecipe,
} from '../../../lib/pinterest/selectDailyRecipe';
import { getSiteUrl, recipePageUrl } from '../../../lib/pinterest/siteUrl';
import type { Database, PinHistoryInsert } from '../../../lib/types';

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async (context) => {
  return handlePublishDaily(context);
};

export const POST: APIRoute = async (context) => {
  return handlePublishDaily(context);
};

async function handlePublishDaily({
  request,
}: {
  request: Request;
}): Promise<Response> {
  if (!verifyCronSecret(request)) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  if (!supabaseAdmin) {
    return json({ success: false, error: 'Server misconfigured (no supabaseAdmin)' }, 500);
  }

  const client = supabaseAdmin as import('@supabase/supabase-js').SupabaseClient<Database>;

  try {
    const alreadyPosted = await hasPostedPinToday(client);
    if (alreadyPosted) {
      return json({
        success: true,
        skipped: true,
        message: 'Ya se publicó un pin hoy',
      });
    }

    const receta = await selectDailyRecipe(client);
    const siteUrl = getSiteUrl(request);
    const { boardId, accessToken } = assertPinterestConfig();

    try {
      const pin = await createPinterestPin({
        receta,
        siteUrl,
        boardId,
        accessToken,
      });

      const pinTitle = formatPinTitle(receta);
      const pinUrl = recipePageUrl(siteUrl, receta.slug, true);

      const historyRow: PinHistoryInsert = {
        receta_slug: receta.slug,
        pinterest_pin_id: pin.id,
        board_id: boardId,
        pin_title: pinTitle,
        pin_url: pinUrl,
        status: 'posted',
      };

      const { error: insertError } = await client
        .from('pin_history')
        // @ts-expect-error — fila alineada con PinHistoryInsert; el cliente a veces infiere insert como never
        .insert([historyRow]);

      if (insertError) {
        console.error('[publish-daily] pin_history insert failed', insertError);
        return json({
          success: true,
          warning: 'Pin publicado pero no se guardó en pin_history',
          pin,
          receta: { slug: receta.slug, title: receta.title },
        });
      }

      return json({
        success: true,
        pin: {
          id: pin.id,
          title: pinTitle,
          url: pinUrl,
          image: `${siteUrl}/api/pinterest-image?slug=${encodeURIComponent(receta.slug)}`,
        },
        receta: { slug: receta.slug, title: receta.title },
      });
    } catch (pinErr) {
      const message = pinErr instanceof Error ? pinErr.message : 'Error al publicar pin';
      const failedRow: PinHistoryInsert = {
        receta_slug: receta.slug,
        status: 'failed',
        error_message: message,
      };
      await client
        .from('pin_history')
        // @ts-expect-error — fila alineada con PinHistoryInsert
        .insert([failedRow]);
      throw pinErr;
    }
  } catch (err) {
    if (err instanceof NoRecipeAvailableError) {
      return json({ success: false, error: err.message }, 404);
    }
    if (err instanceof PinterestConfigError) {
      return json({ success: false, error: err.message }, 500);
    }

    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[publish-daily]', err);
    return json({ success: false, error: message }, 500);
  }
}
