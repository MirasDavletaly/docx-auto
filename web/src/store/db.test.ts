/**
 * Хранилище.
 *
 * Два свойства, за которые здесь отвечают: справочник людей у каждой компании
 * свой, и запись, сохранённая прежней версией сайта, читается без «undefined»
 * на экране и без состояний, которых больше нет.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LEGACY_DOCUMENTS_KEY,
  employeesOf,
  findEmployeeIn,
  internImage,
  loadDb,
  migrateAllowList,
  pruneImages,
  reloadDb,
  resetDb,
  resolveImage,
  storageFailing,
  updateDb,
} from './db';

import { readLegacy } from './legacy';


import type { Company, DocumentRecord, EmployeeBrief } from '@/api/types';

beforeEach(() => {
  localStorage.clear();
  resetDb();
});

describe('первое открытие', () => {
  it('учётных записей и персонала нет: они приходят с сервера после входа', () => {
    const db = loadDb();
    expect(db.users).toEqual([]);
    expect(db.employees).toEqual([]);
    expect(db.companies.length).toBeGreaterThan(0);
  });
});

const card = (id: string, companyId: string, fullName: string): EmployeeBrief => ({
  id, companyId, fullName, fullNameGenitive: fullName, position: '', unit: '',
});

describe('справочник людей', () => {
  // Копия персонала с сервера: человек двух компаний – две карточки с одним
  // идентификатором учётной записи (должность своя в каждой).
  beforeEach(() => {
    updateDb((db) => ({
      ...db,
      employees: [
        card('u-1', 'c-a', 'Ахметов Асхат'),
        card('u-2', 'c-b', 'Ким Ирина'),
        { ...card('u-3', 'c-a', 'Оспанов Нурлан'), position: 'Инженер' },
        { ...card('u-3', 'c-b', 'Оспанов Нурлан'), position: 'Бухгалтер' },
      ],
    }));
  });

  it('у каждой компании свой: человек одной не попадает в список другой', () => {
    expect(employeesOf('c-a').map((e) => e.id)).toEqual(['u-1', 'u-3']);
    expect(employeesOf('c-b').map((e) => e.id)).toEqual(['u-2', 'u-3']);
  });

  it('карточку чужой компании по её идентификатору не достать; должность – своей компании', () => {
    expect(findEmployeeIn('c-a', 'u-1')?.fullName).toBe('Ахметов Асхат');
    expect(findEmployeeIn('c-b', 'u-1')).toBeUndefined();
    expect(findEmployeeIn('c-a', 'u-3')?.position).toBe('Инженер');
    expect(findEmployeeIn('c-b', 'u-3')?.position).toBe('Бухгалтер');
  });
});

describe('персонал переехал на сервер (этап 1б, 13.10)', () => {
  it('карточки, заведённые в браузере, уходят; документы людей не теряют', () => {
    const company = 'c-knt';
    const akhmetov = `${company}:e-1`;
    const kim = `${company}:e-2`;
    const base = { templateId: 'hr-hire-order', companyId: company, title: 'Приказ', createdAt: '2026-01-01T00:00:00.000Z' };
    localStorage.setItem(
      'docflow.local.db',
      JSON.stringify({
        version: 3,
        employees: [
          card(akhmetov, company, 'Ахметов Асхат Каирович'),
          card(kim, company, 'Ким Ирина Сергеевна'),
          card('c-greensparklimited:gs-01', 'c-greensparklimited', 'Кабешова Самал Амангельдииевна'),
        ],
        documents: [
          { ...base, id: 'd-1', status: 'saved', values: { employee: akhmetov } },
          {
            ...base, id: 'd-2', status: 'saved', values: { employee: akhmetov },
            peopleSnapshot: { [akhmetov]: card(akhmetov, company, 'Как было при выпуске') },
          },
          { ...base, id: 'd-3', status: 'draft', values: { employee: akhmetov, members: `${kim}\nВписан руками` } },
        ],
      }),
    );
    reloadDb();

    const db = loadDb();
    expect(db.employees).toEqual([]);
    // Записано сразу, а не при первой правке.
    expect(JSON.parse(localStorage.getItem('docflow.local.db') ?? '{}').version).toBe(5);

    // Документы браузера с версии 5 отложены (не переносятся на сервер).
    expect(db.documents).toEqual([]);
    const [saved, snapshotted, draft] = legacyDocuments();
    // Выпущенный выглядит как прежде: карточка – в снимке, значения не тронуты.
    expect(saved?.values.employee).toBe(akhmetov);
    expect(saved?.peopleSnapshot?.[akhmetov]?.fullName).toBe('Ахметов Асхат Каирович');
    // Готовый снимок не переписывается (CLAUDE.md, п. 3.4).
    expect(snapshotted?.peopleSnapshot?.[akhmetov]?.fullName).toBe('Как было при выпуске');
    // В черновике – ФИО текстом, как вписанное руками.
    expect(draft?.values.employee).toBe('Ахметов Асхат Каирович');
    expect(draft?.values.members).toBe('Ким Ирина Сергеевна\nВписан руками');
  });

  it('копия с сервера переживает перезагрузку и больше не убирается', () => {
    updateDb((db) => ({ ...db, employees: [card('u-1', 'c-a', 'Ахметов Асхат')] }));
    reloadDb();
    expect(employeesOf('c-a').map((e) => e.id)).toEqual(['u-1']);
  });
});

/** Документы, отложенные при переходе на сервер (версия 5). */
function legacyDocuments(): DocumentRecord[] {
  const raw = localStorage.getItem(LEGACY_DOCUMENTS_KEY);
  return raw === null ? [] : (JSON.parse(raw) as { documents: DocumentRecord[] }).documents;
}

