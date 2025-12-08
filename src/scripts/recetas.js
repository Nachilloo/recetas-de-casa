// Estado de filtros
let categoriaActiva = null;
let busquedaActiva = '';

// Elementos del DOM
const searchInput = document.getElementById('searchInput');
const categoryFilters = document.querySelectorAll('.category-filter');
const recetaItems = document.querySelectorAll('.receta-item');
const activeFilters = document.getElementById('activeFilters');
const filterTags = document.getElementById('filterTags');
const clearAllFilters = document.getElementById('clearAllFilters');
const sectionTitle = document.getElementById('sectionTitle');
const resultCount = document.getElementById('resultCount');
const recetasContainer = document.getElementById('recetasContainer');
const emptyState = document.getElementById('emptyState');
const showAllRecetas = document.getElementById('showAllRecetas');

// Categorías
const categorias = {
  'arroz-paellas': 'Arroces y Paellas',
  'tortillas-pasta': 'Tortillas y Pasta', 
  'sopas-cremas': 'Sopas y Cremas',
  'carnes-aves': 'Carnes y Aves',
  'pescados-mariscos': 'Pescados y Mariscos',
  'pan-masas': 'Pan y Masas',
  'postres': 'Postres',
  'tapas-aperitivos': 'Tapas y Aperitivos'
};

// Función para leer parámetros URL del navegador
function leerParametrosURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const categoria = urlParams.get('categoria');
  const busqueda = urlParams.get('q');
  
  // Aplicar categoría desde URL
  if (categoria && categorias.hasOwnProperty(categoria)) {
    categoriaActiva = categoria;
    // Activar visualmente la categoría
    categoryFilters.forEach(btn => {
      if (btn.dataset.categoria === categoria) {
        btn.classList.remove('bg-white', 'border-gray-200');
        btn.classList.add('bg-orange-100', 'border-orange-300', 'text-orange-800');
      }
    });
  }
  
  // Aplicar búsqueda desde URL
  if (busqueda) {
    busquedaActiva = busqueda;
    if (searchInput) searchInput.value = busqueda;
  }
  
  // Aplicar filtros si hay parámetros
  if (categoria || busqueda) {
    aplicarFiltros();
    // Actualizar URL sin los parámetros para limpiar la barra de direcciones
    window.history.replaceState({}, '', '/recetas');
  }
}

// Función para aplicar filtros
function aplicarFiltros() {
  let recetasVisibles = 0;
  
  recetaItems.forEach(item => {
    let mostrar = true;
    
    // Filtro por categoría
    if (categoriaActiva && item.dataset.categoria !== categoriaActiva) {
      mostrar = false;
    }
    
    // Filtro por búsqueda
    if (busquedaActiva) {
      const termino = busquedaActiva.toLowerCase();
      const titulo = item.dataset.titulo;
      const descripcion = item.dataset.descripcion;
      const tags = item.dataset.tags;
      
      if (!titulo.includes(termino) && !descripcion.includes(termino) && !tags.includes(termino)) {
        mostrar = false;
      }
    }
    
    item.style.display = mostrar ? 'block' : 'none';
    if (mostrar) recetasVisibles++;
  });
  
  // Actualizar UI
  actualizarUI(recetasVisibles);
}

// Función para actualizar la interfaz
function actualizarUI(recetasVisibles) {
  // Mostrar/ocultar estado vacío
  if (recetasVisibles === 0) {
    if (recetasContainer) recetasContainer.style.display = 'none';
    if (emptyState) emptyState.classList.remove('hidden');
  } else {
    if (recetasContainer) recetasContainer.style.display = 'grid';
    if (emptyState) emptyState.classList.add('hidden');
  }
  
  // Actualizar contador
  if (resultCount) {
    resultCount.textContent = `${recetasVisibles} receta${recetasVisibles !== 1 ? 's' : ''} encontrada${recetasVisibles !== 1 ? 's' : ''}`;
  }
  
  // Actualizar título
  let titulo = '🍽️ Todas las Recetas';
  if (categoriaActiva) {
    titulo = `🍽️ ${categorias[categoriaActiva]}`;
  }
  if (busquedaActiva) {
    titulo = `🔍 Resultados para "${busquedaActiva}"`;
  }
  if (sectionTitle) sectionTitle.textContent = titulo;
  
  // Actualizar filtros activos
  actualizarFiltrosActivos();
}

// Función para actualizar filtros activos
function actualizarFiltrosActivos() {
  if (!filterTags) return;
  
  filterTags.innerHTML = '';
  let hayFiltros = false;
  
  if (categoriaActiva) {
    hayFiltros = true;
    const tag = document.createElement('div');
    tag.className = 'flex items-center bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm';
    tag.innerHTML = `
      <span>${categorias[categoriaActiva]}</span>
      <button class="ml-2 hover:text-orange-600" onclick="limpiarCategoria()">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    `;
    filterTags.appendChild(tag);
  }
  
  if (busquedaActiva) {
    hayFiltros = true;
    const tag = document.createElement('div');
    tag.className = 'flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm';
    tag.innerHTML = `
      <span>"${busquedaActiva}"</span>
      <button class="ml-2 hover:text-blue-600" onclick="limpiarBusqueda()">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    `;
    filterTags.appendChild(tag);
  }
  
  if (activeFilters) {
    activeFilters.classList.toggle('hidden', !hayFiltros);
  }
}

// Event listeners para categorías
categoryFilters.forEach(button => {
  button.addEventListener('click', () => {
    const categoria = button.dataset.categoria;
    
    // Toggle categoría
    if (categoriaActiva === categoria) {
      categoriaActiva = null;
      button.classList.remove('bg-orange-100', 'border-orange-300', 'text-orange-800');
      button.classList.add('bg-white', 'border-gray-200');
    } else {
      // Limpiar categoría anterior
      categoryFilters.forEach(btn => {
        btn.classList.remove('bg-orange-100', 'border-orange-300', 'text-orange-800');
        btn.classList.add('bg-white', 'border-gray-200');
      });
      
      // Activar nueva categoría
      categoriaActiva = categoria;
      button.classList.remove('bg-white', 'border-gray-200');
      button.classList.add('bg-orange-100', 'border-orange-300', 'text-orange-800');
    }
    
    aplicarFiltros();
  });
});

// Event listener para búsqueda
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    busquedaActiva = e.target.value.trim();
    aplicarFiltros();
  });
}

// Funciones globales para limpiar filtros
window.limpiarCategoria = () => {
  categoriaActiva = null;
  categoryFilters.forEach(btn => {
    btn.classList.remove('bg-orange-100', 'border-orange-300', 'text-orange-800');
    btn.classList.add('bg-white', 'border-gray-200');
  });
  aplicarFiltros();
};

window.limpiarBusqueda = () => {
  busquedaActiva = '';
  if (searchInput) searchInput.value = '';
  aplicarFiltros();
};

// Event listener para limpiar todos los filtros
if (clearAllFilters) {
  clearAllFilters.addEventListener('click', () => {
    window.limpiarCategoria();
    window.limpiarBusqueda();
  });
}

if (showAllRecetas) {
  showAllRecetas.addEventListener('click', () => {
    window.limpiarCategoria();
    window.limpiarBusqueda();
  });
}

// Inicializar: leer parámetros URL cuando la página carga
document.addEventListener('DOMContentLoaded', () => {
  leerParametrosURL();
});
