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
    } = body;

    const openaiKey = import.meta.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY no configurada' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Cargar recetas de Supabase (solo metadatos para el prompt)
    let query = supabase
      .from('recetas')
      .select('slug, title, categoria, dificultad, tiempo, porciones, ingredientes, imagen');

    if (excluirCategorias.length > 0) {
      for (const cat of excluirCategorias) {
        query = query.neq('categoria', cat);
      }
    }

    const dificultadFiltro = {
      'facil': ['facil'],
      'media': ['facil', 'media'],
      'dificil': ['facil', 'media', 'dificil'],
    };
    query = query.in('dificultad', dificultadFiltro[dificultadMax as keyof typeof dificultadFiltro] || ['facil', 'media', 'dificil']);

    const { data, error } = await query;
    const recetas = data as RecetaRow[] | null;

    if (error || !recetas || recetas.length === 0) {
      return new Response(JSON.stringify({ error: 'No se pudieron cargar las recetas' }), {
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

    // Enriquecer el menú con los datos completos de cada receta
    const slugsUsados = new Set<string>();
    for (const dia of menuData.menu) {
      if (dia.comida) slugsUsados.add(dia.comida.slug);
      if (dia.cena) slugsUsados.add(dia.cena.slug);
    }

    const recetasMap = new Map<string, RecetaRow>(recetas.map(r => [r.slug, r]));

    for (const dia of menuData.menu) {
      if (dia.comida) {
        const receta = recetasMap.get(dia.comida.slug);
        if (receta) {
          dia.comida = { ...dia.comida, ...receta } as Record<string, unknown>;
        }
      }
      if (dia.cena) {
        const receta = recetasMap.get(dia.cena.slug);
        if (receta) {
          dia.cena = { ...dia.cena, ...receta } as Record<string, unknown>;
        }
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
