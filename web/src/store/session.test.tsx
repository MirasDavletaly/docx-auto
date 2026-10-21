/**
 * Вторая проверка прав – в сессии, а не только на экране.
 *
 * Всё – на сервере: учётные записи, компании, персонал, а с этапа 1б, часть 2,
 * и документы, шаблоны и архив. Здесь проверяется, как сайт с ним говорит
 * (поддельный сервер `test/fakeApi.ts`) и что проверка в сессии не пускает
 * действие мимо экрана; права на сервере – тестами сервера.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider, useSession } from './session';
import type { TemplateInput } from './session';
import { setAccessToken } from '@/api/client';
import { loadDb, reloadDb, resetDb, updateDb } from '@/store/db';
import { resetSync, syncStatus } from '@/store/documentsSync';
import { readLegacy } from '@/store/legacy';
import { fakeApi } from '@/test/fakeApi';

import type { DocumentRecord, RoleId, User } from '@/api/types';
import type { Root } from 'react-dom/client';

const A = 'c-knt';
const B = 'c-algoritmi';
const PASS = 'test-password-1';

/** Учётная запись на сервере. */
function account(id: string, role: RoleId, companyIds: string[], extra: Partial<User> = {}) {
  fakeApi.addUser({ id, login: id, displayName: id, role, companyIds, ...extra }, PASS);
}

function document_(id: string, companyId: string, authorId: string): DocumentRecord {
  return {
    id,
    templateId: 'hr-hire-order',
    companyId,
    title: 'Приказ о приёме на работу',
    description: '',
    subject: '',
    status: 'saved',
    number: null,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    values: {},
    authorId,
    authorName: authorId,
  };
}

let container: HTMLDivElement;
let root: Root;
let session: ReturnType<typeof useSession>;

function Probe() {
  session = useSession();
  return null;
}

