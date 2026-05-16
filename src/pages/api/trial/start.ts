import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * El periodo de prueba gratuita ya no está disponible.
 * Se mantiene la ruta para enlaces guardados sin romperlos.
 */
function respond() {
  return new Response(
    JSON.stringify({
      success: false,
      error:
        'La prueba gratuita ya no está disponible. Para funciones Pro, suscríbete desde Precios o tu área Plan.',
    }),
    {
      status: 410,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export const POST: APIRoute = () => respond();
export const GET: APIRoute = () => respond();
