import { defineMiddleware } from 'astro:middleware';
import { createServerSupabaseClient } from './lib/supabase';

export const onRequest = defineMiddleware(async ({ request, redirect, url, cookies }, next) => {
  // Proteger todas las rutas /admin/* excepto /admin/login y /api/auth/*
  if (url.pathname.startsWith('/admin') && 
      url.pathname !== '/admin/login' && 
      !url.pathname.startsWith('/api/auth/')) {
    
    console.log('[Middleware] Verificando sesión para:', url.pathname);
    
    // Obtener tokens de las cookies
    const accessToken = cookies.get('sb-access-token')?.value;
    const refreshToken = cookies.get('sb-refresh-token')?.value;
    
    console.log('[Middleware] Tokens de cookies:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken
    });
    
    // Si no hay tokens, redirigir
    if (!accessToken || !refreshToken) {
      console.log('[Middleware] Sin tokens, redirigiendo a login');
      return redirect('/admin/login');
    }
    
    const supabase = createServerSupabaseClient(request);
    
    // Establecer la sesión con los tokens
    const { data: { session }, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    console.log('[Middleware] Estado de sesión después de setSession:', {
      hasSession: !!session,
      error: error?.message,
      user: session?.user?.email
    });

    // Si no hay sesión o hay error, redirigir al login
    if (!session || error) {
      console.log('[Middleware] Sin sesión válida, redirigiendo a login');
      return redirect('/admin/login');
    }
    
    console.log('[Middleware] Sesión válida, permitiendo acceso');
  }

  return next();
});

