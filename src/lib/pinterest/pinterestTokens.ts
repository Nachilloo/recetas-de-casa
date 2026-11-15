import { supabaseAdmin } from '../supabase';
import type { Database, PinterestOAuth, PinterestOAuthInsert } from '../types';

const ACCESS_REFRESH_MARGIN_MS = 5 * 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_MARGIN_MS = 14 * 24 * 60 * 60 * 1000;
const DEFAULT_ACCESS_TTL_MS = 25 * 24 * 60 * 60 * 1000;
const DEFAULT_REFRESH_TTL_MS = 50 * 24 * 60 * 60 * 1000;

export type StoredPinterestTokens = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date | null;
  scope: string | null;
  source: 'supabase' | 'env';
};

export type PinterestTokenGrant = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  refresh_token_expires_at?: number;
  scope?: string;
};

function envString(value: string | boolean | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

export function pinterestTokenRowId(): string {
  const v = envString(import.meta.env.PINTEREST_USE_SANDBOX).toLowerCase();
  const sandbox = v === '1' || v === 'true' || v === 'yes';
  return sandbox ? 'sandbox' : 'production';
}

function adminClient() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada: no se pueden persistir tokens de Pinterest');
  }
  return supabaseAdmin as import('@supabase/supabase-js').SupabaseClient<Database>;
}

function isMissingTable(message: string | undefined): boolean {
  const m = (message ?? '').toLowerCase();
  return m.includes('pinterest_oauth') && (m.includes('does not exist') || m.includes('schema cache') || m.includes('could not find'));
}

function rowToStored(row: PinterestOAuth): StoredPinterestTokens {
  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    accessExpiresAt: new Date(row.access_expires_at),
    refreshExpiresAt: row.refresh_expires_at ? new Date(row.refresh_expires_at) : null,
    scope: row.scope,
    source: 'supabase',
  };
}

export async function loadStoredPinterestTokens(): Promise<StoredPinterestTokens | null> {
  const client = adminClient();
  const { data, error } = await client
    .from('pinterest_oauth')
    .select('*')
    .eq('id', pinterestTokenRowId())
    .maybeSingle();

  if (error) {
    if (isMissingTable(error.message)) {
      throw new Error(
        'Falta la tabla public.pinterest_oauth. Ejecuta supabase/migrations/20261115_pinterest_oauth.sql en el SQL Editor de Supabase.',
      );
    }
    throw new Error(`No se pudieron leer tokens de Pinterest: ${error.message}`);
  }

  if (!data) return null;
  return rowToStored(data as PinterestOAuth);
}

export function tokensFromEnvFallback(): StoredPinterestTokens | null {
  const accessToken = envString(import.meta.env.PINTEREST_ACCESS_TOKEN);
  const refreshToken = envString(import.meta.env.PINTEREST_REFRESH_TOKEN);
  if (!accessToken || !refreshToken) return null;

  return {
    accessToken,
    refreshToken,
    accessExpiresAt: new Date(Date.now() - 60_000),
    refreshExpiresAt: new Date(Date.now() + DEFAULT_REFRESH_TTL_MS),
    scope: null,
    source: 'env',
  };
}

export async function saveStoredPinterestTokens(input: {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date | null;
  scope?: string | null;
}): Promise<void> {
  const client = adminClient();
  const row: PinterestOAuthInsert = {
    id: pinterestTokenRowId(),
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    access_expires_at: input.accessExpiresAt.toISOString(),
    refresh_expires_at: input.refreshExpiresAt?.toISOString() ?? null,
    scope: input.scope ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client
    .from('pinterest_oauth')
    // @ts-expect-error — el cliente infiere insert como never, igual que pin_history
    .upsert([row], { onConflict: 'id' });
  if (error) {
    if (isMissingTable(error.message)) {
      throw new Error(
        'Falta la tabla public.pinterest_oauth. Ejecuta supabase/migrations/20261115_pinterest_oauth.sql en el SQL Editor de Supabase.',
      );
    }
    throw new Error(`No se pudieron guardar tokens de Pinterest: ${error.message}`);
  }
}

export function grantToStored(
  grant: PinterestTokenGrant,
  previous?: StoredPinterestTokens | null,
): StoredPinterestTokens {
  const now = Date.now();
  const accessTtl = (grant.expires_in ?? 2592000) * 1000;
  let refreshExpiresAt: Date | null = previous?.refreshExpiresAt ?? new Date(now + DEFAULT_REFRESH_TTL_MS);

  if (typeof grant.refresh_token_expires_at === 'number' && grant.refresh_token_expires_at > 0) {
    refreshExpiresAt = new Date(grant.refresh_token_expires_at * 1000);
  } else if (typeof grant.refresh_token_expires_in === 'number' && grant.refresh_token_expires_in > 0) {
    refreshExpiresAt = new Date(now + grant.refresh_token_expires_in * 1000);
  }

  return {
    accessToken: grant.access_token,
    refreshToken: grant.refresh_token ?? previous?.refreshToken ?? '',
    accessExpiresAt: new Date(now + accessTtl),
    refreshExpiresAt,
    scope: grant.scope ?? previous?.scope ?? null,
    source: 'supabase',
  };
}

export function shouldRefreshTokens(tokens: StoredPinterestTokens): boolean {
  const now = Date.now();
  if (tokens.accessExpiresAt.getTime() - now < ACCESS_REFRESH_MARGIN_MS) return true;
  if (tokens.refreshExpiresAt && tokens.refreshExpiresAt.getTime() - now < REFRESH_TOKEN_MARGIN_MS) {
    return true;
  }
  return false;
}

export async function persistGrant(
  grant: PinterestTokenGrant,
  previous?: StoredPinterestTokens | null,
): Promise<StoredPinterestTokens> {
  const stored = grantToStored(grant, previous);
  if (!stored.refreshToken) {
    throw new Error('Pinterest no devolvió refresh_token y no hay uno previo que conservar');
  }
  await saveStoredPinterestTokens(stored);
  return stored;
}

export function envTokensAsConservativeGrant(): PinterestTokenGrant | null {
  const accessToken = envString(import.meta.env.PINTEREST_ACCESS_TOKEN);
  const refreshToken = envString(import.meta.env.PINTEREST_REFRESH_TOKEN);
  if (!accessToken || !refreshToken) return null;
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: Math.floor(DEFAULT_ACCESS_TTL_MS / 1000),
    refresh_token_expires_in: Math.floor(DEFAULT_REFRESH_TTL_MS / 1000),
  };
}
