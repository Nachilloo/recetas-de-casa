import { useEffect, useState } from 'react';

interface Props {
  slug: string;
  /** Si null, mostramos un botón que abre /login con next= la URL actual. */
  loggedIn: boolean;
  baseUrl: string;
  /** Tamaño visual */
  size?: 'sm' | 'md';
  /** Si true, el botón se renderiza absolute encima de la imagen (variante card). */
  floating?: boolean;
  /** Estado inicial conocido por el servidor (evita parpadeo al cargar). */
  initialFavorito?: boolean;
}

const STORAGE_KEY = 'favoritos_slugs_cache_v1';

export default function FavoritoButton({
  slug,
  loggedIn,
  baseUrl,
  size = 'md',
  floating = false,
  initialFavorito,
}: Props) {
  const [favorito, setFavorito] = useState<boolean>(initialFavorito ?? false);
  const [loading, setLoading] = useState(false);

  // Hidratación rápida: si no llega initialFavorito y el usuario está logueado,
  // tiramos del cache de localStorage. Cargamos los reales una vez por sesión.
  useEffect(() => {
    if (initialFavorito !== undefined) return;
    if (!loggedIn) return;

    try {
      const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (cached && Array.isArray(cached.slugs) && cached.expira > Date.now()) {
        setFavorito(cached.slugs.includes(slug));
        return;
      }
    } catch {}

    fetch(`${baseUrl}api/favoritos`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { favoritos?: string[] }) => {
        if (!data.favoritos) return;
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ slugs: data.favoritos, expira: Date.now() + 5 * 60_000 })
          );
        } catch {}
        setFavorito(data.favoritos.includes(slug));
      })
      .catch(() => {});
  }, [slug, loggedIn, baseUrl, initialFavorito]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!loggedIn) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${baseUrl}login?next=${next}`;
      return;
    }
    if (loading) return;
    setLoading(true);
    const prev = favorito;
    setFavorito(!prev);

    try {
      const res = await fetch(`${baseUrl}api/favoritos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (typeof data.favorito === 'boolean') {
        setFavorito(data.favorito);
        // invalidar cache
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
      } else {
        setFavorito(prev);
      }
    } catch {
      setFavorito(prev);
    } finally {
      setLoading(false);
    }
  };

  const sizeCls = size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const iconCls = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  const floatingCls = floating
    ? 'absolute left-3 top-3 z-10 bg-surface/95 shadow-sm backdrop-blur-sm hover:bg-surface'
    : 'border border-border bg-canvas hover:border-accent';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={favorito ? 'Quitar de favoritos' : 'Añadir a favoritos'}
      aria-pressed={favorito}
      title={
        loggedIn
          ? favorito
            ? 'Quitar de favoritos'
            : 'Añadir a favoritos'
          : 'Inicia sesión para guardar favoritos'
      }
      disabled={loading}
      className={`inline-flex items-center justify-center rounded-full transition-all ${sizeCls} ${floatingCls} ${
        favorito ? 'text-accent' : 'text-fg-muted hover:text-accent'
      } ${loading ? 'opacity-60' : ''}`}
    >
      <svg
        className={iconCls}
        viewBox="0 0 24 24"
        fill={favorito ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={favorito ? 0 : 1.75}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
        />
      </svg>
    </button>
  );
}
