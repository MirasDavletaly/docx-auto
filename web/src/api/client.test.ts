import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ApiError, NetworkError, api, onSessionLost, setAccessToken } from './client';

/** Сервер, у которого access-токен «old» уже просрочен, а «new» – действует. */
function install(refreshOk: boolean) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const auth = new Headers(init?.headers).get('Authorization');
    calls.push(`${init?.method ?? 'GET'} ${path} ${auth ?? ''}`);
    // Ответ не сразу: запросы успевают упасть одновременно.
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (path === '/api/auth/refresh') {
      return refreshOk
        ? new Response(JSON.stringify({ accessToken: 'new', accessExpiresAt: '', me: {} }), { status: 200 })
        : new Response(JSON.stringify({ error: { code: 'unauthorized', message: '' } }), { status: 401 });
    }
    if (auth !== 'Bearer new') {
      return new Response(JSON.stringify({ error: { code: 'unauthorized', message: '' } }), { status: 401 });
    }
    return new Response(JSON.stringify({ ok: path }), { status: 200 });
  }) as typeof fetch;
  return calls;
}

beforeEach(() => {
  setAccessToken('old');
});

afterEach(() => {
  setAccessToken(null);
});

describe('клиент API', () => {
  it('три запроса с просроченным токеном – одно обновление и три повтора', async () => {
    const calls = install(true);
    const results = await Promise.all([api('GET', '/a'), api('GET', '/b'), api('GET', '/c')]);

    expect(results).toHaveLength(3);
    expect(calls.filter((c) => c.startsWith('POST /api/auth/refresh'))).toHaveLength(1);
    expect(calls.filter((c) => c.endsWith('Bearer new'))).toHaveLength(3);
  });

  it('refresh отвергнут – сессия закончена, ошибка 401', async () => {
    install(false);
    let lost = 0;
    const off = onSessionLost(() => {
      lost += 1;
    });
    await expect(api('GET', '/a')).rejects.toMatchObject({ status: 401 });
    expect(lost).toBe(1);
    off();
  });

  it('ошибка сервера – с кодом и полями; нет связи – отдельная ошибка', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ error: { code: 'validation_failed', message: 'x', fields: [{ field: 'bin', message: 'БИН' }] } }),
        { status: 422 },
      )) as typeof fetch;
    const error = await api('POST', '/companies', {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'validation_failed', fields: [{ field: 'bin', message: 'БИН' }] });

    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    await expect(api('GET', '/me')).rejects.toBeInstanceOf(NetworkError);
  });
});
