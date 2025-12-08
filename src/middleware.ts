import { defineMiddleware } from 'astro:middleware';
import { createServerSupabaseClient } from './lib/supabase';

export const onRequest = defineMiddleware(async ({ request, redirect, url }, next) => {
  // Proteger todas las rutas /admin/* excepto /admin/login
  if (url.pathname.startsWith('/admin') && url.pathname !== '/admin/login') {
    const supabase = createServerSupabaseClient(request);
    
    const { data: { session }, error } = await supabase.auth.getSession();

    // Si no hay sesión o hay error, redirigir al login
    if (!session || error) {
      return redirect('/admin/login');
    }
  }

  return next();
});

