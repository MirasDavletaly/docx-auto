/**
 * Поддельный сервер для тестов сайта: `fetch` отвечает из памяти так же, как
 * настоящий сервер (`api/openapi.yaml`) – теми же формами ответов и кодами
 * ошибок, с refresh-cookie, токенами и версиями записей.
 *
 * Правила доступа здесь не повторяются: их проверяют тесты сервера
 * (`backend/internal/service`, `backend/internal/http`). Здесь проверяется,
 * что сайт правильно говорит с сервером.
 */
import { roles } from '@/api/mock/roles';

import type { ArchiveFile, Company, CustomTemplate, DocumentRecord, EmployeeBrief, User } from '@/api/types';

interface FakeUser extends User {
  password: string;
}

/** Имя и его формы – на человека (как колонки `users` на сервере). */
type PersonNames = Pick<EmployeeBrief, 'fullNameGenitive' | 'fullNameKk' | 'fullNameKkDative' | 'fullNameEn'>;
/** Должность и подразделение – в каждой компании (как `user_companies`). */
type CompanyCard = Pick<EmployeeBrief, 'position' | 'positionKk' | 'positionEn' | 'unit' | 'unitKk' | 'unitEn'>;

interface State {
  users: FakeUser[];
  companies: Company[];
  names: Map<string, Partial<PersonNames>>;
  /** Ключ – `компания|человек`. */
  cards: Map<string, CompanyCard>;
  /** Refresh-cookie браузера: чей вход и с какой компанией. */
  cookie: { userId: string; companyId: string } | null;
  tokens: Map<string, { userId: string; companyId: string }>;
  requests: string[];
  /** Ответ, который сервер отдаст на следующий запрос вместо обычного. */
  failNext: { status: number; code: string } | null;
  documents: DocumentRecord[];
  templates: CustomTemplate[];
  archive: (ArchiveFile & { state: 'uploading' | 'ready' })[];
  parts: Map<string, Uint8Array[]>;
  images: Map<string, string>;
  /** Нет связи: каждый запрос к /api падает, как при обрыве сети. */
  offline: boolean;
}

const state: State = {
  users: [],
  companies: [],
  names: new Map(),
  cards: new Map(),
  cookie: null,
  tokens: new Map(),
  requests: [],
  failNext: null,
  documents: [],
  templates: [],
  archive: [],
  parts: new Map(),
  images: new Map(),
  offline: false,
};

const PART = 768 * 1024;

/** Номер для сравнения – как NormalizeNumber на сервере. */
const numberKey = (n: unknown) =>
  String(n ?? '')
    .trim()
    .replace(/^№\s*/u, '')
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('ru');

function canSeeCompany(self: User, companyId: string): boolean {
  return self.role === 'platform-admin' || self.companyIds.includes(companyId);
}

/** Логин из запроса: пусто или тот же – прежний (как на сервере, 16.10). */
function newLogin(target: User, body: Record<string, unknown>): string {
  const login = typeof body.login === 'string' ? body.login.trim() : '';
  return login === '' ? target.login : login;
}

/**
 * Смена логина – как на сервере (16.10): только с правом users.login, иначе
 * 403; занятый в любом регистре – 422 по полю login. `null` – можно.
 */
function loginRefused(self: User, target: User, body: Record<string, unknown>): Response | null {
  const login = newLogin(target, body);
  if (login === target.login) return null;
  if (!(roles.find((r) => r.id === self.role)?.can.includes('users.login') ?? false)) return error(403, 'forbidden');
  if (state.users.some((u) => u.id !== target.id && u.login.toLowerCase() === login.toLowerCase())) {
    return error(422, 'validation_failed', 'x', [{ field: 'login', message: 'Такой логин уже есть' }]);
  }
  return null;
}

let counter = 0;

