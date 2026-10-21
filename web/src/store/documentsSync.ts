/**
 * Документы, шаблоны компании и описания архива – копия с сервера
 * (docs/plans/phase-01c-documents.md), как учётные записи в `accounts.ts`.
 *
 * Запись документа мгновенна для экрана: автосохранение черновика идёт
 * каждые 0,6 с, и ждать сервера на каждом нажатии нельзя. Поэтому запись
 * ложится сразу в копию и в очередь отправки. Очередь шлёт по одному запросу
 * на документ – последнюю версию, с версией записи сервера (CLAUDE.md,
 * п. 3.5); нет связи – повторяет позже. «Сохранить» ждёт ответа сервера
 * (`flushDocument`), чтобы занятый номер и отказ были видны на форме.
 *
 * Решает сервер: отказ (нет прав, номер занят, конфликт версии) – копия
 * берётся с сервера заново, а экран получает причину.
 */
import { ApiError, NetworkError } from '@/api/client';
import { server } from '@/api/server';
import { syncAccounts } from '@/store/accounts';
import { loadDb, pruneImages, resolveImage, updateDb } from '@/store/db';

import type { DocumentInput } from '@/api/server';
import type { ArchiveFile, CustomTemplate, DocumentRecord } from '@/api/types';

export type PushResult =
  | { ok: true; record: DocumentRecord }
  | { ok: false; reason: 'number-taken' | 'company-changed' | 'conflict' | 'rejected' | 'offline'; message: string };

/** Что видно экрану: есть ли неотправленное и что пошло не так. */
export interface SyncStatus {
  /** Документы, ещё не дошедшие до сервера. */
  unsynced: number;
  /** Нет связи: изменения ждут отправки. */
  offline: boolean;
  /** Последний отказ сервера – для сообщения на экране. */
  problem: { reason: 'conflict' | 'rejected'; message: string } | null;
}

const pending = new Map<string, DocumentRecord>();
const running = new Set<string>();
const waiters = new Map<string, Array<(result: PushResult) => void>>();
/** Версия записи на сервере по документу; нет – на сервере его нет. */
const versions = new Map<string, number>();
const templateVersions = new Map<string, number>();
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const retryDelay = new Map<string, number>();

let status: SyncStatus = { unsynced: 0, offline: false, problem: null };
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch, unsynced: new Set([...pending.keys(), ...running]).size };
  for (const listener of listeners) listener();
}

export function syncStatus(): SyncStatus {
  return status;
}

export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dismissProblem(): void {
  setStatus({ problem: null });
}

/** Не дошло до сервера – эти документы копия с сервера не затирает. */
function unsyncedIds(): Set<string> {
  return new Set([...pending.keys(), ...running]);
}

export function serverVersion(id: string): number {
  return versions.get(id) ?? 0;
}

// ── Копия с сервера ─────────────────────────────────────────────────────────

async function allPages<T, P extends { items: T[]; next?: string }>(
  fetchPage: (cursor: string) => Promise<P>,
  onPage?: (page: P) => void,
): Promise<T[]> {
  const out: T[] = [];
  let cursor = '';
  // Предел – от зацикливания на неверном курсоре: 100 страниц по 100.
  for (let i = 0; i < 100; i += 1) {
    const page = await fetchPage(cursor);
    onPage?.(page);
    out.push(...page.items);
    if (page.next === undefined || page.next === '') break;
    cursor = page.next;
  }
  return out;
}

let syncing: Promise<void> | null = null;

/**
 * Свежая копия документов, шаблонов текущей компании и описаний архива.
 * Неотправленные документы остаются в том виде, в каком их правят.
 */
