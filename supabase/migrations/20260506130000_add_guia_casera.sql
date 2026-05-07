-- Texto editorial (150–200 palabras): contexto, cuándo prepararla, beneficios prácticos
ALTER TABLE public.recetas
  ADD COLUMN IF NOT EXISTS guia_casera text;

COMMENT ON COLUMN public.recetas.guia_casera IS 'Guía del chef: contexto del plato, cuándo hacerla y beneficios (tono casero, sin propiedades médicas).';
