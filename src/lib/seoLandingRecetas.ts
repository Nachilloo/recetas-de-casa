import type { Receta } from './types';
import { getCategoriasList, recetaTieneCategoria } from './recetaCategorias';

/** Convierte `tiempo` humano (~«30 min», «1 hora 30 min») a minutos; null si no se parsea. */
export function tiempoAMinutos(tiempo: string | null | undefined): number | null {
  if (!tiempo || typeof tiempo !== 'string') return null;
  const t = tiempo.toLowerCase();
  let total = 0;
  const hora = t.match(/(\d+)\s*h(?:ora)?s?/);
  const min = t.match(/(\d+)\s*m(?:in(?:uto)?s?)?/);
  if (hora) total += parseInt(hora[1], 10) * 60;
  if (min) total += parseInt(min[1], 10);
  if (!hora && min) return total;
  if (hora && !min) return total || parseInt(hora[1], 10) * 60;
  return total || null;
}

/** Solo dulces/postres (p. ej. categoría principal postres, quizá con air-fryer). No apto para “cena” o “barato” salvo. */
export function esRecetaExclusivamentePostre(r: Pick<Receta, 'categoria' | 'categorias'>): boolean {
  const list = getCategoriasList(r);
  const food = list.filter((c) => c !== 'air-fryer');
  if (food.length === 0) return false;
  return food.every((c) => c === 'postres');
}

/** Cualquier receta etiquetada como postre (aunque tenga otra categoría secundaria). */
export function esRecetaConPostre(r: Pick<Receta, 'categoria' | 'categorias'>): boolean {
  return recetaTieneCategoria(r, 'postres');
}

/** Indica que el título describe un plato completo, no solo un acompañamiento / salsa. */
const PLATOS_EN_TITULO = [
  'pollo',
  'pechuga',
  'muslo',
  'alita',
  'pavo',
  'ternera',
  'cerdo',
  'cordero',
  'conejo',
  'carne',
  'chuleta',
  'costilla',
  'albóndiga',
  'albondiga',
  'hamburguesa',
  'filete',
  'bistec',
  'merluza',
  'lubina',
  'dorada',
  'bacalao',
  'salmón',
  'salmon',
  'atún',
  'atun',
  'bonito',
  'caballa',
  'rape',
  'pulpo',
  'calamar',
  'chipiron',
  'chicharro',
  'mejillon',
  'gamba',
  'langostino',
  'pasta',
  'espaguet',
  'macarr',
  'fideo',
  'arroz',
  'paella',
  'tortilla',
  'lasaña',
  'lasana',
  'patata',
  'huevos',
  'huevo',
  'ensalada',
  'crepe',
  'empanadilla',
  'sandwich',
  'bocadillo',
  'guiso',
  'estofado',
  'potaje',
  'lenteja',
  'garbanzo',
  'croqueta',
  'brocoli',
  'brócoli',
  'coliflor',
  'verdura',
];

function tituloTienePlatoPrincipal(t: string): boolean {
  return PLATOS_EN_TITULO.some((p) => t.includes(p));
}

/**
 * Receta centrada en una salsa o en «X en salsa», no un plato fácil general.
 * Usa título, slug y tags (p. ej. tag «salsa» sin proteína en el nombre).
 */
export function esRecetaPrincipalmenteSalsa(
  r: Pick<Receta, 'title' | 'slug' | 'tags'>
): boolean {
  const t = (r.title ?? '').toLowerCase().trim();
  const slug = (r.slug ?? '').toLowerCase();

  if (/^salsa[\s-]/.test(t) || slug.startsWith('salsa-')) return true;

  if (/^(mojo|romesco|salmorejo|alioli|ali-oli)\b/.test(t)) return true;

  const enSalsa = t.match(/^(.+?)\s+en\s+salsa\b/);
  if (enSalsa) {
    const antes = enSalsa[1].trim();
    const palabras = antes.split(/\s+/).filter(Boolean);
    if (!tituloTienePlatoPrincipal(t) && palabras.length <= 4) return true;
  }

  if (/\bsalsa\s+de\s+/.test(t) && !tituloTienePlatoPrincipal(t)) return true;

  if (/\b(salsa bechamel|a la bechamel|salsa velouté|salsa veloute)\b/.test(t)) {
    return !tituloTienePlatoPrincipal(t);
  }

  const tags = (r.tags ?? []).map((x) => x.toLowerCase());
  if (tags.includes('salsa') && !tituloTienePlatoPrincipal(t)) return true;

  return false;
}

