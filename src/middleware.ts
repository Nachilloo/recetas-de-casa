import { defineMiddleware } from 'astro:middleware';
import { getUserAndProfile } from './lib/supabase';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, locals, redirect } = context;

  // Inicialización: por defecto, visitante anónimo
  locals.user = null;
  locals.profile = null;

  // No tocar /api/auth/* (callback/login/signup hacen su propio manejo)
  // y rutas estáticas de admin login que se evalúan ellas mismas.
  const isAuthApi = url.pathname.startsWith('/api/auth/');

  if (!isAuthApi) {
    try {
      const { user, profile } = await getUserAndProfile(cookies);
      locals.user = user;
      locals.profile = profile;
    } catch (err) {
      console.error('[Middleware] Error resolviendo sesión:', err);
    }
  }

  // ── Gating admin ─────────────────────────────────────────────────
  // /admin/* solo para usuarios con email del dominio admin (whitelist simple por ahora).
  // Mantenemos el comportamiento original: cualquier usuario logueado puede entrar a /admin
  // (el repositorio no tiene roles definidos todavía; queda como TODO de seguridad reforzar
  // con una columna `is_admin` o lista de UIDs).
  if (
    url.pathname.startsWith('/admin') &&
    url.pathname !== '/admin/login' &&
    !url.pathname.startsWith('/api/auth/')
  ) {
    if (!locals.user) {
      return redirect('/admin/login');
    }
  }

  // ── Gating perfil privado ────────────────────────────────────────
  if (url.pathname.startsWith('/perfil') && !locals.user) {
    const nextParam = encodeURIComponent(url.pathname + url.search);
    return redirect(`/login?next=${nextParam}`);
  }

  return next();
});
