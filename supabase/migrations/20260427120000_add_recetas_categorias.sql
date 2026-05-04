-- Ejecutar en Supabase SQL Editor si no usas CLI de migraciones.
-- Añade array de categorías por receta (p. ej. air-fryer + postres).

alter table public.recetas
  add column if not exists categorias text[];

update public.recetas
set categorias = array[categoria]::text[]
where categorias is null;

create index if not exists recetas_categorias_gin on public.recetas using gin (categorias);
