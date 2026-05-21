/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { User } from '@supabase/supabase-js';
import type { Profile } from './lib/types';

declare global {
  interface Window {
    limpiarCategoria: () => void;
    limpiarBusqueda: () => void;
  }

  namespace App {
    interface Locals {
      /** Usuario autenticado (Supabase). null si visitante anónimo. */
      user: User | null;
      /** Profile correspondiente al user. null si visitante o si no se ha creado todavía. */
      profile: Profile | null;
    }
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  readonly OPENAI_API_KEY?: string;
  readonly STRIPE_SECRET_KEY?: string;
  readonly STRIPE_WEBHOOK_SECRET?: string;
  readonly PUBLIC_STRIPE_PRICE_MONTHLY?: string;
  readonly PUBLIC_STRIPE_PRICE_YEARLY?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly CRON_SECRET?: string;
  readonly PINTEREST_ACCESS_TOKEN?: string;
  readonly PINTEREST_REFRESH_TOKEN?: string;
  readonly PINTEREST_BOARD_ID?: string;
  readonly PINTEREST_APP_ID?: string;
  readonly PINTEREST_APP_SECRET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
