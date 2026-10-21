/**
 * Политика содержимого – страховка от тихого ослабления (проверка
 * безопасности 29.09.2026).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CONTENT_SECURITY_POLICY } from './csp';

const web = resolve(__dirname, '..', '..');

describe('политика содержимого', () => {
  it('без встроенных скриптов и стилей, без eval и без чужих адресов', () => {
    expect(CONTENT_SECURITY_POLICY).not.toContain("'unsafe-inline'");
    expect(CONTENT_SECURITY_POLICY).not.toContain("'unsafe-eval'");
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/https?:/u);
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
  });

  it('стили – только файлы сайта, без исключений по хешу', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("style-src 'self';");
    expect(CONTENT_SECURITY_POLICY).not.toContain('sha256-');
  });

  it.each([
    ['deploy/Caddyfile', ['deploy', 'Caddyfile']],
    ['deploy/synology/Caddyfile', ['deploy', 'synology', 'Caddyfile']],
  ])('заголовок в %s – та же политика плюс запрет встраивания', (_name, path) => {
    const caddyfile = readFileSync(resolve(web, '..', ...path), 'utf8');
    const header = caddyfile.match(/Content-Security-Policy "([^"]+)"/u)?.[1];
    expect(header).toBe(`${CONTENT_SECURITY_POLICY}; frame-ancestors 'none'`);
  });
});
