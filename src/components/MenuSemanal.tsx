import { useState, useEffect } from 'react';

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

interface MenuGuardado {
  id: string;
  fecha: string;
  nombre: string;
  menuData: MenuData;
  personas: number;
  tipo: string;
}

const STORAGE_KEY = 'menus_guardados';

const CATEGORIAS: Record<string, string> = {
  'arroz-paellas': '🥘',
  'tortillas-pasta': '🥚',
  'sopas-cremas': '🍲',
  'carnes-aves': '🍖',
  'pescados-mariscos': '🐟',
  'pan-masas': '🥖',
  'postres': '🍰',
  'ensaladas-tapas': '🥗',
  'air-fryer': '🍗',
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
  const [temporada, setTemporada] = useState(false);
  const [loading, setLoading] = useState(false);
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menusGuardados, setMenusGuardados] = useState<MenuGuardado[]>([]);
  const [guardadoOk, setGuardadoOk] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      setMenusGuardados(saved);
    } catch { /* ignore */ }
  }, []);

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
          temporada,
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
            <div className="flex flex-col gap-2">
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
                    <div className="font-semibold">Aprovechamiento</div>
                    <div className="text-xs opacity-75">
                      Reutiliza ingredientes entre días
                    </div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setTemporada(!temporada)}
                className={`w-full px-4 py-3 rounded-lg text-sm font-medium transition-all text-left ${
                  temporada
                    ? 'bg-amber-100 border-2 border-amber-400 text-amber-800'
                    : 'bg-gray-50 border-2 border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">🍅</span>
                  <div>
                    <div className="font-semibold">Productos de temporada</div>
                    <div className="text-xs opacity-75">
                      Prioriza ingredientes de temporada en España
                    </div>
                  </div>
                </div>
              </button>
            </div>
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
              onClick={guardarMenu}
              className="px-6 py-3 bg-white border-2 border-green-300 text-green-600 rounded-full font-semibold hover:bg-green-50 transition-all"
            >
              {guardadoOk ? '✅ Guardado' : '💾 Guardar menú'}
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

          {/* Lista de la compra */}
          <ListaCompra menuData={menuData} personas={personas} />
        </div>
      )}

      {/* Menús guardados */}
      {menusGuardados.length > 0 && (
        <div className="mt-8 bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>📋</span> Menús guardados
            <span className="text-sm font-normal text-gray-400">({menusGuardados.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {menusGuardados.map(saved => (
              <div
                key={saved.id}
                className="border border-gray-200 rounded-xl p-4 hover:border-orange-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{saved.nombre}</p>
                    <p className="text-xs text-gray-400">{saved.fecha}</p>
                  </div>
                  <button
                    onClick={() => borrarMenu(saved.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1"
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>
                </div>
                <div className="text-xs text-gray-500 mb-3">
                  {saved.menuData.menu.length} días ·{' '}
                  {saved.menuData.menu.filter(d => d.comida).length + saved.menuData.menu.filter(d => d.cena).length} recetas
                </div>
                <button
                  onClick={() => cargarMenu(saved)}
                  className="w-full px-3 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-100 transition-all"
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
    const lines: string[] = [`🛒 Lista de la compra (${personas} personas)\n`];
    for (const cat of categoriasConItems) {
      const info = CAT_DISPLAY[cat];
      lines.push(`\n${info.emoji} ${info.label}:`);
      for (const item of agrupados[cat]) {
        const mark = checked.has(item.nombre) ? '✅' : '⬜';
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
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h3 className="text-white font-bold text-xl flex items-center gap-2">
          🛒 Lista de la Compra
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-white/80 text-sm">
            {totalChecked}/{totalItems}
          </span>
          <button
            onClick={copiarLista}
            className="px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white text-sm rounded-full font-medium transition-all"
          >
            {copiadoOk ? '✅ Copiada' : '📋 Copiar lista'}
          </button>
        </div>
      </div>

      {totalChecked > 0 && (
        <div className="bg-blue-50 px-6 py-2">
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(totalChecked / totalItems) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categoriasConItems.map(cat => {
          const info = CAT_DISPLAY[cat];
          const items = agrupados[cat];
          return (
            <div key={cat}>
              <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                <span className="text-lg">{info.emoji}</span>
                {info.label}
                <span className="text-gray-400 font-normal">({items.length})</span>
              </h4>
              <ul className="space-y-1">
                {items.map(item => (
                  <li key={item.nombre}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggle(item.nombre)}
                        className={`flex-1 text-left flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all ${
                          checked.has(item.nombre)
                            ? 'bg-green-50 text-gray-400 line-through'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                          checked.has(item.nombre)
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300'
                        }`}>
                          {checked.has(item.nombre) && (
                            <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </span>
                        <span>{item.nombre}</span>
                        {item.menciones.length > 1 && (
                          <span className="text-xs text-orange-500 font-medium ml-auto whitespace-nowrap">
                            en {item.menciones.length} recetas
                          </span>
                        )}
                      </button>
                      {item.menciones.length > 1 && (
                        <button
                          onClick={() => toggleDetalle(item.nombre)}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
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
                          <li key={i} className="text-xs text-gray-400 italic">• {m}</li>
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

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 text-center text-sm text-gray-500">
        Ingredientes de <strong>{menuData.menu.length} días</strong> para <strong>{personas} personas</strong> · Pulsa ▾ para ver cantidades por receta
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
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          {emoji} {momento}
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-400 italic">
          Receta no disponible
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {emoji} {momento}
      </div>
      <a
        href={`/recetas/${receta.slug}/`}
        target="_blank"
        rel="noopener noreferrer"
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
