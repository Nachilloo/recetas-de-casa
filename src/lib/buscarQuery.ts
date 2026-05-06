import type { FiltroTiempoURL } from './recetaTiempo';

/** Texto legible para chips y metadatos */
export const TEXTO_FILTRO_TIEMPO: Record<Exclude<FiltroTiempoURL, 'all'>, string> = {
  lt30: 'Menos de 30 minutos',
  m30_60: 'Entre 30 y 60 minutos',
  gt60: 'Más de 60 minutos',
};

export function textoFiltroTiempo(f: FiltroTiempoURL): string | null {
  if (f === 'all') return null;
  return TEXTO_FILTRO_TIEMPO[f];
}

/** Construye path /buscar?… con q, categoria y tiempo */
export function buscarHref(parts: {
  termino?: string;
  categoria?: string | null;
  tiempo?: FiltroTiempoURL;
}) {
  const p = new URLSearchParams();
  if (parts.termino?.trim()) p.set('q', parts.termino.trim());
  if (parts.categoria) p.set('categoria', parts.categoria);
  if (parts.tiempo && parts.tiempo !== 'all') p.set('tiempo', parts.tiempo);
  const qs = p.toString();
  return `/buscar${qs ? `?${qs}` : ''}`;
}