/** Ждёт ответов сервера: восстановление входа, копию учётных записей. */
async function settle() {
  await act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function mount() {
  act(() => {
    root.render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
  });
}

/** Браузер, где человек уже вошёл: вход восстанавливается по refresh-cookie. */
async function signInAs(userId: string, companyId: string) {
  fakeApi.signedIn(userId, companyId);
  mount();
  await settle();
}

/** Другой человек в той же вкладке. */
async function switchTo(userId: string, companyId: string) {
  act(() => root.unmount());
  root = createRoot(container);
  setAccessToken(null);
  await signInAs(userId, companyId);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetDb();
  resetSync();
  setAccessToken(null);

  fakeApi.install();
  for (const company of loadDb().companies) fakeApi.addCompany(company);
  account('admin', 'platform-admin', []);
  account('director-a', 'director', [A]);
  account('director-b', 'director', [B]);
  account('worker-a', 'employee', [A]);
  account('worker-b', 'employee', [B]);

  fakeApi.addDocument(document_('doc-a', A, 'worker-a'));
  fakeApi.addDocument(document_('doc-b', B, 'worker-b'));

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function user(id: string): User | undefined {
  return loadDb().users.find((u) => u.id === id);
}

describe('вход через сервер', () => {
  it('восстанавливается по refresh-cookie с выбранной компанией, копия учётных записей – с сервера', async () => {
    sessionStorage.setItem('docflow.session', JSON.stringify({ companyId: A }));
    fakeApi.signedIn('admin', '');
    mount();
    expect(session.restoring).toBe(true);
    await settle();

    expect(session.restoring).toBe(false);
    expect(session.user?.id).toBe('admin');
    expect(session.company?.id).toBe(A);
    expect(loadDb().users.map((u) => u.id).sort()).toEqual(
      ['admin', 'director-a', 'director-b', 'worker-a', 'worker-b'],
    );
    // Паролей и их хешей в браузере нет.
    expect(localStorage.getItem('docflow.local.db')).not.toContain(PASS);
  });

  it('без cookie – не вошёл', async () => {
    localStorage.setItem('docflow.signed-in', '1');
    mount();
    await settle();
    expect(session.restoring).toBe(false);
    expect(session.user).toBeNull();
    // Отметка снята: в следующий раз сервер не спрашивают зря.
    expect(localStorage.getItem('docflow.signed-in')).toBeNull();
  });

  it('браузер, где не входили, сервер о входе не спрашивает', async () => {
    mount();
    await settle();
    expect(session.restoring).toBe(false);
    expect(fakeApi.requests).toEqual([]);
  });

  it('вход по паролю; неверный пароль и частые попытки – свои ответы', async () => {
    mount();
    await settle();

    let result = '';
    await act(async () => {
      result = await session.signIn('worker-a', 'wrong-password-1');
    });
    expect(result).toBe('failed');

    fakeApi.failNext(429, 'rate_limited');
    await act(async () => {
      result = await session.signIn('worker-a', PASS);
    });
    expect(result).toBe('throttled');

    await act(async () => {
      result = await session.signIn('worker-a', PASS);
    });
    await settle();
    expect(result).toBe('ok');
    expect(session.user?.id).toBe('worker-a');
    // Одна компания – выбрана сразу.
    expect(session.company?.id).toBe(A);
  });

  it('выход закрывает вход на сервере и стирает копию учётных записей', async () => {
    await signInAs('director-a', A);
    expect(loadDb().users).not.toHaveLength(0);

    act(() => session.signOut());
    await settle();
    expect(session.user).toBeNull();
    expect(fakeApi.cookie).toBeNull();
    expect(loadDb().users).toEqual([]);
    expect(sessionStorage.getItem('docflow.session')).toBeNull();
  });

  it('сессия, которую сервер больше не принимает, заканчивается', async () => {
    await signInAs('director-a', A);
    // Сервер отозвал вход (смена роли, блокировка): refresh тоже отвергнут.
    fakeApi.patchUser('director-a', { blocked: true });
    setAccessToken('revoked');
    await act(async () => {
      await session.updateUser('worker-a', { displayName: 'x' });
    });
    await settle();
    expect(session.user).toBeNull();
  });

  it('выбор компании – запрос к серверу; чужая компания не выбирается', async () => {
    account('worker-ab', 'employee', [A, B]);
    await signInAs('worker-ab', '');
    expect(session.company).toBeNull();

    let outcome: { ok: boolean } = { ok: false };
    await act(async () => {
      outcome = await session.selectCompany(B);
    });
    expect(outcome.ok).toBe(true);
    expect(session.company?.id).toBe(B);

    await switchTo('worker-a', A);
    await act(async () => {
      outcome = await session.selectCompany(B);
    });
    expect(outcome.ok).toBe(false);
    expect(session.company?.id).toBe(A);
  });
});

describe('учётные записи и компании на сервере', () => {
  it('правка уходит с версией записи; чужая правка поверх – конфликт и свежая копия', async () => {
    await signInAs('director-a', A);

    let outcome: { ok: boolean; message?: string } = { ok: false };
    await act(async () => {
      outcome = await session.updateUser('worker-a', { displayName: 'Новое имя' });
    });
    expect(outcome.ok).toBe(true);
    expect(user('worker-a')?.displayName).toBe('Новое имя');

    // Кто-то другой поправил запись: версия на сервере ушла вперёд.
    fakeApi.patchUser('worker-a', { lockVersion: 5 });
    await act(async () => {
      outcome = await session.updateUser('worker-a', { displayName: 'Поверх' });
    });
    await settle();
    expect(outcome.ok).toBe(false);
    expect(outcome.message).toMatch(/изменились/);
    expect(user('worker-a')?.lockVersion).toBe(5);
  });

  it('занятый логин – отдельная причина', async () => {
    await signInAs('director-a', A);
    let result: { ok: boolean; reason?: string } = { ok: true };
    await act(async () => {
      result = await session.createUser({
        login: 'WORKER-A',
        displayName: 'x',
        password: 'long-enough-pass-1',
        role: 'employee',
        companyIds: [A],
        sectionIds: [],
        viewSectionIds: [],
      });
    });
    expect(result).toMatchObject({ ok: false, reason: 'login-taken' });
  });

  it('создающий запрос отправляет Idempotency-Key', async () => {
    await signInAs('admin', A);
    const sent: Array<string | null> = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') sent.push(new Headers(init.headers).get('Idempotency-Key'));
      return original(input, init);
    }) as typeof fetch;

    await act(async () => {
      await session.createUser({
        login: 'new-worker',
        displayName: 'x',
        password: 'long-enough-pass-1',
        role: 'employee',
        companyIds: [A],
        sectionIds: [],
        viewSectionIds: [],
      });
    });
    expect(sent[0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('удаление компании: на сервере, а документы её в браузере – в корзину', async () => {
    await signInAs('admin', A);
    await act(async () => {
      await session.removeCompany(B);
    });
    await settle();
    expect(fakeApi.companies().some((c) => c.id === B)).toBe(false);
    expect(loadDb().documents.find((d) => d.id === 'doc-b')?.deletedAt).toBeDefined();
    expect(loadDb().documents.find((d) => d.id === 'doc-a')?.deletedAt).toBeUndefined();
  });

  it('не видит журнал чужой компании', async () => {
    updateDb((db) => ({
      ...db,
      audit: [
        { id: '1', at: '2026-09-23T00:00:00.000Z', userId: 'x', userName: 'x', companyId: A, event: 'document.create', target: 'a' },
        { id: '2', at: '2026-09-23T00:00:00.000Z', userId: 'x', userName: 'x', companyId: B, event: 'document.create', target: 'b' },
      ],
    }));
    await signInAs('director-a', A);

    expect(session.audit.map((e) => e.id)).toEqual(['1']);
  });
});

describe('перенос из браузера прежней версии', () => {
  it('прежние учётные записи откладываются без хешей и переносятся на сервер', async () => {
    // Браузер, в котором работали до сервера: учётные записи с хешами.
    act(() => root.unmount());
    root = createRoot(container);
    localStorage.clear();
    resetDb();
    const sample = loadDb().companies[0];
    localStorage.setItem(
      'docflow.local.db',
      JSON.stringify({
        version: 2,
        companies: [{ ...sample, id: 'c-old' }],
        users: [
          {
            id: 'u-miras-browser',
            login: 'miras-browser',
            displayName: 'Мирас',
            role: 'platform-admin',
            companyIds: [],
            sectionIds: [],
            createdAt: '2026-09-01T00:00:00.000Z',
            password: { algo: 'PBKDF2-SHA256', iterations: 1, salt: 'c2FsdA', hash: 'aGFzaA' },
            failedAttempts: 0,
          },
        ],
      }),
    );
    reloadDb();
    expect(loadDb().users).toEqual([]);
    expect(localStorage.getItem('docflow.local.db')).not.toContain('PBKDF2');
    expect(readLegacy()?.users.map((u) => u.login)).toEqual(['miras-browser']);

    // Сервер пустой: администратор заведён при установке.
    fakeApi.install();
    account('admin', 'platform-admin', []);
    await signInAs('admin', '');
    expect(session.legacy).not.toBeNull();

    let outcome: Awaited<ReturnType<typeof session.importLegacy>> | null = null;
    await act(async () => {
      outcome = await session.importLegacy();
    });
    await settle();
    expect(outcome).toMatchObject({ ok: true, result: { companies: 1, users: 1, skipped: [] } });
    expect(fakeApi.user('u-miras-browser')?.hasPassword).toBe(false);
    expect(readLegacy()).toBeNull();
  });
});

describe('пароль админ-панели', () => {
  it('проверяет сервер; подтверждение забывается при выходе', async () => {
    await signInAs('admin', A);
    expect(session.adminUnlocked).toBe(false);

    let ok = true;
    await act(async () => {
      ok = await session.confirmPassword('wrong-password-1');
    });
    expect(ok).toBe(false);
    await act(async () => {
      ok = await session.confirmPassword(PASS);
    });
    expect(ok).toBe(true);

    act(() => session.unlockAdmin());
    expect(session.adminUnlocked).toBe(true);
    expect(JSON.parse(sessionStorage.getItem('docflow.session') ?? '{}')).toMatchObject({
      adminUnlocked: true,
    });

    act(() => session.signOut());
    expect(session.adminUnlocked).toBe(false);
    expect(sessionStorage.getItem('docflow.session')).toBeNull();
  });
});

describe('выданный доступ к документу', () => {
  it('директор выдаёт доступ своему сотруднику, и тот видит документ', async () => {
    account('worker-a2', 'employee', [A]);

    await signInAs('director-a', A);
    act(() => session.setDocumentGrant('doc-a', 'worker-a2', 'view'));
    expect(loadDb().documents.find((d) => d.id === 'doc-a')?.grants?.[0]?.userId).toBe('worker-a2');
    await settle();
    // Доступ выдан на сервере, а не только в копии этого браузера.
    expect(fakeApi.documents().find((d) => d.id === 'doc-a')?.grants?.[0]?.userId).toBe('worker-a2');

    await switchTo('worker-a2', A);
    expect(session.documents.map((d) => d.id)).toEqual(['doc-a']);
  });

  it('директор не выдаёт доступ к документу чужой компании', async () => {
    await signInAs('director-a', A);
    act(() => session.setDocumentGrant('doc-b', 'worker-a', 'edit'));

    expect(loadDb().documents.find((d) => d.id === 'doc-b')?.grants ?? []).toEqual([]);
  });

  it('человеку из другой компании доступ не выдаётся даже администратором', async () => {
    await signInAs('admin', A);
    act(() => session.setDocumentGrant('doc-a', 'worker-b', 'view'));

    expect(loadDb().documents.find((d) => d.id === 'doc-a')?.grants ?? []).toEqual([]);
  });

  it('работник доступ не выдаёт', async () => {
    account('worker-a2', 'employee', [A]);
    await signInAs('worker-a', A);
    act(() => session.setDocumentGrant('doc-a', 'worker-a2', 'view'));

    expect(loadDb().documents.find((d) => d.id === 'doc-a')?.grants ?? []).toEqual([]);
  });
});

describe('загрузка в архив', () => {
  const pdf = () => new File(['%PDF-1.7\n1 0 obj\n'], 'old.pdf', { type: 'application/pdf' });
  const input = (file: File, sectionId = 'hr') => ({
    file,
    title: 'Старый приказ',
    number: '',
    documentDate: '2019-03-01',
    sectionId,
    description: '',
  });

  it('не принимает файл, который только назван PDF', async () => {
    fakeApi.patchUser('worker-a', { sectionIds: ['hr'] });
    await signInAs('worker-a', A);

    let result = '';
    await act(async () => {
      result = await session.uploadArchiveFile(
        input(new File(['MZ это exe'], 'virus.pdf', { type: 'application/pdf' })),
      );
    });
    expect(result).toBe('not-pdf');
    expect(loadDb().archive).toEqual([]);
  });

  it('не принимает в раздел, где человек не работает', async () => {
    await signInAs('worker-a', A);

    let result = '';
    await act(async () => {
      result = await session.uploadArchiveFile(input(pdf(), 'legal'));
    });
    expect(result).toBe('denied');
  });

  it('файл уходит на сервер частями и открывается обратно', async () => {
    await signInAs('director-a', A);

    let result = '';
    await act(async () => {
      result = await session.uploadArchiveFile(input(pdf()));
    });
    expect(result).toBe('ok');
    expect(fakeApi.archive().map((f) => f.companyId)).toEqual([A]);
    expect(fakeApi.requests.filter((r) => r.includes('/parts/'))).toHaveLength(1);

    const id = loadDb().archive[0]?.id ?? '';
    let opened: Awaited<ReturnType<typeof session.openArchiveFile>> | undefined;
    await act(async () => {
      opened = await session.openArchiveFile(id);
    });
    expect(opened?.ok).toBe(true);

    // Тот же файл ещё раз – дубль.
    await act(async () => {
      result = await session.uploadArchiveFile(input(pdf()));
    });
    expect(result).toBe('duplicate');
  });

  it('нет связи – записи в архиве не появляется', async () => {
    await signInAs('director-a', A);
    fakeApi.setOffline(true);

    let result = '';
    await act(async () => {
      result = await session.uploadArchiveFile(input(pdf()));
    });
    expect(result).toBe('storage-failed');
    expect(loadDb().archive).toEqual([]);
  });
});

describe('удаление навсегда («Тест день 3»)', () => {
  it('работник не удаляет документ даже в корзину, вызвав действие мимо экрана', async () => {
    await signInAs('worker-a', A);
    act(() => session.deleteDocument('doc-a'));

    expect(loadDb().documents.find((d) => d.id === 'doc-a')?.deletedAt).toBeUndefined();
  });

  it('директор стирает документ из корзины, а в журнале остаётся запись', async () => {
    await signInAs('director-a', A);
    act(() => session.deleteDocument('doc-a'));
    act(() => session.purgeDocument('doc-a'));

    expect(loadDb().documents.some((d) => d.id === 'doc-a')).toBe(false);
    expect(loadDb().audit.some((e) => e.event === 'document.purge' && e.companyId === A)).toBe(true);
  });

  it('живой документ навсегда не стирается: сначала корзина', async () => {
    await signInAs('director-a', A);
    act(() => session.purgeDocument('doc-a'));

    expect(loadDb().documents.some((d) => d.id === 'doc-a')).toBe(true);
  });

  it('директор не стирает документ чужой компании, работник – никакой', async () => {
    for (const d of fakeApi.documents()) d.deletedAt = '2026-09-25T00:00:00.000Z';

    await signInAs('director-a', A);
    act(() => session.purgeDocument('doc-b'));
    await switchTo('worker-a', A);
    act(() => session.purgeDocument('doc-a'));
    await settle();

    expect(fakeApi.documents().map((d) => d.id).sort()).toEqual(['doc-a', 'doc-b']);
  });

  it('файл архива возвращается из корзины и стирается навсегда', async () => {
    fakeApi.addArchiveFile(
      { id: 'f-1', companyId: A, title: 'Скан', number: null, documentDate: '2019-03-01', sectionId: 'hr', description: '', fileName: 'a.pdf', size: 1, sha256: 'x', uploadedBy: 'worker-a', uploadedByName: 'worker-a', uploadedAt: '2026-09-23T00:00:00.000Z' },
      new Uint8Array([1]),
    );
    await signInAs('director-a', A);

    act(() => session.deleteArchiveFile('f-1'));
    expect(session.archive).toEqual([]);
    expect(session.archiveBin.map((f) => f.id)).toEqual(['f-1']);

    act(() => session.restoreArchiveFile('f-1'));
    expect(session.archive.map((f) => f.id)).toEqual(['f-1']);

    act(() => session.deleteArchiveFile('f-1'));
    await act(async () => {
      await session.purgeArchiveFile('f-1');
    });
    expect(loadDb().archive).toEqual([]);
    expect(loadDb().audit.some((e) => e.event === 'archive.purge')).toBe(true);
    await settle();
    expect(fakeApi.archive()).toEqual([]);
  });
});

describe('смена логина – только администратор платформы (16.10)', () => {
  it('администратор меняет логин человеку; занятый – ошибка поля login', async () => {
    await signInAs('admin', A);

    let outcome: Awaited<ReturnType<typeof session.updateUser>> | undefined;
    await act(async () => {
      outcome = await session.updateUser('worker-a', { login: 'WORKER-B' });
    });
    expect(outcome).toMatchObject({ ok: false, field: 'login' });
    expect(fakeApi.user('worker-a')?.login).toBe('worker-a');

    await act(async () => {
      outcome = await session.updateUser('worker-a', { login: ' aidana.k ' });
    });
    expect(outcome).toEqual({ ok: true });
    expect(fakeApi.user('worker-a')?.login).toBe('aidana.k');
  });

  it('директор логин не меняет; прочая правка без смены логина проходит', async () => {
    await signInAs('director-a', A);

    let outcome: Awaited<ReturnType<typeof session.updateUser>> | undefined;
    await act(async () => {
      outcome = await session.updateUser('worker-a', { login: 'worker-a-new' });
    });
    expect(outcome?.ok).toBe(false);
    expect(fakeApi.user('worker-a')?.login).toBe('worker-a');

    await act(async () => {
      outcome = await session.updateUser('worker-a', { displayName: 'Работник А' });
    });
    expect(outcome).toEqual({ ok: true });
  });

  it('свой логин – в профиле: администратору можно, директору нет', async () => {
    await signInAs('admin', A);
    let outcome: Awaited<ReturnType<typeof session.updateProfile>> | undefined;
    await act(async () => {
      outcome = await session.updateProfile({ login: 'miras' });
    });
    expect(outcome).toEqual({ ok: true });
    expect(fakeApi.user('admin')?.login).toBe('miras');

    await switchTo('director-a', A);
    await act(async () => {
      outcome = await session.updateProfile({ login: 'dir-new' });
    });
    expect(outcome?.ok).toBe(false);
    expect(fakeApi.user('director-a')?.login).toBe('director-a');
  });
});

describe('архив – во всех компаниях человека (16.10)', () => {
  const C = loadDb().companies.find((c) => c.id !== A && c.id !== B)?.id ?? '';

  function file(id: string, companyId: string) {
    fakeApi.addArchiveFile(
      // SHA-256 одного байта 0x01 – содержимого ниже: сайт сверяет его при выдаче.
      { id, companyId, title: `Скан ${id}`, number: null, documentDate: '2019-03-01', sectionId: 'hr', description: '', fileName: `${id}.pdf`, size: 1, sha256: '4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a', uploadedBy: 'someone', uploadedByName: 'someone', uploadedAt: '2026-09-23T00:00:00.000Z' },
      new Uint8Array([1]),
    );
  }

  beforeEach(() => {
    account('hr-ab', 'employee', [A, B], { sectionIds: ['hr'], viewSectionIds: ['hr'] });
    file('f-a', A);
    file('f-b', B);
    file('f-c', C);
    fakeApi.addDocument({ ...document_('doc-c', C, 'someone') });
  });

  it('кадровик двух компаний видит файлы и документы обеих, в какой бы ни работал', async () => {
    await signInAs('hr-ab', A);

    expect(session.archive.map((f) => f.id).sort()).toEqual(['f-a', 'f-b']);
    expect(session.archiveDocuments.map((d) => d.id).sort()).toEqual(['doc-a', 'doc-b']);
    // Реестр «Документы компании» – по-прежнему только текущей.
    expect(session.documents.map((d) => d.id)).toEqual(['doc-a']);

    await switchTo('hr-ab', B);
    expect(session.archive.map((f) => f.id).sort()).toEqual(['f-a', 'f-b']);
  });

  it('файл и документ чужой компании не видны: изоляция – по доступу к компании', async () => {
    await signInAs('worker-a', A);

    expect(session.archive.map((f) => f.id)).not.toContain('f-b');
    expect(session.archive.map((f) => f.id)).not.toContain('f-c');
    expect(session.archiveDocuments.map((d) => d.id)).not.toContain('doc-c');
    expect(session.archiveDocuments.map((d) => d.id)).not.toContain('doc-b');
  });

  it('черновики в архив не попадают', async () => {
    fakeApi.addDocument({ ...document_('draft-a', A, 'hr-ab'), status: 'draft' });
    await signInAs('hr-ab', A);

    expect(session.archiveDocuments.map((d) => d.id)).not.toContain('draft-a');
  });

  it('файл другой компании открывается тому, у кого к ней есть доступ', async () => {
    await signInAs('hr-ab', A);

    let opened: Awaited<ReturnType<typeof session.openArchiveFile>> | undefined;
    await act(async () => {
      opened = await session.openArchiveFile('f-b');
    });
    expect(opened?.ok).toBe(true);
  });
});

describe('документы на сервере (этап 1б, часть 2)', () => {
  const draftInput = (number = '') => ({
    templateId: 'hr-hire-order',
    sectionId: 'hr',
    title: 'Приказ о приёме на работу',
    number,
    description: '',
    subject: '',
    values: { employee: 'worker-a' },
    status: 'draft' as const,
  });

  it('черновик уходит на сервер и виден с другого компьютера', async () => {
    fakeApi.patchUser('worker-a', { sectionIds: ['hr'] });
    await signInAs('worker-a', A);
    let id = '';
    act(() => {
      id = session.saveDocument(draftInput()).id;
    });
    await settle();
    expect(fakeApi.documents().find((d) => d.id === id)?.companyId).toBe(A);

    // Другой компьютер: в браузере ничего нет – документ приходит с сервера.
    resetDb();
    resetSync();
    await switchTo('worker-a', A);
    expect(session.documents.map((d) => d.id)).toContain(id);
  });

  it('правки черновика уходят по очереди с версией сервера', async () => {
    fakeApi.patchUser('worker-a', { sectionIds: ['hr'] });
    await signInAs('worker-a', A);
    let id = '';
    act(() => {
      id = session.saveDocument(draftInput()).id;
      session.saveDocument({ ...draftInput(), id, description: 'раз' });
      session.saveDocument({ ...draftInput(), id, description: 'два' });
    });
    await settle();
    const onServer = fakeApi.documents().find((d) => d.id === id);
    expect(onServer?.description).toBe('два');
    expect(syncStatus().unsynced).toBe(0);
    expect(syncStatus().problem).toBeNull();
  });

  it('«Сохранить» с номером, занятым документом, которого не видно, – отказ сервера', async () => {
    fakeApi.patchUser('worker-a', { sectionIds: ['hr'] });
    await signInAs('worker-a', A);
    // Документ с этим номером у директора; в копии работника его нет.
    fakeApi.addDocument({ ...document_('doc-n', A, 'director-a'), number: '15-К' });

    let result: Awaited<ReturnType<typeof session.syncDocument>> | undefined;
    await act(async () => {
      const record = session.saveDocument({ ...draftInput('15-к'), status: 'saved' });
      result = await session.syncDocument(record.id);
    });
    expect(result?.ok).toBe(false);
    expect(result?.ok === false ? result.reason : '').toBe('number-taken');
  });

  it('нет связи – правка ждёт и уходит, когда связь вернулась', async () => {
    fakeApi.patchUser('worker-a', { sectionIds: ['hr'] });
    await signInAs('worker-a', A);
    fakeApi.setOffline(true);

    let result: Awaited<ReturnType<typeof session.syncDocument>> | undefined;
    let id = '';
    await act(async () => {
      id = session.saveDocument(draftInput()).id;
      result = await session.syncDocument(id);
    });
    expect(result?.ok === false ? result.reason : '').toBe('offline');
    expect(syncStatus()).toMatchObject({ offline: true, unsynced: 1 });
    expect(loadDb().documents.some((d) => d.id === id)).toBe(true);

    fakeApi.setOffline(false);
    await act(async () => {
      result = await session.syncDocument(id);
    });
    expect(result?.ok).toBe(true);
    expect(fakeApi.documents().some((d) => d.id === id)).toBe(true);
    expect(syncStatus().unsynced).toBe(0);
  });

  it('документ исправили в другом месте – конфликт и версия с сервера', async () => {
    await signInAs('director-a', A);
    const server = fakeApi.documents().find((d) => d.id === 'doc-a');
    if (server === undefined) throw new Error('нет doc-a');
    // Пока директор смотрел, другой человек исправил документ.
    Object.assign(server, { lockVersion: 5, description: 'чужая правка' });

    await act(async () => {
      session.saveDocument({ ...draftInput(), id: 'doc-a', status: 'saved', description: 'моя правка' });
      await session.syncDocument('doc-a');
    });
    await settle();
    expect(syncStatus().problem?.reason).toBe('conflict');
    expect(loadDb().documents.find((d) => d.id === 'doc-a')?.description).toBe('чужая правка');
  });

  it('выход стирает копию документов', async () => {
    await signInAs('director-a', A);
    expect(loadDb().documents.length).toBeGreaterThan(0);
    act(() => session.signOut());
    await settle();
    expect(loadDb().documents).toEqual([]);
  });
});

describe('свежие реквизиты компании (19.10)', () => {
  const savedInput = {
    templateId: 'hr-hire-order',
    sectionId: 'hr',
    title: 'Приказ о приёме на работу',
    number: '',
    description: '',
    subject: '',
    values: { employee: 'worker-a' },
    status: 'saved' as const,
  };

  /** Реквизиты исправили на другом компьютере: версия карточки на сервере – новая. */
  function directorChangedElsewhere() {
    const card = fakeApi.companies().find((c) => c.id === A);
    fakeApi.patchCompany(A, { directorName: 'Новый Директор', lockVersion: (card?.lockVersion ?? 0) + 1 });
  }

  it('исправленные на другом компьютере приходят при возврате на вкладку', async () => {
    await signInAs('worker-a', A);
    directorChangedElsewhere();

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();

    expect(session.company?.directorName).toBe('Новый Директор');
  });

  it('и раз в минуту, если вкладку не покидали', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      await signInAs('worker-a', A);
      directorChangedElsewhere();

      act(() => {
        vi.advanceTimersByTime(60_000);
      });
      await settle();

      expect(session.company?.directorName).toBe('Новый Директор');
    } finally {
      vi.useRealTimers();
    }
  });

  it('«Сохранить» по прежней карточке – отказ сервера, карточка свежая, правка цела', async () => {
    fakeApi.patchUser('worker-a', { sectionIds: ['hr'] });
    await signInAs('worker-a', A);
    directorChangedElsewhere();

    let result: Awaited<ReturnType<typeof session.syncDocument>> | undefined;
    let refused = '';
    await act(async () => {
      const record = session.saveDocument(savedInput);
      refused = record.id;
      result = await session.syncDocument(record.id);
    });
    await settle();

    expect(result?.ok).toBe(false);
    expect(result?.ok === false ? result.reason : '').toBe('company-changed');
    expect(fakeApi.documents().some((d) => d.id === refused)).toBe(false);
    expect(session.company?.directorName).toBe('Новый Директор');

    // Со свежей карточкой документ выпускается, и в снимке – новый директор.
    let again: Awaited<ReturnType<typeof session.syncDocument>> | undefined;
    await act(async () => {
      const record = session.saveDocument(savedInput);
      again = await session.syncDocument(record.id);
    });
    expect(again?.ok).toBe(true);
    const id = again?.ok === true ? again.record.id : '';
    expect(fakeApi.documents().find((d) => d.id === id)?.companySnapshot?.directorName).toBe('Новый Директор');
  });
});

describe('шаблоны из конструктора («Тест день 3»)', () => {
  const input = (overrides: Partial<TemplateInput> = {}): TemplateInput => ({
    title: 'Приказ о стажировке',
    purpose: '',
    sectionId: 'hr',
    subsectionId: 'hr-personnel-orders',
    series: 'К',
    heading: { kk: 'Б Ұ Й Р Ы Қ', ru: 'ПРИКАЗ', en: 'ORDER' },
    langs: ['ru'],
    fields: [{ id: 'f1', label: 'Срок', kind: 'text', required: true }],
    body: { ru: 'Направить на стажировку сроком {Срок}.' },
    acquaint: false,
    ...overrides,
  });

  it('директор создаёт шаблон в своей компании; другая компания его не видит', async () => {
    await signInAs('director-a', A);
    let saved: ReturnType<typeof session.saveTemplate> = null;
    act(() => {
      saved = session.saveTemplate(input());
    });

    expect(saved).not.toBeNull();
    expect(loadDb().templates[0]?.companyId).toBe(A);
    expect(session.templates.map((t) => t.title)).toEqual(['Приказ о стажировке']);

    await switchTo('director-b', B);
    expect(session.templates).toEqual([]);
    expect(session.findCompanyTemplate(loadDb().templates[0]?.id ?? '')).toBeUndefined();
  });

  it('работник без выданного доступа шаблон не создаёт, с доступом – создаёт', async () => {
    fakeApi.patchUser('worker-a', { sectionIds: ['hr'] });
    await signInAs('worker-a', A);
    act(() => {
      session.saveTemplate(input());
    });
    expect(loadDb().templates).toEqual([]);

    await switchTo('director-a', A);
    await act(async () => {
      await session.updateUser('worker-a', { grantedActions: ['templates.create'] });
    });
    expect(user('worker-a')?.grantedActions).toEqual(['templates.create']);

    await switchTo('worker-a', A);
    act(() => {
      session.saveTemplate(input());
    });
    expect(loadDb().templates).toHaveLength(1);
  });

  it('выпущенный документ не меняется, когда шаблон правят или удаляют', async () => {
    await signInAs('director-a', A);
    let id = '';
    act(() => {
      id = session.saveTemplate(input())?.id ?? '';
    });

    let docId = '';
    act(() => {
      docId = session.saveDocument({
        templateId: id,
        sectionId: 'hr',
        title: 'Приказ о стажировке',
        number: '1',
        description: '',
        subject: '',
        values: { f1: 'месяц' },
        status: 'saved',
      }).id;
    });

    act(() => {
      session.saveTemplate(input({ id, body: { ru: 'Совсем другой текст {Срок}.' } }));
    });
    act(() => session.deleteTemplate(id));

    const record = session.findDocument(docId);
    const tpl = record === undefined ? undefined : session.findCompanyTemplate(record.templateId, record);
    const table = tpl?.body.find((b) => b.kind === 'tri-table');
    expect(table?.kind === 'tri-table' ? table.rows[0]?.ru?.[0]?.[0] : undefined).toEqual({
      text: 'Направить на стажировку сроком ',
    });
    // Удалённый шаблон пропал из каталога.
    expect(session.templates).toEqual([]);
  });
});

describe('снимок реквизитов с загруженным логотипом (оценка 25.09)', () => {
  it('документы хранят одну копию логотипа, а открытый документ получает сам логотип', async () => {
    const logo = `data:image/png;base64,${'B'.repeat(40_000)}`;
    fakeApi.patchCompany(A, { logo });
    await signInAs('director-a', A);

    const ids: string[] = [];
    act(() => {
      for (const number of ['1', '2', '3']) {
        ids.push(
          session.saveDocument({
            templateId: 'hr-hire-order',
            sectionId: 'hr',
            title: 'Приказ о приёме на работу',
            number,
            description: '',
            subject: '',
            values: {},
            status: 'saved',
          }).id,
        );
      }
    });

    const raw = localStorage.getItem('docflow.local.db') ?? '';
    // Одна копия в хранилище картинок и одна в карточке компании.
    expect(raw.split(logo).length - 1).toBe(2);
    expect(session.findDocument(ids[0] ?? '')?.companySnapshot?.logo).toBe(logo);
  });
});

describe('персонал – пользователи компании на сервере (этап 1б)', () => {
  it('после входа – персонал текущей компании с сервера; после выхода в браузере его нет', async () => {
    await signInAs('director-a', A);
    expect(session.employees.map((e) => e.id)).toEqual(['director-a', 'worker-a']);
    expect(session.employees.every((e) => e.companyId === A)).toBe(true);

    act(() => session.signOut());
    await settle();
    expect(loadDb().employees).toEqual([]);
  });

  it('правка карточки уходит на сервер с версией; чужая правка поверх – конфликт', async () => {
    await signInAs('director-a', A);
    const worker = session.employees.find((e) => e.id === 'worker-a');
    if (worker === undefined) throw new Error('нет worker-a');

    let outcome = await act(() => session.saveEmployee({ ...worker, position: 'Инженер' }));
    expect(outcome.ok).toBe(true);
    expect(fakeApi.person('worker-a', A)?.position).toBe('Инженер');
    expect(session.employees.find((e) => e.id === 'worker-a')?.position).toBe('Инженер');
    // Должность пользователя – из карточки.
    expect(user('worker-a')?.position).toBe('Инженер');

    // Кто-то правил человека, пока форма была открыта.
    fakeApi.patchUser('worker-a', { lockVersion: 7 });
    outcome = await act(() => session.saveEmployee({ ...worker, position: 'Юрист' }));
    expect(outcome.ok).toBe(false);
    expect(fakeApi.person('worker-a', A)?.position).toBe('Инженер');
  });

  it('новый человек – учётная запись без пароля; убрать из компании – учётной записи нет', async () => {
    await signInAs('director-a', A);
    const card = { fullName: 'Новый Человек', fullNameGenitive: '', position: 'Водитель', unit: '' };

    const created = await act(() => session.createEmployee({ ...card, login: 'new-1', password: '' }));
    expect(created.ok).toBe(true);
    const person = session.employees.find((e) => e.fullName === 'Новый Человек');
    expect(person?.position).toBe('Водитель');
    expect(fakeApi.user(person?.id ?? '')?.hasPassword).toBe(false);
    expect(user(person?.id ?? '')?.login).toBe('new-1');

    const taken = await act(() => session.createEmployee({ ...card, login: 'NEW-1', password: '' }));
    expect(taken).toMatchObject({ ok: false, reason: 'login-taken' });

    const removed = await act(() => session.removeEmployee(person?.id ?? ''));
    expect(removed.ok).toBe(true);
    expect(session.employees.some((e) => e.id === person?.id)).toBe(false);
    expect(fakeApi.user(person?.id ?? '')).toBeUndefined();
  });
});
