import { useState } from 'react';

type Mode = 'login' | 'signup';

interface Props {
  mode: Mode;
  baseUrl: string;
}

export default function AuthForm({ mode, baseUrl }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const isSignup = mode === 'signup';
  const initialNext = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('next') ?? '/'
    : '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      const endpoint = isSignup ? `${baseUrl}api/auth/signup` : `${baseUrl}api/auth/login`;
      const body = isSignup
        ? { email, password, displayName: displayName || undefined }
        : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      const result = await res.json();

      if (!result.success) {
        setError(result.error ?? 'No se pudo completar la operación');
        return;
      }

      if (isSignup && result.requiresEmailConfirmation) {
        setInfo(result.message ?? 'Revisa tu email para confirmar la cuenta.');
        return;
      }

      window.location.href = initialNext;
    } catch (err) {
      console.error(err);
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const googleUrl = `${baseUrl}api/auth/google?next=${encodeURIComponent(initialNext)}`;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-[var(--radius-lg)] border border-border bg-surface p-6 sm:p-8"
      noValidate
    >
      <a
        href={googleUrl}
        className="inline-flex w-full items-center justify-center gap-3 rounded-[var(--radius)] border border-border bg-canvas px-5 py-2.5 text-sm font-semibold text-fg transition-colors hover:border-accent hover:text-accent"
      >
        <GoogleIcon />
        Continuar con Google
      </a>

      <div className="relative flex items-center gap-3">
        <span className="h-px flex-1 bg-border" aria-hidden />
        <span className="text-xs uppercase tracking-wider text-fg-subtle">o con email</span>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[var(--radius)] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </div>
      )}
      {info && (
        <div
          role="status"
          className="rounded-[var(--radius)] border border-accent/40 bg-accent-soft px-3 py-2 text-sm text-accent"
        >
          {info}
        </div>
      )}

      {isSignup && (
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-fg">
            Nombre
          </label>
          <input
            id="name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="given-name"
            required
            className="w-full rounded-[var(--radius)] border border-border bg-canvas px-3 py-2.5 text-base text-fg placeholder-fg-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-fg">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          placeholder="tu@email.com"
          className="w-full rounded-[var(--radius)] border border-border bg-canvas px-3 py-2.5 text-base text-fg placeholder-fg-subtle focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="password" className="text-sm font-medium text-fg">
            Contraseña
          </label>
          {!isSignup && (
            <a href="#" className="text-xs text-fg-muted transition-colors hover:text-accent">
              ¿La olvidaste?
            </a>
          )}
        </div>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          required
          minLength={isSignup ? 8 : undefined}
          className="w-full rounded-[var(--radius)] border border-border bg-canvas px-3 py-2.5 text-base text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
        />
        {isSignup && <p className="mt-1.5 text-xs text-fg-subtle">Mínimo 8 caracteres.</p>}
      </div>

      {isSignup && (
        <label className="flex items-start gap-2 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            required
            className="mt-0.5 h-4 w-4 rounded border-border text-accent focus:ring-accent-soft"
          />
          <span>
            Acepto los{' '}
            <a href={`${baseUrl}terminos`} className="text-accent hover:underline">
              términos
            </a>{' '}
            y la{' '}
            <a href={`${baseUrl}privacidad`} className="text-accent hover:underline">
              política de privacidad
            </a>
            .
          </span>
        </label>
      )}

      <button
        type="submit"
        disabled={loading || (isSignup && !acceptTerms)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-accent px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Procesando…' : isSignup ? 'Crear mi cuenta' : 'Entrar'}
      </button>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.08z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
