/**
 * Клиент API сервера (`/api`, контракт – `api/openapi.yaml`).
 *
 * - Access-токен живёт только в памяти вкладки (CLAUDE.md, п. 3.8): ни в
 *   `localStorage`, ни в `sessionStorage` его нет. Refresh – в httpOnly-cookie,
 *   скрипт сайта её не видит вовсе.
 * - На 401 – одно обновление токена на все запросы, которые упали
 *   одновременно, и повтор. Не вышло – сессия закончена: об этом узнают
 *   подписчики `onSessionLost`.
 * - Создающий запрос отправляет `Idempotency-Key`, один на действие: повтор
 *   после обрыва связи не создаст второй записи (п. 3.5).
 * - У каждого запроса предел времени (п. 3.11).
 */

/** Ошибка сервера: код из ответа, текст для человека, ошибки полей. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: { field: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Сервер недоступен: нет связи, вышло время. */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

const TIMEOUT_MS = 20_000;

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let refreshCompany: () => string = () => '';
const lostListeners = new Set<() => void>();

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function hasAccessToken(): boolean {
  return accessToken !== null;
}

/** Какую компанию просить при обновлении токена – выбранную во вкладке. */
export function setRefreshCompany(get: () => string): void {
  refreshCompany = get;
}

/** Подписка на «сессия закончилась»: refresh не принят сервером. */
export function onSessionLost(listener: () => void): () => void {
  lostListeners.add(listener);
  return () => lostListeners.delete(listener);
}

/** Ответ на вход, обновление и выбор компании. */
export interface SessionPayload<Me> {
  accessToken: string;
  accessExpiresAt: string;
  me: Me;
}

type RefreshHandler = (payload: SessionPayload<unknown>) => void;
let refreshed: RefreshHandler = () => undefined;

/** Кто узнаёт о новом токене и новом «кто я» после обновления. */
export function onRefreshed(handler: RefreshHandler): void {
  refreshed = handler;
}

export interface RequestOptions {
  /** Создающий запрос: отправить `Idempotency-Key`. */
  idempotent?: boolean;
  /** Не обновлять токен на 401 (вход, обновление). */
  noRefresh?: boolean;
  /** Ответ – двоичные данные (часть файла архива), а не JSON. */
  binary?: boolean;
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

async function send(
  method: string,
  path: string,
  body: unknown,
  key: string | undefined,
): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  // Часть файла архива идёт как есть, остальное – JSON.
  const bytes = body instanceof Uint8Array;
  if (body !== undefined) headers['Content-Type'] = bytes ? 'application/octet-stream' : 'application/json';
  if (accessToken !== null) headers.Authorization = `Bearer ${accessToken}`;
  if (key !== undefined) headers['Idempotency-Key'] = key;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? null : bytes ? (body as Uint8Array<ArrayBuffer>) : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new NetworkError('Сервер недоступен');
  } finally {
    clearTimeout(timer);
  }
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const payload = (await res.json()) as {
      error?: { code?: string; message?: string; fields?: { field: string; message: string }[] };
    };
    const e = payload.error ?? {};
    return new ApiError(res.status, e.code ?? 'unknown', e.message ?? res.statusText, e.fields ?? []);
  } catch {
    return new ApiError(res.status, 'unknown', res.statusText);
  }
}

/**
 * Одно обновление за раз во всех вкладках сайта. Cookie у вкладок общая:
 * два одновременных обновления одной cookie сервер принял бы за кражу и
 * отозвал бы вход везде. Под замком вторая вкладка идёт уже с новой cookie.
 */
async function exclusive<T>(run: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks === undefined ? run() : await locks.request('docflow-refresh', run);
}

/**
 * Обновление access-токена по refresh-cookie. Одно на все одновременные
 * запросы: второй refresh тем же токеном сервер принял бы за кражу.
 */
export function refreshSession(): Promise<boolean> {
  if (refreshing !== null) return refreshing;
  refreshing = (async () => {
    try {
      const company = refreshCompany();
      const res = await exclusive(() =>
        send('POST', '/auth/refresh', company === '' ? {} : { companyId: company }, undefined),
      );
      if (!res.ok) {
        accessToken = null;
        return false;
      }
      const payload = (await res.json()) as SessionPayload<unknown>;
      accessToken = payload.accessToken;
      refreshed(payload);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/** Запрос к API. Ответ 204 – `undefined`. */
export async function api<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const key = options.idempotent === true ? newIdempotencyKey() : undefined;

  let res = await send(method, path, body, key);
  if (res.status === 401 && options.noRefresh !== true) {
    if (await refreshSession()) {
      res = await send(method, path, body, key);
    }
    if (res.status === 401) {
      accessToken = null;
      for (const listener of lostListeners) listener();
    }
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  if (options.binary === true) return (await res.arrayBuffer()) as T;
  return (await res.json()) as T;
}