describe('документы на сервере (этап 1б, часть 2, 15.10)', () => {
  it('документы, шаблоны и архив браузера откладываются, а не стираются', () => {
    localStorage.setItem(
      'docflow.local.db',
      JSON.stringify({
        version: 4,
        documents: [
          { id: 'd-1', templateId: 'hr-hire-order', companyId: 'c-a', title: 'Приказ', status: 'saved', createdAt: '2026-01-01T00:00:00.000Z', values: { a: '1' } },
        ],
        templates: [{ id: 'custom-1', companyId: 'c-a', title: 'Шаблон' }],
        archive: [{ id: 'f-1', companyId: 'c-a', title: 'Скан' }],
      }),
    );
    reloadDb();

    const db = loadDb();
    expect([db.documents, db.templates, db.archive]).toEqual([[], [], []]);
    const stash = JSON.parse(localStorage.getItem(LEGACY_DOCUMENTS_KEY) ?? '{}') as {
      documents: DocumentRecord[];
      templates: unknown[];
      archive: unknown[];
    };
    expect(stash.documents.map((d) => d.values)).toEqual([{ a: '1' }]);
    expect(stash.templates).toHaveLength(1);
    expect(stash.archive).toHaveLength(1);

    // Второе чтение уже отложенного не затирает.
    reloadDb();
    loadDb();
    expect(legacyDocuments()).toHaveLength(1);
  });
});

describe('чтение старой записи', () => {
  it('состояния, которых больше нет, читаются как «сохранён»', () => {
    // Так выглядела запись до того, как согласование и утверждение убрали.
    localStorage.setItem(
      'docflow.local.db',
      JSON.stringify({
        version: 1,
        documents: [
          { id: 'd-1', templateId: 'hr-hire-order', companyId: 'c-a', title: 'Приказ', status: 'approved', createdAt: '2026-01-01T00:00:00.000Z', values: {} },
          { id: 'd-2', templateId: 'hr-hire-order', companyId: 'c-a', title: 'Приказ', status: 'draft', createdAt: '2026-01-01T00:00:00.000Z', values: {} },
        ],
      }),
    );
    // Хранилище подменено мимо этой вкладки: так же, как если бы запись
    // оставила прежняя версия сайта.
    reloadDb();

    loadDb();
    const documents = legacyDocuments();
    expect(documents.map((d) => d.status)).toEqual(['saved', 'draft']);
  });

  it('поля, появившиеся позже, не приходят как undefined', () => {
    localStorage.setItem(
      'docflow.local.db',
      JSON.stringify({
        version: 1,
        documents: [
          { id: 'd-1', templateId: 'hr-hire-order', companyId: 'c-a', title: 'Приказ', status: 'draft', createdAt: '2026-01-01T00:00:00.000Z', values: {} },
        ],
      }),
    );
    reloadDb();

    loadDb();
    const doc = legacyDocuments()[0];
    expect(doc).toBeDefined();
    if (doc === undefined) return;

    expect(doc.description).toBe('');
    expect(doc.subject).toBe('');
    expect(doc.authorId).toBe('');
    expect(doc.number).toBeNull();
    expect(doc.updatedAt).toBe(doc.createdAt);
  });
});

