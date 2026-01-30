import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';
import { setTimeout as delay } from 'node:timers/promises';

// Plugin to handle native modules correctly in Electron
function nativeModules() {
  return {
    name: 'native-modules',
    resolveId(id: string) {
      if (id === 'better-sqlite3') {
        return {
          id: 'better-sqlite3',
          external: true,
        };
      }
    },
  };
}

async function waitForDevServer(url: string, timeoutMs = 15000, intervalMs = 300): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok || response.status >= 300) {
        return;
      }
    } catch {
      // Ignore and retry
    }

    await delay(intervalMs);
  }
}

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main/index.ts',
        onstart({ startup }) {
          // Ensure dev server is ready before starting Electron
          waitForDevServer('http://localhost:5173').finally(() => {
            startup();
          });
        },
        vite: {
          plugins: [nativeModules()],
          build: {
            outDir: 'dist/main',
            rollupOptions: {
              external: ['electron', 'ffi-napi', 'ref-napi', 'better-sqlite3'],
            },
          },
          resolve: {
            alias: {
              'better-sqlite3': 'better-sqlite3',
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
    host: 'localhost',
    port: 5173,
    strictPort: true, // Fail if port is already in use instead of trying another
  },
});
