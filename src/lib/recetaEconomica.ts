const TAGS_ECONOMICA = new Set([
  'economica',
  'economicas',
  'receta-economica',
  'recetas-economicas',
  'barata',
  'baratas',
]);

/** Receta etiquetada como económica en BD (tag explícito). */
export function esRecetaMarcadaEconomica(r: { tags?: string[] | null }): boolean {
  return (r.tags ?? []).some((raw) => {
    const t = raw.toLowerCase().trim();
    if (TAGS_ECONOMICA.has(t)) return true;
    return t.includes('econom') || t.includes('barat');
  });
}
