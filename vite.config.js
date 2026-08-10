import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      // AI tailor can run several minutes; keep the proxy open.
      '/api': {
        target: 'http://127.0.0.1:3001',
        timeout: 600_000,
        proxyTimeout: 600_000
      },
      // PDF export can take a while (headless Chrome + image compression).
      '/export': {
        target: 'http://127.0.0.1:3001',
        timeout: 600_000,
        proxyTimeout: 600_000
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
