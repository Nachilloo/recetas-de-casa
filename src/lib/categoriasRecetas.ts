/** Etiquetas de categoría y dificultad (sin dependencia de Astro; usable en React y API). */
export const categorias = {
  'arroz-paellas': 'Arroces y Paellas',
  'tortillas-pasta': 'Tortillas y Pasta',
  'sopas-cremas': 'Sopas y Cremas',
  'carnes-aves': 'Carnes y Aves',
  'pescados-mariscos': 'Pescados y Mariscos',
  'pan-masas': 'Pan y Masas',
  'postres': 'Postres',
  'ensaladas-tapas': 'Ensaladas y Tapas',
  'air-fryer': 'Air Fryer'
} as const;

export const dificultades = {
  'facil': 'Fácil',
  'media': 'Media',
  'dificil': 'Difícil'
} as const;
