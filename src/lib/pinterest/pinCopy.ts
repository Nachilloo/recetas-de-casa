import { categorias } from '../categoriasRecetas';
import { primaryCategoria } from '../recetaCategorias';
import type { Receta } from '../types';

/** Trunca título para caber en ~2 líneas del pin. */
export function truncatePinTitle(title: string, maxLen = 72): string {
  const trimmed = title.trim();
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.slice(0, maxLen - 1);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > maxLen * 0.6) return `${cut.slice(0, lastSpace)}…`;
  return `${cut}…`;
}

export function formatPinTitle(receta: Pick<Receta, 'title' | 'tiempo' | 'dificultad'>): string {
  const base = truncatePinTitle(receta.title, 60);
  const tiempo = receta.tiempo?.trim();
  if (tiempo) return `${base} | ${tiempo}`;
  return base;
}

export function formatPinDescription(
  receta: Pick<Receta, 'title' | 'descripcion' | 'categoria' | 'categorias' | 'tiempo' | 'dificultad'>,
): string {
  const catKey = primaryCategoria(receta.categorias?.length ? receta.categorias : [receta.categoria]);
  const catLabel = categorias[catKey as keyof typeof categorias] ?? catKey;
  const intro =
    receta.descripcion?.trim().slice(0, 140) ||
    `Receta casera de ${receta.title.toLowerCase()}. Fácil de seguir paso a paso.`;
  const meta = [catLabel, receta.tiempo, receta.dificultad].filter(Boolean).join(' · ');
  return `${intro}${intro.endsWith('.') ? '' : '.'} ${meta}. Receta completa en recetasdecasa.es`;
}

export function resolveRecipeImageUrl(imagen: string, siteUrl: string): string {
  if (imagen.startsWith('http://') || imagen.startsWith('https://')) return imagen;
  const path = imagen.startsWith('/') ? imagen : `/${imagen}`;
  return `${siteUrl.replace(/\/$/, '')}${path}`;
}

export function categoryLabel(receta: Pick<Receta, 'categoria' | 'categorias'>): string {
  const key = primaryCategoria(receta.categorias?.length ? receta.categorias : [receta.categoria]);
  return categorias[key as keyof typeof categorias] ?? key;
}
