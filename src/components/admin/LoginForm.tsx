import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('[Cliente] Intentando login con:', email);
      
      // Llamar al endpoint API en lugar de usar el cliente directo
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Importante para enviar y recibir cookies
      });

      const result = await response.json();
      
      console.log('[Cliente] Respuesta del servidor:', { 
        success: result.success, 
        hasSession: !!result.session 
      });

      if (!result.success) {
        console.error('[Cliente] Error de autenticación:', result.error);
        setError(result.error || 'Error al iniciar sesión');
        return;
      }

      // Si el login fue exitoso, guardar la sesión en el cliente también
      if (result.session) {
        console.log('[Cliente] Guardando sesión en el cliente...');
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });

        if (sessionError) {
          console.error('[Cliente] Error al guardar sesión:', sessionError);
          setError('Error al establecer la sesión');
          return;
        }

        console.log('[Cliente] Sesión guardada, redirigiendo...');
        
        // Esperar un momento antes de redirigir
        setTimeout(() => {
          window.location.href = '/admin/';
        }, 500);
      } else {
        setError('No se pudo crear la sesión');
      }
    } catch (err) {
      console.error('[Cliente] Error inesperado:', err);
      setError('Error al iniciar sesión. Por favor, verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-purple-50 to-blue-50 px-4 py-12">
      <div className="max-w-md w-full">
        {/* Logo/Header decorativo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full mb-4 shadow-lg">
            <span className="text-4xl">🍳</span>
          </div>
          <h1 className="text-4xl font-black text-gray-900 mb-2">
            Panel Admin
          </h1>
          <p className="text-gray-600 text-lg">Recetas de Casa</p>
        </div>

        {/* Card del formulario */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
          <div className="mb-6">
            <p className="text-gray-600 text-center">
              Inicia sesión para gestionar las recetas
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-3 animate-shake">
                <span className="text-xl">⚠️</span>
                <div>
                  <p className="font-semibold">Error de autenticación</p>
                  <p className="mt-1">{error}</p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                📧 Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"
                placeholder="tu@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                🔒 Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all outline-none"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] hover:shadow-xl disabled:transform-none disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Iniciando sesión...
                </span>
              ) : (
                '✨ Iniciar Sesión'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="text-center">
              <a 
                href="/" 
                className="text-sm text-gray-600 hover:text-orange-600 transition-colors font-medium inline-flex items-center gap-2 group"
              >
                <span className="transform group-hover:-translate-x-1 transition-transform">←</span>
                Volver al inicio
              </a>
            </div>
          </div>
        </div>

        {/* Footer informativo */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            💡 Si no tienes cuenta, contacta al administrador
          </p>
        </div>
      </div>
    </div>
  );
}

