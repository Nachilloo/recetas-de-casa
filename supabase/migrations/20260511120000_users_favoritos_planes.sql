-- Sistema de usuarios + favoritos + planes (Free / Trial / Pro) + cuota IA.
-- Aplicar en Supabase SQL Editor. Idempotente con IF NOT EXISTS donde es posible.

------------------------------------------------------------
-- 1. profiles: una fila por cada auth.users
------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique
    check (username is null or username ~ '^[a-z0-9][a-z0-9-]{2,29}$'),
  display_name text,
  avatar_url text,
  bio text,
  is_public boolean not null default false,
  plan text not null default 'free'
    check (plan in ('free','trial','pro')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  trial_used_at timestamptz,
  pro_renews_at timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists profiles_plan_idx on public.profiles (plan);

------------------------------------------------------------
-- 2. favoritos: receta marcada por un usuario
------------------------------------------------------------
create table if not exists public.favoritos (
  user_id uuid not null references auth.users(id) on delete cascade,
  receta_slug text not null references public.recetas(slug) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, receta_slug)
);

create index if not exists favoritos_user_idx on public.favoritos (user_id);
create index if not exists favoritos_slug_idx on public.favoritos (receta_slug);

------------------------------------------------------------
-- 3. colecciones: agrupaciones propias de favoritos / recetas
------------------------------------------------------------
create table if not exists public.colecciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  descripcion text,
  slugs text[] not null default '{}',
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists colecciones_user_idx on public.colecciones (user_id);

------------------------------------------------------------
-- 4. menu_usage: registro de cada generación de menú IA por usuario.
-- Lo usamos para aplicar la cuota Free: 1 generación con caducidad 2 meses.
------------------------------------------------------------
create table if not exists public.menu_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  used_at timestamptz not null default now(),
  plan_at_time text not null check (plan_at_time in ('free','trial','pro'))
);

create index if not exists menu_usage_user_idx on public.menu_usage (user_id, used_at desc);

------------------------------------------------------------
-- 5. updated_at automático
------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists colecciones_updated_at on public.colecciones;
create trigger colecciones_updated_at
  before update on public.colecciones
  for each row execute function public.touch_updated_at();

------------------------------------------------------------
-- 6. Crear profile automáticamente cuando se registra un auth.users
------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------
-- 7. Row Level Security
------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.favoritos enable row level security;
alter table public.colecciones enable row level security;
alter table public.menu_usage enable row level security;

-- profiles: cualquiera puede leer (necesario para perfil público /u/<username>),
-- solo el propio usuario puede actualizar campos no sensibles.
-- El plan, trial_* y stripe_* SOLO los toca el service_role desde el servidor.
drop policy if exists "profiles select all" on public.profiles;
create policy "profiles select all"
  on public.profiles for select
  using (true);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- No permitir que el usuario se autoasigne plan/trial/stripe desde el cliente
    and plan = (select plan from public.profiles where id = auth.uid())
    and trial_started_at is not distinct from (select trial_started_at from public.profiles where id = auth.uid())
    and trial_ends_at is not distinct from (select trial_ends_at from public.profiles where id = auth.uid())
    and trial_used_at is not distinct from (select trial_used_at from public.profiles where id = auth.uid())
    and stripe_customer_id is not distinct from (select stripe_customer_id from public.profiles where id = auth.uid())
    and stripe_subscription_id is not distinct from (select stripe_subscription_id from public.profiles where id = auth.uid())
  );

-- favoritos: solo cada uno ve y gestiona los suyos.
-- Para mostrar favoritos en perfil público lo haremos vía endpoint con service_role.
drop policy if exists "favoritos all own" on public.favoritos;
create policy "favoritos all own"
  on public.favoritos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- colecciones: el dueño SIEMPRE; cualquiera puede ver las que tengan is_public = true.
drop policy if exists "colecciones select own or public" on public.colecciones;
create policy "colecciones select own or public"
  on public.colecciones for select
  using (auth.uid() = user_id or is_public = true);

drop policy if exists "colecciones write own" on public.colecciones;
create policy "colecciones write own"
  on public.colecciones for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- menu_usage: cada uno ve su propio uso; nadie inserta desde cliente
-- (lo hace el endpoint con service_role).
drop policy if exists "menu_usage select own" on public.menu_usage;
create policy "menu_usage select own"
  on public.menu_usage for select
  using (auth.uid() = user_id);

------------------------------------------------------------
-- 8. Función helper: ¿el usuario tiene cuota libre para generar?
-- Reglas:
--   - pro o trial activo (trial_ends_at > now()) → siempre true
--   - free → puede si tiene 0 usos en los últimos 60 días
------------------------------------------------------------
create or replace function public.puede_generar_menu(p_user_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  v_plan text;
  v_trial_ends timestamptz;
  v_ultimo_uso timestamptz;
begin
  select plan, trial_ends_at into v_plan, v_trial_ends
    from public.profiles where id = p_user_id;

  if v_plan is null then
    return false;
  end if;

  if v_plan = 'pro' then
    return true;
  end if;

  if v_plan = 'trial' and v_trial_ends > now() then
    return true;
  end if;

  -- plan free (o trial caducado, que se normaliza a free vía cron/webhook)
  select max(used_at) into v_ultimo_uso
    from public.menu_usage
    where user_id = p_user_id;

  return v_ultimo_uso is null or v_ultimo_uso < now() - interval '60 days';
end;
$$;
