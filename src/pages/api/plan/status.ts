import type { APIRoute } from 'astro';
import { computePlanStatus } from '../../../lib/plan';
import { createServerClient } from '../../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  const client = await createServerClient(cookies);
  const { data: userData } = await client.auth.getUser();
  const user = userData.user;

  if (!user) {
    return new Response(
      JSON.stringify({
        loggedIn: false,
        plan: 'free',
        trialActive: false,
        trialUsed: false,
        canGenerateMenu: false,
        menuCooldownUntil: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { data: profile } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  const status = await computePlanStatus(cookies, profile, user.id);

  return new Response(
    JSON.stringify({ loggedIn: true, ...status }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
