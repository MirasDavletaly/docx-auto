/**
 * Политика содержимого (Content-Security-Policy) рабочей сборки.
 *
 * Одна строка на весь проект: её вставляет в index.html `vite.config.ts`, и
 * её же, плюс `frame-ancestors 'none'`, отдаёт заголовком `deploy/Caddyfile`
 * – совпадение проверяет тест (`csp.test.ts`).
 *
 * Всё – только со своего адреса: скрипты, стили, шрифты (лежат в самом
 * сайте), запросы. Картинки – свои, `data:` и `blob:` (логотип компании,
 * PDF). Встроенных скриптов и стилей нет вовсе: браузер отклонит любой
 * (проверка безопасности 29.09.2026). До 12.10 по хешу разрешался один
 * служебный стиль библиотеки снимка листа `html2canvas-pro`; PDF теперь
 * собирается с текстом без снимка (docs/adr/0003-pdf-s-tekstom.md), и
 * исключение снято.
 */

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
