import { supabase } from './supabase';
import type { Receta } from './types';
import {
  esRecetaConPollo,
  pickRecetasLandingBaratas,
  esRecetaMarcadaEconomica,
  esRecetaExclusivamentePostre,
  pickRecetasParaLanding,
  tiempoAMinutos,
  pickRecetasLandingAirFryer,
  esRecetaAptaPoolLandingAirFryer,
  pickRecetasLandingPostresFaciles,
  esRecetaAptaPoolLandingPostresFaciles,
  esRecetaPostreParaLandingFaciles,
  pickRecetasLandingSaludables,
  esRecetaAptaPoolLandingSaludables,
  pickRecetasLandingNinos,
  esRecetaAptaPoolLandingNinos,
  esRecetaAptaPoolLandingFaciles,
  esRecetaConPostre,
  pickRecetasLandingFaciles,
  pickRecetasLandingCenasRapidas,
  pickRecetasLandingComidasRapidas,
  esRecetaAptaPoolCenasRapidas,
  esRecetaAptaPoolComidasRapidas,
  esRecetaAptaPoolLandingBaratas,
} from './seoLandingRecetas';

/** Menos columnas = menos datos por petición (cards + filtros que no usan ingredientes). */
const SEL_LISTADO_SLIM =
  'id,slug,title,descripcion,imagen,imagen_alt,tiempo,porciones,dificultad,tags,calorias,categoria,categorias,destacada,created_at';

const SEL_LISTADO_CON_INGREDIENTES = `${SEL_LISTADO_SLIM},ingredientes`;

