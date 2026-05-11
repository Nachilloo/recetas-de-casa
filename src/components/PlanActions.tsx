import { useState } from 'react';
import type { Plan } from '../lib/types';

interface Props {
  baseUrl: string;
  plan: Plan;
  trialActive: boolean;
  trialUsed: boolean;
}

export default function PlanActions({ baseUrl, plan, trialActive, trialUsed }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upgrade = async (period: 'monthly' | 'yearly') => {
    setError(null);
    setLoading(period);
    try {
      const res = await fetch(`${baseUrl}api/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ period }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo iniciar el pago');
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(null);
    }
  };

  const openPortal = async () => {
    setError(null);
    setLoading('portal');
    try {
      const res = await fetch(`${baseUrl}api/stripe/portal`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo abrir el portal');
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(null);
    }
  };

  if (plan === 'pro') {
    return (
      <div className="space-y-4">
        {error && <ErrorBox message={error} />}
        <button
          type="button"
          onClick={openPortal}
          disabled={loading === 'portal'}
          className="rounded-[var(--radius)] border border-border bg-surface px-5 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
        >
          {loading === 'portal' ? 'Abriendo…' : 'Gestionar suscripción'}
        </button>
        <p className="text-xs text-fg-subtle">
          Te llevamos al portal de Stripe para cancelar, cambiar de plan o actualizar la tarjeta.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <ErrorBox message={error} />}

      {!trialUsed && plan === 'free' && (
        <div className="rounded-[var(--radius)] border border-accent/40 bg-accent-soft p-5">
          <p className="text-sm font-semibold text-accent">¿Quieres probar Pro 10 días?</p>
          <p className="mt-1 text-sm text-fg-muted">
            Sin tarjeta, sin compromiso. Activa tu trial gratuito y desbloquea generaciones
            ilimitadas, aprovechamiento y productos de temporada.
          </p>
          <form action={`${baseUrl}api/trial/start`} method="post" className="mt-4">
            <button
              type="submit"
              className="rounded-[var(--radius)] bg-accent px-5 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition-colors hover:bg-accent-hover"
            >
              Empezar mi trial de 10 días
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <article className="rounded-[var(--radius-lg)] border border-border bg-canvas p-5">
          <p className="text-xs uppercase tracking-wider text-fg-subtle">Mensual</p>
          <p className="font-display mt-2 text-2xl font-semibold text-fg">4,99 € / mes</p>
          <p className="mt-1 text-xs text-fg-muted">Cancelas cuando quieras.</p>
          <button
            type="button"
            onClick={() => upgrade('monthly')}
            disabled={loading === 'monthly'}
            className="mt-5 w-full rounded-[var(--radius)] border border-accent bg-surface px-5 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-[var(--color-accent-contrast)] disabled:opacity-60"
          >
            {loading === 'monthly' ? 'Redirigiendo…' : 'Suscribirme mensual'}
          </button>
        </article>

        <article className="rounded-[var(--radius-lg)] border-2 border-accent bg-canvas p-5">
          <div className="flex items-baseline justify-between">
            <p className="text-xs uppercase tracking-wider text-accent">Anual</p>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-contrast)]">
              -35 %
            </span>
          </div>
          <p className="font-display mt-2 text-2xl font-semibold text-fg">39 € / año</p>
          <p className="mt-1 text-xs text-fg-muted">Equivale a 3,25 €/mes.</p>
          <button
            type="button"
            onClick={() => upgrade('yearly')}
            disabled={loading === 'yearly'}
            className="mt-5 w-full rounded-[var(--radius)] bg-accent px-5 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {loading === 'yearly' ? 'Redirigiendo…' : 'Suscribirme anual'}
          </button>
        </article>
      </div>

      {trialActive && (
        <p className="text-xs text-fg-subtle">
          Tu trial sigue activo. Si te suscribes ahora, cobramos al terminar el trial.
        </p>
      )}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      {message}
    </div>
  );
}
