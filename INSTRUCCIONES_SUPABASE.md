# Instrucciones de Configuración de Supabase

## Paso 1: Crear Proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com) y crea una cuenta si no tienes una
2. Crea un nuevo proyecto:
   - Nombre: `recetas-de-casa` (o el que prefieras)
   - Database Password: Guarda esta contraseña en un lugar seguro
   - Region: Elige la más cercana a ti o tus usuarios

## Paso 2: Crear la Tabla de Recetas

1. En tu proyecto de Supabase, ve a **SQL Editor** en la barra lateral
2. Abre el archivo `supabase-schema.sql` de este proyecto
3. Copia todo el contenido
4. Pégalo en el SQL Editor de Supabase
5. Haz clic en **RUN** para ejecutar el script
6. Verifica que la tabla `recetas` se haya creado correctamente en **Table Editor**

## Paso 3: Crear Usuario Administrador

1. Ve a **Authentication** > **Users** en Supabase
2. Haz clic en **Add user** > **Create new user**
3. Ingresa:
   - Email: tu email de administrador
   - Password: una contraseña segura
   - Auto Confirm User: ✅ (marca esta opción)
4. Guarda estas credenciales, las usarás para hacer login en el panel admin

## Paso 4: Obtener las Credenciales de API

1. Ve a **Settings** > **API** en la barra lateral
2. Encontrarás tres valores importantes:
   - **Project URL**: Esta es tu `PUBLIC_SUPABASE_URL`
   - **anon/public key**: Esta es tu `PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key**: Esta es tu `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **MUY IMPORTANTE: Nunca expongas esta clave en el cliente**

## Paso 5: Configurar Variables de Entorno

1. Abre el archivo `.env` en la raíz del proyecto
2. Reemplaza los valores de ejemplo con tus credenciales reales:

```env
PUBLIC_SUPABASE_URL=https://tu-proyecto-real.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Guarda el archivo

## Paso 6: Verificar la Configuración

Una vez que hayas completado los pasos anteriores, el proyecto estará listo para:
- Migrar las recetas existentes de Markdown a Supabase
- Crear, editar y eliminar recetas desde el panel admin
- Desplegar a Vercel con la base de datos configurada

## Notas de Seguridad

- ✅ Las políticas RLS garantizan que todos puedan **leer** las recetas
- ✅ Solo usuarios **autenticados** pueden crear, editar o eliminar
- ✅ El `service_role_key` bypasea RLS, úsalo solo en el servidor
- ✅ Nunca hagas commit del archivo `.env` a Git (ya está en `.gitignore`)