export function syncDocuments(): Promise<void> {
  if (syncing !== null) return syncing;
  syncing = (async () => {
    const images: Record<string, string> = {};
    const [documents, templates, archive] = await Promise.all([
      allPages<DocumentRecord, Awaited<ReturnType<typeof server.documents>>>(server.documents, (page) =>
        Object.assign(images, page.images),
      ),
      server.templates(),
      allPages<ArchiveFile, Awaited<ReturnType<typeof server.archive>>>(server.archive),
    ]);
    for (const doc of documents) versions.set(doc.id, doc.lockVersion ?? 0);
    for (const tpl of templates) templateVersions.set(tpl.id, tpl.lockVersion ?? 0);
    applyServerCopy(documents.map(fromServer), templates, archive, images);
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

/** Документ с сервера – в вид копии: пустые поля сервера – как их нет. */
function fromServer(doc: DocumentRecord): DocumentRecord {
  const { titleEn, deletedAt, deletedBy, companySnapshot, peopleSnapshot, templateSnapshot, ...rest } = doc;
  return {
    ...rest,
    ...(titleEn === undefined || titleEn === '' ? {} : { titleEn }),
    ...(deletedAt === undefined || deletedAt === null ? {} : { deletedAt, deletedBy: deletedBy ?? '' }),
    ...(companySnapshot === undefined || companySnapshot === null ? {} : { companySnapshot }),
    ...(peopleSnapshot === undefined || peopleSnapshot === null ? {} : { peopleSnapshot }),
    ...(templateSnapshot === undefined || templateSnapshot === null ? {} : { templateSnapshot }),
  };
}

function applyServerCopy(
  documents: DocumentRecord[],
  templates: CustomTemplate[],
  archive: ArchiveFile[],
  images: Record<string, string>,
): void {
  const keep = unsyncedIds();
  updateDb((cur) => {
    // Неотправленные – как их правят, в том числе новые, которых на сервере
    // ещё нет; остальное – с сервера.
    const merged = [
      ...cur.documents.filter((d) => keep.has(d.id)),
      ...documents.filter((d) => !keep.has(d.id)),
    ];
    return pruneImages({
      ...cur,
      documents: merged,
      templates: [
        ...cur.templates.filter((t) => pendingTemplates.has(t.id)),
        ...templates.filter((t) => !pendingTemplates.has(t.id)),
      ],
      archive,
      images: { ...cur.images, ...images },
    });
  });
}

/** Выход: в браузере не остаётся документов другого человека. */
export function clearDocuments(): void {
  pending.clear();
  running.clear();
  versions.clear();
  templateVersions.clear();
  for (const timer of retryTimers.values()) clearTimeout(timer);
  retryTimers.clear();
  retryDelay.clear();
  for (const list of waiters.values()) {
    for (const resolve of list) resolve({ ok: false, reason: 'rejected', message: '' });
  }
  waiters.clear();
  updateDb((cur) => ({ ...cur, documents: [], templates: [], archive: [], images: {} }));
  setStatus({ offline: false, problem: null });
}

// ── Очередь отправки документов ─────────────────────────────────────────────

/** Ставит последнюю версию документа в очередь отправки. */
export function queueDocument(record: DocumentRecord): void {
  pending.set(record.id, record);
  setStatus({});
  kick(record.id);
}

/**
 * Ждёт, пока документ дойдёт до сервера (или сервер откажет). Неотправленного
 * нет – сразу «готово» с текущей копией.
 */
export function flushDocument(id: string): Promise<PushResult> {
  if (!pending.has(id) && !running.has(id)) {
    const record = loadDb().documents.find((d) => d.id === id);
    return Promise.resolve(
      record === undefined
        ? { ok: false, reason: 'rejected', message: '' }
        : { ok: true, record },
    );
  }
  // Ждущему «Сохранить» – попытка сразу, без паузы повтора.
  const timer = retryTimers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    retryTimers.delete(id);
    kick(id);
  }
  return new Promise((resolve) => {
    waiters.set(id, [...(waiters.get(id) ?? []), resolve]);
  });
}

function settle(id: string, result: PushResult): void {
  const list = waiters.get(id) ?? [];
  waiters.delete(id);
  for (const resolve of list) resolve(result);
}

function kick(id: string): void {
  if (running.has(id)) return;
  running.add(id);
  void (async () => {
    let last: PushResult | null = null;
    try {
      while (pending.has(id)) {
        const record = pending.get(id) as DocumentRecord;
        pending.delete(id);
        last = await pushOnce(record);
        if (!last.ok && last.reason === 'offline') {
          // Новее этой версии ничего не завели – она ждёт повтора.
          if (!pending.has(id)) pending.set(id, record);
          scheduleRetry(id);
          break;
        }
        if (!last.ok) {
          // Сервер отказал: неотправленные правки этого документа теряют
          // смысл – копия возьмётся с сервера.
          pending.delete(id);
          break;
        }
      }
    } finally {
      running.delete(id);
      setStatus({ offline: [...retryTimers.keys()].length > 0 });
    }
    if (last !== null) {
      settle(id, last);
      if (!last.ok && last.reason !== 'offline') {
        setStatus({
          problem: { reason: last.reason === 'conflict' ? 'conflict' : 'rejected', message: last.message },
        });
        void syncDocuments().catch(() => undefined);
        // Свежая карточка – чтобы человек увидел новые реквизиты на листе
        // до того, как сохранит ещё раз.
        if (last.reason === 'company-changed') void syncAccounts().catch(() => undefined);
      }
    }
  })();
}

function scheduleRetry(id: string): void {
  const delay = Math.min((retryDelay.get(id) ?? 2500) * 2, 60_000);
  retryDelay.set(id, delay);
  retryTimers.set(
    id,
    setTimeout(() => {
      retryTimers.delete(id);
      kick(id);
    }, delay),
  );
  setStatus({ offline: true });
}

/** Связь вернулась – неотправленное уходит сразу. */
export function retryNow(): void {
  for (const [id, timer] of [...retryTimers]) {
    clearTimeout(timer);
    retryTimers.delete(id);
    kick(id);
  }
}

if (typeof window !== 'undefined') window.addEventListener('online', retryNow);

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('картинка')));
    reader.onerror = () => reject(reader.error ?? new Error('картинка'));
    reader.readAsDataURL(blob);
  });
}