function json(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function error(status: number, code: string, message = code, fields?: { field: string; message: string }[]) {
  return json(status, { error: { code, message, ...(fields === undefined ? {} : { fields }) } });
}

/** Учётная запись; должность – из карточки в компании того, кто смотрит. */
function publicOf(u: FakeUser, companyId = ''): User {
  const { password: _password, position: _position, ...rest } = u;
  const position = state.cards.get(`${companyId}|${u.id}`)?.position ?? '';
  return position === '' ? rest : { ...rest, position };
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Карточка человека в компании – как `Person` на сервере. */
function personOf(u: FakeUser, companyId: string): EmployeeBrief {
  const names = state.names.get(u.id) ?? {};
  const card = state.cards.get(`${companyId}|${u.id}`) ?? { position: '', unit: '' };
  const optional = Object.fromEntries(
    Object.entries({ ...names, ...card }).filter(([, v]) => v !== undefined && v !== ''),
  );
  return {
    ...optional,
    id: u.id,
    companyId,
    fullName: u.displayName,
    fullNameGenitive: text(names.fullNameGenitive) === '' ? u.displayName : text(names.fullNameGenitive),
    position: card.position,
    unit: card.unit,
    lockVersion: u.lockVersion ?? 0,
  };
}

function setPerson(userId: string, companyId: string, body: Record<string, unknown>): void {
  state.names.set(userId, {
    fullNameGenitive: text(body.fullNameGenitive),
    fullNameKk: text(body.fullNameKk),
    fullNameKkDative: text(body.fullNameKkDative),
    fullNameEn: text(body.fullNameEn),
  });
  state.cards.set(`${companyId}|${userId}`, {
    position: text(body.position),
    positionKk: text(body.positionKk),
    positionEn: text(body.positionEn),
    unit: text(body.unit),
    unitKk: text(body.unitKk),
    unitEn: text(body.unitEn),
  });
}

function me(userId: string, companyId: string) {
  const u = state.users.find((x) => x.id === userId);
  if (u === undefined) throw new Error(`нет учётной записи ${userId}`);
  return {
    user: publicOf(u, companyId),
    permissions: roles.find((r) => r.id === u.role)?.can ?? [],
    companyId,
    platform: u.role === 'platform-admin',
  };
}

function session(userId: string, companyId: string) {
  counter += 1;
  const token = `access-${counter}`;
  state.tokens.set(token, { userId, companyId });
  state.cookie = { userId, companyId };
  return { accessToken: token, accessExpiresAt: new Date(Date.now() + 600_000).toISOString(), me: me(userId, companyId) };
}

/** Компания, в которую человек входит сам: одна – сразу, иначе – никакая. */
function defaultCompany(u: FakeUser, wanted = ''): string {
  if (wanted !== '' && (u.role === 'platform-admin' || u.companyIds.includes(wanted))) return wanted;
  return u.role !== 'platform-admin' && u.companyIds.length === 1 ? (u.companyIds[0] ?? '') : '';
}

function bump<T extends { lockVersion?: number }>(item: T): T {
  return { ...item, lockVersion: (item.lockVersion ?? 0) + 1 };
}

async function handle(
  method: string,
  path: string,
  headers: Headers,
  raw: string | null,
  bytes: Uint8Array | null,
): Promise<Response> {
  const body = (raw === null || raw === '' ? {} : JSON.parse(raw)) as Record<string, unknown>;
  const [route, query = ''] = path.split('?');
  const params = new URLSearchParams(query);

  if (state.failNext !== null) {
    const { status, code } = state.failNext;
    state.failNext = null;
    return error(status, code);
  }

  // ── Без токена ──
  if (method === 'POST' && route === '/api/auth/login') {
    const u = state.users.find((x) => x.login.toLowerCase() === String(body.login).toLowerCase());
    if (u === undefined || u.blocked === true || u.password === '' || u.password !== body.password) {
      return error(401, 'invalid_credentials', 'Неверный логин или пароль');
    }
    return json(200, session(u.id, defaultCompany(u)));
  }
  if (method === 'POST' && route === '/api/auth/refresh') {
    if (state.cookie === null) return error(401, 'unauthorized');
    const u = state.users.find((x) => x.id === state.cookie?.userId);
    if (u === undefined || u.blocked === true) return error(401, 'unauthorized');
    return json(200, session(u.id, defaultCompany(u, String(body.companyId ?? state.cookie.companyId))));
  }
  if (method === 'POST' && route === '/api/auth/logout') {
    state.cookie = null;
    return json(204, undefined);
  }

  // ── С токеном ──
  const token = headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const who = state.tokens.get(token);
  if (who === undefined) return error(401, 'unauthorized');
  const self = state.users.find((x) => x.id === who.userId);
  if (self === undefined) return error(401, 'unauthorized');

  if (method === 'POST' && route === '/api/auth/company') {
    const id = String(body.companyId);
    if (self.role !== 'platform-admin' && !self.companyIds.includes(id)) return error(404, 'not_found');
    return json(200, session(self.id, id));
  }
  if (method === 'POST' && route === '/api/auth/confirm') {
    return body.password === self.password
      ? json(204, undefined)
      : error(422, 'validation_failed', 'x', [{ field: 'password', message: 'Неверный пароль' }]);
  }
  if (method === 'GET' && route === '/api/me') return json(200, me(self.id, who.companyId));
  if (method === 'PATCH' && route === '/api/me') {
    if (body.lockVersion !== (self.lockVersion ?? 0)) return error(409, 'conflict');
    const refused = loginRefused(self, self, body);
    if (refused !== null) return refused;
    const { lockVersion: _v, login: _l, ...fields } = body;
    const next = bump({ ...self, ...fields, login: newLogin(self, body) }) as FakeUser;
    if (!('avatar' in body)) delete next.avatar;
    state.users = state.users.map((u) => (u.id === self.id ? next : u));
    return json(200, me(self.id, who.companyId));
  }
  if (method === 'POST' && route === '/api/me/password') {
    if (body.currentPassword !== self.password) {
      return error(422, 'validation_failed', 'x', [{ field: 'currentPassword', message: 'Текущий пароль неверный' }]);
    }
    if (String(body.newPassword).length < 6) {
      return error(422, 'validation_failed', 'x', [{ field: 'password', message: 'Пароль – не короче 6 знаков' }]);
    }
    self.password = String(body.newPassword);
    return json(200, session(self.id, who.companyId));
  }

  if (method === 'GET' && route === '/api/users') {
    return json(200, { items: state.users.map((u) => publicOf(u, who.companyId)) });
  }
  if (method === 'POST' && route === '/api/users') {
    const login = String(body.login);
    if (state.users.some((u) => u.login.toLowerCase() === login.toLowerCase())) {
      return error(422, 'validation_failed', 'x', [{ field: 'login', message: 'Такой логин уже есть' }]);
    }
    const { password, position, ...fields } = body as Partial<FakeUser> & { password: string };
    counter += 1;
    const created = {
      ...(fields as User),
      id: `u-${counter}`,
      createdAt: new Date().toISOString(),
      hasPassword: true,
      lockVersion: 0,
      password,
    } as FakeUser;
    state.users.push(created);
    for (const c of created.companyIds) state.cards.set(`${c}|${created.id}`, { position: text(position), unit: '' });
    return json(201, publicOf(created, who.companyId));
  }

  // ── Персонал: компания – только из токена ──
  if (method === 'GET' && route === '/api/personnel') {
    const items = state.users.flatMap((u) =>
      u.companyIds
        .filter((c) => self.role === 'platform-admin' || c === who.companyId)
        .map((c) => personOf(u, c)),
    );
    return json(200, { items });
  }
  if (method === 'POST' && route === '/api/personnel') {
    if (who.companyId === '') return error(403, 'forbidden');
    if ('companyId' in body) return error(400, 'bad_request');
    const login = text(body.login);
    if (state.users.some((u) => u.login.toLowerCase() === login.toLowerCase())) {
      return error(422, 'validation_failed', 'x', [{ field: 'login', message: 'Такой логин уже есть' }]);
    }
    const password = text(body.password);
    if (password !== '' && password.length < 6) {
      return error(422, 'validation_failed', 'x', [{ field: 'password', message: 'Пароль – не короче 6 знаков' }]);
    }
    counter += 1;
    const created: FakeUser = {
      id: `u-${counter}`,
      login,
      displayName: text(body.fullName),
      role: 'employee',
      companyIds: [who.companyId],
      sectionIds: [],
      createdAt: new Date().toISOString(),
      hasPassword: password !== '',
      lockVersion: 0,
      password,
    };
    state.users.push(created);
    setPerson(created.id, who.companyId, body);
    return json(201, personOf(created, who.companyId));
  }
  const personMatch = /^\/api\/personnel\/([^/]+)$/.exec(route ?? '');
  if (personMatch !== null) {
    const id = decodeURIComponent(personMatch[1] ?? '');
    const target = state.users.find((u) => u.id === id && u.companyIds.includes(who.companyId));
    if (target === undefined) return error(404, 'not_found');
    if (method === 'PATCH') {
      if (body.lockVersion !== (target.lockVersion ?? 0)) return error(409, 'conflict');
      const next = bump({ ...target, displayName: text(body.fullName) });
      state.users = state.users.map((u) => (u.id === id ? next : u));
      setPerson(id, who.companyId, body);
      return json(200, personOf(next, who.companyId));
    }
    if (method === 'DELETE') {
      if (target.id === self.id) return error(404, 'not_found');
      if (Number(params.get('lockVersion')) !== (target.lockVersion ?? 0)) return error(409, 'conflict');
      const left = target.companyIds.filter((c) => c !== who.companyId);
      state.users =
        left.length === 0
          ? state.users.filter((u) => u.id !== id)
          : state.users.map((u) => (u.id === id ? bump({ ...u, companyIds: left }) : u));
      return json(204, undefined);
    }
  }
  const userMatch = /^\/api\/users\/([^/]+)(\/password)?$/.exec(route ?? '');
  if (userMatch !== null) {
    const id = decodeURIComponent(userMatch[1] ?? '');
    const target = state.users.find((u) => u.id === id);
    if (target === undefined || id === self.id) return error(404, 'not_found');
    if (userMatch[2] !== undefined && method === 'POST') {
      target.password = String(body.password);
      target.hasPassword = true;
      return json(204, undefined);
    }
    if (method === 'PATCH') {
      if (body.lockVersion !== (target.lockVersion ?? 0)) return error(409, 'conflict');
      if ('position' in body) return error(400, 'bad_request', 'Должность меняется в персонале');
      const refused = loginRefused(self, target, body);
      if (refused !== null) return refused;
      const { login: _l, ...fields } = body as Partial<User>;
      const next = bump({ ...target, ...fields, login: newLogin(target, body) }) as FakeUser;
      state.users = state.users.map((u) => (u.id === id ? next : u));
      return json(200, publicOf(next, who.companyId));
    }
    if (method === 'DELETE') {
      if (Number(params.get('lockVersion')) !== (target.lockVersion ?? 0)) return error(409, 'conflict');
      state.users = state.users.filter((u) => u.id !== id);
      return json(204, undefined);
    }
  }

  if (method === 'GET' && route === '/api/companies') {
    const visible =
      self.role === 'platform-admin'
        ? state.companies
        : state.companies.filter((c) => self.companyIds.includes(c.id));
    return json(200, { items: visible });
  }
  if (method === 'POST' && route === '/api/companies') {
    counter += 1;
    const created = { ...(body as unknown as Company), id: `c-${counter}`, lockVersion: 0 };
    state.companies.push(created);
    return json(201, created);
  }
  const companyMatch = /^\/api\/companies\/([^/]+)$/.exec(route ?? '');
  if (companyMatch !== null) {
    const id = decodeURIComponent(companyMatch[1] ?? '');
    const target = state.companies.find((c) => c.id === id);
    if (target === undefined) return error(404, 'not_found');
    if (method === 'PATCH') {
      if (body.lockVersion !== (target.lockVersion ?? 0)) return error(409, 'conflict');
      const next = bump({ ...(body as unknown as Company), id });
      state.companies = state.companies.map((c) => (c.id === id ? next : c));
      return json(200, next);
    }
    if (method === 'DELETE') {
      if (Number(params.get('lockVersion')) !== (target.lockVersion ?? 0)) return error(409, 'conflict');
      state.companies = state.companies.filter((c) => c.id !== id);
      return json(204, undefined);
    }
  }

  // ── Документы, шаблоны, архив (компания нового – только из токена) ──
  const documentsResponse = handleDocuments(method, route ?? '', params, body, bytes, self, who.companyId);
  if (documentsResponse !== null) return documentsResponse;

  if (method === 'POST' && route === '/api/admin/import') {
    if (self.role !== 'platform-admin') return error(403, 'forbidden');
    if (state.companies.length > 0) return error(409, 'conflict');
    const data = body as unknown as { companies: Company[]; users: User[] };
    state.companies = data.companies.map((c) => ({ ...c, lockVersion: 0 }));
    const skipped: string[] = [];
    let users = 0;
    for (const u of data.users) {
      if (state.users.some((x) => x.login.toLowerCase() === u.login.toLowerCase())) {
        skipped.push(u.login);
        continue;
      }
      state.users.push({ ...u, hasPassword: false, lockVersion: 0, password: '' });
      users += 1;
    }
    return json(200, { companies: data.companies.length, users, skipped });
  }

  return error(404, 'not_found');
}

function handleDocuments(
  method: string,
  route: string,
  params: URLSearchParams,
  body: Record<string, unknown>,
  bytes: Uint8Array | null,
  self: FakeUser,
  companyId: string,
): Response | null {
  const version = Number(params.get('lockVersion'));
  if (method === 'GET' && route === '/api/documents') {
    const items = state.documents.filter((d) => canSeeCompany(self, d.companyId));
    const images: Record<string, string> = {};
    for (const d of items) {
      const logo = d.companySnapshot?.logo;
      if (logo !== undefined && state.images.has(logo)) images[logo] = state.images.get(logo) ?? '';
    }
    return json(200, { items, images });
  }
  if (method === 'PUT' && route === '/api/images') {
    counter += 1;
    const ref = `image:s${counter.toString(16).padStart(64, '0')}`;
    state.images.set(ref, String(body.data));
    return json(200, { ref });
  }
  const grantMatch = /^\/api\/documents\/([^/]+)\/grants\/([^/]+)$/.exec(route);
  if (grantMatch !== null) {
    const doc = state.documents.find((d) => d.id === decodeURIComponent(grantMatch[1] ?? ''));
    if (doc === undefined || !canSeeCompany(self, doc.companyId)) return error(404, 'not_found');
    const userId = decodeURIComponent(grantMatch[2] ?? '');
    const rest = (doc.grants ?? []).filter((g) => g.userId !== userId);
    doc.grants =
      method === 'PUT'
        ? [...rest, { userId, level: body.level as 'view' | 'edit', grantedBy: self.displayName, grantedAt: new Date().toISOString() }]
        : rest;
    return json(200, doc);
  }
  const docMatch = /^\/api\/documents\/([^/]+)(\/restore|\/purge)?$/.exec(route);
  if (docMatch !== null) {
    const id = decodeURIComponent(docMatch[1] ?? '');
    const doc = state.documents.find((d) => d.id === id);
    if (doc !== undefined && !canSeeCompany(self, doc.companyId)) return error(404, 'not_found');
    if (method === 'PUT') {
      const status = body.status as DocumentRecord['status'];
      const key = numberKey(body.number);
      const company = doc?.companyId ?? companyId;
      if (company === '') return error(403, 'forbidden');
      let lock = Number(body.lockVersion);
      if (doc !== undefined && lock === 0 && doc.authorId === self.id && doc.lockVersion === 1) lock = 1;
      if (doc === undefined ? lock !== 0 : lock !== doc.lockVersion) return error(409, 'conflict');
      if (doc?.status === 'saved' && status === 'draft') {
        return error(422, 'validation_failed', 'x', [{ field: 'status', message: 'Сохранённый документ не становится черновиком' }]);
      }
      const taken = state.documents.some(
        (d) => d.id !== id && d.companyId === company && d.status === 'saved' && d.deletedAt === undefined && key !== '' && numberKey(d.number) === key,
      );
      if (status === 'saved' && taken) {
        return error(422, 'validation_failed', 'x', [{ field: 'number', message: 'Этот номер уже стоит на другом документе компании. Укажите другой.' }]);
      }
      // Снимок реквизитов выпускаемого документа – из карточки сервера; из
      // присланного – только версия карточки и логотип (как на сервере).
      let companySnapshot: Company | undefined;
      if (status === 'saved') {
        const card = state.companies.find((c) => c.id === company);
        const sent = (body.companySnapshot ?? {}) as Partial<Company>;
        if (card === undefined || sent.lockVersion !== (card.lockVersion ?? 0)) {
          return error(409, 'company_changed', 'Реквизиты компании изменились. Проверьте документ и сохраните ещё раз');
        }
        const { logo: _logo, ...rest } = card;
        companySnapshot = sent.logo === undefined ? rest : { ...rest, logo: sent.logo };
      }
      const now = new Date().toISOString();
      const { lockVersion: _l, number, titleEn, ...fields } = body;
      const next: DocumentRecord = {
        ...(fields as unknown as Omit<DocumentRecord, 'id'>),
        ...(companySnapshot === undefined ? {} : { companySnapshot }),
        ...(titleEn === undefined ? {} : { titleEn: String(titleEn) }),
        id,
        companyId: company,
        number: String(number ?? '') === '' ? null : String(number),
        authorId: doc?.authorId ?? self.id,
        authorName: doc?.authorName ?? self.displayName,
        createdAt: doc?.createdAt ?? now,
        updatedAt: now,
        grants: doc?.grants ?? [],
        lockVersion: (doc?.lockVersion ?? 0) + 1,
      };
      state.documents = doc === undefined ? [next, ...state.documents] : state.documents.map((d) => (d.id === id ? next : d));
      return json(200, next);
    }
    if (doc === undefined) return error(404, 'not_found');
    if (version !== doc.lockVersion) return error(409, 'conflict');
    if (method === 'DELETE' && docMatch[2] === undefined) {
      Object.assign(doc, { deletedAt: new Date().toISOString(), deletedBy: self.displayName, lockVersion: version + 1 });
      return json(204, undefined);
    }
    if (method === 'POST' && docMatch[2] === '/restore') {
      delete doc.deletedAt;
      delete doc.deletedBy;
      doc.lockVersion = version + 1;
      return json(204, undefined);
    }
    if (method === 'POST' && docMatch[2] === '/purge') {
      if (doc.deletedAt === undefined) return error(403, 'forbidden');
      state.documents = state.documents.filter((d) => d.id !== id);
      return json(204, undefined);
    }
  }

  if (method === 'GET' && route === '/api/templates') {
    return json(200, { items: state.templates.filter((t) => t.companyId === companyId && t.deletedAt === undefined) });
  }
  const tplMatch = /^\/api\/templates\/([^/]+)$/.exec(route);
  if (tplMatch !== null) {
    const id = decodeURIComponent(tplMatch[1] ?? '');
    const tpl = state.templates.find((t) => t.id === id);
    if (tpl !== undefined && tpl.companyId !== companyId) return error(404, 'not_found');
    if (method === 'PUT') {
      if (companyId === '') return error(403, 'forbidden');
      const lock = Number(body.lockVersion);
      if (tpl !== undefined && lock !== tpl.lockVersion && !(lock === 0 && tpl.lockVersion === 1)) return error(409, 'conflict');
      const next = {
        ...(body.template as Omit<CustomTemplate, 'id' | 'companyId'>),
        id,
        companyId,
        authorId: tpl?.authorId ?? self.id,
        authorName: tpl?.authorName ?? self.displayName,
        lockVersion: (tpl?.lockVersion ?? 0) + 1,
      } as CustomTemplate;
      state.templates = tpl === undefined ? [...state.templates, next] : state.templates.map((t) => (t.id === id ? next : t));
      return json(200, next);
    }
    if (tpl === undefined) return error(404, 'not_found');
    if (method === 'DELETE') {
      if (version !== tpl.lockVersion) return error(409, 'conflict');
      Object.assign(tpl, { deletedAt: new Date().toISOString(), lockVersion: version + 1 });
      return json(204, undefined);
    }
  }

  if (method === 'GET' && route === '/api/archive') {
    return json(200, {
      items: state.archive
        .filter((f) => f.state === 'ready' && canSeeCompany(self, f.companyId))
        .map(({ state: _s, ...f }) => f),
    });
  }
  if (method === 'POST' && route === '/api/archive') {
    if (companyId === '') return error(403, 'forbidden');
    if (state.archive.some((f) => f.companyId === companyId && f.sha256 === body.sha256 && f.state === 'ready' && f.deletedAt === undefined)) {
      return error(409, 'conflict');
    }
    counter += 1;
    const size = Number(body.size);
    const file = {
      id: `f-${counter}`,
      companyId,
      title: String(body.title),
      number: String(body.number ?? '') === '' ? null : String(body.number),
      documentDate: String(body.documentDate),
      sectionId: String(body.sectionId),
      description: String(body.description ?? ''),
      fileName: String(body.fileName),
      size,
      sha256: String(body.sha256),
      uploadedBy: self.id,
      uploadedByName: self.displayName,
      uploadedAt: new Date().toISOString(),
      parts: Math.ceil(size / PART),
      state: 'uploading' as const,
    };
    state.archive.push(file);
    state.parts.set(file.id, []);
    return json(201, { id: file.id, parts: file.parts, partSize: PART });
  }
  const partMatch = /^\/api\/archive\/([^/]+)\/parts\/(\d+)$/.exec(route);
  if (partMatch !== null) {
    const file = state.archive.find((f) => f.id === partMatch[1] && canSeeCompany(self, f.companyId));
    const list = state.parts.get(partMatch[1] ?? '');
    if (file === undefined || list === undefined) return error(404, 'not_found');
    const n = Number(partMatch[2]);
    if (method === 'PUT') {
      list[n] = bytes ?? new Uint8Array();
      return json(204, undefined);
    }
    const part = list[n];
    if (part === undefined || file.state !== 'ready') return error(404, 'not_found');
    return new Response(part.slice().buffer as ArrayBuffer, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } });
  }
  const archiveMatch = /^\/api\/archive\/([^/]+)(\/complete|\/restore|\/purge)?$/.exec(route);
  if (archiveMatch !== null) {
    const file = state.archive.find((f) => f.id === archiveMatch[1] && canSeeCompany(self, f.companyId));
    if (file === undefined) return error(404, 'not_found');
    const action = archiveMatch[2];
    if (method === 'POST' && action === '/complete') {
      file.state = 'ready';
      const { state: _s, ...view } = file;
      return json(200, view);
    }
    if (method === 'DELETE' && action === undefined) {
      Object.assign(file, { deletedAt: new Date().toISOString(), deletedBy: self.displayName });
      return json(204, undefined);
    }
    if (method === 'POST' && action === '/restore') {
      delete file.deletedAt;
      delete file.deletedBy;
      return json(204, undefined);
    }
    if (method === 'POST' && action === '/purge') {
      state.archive = state.archive.filter((f) => f.id !== file.id);
      return json(204, undefined);
    }
  }
  return null;
}

