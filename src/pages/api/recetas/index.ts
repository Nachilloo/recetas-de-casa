import type { APIRoute } from 'astro';
import { createServerSupabaseClient, supabaseAdmin } from '../../../lib/supabase';
import { z } from 'zod';

// Schema de validación para recetas
const recetaSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio'),
  slug: z.string().min(1, 'El slug es obligatorio'),
  categoria: z.string(),
  dificultad: z.string(),
  tiempo: z.string().min(1, 'El tiempo es obligatorio'),
  porciones: z.number().min(1, 'Debe haber al menos 1 porción'),
  imagen: z.string().min(1, 'La imagen es obligatoria'),
  imagen_alt: z.string().optional().nullable(),
  descripcion: z.string().optional().nullable(),
  historia: z.string().optional().nullable(),
  ingredientes: z.array(z.string()).min(1, 'Debe haber al menos un ingrediente'),
  pasos: z.array(z.string()).min(1, 'Debe haber al menos un paso'),
  tips: z.array(z.string()).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  calorias: z.number().optional().nullable(),
  destacada: z.boolean().default(false)
});

/**
 * POST /api/recetas - Crear nueva receta
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Verificar autenticación
    const supabase = createServerSupabaseClient(request);
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (!session || authError) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No autorizado' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener y validar datos
    const body = await request.json();
    const validatedData = recetaSchema.parse(body);

    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Configuración del servidor incorrecta' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar si el slug ya existe
    const { data: existingReceta } = await supabaseAdmin
      .from('recetas')
      .select('id')
      .eq('slug', validatedData.slug)
      .single();

    if (existingReceta) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Ya existe una receta con ese slug' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Insertar receta
    const { data, error } = await supabaseAdmin
      .from('recetas')
      .insert([validatedData])
      .select()
      .single();

    if (error) {
      console.error('Error al crear receta:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error en POST /api/recetas:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Datos inválidos',
        details: error.errors
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

/**
 * GET /api/recetas - Obtener todas las recetas (opcional)
 */
export const GET: APIRoute = async () => {
  try {
    const { supabase } = await import('../../../lib/supabase');
    
    const { data, error } = await supabase
      .from('recetas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