const SERVER_IMAGE = /^image:s[0-9a-f]{64}$/;

/**
 * Логотип снимка – в вид для сервера: ссылкой на загруженную картинку.
 * Файл из сборки сайта читается и уходит картинкой: так снимок не зависит
 * от имени файла в следующей сборке. Не прочитался – уходит адрес файла.
 */
async function logoForServer(logo: string | undefined): Promise<string | undefined> {
  if (logo === undefined || SERVER_IMAGE.test(logo)) return logo;
  let data = logo.startsWith('image:') ? resolveImage(logo) : logo;
  if (data === undefined) return undefined;
  if (!data.startsWith('data:')) {
    try {
      const res = await fetch(data);
      if (!res.ok) return data;
      data = await readAsDataUrl(await res.blob());
    } catch {
      return data;
    }
  }
  const ref = await server.putImage(data);
  const image = data;
  updateDb((cur) => (cur.images[ref] === image ? cur : { ...cur, images: { ...cur.images, [ref]: image } }));
  return ref;
}

async function inputOf(record: DocumentRecord): Promise<DocumentInput> {
  const snapshot = record.companySnapshot;
  let companySnapshot = snapshot;
  if (snapshot !== undefined && snapshot.logo !== undefined) {
    const logo = await logoForServer(snapshot.logo);
    const { logo: _old, ...rest } = snapshot;
    companySnapshot = logo === undefined ? rest : { ...rest, logo };
  }
  return {
    templateId: record.templateId,
    sectionId: record.sectionId ?? '',
    title: record.title,
    ...(record.titleEn === undefined ? {} : { titleEn: record.titleEn }),
    description: record.description,
    subject: record.subject,
    status: record.status,
    number: record.number ?? '',
    values: record.values,
    ...(companySnapshot === undefined ? {} : { companySnapshot }),
    ...(record.peopleSnapshot === undefined ? {} : { peopleSnapshot: record.peopleSnapshot }),
    ...(record.templateSnapshot === undefined ? {} : { templateSnapshot: record.templateSnapshot }),
    lockVersion: versions.get(record.id) ?? record.lockVersion ?? 0,
  };
}

function offline(error: unknown): boolean {
  return (
    error instanceof NetworkError ||
    (error instanceof ApiError && (error.status >= 500 || error.status === 429 || error.status === 408))
  );
}

