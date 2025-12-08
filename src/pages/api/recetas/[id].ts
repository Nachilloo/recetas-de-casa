import type { APIRoute } from 'astro';
import { createServerSupabaseClient, supabaseAdmin } from '../../../lib/supabase';
import { z } from 'zod';

// Schema de validación para actualizar recetas (todos los campos opcionales excepto los críticos)
const recetaUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  categoria: z.string().optional(),
  dificultad: z.string().optional(),
  tiempo: z.string().optional(),
  porciones: z.number().min(1).optional(),
  imagen: z.string().optional(),
  imagen_alt: z.string().optional().nullable(),
  descripcion: z.string().optional().nullable(),
  historia: z.string().optional().nullable(),
  ingredientes: z.array(z.string()).optional(),
  pasos: z.array(z.string()).optional(),
  tips: z.array(z.string()).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  calorias: z.number().optional().nullable(),
  destacada: z.boolean().optional()
});

/**
 * PUT /api/recetas/[id] - Actualizar receta
 */
export const PUT: APIRoute = async ({ request, params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'ID de receta no proporcionado' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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
    const validatedData = recetaUpdateSchema.parse(body);

    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Configuración del servidor incorrecta' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Si se actualiza el slug, verificar que no exista
    if (validatedData.slug) {
      const { data: existingReceta } = await supabaseAdmin
        .from('recetas')
        .select('id')
        .eq('slug', validatedData.slug)
        .neq('id', id)
        .single();

      if (existingReceta) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Ya existe otra receta con ese slug' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Actualizar receta
    const { data, error } = await supabaseAdmin
      .from('recetas')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error al actualizar receta:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!data) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Receta no encontrada' 
      }), {
        status: 404,
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
    console.error('Error en PUT /api/recetas/[id]:', error);
    
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
 * DELETE /api/recetas/[id] - Eliminar receta
 */
export const DELETE: APIRoute = async ({ request, params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'ID de receta no proporcionado' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

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

    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Configuración del servidor incorrecta' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Eliminar receta
    const { error } = await supabaseAdmin
      .from('recetas')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error al eliminar receta:', error);
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
      message: 'Receta eliminada exitosamente' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error en DELETE /api/recetas/[id]:', error);
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
 * GET /api/recetas/[id] - Obtener una receta específica (opcional)
 */
export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'ID de receta no proporcionado' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { supabase } = await import('../../../lib/supabase');
    
    const { data, error } = await supabase
      .from('recetas')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message 
      }), {
        status: 404,
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

