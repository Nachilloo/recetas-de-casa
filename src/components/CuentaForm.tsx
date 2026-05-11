import { useState } from 'react';

interface Props {
  baseUrl: string;
  email: string;
  initialUsername: string | null;
  initialDisplayName: string;
  initialBio: string;
  initialIsPublic: boolean;
}

export default function CuentaForm({
  baseUrl,
  email,
  initialUsername,
  initialDisplayName,
  initialBio,
  initialIsPublic,
}: Props) {
  const [username, setUsername] = useState(initialUsername ?? '');
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [bio, setBio] = useState(initialBio);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await fetch(`${baseUrl}api/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: username.trim() || null,
          display_name: displayName,
          bio,
          is_public: isPublic,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudieron guardar los cambios');
        return;
      }
      setSuccess('Cambios guardados.');
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = username ? `${baseUrl}u/${username}` : null;

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-semibold text-fg">Email</h2>
        <p className="mt-2 text-sm text-fg-muted">{email}</p>
        <p className="mt-1 text-xs text-fg-subtle">
          El email no se puede cambiar desde aquí. Contacta con soporte si necesitas modificarlo.
        </p>
      </section>

      {error && (
        <div className="rounded-[var(--radius)] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-[var(--radius)] border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-accent">
          {success}
        </div>
      )}

      <section className="space-y-4 rounded-[var(--radius-lg)] border border-border bg-surface p-6">
        <div>
          <h2 className="font-display text-lg font-semibold text-fg">Perfil público</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Si activas tu perfil público, otras personas podrán ver tu nombre, tu biografía y tus
            colecciones públicas en{' '}
            {publicUrl ? (
              <a href={publicUrl} className="text-accent hover:underline" target="_blank" rel="noopener">
                {publicUrl}
              </a>
            ) : (
              <code className="rounded bg-canvas px-1.5 py-0.5 text-[12px]">/u/&lt;tu-username&gt;</code>
            )}
            .
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-fg" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="ana-perez"
            pattern="[a-z0-9][a-z0-9-]{2,29}"
            className="w-full rounded-[var(--radius)] border border-border bg-canvas px-3 py-2.5 text-base text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
          <p className="mt-1.5 text-xs text-fg-subtle">
            3–30 caracteres. Solo letras minúsculas, números y guiones. Déjalo vacío si no quieres tener
            perfil público.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-fg" htmlFor="display_name">
            Nombre para mostrar
          </label>
          <input
            id="display_name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            className="w-full rounded-[var(--radius)] border border-border bg-canvas px-3 py-2.5 text-base text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-fg" htmlFor="bio">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder="Cuenta algo sobre lo que te gusta cocinar."
            className="w-full rounded-[var(--radius)] border border-border bg-canvas px-3 py-2.5 text-base text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
        </div>

        <label className="flex items-start gap-2 text-sm text-fg-muted">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            disabled={!username}
            className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent-soft disabled:opacity-50"
          />
          <span>
            Activar perfil público.{' '}
            {!username && (
              <span className="text-fg-subtle">(Necesitas un username para activarlo.)</span>
            )}
          </span>
        </label>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-[var(--radius)] bg-accent px-5 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
