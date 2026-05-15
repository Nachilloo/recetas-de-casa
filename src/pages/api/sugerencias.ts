import type { APIRoute } from 'astro';
import { createServerClient, supabaseAdmin } from '../../lib/supabase';

export const prerender = false;

const TIPOS = new Set(['idea', 'receta', 'web', 'cuenta', 'otro']);

function redirect(request: Request, path: string) {
  return Response.redirect(new URL(path, request.url).toString(), 303);
}

function normEmail(v: string | undefined): string | null {
  const s = (v ?? '').trim();
  if (!s) return null;
  if (s.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

/**
 * POST formulario del buzón (/sugerencias).
 * Campos: tipo, mensaje, email (opcional), page_url (opcional), _gotcha (honeypot, debe ir vacío).
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!supabaseAdmin) {
    return redirect(request, '/sugerencias?error=config');
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect(request, '/sugerencias?error=formulario');
  }

  if (form.get('_gotcha')?.toString()) {
    return redirect(request, '/sugerencias?enviado=1');
  }

  const tipo = form.get('tipo')?.toString().trim() ?? '';
  const mensaje = form.get('mensaje')?.toString().trim() ?? '';
  const email = normEmail(form.get('email')?.toString());
  const pageUrl = form.get('page_url')?.toString().trim().slice(0, 2000) || null;

  if (!TIPOS.has(tipo)) {
    return redirect(request, '/sugerencias?error=tipo');
  }
  if (mensaje.length < 10 || mensaje.length > 8000) {
    return redirect(request, '/sugerencias?error=mensaje');
  }

  let userId: string | null = null;
  const client = await createServerClient(cookies);
  const { data: userData } = await client.auth.getUser();
  if (userData.user) userId = userData.user.id;

  const userAgent = request.headers.get('user-agent')?.slice(0, 512) ?? null;

  const { error } = await supabaseAdmin.from('sugerencias').insert({
    tipo,
    mensaje,
    email,
    user_id: userId,
    page_url: pageUrl,
    user_agent: userAgent,
  });

  if (error) {
    console.error('[api/sugerencias]', error);
    return redirect(request, '/sugerencias?error=servidor');
  }

  return redirect(request, '/sugerencias?enviado=1');
};
