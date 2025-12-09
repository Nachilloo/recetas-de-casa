import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { email, password } = body;

    console.log('[API] Intentando login para:', email);

    // Realizar el login
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('[API] Respuesta de Supabase:', { 
      hasSession: !!data.session, 
      error: error?.message 
    });

    if (error) {
      console.error('[API] Error de autenticación:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message 
        }), 
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!data.session) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No se pudo crear la sesión' 
        }), 
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Sesión creada exitosamente
    console.log('[API] Sesión creada exitosamente para:', data.user.email);

    // Crear las cookies manualmente
    const accessTokenCookie = `sb-access-token=${data.session.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`;
    const refreshTokenCookie = `sb-refresh-token=${data.session.refresh_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`;

    console.log('[API] Estableciendo cookies de sesión');

    // Devolver la sesión para que el cliente la guarde
    return new Response(
      JSON.stringify({ 
        success: true,
        session: data.session,
        user: data.user
      }), 
      {
        status: 200,
        headers: new Headers([
          ['Content-Type', 'application/json'],
          ['Set-Cookie', accessTokenCookie],
          ['Set-Cookie', refreshTokenCookie]
        ])
      }
    );
  } catch (err) {
    console.error('[API] Error inesperado:', err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Error al procesar la solicitud' 
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

