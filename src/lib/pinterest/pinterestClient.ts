import { formatPinDescription, formatPinTitle } from './pinCopy';
import { pinterestImageUrl, recipePageUrl } from './siteUrl';
import type { DailyRecipeCandidate } from './selectDailyRecipe';
import {
  loadStoredPinterestTokens,
  persistGrant,
  shouldRefreshTokens,
  tokensFromEnvFallback,
  type PinterestTokenGrant,
  type StoredPinterestTokens,
} from './pinterestTokens';

/** Vercel puede inyectar env vars como boolean o number, no solo string. */
function envString(value: string | boolean | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function isValidPinterestRefreshToken(token: string): boolean {
  return token.startsWith('pinr_') || token.startsWith('pinr.');
}

function useSandbox(): boolean {
  const v = envString(import.meta.env.PINTEREST_USE_SANDBOX).toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function getPinterestApiBase(): string {
  return useSandbox()
    ? 'https://api-sandbox.pinterest.com/v5'
    : 'https://api.pinterest.com/v5';
}

function getOAuthTokenUrl(): string {
  return `${getPinterestApiBase()}/oauth/token`;
}

export function getPinterestMode(): 'production' | 'sandbox' {
  return useSandbox() ? 'sandbox' : 'production';
}

export interface CreatePinInput {
  receta: DailyRecipeCandidate;
  siteUrl: string;
  boardId: string;
}

export interface CreatePinResult {
  id: string;
  link: string | null;
  title: string | null;
}

export class PinterestConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PinterestConfigError';
  }
}

export function getPinterestEnv() {
  const accessToken = envString(import.meta.env.PINTEREST_ACCESS_TOKEN);
  const refreshToken = envString(import.meta.env.PINTEREST_REFRESH_TOKEN);
  const boardId = envString(import.meta.env.PINTEREST_BOARD_ID);
  const appId = envString(import.meta.env.PINTEREST_APP_ID);
  const appSecret = envString(import.meta.env.PINTEREST_APP_SECRET);

  return { accessToken, refreshToken, boardId, appId, appSecret };
}

export function assertPinterestConfig(): {
  boardId: string;
  appId: string;
  appSecret: string;
} {
  const env = getPinterestEnv();
  const sandbox = useSandbox();
  const missing: string[] = [];
  if (!env.boardId) missing.push('PINTEREST_BOARD_ID');
  if (!sandbox && !env.appId) missing.push('PINTEREST_APP_ID');
  if (!sandbox && !env.appSecret) missing.push('PINTEREST_APP_SECRET');
  if (missing.length > 0) {
    throw new PinterestConfigError(`Missing Pinterest env: ${missing.join(', ')}`);
  }
  return {
    boardId: env.boardId!,
    appId: env.appId ?? '',
    appSecret: env.appSecret ?? '',
  };
}

function basicAuthHeader(appId: string, appSecret: string): string {
  const credentials = `${appId}:${appSecret}`;
  const basic =
    typeof Buffer !== 'undefined'
      ? Buffer.from(credentials).toString('base64')
      : btoa(credentials);
  return `Basic ${basic}`;
}

