import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
//
// Si `astro dev` se ejecuta con NODE_ENV=production, Vite puede pre-empaquetar
// react/jsx-dev-runtime en modo prod; en React 19 jsxDEV queda undefined y el cliente
// revienta con "jsxDEV is not a function". Forzar development solo durante dev.
const isAstroDev = process.argv.includes('dev');

export default defineConfig({
  site: 'https://recetasdecasa.es',
  output: 'server',
  adapter: vercel(),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    ssr: {
      external: ['ws'],
    },
    ...(isAstroDev
      ? {
          optimizeDeps: {
            esbuildOptions: {
              define: {
                'process.env.NODE_ENV': JSON.stringify('development'),
              },
            },
          },
        }
      : {}),
  },
});
