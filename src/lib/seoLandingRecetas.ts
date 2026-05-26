import type { Receta } from './types';
import { getCategoriasList, recetaTieneCategoria } from './recetaCategorias';
import { esRecetaMarcadaEconomica } from './recetaEconomica';

export { esRecetaMarcadaEconomica };

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

const TAGS_DULCE_POSTRE_SNACK = new Set([
  'postre',
  'postres',
  'dulce',
  'dulces',
  'reposteria',
  'repostería',
  'reposteria-casera',
  'azucar',
  'azúcar',
  'snack',
  'tentempie',
  'tentempié',
  'merienda',
  'brunch',
  'desayuno',
]);

const PATRONES_TITULO_DULCE = [
  /^arroz con leche/,
  /^flan\b/,
  /^tarta\b/,
  /^bizcocho/,
  /^bizcochitos/,
  /^brownie/,
  /^cookies\b/,
  /^galletas\b/,
  /^muffin/,
  /^cupcake/,
  /^churros\b/,
  /^berlinesas\b/,
  /^profiterol/,
  /^crema catalana/,
  /^natillas\b/,
  /^mousse\b/,
  /^tiramisú/,
  /^tiramisu/,
  /^cheesecake/,
  /^torrijas\b/,
  /^rosquillas\b/,
  /^magdalenas\b/,
  /^palmeras\b/,
  /^almendras garrapiñadas/,
  /^gofio amasado/,
  /^pella de gofio/,
  /^dulce de leche/,
  /^dulce\b/,
  /^barritas\b/,
  /^bollería/,
  /^bolleria/,
  /^coulant/,
  /^soufflé/,
  /^souffle/,
  /^coulant de chocolate/,
];

/**
 * Postres, dulces y snacks aunque la categoría principal no sea «postres»
 * (muy habitual tras importaciones: ensaladas-tapas + tag postre).
 */
export function esRecetaDulcePostreOSnack(
  r: Pick<Receta, 'title' | 'tags' | 'descripcion' | 'categoria' | 'categorias'>
): boolean {
  if (esRecetaConPostre(r)) return true;

  const tags = (r.tags ?? []).map((x) => x.toLowerCase());
  if (tags.some((t) => TAGS_DULCE_POSTRE_SNACK.has(t))) return true;

  const t = (r.title ?? '').toLowerCase().trim();
  if (PATRONES_TITULO_DULCE.some((p) => p.test(t))) return true;

  const d = (r.descripcion ?? '').toLowerCase();
  if (
    (/\b(un |este |un delicioso )?postre\b/.test(d) ||
      /\b(un |este )?dulce\b/.test(d) ||
      /\b(snack|tentempié|tentempie)\b/.test(d)) &&
    !tituloTienePlatoPrincipal(t)
  ) {
    return true;
  }

  return false;
}

const TAGS_SNACK_APERITIVO = new Set([
  'aperitivo',
  'aperitivos',
  'acompañamiento',
  'acompanamiento',
]);

/**
 * Tentempiés y guarniciones (air-fryer, tapas) sin proteína/ plato principal en el título.
 * No aplica a bocadillos ni sándwiches.
 */
