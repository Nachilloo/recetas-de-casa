import { supabase } from './supabase';
import type { Receta } from './types';
import {
  esRecetaBarata,
  esRecetaConPollo,
  esRecetaExclusivamentePostre,
  pickRecetasParaLanding,
  tiempoAMinutos,
  esRecetaAirFryer,
  esRecetaAirFryerPorTexto,
  esPostreFacilEstricto,
  esPostreFacilAmpliado,
  esRecetaSaludableEstricta,
  esRecetaSaludableAmpliada,
  esComidaRapidaEstricta,
  esComidaRapidaAmpliada,
  esRecetaParaNinosEstricta,
  esRecetaParaNinosAmpliada,
  esRecetaAptaPoolLandingFaciles,
  esRecetaConPostre,
  pickRecetasLandingFaciles,
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

function criterioCenaRapidaEstricto(r: Receta): boolean {
  if (esRecetaExclusivamentePostre(r)) return false;
  const m = tiempoAMinutos(r.tiempo);
  return m != null && m <= 30;
}

function criterioCenaRapidaRelajado(r: Receta): boolean {
  if (esRecetaExclusivamentePostre(r)) return false;
  const m = tiempoAMinutos(r.tiempo);
  return m != null && m <= 45;
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

/** Un solo lote ordenado (destacadas primero); sin postres como cena. */
export async function fetchRecetasLandingCenasRapidas(): Promise<Receta[]> {
  const { data, error } = await supabase
    .from('recetas')
    .select(SEL_LISTADO_SLIM)
    .neq('categoria', 'postres')
    .order('destacada', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(400);

  if (error) {
    console.error('[fetchRecetasLandingCenasRapidas]', error);
    return [];
  }

  let pool = filtrarNoPostre((data ?? []) as Receta[]);
  let picked = pickRecetasParaLanding(
    pool,
    criterioCenaRapidaEstricto,
    criterioCenaRapidaRelajado,
    { min: 10, max: 24 }
  );

  if (picked.length < 10) {
    const { data: more, error: e2 } = await supabase
      .from('recetas')
      .select(SEL_LISTADO_SLIM)
      .neq('categoria', 'postres')
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .range(400, 899);

    if (!e2 && more?.length) {
      pool = dedupeRecetas([...pool, ...filtrarNoPostre(more as Receta[])]);
      picked = pickRecetasParaLanding(
        pool,
        criterioCenaRapidaEstricto,
        criterioCenaRapidaRelajado,
        { min: 10, max: 24 }
      );
    }
  }

  return picked;
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

export async function fetchRecetasLandingBaratas(): Promise<Receta[]> {
  const { data: facil = [], error } = await supabase
    .from('recetas')
    .select(SEL_LISTADO_CON_INGREDIENTES)
    .eq('dificultad', 'facil')
    .neq('categoria', 'postres')
    .order('destacada', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(120);

  if (error) console.error('[fetchRecetasLandingBaratas]', error);

  let pool = filtrarNoPostre((facil ?? []) as Receta[]);

  const barataRelajada = (r: Receta) =>
    !esRecetaExclusivamentePostre(r) &&
    r.dificultad === 'facil' &&
    (r.ingredientes?.length ?? 99) <= 12;

  let picked = pickRecetasParaLanding(pool, esRecetaBarata, barataRelajada, { min: 10, max: 24 });

  if (picked.length < 10) {
    const extra = await fetchTopRecetas(200, SEL_LISTADO_CON_INGREDIENTES, true);
    pool = dedupeRecetas([...pool, ...extra]);
    picked = pickRecetasParaLanding(pool, esRecetaBarata, barataRelajada, { min: 10, max: 24 });
  }

  return picked;
}

/** Freidora de aire: categoría + coincidencia por texto en título/descripción. */
export async function fetchRecetasLandingAirFryer(): Promise<Receta[]> {
  const { data, error } = await supabase
    .from('recetas')
    .select(SEL_LISTADO_SLIM)
    .or('categoria.eq.air-fryer,categorias.cs.{air-fryer}')
    .order('destacada', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(400);

  if (error) console.error('[fetchRecetasLandingAirFryer]', error);

  let pool = dedupeRecetas((data ?? []) as Receta[]);
  let picked = pickRecetasParaLanding(pool, esRecetaAirFryer, esRecetaAirFryerPorTexto, {
    min: 10,
    max: 24,
  });

  if (picked.length < 10) {
    const extra = await fetchTopRecetas(500, SEL_LISTADO_SLIM, false);
    pool = dedupeRecetas([...pool, ...extra]);
    picked = pickRecetasParaLanding(pool, esRecetaAirFryer, esRecetaAirFryerPorTexto, {
      min: 10,
      max: 24,
    });
  }

  return picked;
}

export async function fetchRecetasLandingPostresFaciles(): Promise<Receta[]> {
  const { data, error } = await supabase
    .from('recetas')
    .select(SEL_LISTADO_SLIM)
    .or('categoria.eq.postres,categorias.cs.{postres}')
    .order('destacada', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(400);

  if (error) console.error('[fetchRecetasLandingPostresFaciles]', error);

  const pool = dedupeRecetas((data ?? []) as Receta[]);
  return pickRecetasParaLanding(pool, esPostreFacilEstricto, esPostreFacilAmpliado, {
    min: 10,
    max: 24,
  });
}

export async function fetchRecetasLandingSaludables(): Promise<Receta[]> {
  const { data, error } = await supabase
    .from('recetas')
    .select(SEL_LISTADO_CON_INGREDIENTES)
    .order('destacada', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) console.error('[fetchRecetasLandingSaludables]', error);

  let pool = dedupeRecetas((data ?? []) as Receta[]);
  let picked = pickRecetasParaLanding(
    pool,
    esRecetaSaludableEstricta,
    esRecetaSaludableAmpliada,
    { min: 10, max: 24 }
  );

  if (picked.length < 10) {
    const { data: more, error: e2 } = await supabase
      .from('recetas')
      .select(SEL_LISTADO_CON_INGREDIENTES)
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .range(500, 999);

    if (!e2 && more?.length) {
      pool = dedupeRecetas([...pool, ...(more as Receta[])]);
      picked = pickRecetasParaLanding(
        pool,
        esRecetaSaludableEstricta,
        esRecetaSaludableAmpliada,
        { min: 10, max: 24 }
      );
    }
  }

  return picked;
}

/** Comidas rápidas en cualquier momento del día (incluye postres si el tiempo encaja). */
export async function fetchRecetasLandingComidasRapidas(): Promise<Receta[]> {
  const { data, error } = await supabase
    .from('recetas')
    .select(SEL_LISTADO_SLIM)
    .order('destacada', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) console.error('[fetchRecetasLandingComidasRapidas]', error);

  let pool = dedupeRecetas((data ?? []) as Receta[]);
  let picked = pickRecetasParaLanding(
    pool,
    esComidaRapidaEstricta,
    esComidaRapidaAmpliada,
    { min: 10, max: 24 }
  );

  if (picked.length < 10) {
    const { data: more, error: e2 } = await supabase
      .from('recetas')
      .select(SEL_LISTADO_SLIM)
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .range(500, 999);

    if (!e2 && more?.length) {
      pool = dedupeRecetas([...pool, ...(more as Receta[])]);
      picked = pickRecetasParaLanding(
        pool,
        esComidaRapidaEstricta,
        esComidaRapidaAmpliada,
        { min: 10, max: 24 }
      );
    }
  }

  return picked;
}

export async function fetchRecetasLandingNinos(): Promise<Receta[]> {
  const { data, error } = await supabase
    .from('recetas')
    .select(SEL_LISTADO_CON_INGREDIENTES)
    .order('destacada', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) console.error('[fetchRecetasLandingNinos]', error);

  let pool = dedupeRecetas((data ?? []) as Receta[]);
  let picked = pickRecetasParaLanding(
    pool,
    esRecetaParaNinosEstricta,
    esRecetaParaNinosAmpliada,
    { min: 10, max: 24 }
  );

  if (picked.length < 10) {
    const { data: more, error: e2 } = await supabase
      .from('recetas')
      .select(SEL_LISTADO_CON_INGREDIENTES)
      .order('destacada', { ascending: false })
      .order('created_at', { ascending: false })
      .range(500, 999);

    if (!e2 && more?.length) {
      pool = dedupeRecetas([...pool, ...(more as Receta[])]);
      picked = pickRecetasParaLanding(
        pool,
        esRecetaParaNinosEstricta,
        esRecetaParaNinosAmpliada,
        { min: 10, max: 24 }
      );
    }
  }

  return picked;
}
