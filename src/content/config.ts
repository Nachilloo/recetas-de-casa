import { defineCollection, z } from 'astro:content';

// Definir las categorías como enum para type safety
export const categorias = {
  'arroz-paellas': 'Arroces y Paellas',
  'tortillas-pasta': 'Tortillas y Pasta', 
  'sopas-cremas': 'Sopas y Cremas',
  'carnes-aves': 'Carnes y Aves',
  'pescados-mariscos': 'Pescados y Mariscos',
  'pan-masas': 'Pan y Masas',
  'postres': 'Postres',
  'tapas-aperitivos': 'Tapas y Aperitivos'
} as const;

// Definir los niveles de dificultad
export const dificultades = {
  'facil': 'Fácil',
  'media': 'Media', 
  'dificil': 'Difícil'
} as const;

// Schema para las recetas
const recetasSchema = z.object({
  title: z.string(),
  slug: z.string().optional(), // Se genera automáticamente del filename
  categoria: z.enum(Object.keys(categorias) as [string, ...string[]]),
  dificultad: z.enum(Object.keys(dificultades) as [string, ...string[]]),
  tiempo: z.string(), // "30 min", "1 hora", etc.
  porciones: z.number().min(1),
  imagen: z.string(), // Cambiado de .url() a string normal para rutas relativas
  imagenAlt: z.string().optional(),
  ingredientes: z.array(z.string()),
  pasos: z.array(z.string()),
  descripcion: z.string().optional(),
  historia: z.string().optional(),
  tips: z.array(z.string()).optional(),
  calorias: z.number().optional(),
  tags: z.array(z.string()).optional(),
  destacada: z.boolean().default(false),
  fechaCreacion: z.date().optional(),
  fechaActualizacion: z.date().optional()
});

// Definir la collection
export const recetas = defineCollection({
  type: 'content',
  schema: recetasSchema
});

export const collections = { recetas };

// Exportar el tipo para usar en componentes
export type Receta = z.infer<typeof recetasSchema>;
export type Categoria = keyof typeof categorias;
export type Dificultad = keyof typeof dificultades;