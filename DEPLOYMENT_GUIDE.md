# 🚀 Guía de Despliegue en Vercel

Esta guía te ayudará a desplegar tu aplicación de Recetas de Casa en Vercel con Supabase.

## Requisitos Previos

✅ Cuenta de Supabase configurada (ver `INSTRUCCIONES_SUPABASE.md`)
✅ Proyecto de Supabase con la tabla `recetas` creada
✅ Usuario administrador creado en Supabase Auth
✅ Variables de entorno configuradas localmente

## Paso 1: Preparar el Repositorio

1. Asegúrate de que todos los cambios estén commiteados:

```bash
git add .
git commit -m "Configurar proyecto con Supabase y panel admin"
git push origin main
```

2. Verifica que el archivo `.env` esté en `.gitignore` (ya debería estarlo)

## Paso 2: Conectar con Vercel

### Opción A: Desde la CLI de Vercel

```bash
# Instalar Vercel CLI (si no lo tienes)
npm i -g vercel

# Iniciar sesión
vercel login

# Desplegar
vercel
```

### Opción B: Desde el Dashboard de Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Haz clic en **"Add New Project"**
3. Importa tu repositorio de Git (GitHub, GitLab, o Bitbucket)
4. Vercel detectará automáticamente que es un proyecto Astro

## Paso 3: Configurar Variables de Entorno en Vercel

En la página de configuración del proyecto en Vercel:

1. Ve a **Settings** > **Environment Variables**
2. Añade las siguientes variables:

```
PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
MIGRATION_PASSWORD=tu-password-para-migracion
```

⚠️ **MUY IMPORTANTE**: 
- Asegúrate de copiar las credenciales exactas desde tu proyecto de Supabase
- El `SUPABASE_SERVICE_ROLE_KEY` es sensible - nunca lo expongas en el cliente
- Puedes obtener todas estas claves en: Supabase Dashboard > Settings > API

3. Marca todas como disponibles en los tres entornos:
   - Production ✅
   - Preview ✅
   - Development ✅

## Paso 4: Configuración de Build

Vercel debería detectar automáticamente:

- **Framework Preset**: Astro
- **Build Command**: `pnpm build` o `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `pnpm install` o `npm install`

Si usas Windows con WSL (como en este proyecto), puede que necesites ajustar los comandos en `vercel.json`.

## Paso 5: Desplegar

1. Haz clic en **Deploy**
2. Vercel construirá y desplegará tu aplicación
3. Una vez completado, recibirás una URL como: `https://tu-proyecto.vercel.app`

## Paso 6: Migrar las Recetas (Primera vez)

Después del primer despliegue, necesitas migrar tus recetas de Markdown a Supabase:

1. Ve a: `https://tu-proyecto.vercel.app/api/migrate`
2. Usa un cliente REST (Postman, Insomnia, o curl):

```bash
curl -X POST https://tu-proyecto.vercel.app/api/migrate \
  -H "Content-Type: application/json" \
  -d '{"password": "tu-password-para-migracion"}'
```

3. Deberías recibir una respuesta exitosa con el número de recetas migradas
4. Verifica en tu dashboard de Supabase que las recetas se hayan insertado

## Paso 7: Acceder al Panel Admin

1. Ve a: `https://tu-proyecto.vercel.app/admin/login`
2. Inicia sesión con las credenciales del usuario que creaste en Supabase Auth
3. ¡Ahora puedes gestionar tus recetas!

## Configuración de Dominio Personalizado (Opcional)

1. En Vercel Dashboard, ve a **Settings** > **Domains**
2. Añade tu dominio personalizado (ej: `recetas.tudominio.com`)
3. Sigue las instrucciones para configurar los DNS

## Actualizaciones Futuras

Cada vez que hagas push a tu rama principal:

```bash
git add .
git commit -m "Actualizar recetas"
git push origin main
```

Vercel automáticamente:
1. Detectará el cambio
2. Construirá la nueva versión
3. La desplegará en producción

## Verificar que Todo Funciona

✅ Página principal muestra las recetas desde Supabase
✅ Puedes navegar a recetas individuales
✅ El buscador funciona
✅ Puedes acceder a `/admin/login`
✅ Después de iniciar sesión, ves el panel admin
✅ Puedes crear, editar y eliminar recetas

## Solución de Problemas Comunes

### Error: "Supabase credentials not found"

- Verifica que las variables de entorno estén configuradas en Vercel
- Asegúrate de que empiecen con `PUBLIC_` las que son públicas
- Redespliega después de añadir las variables

### Error 401 en el panel admin

- Verifica que el usuario existe en Supabase Auth
- Confirma que las políticas RLS estén activadas
- Revisa que el middleware esté configurado correctamente

### Las recetas no aparecen

- Ejecuta la migración si es la primera vez
- Verifica en Supabase que las recetas existen en la tabla
- Revisa los logs de Vercel para errores de query

### Error de build

- Verifica que todas las dependencias estén en `package.json`
- Asegúrate de que TypeScript no tenga errores
- Revisa los logs de build en Vercel Dashboard

## Monitoreo y Logs

Para ver los logs de tu aplicación:

1. Ve al Dashboard de Vercel
2. Selecciona tu proyecto
3. Ve a **Deployments** > selecciona un deployment
4. Haz clic en **View Function Logs**

## Seguridad

✅ Las credenciales están en variables de entorno
✅ RLS está activado en Supabase
✅ El middleware protege las rutas admin
✅ HTTPS está habilitado automáticamente por Vercel
✅ Las API routes validan autenticación

## Recursos Adicionales

- [Documentación de Astro](https://docs.astro.build)
- [Documentación de Vercel](https://vercel.com/docs)
- [Documentación de Supabase](https://supabase.com/docs)
- [Guía de Astro + Vercel](https://docs.astro.build/en/guides/deploy/vercel/)

## Soporte

Si encuentras problemas:

1. Revisa los logs en Vercel Dashboard
2. Verifica los logs en Supabase Dashboard > Logs
3. Consulta la documentación de cada servicio
4. Revisa que todas las variables de entorno estén correctas

---

¡Tu aplicación está lista para producción! 🎉

