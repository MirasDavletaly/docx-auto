/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { CONTENT_SECURITY_POLICY } from './src/security/csp';

import type { Plugin } from 'vite';

/**
 * Политика содержимого для рабочей сборки – строка из `src/security/csp.ts`
 * (там же – почему она такая). Только для сборки: dev-сервер Vite вставляет
 * в страницу встроенные скрипты горячей перезагрузки, и политика их бы
 * запретила.
 */

function contentSecurityPolicy(): Plugin {
  return {
    name: 'docflow-content-security-policy',
    apply: 'build',
    transformIndexHtml: (html) =>
      html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />
    <meta name="referrer" content="no-referrer" />`,
      ),
  };
}

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Каждый раздел грузится лениво, поэтому имена частей должны быть
    // предсказуемыми: по ним в CI проверяется бюджет размера бандла.
    chunkSizeWarningLimit: 500,
    // Карт исходников в рабочей сборке нет: через F12 не видно исходного
    // кода с комментариями. Это не защита данных, но и лишнего не отдаём.
    sourcemap: false,
  },
  test: {
    // jsdom нужен там, где проверяется хранилище и WebCrypto: они живут
    // в браузере, а не в Node.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
  },
  optimizeDeps: {
    // Библиотека «Скачать PDF» грузится лениво, по кнопке. Без предварительной
    // сборки dev-сервер находил её только в момент первого нажатия, пересобирал
    // зависимости, и первое скачивание зависало. В рабочей сборке этого нет.
    include: ['jspdf'],
  },
  server: {
    port: 5173,
    proxy: {
      // Сервер API. Порт 8080 бывает занят другой программой – тогда адрес
      // задаётся переменной: DOCFLOW_API_URL=http://127.0.0.1:8098 npm run dev.
      '/api': { target: process.env.DOCFLOW_API_URL ?? 'http://localhost:8080', changeOrigin: true },
    },
  },
});
