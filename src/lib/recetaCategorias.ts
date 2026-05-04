import { categorias as categoriasLabels } from './categoriasRecetas';

const VALID_KEYS = new Set(Object.keys(categoriasLabels));

export type RecetaCategoriaFields = {
  categoria: string;
  categorias?: string[] | null;
};

/** Lista efectiva: columna `categorias` o, si falta, solo `categoria` (filas antiguas). */
export function getCategoriasList(receta: RecetaCategoriaFields): string[] {
  const raw = receta.categorias;
  if (Array.isArray(raw) && raw.length > 0) {
    return [...new Set(raw.filter((k) => VALID_KEYS.has(k)))];
  }
  if (receta.categoria && VALID_KEYS.has(receta.categoria)) {
    return [receta.categoria];
  }
  return [];
}

export function recetaTieneCategoria(receta: RecetaCategoriaFields, key: string): boolean {
  return getCategoriasList(receta).includes(key);
}

/** Primera categoría que no sea solo método air-fryer; si no hay, air-fryer o la primera. */
export function primaryCategoria(categoriasList: string[]): string {
  const food = categoriasList.find((c) => c !== 'air-fryer');
  return food ?? categoriasList[0] ?? 'postres';
}

export function normalizeRecetaCategorias(input: {
  categorias?: string[] | null;
  categoria?: string | null;
}): { categorias: string[]; categoria: string } {
  let list: string[] = [];
  if (input.categorias?.length) {
    list = [...new Set(input.categorias.filter((k) => VALID_KEYS.has(k)))];
  }
  if (list.length === 0 && input.categoria && VALID_KEYS.has(input.categoria)) {
    list = [input.categoria];
  }
  if (list.length === 0) {
    throw new Error('Debe indicarse al menos una categoría válida');
  }
  return {
    categorias: list,
    categoria: primaryCategoria(list),
  };
}
