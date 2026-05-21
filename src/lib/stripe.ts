/**
 * Carga perezosa de Stripe.
 * Si la dependencia no está instalada o STRIPE_SECRET_KEY no está configurada,
 * `getStripe()` devuelve null y los endpoints deben responder 503.
 *
 * Para activar Stripe:
 *   1. `pnpm add stripe`
 *   2. .env:
 *        STRIPE_SECRET_KEY=sk_live_...
 *        STRIPE_WEBHOOK_SECRET=whsec_...
 *        PUBLIC_STRIPE_PRICE_MONTHLY=price_...
 *        PUBLIC_STRIPE_PRICE_YEARLY=price_...
 *        PUBLIC_SITE_URL=https://www.recetasdecasa.es
 */

// Tipo mínimo que usamos en los endpoints; evita acoplarse al SDK
// cuando aún no está instalado.
export interface StripeLike {
  checkout: {
    sessions: {
      create: (params: Record<string, unknown>) => Promise<{ url?: string | null; id: string }>;
    };
  };
  billingPortal: {
    sessions: {
      create: (params: Record<string, unknown>) => Promise<{ url: string }>;
    };
  };
  webhooks: {
    constructEvent: (payload: string | Buffer, sig: string, secret: string) => unknown;
  };
  subscriptions: {
    retrieve: (id: string) => Promise<unknown>;
  };
}

let cached: StripeLike | null | undefined;

export async function getStripe(): Promise<StripeLike | null> {
  if (cached !== undefined) return cached;

  const key = import.meta.env.STRIPE_SECRET_KEY;
  if (!key) {
    cached = null;
    return null;
  }

  try {
    // Import dinámico: si la dependencia no está, devolvemos null sin romper el build.
    // El SDK 'stripe' es opcional; se evita el acople de tipos para que TS no rompa
    // cuando la dependencia no está instalada.
    // @ts-ignore -- la dependencia 'stripe' es opcional
    const mod: any = await import('stripe');
    const StripeCtor: any = mod.default ?? mod;
    cached = new StripeCtor(key, { apiVersion: '2024-06-20' }) as StripeLike;
    return cached;
  } catch (err) {
    console.error('[stripe] dependencia "stripe" no instalada. Ejecuta: pnpm add stripe');
    cached = null;
    return null;
  }
}

export const STRIPE_CONFIGURED = !!import.meta.env.STRIPE_SECRET_KEY;