describe('компания, убранная из группы («удали компанию Nova», 25.09)', () => {
  it('в исходном наборе её нет', () => {
    expect(loadDb().companies.some((c) => c.id === 'c-novalliance')).toBe(false);
  });

  it('из базы прежней версии уходят компания и её люди, документы – в корзину', () => {
    const before = loadDb();
    const [first] = before.companies;
    if (first === undefined) throw new Error('нет компаний');

    localStorage.setItem(
      'docflow.local.db',
      JSON.stringify({
        ...before,
        companies: [...before.companies, { ...first, id: 'c-novalliance', name: 'ТОО NOVALLIANCE' }],
        employees: [
          ...before.employees,
          { id: 'c-novalliance:e-1', companyId: 'c-novalliance', fullName: 'Кто-то', fullNameGenitive: 'Кого-то', position: '', unit: '' },
        ],
        users: [
          { id: 'u-1', login: 'dir', displayName: 'Д', role: 'director', companyIds: ['c-novalliance', first.id], sectionIds: [], createdAt: '2026-01-01T00:00:00.000Z', password: {}, failedAttempts: 0 },
        ],
        documents: [
          { id: 'd-1', templateId: 'hr-hire-order', companyId: 'c-novalliance', title: 'Приказ', status: 'saved', createdAt: '2026-01-01T00:00:00.000Z', values: {} },
          { id: 'd-2', templateId: 'hr-hire-order', companyId: first.id, title: 'Приказ', status: 'saved', createdAt: '2026-01-01T00:00:00.000Z', values: {} },
        ],
        archive: [
          { id: 'f-1', companyId: 'c-novalliance', title: 'Скан', number: null, documentDate: '2026-01-01', sectionId: 'hr', description: '', fileName: 'a.pdf', size: 1, sha256: 'x', uploadedBy: 'u-1', uploadedByName: 'Д', uploadedAt: '2026-01-01T00:00:00.000Z' },
        ],
      }),
    );
    reloadDb();

    const db = loadDb();
    expect(db.companies.some((c) => c.id === 'c-novalliance')).toBe(false);
    expect(db.employees.some((e) => e.companyId === 'c-novalliance')).toBe(false);
    // Учётные записи прежней версии отложены для переноса на сервер – уже
    // без доступа к убранной компании и без хеша пароля.
    expect(db.users).toEqual([]);
    expect(readLegacy()?.users[0]?.companyIds).toEqual([first.id]);
    expect(JSON.stringify(readLegacy())).not.toContain('failedAttempts');

    // Документы не стираются молча: они в корзине, откуда их возвращают или
    // удаляют навсегда. Документы других компаний не тронуты.
    expect(db.documents.find((d) => d.id === 'd-1')?.deletedAt).toBeDefined();
    expect(db.documents.find((d) => d.id === 'd-2')?.deletedAt).toBeUndefined();
    expect(db.archive[0]?.deletedAt).toBeDefined();
  });
});

describe('русское написание имён в справочнике («Нұрлан» – «Нурлан»)', () => {
  it('имя с казахскими буквами переходит в казахское поле, русское – русскими буквами', () => {
    const before = loadDb();
    const [first] = before.companies;
    if (first === undefined) throw new Error('нет компаний');

    localStorage.setItem(
      'docflow.local.db',
      JSON.stringify({
        ...before,
        employees: [
          { id: 'e-1', companyId: first.id, fullName: 'Оспанов Нұрлан Ерболатович', fullNameGenitive: 'Оспанова Нұрлана Ерболатовича', position: '', unit: '' },
          { id: 'e-2', companyId: first.id, fullName: 'Серіков Ержан', fullNameGenitive: 'Серікова Ержана', fullNameKk: 'Серіков Ержан Болатұлы', position: '', unit: '' },
        ],
        documents: [
          {
            id: 'd-1', templateId: 'hr-hire-order', companyId: first.id, title: 'Приказ', status: 'saved', createdAt: '2026-01-01T00:00:00.000Z', values: { employee: 'e-1' },
            peopleSnapshot: { 'e-1': { id: 'e-1', companyId: first.id, fullName: 'Оспанов Нұрлан Ерболатович', fullNameGenitive: 'Оспанова Нұрлана Ерболатовича', position: '', unit: '' } },
          },
        ],
      }),
    );
    reloadDb();

    const [nurlan, erzhan] = loadDb().employees;
    expect(nurlan?.fullName).toBe('Оспанов Нурлан Ерболатович');
    expect(nurlan?.fullNameGenitive).toBe('Оспанова Нурлана Ерболатовича');
    expect(nurlan?.fullNameKk).toBe('Оспанов Нұрлан Ерболатович');

    // Казахское написание, вписанное руками, не затирается.
    expect(erzhan?.fullName).toBe('Сериков Ержан');
    expect(erzhan?.fullNameKk).toBe('Серіков Ержан Болатұлы');

    // Выпущенный документ не переписывается (CLAUDE.md, п. 3.4).
    expect(loadDb().documents[0]?.peopleSnapshot?.['e-1']?.fullName).toBe(
      'Оспанов Нұрлан Ерболатович',
    );
  });
});