export const fakeApi = {
  /** Подменяет `fetch` поддельным сервером. Вызывать в `beforeEach`. */
  install(): void {
    state.users = [];
    state.companies = [];
    state.names = new Map();
    state.cards = new Map();
    state.cookie = null;
    state.tokens = new Map();
    state.requests = [];
    state.failNext = null;
    state.documents = [];
    state.templates = [];
    state.archive = [];
    state.parts = new Map();
    state.images = new Map();
    state.offline = false;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const path = url.replace(/^https?:\/\/[^/]+/, '');
      const method = init?.method ?? 'GET';
      state.requests.push(`${method} ${path}`);
      if (state.offline && path.startsWith('/api/')) throw new TypeError('Failed to fetch');
      const raw = typeof init?.body === 'string' ? init.body : null;
      const bytes = init?.body instanceof Uint8Array ? new Uint8Array(init.body) : null;
      return handle(method, path, new Headers(init?.headers), raw, bytes);
    }) as typeof fetch;
  },

  /** Учётная запись на сервере. Пароль по умолчанию – `test-password-1`. */
  addUser(user: Omit<User, 'createdAt' | 'sectionIds'> & Partial<User>, password = 'test-password-1'): void {
    state.users.push({
      createdAt: '2026-09-23T00:00:00.000Z',
      sectionIds: [],
      hasPassword: password !== '',
      lockVersion: 0,
      ...user,
      password,
    });
  },

  addCompany(company: Company): void {
    state.companies.push({ lockVersion: 0, ...company });
  },

  /** Правка записи «на сервере» мимо сайта: так её сделал бы другой человек. */
  patchUser(id: string, patch: Partial<User>): void {
    state.users = state.users.map((u) => (u.id === id ? { ...u, ...patch } : u));
  },

  patchCompany(id: string, patch: Partial<Company>): void {
    state.companies = state.companies.map((c) => (c.id === id ? { ...c, ...patch } : c));
  },

  /** Браузер уже вошёл: refresh-cookie есть, при открытии сайта вход восстановится. */
  signedIn(userId: string, companyId = ''): void {
    state.cookie = { userId, companyId };
    localStorage.setItem('docflow.signed-in', '1');
  },

  /** Следующий запрос получит эту ошибку. */
  failNext(status: number, code: string): void {
    state.failNext = { status, code };
  },

  user(id: string): User | undefined {
    const u = state.users.find((x) => x.id === id);
    return u === undefined ? undefined : publicOf(u);
  },

  /** Карточка человека в компании «на сервере». */
  person(id: string, companyId: string): EmployeeBrief | undefined {
    const u = state.users.find((x) => x.id === id && x.companyIds.includes(companyId));
    return u === undefined ? undefined : personOf(u, companyId);
  },

  companies(): Company[] {
    return state.companies;
  },

  /** Документ «на сервере», как его завёл кто-то другой. */
  addDocument(doc: DocumentRecord): void {
    state.documents.push({ lockVersion: 1, grants: [], ...doc });
  },

  documents(): DocumentRecord[] {
    return state.documents;
  },

  templates(): CustomTemplate[] {
    return state.templates;
  },

  /** Файл архива «на сервере» с содержимым одной частью. */
  addArchiveFile(file: ArchiveFile, content: Uint8Array): void {
    state.archive.push({ parts: 1, ...file, state: 'ready' });
    state.parts.set(file.id, [content]);
  },

  archive(): ArchiveFile[] {
    return state.archive;
  },

  /** Обрыв связи: запросы к /api не доходят. */
  setOffline(on: boolean): void {
    state.offline = on;
  },

  get requests(): string[] {
    return state.requests;
  },

  get cookie(): State['cookie'] {
    return state.cookie;
  },
};
