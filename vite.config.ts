import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        onstart({ startup }) {
          // Wait a bit to ensure dev server is ready before starting Electron
          setTimeout(() => {
            startup();
          }, 1000);
        },
        vite: {
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['electron', 'ffi-napi', 'ref-napi'],
            },
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist/preload',
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@tools': path.resolve(__dirname, 'src/tools'),
      '@platform': path.resolve(__dirname, 'src/platform'),
      '@copilot': path.resolve(__dirname, 'src/copilot'),
    },
  },
  build: {
    outDir: 'dist/renderer',
  },
  server: {
    port: 5173,
    strictPort: true, // Fail if port is already in use instead of trying another
  },
});
