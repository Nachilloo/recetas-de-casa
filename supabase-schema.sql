-- Tabla de recetas
CREATE TABLE recetas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  categoria TEXT NOT NULL,
  dificultad TEXT NOT NULL,
  tiempo TEXT NOT NULL,
  porciones INTEGER NOT NULL,
  imagen TEXT NOT NULL,
  imagen_alt TEXT,
  descripcion TEXT,
  historia TEXT,
  ingredientes TEXT[] NOT NULL DEFAULT '{}',
  pasos TEXT[] NOT NULL DEFAULT '{}',
  tips TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  calorias INTEGER,
  destacada BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_recetas_slug ON recetas(slug);
CREATE INDEX idx_recetas_categoria ON recetas(categoria);
CREATE INDEX idx_recetas_destacada ON recetas(destacada);
CREATE INDEX idx_recetas_created_at ON recetas(created_at DESC);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at
CREATE TRIGGER update_recetas_updated_at BEFORE UPDATE ON recetas
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Habilitar Row Level Security (RLS)
ALTER TABLE recetas ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer las recetas
CREATE POLICY "Las recetas son públicas para lectura"
ON recetas FOR SELECT
TO public
USING (true);

-- Política: Solo usuarios autenticados pueden insertar
CREATE POLICY "Solo usuarios autenticados pueden insertar recetas"
ON recetas FOR INSERT
TO authenticated
WITH CHECK (true);

-- Política: Solo usuarios autenticados pueden actualizar
CREATE POLICY "Solo usuarios autenticados pueden actualizar recetas"
ON recetas FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Política: Solo usuarios autenticados pueden eliminar
CREATE POLICY "Solo usuarios autenticados pueden eliminar recetas"
ON recetas FOR DELETE
TO authenticated
USING (true);

