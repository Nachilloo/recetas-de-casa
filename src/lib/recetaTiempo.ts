/** Valores válidos para ?tiempo= en /buscar */
export type FiltroTiempoURL = 'lt30' | 'm30_60' | 'gt60' | 'all';

/** Estima los minutos de la receta (rangos tipo "30–40 min" → 40). */
export function estimarTiempoMinutos(tiempo: string | null | undefined): number | null {
  if (!tiempo?.trim()) return null;
  const s = tiempo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const candidates: number[] = [];

  let m: RegExpExecArray | null;
  const reRange = /(\d+)\s*[-–]\s*(\d+)\s*(?:min(?:utos)?|\bm\b)/g;
  while ((m = reRange.exec(s)) !== null) {
    candidates.push(parseInt(m[2], 10));
  }

  const reHorasConMin = /(\d+)\s*(?:h\b|hora|horas)\s*(?:(\d+)\s*(?:min(?:utos)?|\bm\b)?)?/g;
  while ((m = reHorasConMin.exec(s)) !== null) {
    const h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    candidates.push(h * 60 + min);
  }

  const reSoloHoras = /(\d+)\s*(?:h\b|hora|horas)/g;
  while ((m = reSoloHoras.exec(s)) !== null) {
    candidates.push(parseInt(m[1], 10) * 60);
  }

  const reMin = /(\d+)\s*(?:min(?:utos)?)/g;
  while ((m = reMin.exec(s)) !== null) {
    candidates.push(parseInt(m[1], 10));
  }

  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

export function normalizaFiltroTiempo(v: string | null): FiltroTiempoURL {
  if (!v || v === 'all') return 'all';
  if (v === 'lt30' || v === 'm30_60' || v === 'gt60') return v;
  return 'all';
}

export function recetaCoincideFiltroTiempo(
  tiempoField: string | null | undefined,
  filtro: FiltroTiempoURL
): boolean {
  if (filtro === 'all') return true;
  const min = estimarTiempoMinutos(tiempoField);
  if (min == null) return false;
  if (filtro === 'lt30') return min < 30;
  if (filtro === 'm30_60') return min >= 30 && min <= 60;
  return min > 60;
}
