import type { AstroCookies } from 'astro';
import type { Plan, PlanStatus, Profile } from './types';
import { supabaseAdmin, createServerClient } from './supabase';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const FREE_COOLDOWN_DAYS = 60;
const TRIAL_LENGTH_DAYS = 10;

/**
 * Sello máximo de vigencia del trial al activarlo (10 días desde ahora).
 */
export function computeTrialEnd(from: Date = new Date()): Date {
  return new Date(from.getTime() + TRIAL_LENGTH_DAYS * MS_PER_DAY);
}

/**
 * Estado de plan + cuota IA del visitante actual.
 * Visitante anónimo: plan='free', sin cuota (nunca ha generado).
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
      canGenerateMenu: false, // anónimo no genera; debe registrarse antes
      menuCooldownUntil: null,
    };
  }

  const now = new Date();
  const trialEnds = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
  const trialActive = profile.plan === 'trial' && !!trialEnds && trialEnds > now;

  const trialDaysLeft = trialEnds
    ? Math.ceil((trialEnds.getTime() - now.getTime()) / MS_PER_DAY)
    : null;

  const trialUsed = !!profile.trial_used_at;

  // Plan efectivo (si el trial caducó pero el campo plan sigue como 'trial' por
  // falta de cron/webhook, lo tratamos como free a efectos de gating).
  const effectivePlan: Plan =
    profile.plan === 'pro'
      ? 'pro'
      : profile.plan === 'trial' && trialActive
        ? 'trial'
        : 'free';

  if (effectivePlan === 'pro' || effectivePlan === 'trial') {
    return {
      plan: effectivePlan,
      trialActive,
      trialDaysLeft,
      trialUsed,
      canGenerateMenu: true,
      menuCooldownUntil: null,
    };
  }

  // Plan free → mirar último uso
  const client = await createServerClient(cookies);
  const { data: lastUse } = (await client
    .from('menu_usage')
    .select('used_at')
    .eq('user_id', userId)
    .order('used_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { used_at: string } | null };

  if (!lastUse) {
    return {
      plan: 'free',
      trialActive: false,
      trialDaysLeft,
      trialUsed,
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
    trialDaysLeft,
    trialUsed,
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
  // Cast a any: supabase-js 2.87 tiene problemas de inferencia con Database genérico.
  const { error } = await (supabaseAdmin as any).from('menu_usage').insert({
    user_id: userId,
    plan_at_time: plan,
  });
  if (error) throw error;
}
