# Recetas de Casa — Design system (premium)

Documento vivo para alinear UI, implementación (Astro + Tailwind v4) y futuras capas de producto (cuentas, suscripciones). Objetivo: **calidez editorial** y **confianza**, no “plantilla genérica”.

---

## 1. Principios

1. **Legibilidad primero** — Recetas largas, listas, tiempos. Contraste y tamaño de cuerpo no negociables.
2. **Menos adorno, más jerarquía** — Premium = pocas superficies competidoras; sombras y color de acento con función.
3. **Una voz visual** — Misma familia tipográfica y mismos radios en todo el sitio; evitar “cada página un estilo”.
4. **Iconografía mínima** — Preferir SVG monocromo (16–24px, stroke 1.5–2) frente a emojis en chrome (header, cards, filtros). Reservar símbolos decorativos solo donde aporten cámara (hero ocasional).
5. **Estados explícitos** — Hover, focus visible, vacío, error, **cargando**; preparado para **invitado vs sesión iniciada vs suscriptor** (ver §8).

---

## 2. Marca y tono visual

- **Sensación**: cocina casera española, seria pero cercana; sitio de referencia, no blog amateur.
- **Evitar**: gradientes llamativos en bloques grandes, bordes “juguete”, demasiados badges simultáneos.
- **Referencia de inspiración (externa)**: explorar [Refero Styles](https://styles.refero.design/) para mood “editorial / warm minimal” y extraer *tokens* (no copiar marca ajena).

---

## 3. Color (tokens sugeridos)

Implementación futura recomendada: variables en `:root` o `@theme` de Tailwind v4 y uso semántico en componentes.

| Token | Uso |
|--------|-----|
| `--surface-base` | Fondo principal (blanco roto ~ `#FAFAF8` o similar) |
| `--surface-raised` | Cards (blanco `#FFFFFF`) |
| `--text-primary` | Texto principal ~ `#171717` |
| `--text-secondary` | Metadatos ~ `#525252` |
| `--text-muted` | Placeholders, pies ~ `#737373` |
| `--border-subtle` | `#E5E5E5` |
| `--accent` | Acento principal (terracota / arcilla, **no** naranja puro competidor con fotos de comida) — ej. `#B45309` o familia tipo `oklch` afinada |
| `--accent-hover` | Ligeramente más oscuro |
| `--accent-muted` | Fondos de chip/tag muy suaves |
| `--danger` | Errores formularios / paywall denegado |
| `--success` | Confirmaciones puntuales (no abusar) |

**Regla**: El acento en **una acción primaria** por vista (CTA principal). Secundarios en outline o ghost.

---

## 4. Tipografía

| Rol | Sugerencia | Notas |
|-----|-------------|--------|
| Display / H1–H2 (opcional) | Una serif humanista o “soft” compatible con castellano (ej. **Fraunces**, **Source Serif 4**, **Libre Baskerville**) | Carga solo 2 pesos (600–700 + 400). |
| UI / cuerpo | Sans neotr Grotesk (ej. **DM Sans**, **Source Sans 3**, **Inter**) | 400 / 500 / 600; **mínimo 16px** cuerpo en móvil. |
| Receta (prose) | Misma sans o serif según prueba A/B; priorizar interlineado **1.65–1.75**. | `@tailwindcss/typography` ya instalado: classes `prose` con overrides de color y `max-width` lectura. |

**Escala modular** (orientativa, a afinar en `rem`):

- H1: `clamp(1.875rem, 1.5rem + 1.5vw, 2.75rem)`
- H2: `clamp(1.5rem, 1.25rem + 1vw, 2rem)`
- Cuerpo: `1rem` base, `leading-relaxed` en fichas de receta.

---

## 5. Espaciado y layout

- **Contenedor lectura**: `max-w-prose` o ~65ch para intro / texto largo.
- **Grid recetas**: `gap-8` a `gap-10`; respiración entre tarjetas > densidad.
- **Secciones verticales**: múltiplos de `8` o `12` (p. ej. `py-16` / `py-20` en landings).
- **Radio**: **consistente** — elegir uno (p. ej. `rounded-xl` para cards, `rounded-lg` para inputs) y no mezclar `rounded-2xl` salvo hero.

---

## 6. Elevación y bordes

- Cards premium: **borde sutil** (`border border-[token]`) + sombra **muy suave** (`shadow-sm`) o solo borde sin sombra.
- Hover: `translate-y` máximo **1–2px** o solo cambio de borde/sombra; evitar “salto” exagerado.

---

## 7. Componentes (contrato UI)

### 7.1 Cabecera global

- Logo + **navegación primaria** horizontal (desktop); menú hamburguesa accesible (móvil).
- Enlaces mínimos sugeridos: Inicio, Recetas, Buscar, **Ideas** (dropdown o mega simple: fáciles / cenas / pollo / baratas), Menú semanal (con indicador *Pro* cuando aplique).
- Zona derecha: **Iniciar sesión** / Avatar cuando exista auth.

### 7.2 Botones

- **Primary**: fondo `--accent`, texto blanco o crema, focus ring visible.
- **Secondary**: borde `--accent`, texto `--accent`, fondo transparente.
- **Ghost**: solo texto/con icono, para terciarias.

### 7.3 Tarjeta de receta

- Imagen ratio fijo (aspecto 4/3 o 16/10); tipografía título **una sola familia** y peso fuerte.
- Metadatos en línea: tiempo · porciones · dificultad (texto o pills discretos, no competir con título).
- Sin emojis en título de card salvo decisión explícita de marca.

### 7.4 Formularios (login / registro futuro)

- Labels siempre visibles; errores bajo campo; `autocomplete` correcto.
- Botón submit ancho completo en móvil.
- Política de contraseña y **enlace legal** (privacidad / términos) antes de lanzar cobro.

### 7.5 Paywall / feature bloqueada (futuro)

- Patrón: página o overlay claro: qué gana el usuario, precio estimado, CTA “Crear cuenta / Suscribirse”, sin oscurecer toda la web.
- Mantener **SEO y recetas públicas**; el muro solo donde el valor de pago está (p. ej. generador de menú).

---

## 8. Producto: invitado · registrado · suscriptor

Estados a diseñar **antes** de implementar cobro:

| Estado | Comportamiento UI |
|--------|-------------------|
| Invitado | Navegación completa de recetas; menú semanal / IA con CTA a registro o vista demo limitada (opcional). |
| Sesión sin plan | Acceso a perfil básico; features de pago con banner “Activa tu plan”. |
| Suscripción activa | Menú inteligente completo; posible badge “Pro” discreto en avatar; sin ruido en cada pantalla. |

**Convención**: Un solo término en UI (“Suscripción”, “Plan Pro”, “Plus”) y mantenerlo en header, emails y Stripe.

---

## 9. Accesibilidad y rendimiento

- Contraste **WCAG AA** mínimo en texto y botones.
- Focus visible en todos los interactuables (`:focus-visible`).
- Imágenes: `alt` descriptivo; lazy fuera del LCP.
- Evitar fondos tipo “subtexto” que no lean lectores de pantalla; usar `aria` en acordeones FAQ.

---

## 10. Implementación técnica (checklist)

- [x] Font loading: `display=swap` (Google Fonts en `global.css`).
- [x] Centralizar tokens (`@theme` en `global.css`).
- [x] `Header` + `Footer` con mapa de enlaces (Fase B).
- [x] Tokens duales claro / oscuro (Fase C — ver §12).
- [x] Header con toggle de tema (auto / claro / oscuro) y zona auth.
- [x] Landing reescrito sin emojis chrome, hero editorial sin overlay negro.
- [x] Páginas `/login`, `/registro`, `/precios` (UI estática).
- [x] `RecetaCard`, `RecetaCardCompact`, listado y detalle de receta migrados a tokens.
- [x] Auth real (Supabase email + Google OAuth) + UserMenu en header (Fase D).
- [x] Sistema de favoritos + colecciones + perfil público `/u/[username]` (Fase D).
- [x] Gating del menú IA: cuota free 1 generación / 2 meses, opciones avanzadas solo plan Pro (Fase D).
- [x] Stripe Checkout + webhook + billing portal (Fase D — requiere `pnpm add stripe`).
- [x] Páginas `/terminos` y `/privacidad` (Fase D).
- [ ] Limpiar Tailwind crudo restante en `/admin/*` (fuera del recetario público).

---

## 11. Changelog

| Fecha | Cambio |
|-------|--------|
| (inicial) | Versión 1.0 — dirección premium + preparación suscripciones / menú |
| Fase A+B | Tokens `@theme` + DM Sans / Fraunces; Header con nav completa + menú móvil; `Footer`; `Layout` con `hideFooter` en `/admin`; `theme-color` acorde |
| Fase C | Dark mode con auto + toggle 3 estados, anti-flash inline, landing editorial sin emoji, auth UI placeholder, página `/precios`, RecetaCard rediseñada |
| Fase D | Sistema de usuarios (Supabase Auth + Google OAuth), favoritos + colecciones + perfil público `/u/[username]`, gating del menú IA con cuota free 1/2 meses, opciones avanzadas (aprovechamiento / temporada) y onboarding (alergias / dieta) en el propio formulario del generador, Stripe Checkout + webhook + portal, `/terminos` y `/privacidad`. |
| Post-Fase D | Retirado trial Pro 10 días sin tarjeta: `/api/trial/start` responde 410; migración `20260516120000` pasa perfiles `trial` → `free`. Pro solo vía suscripción. |

---

## 12. Dark mode tokens

Implementación en `src/styles/global.css`. Estrategia:

1. `@theme` define la paleta clara como base (también es la fallback si JS está desactivado).
2. `[data-theme="dark"]` redefine variables CSS para el modo oscuro y fija `color-scheme: dark`.
3. `@media (prefers-color-scheme: dark)` aplica los mismos overrides cuando el usuario **no** ha forzado un valor (`:root:not([data-theme="light"]):not([data-theme="dark"])`), respetando la preferencia del SO.
4. `Layout.astro` lleva un `<script is:inline>` en `<head>` que lee `localStorage.theme` y aplica el atributo antes del primer paint, evitando flash blanco.
5. `<meta name="theme-color">` con dos versiones (light / dark) para Safari / Android.
6. `Header.astro` tiene un único botón de tema que cicla `auto → light → dark → auto` y guarda la preferencia en `localStorage`. Iconos visibles según el estado vía clases utilitarias (`.theme-icon-auto/light/dark`).

| Token | Light | Dark |
|-------|-------|------|
| `--color-canvas` | `#fafaf8` | `#0f0f0e` |
| `--color-surface` | `#ffffff` | `#1a1a18` |
| `--color-surface-raised` | `#ffffff` | `#1f1f1d` |
| `--color-fg` | `#171717` | `#f5f4f1` |
| `--color-fg-muted` | `#525252` | `#a3a3a0` |
| `--color-fg-subtle` | `#737373` | `#78787a` |
| `--color-border` | `#e5e5e5` | `#2a2a27` |
| `--color-border-strong` | `#d4d4d4` | `#3a3a37` |
| `--color-accent` | `#b45309` | `#d97706` |
| `--color-accent-hover` | `#92400e` | `#f59e0b` |
| `--color-accent-soft` | `#fff7ed` | `#2a1d10` |
| `--color-accent-contrast` | `#ffffff` | `#1a1208` |

**Regla**: en componentes nuevos, **prohibido** usar `bg-white`, `text-gray-*`, `border-gray-*`, `bg-orange-*`. Usar siempre tokens (`bg-canvas`, `bg-surface`, `text-fg`, `text-fg-muted`, `border-border`, `bg-accent`, `text-accent`, `bg-accent-soft`).

Radios unificados: `--radius-sm` (6 px), `--radius` (10 px), `--radius-lg` (14 px) y `--radius-pill` (999 px). En cards y formularios usar `--radius-lg`; en botones e inputs `--radius`; pills siguen siendo `rounded-full`.

---

## 13. Sistema de usuarios y planes (implementado)

### Estados

| Estado | Comportamiento |
|--------|----------------|
| Invitado | Navegación completa de recetas; botón ♥ pide login; menú IA pide registro. |
| Free | Favoritos y colecciones ilimitados; 1 generación de menú IA cada 2 meses; sin aprovechamiento ni temporada. |
| ~~Trial~~ (retirado) | Los perfiles que quedaran en `trial` en BD pasan a `free` vía migración; el producto ya no ofrece prueba sin tarjeta. El valor `trial` en enum queda solo por compatibilidad SQL. |
| Pro | Generaciones ilimitadas, aprovechamiento, temporada, lista exportable, badge `Pro` en avatar. |

### Header

- Invitado: `Iniciar sesión` + `Crear cuenta`.
- Sesión: `<UserMenu>` con avatar, badge `Pro` si aplica. Items: Mis favoritos, Mis colecciones, Cuenta, Plan, Cerrar sesión.

### Rutas (Fase D)

- Auth API: `/api/auth/{signup,login,logout,google,callback}`.
- Favoritos / colecciones / perfil: `/api/{favoritos,colecciones/[id],profile}`.
- Plan e IA: `/api/plan/status`, `/api/menu/generar` (gating 401/402 + cuota).
- `/api/trial/start` deshabilitado (410; el trial gratuito ya no se ofrece).
- Stripe: `/api/stripe/{checkout,portal,webhook}`. Lazy via `src/lib/stripe.ts` (la dependencia `stripe` solo se carga si está instalada y `STRIPE_SECRET_KEY` configurada).
- Páginas: `/perfil/{favoritos,colecciones,cuenta,plan}` (privadas, gated en middleware) y `/u/[username]` (perfil público SEO-friendly, gated por `is_public`).

### Esquema de datos

Migración `20260511120000_users_favoritos_planes.sql` añade:

- `profiles` (1:1 con `auth.users`) — username, display_name, bio, avatar_url, is_public, plan (`free|trial|pro`), trial_*, stripe_*.
- `favoritos` (composite PK `user_id` + `receta_slug`).
- `colecciones` (id, user_id, nombre, slugs[], is_public).
- `menu_usage` (cada generación de menú IA registrada por usuario; el endpoint comprueba cuota leyendo `max(used_at)` y compara con 60 días).

RLS: profiles SELECT abierto (necesario para `/u/<username>`), UPDATE solo propio y SIN tocar plan/trial/stripe (eso lo escribe service_role desde endpoints). Favoritos privados por defecto (los públicos los leemos en `/u/[username]` con service_role). Colecciones públicas se ven sin sesión.

Trigger `on_auth_user_created` crea automáticamente el profile con `plan='free'` al registrarse.

### Variables de entorno necesarias

```
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      # API routes privilegiadas: Stripe webhook, escritura de planes, favoritos públicos `/u/[username]`
OPENAI_API_KEY                 # menú IA
STRIPE_SECRET_KEY              # opcional hasta activar cobro
STRIPE_WEBHOOK_SECRET
PUBLIC_STRIPE_PRICE_MONTHLY
PUBLIC_STRIPE_PRICE_YEARLY
PUBLIC_SITE_URL                # ej. https://recetasdecasa.es
```

---

*Este archivo debe actualizarse cuando se cierren tokens finales, familia tipográfica y nombre comercial del Plan de pago.*
