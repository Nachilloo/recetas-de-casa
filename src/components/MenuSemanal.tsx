import { useState, useEffect, useRef } from 'react';

interface RecetaMenu {
  slug: string;
  title: string;
  categoria: string;
  dificultad: string;
  tiempo: string;
  imagen: string;
  razon: string;
  ingredientes?: string[];
  porciones?: number;
}

interface DiaMenu {
  dia: string;
  comida?: RecetaMenu;
  cena?: RecetaMenu;
}

interface MenuData {
  menu: DiaMenu[];
  resumen_nutricional: string;
  consejo_semanal: string;
  aprovechamiento?: string;
}

type Plan = 'free' | 'trial' | 'pro';

interface PlanInfo {
  loggedIn: boolean;
  plan: Plan;
  trialActive: boolean;
  trialUsed: boolean;
  canGenerateMenu: boolean;
  menuCooldownUntil: string | null;
}

type ApiError =
  | { error: 'auth_required'; message: string; redirect?: string }
  | { error: 'paywall_feature'; message: string; upgrade: string }
  | { error: 'paywall_quota'; message: string; cooldownUntil?: string; upgrade: string }
  | { error: string; message?: string };

const ALERGIAS_COMUNES = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'lactosa', label: 'Lactosa' },
  { id: 'huevo', label: 'Huevo' },
  { id: 'frutos secos', label: 'Frutos secos' },
  { id: 'marisco', label: 'Marisco' },
  { id: 'pescado', label: 'Pescado' },
  { id: 'soja', label: 'Soja' },
];

const DIETAS = [
  { id: 'omnivora', label: 'Sin restricción' },
  { id: 'vegetariana', label: 'Vegetariana' },
  { id: 'vegana', label: 'Vegana' },
  { id: 'pescetariana', label: 'Pescetariana' },
];

interface MenuGuardado {
  id: string;
  fecha: string;
  nombre: string;
  menuData: MenuData;
  personas: number;
  tipo: string;
}

const STORAGE_KEY = 'menus_guardados';

/** Prefijo del sitio (p. ej. subcarpeta en GitHub Pages). */
const siteBase = import.meta.env.BASE_URL.replace(/\/?$/, '/');

const apiUrl = (path: string) => `${siteBase}${path.replace(/^\//, '')}`;

/** Badges sobre foto: contraste en claro y oscuro */
const DIFICULTAD_COLORES: Record<string, string> = {
  facil: 'bg-emerald-700/90 text-white',
  media: 'bg-amber-700/90 text-white',
  dificil: 'bg-red-700/90 text-white',
};

const DIFICULTAD_NOMBRE: Record<string, string> = {
  'facil': 'Fácil',
  'media': 'Media',
  'dificil': 'Difícil',
};

/** Pasos rotatorios durante la generación (una sola petición; son orientativos). */
const GENERACION_PASOS = [
  'Aplicamos tu dieta y lo que quieres evitar…',
  'Revisamos el recetario para esta semana…',
  'Combinamos platos para equilibrar la semana…',
  'Afinamos comidas y cenas según el plan…',
  'Preparamos el resumen y los consejos…',
];

