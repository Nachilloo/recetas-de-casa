import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { supabaseAdmin } from '../../lib/supabase';

/**
 * API Route para migrar recetas de Content Collections a Supabase
 * 
 * IMPORTANTE: Este endpoint debe ejecutarse UNA SOLA VEZ para migrar los datos
 * Considera agregar autenticación o eliminarlo después de la migración
 * 
 * Uso: POST /api/migrate con password en el body
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Simple protección con contraseña (cámbiala por algo más seguro)
    const body = await request.json();
    const MIGRATION_PASSWORD = import.meta.env.MIGRATION_PASSWORD || 'migrate-recetas-2025';
    
    if (body.password !== MIGRATION_PASSWORD) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Contraseña incorrecta' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!supabaseAdmin) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'SUPABASE_SERVICE_ROLE_KEY no está configurado' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener todas las recetas de Content Collections
    const recetasMarkdown = await getCollection('recetas');
    
    console.log(`📚 Encontradas ${recetasMarkdown.length} recetas para migrar`);

    // Transformar las recetas al formato de Supabase
    const recetasParaSupabase = recetasMarkdown.map((receta) => {
      // Generar slug desde el ID del archivo si no existe
      const slug = receta.data.slug || receta.id;
      
      return {
        title: receta.data.title,
        slug: slug,
        categoria: receta.data.categoria,
        dificultad: receta.data.dificultad,
        tiempo: receta.data.tiempo,
        porciones: receta.data.porciones,
        imagen: receta.data.imagen,
        imagen_alt: receta.data.imagenAlt || null,
        descripcion: receta.data.descripcion || null,
        historia: receta.data.historia || null,
        ingredientes: receta.data.ingredientes,
        pasos: receta.data.pasos,
        tips: receta.data.tips || null,
        tags: receta.data.tags || null,
        calorias: receta.data.calorias || null,
        destacada: receta.data.destacada || false,
        created_at: receta.data.fechaCreacion?.toISOString() || new Date().toISOString(),
        updated_at: receta.data.fechaActualizacion?.toISOString() || new Date().toISOString(),
      };
    });

    // Insertar en Supabase (upsert para evitar duplicados)
    const { data, error } = await supabaseAdmin
      .from('recetas')
      .upsert(recetasParaSupabase, { 
        onConflict: 'slug',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error('❌ Error al insertar en Supabase:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message,
        details: error 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ ${data?.length || 0} recetas migradas exitosamente`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Migración completada: ${data?.length || 0} recetas`,
      recetas: data
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Error en la migración:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Endpoint GET para verificar el estado
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({ 
    message: 'Endpoint de migración. Usa POST con { "password": "tu-password" } para migrar las recetas.',
    info: 'Este endpoint migrará las recetas de Content Collections a Supabase'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

