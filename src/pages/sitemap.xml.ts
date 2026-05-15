import type { APIRoute } from 'astro';
import { supabase, supabaseAdmin } from '../lib/supabase';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const STATIC_PATHS = [
  '/',
  '/about/',
  '/buscar/',
  '/contacto/',
  '/menu-semanal/',
  '/privacidad/',
  '/recetas/',
  '/registro/',
  '/soporte/',
  '/sugerencias/',
  '/terminos/',
  '/recetas-faciles/',
  '/cenas-rapidas/',
  '/recetas-con-pollo/',
  '/recetas-baratas/',
  '/recetas-airfryer/',
  '/postres-faciles/',
  '/recetas-saludables/',
  '/comidas-rapidas/',
  '/recetas-para-ninos/',
  '/login/',
  '/precios/',
] as const;

export const GET: APIRoute = async () => {
  const site = import.meta.env.SITE;
  if (!site || typeof site !== 'string') {
    return new Response('SITE no está definido en astro.config', { status: 500 });
  }

  const base = site.replace(/\/$/, '');
  const client = supabaseAdmin ?? supabase;

  const recipeRows: { slug: string; updated_at: string }[] = [];
  let offset = 0;
  const PAGE_SIZE = 1000;

  while (true) {
    const { data, error } = await client
      .from('recetas')
      .select('slug, updated_at')
      .order('updated_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('[sitemap]', error);
      return new Response('Error al generar el sitemap', { status: 500 });
    }
    if (!data?.length) break;

    for (const row of data as { slug: string; updated_at: string }[]) {
      if (row.slug) {
        recipeRows.push({ slug: row.slug, updated_at: row.updated_at });
      }
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const urlEntries: string[] = [];

  for (const path of STATIC_PATHS) {
    const loc = path === '/' ? `${base}/` : `${base}${path}`;
    urlEntries.push(`<url><loc>${escapeXml(loc)}</loc></url>`);
  }

  for (const { slug, updated_at } of recipeRows) {
    const loc = `${base}/recetas/${encodeURIComponent(slug)}`;
    const lastmod = new Date(updated_at).toISOString().slice(0, 10);
    urlEntries.push(
      `<url><loc>${escapeXml(loc)}</loc><lastmod>${lastmod}</lastmod></url>`
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
};
