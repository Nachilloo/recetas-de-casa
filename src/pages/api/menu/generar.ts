import type { APIRoute } from 'astro';
import OpenAI from 'openai';
import { supabase, createServerClient } from '../../../lib/supabase';
import { computePlanStatus, recordMenuUsage } from '../../../lib/plan';
import { getCategoriasList, recetaTieneCategoria } from '../../../lib/recetaCategorias';

export const prerender = false;

/** Alinear con `MENU_DIETAS_ALERGIAS_PROXIMA` en MenuSemanal.tsx (true allí ⇒ false aquí). */
const MENU_DIETAS_ALERGIAS_API_HABILITADAS = false;

interface RecetaRow {
  slug: string;
  title: string;
  categoria: string;
  categorias?: string[] | null;
  dificultad: string;
  tiempo: string;
  porciones: number;
  ingredientes: string[];
  imagen: string;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // ── AUTH ───────────────────────────────────────────────────────
    const client = await createServerClient(cookies);
    const { data: userData } = await client.auth.getUser();
    const user = userData.user;

    if (!user) {
      return json(
        {
          error: 'auth_required',
          message: 'Tienes que crear una cuenta gratis para generar tu menú semanal.',
          redirect: '/registro?next=/menu-semanal',
        },
        401
      );
    }

    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    const status = await computePlanStatus(cookies, profile, user.id);

    // ── PARSE BODY ─────────────────────────────────────────────────
    const body = await request.json();
    const {
      tipo = 'ambos',
      personas = 4,
      dificultadMax = 'dificil',
      tiempoMax = '',
      excluirCategorias = [] as string[],
      aprovechamiento = false,
      temporada = false,
      alergias: alergiasBody = [] as string[],
      dieta: dietaBody = '' as string,
    } = body;

    let alergias: string[] = Array.isArray(alergiasBody) ? alergiasBody : [];
    let dieta: string = typeof dietaBody === 'string' ? dietaBody : '';

    if (!MENU_DIETAS_ALERGIAS_API_HABILITADAS) {
      alergias = [];
      dieta = 'omnivora';
    }

    // ── PAYWALL ────────────────────────────────────────────────────
    // Opciones avanzadas y preferencias dietéticas: solo plan Pro
    const pideOpcionAvanzada = aprovechamiento || temporada;
    const pideDietaOAlergiasPro =
      (Array.isArray(alergias) && alergias.length > 0) ||
      (typeof dieta === 'string' && dieta && dieta !== 'omnivora');

    if (pideOpcionAvanzada && status.plan === 'free') {
      return json(
        {
          error: 'paywall_feature',
          feature: 'aprovechamiento_temporada',
          message:
            'Las opciones de aprovechamiento y productos de temporada están disponibles en el plan Pro.',
          upgrade: '/precios',
        },
        402
      );
    }

    if (pideDietaOAlergiasPro && status.plan === 'free') {
      return json(
        {
          error: 'paywall_feature',
          feature: 'dieta_alergias',
          message:
            'Elegir dieta (vegetariana, vegana, etc.) y marcar alergias está disponible en el plan Pro.',
          upgrade: '/precios',
        },
        402
      );
    }

    if (!status.canGenerateMenu) {
      return json(
        {
          error: 'paywall_quota',
          message:
            'Has usado tu generación gratuita. Puedes volver a generar el menú IA dentro de unas semanas o suscribirte al plan Pro para generaciones ilimitadas.',
          cooldownUntil: status.menuCooldownUntil,
          upgrade: '/precios',
        },
        402
      );
    }

