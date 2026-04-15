import { useState } from 'react';

interface RecetaMenu {
  slug: string;
  title: string;
  categoria: string;
  dificultad: string;
  tiempo: string;
  imagen: string;
  razon: string;
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

const CATEGORIAS: Record<string, string> = {
  'arroz-paellas': '🥘',
  'tortillas-pasta': '🥚',
  'sopas-cremas': '🍲',
  'carnes-aves': '🍖',
  'pescados-mariscos': '🐟',
  'pan-masas': '🥖',
  'postres': '🍰',
  'ensaladas-tapas': '🥗',
};

const DIFICULTAD_COLORES: Record<string, string> = {
  'facil': 'bg-green-100 text-green-800',
  'media': 'bg-yellow-100 text-yellow-800',
  'dificil': 'bg-red-100 text-red-800',
};

const DIFICULTAD_NOMBRE: Record<string, string> = {
  'facil': 'Fácil',
  'media': 'Media',
  'dificil': 'Difícil',
};

export default function MenuSemanal() {
  const [tipo, setTipo] = useState<'comida' | 'cena' | 'ambos'>('ambos');
  const [personas, setPersonas] = useState(4);
  const [dificultadMax, setDificultadMax] = useState('dificil');
  const [aprovechamiento, setAprovechamiento] = useState(false);
  const [loading, setLoading] = useState(false);
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generarMenu = async () => {
    setLoading(true);
    setError(null);
    setMenuData(null);

    try {
      const res = await fetch('/api/menu/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          personas,
          dificultadMax,
          aprovechamiento,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error generando menú');
      }

      const data: MenuData = await res.json();
      setMenuData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const exportarCalendar = async () => {
    if (!menuData) return;

    try {
      const res = await fetch('/api/menu/calendar', {
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
    img?.startsWith('http') ? img : `/${img?.replace(/^\//, '')}`;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Configuración */}
      <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 border border-gray-100 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
          <span className="text-3xl">⚙️</span>
          Configura tu menú
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Tipo de comida */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Tipo de comida
            </label>
            <div className="flex flex-col gap-2">
              {[
                { value: 'comida' as const, label: '🍽️ Solo comida', desc: 'Almuerzo' },
                { value: 'cena' as const, label: '🌙 Solo cena', desc: 'Cena' },
                { value: 'ambos' as const, label: '📅 Ambos', desc: 'Comida + Cena' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTipo(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                    tipo === opt.value
                      ? 'bg-orange-100 border-2 border-orange-400 text-orange-800'
                      : 'bg-gray-50 border-2 border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Personas */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Comensales
            </label>
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border-2 border-gray-200">
              <button
                onClick={() => setPersonas(Math.max(1, personas - 1))}
                className="w-10 h-10 rounded-full bg-white border-2 border-gray-300 text-gray-600 font-bold hover:border-orange-400 hover:text-orange-600 transition-all"
              >
                -
              </button>
              <span className="text-3xl font-bold text-gray-900 flex-1 text-center">
                {personas}
              </span>
              <button
                onClick={() => setPersonas(Math.min(12, personas + 1))}
                className="w-10 h-10 rounded-full bg-white border-2 border-gray-300 text-gray-600 font-bold hover:border-orange-400 hover:text-orange-600 transition-all"
              >
                +
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">personas</p>
          </div>

          {/* Dificultad */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Dificultad máxima
            </label>
            <div className="flex flex-col gap-2">
              {[
                { value: 'facil', label: '🟢 Fácil', desc: 'Recetas sencillas' },
                { value: 'media', label: '🟡 Media', desc: 'Algo más elaboradas' },
                { value: 'dificil', label: '🔴 Todas', desc: 'Sin restricción' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDificultadMax(opt.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                    dificultadMax === opt.value
                      ? 'bg-orange-100 border-2 border-orange-400 text-orange-800'
                      : 'bg-gray-50 border-2 border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opciones extra */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Opciones
            </label>
            <button
              onClick={() => setAprovechamiento(!aprovechamiento)}
              className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${
                aprovechamiento
                  ? 'bg-green-100 border-2 border-green-400 text-green-800'
                  : 'bg-gray-50 border-2 border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">♻️</span>
                <div>
                  <div className="font-semibold">Menú aprovechamiento</div>
                  <div className="text-xs opacity-75">
                    Reutiliza ingredientes entre días
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Botón generar */}
        <div className="mt-8 text-center">
          <button
            onClick={generarMenu}
            disabled={loading}
            className={`px-10 py-4 rounded-full font-bold text-lg transition-all duration-300 shadow-lg ${
              loading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 hover:-translate-y-1 hover:shadow-xl'
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
              '🧑‍🍳 Generar Menú Semanal'
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-8 text-red-700 text-center">
          {error}
        </div>
      )}

      {/* Resultado del menú */}
      {menuData && (
        <div className="space-y-8">
          {/* Resumen nutricional */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-lg p-6 border border-green-200">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-green-800 mb-2 flex items-center gap-2">
                  <span>🥗</span> Resumen Nutricional
                </h3>
                <p className="text-green-700">{menuData.resumen_nutricional}</p>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-green-800 mb-2 flex items-center gap-2">
                  <span>💡</span> Consejo de la semana
                </h3>
                <p className="text-green-700">{menuData.consejo_semanal}</p>
              </div>
            </div>
            {menuData.aprovechamiento && (
              <div className="mt-4 pt-4 border-t border-green-200">
                <h3 className="text-lg font-bold text-green-800 mb-2 flex items-center gap-2">
                  <span>♻️</span> Aprovechamiento
                </h3>
                <p className="text-green-700">{menuData.aprovechamiento}</p>
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={generarMenu}
              disabled={loading}
              className="px-6 py-3 bg-white border-2 border-orange-300 text-orange-600 rounded-full font-semibold hover:bg-orange-50 transition-all"
            >
              🔄 Regenerar menú
            </button>
            <button
              onClick={exportarCalendar}
              className="px-6 py-3 bg-white border-2 border-blue-300 text-blue-600 rounded-full font-semibold hover:bg-blue-50 transition-all"
            >
              📅 Exportar a Google Calendar
            </button>
          </div>

          {/* Días del menú */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {menuData.menu.map((dia) => (
              <div
                key={dia.dia}
                className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow"
              >
                {/* Header del día */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-3">
                  <h3 className="text-white font-bold text-lg">{dia.dia}</h3>
                </div>

                <div className="p-4 space-y-4">
                  {/* Comida */}
                  {dia.comida && (
                    <RecetaCard
                      receta={dia.comida}
                      momento="Comida"
                      emoji="🍽️"
                      getImageSrc={getImageSrc}
                    />
                  )}

                  {/* Separador si hay ambos */}
                  {dia.comida && dia.cena && (
                    <div className="border-t border-gray-100" />
                  )}

                  {/* Cena */}
                  {dia.cena && (
                    <RecetaCard
                      receta={dia.cena}
                      momento="Cena"
                      emoji="🌙"
                      getImageSrc={getImageSrc}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
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
  return (
    <div>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {emoji} {momento}
      </div>
      <a
        href={`/recetas/${receta.slug}/`}
        className="group block"
      >
        {receta.imagen && (
          <div className="relative rounded-xl overflow-hidden mb-2">
            <img
              src={getImageSrc(receta.imagen)}
              alt={receta.title}
              className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute top-2 left-2 text-lg">
              {CATEGORIAS[receta.categoria] || '🍽️'}
            </div>
            {receta.dificultad && (
              <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-medium ${DIFICULTAD_COLORES[receta.dificultad] || ''}`}>
                {DIFICULTAD_NOMBRE[receta.dificultad] || receta.dificultad}
              </div>
            )}
          </div>
        )}
        <h4 className="font-bold text-gray-900 group-hover:text-orange-600 transition-colors text-sm leading-tight">
          {receta.title}
        </h4>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          {receta.tiempo && <span>⏱️ {receta.tiempo}</span>}
        </div>
        {receta.razon && (
          <p className="text-xs text-gray-400 mt-1 italic leading-snug">
            {receta.razon}
          </p>
        )}
      </a>
    </div>
  );
}