export function esRecetaSnackOAcompanamiento(
  r: Pick<Receta, 'title' | 'tags'>
): boolean {
  const t = (r.title ?? '').toLowerCase().trim();
  if (tituloTienePlatoPrincipal(t)) return false;
  if (/^(bocadillo|sándwich|sandwich)\b/.test(t)) return false;

  const tags = (r.tags ?? []).map((x) => x.toLowerCase());
  if (tags.some((tag) => TAGS_SNACK_APERITIVO.has(tag))) return true;

  if (/^aperitivos?\b/.test(t)) return true;
  if (/^pinchos de\b/.test(t)) return true;
  if (/^pan(es)? de mantequilla/.test(t)) return true;
  if (/\bpan(es)?\b/.test(t) && /\bpasas\b/.test(t)) return true;

  return false;
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
 * Platos que no encajan en landings genéricas (fáciles, cenas rápidas, etc.).
 * Incluye duplicados en BD (-2, -3…).
 */
export const SLUGS_EXCLUIDOS_LANDINGS = new Set([
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

/** @deprecated Usa `esRecetaExcluidaLandingManual` */
export const SLUGS_EXCLUIDOS_LANDING_FACILES = SLUGS_EXCLUIDOS_LANDINGS;

export function esRecetaExcluidaLandingManual(
  r: Pick<Receta, 'slug' | 'title'>
): boolean {
  const slug = (r.slug ?? '').toLowerCase();
  if (SLUGS_EXCLUIDOS_LANDINGS.has(slug)) return true;

  const t = (r.title ?? '').toLowerCase().trim();
  if (/^papas arrugadas/.test(t)) return true;
  if (/^gofio amasado/.test(t)) return true;
  if (/^almogrote/.test(t)) return true;
  if (t === 'sancocho canario') return true;
  if (/^pella de gofio/.test(t)) return true;
  if (/^perico(\s|$|\()/i.test(t)) return true;
  if (/^majado/.test(t)) return true;
  if (/^leche con gofio/.test(t)) return true;
  if (/^caldo de relinchones/.test(t)) return true;
  if (t === 'tortitas') return true;

  return false;
}

/** Postres que no encajan en «postres fáciles» (dulces canarios con gofio, etc.). */
export const SLUGS_EXCLUIDOS_LANDING_POSTRES = new Set([
  'platanos-amasados-con-gofio',
  'quesillo-canario',
  'flan-de-gofio-y-chocolate',
  'flan-de-gofio',
  'queque-de-gofio',
  'mousse-de-gofio',
  'pella-de-gofio',
  'pella-de-gofio-2',
]);

export function esRecetaExcluidaLandingPostres(
  r: Pick<Receta, 'slug' | 'title'>
): boolean {
  if (esRecetaExcluidaLandingManual(r)) return true;

  const slug = (r.slug ?? '').toLowerCase();
  if (SLUGS_EXCLUIDOS_LANDING_POSTRES.has(slug)) return true;

  const t = (r.title ?? '').toLowerCase().trim();
  if (/^pl[aá]tanos amasados/.test(t)) return true;
  if (/\bquesillo\b/.test(t) || slug.includes('quesillo')) return true;
  if (/flan de gofio/.test(t)) return true;
  if (/^queque de gofio/.test(t)) return true;
  if (/^mousse de gofio/.test(t)) return true;

  return false;
}

export function esRecetaAptaPoolLandingPostresFaciles(r: Receta): boolean {
  return !esRecetaExcluidaLandingPostres(r);
}

/** @deprecated Usa `esRecetaExcluidaLandingManual` */
export const esRecetaExcluidaLandingFaciles = esRecetaExcluidaLandingManual;

/** Desayuno u horario de tentempié (complementa esRecetaDulcePostreOSnack). */
export function esRecetaDesayunoOMerienda(
  r: Pick<Receta, 'title' | 'tags' | 'descripcion' | 'categoria' | 'categorias'>
): boolean {
  if (esRecetaDulcePostreOSnack(r)) return true;

  const t = (r.title ?? '').toLowerCase().trim();
  const titulosDesayuno = [/^tortitas\b/, /^bagel/, /^avena\b/, /^porridge\b/, /^granola\b/, /^panqueques\b/];
  if (titulosDesayuno.some((p) => p.test(t))) return true;

  const d = (r.descripcion ?? '').toLowerCase();
  if (
    /\b(ideal |perfect[ao] )?para (el )?desayuno\b/.test(d) &&
    !tituloTienePlatoPrincipal(t)
  ) {
    return true;
  }

  return false;
}

/** Platos fáciles del día a día: no postres, salsas ni lista de exclusión. */
export function esRecetaFacilEstricta(r: Receta): boolean {
  if (!esRecetaAptaPoolLandingFaciles(r)) return false;
  return r.dificultad === 'facil';
}

/** Complemento: media con tiempo razonable, mismas exclusiones. */
export function esRecetaFacilAmpliada(r: Receta): boolean {
  if (!esRecetaAptaPoolLandingFaciles(r)) return false;
  const m = tiempoAMinutos(r.tiempo);
  return r.dificultad === 'media' && m != null && m <= 45;
}

export function esRecetaAptaPoolLandingFaciles(r: Receta): boolean {
  return (
    !esRecetaDulcePostreOSnack(r) &&
    !esRecetaPrincipalmenteSalsa(r) &&
    !esRecetaExcluidaLandingManual(r)
  );
}

/** Pool «recetas baratas»: sin salsas, dulces ni lista negra (gofio, sancocho, etc.). */
export function esRecetaAptaPoolLandingBaratas(r: Receta): boolean {
  return (
    !esRecetaDulcePostreOSnack(r) &&
    !esRecetaPrincipalmenteSalsa(r) &&
    !esRecetaExcluidaLandingManual(r)
  );
}

const TAGS_PAN_BOLLERIA_DESAYUNO = new Set([
  'panes',
  'bolleria',
  'bollería',
  'masa',
  'levadura',
  'desayuno',
  'brunch',
  'reposteria',
  'repostería',
]);

const PATRONES_TITULO_PAN_BOLLERIA = [
  /^pan(es)?\b/,
  /^bollos?\b/,
  /^barritas?\b/,
  /^masa\b/,
  /^croissant/,
  /^bollo\b/,
  /^focaccia\b/,
  /^baguette\b/,
];

/** Pan, bollería o desayuno (muy frecuente en recetas air-fryer importadas). */
export function esRecetaPanBolleriaODesayuno(
  r: Pick<Receta, 'title' | 'tags' | 'descripcion' | 'categoria' | 'categorias'>
): boolean {
  if (esRecetaDesayunoOMerienda(r)) return true;

  const tags = (r.tags ?? []).map((x) => x.toLowerCase());
  if (tags.some((t) => TAGS_PAN_BOLLERIA_DESAYUNO.has(t))) return true;

  const t = (r.title ?? '').toLowerCase().trim();
  if (PATRONES_TITULO_PAN_BOLLERIA.some((p) => p.test(t))) return true;
  if (/\bpan(es)?\b/.test(t) && !tituloTienePlatoPrincipal(t)) return true;

  return false;
}

/** Pool para landings de comida/cena rápida: platos salados, no dulces ni tentempiés. */
export function esRecetaAptaPoolComidaRapidaSalada(r: Receta): boolean {
  return (
    !esRecetaDulcePostreOSnack(r) &&
    !esRecetaSnackOAcompanamiento(r) &&
    !esRecetaPrincipalmenteSalsa(r) &&
    !esRecetaDesayunoOMerienda(r) &&
    !esRecetaExcluidaLandingManual(r)
  );
}

export const esRecetaAptaPoolCenasRapidas = esRecetaAptaPoolComidaRapidaSalada;
export const esRecetaAptaPoolComidasRapidas = esRecetaAptaPoolComidaRapidaSalada;

/** Cena lista en ≤30 min (concepto estricto de la landing). */
export function esRecetaCenaRapidaEstricta(r: Receta): boolean {
  if (!esRecetaAptaPoolCenasRapidas(r)) return false;
  const m = tiempoAMinutos(r.tiempo);
  return m != null && m <= 30;
}

/** Solo para rellenar el listado si faltan platos: hasta 45 min. */
export function esRecetaCenaRapidaAmpliada(r: Receta): boolean {
  if (!esRecetaAptaPoolCenasRapidas(r)) return false;
  const m = tiempoAMinutos(r.tiempo);
  return m != null && m <= 45;
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
export function prepararPoolPriorizandoNoCanarias(pool: Receta[]): Receta[] {
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

/** @deprecated Usa `prepararPoolPriorizandoNoCanarias` */
export const prepararPoolLandingFaciles = prepararPoolPriorizandoNoCanarias;

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
  const candidatas = prepararPoolPriorizandoNoCanarias(pool.filter(esRecetaAptaPoolLandingFaciles));
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

  return out.slice(0, max);
}

/**
 * «Cenas rápidas»: ≤30 min, sin salsas/desayunos/majado; máx. 4 canarias en 24.
 */
export function pickRecetasLandingCenasRapidas(
  pool: Receta[],
  opts: { min?: number; max?: number; maxCanarias?: number } = {}
): Receta[] {
  const min = opts.min ?? 10;
  const max = opts.max ?? 24;
  const maxCanarias = opts.maxCanarias ?? 4;
  const candidatas = prepararPoolPriorizandoNoCanarias(pool.filter(esRecetaAptaPoolCenasRapidas));
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

  push(otras.filter(esRecetaCenaRapidaEstricta));
  push(canarias.filter(esRecetaCenaRapidaEstricta));
  if (out.length < min) push(otras.filter(esRecetaCenaRapidaAmpliada));
  if (out.length < min) push(canarias.filter(esRecetaCenaRapidaAmpliada));

  return out.slice(0, max);
}

/**
 * «Comidas rápidas»: mismos filtros que cenas rápidas; ≤30 min prioritario.
 */
export function pickRecetasLandingComidasRapidas(
  pool: Receta[],
  opts: { min?: number; max?: number; maxCanarias?: number } = {}
): Receta[] {
  const min = opts.min ?? 10;
  const max = opts.max ?? 24;
  const maxCanarias = opts.maxCanarias ?? 4;
  const candidatas = prepararPoolPriorizandoNoCanarias(pool.filter(esRecetaAptaPoolComidasRapidas));
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

  push(otras.filter(esComidaRapidaEstricta));
  push(canarias.filter(esComidaRapidaEstricta));
  if (out.length < min) push(otras.filter(esComidaRapidaAmpliada));
  if (out.length < min) push(canarias.filter(esComidaRapidaAmpliada));

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

export function esRecetaAirFryerCoincide(r: Receta): boolean {
  return esRecetaAirFryer(r) || esRecetaAirFryerPorTexto(r);
}

/** Pool air fryer: platos de comida, no postres/pan/desayuno ni tentempiés sueltos. */
export function esRecetaAptaPoolLandingAirFryer(r: Receta): boolean {
  return (
    !esRecetaExclusivamentePostre(r) &&
    !esRecetaDulcePostreOSnack(r) &&
    !esRecetaPanBolleriaODesayuno(r) &&
    !esRecetaSnackOAcompanamiento(r) &&
    !esRecetaPrincipalmenteSalsa(r) &&
    !esRecetaExcluidaLandingManual(r)
  );
}

/** Plato de almuerzo/cena (proteína, pasta con pescado, etc.), no solo guarnición. */
export function esRecetaAirFryerComidaPrincipal(r: Receta): boolean {
  const t = (r.title ?? '').toLowerCase().trim();
  if (tituloTienePlatoPrincipal(t)) return true;

  const tags = (r.tags ?? []).join(' ').toLowerCase();
  const keys = [
    'pollo',
    'carne',
    'pescado',
    'cerdo',
    'ternera',
    'salmon',
    'salmón',
    'merluza',
    'atun',
    'atún',
    'cena',
    'almuerzo',
    'comida',
    'plato principal',
    'hamburguesa',
    'empanadilla',
  ];
  return keys.some((k) => tags.includes(k));
}

/**
 * «Recetas air fryer»: prioriza platos principales; relleno solo con salados aptos.
 */
export function pickRecetasLandingAirFryer(
  pool: Receta[],
  opts: { min?: number; max?: number } = {}
): Receta[] {
  const min = opts.min ?? 10;
  const max = opts.max ?? 24;
  const candidatas = pool
    .filter(esRecetaAptaPoolLandingAirFryer)
    .filter(esRecetaAirFryerCoincide)
    .sort(compararPorDestacada);

  const principales = candidatas.filter(esRecetaAirFryerComidaPrincipal);
  const otras = candidatas.filter((r) => !esRecetaAirFryerComidaPrincipal(r));

  const seen = new Set<string>();
  const out: Receta[] = [];

  const push = (lista: Receta[]) => {
    for (const r of lista) {
      if (out.length >= max) return;
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
  };

  push(principales);
  if (out.length < min) push(otras);

  return out.slice(0, max);
}

/** Postre clásico o dulce hecho en freidora de aire (categoría secundaria o tags). */
export function esRecetaPostreAirFryer(r: Receta): boolean {
  if (!esRecetaAirFryerCoincide(r)) return false;
  if (!esRecetaAptaPoolLandingPostresFaciles(r)) return false;
  if (esRecetaAirFryerComidaPrincipal(r)) return false;

  if (recetaTieneCategoria(r, 'postres')) return true;

  const tags = (r.tags ?? []).map((x) => x.toLowerCase());
  if (tags.some((t) => ['postre', 'postres', 'dulce', 'dulces', 'reposteria', 'repostería'].includes(t))) {
    return true;
  }

  const t = (r.title ?? '').toLowerCase().trim();
  if (PATRONES_TITULO_DULCE.some((p) => p.test(t))) return true;

  if (!esRecetaPanBolleriaODesayuno(r) && !tituloTienePlatoPrincipal(t)) {
    if (tags.includes('freidora-aire') || tags.includes('air-fryer')) return true;
  }

  return false;
}

/** Cuenta como postre en la landing (categoría postres u air fryer dulce). */
export function esRecetaPostreParaLandingFaciles(r: Receta): boolean {
  if (!esRecetaAptaPoolLandingPostresFaciles(r)) return false;
  if (recetaTieneCategoria(r, 'postres')) return true;
  return esRecetaPostreAirFryer(r);
}

export function esPostreFacilEstricto(r: Receta): boolean {
  if (!esRecetaPostreParaLandingFaciles(r)) return false;
  return r.dificultad === 'facil';
}

export function esPostreFacilAmpliado(r: Receta): boolean {
  if (!esRecetaPostreParaLandingFaciles(r)) return false;
  if (r.dificultad === 'media') return true;
  const m = tiempoAMinutos(r.tiempo);
  return m != null && m <= 50 && r.dificultad === 'facil';
}

/**
 * «Postres fáciles»: postres clásicos + hasta la mitad del listado en air fryer (p. ej. 12 de 24).
 */
export function pickRecetasLandingPostresFaciles(
  pool: Receta[],
  opts: { min?: number; max?: number; maxAirFryer?: number } = {}
): Receta[] {
  const min = opts.min ?? 10;
  const max = opts.max ?? 24;
  const maxAirFryer = opts.maxAirFryer ?? Math.floor(max / 2);

  const aptas = pool.filter(esRecetaAptaPoolLandingPostresFaciles).sort(compararPorDestacada);
  const airFryer = aptas.filter((r) => esRecetaPostreAirFryer(r));
  const clasicas = aptas.filter((r) => !esRecetaPostreAirFryer(r));

  const seen = new Set<string>();
  let airEnLista = 0;
  const out: Receta[] = [];

  const push = (lista: Receta[]) => {
    for (const r of lista) {
      if (out.length >= max) return;
      if (seen.has(r.id)) continue;
      const esAir = esRecetaPostreAirFryer(r);
      if (esAir && airEnLista >= maxAirFryer) continue;
      seen.add(r.id);
      out.push(r);
      if (esAir) airEnLista++;
    }
  };

  // Reservar air fryer primero; si no, los clásicos llenan las 24 plazas y no queda hueco.
  push(airFryer.filter(esPostreFacilEstricto));
  push(airFryer.filter(esPostreFacilAmpliado));
  push(clasicas.filter(esPostreFacilEstricto));
  push(clasicas.filter(esPostreFacilAmpliado));

  if (out.length < min) {
    push([...airFryer, ...clasicas].sort(compararPorDestacada));
  }

  return out.slice(0, max);
}

/** Pool «recetas saludables»: sin salsas, mojo ni lista negra. */
export function esRecetaAptaPoolLandingSaludables(r: Receta): boolean {
  return (
    !esRecetaDulcePostreOSnack(r) &&
    !esRecetaPrincipalmenteSalsa(r) &&
    !esRecetaExcluidaLandingManual(r)
  );
}

/** Ensalada (título, tag o categoría tapas con nombre explícito). */
export function esRecetaEsEnsalada(r: Receta): boolean {
  const t = (r.title ?? '').toLowerCase();
  if (/\bensalada/.test(t)) return true;

  const tags = (r.tags ?? []).map((x) => x.toLowerCase());
  if (tags.includes('ensalada') || tags.includes('ensaladas')) return true;

  if (recetaTieneCategoria(r, 'ensaladas-tapas') && /\bensalada/.test(t)) return true;

  return false;
}

export function esRecetaSaludableEstricta(r: Receta): boolean {
  if (!esRecetaAptaPoolLandingSaludables(r)) return false;

  if (esRecetaEsEnsalada(r)) return true;

  const tags = (r.tags ?? []).map((x) => x.toLowerCase());
  const tagsStr = tags.join(' ');
  const blob = textoBusqueda(r);
  const hits = [
    'salud',
    'saludable',
    'vegan',
    'veget',
    'ligero',
    'light',
    'integral',
    'avena',
    'bajo en calor',
    'proteic',
    'flexitarian',
    'recetas-saludables',
  ];
  if (hits.some((h) => tagsStr.includes(h) || blob.includes(h))) return true;
  if (r.calorias != null && r.calorias > 0 && r.calorias <= 420) return true;
  return false;
}

export function esRecetaSaludableAmpliada(r: Receta): boolean {
  if (!esRecetaAptaPoolLandingSaludables(r)) return false;
  if (esRecetaSaludableEstricta(r)) return true;
  if (esRecetaExclusivamentePostre(r)) return false;

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
    'calabacin',
    'calabacín',
    'crema de verdura',
    'sopa de verdura',
  ];
  return r.dificultad !== 'dificil' && keys.some((k) => blob.includes(k));
}

/**
 * «Recetas saludables»: reserva ensaladas; sin relleno ciego que meta salsas/mojo.
 */
export function pickRecetasLandingSaludables(
  pool: Receta[],
  opts: { min?: number; max?: number; minEnsaladas?: number; maxCanarias?: number } = {}
): Receta[] {
  const min = opts.min ?? 10;
  const max = opts.max ?? 24;
  const minEnsaladas = opts.minEnsaladas ?? 6;
  const maxCanarias = opts.maxCanarias ?? 4;

  const candidatas = prepararPoolPriorizandoNoCanarias(
    pool.filter(esRecetaAptaPoolLandingSaludables)
  );
  const ensaladas = candidatas.filter((r) => esRecetaEsEnsalada(r));
  const otras = candidatas.filter((r) => !esRecetaEsEnsalada(r));

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

  push(ensaladas.filter(esRecetaSaludableEstricta));
  push(otras.filter(esRecetaSaludableEstricta));
  if (out.length < min) push(ensaladas.filter(esRecetaSaludableAmpliada));
  if (out.length < min) push(otras.filter(esRecetaSaludableAmpliada));

  const ensaladasEnLista = () => out.filter((r) => esRecetaEsEnsalada(r)).length;
  if (ensaladasEnLista() < minEnsaladas) {
    const faltan = minEnsaladas - ensaladasEnLista();
    const extra = [...ensaladas.filter(esRecetaSaludableEstricta), ...ensaladas.filter(esRecetaSaludableAmpliada), ...ensaladas].filter(
      (r) => !seen.has(r.id)
    );
    push(extra.slice(0, faltan));
  }

  return out.slice(0, max);
}

/** Comida rápida (almuerzo, etc.): ≤30 min, platos salados. */
export function esComidaRapidaEstricta(r: Receta): boolean {
  if (!esRecetaAptaPoolComidasRapidas(r)) return false;
  const m = tiempoAMinutos(r.tiempo);
  return m != null && m <= 30;
}

export function esComidaRapidaAmpliada(r: Receta): boolean {
  if (!esRecetaAptaPoolComidasRapidas(r)) return false;
  const m = tiempoAMinutos(r.tiempo);
  return m != null && m <= 45;
}

const PATRONES_TITULO_NINOS = [
  /^croquetas?\b/,
  /\bnuggets\b/,
  /\bfingers\b/,
  /^hamburguesa/,
  /^pizza\b/,
  /\bpizza /,
  /^macarrones\b/,
  /^espaguet/i,
  /^spaghetti/i,
  /^fideos\b/,
  /^tallarines\b/,
  /^tortilla de patata/,
  /^tortilla francesa/,
  /rebozad[oa]s?\b/,
  /^pechugas? de pollo/,
  /^albondigas\b|^albóndigas\b/,
  /^empanadill/,
  /^perrito caliente/,
  /^salchichas?\b/,
  /^lasaña\b|^lasana\b/,
  /^puré de patata|^pure de patata/,
  /^patatas fritas/,
  /^filetes rusos/,
  /^tortitas\b/,
  /^hot dog\b/,
  /^bocadillo\b/,
  /^sándwich\b|^sandwich\b/,
  /^albóndiga|^albondiga/,
  /^dados de pollo/,
  /^palitos de pollo/,
];

/** Pool niños: sin salsas sueltas, mojo ni platos muy «adultos». */
export function esRecetaAptaPoolLandingNinos(r: Receta): boolean {
  return (
    !esRecetaPrincipalmenteSalsa(r) &&
    !esRecetaExcluidaLandingManual(r) &&
    !esRecetaDemasiadoAdultaParaNinos(r)
  );
}

export function esRecetaDemasiadoAdultaParaNinos(r: Receta): boolean {
  const t = (r.title ?? '').toLowerCase();
  const adultos = [
    'fideuá',
    'fideua',
    'langostino',
    'bogavante',
    'caviar',
    'foie',
    'carpaccio',
    'tartar',
    'ceviche',
    'confit de pato',
    'mermelada de tomate',
    'tempura de colores',
    'mollejas',
    'criadilla',
    'mejillon',
    'mejillón',
    'almeja',
    'alcachofa',
    'bacalao ahumado',
    'queso azul',
    'setas y bacalao',
  ];
  if (adultos.some((a) => t.includes(a))) return true;
  if (/\bensalada\b/.test(t) && !/\bcroqueta|nugget|fingers\b/.test(t)) return true;
  return false;
}

/** Platos que suelen gustar a niños (título o tag explícito). */
export function esRecetaPlatoTipicoNinos(r: Receta): boolean {
  const tags = (r.tags ?? []).map((x) => x.toLowerCase());
  if (tags.some((t) => /niños|ninos|niño|infantil|peques|kids/.test(t))) return true;
  if (tags.includes('plato-familiar') || tags.includes('familia')) return true;

  const t = (r.title ?? '').toLowerCase().trim();
  if (PATRONES_TITULO_NINOS.some((p) => p.test(t))) return true;

  const blob = textoBusqueda(r);
  if (/niños|ninos|niño|infantil|peques/.test(blob)) return true;

  return false;
}

export function esRecetaParaNinosEstricta(r: Receta): boolean {
  if (!esRecetaAptaPoolLandingNinos(r)) return false;
  if (!esRecetaPlatoTipicoNinos(r)) return false;
  return r.dificultad !== 'dificil';
}

export function esRecetaParaNinosAmpliada(r: Receta): boolean {
  if (!esRecetaAptaPoolLandingNinos(r)) return false;
  if (r.dificultad === 'dificil') return false;
  if (esRecetaPlatoTipicoNinos(r)) return true;

  const t = (r.title ?? '').toLowerCase();
  const blob = textoBusqueda(r);
  const kidFoods = [
    'pasta',
    'espaguet',
    'macarron',
    'croqueta',
    'nuggets',
    'empanadilla',
    'merluza',
    'pollo',
    'patata',
    'puré',
    'pure de',
    'tortilla',
    'pizza',
    'hamburguesa',
    'fingers',
    'spaghetti',
    'lenteja',
    'arroz con',
    'arroz a la',
  ];
  if (kidFoods.some((k) => t.includes(k) || blob.includes(k))) return true;
  return false;
}

/**
 * «Recetas para niños»: prioriza platos típicos; sin relleno con destacadas aleatorias.
 */
export function pickRecetasLandingNinos(
  pool: Receta[],
  opts: { min?: number; max?: number; maxCanarias?: number } = {}
): Receta[] {
  const min = opts.min ?? 10;
  const max = opts.max ?? 24;
  const maxCanarias = opts.maxCanarias ?? 4;

  const candidatas = prepararPoolPriorizandoNoCanarias(pool.filter(esRecetaAptaPoolLandingNinos));
  const tipicas = candidatas.filter((r) => esRecetaPlatoTipicoNinos(r));
  const otras = candidatas.filter((r) => !esRecetaPlatoTipicoNinos(r));

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

  push(tipicas.filter(esRecetaParaNinosEstricta));
  push(otras.filter(esRecetaParaNinosEstricta));
  if (out.length < min) push(tipicas.filter(esRecetaParaNinosAmpliada));
  if (out.length < min) push(otras.filter(esRecetaParaNinosAmpliada));

  return out.slice(0, max);
}

/** Criterio estricto: tag económica en BD. */
export function esRecetaBarataEstricta(r: Receta): boolean {
  if (!esRecetaAptaPoolLandingBaratas(r)) return false;
  return esRecetaMarcadaEconomica(r);
}

/** Complemento si faltan platos: ingredientes típicos baratos (sin tag). */
export function esRecetaBarataHeuristica(r: Receta): boolean {
  if (esRecetaExclusivamentePostre(r)) return false;
  if (!esRecetaAptaPoolLandingBaratas(r)) return false;

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
    'macarrones',
  ];
  if (cheap.some((k) => blob.includes(k) || titulo.includes(k))) return true;

  return r.dificultad === 'facil' && (r.ingredientes?.length ?? 99) <= 7;
}

export function esRecetaBarataAmpliada(r: Receta): boolean {
  if (!esRecetaAptaPoolLandingBaratas(r)) return false;
  if (esRecetaMarcadaEconomica(r)) return true;
  return esRecetaBarataHeuristica(r);
}

/** @deprecated Usa `esRecetaBarataEstricta` o `esRecetaBarataAmpliada` */
export function esRecetaBarata(r: Receta): boolean {
  return esRecetaBarataEstricta(r) || esRecetaBarataHeuristica(r);
}

/**
 * «Recetas baratas»: prioriza tag economica/economicas; máx. 4 canarias en 24.
 */
export function pickRecetasLandingBaratas(
  pool: Receta[],
  opts: { min?: number; max?: number; maxCanarias?: number } = {}
): Receta[] {
  const min = opts.min ?? 10;
  const max = opts.max ?? 24;
  const maxCanarias = opts.maxCanarias ?? 4;
  const candidatas = prepararPoolPriorizandoNoCanarias(pool.filter(esRecetaAptaPoolLandingBaratas));
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

  push(otras.filter(esRecetaBarataEstricta));
  push(canarias.filter(esRecetaBarataEstricta));
  if (out.length < min) push(otras.filter(esRecetaBarataAmpliada));
  if (out.length < min) push(canarias.filter(esRecetaBarataAmpliada));

  return out.slice(0, max);
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