    // ── CARGAR RECETAS ─────────────────────────────────────────────
    const openaiKey = import.meta.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return json({ error: 'OPENAI_API_KEY no configurada' }, 500);
    }

    const PAGE = 1000;
    let recetas: RecetaRow[] = [];
    let offset = 0;

    const dificultadFiltro = {
      facil: ['facil'],
      media: ['facil', 'media'],
      dificil: ['facil', 'media', 'dificil'],
    } as const;
    const dificultades =
      dificultadFiltro[dificultadMax as keyof typeof dificultadFiltro] || [
        'facil',
        'media',
        'dificil',
      ];

    while (true) {
      const query = supabase
        .from('recetas')
        .select('slug, title, categoria, categorias, dificultad, tiempo, porciones, ingredientes, imagen')
        .in('dificultad', dificultades);

      const { data, error: fetchError } = await query.range(offset, offset + PAGE - 1);
      if (fetchError) {
        return json({ error: 'No se pudieron cargar las recetas' }, 500);
      }
      if (!data || data.length === 0) break;
      recetas = recetas.concat(data as RecetaRow[]);
      if (data.length < PAGE) break;
      offset += PAGE;
    }

    if (excluirCategorias.length > 0) {
      recetas = recetas.filter(
        (r) => !excluirCategorias.some((ex: string) => recetaTieneCategoria(r, ex))
      );
    }

    if (recetas.length === 0) {
      return json({ error: 'No se encontraron recetas con esos filtros' }, 400);
    }

    // ── PROMPT ─────────────────────────────────────────────────────
    const listaRecetas = recetas
      .map(
        (r) =>
          `- "${r.title}" [${getCategoriasList(r).join('+')}] [${r.dificultad}] [${r.tiempo}] [slug:${r.slug}] [ingredientes: ${r.ingredientes.slice(0, 5).join(', ')}]`
      )
      .join('\n');

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

    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
    ];
    const mesActual = meses[new Date().getMonth()];

    const temporadaTexto = temporada
      ? `PRODUCTOS DE TEMPORADA: Estamos en ${mesActual} en España. Prioriza recetas cuyos ingredientes principales estén de temporada en este mes.
         Favorece verduras, frutas, pescados y carnes que sean típicos de ${mesActual} en la península ibérica.
         En el resumen nutricional, menciona qué productos de temporada se han incluido.`
      : '';

    const alergiasTexto =
      Array.isArray(alergias) && alergias.length > 0
        ? `ALERGIAS / EXCLUSIONES: NUNCA elijas recetas cuyos ingredientes contengan: ${alergias.join(', ')}. Si tienes dudas, descarta la receta.`
        : '';

    const dietaTexto =
      typeof dieta === 'string' && dieta && dieta !== 'omnivora'
        ? `DIETA: ${dieta}. Excluye estrictamente los ingredientes incompatibles.`
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
${alergiasTexto}
${dietaTexto}

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
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const menuData = JSON.parse(response.choices[0].message.content || '{}');

    // ── ENRIQUECER ─────────────────────────────────────────────────
    const recetasMap = new Map<string, RecetaRow>(recetas.map((r) => [r.slug, r]));
    const slugsUsados = new Set<string>();

    function enriquecerSlot(slot: { slug: string; razon: string }): Record<string, unknown> {
      let receta = recetasMap.get(slot.slug);
      if (!receta) {
        const slugBuscado = slot.slug.toLowerCase();
        for (const [s, r] of recetasMap) {
          if (s.includes(slugBuscado) || slugBuscado.includes(s)) {
            receta = r;
            break;
          }
        }
      }
      if (!receta) {
        const disponibles = recetas.filter((r) => !slugsUsados.has(r.slug));
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

    for (const dia of menuData.menu ?? []) {
      if (dia.comida) dia.comida = enriquecerSlot(dia.comida);
      if (dia.cena) dia.cena = enriquecerSlot(dia.cena);
    }

    // ── REGISTRAR USO (solo si era una generación con cuota) ───────
    try {
      await recordMenuUsage(user.id, status.plan);
    } catch (err) {
      console.error('[menu/generar] No se pudo registrar uso:', err);
    }

    return json({ ...menuData, plan: status.plan });
  } catch (error) {
    console.error('Error generando menú:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Error desconocido' },
      500
    );
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
