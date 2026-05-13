// vite.config.ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // ─── index.html is at project ROOT (not in public/) ──────────────────────
  root: './',          // ← tells Vite where index.html lives

  server: {
    port: 8080,
    open: true,
    host: true,
    strictPort: true,
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      input: {
        // Explicit path to index.html at root
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },

  resolve: {
    alias: {
      '@config':   resolve(__dirname, './src/config'),
      '@scenes':   resolve(__dirname, './src/scenes'),
      '@entities': resolve(__dirname, './src/entities'),
      '@systems':  resolve(__dirname, './src/systems'),
      '@ui':       resolve(__dirname, './src/ui'),
      '@managers': resolve(__dirname, './src/managers'),
      '@utils':    resolve(__dirname, './src/utils'),
      '@typedefs': resolve(__dirname, './src/types'),
    },
  },

  // public/ folder serves static assets at root URL
  publicDir: 'public',
});