function dedupeRecetas(rows: Receta[]): Receta[] {
  const seen = new Set<string>();
  const out: Receta[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

function filtrarNoPostre(pool: Receta[]): Receta[] {
  return pool.filter((r) => !esRecetaExclusivamentePostre(r));
}

/** Excluye cualquier receta con categoría postres (más estricto que solo «exclusivamente postre»). */
function filtrarSinPostre(pool: Receta[]): Receta[] {
  return pool.filter((r) => !esRecetaConPostre(r));
}

function filtrarPoolLandingFaciles(pool: Receta[]): Receta[] {
  return pool.filter(esRecetaAptaPoolLandingFaciles);
}

function filtrarPoolCenasRapidas(pool: Receta[]): Receta[] {
  return pool.filter(esRecetaAptaPoolCenasRapidas);
}

function filtrarPoolComidasRapidas(pool: Receta[]): Receta[] {
  return pool.filter(esRecetaAptaPoolComidasRapidas);
}

async function fetchTopRecetas(
  limit: number,
  columns: string = SEL_LISTADO_SLIM,
  excludePostresCategoria = false
): Promise<Receta[]> {
  let q = supabase
    .from('recetas')
    .select(columns)
    .order('destacada', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (excludePostresCategoria) {
    q = q.neq('categoria', 'postres');
  }

  const { data, error } = await q;

  if (error) {
    console.error('[fetchTopRecetas]', error);
    return [];
  }
  const rows = (data ?? []) as Receta[];
  return excludePostresCategoria ? rows.filter((r) => !esRecetaConPostre(r)) : rows;
}

/**
 * Landing «recetas fáciles»:
 * 1) Pool grande (fácil + media, sin postres).
 * 2) Quitar postres, salsas y lista negra manual.
 * 3) pickRecetasLandingFaciles: prioriza recetas SIN tag canarias; máx. 4 canarias en 24
 *    (el volcado canario domina destacadas/fecha si no se equilibra).
 */
export async function fetchRecetasLandingFaciles(): Promise<Receta[]> {
  const PICK_OPTS = { min: 10, max: 24, maxCanarias: 4 } as const;

  const { data, error } = await supabase
    .from('recetas')
    .select(SEL_LISTADO_SLIM)
    .in('dificultad', ['facil', 'media'])
    .neq('categoria', 'postres')
    .order('destacada', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(800);

  if (error) console.error('[fetchRecetasLandingFaciles]', error);

  let pool = filtrarPoolLandingFaciles(dedupeRecetas((data ?? []) as Receta[]));
  let picked = pickRecetasLandingFaciles(pool, PICK_OPTS);

  if (picked.length < PICK_OPTS.max) {
    const { data: more, error: e2 } = await supabase
      .from('recetas')
      .select(SEL_LISTADO_SLIM)
      .in('dificultad', ['facil', 'media'])
      .neq('categoria', 'postres')
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .range(800, 1599);

    if (!e2 && more?.length) {
      pool = filtrarPoolLandingFaciles(dedupeRecetas([...pool, ...(more as Receta[])]));
      picked = pickRecetasLandingFaciles(pool, PICK_OPTS);
    }
  }

  return picked.filter(esRecetaAptaPoolLandingFaciles);
}

/**
 * Landing «cenas rápidas»:
 * 1) Pool sin postres; filtrar salsas, desayunos, majado y lista negra.
 * 2) Priorizar ≤30 min; relleno hasta 45 min solo si faltan platos.
 * 3) Variedad: máx. 4 recetas canarias en 24.
 */
export async function fetchRecetasLandingCenasRapidas(): Promise<Receta[]> {
  const PICK_OPTS = { min: 10, max: 24, maxCanarias: 4 } as const;

  const { data, error } = await supabase
    .from('recetas')
    .select(SEL_LISTADO_SLIM)
    .neq('categoria', 'postres')
    .order('destacada', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(800);

  if (error) {
    console.error('[fetchRecetasLandingCenasRapidas]', error);
    return [];
  }

  let pool = filtrarPoolCenasRapidas(dedupeRecetas((data ?? []) as Receta[]));
  let picked = pickRecetasLandingCenasRapidas(pool, PICK_OPTS);

  if (picked.length < PICK_OPTS.max) {
    const { data: more, error: e2 } = await supabase
      .from('recetas')
      .select(SEL_LISTADO_SLIM)
      .neq('categoria', 'postres')
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .range(800, 1599);

    if (!e2 && more?.length) {
      pool = filtrarPoolCenasRapidas(dedupeRecetas([...pool, ...(more as Receta[])]));
      picked = pickRecetasLandingCenasRapidas(pool, PICK_OPTS);
    }
  }

  return picked.filter(esRecetaAptaPoolCenasRapidas);
}

function relaxPollo(r: Receta): boolean {
  const t = (r.title ?? '').toLowerCase();
  const ing = (r.ingredientes ?? []).join(' ').toLowerCase();
  return t.includes('ave') || ing.includes('ave');
}

/** Prioriza coincidencias en título/descripción vía Supabase; refina con filtro pollo. */
export async function fetchRecetasLandingPollo(): Promise<Receta[]> {
  const { data, error } = await supabase
    .from('recetas')
    .select(SEL_LISTADO_CON_INGREDIENTES)
    .or(
      'title.ilike.%pollo%,title.ilike.%Pechuga%,title.ilike.%pechuga%,title.ilike.%muslo%,descripcion.ilike.%pollo%'
    )
    .order('destacada', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(90);

  let pool: Receta[] = [];
  if (!error && data?.length) {
    pool = data as Receta[];
  }

  let picked = pickRecetasParaLanding(
    pool,
    esRecetaConPollo,
    relaxPollo,
    { min: 10, max: 24 }
  );

  if (picked.length < 10) {
    const extra = await fetchTopRecetas(200, SEL_LISTADO_CON_INGREDIENTES);
    pool = dedupeRecetas([...pool, ...extra]);
    picked = pickRecetasParaLanding(
      pool,
      esRecetaConPollo,
      relaxPollo,
      { min: 10, max: 24 }
    );
  }

  return picked;
}

/** Filtro Supabase: recetas con tag economica / economicas (u. o. en el array tags). */
const FILTRO_TAGS_ECONOMICA =
  'tags.ov.{economica},tags.ov.{economicas},tags.ov.{receta-economica},tags.ov.{recetas-economicas}';

/**
 * Landing «recetas baratas»:
 * 1) Pool con tag economica en BD (hasta 800).
 * 2) Excluye salsas, dulces y lista negra.
 * 3) Prioriza tag economica; máx. 4 canarias en 24.
 */
export async function fetchRecetasLandingBaratas(): Promise<Receta[]> {
  const PICK_OPTS = { min: 10, max: 24, maxCanarias: 4 } as const;

  const { data, error } = await supabase
    .from('recetas')
    .select(SEL_LISTADO_CON_INGREDIENTES)
    .neq('categoria', 'postres')
    .or(FILTRO_TAGS_ECONOMICA)
    .order('destacada', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(800);

  if (error) console.error('[fetchRecetasLandingBaratas]', error);

  let pool = dedupeRecetas((data ?? []) as Receta[])
    .filter(esRecetaAptaPoolLandingBaratas)
    .filter(esRecetaMarcadaEconomica);

  let picked = pickRecetasLandingBaratas(pool, PICK_OPTS);

  if (picked.length < PICK_OPTS.max) {
    const { data: more, error: e2 } = await supabase
      .from('recetas')
      .select(SEL_LISTADO_CON_INGREDIENTES)
      .neq('categoria', 'postres')
      .or(FILTRO_TAGS_ECONOMICA)
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .range(800, 1599);

    if (!e2 && more?.length) {
      pool = dedupeRecetas([...pool, ...(more as Receta[])])
        .filter(esRecetaAptaPoolLandingBaratas)
        .filter(esRecetaMarcadaEconomica);
      picked = pickRecetasLandingBaratas(pool, PICK_OPTS);
    }
  }

  return picked.filter(
    (r) => esRecetaAptaPoolLandingBaratas(r) && esRecetaMarcadaEconomica(r)
  );
}

/**
 * Air fryer: pool grande en categoría air-fryer; excluye postres/pan/desayuno;
 * prioriza platos de almuerzo y cena.
 */
export async function fetchRecetasLandingAirFryer(): Promise<Receta[]> {
  const PICK_OPTS = { min: 10, max: 24 } as const;

  const { data, error } = await supabase
    .from('recetas')
    .select(SEL_LISTADO_SLIM)
    .or('categoria.eq.air-fryer,categorias.cs.{air-fryer}')
    .order('destacada', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(800);

  if (error) console.error('[fetchRecetasLandingAirFryer]', error);

  let pool = dedupeRecetas((data ?? []) as Receta[]);
  let picked = pickRecetasLandingAirFryer(pool, PICK_OPTS);

  if (picked.length < PICK_OPTS.max) {
    const { data: more, error: e2 } = await supabase
      .from('recetas')
      .select(SEL_LISTADO_SLIM)
      .or('categoria.eq.air-fryer,categorias.cs.{air-fryer}')
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .range(800, 1599);

    if (!e2 && more?.length) {
      pool = dedupeRecetas([...pool, ...(more as Receta[])]);
      picked = pickRecetasLandingAirFryer(pool, PICK_OPTS);
    }
  }

  return picked.filter(esRecetaAptaPoolLandingAirFryer);
}

export async function fetchRecetasLandingPostresFaciles(): Promise<Receta[]> {
  const PICK_OPTS = { min: 10, max: 24, maxAirFryer: 12 } as const;

  const [postresRes, airFryerRes] = await Promise.all([
    supabase
      .from('recetas')
      .select(SEL_LISTADO_SLIM)
      .or('categoria.eq.postres,categorias.cs.{postres}')
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(400),
    supabase
      .from('recetas')
      .select(SEL_LISTADO_SLIM)
      .or('categoria.eq.air-fryer,categorias.cs.{air-fryer}')
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(400),
  ]);

  if (postresRes.error) console.error('[fetchRecetasLandingPostresFaciles]', postresRes.error);
  if (airFryerRes.error) console.error('[fetchRecetasLandingPostresFaciles air-fryer]', airFryerRes.error);

  const pool = dedupeRecetas([
    ...((postresRes.data ?? []) as Receta[]),
    ...((airFryerRes.data ?? []) as Receta[]),
  ])
    .filter(esRecetaAptaPoolLandingPostresFaciles)
    .filter(esRecetaPostreParaLandingFaciles);

  return pickRecetasLandingPostresFaciles(pool, PICK_OPTS).filter(
    esRecetaAptaPoolLandingPostresFaciles
  );
}

export async function fetchRecetasLandingSaludables(): Promise<Receta[]> {
  const PICK_OPTS = { min: 10, max: 24, minEnsaladas: 6, maxCanarias: 4 } as const;

  const [generalRes, ensaladasRes] = await Promise.all([
    supabase
      .from('recetas')
      .select(SEL_LISTADO_CON_INGREDIENTES)
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(600),
    supabase
      .from('recetas')
      .select(SEL_LISTADO_CON_INGREDIENTES)
      .or('categoria.eq.ensaladas-tapas,categorias.cs.{ensaladas-tapas}')
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  if (generalRes.error) console.error('[fetchRecetasLandingSaludables]', generalRes.error);
  if (ensaladasRes.error) console.error('[fetchRecetasLandingSaludables ensaladas]', ensaladasRes.error);

  let pool = dedupeRecetas([
    ...((generalRes.data ?? []) as Receta[]),
    ...((ensaladasRes.data ?? []) as Receta[]),
  ]).filter(esRecetaAptaPoolLandingSaludables);

  let picked = pickRecetasLandingSaludables(pool, PICK_OPTS);

  if (picked.length < PICK_OPTS.min) {
    const { data: more, error: e2 } = await supabase
      .from('recetas')
      .select(SEL_LISTADO_CON_INGREDIENTES)
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .range(600, 1199);

    if (!e2 && more?.length) {
      pool = dedupeRecetas([...pool, ...(more as Receta[])]).filter(esRecetaAptaPoolLandingSaludables);
      picked = pickRecetasLandingSaludables(pool, PICK_OPTS);
    }
  }

  return picked.filter(esRecetaAptaPoolLandingSaludables);
}

/**
 * Landing «comidas rápidas»:
 * Platos salados ≤30 min; sin postres, salsas, desayunos ni lista negra; máx. 4 canarias.
 */
export async function fetchRecetasLandingComidasRapidas(): Promise<Receta[]> {
  const PICK_OPTS = { min: 10, max: 24, maxCanarias: 4 } as const;

  const { data, error } = await supabase
    .from('recetas')
    .select(SEL_LISTADO_SLIM)
    .neq('categoria', 'postres')
    .order('destacada', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(800);

  if (error) console.error('[fetchRecetasLandingComidasRapidas]', error);

  let pool = filtrarPoolComidasRapidas(dedupeRecetas((data ?? []) as Receta[]));
  let picked = pickRecetasLandingComidasRapidas(pool, PICK_OPTS);

  if (picked.length < PICK_OPTS.max) {
    const { data: more, error: e2 } = await supabase
      .from('recetas')
      .select(SEL_LISTADO_SLIM)
      .neq('categoria', 'postres')
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .range(800, 1599);

    if (!e2 && more?.length) {
      pool = filtrarPoolComidasRapidas(dedupeRecetas([...pool, ...(more as Receta[])]));
      picked = pickRecetasLandingComidasRapidas(pool, PICK_OPTS);
    }
  }

  return picked.filter(esRecetaAptaPoolComidasRapidas);
}

/** Títulos habituales en comida infantil (pool dirigido, no solo destacadas). */
const FILTRO_TITULOS_NINOS =
  'title.ilike.%croqueta%,title.ilike.%macarron%,title.ilike.%espaguet%,title.ilike.%hamburguesa%,title.ilike.%nugget%,title.ilike.%pizza%,title.ilike.%tortilla de patata%,title.ilike.%rebozad%,title.ilike.%fingers%,title.ilike.%empanadill%';

export async function fetchRecetasLandingNinos(): Promise<Receta[]> {
  const PICK_OPTS = { min: 10, max: 24, maxCanarias: 4 } as const;

  const [dirigidoRes, generalRes] = await Promise.all([
    supabase
      .from('recetas')
      .select(SEL_LISTADO_CON_INGREDIENTES)
      .or(FILTRO_TITULOS_NINOS)
      .neq('categoria', 'postres')
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('recetas')
      .select(SEL_LISTADO_CON_INGREDIENTES)
      .in('dificultad', ['facil', 'media'])
      .neq('categoria', 'postres')
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(400),
  ]);

  if (dirigidoRes.error) console.error('[fetchRecetasLandingNinos]', dirigidoRes.error);
  if (generalRes.error) console.error('[fetchRecetasLandingNinos general]', generalRes.error);

  let pool = dedupeRecetas([
    ...((dirigidoRes.data ?? []) as Receta[]),
    ...((generalRes.data ?? []) as Receta[]),
  ]).filter(esRecetaAptaPoolLandingNinos);

  let picked = pickRecetasLandingNinos(pool, PICK_OPTS);

  if (picked.length < PICK_OPTS.min) {
    const { data: more, error: e2 } = await supabase
      .from('recetas')
      .select(SEL_LISTADO_CON_INGREDIENTES)
      .in('dificultad', ['facil', 'media'])
      .neq('categoria', 'postres')
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .range(400, 799);

    if (!e2 && more?.length) {
      pool = dedupeRecetas([...pool, ...(more as Receta[])]).filter(esRecetaAptaPoolLandingNinos);
      picked = pickRecetasLandingNinos(pool, PICK_OPTS);
    }
  }

  return picked.filter(esRecetaAptaPoolLandingNinos);
}
