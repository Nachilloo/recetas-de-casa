import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_POOL_MAX = 100;

export function shuffleArray<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Ventana aleatoria sobre el listado ordenado por fecha (sin RPC en Supabase).
 * Evita cargar todo el recetario y reduce sesgo hacia las últimas añadidas.
 */
export async function fetchPoolRecetasAleatorias(
  supabase: SupabaseClient,
  select: string,
  poolMax = DEFAULT_POOL_MAX
): Promise<any[]> {
  const { count, error: cErr } = await supabase
    .from('recetas')
    .select('slug', { count: 'exact', head: true });

  if (cErr || count === null || count === 0) {
    if (cErr) console.error('[recetasAleatorias] count', cErr);
    return [];
  }

  const pool = Math.min(poolMax, count);
  const maxOff = Math.max(0, count - pool);
  const off = Math.floor(Math.random() * (maxOff + 1));

  const { data, error } = await supabase
    .from('recetas')
    .select(select)
    .order('created_at', { ascending: false })
    .range(off, off + pool - 1);

  if (error) {
    console.error('[recetasAleatorias] pool', error);
    return [];
  }

  return shuffleArray(data ?? []);
}

export function elegirHeroConImagen<T extends { imagen?: string | null }>(
  lista: T[]
): T | null {
  if (!lista.length) return null;
  const conImagen = lista.filter((r) => (r.imagen || '').trim());
  const pool = conImagen.length ? conImagen : lista;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}
