import { useState, useEffect } from 'react';
import type { Receta } from '../../lib/types';

interface RecipeFormProps {
  receta?: Receta;
  isEdit?: boolean;
}

export default function RecipeForm({ receta, isEdit = false }: RecipeFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Estados del formulario
  const [title, setTitle] = useState(receta?.title || '');
  const [slug, setSlug] = useState(receta?.slug || '');
  const [categoria, setCategoria] = useState(receta?.categoria || 'postres');
  const [dificultad, setDificultad] = useState(receta?.dificultad || 'facil');
  const [tiempo, setTiempo] = useState(receta?.tiempo || '');
  const [porciones, setPorciones] = useState(receta?.porciones || 4);
  const [imagen, setImagen] = useState(receta?.imagen || '');
  const [imagenAlt, setImagenAlt] = useState(receta?.imagen_alt || '');
  const [descripcion, setDescripcion] = useState(receta?.descripcion || '');
  const [historia, setHistoria] = useState(receta?.historia || '');
  const [calorias, setCalorias] = useState(receta?.calorias || 0);
  const [destacada, setDestacada] = useState(receta?.destacada || false);
  
  // Arrays dinámicos
  const [ingredientes, setIngredientes] = useState<string[]>(receta?.ingredientes || ['']);
  const [pasos, setPasos] = useState<string[]>(receta?.pasos || ['']);
  const [tips, setTips] = useState<string[]>(receta?.tips || ['']);
  const [tags, setTags] = useState<string[]>(receta?.tags || ['']);

  // Auto-generar slug desde el título
  useEffect(() => {
    if (!isEdit && title) {
      const generatedSlug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSlug(generatedSlug);
    }
  }, [title, isEdit]);

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

  const dificultades = {
    'facil': 'Fácil',
    'media': 'Media',
    'dificil': 'Difícil'
  };

  // Funciones para arrays dinámicos
  const addItem = (arr: string[], setter: (arr: string[]) => void) => {
    setter([...arr, '']);
  };

  const removeItem = (arr: string[], index: number, setter: (arr: string[]) => void) => {
    setter(arr.filter((_, i) => i !== index));
  };

  const updateItem = (arr: string[], index: number, value: string, setter: (arr: string[]) => void) => {
    const newArr = [...arr];
    newArr[index] = value;
    setter(newArr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validaciones básicas
    if (!title || !slug || !tiempo || !imagen) {
      setError('Por favor completa todos los campos obligatorios');
      setLoading(false);
      return;
    }

    const recetaData = {
      title,
      slug,
      categoria,
      dificultad,
      tiempo,
      porciones: Number(porciones),
      imagen,
      imagen_alt: imagenAlt,
      descripcion,
      historia,
      ingredientes: ingredientes.filter(i => i.trim()),
      pasos: pasos.filter(p => p.trim()),
      tips: tips.filter(t => t.trim()),
      tags: tags.filter(t => t.trim()),
      calorias: calorias ? Number(calorias) : null,
      destacada
    };

    try {
      const url = isEdit ? `/api/recetas/${receta?.id}` : '/api/recetas';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(recetaData)
      });

      const result = await response.json();

      if (result.success) {
        alert(isEdit ? 'Receta actualizada exitosamente' : 'Receta creada exitosamente');
        window.location.href = '/admin/';
      } else {
        setError(result.error || 'Error al guardar la receta');
      }
    } catch (err) {
      console.error(err);
      setError('Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {isEdit ? '✏️ Editar Receta' : '➕ Nueva Receta'}
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Información básica */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Slug *
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categoría *
            </label>
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              {Object.entries(categorias).map(([key, nombre]) => (
                <option key={key} value={key}>{nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dificultad *
            </label>
            <select
              value={dificultad}
              onChange={(e) => setDificultad(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              {Object.entries(dificultades).map(([key, nombre]) => (
                <option key={key} value={key}>{nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tiempo *
            </label>
            <input
              type="text"
              value={tiempo}
              onChange={(e) => setTiempo(e.target.value)}
              placeholder="ej: 30 min"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Porciones *
            </label>
            <input
              type="number"
              value={porciones}
              onChange={(e) => setPorciones(Number(e.target.value))}
              min="1"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Calorías (opcional)
            </label>
            <input
              type="number"
              value={calorias || ''}
              onChange={(e) => setCalorias(Number(e.target.value))}
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="destacada"
              checked={destacada}
              onChange={(e) => setDestacada(e.target.checked)}
              className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
            />
            <label htmlFor="destacada" className="ml-2 text-sm font-medium text-gray-700">
              Marcar como destacada
            </label>
          </div>
        </div>

        {/* Imagen */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            URL de la Imagen *
          </label>
          <input
            type="text"
            value={imagen}
            onChange={(e) => setImagen(e.target.value)}
            placeholder="/images/recetas/mi-receta.webp"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
          {imagen && (
            <img src={imagen} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded-lg" />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Texto alternativo de la imagen
          </label>
          <input
            type="text"
            value={imagenAlt}
            onChange={(e) => setImagenAlt(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Descripción
          </label>
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Historia */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Historia
          </label>
          <textarea
            value={historia}
            onChange={(e) => setHistoria(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>

        {/* Ingredientes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ingredientes *
          </label>
          {ingredientes.map((ingrediente, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                value={ingrediente}
                onChange={(e) => updateItem(ingredientes, index, e.target.value, setIngredientes)}
                placeholder={`Ingrediente ${index + 1}`}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
              {ingredientes.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(ingredientes, index, setIngredientes)}
                  className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addItem(ingredientes, setIngredientes)}
            className="mt-2 text-sm text-orange-600 hover:text-orange-700"
          >
            + Agregar ingrediente
          </button>
        </div>

        {/* Pasos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pasos *
          </label>
          {pasos.map((paso, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <span className="px-3 py-2 bg-gray-100 rounded-lg text-gray-600 font-medium">
                {index + 1}
              </span>
              <textarea
                value={paso}
                onChange={(e) => updateItem(pasos, index, e.target.value, setPasos)}
                placeholder={`Paso ${index + 1}`}
                rows={2}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
              {pasos.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeItem(pasos, index, setPasos)}
                  className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => addItem(pasos, setPasos)}
            className="mt-2 text-sm text-orange-600 hover:text-orange-700"
          >
            + Agregar paso
          </button>
        </div>

        {/* Tips */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tips (opcional)
          </label>
          {tips.map((tip, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                value={tip}
                onChange={(e) => updateItem(tips, index, e.target.value, setTips)}
                placeholder={`Tip ${index + 1}`}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={() => removeItem(tips, index, setTips)}
                className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => addItem(tips, setTips)}
            className="mt-2 text-sm text-orange-600 hover:text-orange-700"
          >
            + Agregar tip
          </button>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tags (opcional)
          </label>
          {tags.map((tag, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                value={tag}
                onChange={(e) => updateItem(tags, index, e.target.value, setTags)}
                placeholder={`Tag ${index + 1}`}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={() => removeItem(tags, index, setTags)}
                className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => addItem(tags, setTags)}
            className="mt-2 text-sm text-orange-600 hover:text-orange-700"
          >
            + Agregar tag
          </button>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-gray-200">
        <a
          href="/admin/"
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
        >
          Cancelar
        </a>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-semibold rounded-lg transition"
        >
          {loading ? 'Guardando...' : (isEdit ? 'Actualizar Receta' : 'Crear Receta')}
        </button>
      </div>
    </form>
  );
}

