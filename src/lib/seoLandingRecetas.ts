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
  opts: { min?: number; max?: number } = {}
): Receta[] {
  const min = opts.min ?? 10;
  const max = opts.max ?? 24;
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

  push(todas.filter(criterioEstricto));
  if (out.length < min) push(todas.filter(criterioAmpliado));
  if (out.length < min) {
    const resto = [...todas].sort((a, b) => Number(b.destacada) - Number(a.destacada));
    push(resto);
  }

  return out.slice(0, max);
}
