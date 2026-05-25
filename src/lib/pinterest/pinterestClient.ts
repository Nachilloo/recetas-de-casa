import { formatPinDescription, formatPinTitle } from './pinCopy';
import { pinterestImageUrl, recipePageUrl } from './siteUrl';
import type { DailyRecipeCandidate } from './selectDailyRecipe';

/** Vercel puede inyectar env vars como boolean o number, no solo string. */
function envString(value: string | boolean | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
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
  accessToken: string;
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
  accessToken: string;
  refreshToken: string | null;
  boardId: string;
  appId: string;
  appSecret: string;
} {
  const env = getPinterestEnv();
  const sandbox = useSandbox();
  const missing: string[] = [];
  if (!env.accessToken) missing.push('PINTEREST_ACCESS_TOKEN');
  if (!sandbox && !env.refreshToken) missing.push('PINTEREST_REFRESH_TOKEN');
  if (!env.boardId) missing.push('PINTEREST_BOARD_ID');
  if (!sandbox && !env.appId) missing.push('PINTEREST_APP_ID');
  if (!sandbox && !env.appSecret) missing.push('PINTEREST_APP_SECRET');
  if (missing.length > 0) {
    throw new PinterestConfigError(`Missing Pinterest env: ${missing.join(', ')}`);
  }
  return {
    accessToken: env.accessToken!,
    refreshToken: env.refreshToken ?? null,
    boardId: env.boardId!,
    appId: env.appId ?? '',
    appSecret: env.appSecret ?? '',
  };
}

let cachedAccessToken: string | null = null;

async function refreshAccessToken(): Promise<string> {
  const { refreshToken, appId, appSecret } = assertPinterestConfig();
  if (!refreshToken) {
    throw new Error('No hay refresh token; genera uno nuevo o usa token Sandbox con PINTEREST_USE_SANDBOX=true');
  }

  const credentials = `${appId}:${appSecret}`;
  const basic =
    typeof Buffer !== 'undefined'
      ? Buffer.from(credentials).toString('base64')
      : btoa(credentials);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch(getOAuthTokenUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    message?: string;
  };

  if (!res.ok || !json.access_token) {
    throw new Error(json.message ?? `Pinterest token refresh failed (${res.status})`);
  }

  cachedAccessToken = json.access_token;
  return json.access_token;
}

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken) return cachedAccessToken;
  const { accessToken } = assertPinterestConfig();
  cachedAccessToken = accessToken;
  return accessToken;
}

async function pinterestFetch(path: string, init: RequestInit, retry = true): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`${getPinterestApiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401 && retry) {
    await refreshAccessToken();
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
  accessTokenWorks: boolean;
  username: string | null;
  scopes: string | null;
  canWritePins: boolean;
  error: string | null;
};

/** Verifica que los tokens OAuth sean reales (no el test de 24h) y funcionen. */
export async function verifyPinterestTokens(retryAfterRefresh = true): Promise<PinterestTokenCheck> {
  const { accessToken, refreshToken } = getPinterestEnv();
  const result: PinterestTokenCheck = {
    accessTokenPrefixOk: accessToken?.startsWith('pina_') ?? false,
    refreshTokenPrefixOk: refreshToken?.startsWith('pinr_') ?? false,
    accessTokenWorks: false,
    username: null,
    scopes: null,
    canWritePins: false,
    error: null,
  };

  if (!accessToken) {
    result.error = 'Falta PINTEREST_ACCESS_TOKEN';
    return result;
  }

  if (!result.accessTokenPrefixOk) {
    result.error =
      'PINTEREST_ACCESS_TOKEN no empieza por pina_ — probablemente es el token de prueba de 24h, no OAuth real';
    return result;
  }

  if (refreshToken && !result.refreshTokenPrefixOk) {
    result.error =
      'PINTEREST_REFRESH_TOKEN no empieza por pinr_ — debe ser el refresh del flujo OAuth, no el access token';
    return result;
  }

  let tokenToUse = accessToken;
  try {
    tokenToUse = await getAccessToken();
  } catch {
    tokenToUse = accessToken;
  }

  const res = await fetch(`${getPinterestApiBase()}/user_account`, {
    headers: { Authorization: `Bearer ${tokenToUse}` },
  });

  const json = (await res.json()) as {
    username?: string;
    message?: string;
  };

  if (!res.ok) {
    if (res.status === 401 && refreshToken && retryAfterRefresh) {
      try {
        await refreshAccessToken();
        return verifyPinterestTokens(false);
      } catch (err) {
        result.error =
          err instanceof Error
            ? `Access token caducado y refresh falló: ${err.message}`
            : 'Access token caducado y refresh falló';
        return result;
      }
    }
    result.error = json.message ?? `user_account failed (${res.status})`;
    return result;
  }

  result.accessTokenWorks = true;
  result.username = json.username ?? null;

  const scopeRes = await fetch(`${getPinterestApiBase()}/oauth/token/debug`, {
    headers: { Authorization: `Bearer ${tokenToUse}` },
  }).catch(() => null);

  if (scopeRes?.ok) {
    const scopeJson = (await scopeRes.json()) as { scope?: string };
    result.scopes = scopeJson.scope ?? null;
    result.canWritePins = !!result.scopes?.includes('pins:write');
  } else {
    // Si debug no está disponible, asumir write si el prefijo OAuth es correcto
    result.canWritePins = result.accessTokenPrefixOk && result.refreshTokenPrefixOk;
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
