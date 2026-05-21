import type { SupabaseClient } from '@supabase/supabase-js';
import { PIN_COOLDOWN_DAYS, WEEKDAY_CATEGORIES } from './constants';
import { getCategoriasList, recetaTieneCategoria } from '../recetaCategorias';
import type { Database, Receta } from '../types';

export type DailyRecipeCandidate = Pick<
  Receta,
  'slug' | 'title' | 'categoria' | 'categorias' | 'tiempo' | 'dificultad' | 'descripcion' | 'destacada'
>;

export class NoRecipeAvailableError extends Error {
  constructor(message = 'No hay recetas disponibles para pin hoy') {
    super(message);
    this.name = 'NoRecipeAvailableError';
  }
}

function cooldownCutoff(now = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - PIN_COOLDOWN_DAYS);
  return d.toISOString();
}

function startOfUtcDay(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function endOfUtcDay(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  ).toISOString();
}

export async function hasPostedPinToday(
  client: SupabaseClient<Database>,
): Promise<boolean> {
  const now = new Date();
  const { count, error } = await client
    .from('pin_history')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'posted')
    .gte('posted_at', startOfUtcDay(now))
    .lte('posted_at', endOfUtcDay(now));

  if (error) throw new Error(`pin_history check failed: ${error.message}`);
  return (count ?? 0) > 0;
}

async function fetchRecentPinnedSlugs(
  client: SupabaseClient<Database>,
  now = new Date(),
): Promise<Set<string>> {
  const cutoff = cooldownCutoff(now);
  const { data, error } = await client
    .from('pin_history')
    .select('receta_slug')
    .eq('status', 'posted')
    .gte('posted_at', cutoff);

  if (error) throw new Error(`pin_history fetch failed: ${error.message}`);
  return new Set((data ?? []).map((row) => row.receta_slug));
}

function matchesDayCategories(receta: DailyRecipeCandidate, categories: string[]): boolean {
  if (categories.length === 0) return false;
  return categories.some((cat) => recetaTieneCategoria(receta, cat));
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

async function fetchAllRecipes(client: SupabaseClient<Database>): Promise<DailyRecipeCandidate[]> {
  const { data, error } = await client
    .from('recetas')
    .select('slug, title, categoria, categorias, tiempo, dificultad, descripcion, destacada');

  if (error) throw new Error(`recetas fetch failed: ${error.message}`);
  return (data ?? []) as DailyRecipeCandidate[];
}

function filterAvailable(
  recipes: DailyRecipeCandidate[],
  recentSlugs: Set<string>,
  predicate: (receta: DailyRecipeCandidate) => boolean,
): DailyRecipeCandidate[] {
  return recipes.filter(
    (receta) => !recentSlugs.has(receta.slug) && predicate(receta),
  );
}

/**
 * Selecciona la receta del día según rotación semanal, anti-repetición y fallback.
 */
export async function selectDailyRecipe(
  client: SupabaseClient<Database>,
  now = new Date(),
): Promise<DailyRecipeCandidate> {
  const weekday = now.getUTCDay();
  const dayCategories = WEEKDAY_CATEGORIES[weekday] ?? [];
  const recentSlugs = await fetchRecentPinnedSlugs(client, now);
  const allRecipes = await fetchAllRecipes(client);

  if (allRecipes.length === 0) {
    throw new NoRecipeAvailableError('No hay recetas en la base de datos');
  }

  // Domingo: priorizar destacadas sin pin reciente
  if (weekday === 0) {
    const featured = filterAvailable(allRecipes, recentSlugs, (r) => r.destacada === true);
    const picked = pickRandom(featured);
    if (picked) return picked;
  }

  // Categorías del día
  if (dayCategories.length > 0) {
    const byCategory = filterAvailable(allRecipes, recentSlugs, (r) =>
      matchesDayCategories(r, dayCategories),
    );
    const picked = pickRandom(byCategory);
    if (picked) return picked;
  }

  // Fallback: cualquier receta fuera de ventana de cooldown
  const fallback = filterAvailable(allRecipes, recentSlugs, () => true);
  const picked = pickRandom(fallback);
  if (picked) return picked;

  // Si todas están en cooldown, la más antigua pinneada
  const { data: oldestRow, error } = await client
    .from('pin_history')
    .select('receta_slug, posted_at')
    .eq('status', 'posted')
    .order('posted_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`pin_history oldest fetch failed: ${error.message}`);

  const oldestSlug = (oldestRow as { receta_slug: string } | null)?.receta_slug;
  if (oldestSlug) {
    const receta = allRecipes.find((r) => r.slug === oldestSlug);
    if (receta) return receta;
  }

  throw new NoRecipeAvailableError();
}

/** Para depuración: categorías efectivas de una receta. */
export function debugRecipeCategories(receta: DailyRecipeCandidate): string[] {
  return getCategoriasList(receta);
}
