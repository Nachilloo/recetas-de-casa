import type { AstroCookies } from 'astro';
import type { Plan, PlanStatus, Profile } from './types';
import { supabaseAdmin, createServerClient } from './supabase';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const FREE_COOLDOWN_DAYS = 60;

/**
 * Estado de plan + cuota IA del visitante actual.
 * El trial promocional ya no existe: solo cuenta `free` y `pro` para permisos.
 */
export async function computePlanStatus(
  cookies: AstroCookies,
  profile: Profile | null,
  userId: string | null
): Promise<PlanStatus> {
  if (!profile || !userId) {
    return {
      plan: 'free',
      trialActive: false,
      trialDaysLeft: null,
      trialUsed: false,
      canGenerateMenu: false,
      menuCooldownUntil: null,
    };
  }

  const effectivePlan: Plan = profile.plan === 'pro' ? 'pro' : 'free';

  if (effectivePlan === 'pro') {
    return {
      plan: 'pro',
      trialActive: false,
      trialDaysLeft: null,
      trialUsed: false,
      canGenerateMenu: true,
      menuCooldownUntil: null,
    };
  }

  const client = await createServerClient(cookies);
  const { data: lastUse } = (await client
    .from('menu_usage')
    .select('used_at')
    .eq('user_id', userId)
    .order('used_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { used_at: string } | null };

  const now = new Date();
  if (!lastUse) {
    return {
      plan: 'free',
      trialActive: false,
      trialDaysLeft: null,
      trialUsed: false,
      canGenerateMenu: true,
      menuCooldownUntil: null,
    };
  }

  const lastUseDate = new Date(lastUse.used_at);
  const cooldownEnd = new Date(lastUseDate.getTime() + FREE_COOLDOWN_DAYS * MS_PER_DAY);
  const canGenerate = cooldownEnd <= now;

  return {
    plan: 'free',
    trialActive: false,
    trialDaysLeft: null,
    trialUsed: false,
    canGenerateMenu: canGenerate,
    menuCooldownUntil: canGenerate ? null : cooldownEnd.toISOString(),
  };
}

/**
 * Registra un uso del generador de menú IA. SOLO desde el servidor.
 * Requiere SUPABASE_SERVICE_ROLE_KEY para bypassear RLS de menu_usage.
 */
export async function recordMenuUsage(userId: string, plan: Plan): Promise<void> {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada; no se puede registrar uso.');
  }
  const { error } = await (supabaseAdmin as any).from('menu_usage').insert({
    user_id: userId,
    plan_at_time: plan,
  });
  if (error) throw error;
}
