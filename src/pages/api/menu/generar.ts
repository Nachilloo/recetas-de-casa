import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';
import OpenAI from 'openai';

interface RecetaRow {
  slug: string;
  title: string;
  categoria: string;
  dificultad: string;
  tiempo: string;
  porciones: number;
  ingredientes: string[];
  imagen: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const {
      tipo = 'ambos',       // 'comida' | 'cena' | 'ambos'
      personas = 4,
      dificultadMax = 'dificil',
      tiempoMax = '',
      excluirCategorias = [] as string[],
      aprovechamiento = false,
      temporada = false,
    } = body;

    const openaiKey = import.meta.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY no configurada' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Cargar TODAS las recetas de Supabase paginando (superar límite de 1000)
    const PAGE = 1000;
    let recetas: RecetaRow[] = [];
    let offset = 0;

    const dificultadFiltro = {
      'facil': ['facil'],
      'media': ['facil', 'media'],
      'dificil': ['facil', 'media', 'dificil'],
    };
    const dificultades = dificultadFiltro[dificultadMax as keyof typeof dificultadFiltro] || ['facil', 'media', 'dificil'];

    while (true) {
      let query = supabase
        .from('recetas')
        .select('slug, title, categoria, dificultad, tiempo, porciones, ingredientes, imagen')
        .in('dificultad', dificultades);

      if (excluirCategorias.length > 0) {
        for (const cat of excluirCategorias) {
          query = query.neq('categoria', cat);
        }
      }

      const { data, error: fetchError } = await query.range(offset, offset + PAGE - 1);
      if (fetchError) {
        return new Response(JSON.stringify({ error: 'No se pudieron cargar las recetas' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (!data || data.length === 0) break;
      recetas = recetas.concat(data as RecetaRow[]);
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    if (recetas.length === 0) {
      return new Response(JSON.stringify({ error: 'No se encontraron recetas' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Preparar lista compacta de recetas para el prompt
    const listaRecetas = recetas.map(r =>
      `- "${r.title}" [${r.categoria}] [${r.dificultad}] [${r.tiempo}] [slug:${r.slug}] [ingredientes: ${r.ingredientes.slice(0, 5).join(', ')}]`
    ).join('\n');

    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    let comidasPorDia = '';
    if (tipo === 'comida') {
      comidasPorDia = 'Solo COMIDA (almuerzo/mediodía) para cada día.';
    } else if (tipo === 'cena') {
      comidasPorDia = 'Solo CENA para cada día.';
    } else {
      comidasPorDia = 'COMIDA y CENA para cada día (2 recetas por día).';
    }

    const aprovechamientoTexto = aprovechamiento
      ? `MENÚ DE APROVECHAMIENTO: Prioriza recetas que compartan ingredientes entre días. 
         Por ejemplo: si un día se usa pollo asado, al día siguiente sugiere croquetas de pollo.
         Si un día se usa caldo de pescado, al siguiente sugiere una sopa con ese caldo.
         Agrupa ingredientes comunes para minimizar desperdicio y compras.`
      : '';

    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const mesActual = meses[new Date().getMonth()];

    const temporadaTexto = temporada
      ? `PRODUCTOS DE TEMPORADA: Estamos en ${mesActual} en España. Prioriza recetas cuyos ingredientes principales estén de temporada en este mes.
         Favorece verduras, frutas, pescados y carnes que sean típicos de ${mesActual} en la península ibérica.
         En el resumen nutricional, menciona qué productos de temporada se han incluido.`
      : '';

    const prompt = `Eres un nutricionista español experto en dieta mediterránea.
Genera un menú semanal equilibrado y variado para ${personas} personas.

COMIDAS: ${comidasPorDia}

CRITERIOS NUTRICIONALES:
- Equilibrio de macronutrientes cada día
- Proteína en cada comida principal (carne, pescado, legumbres, huevos)
- Al menos 2 raciones de verdura al día
- Carbohidratos complejos preferiblemente al mediodía
- Cenas más ligeras que las comidas
- Alternar fuentes de proteína: pescado (2-3 veces/semana), carne (2-3), legumbres (2), huevos (1-2)

VARIEDAD:
- No repetir la misma categoría dos comidas seguidas
- No repetir proteína principal más de 2 veces por semana
- Variedad de técnicas de cocción (horno, plancha, guiso, crudo)
${tiempoMax ? `- Tiempo máximo por receta: ${tiempoMax}` : ''}

${aprovechamientoTexto}
${temporadaTexto}

Elige ÚNICAMENTE de esta lista de recetas disponibles:
${listaRecetas}

Devuelve SOLO un JSON válido (sin markdown) con esta estructura:
{
  "menu": [
    {
      "dia": "Lunes",
      ${tipo === 'ambos'
        ? '"comida": {"slug": "slug-receta", "razon": "breve justificación nutricional"},\n      "cena": {"slug": "slug-receta", "razon": "breve justificación nutricional"}'
        : tipo === 'comida'
          ? '"comida": {"slug": "slug-receta", "razon": "breve justificación nutricional"}'
          : '"cena": {"slug": "slug-receta", "razon": "breve justificación nutricional"}'
      }
    }
  ],
  "resumen_nutricional": "2-3 frases explicando el equilibrio general del menú",
  "consejo_semanal": "un consejo nutricional relevante"
  ${aprovechamiento ? ',"aprovechamiento": "explicación de cómo se aprovechan ingredientes entre días"' : ''}
}

IMPORTANTE: Usa EXACTAMENTE los slugs de la lista. Los días son: ${dias.join(', ')}.`;

    const openai = new OpenAI({ apiKey: openaiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Eres un nutricionista experto. Responde solo con JSON válido.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const menuData = JSON.parse(response.choices[0].message.content || '{}');

    // Enriquecer y validar el menú con los datos completos de cada receta
    const recetasMap = new Map<string, RecetaRow>(recetas.map(r => [r.slug, r]));
    const recetasPorCategoria = new Map<string, RecetaRow[]>();
    for (const r of recetas) {
      const list = recetasPorCategoria.get(r.categoria) || [];
      list.push(r);
      recetasPorCategoria.set(r.categoria, list);
    }

    const slugsUsados = new Set<string>();

    function enriquecerSlot(slot: { slug: string; razon: string }): Record<string, unknown> {
      let receta = recetasMap.get(slot.slug);

      // Si el slug no existe, buscar por coincidencia parcial
      if (!receta) {
        const slugBuscado = slot.slug.toLowerCase();
        for (const [slug, r] of recetasMap) {
          if (slug.includes(slugBuscado) || slugBuscado.includes(slug)) {
            receta = r;
            break;
          }
        }
      }

      // Si aún no se encontró, asignar una receta aleatoria no usada
      if (!receta) {
        const disponibles = recetas.filter(r => !slugsUsados.has(r.slug));
        if (disponibles.length > 0) {
          receta = disponibles[Math.floor(Math.random() * disponibles.length)];
        }
      }

      if (receta) {
        slugsUsados.add(receta.slug);
        return { ...slot, ...receta, slug: receta.slug } as Record<string, unknown>;
      }
      return slot as Record<string, unknown>;
    }

    for (const dia of menuData.menu) {
      if (dia.comida) {
        dia.comida = enriquecerSlot(dia.comida);
      }
      if (dia.cena) {
        dia.cena = enriquecerSlot(dia.cena);
      }
    }

    return new Response(JSON.stringify(menuData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generando menú:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Error desconocido'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