/**
 * Platos canarios / aperitivos muy concretos que no encajan en «recetas fáciles» genéricas.
 * Incluye duplicados en BD (-2, -3…).
 */
export const SLUGS_EXCLUIDOS_LANDING_FACILES = new Set([
  'papas-arrugadas',
  'papas-arrugadas-2',
  'papas-arrugadas-3',
  'gofio-amasado',
  'gofio-amasado-2',
  'almogrote',
  'almogrote-gomero',
  'sancocho-canario',
  'pella-de-gofio',
  'pella-de-gofio-2',
  'perico-relleno-para-arepa',
  'majado-para-bistec-o-pescado-empanado',
  'leche-con-gofio',
  'caldo-de-relinchones',
  'tortitas',
]);

export function esRecetaExcluidaLandingFaciles(
  r: Pick<Receta, 'slug' | 'title'>
): boolean {
  const slug = (r.slug ?? '').toLowerCase();
  if (SLUGS_EXCLUIDOS_LANDING_FACILES.has(slug)) return true;

  const t = (r.title ?? '').toLowerCase().trim();
  if (/^papas arrugadas/.test(t)) return true;
  if (/^gofio amasado/.test(t)) return true;
  if (/^almogrote/.test(t)) return true;
  if (t === 'sancocho canario') return true;
  if (/^pella de gofio/.test(t)) return true;
  if (/^perico(\s|$|\()/i.test(t)) return true;
  if (/^majado para bistec/.test(t)) return true;
  if (/^leche con gofio/.test(t)) return true;
  if (/^caldo de relinchones/.test(t)) return true;
  if (t === 'tortitas') return true;

  return false;
}

/** Platos fáciles del día a día: no postres, salsas ni lista de exclusión. */
export function esRecetaFacilEstricta(r: Receta): boolean {
  if (
    esRecetaConPostre(r) ||
    esRecetaPrincipalmenteSalsa(r) ||
    esRecetaExcluidaLandingFaciles(r)
  ) {
    return false;
  }
  return r.dificultad === 'facil';
}

/** Complemento: media con tiempo razonable, mismas exclusiones. */
export function esRecetaFacilAmpliada(r: Receta): boolean {
  if (
    esRecetaConPostre(r) ||
    esRecetaPrincipalmenteSalsa(r) ||
    esRecetaExcluidaLandingFaciles(r)
  ) {
    return false;
  }
  const m = tiempoAMinutos(r.tiempo);
  return r.dificultad === 'media' && m != null && m <= 45;
}

export function esRecetaAptaPoolLandingFaciles(r: Receta): boolean {
  return (
    !esRecetaConPostre(r) &&
    !esRecetaPrincipalmenteSalsa(r) &&
    !esRecetaExcluidaLandingFaciles(r)
  );
}

/** Muchas filas del volcado canario llevan estos tags; priorizar el resto del recetario. */
export function esRecetaMarcadaCanaria(
  r: Pick<Receta, 'tags' | 'imagen_alt' | 'title'>
): boolean {
  const tags = (r.tags ?? []).map((x) => x.toLowerCase());
  if (
    tags.includes('canarias') ||
    tags.includes('cocina-canaria') ||
    tags.includes('canaria')
  ) {
    return true;
  }
  const alt = (r.imagen_alt ?? '').toLowerCase();
  if (alt.includes('canaria')) return true;
  const t = (r.title ?? '').toLowerCase();
  if (/\b(gofio|mojo picón|mojo picon|papas arrugadas)\b/.test(t)) return true;
  return false;
}

function compararPorDestacada(a: Receta, b: Receta): number {
  return Number(b.destacada) - Number(a.destacada);
}

/** Resto del recetario primero; canarias al final del pool de candidatas. */
export function prepararPoolLandingFaciles(pool: Receta[]): Receta[] {
  const otras: Receta[] = [];
  const canarias: Receta[] = [];
  for (const r of pool) {
    if (esRecetaMarcadaCanaria(r)) canarias.push(r);
    else otras.push(r);
  }
  otras.sort(compararPorDestacada);
  canarias.sort(compararPorDestacada);
  return [...otras, ...canarias];
}

/**
 * Selección para «recetas fáciles»: rellena hasta 24 priorizando cocina general
 * y como máximo `maxCanarias` platos del bloque canario (p. ej. 4 de 24).
 */
export function pickRecetasLandingFaciles(
  pool: Receta[],
  opts: { min?: number; max?: number; maxCanarias?: number } = {}
): Receta[] {
  const min = opts.min ?? 10;
  const max = opts.max ?? 24;
  const maxCanarias = opts.maxCanarias ?? 4;
  const candidatas = prepararPoolLandingFaciles(pool.filter(esRecetaAptaPoolLandingFaciles));
  const otras = candidatas.filter((r) => !esRecetaMarcadaCanaria(r));
  const canarias = candidatas.filter((r) => esRecetaMarcadaCanaria(r));

  const seen = new Set<string>();
  let canariasEnLista = 0;
  const out: Receta[] = [];

  const push = (lista: Receta[]) => {
    for (const r of lista) {
      if (out.length >= max) return;
      if (seen.has(r.id)) continue;
      const esCan = esRecetaMarcadaCanaria(r);
      if (esCan && canariasEnLista >= maxCanarias) continue;
      seen.add(r.id);
      out.push(r);
      if (esCan) canariasEnLista++;
    }
  };

  push(otras.filter(esRecetaFacilEstricta));
  push(canarias.filter(esRecetaFacilEstricta));
  if (out.length < min) push(otras.filter(esRecetaFacilAmpliada));
  if (out.length < min) push(canarias.filter(esRecetaFacilAmpliada));
  if (out.length < min) push(otras);
  if (out.length < min) push(canarias);

  return out.slice(0, max);
}

function textoBusqueda(r: Receta): string {
  return [
    r.title ?? '',
    (r.descripcion ?? '').toLowerCase(),
    ...(r.tags ?? []),
    ...(r.ingredientes ?? []).map((i) => i.toLowerCase()),
  ]
    .join(' ')
    .toLowerCase();
}

export function esRecetaConPollo(r: Receta): boolean {
  const blob = textoBusqueda(r);
  return (
    /\bpollo\b/.test(blob) ||
    /\bpechuga\b/.test(blob) ||
    /\bmuslos?\b/.test(blob) ||
    /\bcontramuslo/.test(blob) ||
    /\balitas\b/.test(blob) ||
    /\bjamoncitos\b/.test(blob)
  );
}

export function esRecetaAirFryer(r: Receta): boolean {
  return recetaTieneCategoria(r, 'air-fryer');
}

/** Coincidencia por texto cuando la categoría no está mapeada pero la receta habla del método. */
export function esRecetaAirFryerPorTexto(r: Receta): boolean {
  const blob = textoBusqueda(r);
  return (
    blob.includes('air fryer') ||
    blob.includes('airfryer') ||
    blob.includes('freidora sin aceite') ||
    blob.includes('freidora de aire')
  );
}

export function esPostreFacilEstricto(r: Receta): boolean {
  return recetaTieneCategoria(r, 'postres') && r.dificultad === 'facil';
}

export function esPostreFacilAmpliado(r: Receta): boolean {
  if (!recetaTieneCategoria(r, 'postres')) return false;
  if (r.dificultad === 'media') return true;
  const m = tiempoAMinutos(r.tiempo);
  return m != null && m <= 50 && r.dificultad === 'facil';
}

export function esRecetaSaludableEstricta(r: Receta): boolean {
  const tags = (r.tags ?? []).join(' ').toLowerCase();
  const blob = textoBusqueda(r);
  const hits = [
    'salud',
    'vegan',
    'veget',
    'ligero',
    'light',
    'integral',
    'avena',
    'bajo en calor',
    'proteic',
    'ensalada',
    'flexitarian',
  ];
  if (hits.some((h) => tags.includes(h) || blob.includes(h))) return true;
  if (r.calorias != null && r.calorias > 0 && r.calorias <= 420) return true;
  return false;
}

export function esRecetaSaludableAmpliada(r: Receta): boolean {
  if (esRecetaExclusivamentePostre(r) && !esRecetaSaludableEstricta(r)) return false;
  const blob = textoBusqueda(r);
  const keys = [
    'verdura',
    'hortaliza',
    'lenteja',
    'garbanzo',
    'alubia',
    'pescado',
    'merluza',
    'bacalao',
    'atún',
    'atun',
    'tomate',
    'espinaca',
    'brócoli',
    'brocoli',
    'quinoa',
  ];
  return r.dificultad !== 'dificil' && keys.some((k) => blob.includes(k));
}

/** Cualquier comida o postre con tiempo corto (almuerzo, cena, merienda). */
export function esComidaRapidaEstricta(r: Receta): boolean {
  const m = tiempoAMinutos(r.tiempo);
  return m != null && m <= 30;
}

export function esComidaRapidaAmpliada(r: Receta): boolean {
  const m = tiempoAMinutos(r.tiempo);
  return m != null && m <= 45;
}

export function esRecetaParaNinosEstricta(r: Receta): boolean {
  const tags = (r.tags ?? []).join(' ').toLowerCase();
  const blob = textoBusqueda(r);
  if (/niños|ninos|niño|infantil|familia|peques|kids/.test(tags)) return true;
  if (/niños|ninos|niño|infantil|peques/.test(blob)) return true;
  return false;
}

export function esRecetaParaNinosAmpliada(r: Receta): boolean {
  if (r.dificultad === 'dificil') return false;
  const blob = textoBusqueda(r);
  const kidFoods = [
    'pasta',
    'espaguet',
    'macarron',
    'croqueta',
    'nuggets',
    'empanada',
    'merluza',
    'pollo',
    'patata',
    'puré',
    'pure ',
    'pure.',
    'tortilla',
    'pizza',
    'hamburguesa',
    'fingers',
    'spaghetti',
  ];
  return kidFoods.some((k) => blob.includes(k));
}

export function esRecetaBarata(r: Receta): boolean {
  if (esRecetaExclusivamentePostre(r)) return false;

  const tags = (r.tags ?? []).join(' ').toLowerCase();
  if (tags.includes('econom') || tags.includes('barat')) return true;

  const blob = (r.ingredientes ?? []).join(' ').toLowerCase();
  const titulo = (r.title ?? '').toLowerCase();
  const cheap = [
    'lenteja',
    'garbanzo',
    'patata',
    'arroz',
    'pasta',
    'fideo',
    'espaguet',
    'macarrón',
    'huevo',
    'tortilla',
    'sopa',
    'crema de',
    'puré',
    'pure de',
    'cuscus',
    'couscous',
    'caldo',
    'pan ',
    ' pan',
    'macarrones',
  ];
  if (cheap.some((k) => blob.includes(k) || titulo.includes(k))) return true;

  return r.dificultad === 'facil' && (r.ingredientes?.length ?? 99) <= 7;
}

/**
 * Estricto → ampliado → relleno por destacadas hasta `min` y capado en `max`.
 */
export function pickRecetasParaLanding(
  todas: Receta[],
  criterioEstricto: (r: Receta) => boolean,
  criterioAmpliado: (r: Receta) => boolean,
  opts: { min?: number; max?: number; apta?: (r: Receta) => boolean } = {}
): Receta[] {
  const min = opts.min ?? 10;
  const max = opts.max ?? 24;
  const apta = opts.apta ?? (() => true);
  const seen = new Set<string>();
  const out: Receta[] = [];

  const push = (lista: Receta[]) => {
    for (const r of lista) {
      if (out.length >= max) return;
      if (seen.has(r.id)) continue;
      if (!apta(r)) continue;
      seen.add(r.id);
      out.push(r);
    }
  };

  push(todas.filter(criterioEstricto));
  if (out.length < min) push(todas.filter(criterioAmpliado));
  if (out.length < min) {
    const resto = [...todas].sort((a, b) => Number(b.destacada) - Number(a.destacada));
    push(resto);
  }

  return out.slice(0, max);
}