describe('картинки в снимках хранятся один раз (оценка 25.09)', () => {
  const logo = `data:image/png;base64,${'A'.repeat(50_000)}`;

  it('логотип в снимке – ссылка на общее хранилище, копия одна на все документы', () => {
    updateDb((db) => {
      let next = db;
      for (const id of ['d-1', 'd-2', 'd-3']) {
        const [withImage, ref] = internImage(next, logo);
        next = {
          ...withImage,
          documents: [
            ...withImage.documents,
            { id, templateId: 'hr-hire-order', companyId: 'c-a', title: 'Приказ', description: '', subject: '', status: 'saved', number: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', values: {}, authorId: '', authorName: '', companySnapshot: { ...(db.companies[0] as Company), logo: ref } },
          ],
        };
      }
      return next;
    });

    const raw = localStorage.getItem('docflow.local.db') ?? '';
    expect(raw.split(logo).length - 1).toBe(1);
    expect(resolveImage(loadDb().documents[0]?.companySnapshot?.logo)).toBe(logo);
  });

  it('база прежней версии: логотипы из снимков переезжают в общее хранилище', () => {
    const before = loadDb();
    const company = { ...(before.companies[0] as Company), logo };
    localStorage.setItem(
      'docflow.local.db',
      JSON.stringify({
        ...before,
        documents: ['d-1', 'd-2'].map((id) => ({
          id, templateId: 'hr-hire-order', companyId: company.id, title: 'Приказ', status: 'saved', createdAt: '2026-01-01T00:00:00.000Z', values: {}, companySnapshot: company,
        })),
      }),
    );
    reloadDb();

    const db = loadDb();
    expect(Object.keys(db.images)).toHaveLength(1);
    expect(db.documents[0]?.companySnapshot?.logo).toMatch(/^image:/u);
    expect(resolveImage(db.documents[1]?.companySnapshot?.logo)).toBe(logo);
  });
});

describe('неиспользуемые картинки', () => {
  it('убираются, когда на них больше не ссылается ни один снимок', () => {
    const [withImage] = internImage(loadDb(), 'data:image/png;base64,QQ==');
    expect(Object.keys(pruneImages(withImage).images)).toEqual([]);
  });
});

describe('хранилище браузера заполнено (оценка 25.09)', () => {
  it('сбой записи не глотается молча, а виден; следующая удачная запись его снимает', () => {
    const quota = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('переполнено', 'QuotaExceededError');
    });
    updateDb((db) => ({ ...db, audit: [] }));
    expect(storageFailing()).toBe(true);

    quota.mockRestore();
    updateDb((db) => ({ ...db, audit: [] }));
    expect(storageFailing()).toBe(false);
  });
});

describe('журнал действий', () => {
  it('запись переживает перезагрузку страницы', () => {
    updateDb((db) => ({
      ...db,
      audit: [
        {
          id: 'a-1',
          at: '2026-01-01T00:00:00.000Z',
          userId: 'u-1',
          userName: 'Кто-то',
          companyId: 'c-a',
          event: 'document.create',
          target: 'Приказ',
        },
      ],
    }));

    // resetDb очищает кэш модуля, но не хранилище: имитируем перезагрузку.
    const raw = localStorage.getItem('docflow.local.db');
    expect(raw).not.toBeNull();
    expect(raw).toContain('document.create');
  });
});

describe('список адресов админ-панели («Тест день 2»)', () => {
  it('старый список строк становится адресами без названия', () => {
    expect(migrateAllowList(['203.0.113.7', ' ', '10.0.0.0/8'])).toEqual([
      { ip: '203.0.113.7', name: '' },
      { ip: '10.0.0.0/8', name: '' },
    ]);
  });

  it('новый список с названиями читается как есть, мусор отбрасывается', () => {
    expect(
      migrateAllowList([{ ip: '203.0.113.7', name: 'Офис' }, { name: 'без адреса' }, 42, null]),
    ).toEqual([{ ip: '203.0.113.7', name: 'Офис' }]);
    expect(migrateAllowList(undefined)).toEqual([]);
  });
});
