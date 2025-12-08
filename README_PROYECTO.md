# 🍽️ Recetas de Casa - Documentación del Proyecto

Sistema completo de gestión de recetas con Astro, Supabase y panel de administración.

## 📋 Descripción

Aplicación web moderna para gestionar y compartir recetas de cocina, con:

- ✅ Frontend estático ultra-rápido con Astro
- ✅ Base de datos en Supabase (PostgreSQL)
- ✅ Panel de administración protegido
- ✅ CRUD completo de recetas con validación
- ✅ Autenticación segura con Supabase Auth
- ✅ Búsqueda y filtrado avanzado
- ✅ Diseño responsive con Tailwind CSS
- ✅ Componentes interactivos con React (Islands)
- ✅ Deploy automático en Vercel

## 🏗️ Arquitectura

### Stack Tecnológico

- **Frontend**: Astro 5 (SSR)
- **UI Library**: React (Islands Architecture)
- **Styling**: Tailwind CSS 4
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth
- **Validación**: Zod
- **Deploy**: Vercel (Serverless)
- **Lenguaje**: TypeScript

### Estructura del Proyecto

```
recetas-de-casa/
├── src/
│   ├── components/          # Componentes Astro y React
│   │   ├── admin/          # Componentes del panel admin
│   │   │   ├── LoginForm.tsx
│   │   │   └── RecipeForm.tsx
│   │   ├── RecetaCard.astro
│   │   ├── SearchBox.astro
│   │   └── ...
│   ├── layouts/            # Layouts de página
│   │   ├── Layout.astro
│   │   └── RecetaLayout.astro
│   ├── lib/                # Utilidades y clientes
│   │   ├── supabase.ts    # Cliente de Supabase
│   │   └── types.ts       # Tipos TypeScript
│   ├── pages/             # Rutas y páginas
│   │   ├── api/           # API Routes (Serverless)
│   │   │   ├── auth/
│   │   │   │   └── logout.ts
│   │   │   ├── recetas/
│   │   │   │   ├── index.ts    # POST /api/recetas
│   │   │   │   └── [id].ts     # GET/PUT/DELETE /api/recetas/:id
│   │   │   └── migrate.ts      # Migración inicial
│   │   ├── admin/         # Panel de administración
│   │   │   ├── index.astro         # Dashboard
│   │   │   ├── login.astro         # Login
│   │   │   └── recetas/
│   │   │       ├── nueva.astro     # Crear receta
│   │   │       └── [id].astro      # Editar receta
│   │   ├── recetas/       # Páginas públicas
│   │   │   ├── index.astro         # Lista de recetas
│   │   │   └── [id].astro          # Detalle de receta
│   │   ├── buscar.astro   # Búsqueda
│   │   └── index.astro    # Home
│   ├── middleware.ts      # Protección de rutas
│   └── content/           # Content Collections (legacy)
├── public/                # Archivos estáticos
│   └── images/
├── astro.config.mjs      # Configuración de Astro
├── vercel.json           # Configuración de Vercel
├── supabase-schema.sql   # Schema de la base de datos
├── INSTRUCCIONES_SUPABASE.md  # Guía de Supabase
├── DEPLOYMENT_GUIDE.md        # Guía de deploy
└── package.json
```

## 🔑 Conceptos Clave de Astro

### 1. Server-First Architecture

Astro renderiza en el servidor por defecto, similar a Next.js con SSR:

```astro
---
// Este código se ejecuta en el SERVIDOR
import { supabase } from '../lib/supabase';

const { data: recetas } = await supabase
  .from('recetas')
  .select('*');
---

<!-- Este HTML se renderiza en el servidor -->
<div>
  {recetas.map(receta => <RecetaCard receta={receta} />)}
</div>
```

### 2. API Routes

Los archivos en `src/pages/api/` se convierten en endpoints REST:

```typescript
// src/pages/api/recetas/index.ts
export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();
  // Procesar...
  return new Response(JSON.stringify({ success: true }));
};
```

### 3. Islands Architecture

Solo los componentes que necesitan interactividad usan JavaScript:

```astro
<!-- Estático: sin JS -->
<RecetaCard receta={receta} />

<!-- Interactivo: con React -->
<RecipeForm client:only="react" />
```

Directivas disponibles:
- `client:load` - Carga inmediatamente
- `client:idle` - Carga cuando el navegador está idle
- `client:visible` - Carga cuando es visible
- `client:only="react"` - Solo renderiza en el cliente

### 4. Middleware

El middleware protege rutas antes de renderizarlas:

```typescript
// src/middleware.ts
export const onRequest = defineMiddleware(async ({ url, redirect }, next) => {
  if (url.pathname.startsWith('/admin')) {
    // Verificar autenticación
    const session = await getSession();
    if (!session) return redirect('/admin/login');
  }
  return next();
});
```

## 🗄️ Base de Datos

### Schema de Supabase

La tabla `recetas` tiene la siguiente estructura:

```sql
CREATE TABLE recetas (
  id UUID PRIMARY KEY,
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
  ingredientes TEXT[] NOT NULL,
  pasos TEXT[] NOT NULL,
  tips TEXT[],
  tags TEXT[],
  calorias INTEGER,
  destacada BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Row Level Security (RLS)

Las políticas de seguridad garantizan:

- ✅ **Lectura pública**: Todos pueden ver las recetas
- ✅ **Escritura protegida**: Solo usuarios autenticados pueden modificar
- ✅ **Bypass con service_role**: Para operaciones admin

```sql
-- Lectura pública
CREATE POLICY "Lectura pública" ON recetas
FOR SELECT USING (true);

