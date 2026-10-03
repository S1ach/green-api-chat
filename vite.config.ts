/// <reference types="vitest" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

// прокси на случай, если запросы к API режет сеть или расширение:
// VITE_USE_PROXY=1 npm run dev, в форме входа apiUrl = /green-api
const useProxy = process.env.VITE_USE_PROXY === '1';
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'https://api.green-api.com';

const proxy: Record<string, ProxyOptions> = {
  '/green-api': {
    target: proxyTarget,
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/green-api/, ''),
  },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: {
    preprocessorOptions: { scss: { api: 'modern-compiler' } },
  },
  // GitHub Pages живёт в подкаталоге, base приходит из VITE_BASE
  base: process.env.VITE_BASE ?? '/',
  server: useProxy ? { proxy } : {},
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/shared/lib/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
