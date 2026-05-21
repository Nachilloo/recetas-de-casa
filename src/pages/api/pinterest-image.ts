import type { APIRoute } from 'astro';
import { ImageResponse } from '@vercel/og';
import { supabase } from '../../lib/supabase';
import { pinImageOptions, PinterestPinTemplate } from '../../lib/pinterest/pinTemplate';
import { getSiteUrl } from '../../lib/pinterest/siteUrl';
import type { Receta } from '../../lib/types';

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const slug = url.searchParams.get('slug')?.trim();
  if (!slug) {
    return new Response('Missing slug parameter', { status: 400 });
  }

  const { data, error } = await supabase
    .from('recetas')
    .select('title, imagen, categoria, categorias, tiempo, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('[pinterest-image]', error);
    return new Response('Error fetching recipe', { status: 500 });
  }

  if (!data) {
    return new Response('Recipe not found', { status: 404 });
  }

  const receta = data as Pick<Receta, 'title' | 'imagen' | 'categoria' | 'categorias' | 'tiempo' | 'slug'>;
  const siteUrl = getSiteUrl(request);

  try {
    const imageResponse = new ImageResponse(
      PinterestPinTemplate({ receta, siteUrl }),
      pinImageOptions,
    );

    const pngBuffer = await imageResponse.arrayBuffer();

    return new Response(pngBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('[pinterest-image] render failed', err);
    return new Response('Failed to render pin image', { status: 500 });
  }
};
