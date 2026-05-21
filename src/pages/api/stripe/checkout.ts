import type { APIRoute } from 'astro';
import { createServerClient, supabaseAdmin } from '../../../lib/supabase';
import { getStripe } from '../../../lib/stripe';

export const prerender = false;

/**
 * POST { period: 'monthly' | 'yearly' }
 *
 * Crea una sesión de Stripe Checkout para suscribir al usuario actual al Plan Pro.
 * Devuelve { url } al que el cliente debe redirigir.
 *
 * Requiere:
 *   - STRIPE_SECRET_KEY
 *   - PUBLIC_STRIPE_PRICE_MONTHLY  (price_... mensual)
 *   - PUBLIC_STRIPE_PRICE_YEARLY   (price_... anual)
 *   - PUBLIC_SITE_URL              (https://www.recetasdecasa.es)
 */
export const POST: APIRoute = async ({ cookies, request }) => {
  const stripe = await getStripe();
  if (!stripe) {
    return json(
      { error: 'Stripe no está configurado todavía. Vuelve más tarde.' },
      503
    );
  }

  const client = await createServerClient(cookies);
  const { data: userData } = await client.auth.getUser();
  const user = userData.user;
  if (!user || !user.email) return json({ error: 'No autenticado' }, 401);

  const body = await request.json().catch(() => ({}));
  const period = body.period === 'yearly' ? 'yearly' : 'monthly';

  const priceId =
    period === 'yearly'
      ? import.meta.env.PUBLIC_STRIPE_PRICE_YEARLY
      : import.meta.env.PUBLIC_STRIPE_PRICE_MONTHLY;

  if (!priceId) {
    return json({ error: `Falta PUBLIC_STRIPE_PRICE_${period.toUpperCase()} en .env` }, 500);
  }

  const siteUrl = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;

  // Recuperar customer_id si ya existe
  let stripeCustomerId: string | null = null;
  if (supabaseAdmin) {
    const { data: profile } = (await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle()) as { data: { stripe_customer_id: string | null } | null };
    stripeCustomerId = profile?.stripe_customer_id ?? null;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId ?? undefined,
      customer_email: stripeCustomerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/perfil/plan?status=success`,
      cancel_url: `${siteUrl}/precios?status=cancel`,
      allow_promotion_codes: true,
      client_reference_id: user.id,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      metadata: { supabase_user_id: user.id },
    });

    if (!session.url) return json({ error: 'No se generó URL' }, 500);
    return json({ url: session.url });
  } catch (err) {
    console.error('[stripe/checkout]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Error con Stripe' },
      500
    );
  }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
