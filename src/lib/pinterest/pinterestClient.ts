import { formatPinDescription, formatPinTitle } from './pinCopy';
import { pinterestImageUrl, recipePageUrl } from './siteUrl';
import type { DailyRecipeCandidate } from './selectDailyRecipe';

const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';

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
  const accessToken = import.meta.env.PINTEREST_ACCESS_TOKEN?.trim();
  const refreshToken = import.meta.env.PINTEREST_REFRESH_TOKEN?.trim();
  const boardId = import.meta.env.PINTEREST_BOARD_ID?.trim();
  const appId = import.meta.env.PINTEREST_APP_ID?.trim();
  const appSecret = import.meta.env.PINTEREST_APP_SECRET?.trim();

  return { accessToken, refreshToken, boardId, appId, appSecret };
}

export function assertPinterestConfig(): {
  accessToken: string;
  refreshToken: string;
  boardId: string;
  appId: string;
  appSecret: string;
} {
  const env = getPinterestEnv();
  const missing: string[] = [];
  if (!env.accessToken) missing.push('PINTEREST_ACCESS_TOKEN');
  if (!env.refreshToken) missing.push('PINTEREST_REFRESH_TOKEN');
  if (!env.boardId) missing.push('PINTEREST_BOARD_ID');
  if (!env.appId) missing.push('PINTEREST_APP_ID');
  if (!env.appSecret) missing.push('PINTEREST_APP_SECRET');
  if (missing.length > 0) {
    throw new PinterestConfigError(`Missing Pinterest env: ${missing.join(', ')}`);
  }
  return env as {
    accessToken: string;
    refreshToken: string;
    boardId: string;
    appId: string;
    appSecret: string;
  };
}

let cachedAccessToken: string | null = null;

async function refreshAccessToken(): Promise<string> {
  const { refreshToken, appId, appSecret } = assertPinterestConfig();

  const credentials = `${appId}:${appSecret}`;
  const basic =
    typeof Buffer !== 'undefined'
      ? Buffer.from(credentials).toString('base64')
      : btoa(credentials);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
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
  const res = await fetch(`${PINTEREST_API_BASE}${path}`, {
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
    throw new Error(json.message ?? `Pinterest create pin failed (${res.status})`);
  }

  return {
    id: json.id,
    link: json.link ?? link,
    title: json.title ?? title,
  };
}

export function verifyCronSecret(request: Request): boolean {
  const secret = import.meta.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;

  const header = request.headers.get('x-cron-secret');
  return header === secret;
}
