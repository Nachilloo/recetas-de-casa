/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare global {
  interface Window {
    limpiarCategoria: () => void;
    limpiarBusqueda: () => void;
  }
}

export {};