async function pushOnce(record: DocumentRecord): Promise<PushResult> {
  try {
    const saved = fromServer(await server.saveDocument(record.id, await inputOf(record)));
    versions.set(saved.id, saved.lockVersion ?? 0);
    retryDelay.delete(saved.id);
    updateDb((cur) => ({
      ...cur,
      documents: cur.documents.map((d) => {
        if (d.id !== saved.id) return d;
        // Пока ответ шёл, документ правили дальше: остаётся правка, а версия – новая.
        return pending.has(saved.id) ? { ...d, lockVersion: saved.lockVersion ?? 0 } : saved;
      }),
    }));
    return { ok: true, record: saved };
  } catch (error) {
    if (offline(error)) return { ok: false, reason: 'offline', message: '' };
    if (error instanceof ApiError) {
      // Реквизиты компании правили, пока документ был открыт: выпускать его
      // по прежней карточке сервер не стал.
      if (error.status === 409 && error.code === 'company_changed') {
        return { ok: false, reason: 'company-changed', message: error.message };
      }
      if (error.status === 409) return { ok: false, reason: 'conflict', message: error.message };
      if (error.fields.some((f) => f.field === 'number')) {
        return { ok: false, reason: 'number-taken', message: error.fields[0]?.message ?? error.message };
      }
      return { ok: false, reason: 'rejected', message: error.message };
    }
    return { ok: false, reason: 'rejected', message: error instanceof Error ? error.message : '' };
  }
}

// ── Шаблоны из конструктора ─────────────────────────────────────────────────

const pendingTemplates = new Set<string>();
const templateChains = new Map<string, Promise<unknown>>();

/** Шаблон уходит на сервер следом за предыдущей записью того же шаблона. */
export function pushTemplate(record: CustomTemplate): Promise<boolean> {
  pendingTemplates.add(record.id);
  const previous = templateChains.get(record.id) ?? Promise.resolve();
  const next = previous.then(async () => {
    const { id, companyId: _company, lockVersion: _version, ...template } = record;
    try {
      const saved = await server.saveTemplate(id, template, templateVersions.get(id) ?? record.lockVersion ?? 0);
      templateVersions.set(id, saved.lockVersion ?? 0);
      updateDb((cur) => ({ ...cur, templates: cur.templates.map((t) => (t.id === id ? saved : t)) }));
      return true;
    } catch (error) {
      setStatus({
        problem: { reason: error instanceof ApiError && error.status === 409 ? 'conflict' : 'rejected', message: error instanceof Error ? error.message : '' },
      });
      return false;
    } finally {
      pendingTemplates.delete(id);
    }
  });
  templateChains.set(record.id, next);
  return next.then((ok) => {
    if (!ok) void syncDocuments().catch(() => undefined);
    return ok;
  });
}

export async function removeTemplate(id: string): Promise<boolean> {
  await templateChains.get(id);
  try {
    await server.deleteTemplate(id, templateVersions.get(id) ?? 0);
    templateVersions.set(id, (templateVersions.get(id) ?? 0) + 1);
    return true;
  } catch (error) {
    setStatus({ problem: { reason: 'rejected', message: error instanceof Error ? error.message : '' } });
    void syncDocuments().catch(() => undefined);
    return false;
  }
}

/**
 * Действие над документом на сервере (удаление, возврат, стирание, доступ):
 * сначала дошла последняя правка, потом действие с версией сервера. Отказ –
 * свежая копия и сообщение.
 */
export async function documentAction(
  id: string,
  run: (lockVersion: number) => Promise<DocumentRecord | undefined>,
  onDone: (version: number) => void,
): Promise<boolean> {
  await flushDocument(id);
  try {
    const result = await run(versions.get(id) ?? 0);
    if (result !== undefined) {
      const fresh = fromServer(result);
      versions.set(id, fresh.lockVersion ?? 0);
      updateDb((cur) => ({ ...cur, documents: cur.documents.map((d) => (d.id === id ? fresh : d)) }));
    } else {
      const next = (versions.get(id) ?? 0) + 1;
      versions.set(id, next);
      onDone(next);
    }
    return true;
  } catch (error) {
    setStatus({
      problem: {
        reason: error instanceof ApiError && error.status === 409 ? 'conflict' : 'rejected',
        message: error instanceof Error ? error.message : '',
      },
    });
    void syncDocuments().catch(() => undefined);
    return false;
  }
}

/** Для тестов: очередь пуста и ничего не ждёт. */
export function resetSync(): void {
  clearDocuments();
  pendingTemplates.clear();
  templateChains.clear();
}
