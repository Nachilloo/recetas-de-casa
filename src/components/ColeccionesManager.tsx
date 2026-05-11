import { useState } from 'react';
import type { Coleccion } from '../lib/types';

interface Props {
  initial: Coleccion[];
  baseUrl: string;
}

export default function ColeccionesManager({ initial, baseUrl }: Props) {
  const [colecciones, setColecciones] = useState<Coleccion[]>(initial);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${baseUrl}api/colecciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nombre,
          descripcion: descripcion || undefined,
          is_public: isPublic,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo crear la colección');
        return;
      }
      setColecciones([data.coleccion, ...colecciones]);
      setNombre('');
      setDescripcion('');
      setIsPublic(false);
      setCreating(false);
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const togglePublic = async (col: Coleccion) => {
    const next = !col.is_public;
    setColecciones((prev) =>
      prev.map((c) => (c.id === col.id ? { ...c, is_public: next } : c))
    );
    try {
      const res = await fetch(`${baseUrl}api/colecciones/${col.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_public: next }),
      });
      if (!res.ok) {
        setColecciones((prev) =>
          prev.map((c) => (c.id === col.id ? { ...c, is_public: !next } : c))
        );
      }
    } catch {
      setColecciones((prev) =>
        prev.map((c) => (c.id === col.id ? { ...c, is_public: !next } : c))
      );
    }
  };

  const borrar = async (col: Coleccion) => {
    if (!confirm(`¿Borrar la colección "${col.nombre}"?`)) return;
    const prev = colecciones;
    setColecciones((p) => p.filter((c) => c.id !== col.id));
    try {
      const res = await fetch(`${baseUrl}api/colecciones/${col.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) setColecciones(prev);
    } catch {
      setColecciones(prev);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-fg-muted">
          {colecciones.length === 0
            ? 'Aún no tienes colecciones.'
            : `${colecciones.length} ${colecciones.length === 1 ? 'colección' : 'colecciones'}.`}
        </p>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-[var(--radius)] bg-accent px-4 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition-colors hover:bg-accent-hover"
          >
            Nueva colección
          </button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={crear}
          className="space-y-4 rounded-[var(--radius-lg)] border border-border bg-surface p-6"
        >
          <h2 className="font-display text-lg font-semibold text-fg">Nueva colección</h2>
          {error && (
            <div className="rounded-[var(--radius)] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-fg" htmlFor="col-nombre">
              Nombre
            </label>
            <input
              id="col-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              maxLength={80}
              placeholder="Por ejemplo: Cenas de domingo"
              className="w-full rounded-[var(--radius)] border border-border bg-canvas px-3 py-2.5 text-base text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-fg" htmlFor="col-desc">
              Descripción <span className="text-fg-subtle">(opcional)</span>
            </label>
            <textarea
              id="col-desc"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              maxLength={280}
              rows={3}
              className="w-full rounded-[var(--radius)] border border-border bg-canvas px-3 py-2.5 text-base text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
            />
          </div>
          <label className="flex items-start gap-2 text-sm text-fg-muted">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent-soft"
            />
            <span>Hacer pública (visible en mi perfil /u/&lt;username&gt;)</span>
          </label>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-[var(--radius)] bg-accent px-5 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              {saving ? 'Creando…' : 'Crear'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
              className="rounded-[var(--radius)] border border-border px-5 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {colecciones.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {colecciones.map((col) => (
            <article
              key={col.id}
              className="flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-5"
            >
              <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold text-fg">{col.nombre}</h3>
                  {col.descripcion && (
                    <p className="mt-1 text-sm text-fg-muted">{col.descripcion}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ${
                    col.is_public
                      ? 'bg-accent-soft text-accent'
                      : 'bg-canvas text-fg-muted'
                  }`}
                >
                  {col.is_public ? 'Pública' : 'Privada'}
                </span>
              </header>

              <p className="mt-3 text-xs text-fg-subtle">
                {col.slugs.length} {col.slugs.length === 1 ? 'receta' : 'recetas'}
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => togglePublic(col)}
                  className="rounded-[var(--radius)] border border-border px-3 py-1.5 text-fg-muted transition-colors hover:border-accent hover:text-accent"
                >
                  {col.is_public ? 'Hacer privada' : 'Hacer pública'}
                </button>
                <button
                  type="button"
                  onClick={() => borrar(col)}
                  className="rounded-[var(--radius)] border border-border px-3 py-1.5 text-fg-muted transition-colors hover:border-danger hover:text-danger"
                >
                  Eliminar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
