/// <reference types="vitest" />
import { defineConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * GREEN-API отдаёт `Access-Control-Allow-Origin: *` и разрешает preflight для POST/DELETE,
 * поэтому по умолчанию браузер ходит в API напрямую и прокси не нужен.
 *
 * Прокси — запасной вариант (корпоративный фильтр, блокирующее расширение и т.п.):
 * запустите `VITE_USE_PROXY=1 npm run dev` и укажите в форме входа apiUrl = `/green-api`.
 */
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
  // Для GitHub Pages: VITE_BASE=/green-api-max-chat/ npm run build
  base: process.env.VITE_BASE ?? '/',
  server: useProxy ? { proxy } : {},
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
