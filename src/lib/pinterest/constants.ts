export const SITE_HOST = 'recetasdecasa.es';
export const DEFAULT_SITE_URL = 'https://www.recetasdecasa.es';

export const PIN_WIDTH = 1000;
export const PIN_HEIGHT = 1500;

/** Recetas no se repiten en este periodo (días). */
export const PIN_COOLDOWN_DAYS = 120;

/** Categorías objetivo por día de la semana (0 = domingo). */
export const WEEKDAY_CATEGORIES: Record<number, string[]> = {
  0: [], // domingo: destacadas (lógica especial)
  1: ['carnes-aves', 'pescados-mariscos'],
  2: ['sopas-cremas'],
  3: ['tortillas-pasta'],
  4: ['ensaladas-tapas'],
  5: ['postres'],
  6: ['air-fryer', 'arroz-paellas'],
};

export const UTM_PARAMS = 'utm_source=pinterest&utm_medium=social&utm_campaign=daily-pin';
