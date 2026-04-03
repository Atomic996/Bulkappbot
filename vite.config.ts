import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': env.GEMINI_API_KEY ? JSON.stringify(env.GEMINI_API_KEY) : 'process.env.GEMINI_API_KEY',
      'process.env.NODE_ENV': JSON.stringify(mode),
      'global': 'globalThis',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'buffer': 'buffer',
        'process': 'process',
        'crypto': 'crypto-browserify',
        'stream': 'stream-browserify',
        'whatwg-fetch': path.resolve(__dirname, 'src/lib/empty.ts'),
        'cross-fetch': path.resolve(__dirname, 'src/lib/empty.ts'),
        'node-fetch': path.resolve(__dirname, 'src/lib/empty.ts'),
        'isomorphic-fetch': path.resolve(__dirname, 'src/lib/empty.ts'),
        'unfetch': path.resolve(__dirname, 'src/lib/empty.ts'),
        'formdata-polyfill': path.resolve(__dirname, 'src/lib/empty.ts'),
        'node-fetch-native': path.resolve(__dirname, 'src/lib/empty.ts'),
        'ofetch': path.resolve(__dirname, 'src/lib/empty.ts'),
      },
    },
    optimizeDeps: {
      exclude: [
        'whatwg-fetch', 
        'cross-fetch', 
        'node-fetch', 
        'isomorphic-fetch', 
        'unfetch', 
        'formdata-polyfill',
        'node-fetch-native',
        'ofetch'
      ],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