-- Escritura solo autenticados
CREATE POLICY "Solo autenticados escriben" ON recetas
FOR ALL USING (auth.role() = 'authenticated');
```

## 🔐 Seguridad

### Niveles de Seguridad

1. **Base de datos**: RLS en Supabase
2. **API Routes**: Verificación de sesión en cada endpoint
3. **Middleware**: Protección de rutas `/admin/*`
4. **Cliente**: Validación con Zod en formularios
5. **Transporte**: HTTPS obligatorio (Vercel)

### Variables de Entorno

```bash
# Públicas (pueden estar en el cliente)
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...

# Privadas (solo servidor)
SUPABASE_SERVICE_ROLE_KEY=...  # ⚠️ Nunca exponer
MIGRATION_PASSWORD=...
```

## 🚀 Desarrollo Local

### 1. Instalar Dependencias

```bash
pnpm install
```

### 2. Configurar Variables de Entorno

Copia `.env.example` a `.env` y completa con tus credenciales de Supabase.

### 3. Iniciar Servidor de Desarrollo

```bash
pnpm dev
```

La aplicación estará en: `http://localhost:4321`

### 4. Migrar Recetas (primera vez)

```bash
curl -X POST http://localhost:4321/api/migrate \
  -H "Content-Type: application/json" \
  -d '{"password": "migrate-recetas-2025"}'
```

## 📝 API Reference

### Endpoints Públicos

#### GET /api/recetas
Obtiene todas las recetas.

**Response**:
```json
{
  "success": true,
  "data": [...]
}
```

#### GET /api/recetas/:id
Obtiene una receta específica.

### Endpoints Protegidos (requieren autenticación)

#### POST /api/recetas
Crea una nueva receta.

**Body**:
```json
{
  "title": "Crema de Calabaza",
  "slug": "crema-calabaza",
  "categoria": "sopas-cremas",
  "dificultad": "facil",
  "tiempo": "35 min",
  "porciones": 4,
  "imagen": "/images/recetas/crema-calabaza.webp",
  "descripcion": "Una crema suave y cremosa",
  "ingredientes": ["750g calabaza", ...],
  "pasos": ["Lavar y pelar...", ...],
  "destacada": false
}
```

#### PUT /api/recetas/:id
Actualiza una receta existente.

#### DELETE /api/recetas/:id
Elimina una receta.

## 🎨 Componentes Principales

### RecipeForm (React)

Formulario completo para crear/editar recetas con:
- Arrays dinámicos para ingredientes/pasos/tips/tags
- Auto-generación de slug
- Validación en tiempo real
- Preview de imagen

### LoginForm (React)

Formulario de autenticación con:
- Integración con Supabase Auth
- Manejo de errores
- Redirección post-login

### RecetaCard (Astro)

Tarjeta de receta con:
- Imagen responsive
- Información clave (tiempo, porciones, calorías)
- Badge de categoría y dificultad
- Tags

## 🧪 Testing

```bash
# Verificar tipos de TypeScript
pnpm check

# Build de producción
pnpm build

# Preview del build
pnpm preview
```

## 📦 Deploy

Ver la guía completa en `DEPLOYMENT_GUIDE.md`.

Resumen rápido:

```bash
# Conectar con Vercel
vercel

# O hacer push a Git (si está conectado)
git push origin main
```

## 🔄 Flujo de Trabajo

### Añadir una Nueva Receta (Producción)

1. Ir a `/admin/login`
2. Iniciar sesión con credenciales de Supabase
3. Clic en "Nueva Receta"
4. Completar formulario
5. Guardar

### Editar una Receta

1. Dashboard admin → Clic en ✏️ junto a la receta
2. Modificar campos necesarios
3. Guardar cambios

### Eliminar una Receta

1. Dashboard admin → Clic en 🗑️ junto a la receta
2. Confirmar eliminación

## 📚 Recursos de Aprendizaje

### Astro
- [Documentación oficial](https://docs.astro.build)
- [Tutorial interactivo](https://docs.astro.build/en/tutorial/0-introduction/)
- [Astro Islands](https://docs.astro.build/en/concepts/islands/)

### Supabase
- [Quickstart](https://supabase.com/docs/guides/getting-started)
- [Auth](https://supabase.com/docs/guides/auth)
- [RLS](https://supabase.com/docs/guides/auth/row-level-security)

### Vercel
- [Deploy Astro](https://vercel.com/docs/frameworks/astro)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

## 🐛 Troubleshooting

### "Cannot find module '@supabase/supabase-js'"

```bash
pnpm install @supabase/supabase-js
```

### Error de autenticación en admin

1. Verificar que el usuario existe en Supabase Auth
2. Verificar variables de entorno
3. Limpiar cookies y volver a iniciar sesión

### Las recetas no aparecen

1. Verificar que la migración se ejecutó correctamente
2. Revisar tabla en Supabase Dashboard
3. Verificar RLS policies

## 🎯 Próximas Mejoras

- [ ] Upload de imágenes a Supabase Storage
- [ ] Comentarios en recetas
- [ ] Sistema de favoritos
- [ ] Compartir en redes sociales
- [ ] PWA (Progressive Web App)
- [ ] Modo oscuro
- [ ] Exportar recetas a PDF

## 📄 Licencia

Este proyecto es privado y de uso personal.

---

Creado con ❤️ usando Astro, Supabase y Vercel

