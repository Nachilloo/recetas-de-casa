import type { APIRoute } from 'astro';
import { createServerClient, supabaseAdmin } from '../../../lib/supabase';
import { getStripe } from '../../../lib/stripe';

export const prerender = false;

/**
 * Devuelve la URL del portal de facturación de Stripe del usuario actual.
 * Se usa desde /perfil/plan para que el suscriptor gestione su sub (cancelar, cambiar tarjeta).
 */
export const POST: APIRoute = async ({ cookies, request }) => {
  const stripe = await getStripe();
  if (!stripe) return json({ error: 'Stripe no configurado' }, 503);
  if (!supabaseAdmin) return json({ error: 'Service role no configurado' }, 500);

  const client = await createServerClient(cookies);
  const { data: userData } = await client.auth.getUser();
  const user = userData.user;
  if (!user) return json({ error: 'No autenticado' }, 401);

  const { data: profile } = (await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle()) as { data: { stripe_customer_id: string | null } | null };

  const stripeCustomerId = profile?.stripe_customer_id;
  if (!stripeCustomerId) {
    return json({ error: 'No hay suscripción activa' }, 400);
  }

  const siteUrl = import.meta.env.PUBLIC_SITE_URL || new URL(request.url).origin;

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${siteUrl}/perfil/plan`,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error('[stripe/portal]', err);
    return json(
      { error: err instanceof Error ? err.message : 'Error abriendo portal' },
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
