import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { getStripe } from '../../../lib/stripe';

export const prerender = false;

/**
 * Webhook de Stripe.
 *
 * Eventos manejados:
 *   - checkout.session.completed  → marcar plan='pro', guardar customer/sub IDs.
 *   - customer.subscription.updated → actualizar pro_renews_at, plan según status.
 *   - customer.subscription.deleted → degradar a plan='free'.
 *   - invoice.payment_failed → (opcional) marcar warning; no degradamos inmediato.
 *
 * Configuración requerida:
 *   - Stripe Dashboard → Developers → Webhooks → Add endpoint:
 *       https://<dominio>/api/stripe/webhook
 *       Eventos: checkout.session.completed,
 *                customer.subscription.updated,
 *                customer.subscription.deleted,
 *                invoice.payment_failed
 *   - Copiar el "Signing secret" → STRIPE_WEBHOOK_SECRET en .env
 */
export const POST: APIRoute = async ({ request }) => {
  const stripe = await getStripe();
  if (!stripe) return new Response('Stripe no configurado', { status: 503 });
  if (!supabaseAdmin) return new Response('Service role no configurado', { status: 500 });

  const sig = request.headers.get('stripe-signature');
  const secret = import.meta.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new Response('Falta firma', { status: 400 });

  const raw = await request.text();

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error('[stripe/webhook] firma inválida:', err);
    return new Response('Firma inválida', { status: 400 });
  }

  const admin = supabaseAdmin as any;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        const userId: string | undefined =
          s.client_reference_id || s.metadata?.supabase_user_id;
        if (!userId) break;
        await admin
          .from('profiles')
          .update({
            plan: 'pro',
            stripe_customer_id: typeof s.customer === 'string' ? s.customer : s.customer?.id,
            stripe_subscription_id:
              typeof s.subscription === 'string' ? s.subscription : s.subscription?.id,
          })
          .eq('id', userId);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const userId: string | undefined = sub.metadata?.supabase_user_id;
        if (!userId) break;
        const renewsAt = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        const activePlans = ['active', 'trialing'];
        await admin
          .from('profiles')
          .update({
            plan: activePlans.includes(sub.status) ? 'pro' : 'free',
            pro_renews_at: renewsAt,
            stripe_subscription_id: sub.id,
          })
          .eq('id', userId);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const userId: string | undefined = sub.metadata?.supabase_user_id;
        if (!userId) break;
        await admin
          .from('profiles')
          .update({ plan: 'free', pro_renews_at: null, stripe_subscription_id: null })
          .eq('id', userId);
        break;
      }

      default:
        // Ignoramos el resto
        break;
    }
  } catch (err) {
    console.error('[stripe/webhook] error procesando', event.type, err);
    return new Response('Error procesando', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