async function exchangeRefreshToken(refreshToken: string): Promise<PinterestTokenGrant> {
  const { appId, appSecret } = assertPinterestConfig();
  const res = await fetch(getOAuthTokenUrl(), {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(appId, appSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const json = (await res.json()) as PinterestTokenGrant & { message?: string };

  if (!res.ok || !json.access_token) {
    throw new Error(json.message ?? `Pinterest token refresh failed (${res.status})`);
  }

  return json;
}

async function resolveTokenBundle(): Promise<StoredPinterestTokens> {
  const stored = await loadStoredPinterestTokens();
  if (stored) return stored;

  const fromEnv = tokensFromEnvFallback();
  if (fromEnv) {
    await persistGrant(
      {
        access_token: fromEnv.accessToken,
        refresh_token: fromEnv.refreshToken,
        expires_in: 60,
        refresh_token_expires_in: Math.max(
          60,
          Math.floor(((fromEnv.refreshExpiresAt?.getTime() ?? Date.now()) - Date.now()) / 1000),
        ),
      },
      fromEnv,
    );
    return { ...fromEnv, accessExpiresAt: new Date(Date.now() - 60_000), source: 'supabase' };
  }

  throw new Error(
    'No hay tokens de Pinterest en Supabase ni en env. Ejecuta OAuth y POST /api/pinterest/seed-tokens',
  );
}

export async function refreshAndPersistTokens(
  current?: StoredPinterestTokens | null,
): Promise<StoredPinterestTokens> {
  const bundle = current ?? (await resolveTokenBundle());
  const grant = await exchangeRefreshToken(bundle.refreshToken);
  return persistGrant(grant, bundle);
}

export async function getValidAccessToken(forceRefresh = false): Promise<string> {
  if (useSandbox()) {
    const env = getPinterestEnv();
    if (!env.accessToken) {
      throw new PinterestConfigError('Missing Pinterest env: PINTEREST_ACCESS_TOKEN');
    }
    return env.accessToken;
  }

  let bundle = await resolveTokenBundle();

  if (forceRefresh || shouldRefreshTokens(bundle)) {
    bundle = await refreshAndPersistTokens(bundle);
  }

  return bundle.accessToken;
}

async function pinterestFetch(path: string, init: RequestInit, retry = true): Promise<Response> {
  const token = await getValidAccessToken();
  const res = await fetch(`${getPinterestApiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 && retry) {
    await getValidAccessToken(true);
    return pinterestFetch(path, init, false);
  }

  return res;
}

export async function createPinterestPin(input: CreatePinInput): Promise<CreatePinResult> {
  const { receta, siteUrl, boardId } = input;
  const title = formatPinTitle(receta);
  const description = formatPinDescription(receta);
  const link = recipePageUrl(siteUrl, receta.slug, true);
  const imageUrl = pinterestImageUrl(siteUrl, receta.slug);

  const body = {
    board_id: boardId,
    title,
    description,
    link,
    media_source: {
      source_type: 'image_url',
      url: imageUrl,
    },
  };

  const res = await pinterestFetch('/pins', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as CreatePinResult & { message?: string; code?: number };

  if (!res.ok) {
    const msg = json.message ?? `Pinterest create pin failed (${res.status})`;
    if (msg.includes('Trial access') && !useSandbox()) {
      throw new Error(
        `${msg} — Tu app está en Trial: pide Standard access en developers.pinterest.com o activa PINTEREST_USE_SANDBOX=true con token Sandbox.`,
      );
    }
    throw new Error(msg);
  }

  return {
    id: json.id,
    link: json.link ?? link,
    title: json.title ?? title,
  };
}

export type PinterestTokenCheck = {
  accessTokenPrefixOk: boolean;
  refreshTokenPrefixOk: boolean;
  refreshTokenIssue: string | null;
  accessTokenWorks: boolean;
  username: string | null;
  scopes: string | null;
  canWritePins: boolean;
  tokenSource: 'supabase' | 'env' | null;
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  error: string | null;
};

/** Verifica que los tokens OAuth sean reales (no el test de 24h) y funcionen. */
export async function verifyPinterestTokens(): Promise<PinterestTokenCheck> {
  const result: PinterestTokenCheck = {
    accessTokenPrefixOk: false,
    refreshTokenPrefixOk: false,
    refreshTokenIssue: null,
    accessTokenWorks: false,
    username: null,
    scopes: null,
    canWritePins: false,
    tokenSource: null,
    accessExpiresAt: null,
    refreshExpiresAt: null,
    error: null,
  };

  let bundle: StoredPinterestTokens | null = null;
  try {
    bundle = await resolveTokenBundle();
    if (shouldRefreshTokens(bundle)) {
      bundle = await refreshAndPersistTokens(bundle);
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'No se pudieron obtener tokens de Pinterest';
    const env = getPinterestEnv();
    result.accessTokenPrefixOk = env.accessToken.startsWith('pina_');
    result.refreshTokenPrefixOk = env.refreshToken ? isValidPinterestRefreshToken(env.refreshToken) : false;
    return result;
  }

  result.tokenSource = bundle.source;
  result.accessExpiresAt = bundle.accessExpiresAt.toISOString();
  result.refreshExpiresAt = bundle.refreshExpiresAt?.toISOString() ?? null;
  result.accessTokenPrefixOk = bundle.accessToken.startsWith('pina_');
  result.refreshTokenPrefixOk = isValidPinterestRefreshToken(bundle.refreshToken);
  result.scopes = bundle.scope;

  if (!result.accessTokenPrefixOk) {
    result.error =
      'El access token no empieza por pina_ — probablemente es el token de prueba de 24h, no OAuth real';
    return result;
  }

  if (!result.refreshTokenPrefixOk) {
    result.refreshTokenIssue =
      'El refresh token no tiene formato pinr_ o pinr. — repite OAuth y POST /api/pinterest/seed-tokens';
  }

  const tokenToUse = bundle.accessToken;
  const res = await fetch(`${getPinterestApiBase()}/user_account`, {
    headers: { Authorization: `Bearer ${tokenToUse}` },
  });

  const json = (await res.json()) as {
    username?: string;
    message?: string;
  };

  if (!res.ok) {
    const missingUserAccounts = (json.message ?? '').includes('user_accounts:read');
    if (missingUserAccounts) {
      result.accessTokenWorks = result.accessTokenPrefixOk;
      result.canWritePins = !!bundle.scope?.includes('pins:write') || result.accessTokenPrefixOk;
      result.error = `${json.message} — el cron de pins puede funcionar igual; incluye user_accounts:read en el próximo OAuth para este diagnóstico.`;
      return result;
    }

    if (res.status === 401) {
      try {
        const refreshed = await refreshAndPersistTokens(bundle);
        const retry = await fetch(`${getPinterestApiBase()}/user_account`, {
          headers: { Authorization: `Bearer ${refreshed.accessToken}` },
        });
        const retryJson = (await retry.json()) as { username?: string; message?: string };
        if (retry.ok) {
          result.accessTokenWorks = true;
          result.username = retryJson.username ?? null;
          result.tokenSource = 'supabase';
          result.accessExpiresAt = refreshed.accessExpiresAt.toISOString();
          result.refreshExpiresAt = refreshed.refreshExpiresAt?.toISOString() ?? null;
        } else {
          result.error = retryJson.message ?? `user_account failed (${retry.status})`;
          return result;
        }
      } catch (err) {
        result.error =
          err instanceof Error
            ? `Access token caducado y refresh falló: ${err.message}`
            : 'Access token caducado y refresh falló';
        return result;
      }
    } else {
      result.error = json.message ?? `user_account failed (${res.status})`;
      return result;
    }
  } else {
    result.accessTokenWorks = true;
    result.username = json.username ?? null;
  }

  const scopeRes = await fetch(`${getPinterestApiBase()}/oauth/token/debug`, {
    headers: { Authorization: `Bearer ${tokenToUse}` },
  }).catch(() => null);

  if (scopeRes?.ok) {
    const scopeJson = (await scopeRes.json()) as { scope?: string };
    result.scopes = scopeJson.scope ?? result.scopes;
    result.canWritePins = !!result.scopes?.includes('pins:write');
  } else if (result.accessTokenWorks) {
    result.canWritePins = !!result.scopes?.includes('pins:write') || result.accessTokenPrefixOk;
  }

  if (result.refreshTokenIssue && !result.accessTokenWorks) {
    result.error = result.refreshTokenIssue;
  } else if (result.refreshTokenIssue) {
    result.error = `${result.refreshTokenIssue}. El access token actual funciona, pero caducará — corrige el refresh pronto.`;
  }

  return result;
}

export function verifyCronSecret(request: Request): boolean {
  const secret = envString(import.meta.env.CRON_SECRET);
  if (!secret) return false;

  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;

  const header = request.headers.get('x-cron-secret');
  return header === secret;
}
