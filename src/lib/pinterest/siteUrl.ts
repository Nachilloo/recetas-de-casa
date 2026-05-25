import { DEFAULT_SITE_URL, UTM_PARAMS } from './constants';

export function getSiteUrl(request?: Request): string {
  const fromEnv = import.meta.env.PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (request) return new URL(request.url).origin.replace(/\/$/, '');
  return DEFAULT_SITE_URL;
}

export function recipePageUrl(siteUrl: string, slug: string, withUtm = false): string {
  const base = `${siteUrl.replace(/\/$/, '')}/recetas/${encodeURIComponent(slug)}`;
  if (!withUtm) return base;
  return `${base}?${UTM_PARAMS}`;
}

export function pinterestImageUrl(siteUrl: string, slug: string): string {
  return `${siteUrl.replace(/\/$/, '')}/api/pinterest-image?slug=${encodeURIComponent(slug)}&v=2`;
}
