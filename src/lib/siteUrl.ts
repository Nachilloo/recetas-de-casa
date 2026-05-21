/**
 * URL absoluta pública basada en `Astro.site`, no en el host del request.
 * En Vercel SSR, `Astro.url.origin` puede ser `https://localhost`.
 */
export function sitePageUrl(
  site: URL | undefined,
  pathname: string,
  search = '',
  override?: string,
): string {
  if (override) return override;
  if (site) return new URL(`${pathname}${search}`, site).href;
  return `${pathname}${search}`;
}