export default function MenuSemanal() {
  const [tipo, setTipo] = useState<'comida' | 'cena' | 'ambos'>('ambos');
  const [personas, setPersonas] = useState(4);
  const [dificultadMax, setDificultadMax] = useState('dificil');
  const [aprovechamiento, setAprovechamiento] = useState(false);
  const [temporada, setTemporada] = useState(false);
  const [alergias, setAlergias] = useState<string[]>([]);
  const [dieta, setDieta] = useState<string>('omnivora');
  const [loading, setLoading] = useState(false);
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<ApiError | null>(null);
  const [menusGuardados, setMenusGuardados] = useState<MenuGuardado[]>([]);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [generacionPaso, setGeneracionPaso] = useState(0);
  const generacionMsgId = useRef(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      setMenusGuardados(saved);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetch(apiUrl('api/plan/status'), { credentials: 'include' })
      .then((r) => r.json())
      .then((data: PlanInfo) => setPlanInfo(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading) return;
    setGeneracionPaso(0);
    generacionMsgId.current += 1;
    const tick = generacionMsgId.current;
    const id = window.setInterval(() => {
      if (generacionMsgId.current !== tick) return;
      setGeneracionPaso((i) => (i + 1) % GENERACION_PASOS.length);
    }, 2600);
    return () => {
      generacionMsgId.current += 1;
      window.clearInterval(id);
    };
  }, [loading]);

  const isPro = planInfo?.plan === 'pro' || planInfo?.trialActive;
  const isFreeLogged = planInfo?.loggedIn && planInfo.plan === 'free' && !planInfo.trialActive;
  const isAnon = planInfo && !planInfo.loggedIn;
  const advancedDisabled = !isPro;

  const toggleAlergia = (id: string) => {
    setAlergias((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const guardarMenu = () => {
    if (!menuData) return;
    const nuevo: MenuGuardado = {
      id: Date.now().toString(),
      fecha: new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }),
      nombre: `Menú ${tipo === 'ambos' ? 'completo' : tipo} · ${personas} pers.`,
      menuData,
      personas,
      tipo,
    };
    const updated = [nuevo, ...menusGuardados].slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setMenusGuardados(updated);
    setGuardadoOk(true);
    setTimeout(() => setGuardadoOk(false), 2000);
  };

  const cargarMenu = (saved: MenuGuardado) => {
    setMenuData(saved.menuData);
    setPersonas(saved.personas);
    setTipo(saved.tipo as 'comida' | 'cena' | 'ambos');
  };

  const borrarMenu = (id: string) => {
    const updated = menusGuardados.filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setMenusGuardados(updated);
  };

  const generarMenu = async () => {
    setLoading(true);
    setError(null);
    setPaywall(null);
    setMenuData(null);

    try {
      const res = await fetch(apiUrl('api/menu/generar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tipo,
          personas,
          dificultadMax,
          aprovechamiento: isPro ? aprovechamiento : false,
          temporada: isPro ? temporada : false,
          alergias,
          dieta,
        }),
      });

      if (res.status === 401 || res.status === 402) {
        const err = await res.json();
        setPaywall(err as ApiError);
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.message || 'Error generando menú');
      }

      const data: MenuData & { plan?: Plan } = await res.json();
      setMenuData(data);

      // Refrescar plan info para que el siguiente intento muestre el cooldown
      fetch(apiUrl('api/plan/status'), { credentials: 'include' })
        .then((r) => r.json())
        .then((d: PlanInfo) => setPlanInfo(d))
        .catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const exportarCalendar = async () => {
    if (!menuData) return;

    try {
      const res = await fetch(apiUrl('api/menu/calendar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menu: menuData.menu,
          siteUrl: window.location.origin,
        }),
      });

      if (!res.ok) throw new Error('Error generando calendario');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'menu-semanal.ics';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Error al exportar el calendario');
    }
  };

  const getImageSrc = (img: string) =>
    img?.startsWith('http') ? img : `${siteBase}${img?.replace(/^\//, '')}`;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {planInfo && (
        <PlanBanner planInfo={planInfo} baseUrl={siteBase} />
      )}

      {/* Configuración */}
      <div className="rounded-2xl shadow-lg p-6 md:p-8 border border-border bg-surface mb-8">
        <h2 className="text-2xl font-bold text-fg mb-6">
          Configura tu menú
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Tipo de comida */}
          <div>
            <label className="block text-sm font-semibold text-fg mb-2">
              Tipo de comida
            </label>
            <div className="flex flex-col gap-2">
              {[
                { value: 'comida' as const, label: 'Solo comida', desc: 'Almuerzo' },
                { value: 'cena' as const, label: 'Solo cena', desc: 'Cena' },
                { value: 'ambos' as const, label: 'Ambos', desc: 'Comida + Cena' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTipo(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                    tipo === opt.value
                      ? 'bg-accent-soft border-2 border-accent text-accent'
                      : 'bg-canvas border-2 border-border text-fg-muted hover:border-border-strong'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Personas */}
          <div>
            <label className="block text-sm font-semibold text-fg mb-2">
              Comensales
            </label>
            <div className="flex items-center gap-3 rounded-lg p-3 border-2 border-border bg-canvas">
              <button
                onClick={() => setPersonas(Math.max(1, personas - 1))}
                className="w-10 h-10 rounded-full border-2 border-border-strong bg-surface text-fg-muted font-bold hover:border-accent hover:text-accent transition-all"
              >
                -
              </button>
              <span className="text-3xl font-bold text-fg flex-1 text-center">
                {personas}
              </span>
              <button
                onClick={() => setPersonas(Math.min(12, personas + 1))}
                className="w-10 h-10 rounded-full border-2 border-border-strong bg-surface text-fg-muted font-bold hover:border-accent hover:text-accent transition-all"
              >
                +
              </button>
            </div>
            <p className="text-xs text-fg-subtle mt-1 text-center">personas</p>
          </div>

          {/* Dificultad */}
          <div>
            <label className="block text-sm font-semibold text-fg mb-2">
              Dificultad máxima
            </label>
            <div className="flex flex-col gap-2">
              {[
                { value: 'facil', label: 'Fácil', desc: 'Recetas sencillas' },
                { value: 'media', label: 'Media', desc: 'Algo más elaboradas' },
                { value: 'dificil', label: 'Todas', desc: 'Sin restricción' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDificultadMax(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                    dificultadMax === opt.value
                      ? 'bg-accent-soft border-2 border-accent text-accent'
                      : 'bg-canvas border-2 border-border text-fg-muted hover:border-border-strong'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opciones extra (avanzadas, gated por plan) */}
          <div>
            <label className="block text-sm font-semibold text-fg mb-2">
              Opciones avanzadas
              {advancedDisabled && (
                <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                  Pro
                </span>
              )}
            </label>
            <div className={`flex flex-col gap-2 ${advancedDisabled ? 'opacity-60' : ''}`}>
              <button
                onClick={() => !advancedDisabled && setAprovechamiento(!aprovechamiento)}
                disabled={advancedDisabled}
                className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${
                  aprovechamiento && !advancedDisabled
                    ? 'bg-success/15 border-2 border-success text-success'
                    : 'bg-canvas border-2 border-border text-fg-muted hover:border-border-strong'
                } ${advancedDisabled ? 'cursor-not-allowed' : ''}`}
                title={advancedDisabled ? 'Disponible en Pro / Trial' : ''}
              >
                <div>
                  <div className="font-semibold">Aprovechamiento</div>
                  <div className="text-xs opacity-75">
                    Reutiliza ingredientes entre días
                  </div>
                </div>
              </button>
              <button
                onClick={() => !advancedDisabled && setTemporada(!temporada)}
                disabled={advancedDisabled}
                className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${
                  temporada && !advancedDisabled
                    ? 'bg-accent-soft border-2 border-accent text-accent'
                    : 'bg-canvas border-2 border-border text-fg-muted hover:border-border-strong'
                } ${advancedDisabled ? 'cursor-not-allowed' : ''}`}
                title={advancedDisabled ? 'Disponible en Pro / Trial' : ''}
              >
                <div>
                  <div className="font-semibold">Productos de temporada</div>
                  <div className="text-xs opacity-75">
                    Prioriza ingredientes de temporada en España
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Preferencias dietéticas (todos los planes) */}
        <div className="mt-8 grid grid-cols-1 gap-6 border-t border-border pt-8 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-fg">Dieta</label>
            <div className="flex flex-wrap gap-2">
              {DIETAS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDieta(d.id)}
                  className={`rounded-full border-2 px-4 py-1.5 text-sm font-medium transition-colors ${
                    dieta === d.id
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border bg-canvas text-fg-muted hover:border-border-strong'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-fg">
              Alergias / a evitar
            </label>
            <div className="flex flex-wrap gap-2">
              {ALERGIAS_COMUNES.map((a) => {
                const selected = alergias.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAlergia(a.id)}
                    className={`rounded-full border-2 px-3 py-1.5 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-border bg-canvas text-fg-muted hover:border-border-strong'
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-fg-subtle">
              La IA intentará evitar las recetas con esos ingredientes.
            </p>
          </div>
        </div>

        {/* Botón generar */}
        <div className="mt-8 text-center">
          <button
            onClick={generarMenu}
            disabled={loading}
            className={`px-10 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-lg ${
              loading
                ? 'bg-fg-subtle/25 text-fg-subtle cursor-not-allowed'
                : 'bg-accent text-[var(--color-accent-contrast)] hover:bg-accent-hover hover:-translate-y-1 hover:shadow-xl'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generando menú...
              </span>
            ) : (
              'Generar menú semanal'
            )}
          </button>
          {isAnon && (
            <p className="mt-3 text-xs text-fg-subtle">
              Si no tienes cuenta, te pediremos crear una gratis antes de generar.
            </p>
          )}
          {isFreeLogged && planInfo?.canGenerateMenu && (
            <p className="mt-3 text-xs text-fg-subtle">
              Plan gratis: 1 generación cada 2 meses. Para ilimitado, prueba Pro o
              {' '}<a href={`${siteBase}precios`} className="text-accent hover:underline">suscríbete</a>.
            </p>
          )}

          {loading && (
            <div
              className="mx-auto mt-6 max-w-md text-left"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="menu-indeterminate-track" aria-hidden="true">
                <div className="menu-indeterminate-fill" />
              </div>
              <p className="mt-3 min-h-[2.75rem] text-sm leading-relaxed text-fg-muted motion-safe:transition-opacity motion-safe:duration-300">
                {GENERACION_PASOS[generacionPaso]}
              </p>
              <p className="mt-1 text-xs text-fg-subtle">
                Suele tardar un poco: la IA está elaborando todo el menú. No cierres esta pestaña.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Paywall */}
      {paywall && (
        <Paywall paywall={paywall} baseUrl={siteBase} />
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border-2 border-danger/40 bg-danger/10 p-4 mb-8 text-center text-danger">
          {error}
        </div>
      )}

      {/* Resultado del menú */}
      {menuData && (
        <div className="space-y-8">
          {/* Resumen nutricional */}
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-lg ring-1 ring-success/20">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-bold text-success">
                  Resumen nutricional
                </h3>
                <p className="text-fg-muted">{menuData.resumen_nutricional}</p>
              </div>
              <div className="flex-1">
                <h3 className="mb-2 text-lg font-bold text-success">
                  Consejo de la semana
                </h3>
                <p className="text-fg-muted">{menuData.consejo_semanal}</p>
              </div>
            </div>
            {menuData.aprovechamiento && (
              <div className="mt-4 border-t border-border pt-4">
                <h3 className="mb-2 text-lg font-bold text-success">
                  Aprovechamiento
                </h3>
                <p className="text-fg-muted">{menuData.aprovechamiento}</p>
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={generarMenu}
              disabled={loading}
              className="rounded-full border-2 border-accent bg-surface px-6 py-3 font-semibold text-accent transition-all hover:bg-accent-soft"
            >
              Regenerar menú
            </button>
            <button
              onClick={guardarMenu}
              className="rounded-full border-2 border-success bg-surface px-6 py-3 font-semibold text-success transition-all hover:bg-success/10"
            >
              {guardadoOk ? 'Guardado' : 'Guardar menú'}
            </button>
            <button
              onClick={exportarCalendar}
              className="rounded-full border-2 border-border bg-surface px-6 py-3 font-semibold text-fg-muted transition-all hover:border-accent hover:bg-accent-soft hover:text-accent"
            >
              Exportar a Google Calendar
            </button>
          </div>

          {/* Días del menú */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {menuData.menu.map((dia) => (
              <div
                key={dia.dia}
                className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg transition-shadow hover:shadow-xl"
              >
                {/* Header del día */}
                <div className="bg-accent px-5 py-3">
                  <h3 className="text-lg font-bold text-[var(--color-accent-contrast)]">{dia.dia}</h3>
                </div>

                <div className="p-4 space-y-4">
                  {/* Comida */}
                  {dia.comida && (
                    <RecetaCard
                      receta={dia.comida}
                      momento="Comida"
                      emoji=""
                      getImageSrc={getImageSrc}
                    />
                  )}

                  {/* Separador si hay ambos */}
                  {dia.comida && dia.cena && (
                    <div className="border-t border-border" />
                  )}

                  {/* Cena */}
                  {dia.cena && (
                    <RecetaCard
                      receta={dia.cena}
                      momento="Cena"
                      emoji=""
                      getImageSrc={getImageSrc}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Lista de la compra */}
          <ListaCompra menuData={menuData} personas={personas} />
        </div>
      )}

      {/* Menús guardados */}
      {menusGuardados.length > 0 && (
        <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-lg">
          <h2 className="mb-4 flex items-baseline gap-2 text-xl font-bold text-fg">
            Menús guardados
            <span className="text-sm font-normal text-fg-subtle">({menusGuardados.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {menusGuardados.map(saved => (
              <div
                key={saved.id}
                className="group rounded-xl border border-border p-4 transition-all hover:border-accent hover:shadow-md"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-fg">{saved.nombre}</p>
                    <p className="text-xs text-fg-subtle">{saved.fecha}</p>
                  </div>
                  <button
                    onClick={() => borrarMenu(saved.id)}
                    className="p-1 text-fg-subtle transition-colors hover:text-danger"
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>
                </div>
                <div className="mb-3 text-xs text-fg-muted">
                  {saved.menuData.menu.length} días ·{' '}
                  {saved.menuData.menu.filter(d => d.comida).length + saved.menuData.menu.filter(d => d.cena).length} recetas
                </div>
                <button
                  onClick={() => cargarMenu(saved)}
                  className="w-full rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-accent transition-all hover:bg-accent hover:text-[var(--color-accent-contrast)]"
                >
                  Cargar este menú
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Etiquetas de categorías para display
const CAT_DISPLAY: Record<string, { label: string; emoji: string }> = {
  carnes: { label: 'Carnes y aves', emoji: '🥩' },
  pescados: { label: 'Pescados y mariscos', emoji: '🐟' },
  verduras: { label: 'Verduras y hortalizas', emoji: '🥬' },
  frutas: { label: 'Frutas', emoji: '🍎' },
  lacteos: { label: 'Lácteos y huevos', emoji: '🧀' },
  cereales: { label: 'Cereales y legumbres', emoji: '🌾' },
  especias: { label: 'Especias y condimentos', emoji: '🧂' },
  aceites: { label: 'Aceites y vinagres', emoji: '🫒' },
  otros: { label: 'Otros', emoji: '🛒' },
};

// Diccionario canónico: [keyword, nombre canónico, categoría]
// Los compuestos (multi-palabra) DEBEN ir antes que sus componentes simples
const CANONICAL: [string, string, string][] = [
  // Compuestos (primero, para que coincidan antes que los simples)
  ['tomates cherry', 'Tomates cherry', 'verduras'], ['tomate cherry', 'Tomates cherry', 'verduras'],
  ['salsa de tomate', 'Salsa de tomate', 'otros'], ['pimiento morrón', 'Pimiento morrón', 'verduras'],
  ['judías verdes', 'Judías verdes', 'verduras'], ['judía verde', 'Judías verdes', 'verduras'],
  ['aceite de oliva', 'Aceite de oliva', 'aceites'], ['aceite de girasol', 'Aceite de girasol', 'aceites'],
  ['pan rallado', 'Pan rallado', 'cereales'], ['pan tostado', 'Pan', 'cereales'],
  ['pimienta negra', 'Pimienta', 'especias'], ['pimienta blanca', 'Pimienta', 'especias'],
  ['nuez moscada', 'Nuez moscada', 'especias'],
  ['leche evaporada', 'Leche evaporada', 'lacteos'], ['leche condensada', 'Leche condensada', 'lacteos'],
  ['queso gruyer', 'Queso gruyère', 'lacteos'], ['queso gruyère', 'Queso gruyère', 'lacteos'],
  ['queso parmesano', 'Queso parmesano', 'lacteos'], ['queso manchego', 'Queso manchego', 'lacteos'],
  ['queso fresco', 'Queso fresco', 'lacteos'], ['queso rallado', 'Queso rallado', 'lacteos'],
  ['vino blanco', 'Vino blanco', 'otros'], ['vino tinto', 'Vino tinto', 'otros'],
  ['pasta de sésamo', 'Tahini', 'otros'], ['tortilla de maíz', 'Tortillas de maíz', 'cereales'],
  ['maíz dulce', 'Maíz dulce', 'verduras'],
  // Verduras
  ['acelga', 'Acelgas', 'verduras'], ['aguacate', 'Aguacate', 'verduras'],
  ['ajo', 'Ajo', 'verduras'], ['alcachofa', 'Alcachofas', 'verduras'],
  ['alcaparra', 'Alcaparras', 'verduras'], ['apio', 'Apio', 'verduras'],
  ['berenjena', 'Berenjena', 'verduras'], ['boniato', 'Boniato', 'verduras'],
  ['brócoli', 'Brócoli', 'verduras'], ['brocoli', 'Brócoli', 'verduras'],
  ['calabacín', 'Calabacín', 'verduras'], ['calabaza', 'Calabaza', 'verduras'],
  ['cebolleta', 'Cebolleta', 'verduras'], ['cebollino', 'Cebollino', 'verduras'],
  ['cebolla', 'Cebolla', 'verduras'],
  ['champiñón', 'Champiñones', 'verduras'], ['champiñon', 'Champiñones', 'verduras'],
  ['coliflor', 'Coliflor', 'verduras'], ['endibia', 'Endibia', 'verduras'],
  ['espárrago', 'Espárragos', 'verduras'], ['espinaca', 'Espinacas', 'verduras'],
  ['guisante', 'Guisantes', 'verduras'], ['haba', 'Habas', 'verduras'],
  ['hinojo', 'Hinojo', 'verduras'], ['jengibre', 'Jengibre', 'verduras'],
  ['lechuga', 'Lechuga', 'verduras'], ['nabo', 'Nabo', 'verduras'],
  ['patata', 'Patata', 'verduras'], ['papa', 'Patata', 'verduras'],
  ['pepinillo', 'Pepinillos', 'verduras'], ['pepino', 'Pepino', 'verduras'],
  ['pimiento', 'Pimiento', 'verduras'], ['puerro', 'Puerro', 'verduras'],
  ['rabanito', 'Rabanitos', 'verduras'], ['rábano', 'Rabanitos', 'verduras'],
  ['remolacha', 'Remolacha', 'verduras'],
  ['rúcula', 'Rúcula', 'verduras'], ['rucula', 'Rúcula', 'verduras'],
  ['seta', 'Setas', 'verduras'], ['tomate', 'Tomate', 'verduras'],
  ['zanahoria', 'Zanahoria', 'verduras'], ['aceituna', 'Aceitunas', 'verduras'],
  ['germinado', 'Germinados', 'verduras'], ['maíz', 'Maíz', 'verduras'],
  ['col', 'Col', 'verduras'], ['repollo', 'Repollo', 'verduras'],
  // Carnes
  ['bacon', 'Bacon', 'carnes'], ['cerdo', 'Cerdo', 'carnes'],
  ['chorizo', 'Chorizo', 'carnes'], ['codorniz', 'Codorniz', 'carnes'],
  ['conejo', 'Conejo', 'carnes'], ['cordero', 'Cordero', 'carnes'],
  ['costilla', 'Costillas', 'carnes'], ['foie', 'Foie', 'carnes'],
  ['jamón', 'Jamón', 'carnes'], ['jamon', 'Jamón', 'carnes'],
  ['lomo', 'Lomo', 'carnes'], ['morcilla', 'Morcilla', 'carnes'],
  ['muslo', 'Pollo (muslos)', 'carnes'], ['oreja', 'Oreja', 'carnes'],
  ['panceta', 'Panceta', 'carnes'], ['pavo', 'Pavo', 'carnes'],
  ['pechuga', 'Pollo (pechuga)', 'carnes'], ['pollo', 'Pollo', 'carnes'],
  ['salchicha', 'Salchichas', 'carnes'], ['solomillo', 'Solomillo', 'carnes'],
  ['ternera', 'Ternera', 'carnes'], ['carne', 'Carne', 'carnes'],
  ['hueso', 'Hueso', 'carnes'],
  // Pescados y mariscos
  ['almeja', 'Almejas', 'pescados'], ['anchoa', 'Anchoas', 'pescados'],
  ['atún', 'Atún', 'pescados'], ['atun', 'Atún', 'pescados'],
  ['bacalao', 'Bacalao', 'pescados'], ['boquerón', 'Boquerones', 'pescados'],
  ['calamar', 'Calamares', 'pescados'], ['dorada', 'Dorada', 'pescados'],
  ['gamba', 'Gambas', 'pescados'], ['langostino', 'Langostinos', 'pescados'],
  ['lubina', 'Lubina', 'pescados'],
  ['mejillón', 'Mejillones', 'pescados'], ['mejillon', 'Mejillones', 'pescados'],
  ['merluza', 'Merluza', 'pescados'], ['pescadilla', 'Pescadilla', 'pescados'],
  ['pulpo', 'Pulpo', 'pescados'], ['rape', 'Rape', 'pescados'],
  ['salmón', 'Salmón', 'pescados'], ['salmon', 'Salmón', 'pescados'],
  ['sardina', 'Sardinas', 'pescados'], ['sepia', 'Sepia', 'pescados'],
  ['trucha', 'Trucha', 'pescados'], ['pescado', 'Pescado', 'pescados'],
  ['marisco', 'Marisco', 'pescados'],
  // Frutas
  ['limón', 'Limón', 'frutas'], ['limon', 'Limón', 'frutas'],
  ['naranja', 'Naranja', 'frutas'], ['manzana', 'Manzana', 'frutas'],
  ['fresa', 'Fresas', 'frutas'], ['kiwi', 'Kiwi', 'frutas'],
  ['plátano', 'Plátano', 'frutas'], ['pera', 'Pera', 'frutas'],
  ['uva', 'Uvas', 'frutas'], ['melocotón', 'Melocotón', 'frutas'],
  ['frambuesa', 'Frambuesas', 'frutas'], ['arándano', 'Arándanos', 'frutas'],
  ['piña', 'Piña', 'frutas'], ['mango', 'Mango', 'frutas'],
  // Lácteos y huevos
  ['huevo', 'Huevos', 'lacteos'], ['leche', 'Leche', 'lacteos'],
  ['nata', 'Nata', 'lacteos'], ['queso', 'Queso', 'lacteos'],
  ['yogur', 'Yogur', 'lacteos'], ['mantequilla', 'Mantequilla', 'lacteos'],
  ['requesón', 'Requesón', 'lacteos'], ['mozzarella', 'Mozzarella', 'lacteos'],
  // Cereales y legumbres
  ['arroz', 'Arroz', 'cereales'], ['cuscús', 'Cuscús', 'cereales'], ['cuscus', 'Cuscús', 'cereales'],
  ['espagueti', 'Espaguetis', 'cereales'], ['fideo', 'Fideos', 'cereales'],
  ['garbanzo', 'Garbanzos', 'cereales'], ['harina', 'Harina', 'cereales'],
  ['lenteja', 'Lentejas', 'cereales'], ['levadura', 'Levadura', 'cereales'],
  ['macarrón', 'Macarrones', 'cereales'],
  ['pan', 'Pan', 'cereales'], ['pasta', 'Pasta', 'cereales'],
  ['pochas', 'Pochas', 'cereales'], ['polenta', 'Polenta', 'cereales'],
  ['alubia', 'Alubias', 'cereales'], ['judión', 'Judiones', 'cereales'],
  ['avena', 'Avena', 'cereales'], ['sémola', 'Sémola', 'cereales'],
  // Especias y condimentos
  ['albahaca', 'Albahaca', 'especias'], ['azafrán', 'Azafrán', 'especias'],
  ['canela', 'Canela', 'especias'], ['cilantro', 'Cilantro', 'especias'],
  ['comino', 'Comino', 'especias'], ['curry', 'Curry', 'especias'],
  ['guindilla', 'Guindilla', 'especias'], ['laurel', 'Laurel', 'especias'],
  ['orégano', 'Orégano', 'especias'], ['perejil', 'Perejil', 'especias'],
  ['pimentón', 'Pimentón', 'especias'], ['pimenton', 'Pimentón', 'especias'],
  ['pimienta', 'Pimienta', 'especias'], ['romero', 'Romero', 'especias'],
  ['sal', 'Sal', 'especias'], ['tomillo', 'Tomillo', 'especias'],
  ['clavo', 'Clavo', 'especias'],
  // Aceites y vinagres
  ['aceite', 'Aceite', 'aceites'], ['vinagre', 'Vinagre', 'aceites'],
  // Frutos secos y otros
  ['almendra', 'Almendras', 'otros'], ['avellana', 'Avellanas', 'otros'],
  ['nuez', 'Nueces', 'otros'], ['nuec', 'Nueces', 'otros'],
  ['piñón', 'Piñones', 'otros'], ['piñon', 'Piñones', 'otros'],
  ['sésamo', 'Sésamo', 'otros'], ['sesamo', 'Sésamo', 'otros'],
  ['tahini', 'Tahini', 'otros'], ['cacahuete', 'Cacahuetes', 'otros'],
  ['cerveza', 'Cerveza', 'otros'], ['caldo', 'Caldo', 'otros'],
  ['miel', 'Miel', 'otros'], ['azúcar', 'Azúcar', 'otros'], ['azucar', 'Azúcar', 'otros'],
  ['chocolate', 'Chocolate', 'otros'], ['txakoli', 'Txakoli', 'otros'],
];

// Ingredientes que no son de compra (pantry/agua/hielo)
const EXCLUIR_LISTA = ['agua', 'hielo', 'cubito'];

// Comprueba si un keyword coincide respetando fronteras de palabra (evita "sal" en "salmón")
function matchKeyword(text: string, keyword: string): boolean {
  const lower = text.toLowerCase();
  const kw = keyword.toLowerCase();
  if (kw.includes(' ')) return lower.includes(kw);
  const idx = lower.indexOf(kw);
  if (idx === -1) return false;
  if (idx > 0 && /[a-záéíóúüñ]/i.test(lower[idx - 1])) return false;
  const endIdx = idx + kw.length;
  if (endIdx < lower.length) {
    const rest = lower.slice(endIdx);
    if (/^[a-záéíóúüñ]/.test(rest) && !/^(s|es|as)([^a-záéíóúüñ]|$)/.test(rest)) return false;
  }
  return true;
}

// Resuelve un ingrediente raw → { nombre canónico, categoría }
function resolverIngrediente(raw: string): { nombre: string; cat: string } | null {
  const lower = raw.toLowerCase();
  if (EXCLUIR_LISTA.some(e => matchKeyword(lower, e))) return null;
  for (const [kw, canonical, cat] of CANONICAL) {
    if (matchKeyword(raw, kw)) return { nombre: canonical, cat };
  }
  // Fallback: limpiar básicamente sin destruir palabras
  let cleaned = raw.trim()
    .replace(/^[\d½¼¾⅓⅔,./-]+\s*/, '')
    .replace(/^(kg|g|gr|ml|cl|dl|l|cucharadas?|cucharaditas?|vasos?|tazas?|lonchas?|filetes?|rebanadas?|ramas?|dientes?|hojas?)\s+(de\s+)?/i, '')
    .replace(/^de\s+/i, '')
    .replace(/\s+(al gusto|opcional|para .*)$/i, '')
    .replace(/\s*\(.*?\)/g, '')
    .trim();
  if (!cleaned) return null;
  const nombre = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return { nombre, cat: 'otros' };
}

interface IngredienteAgrupado {
  nombre: string;
  menciones: string[];
}

function agruparIngredientes(todosRaw: string[]): Record<string, IngredienteAgrupado[]> {
  const mapa = new Map<string, { nombre: string; menciones: string[]; cat: string }>();

  for (const raw of todosRaw) {
    if (!raw || raw.trim().length < 2) continue;
    const resolved = resolverIngrediente(raw);
    if (!resolved) continue;

    const key = `${resolved.cat}::${resolved.nombre}`;
    if (mapa.has(key)) {
      mapa.get(key)!.menciones.push(raw.trim());
    } else {
      mapa.set(key, { nombre: resolved.nombre, menciones: [raw.trim()], cat: resolved.cat });
    }
  }

  const resultado: Record<string, IngredienteAgrupado[]> = {};
  for (const item of mapa.values()) {
    if (!resultado[item.cat]) resultado[item.cat] = [];
    resultado[item.cat].push({ nombre: item.nombre, menciones: item.menciones });
  }
  for (const cat of Object.keys(resultado)) {
    resultado[cat].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }
  return resultado;
}

function ListaCompra({ menuData, personas }: { menuData: MenuData; personas: number }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [expandido, setExpandido] = useState<Set<string>>(new Set());
  const [copiadoOk, setCopiadoOk] = useState(false);

  const todosIngredientes: string[] = [];
  for (const dia of menuData.menu) {
    if (dia.comida?.ingredientes) todosIngredientes.push(...dia.comida.ingredientes);
    if (dia.cena?.ingredientes) todosIngredientes.push(...dia.cena.ingredientes);
  }

  const agrupados = agruparIngredientes(todosIngredientes);
  const ordenCategorias = ['carnes', 'pescados', 'verduras', 'frutas', 'lacteos', 'cereales', 'especias', 'aceites', 'otros'];
  const categoriasConItems = ordenCategorias.filter(cat => agrupados[cat]?.length);

  const totalItems = Object.values(agrupados).reduce((sum, arr) => sum + arr.length, 0);
  const totalChecked = checked.size;

  const toggle = (nombre: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  };

  const toggleDetalle = (nombre: string) => {
    setExpandido(prev => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  };

  const copiarLista = () => {
    const lines: string[] = [`Lista de la compra (${personas} personas)\n`];
    for (const cat of categoriasConItems) {
      const info = CAT_DISPLAY[cat];
      lines.push(`\n${info.emoji} ${info.label}:`);
      for (const item of agrupados[cat]) {
        const mark = checked.has(item.nombre) ? '[x]' : '[ ]';
        const detalle = item.menciones.length > 1 ? ` (×${item.menciones.length} recetas)` : '';
        lines.push(`  ${mark} ${item.nombre}${detalle}`);
        if (item.menciones.length > 1) {
          for (const m of item.menciones) lines.push(`      · ${m}`);
        }
      }
    }
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiadoOk(true);
    setTimeout(() => setCopiadoOk(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
      <div className="flex flex-col gap-2 bg-accent px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xl font-bold text-[var(--color-accent-contrast)]">
          Lista de la compra
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--color-accent-contrast)]/80">
            {totalChecked}/{totalItems}
          </span>
          <button
            onClick={copiarLista}
            className="rounded-full bg-[var(--color-accent-contrast)]/15 px-4 py-1.5 text-sm font-medium text-[var(--color-accent-contrast)] transition-all hover:bg-[var(--color-accent-contrast)]/25"
          >
            {copiadoOk ? 'Copiada' : 'Copiar lista'}
          </button>
        </div>
      </div>

      {totalChecked > 0 && (
        <div className="bg-accent-soft px-6 py-2">
          <div className="h-2 w-full rounded-full bg-border">
            <div
              className="h-2 rounded-full bg-accent transition-all duration-300"
              style={{ width: `${(totalChecked / totalItems) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 lg:grid-cols-3">
        {categoriasConItems.map(cat => {
          const info = CAT_DISPLAY[cat];
          const items = agrupados[cat];
          return (
            <div key={cat}>
              <h4 className="mb-3 flex items-baseline gap-2 text-sm font-bold uppercase tracking-wide text-fg">
                {info.label}
                <span className="font-normal text-fg-subtle">({items.length})</span>
              </h4>
              <ul className="space-y-1">
                {items.map(item => (
                  <li key={item.nombre}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggle(item.nombre)}
                        className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-all ${
                          checked.has(item.nombre)
                            ? 'bg-success/10 text-fg-subtle line-through'
                            : 'text-fg hover:bg-accent-soft/60'
                        }`}
                      >
                        <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-all ${
                          checked.has(item.nombre)
                            ? 'border-success bg-success text-white'
                            : 'border-border-strong'
                        }`}>
                          {checked.has(item.nombre) && (
                            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                        <span>{item.nombre}</span>
                        {item.menciones.length > 1 && (
                          <span className="ml-auto whitespace-nowrap text-xs font-medium text-accent">
                            en {item.menciones.length} recetas
                          </span>
                        )}
                      </button>
                      {item.menciones.length > 1 && (
                        <button
                          onClick={() => toggleDetalle(item.nombre)}
                          className="p-1 text-fg-subtle transition-colors hover:text-fg"
                          title="Ver cantidades"
                        >
                          <svg className={`w-4 h-4 transition-transform ${expandido.has(item.nombre) ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                          </svg>
                        </button>
                      )}
                    </div>
                    {expandido.has(item.nombre) && item.menciones.length > 1 && (
                      <ul className="ml-10 mt-1 mb-2 space-y-0.5">
                        {item.menciones.map((m, i) => (
                          <li key={i} className="text-xs italic text-fg-subtle">• {m}</li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border bg-canvas px-6 py-4 text-center text-sm text-fg-muted">
        Ingredientes de <strong className="text-fg">{menuData.menu.length} días</strong> para <strong className="text-fg">{personas} personas</strong> · Pulsa ▾ para ver cantidades por receta
      </div>
    </div>
  );
}

function PlanBanner({ planInfo, baseUrl }: { planInfo: PlanInfo; baseUrl: string }) {
  if (!planInfo.loggedIn) {
    return (
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-accent/40 bg-accent-soft p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent">
            Crea tu cuenta gratis para generar tu menú con IA
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            Sin tarjeta, sin compromiso. 1 generación cada 2 meses incluida.
          </p>
        </div>
        <a
          href={`${baseUrl}registro?next=/menu-semanal`}
          className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition-colors hover:bg-accent-hover"
        >
          Crear cuenta
        </a>
      </div>
    );
  }

  if (planInfo.plan === 'pro') {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-3 text-sm text-fg-muted">
        <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent-contrast)]">
          Pro
        </span>
        Generaciones ilimitadas. Opciones avanzadas activadas.
      </div>
    );
  }

  if (planInfo.trialActive) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-surface px-5 py-3 text-sm text-fg-muted">
        <span className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
          Trial
        </span>
        Disfruta de generaciones ilimitadas durante tu prueba.
      </div>
    );
  }

  if (!planInfo.canGenerateMenu && planInfo.menuCooldownUntil) {
    const fecha = new Date(planInfo.menuCooldownUntil).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
    });
    return (
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-fg">
            Ya usaste tu generación gratuita
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            Disponible de nuevo el {fecha}. O prueba Pro 10 días gratis sin tarjeta.
          </p>
        </div>
        <a
          href={`${baseUrl}precios`}
          className="shrink-0 rounded-full border border-accent bg-surface px-5 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-[var(--color-accent-contrast)]"
        >
          Ver Pro
        </a>
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-surface px-5 py-3 text-sm text-fg-muted sm:flex-row sm:items-center sm:justify-between">
      <span>Plan gratis: 1 generación disponible.</span>
      {!planInfo.trialUsed && (
        <a
          href={`${baseUrl}precios`}
          className="text-xs font-semibold text-accent hover:underline"
        >
          Probar Pro 10 días gratis →
        </a>
      )}
    </div>
  );
}

function Paywall({ paywall, baseUrl }: { paywall: ApiError; baseUrl: string }) {
  const isAuth = paywall.error === 'auth_required';
  const message = paywall.message || 'No tienes acceso a esta función.';
  const ctaHref =
    isAuth && 'redirect' in paywall && paywall.redirect
      ? `${baseUrl}${paywall.redirect.replace(/^\//, '')}`
      : 'upgrade' in paywall && paywall.upgrade
        ? `${baseUrl}${paywall.upgrade.replace(/^\//, '')}`
        : `${baseUrl}precios`;
  const ctaLabel = isAuth ? 'Crear cuenta gratis' : 'Ver Plan Pro';

  return (
    <div className="mb-8 rounded-2xl border-2 border-accent/40 bg-accent-soft p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            {isAuth ? 'Necesitas una cuenta' : 'Función Pro'}
          </p>
          <p className="mt-1 text-base font-semibold text-fg">{message}</p>
        </div>
        <a
          href={ctaHref}
          className="shrink-0 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition-colors hover:bg-accent-hover"
        >
          {ctaLabel}
        </a>
      </div>
    </div>
  );
}

function RecetaCard({
  receta,
  momento,
  emoji,
  getImageSrc,
}: {
  receta: RecetaMenu;
  momento: string;
  emoji: string;
  getImageSrc: (img: string) => string;
}) {
  if (!receta.title) {
    return (
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
          {emoji} {momento}
        </div>
        <div className="rounded-xl bg-canvas p-3 text-sm italic text-fg-subtle">
          Receta no disponible
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
        {emoji} {momento}
      </div>
      <a
        href={`${siteBase}recetas/${receta.slug}/`}
        target="_blank"
        rel="noopener noreferrer"
        className="group block"
      >
        {receta.imagen && (
          <div className="relative mb-2 overflow-hidden rounded-xl">
            <img
              src={getImageSrc(receta.imagen)}
              alt={receta.title}
              className="h-32 w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            {receta.dificultad && (
              <div className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-medium ${DIFICULTAD_COLORES[receta.dificultad] || ''}`}>
                {DIFICULTAD_NOMBRE[receta.dificultad] || receta.dificultad}
              </div>
            )}
          </div>
        )}
        <h4 className="text-sm font-bold leading-tight text-fg transition-colors group-hover:text-accent">
          {receta.title}
        </h4>
        <div className="mt-1 flex items-center gap-3 text-xs text-fg-muted">
          {receta.tiempo && <span>{receta.tiempo}</span>}
        </div>
        {receta.razon && (
          <p className="mt-1 text-xs italic leading-snug text-fg-subtle">
            {receta.razon}
          </p>
        )}
      </a>
    </div>
  );
}
