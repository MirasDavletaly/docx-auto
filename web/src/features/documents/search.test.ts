import { describe, expect, it } from 'vitest';

import { searchDocuments } from './search';

import type { DocumentRecord } from '@/api/types';

function doc(overrides: Partial<DocumentRecord>): DocumentRecord {
  return {
    id: 'd-1',
    templateId: 'hr-leave-order',
    companyId: 'c-a',
    title: 'Приказ о предоставлении ежегодного трудового отпуска',
    description: 'за второе полугодие',
    subject: 'Ахметов Асхат Каирович',
    status: 'saved',
    number: '12-К/2026',
    createdAt: '2026-09-21T06:00:00.000Z',
    updatedAt: '2026-09-22T06:00:00.000Z',
    values: {},
    authorId: 'u-1',
    authorName: 'Сейтова Алия',
    ...overrides,
  };
}

const leave = doc({ id: 'leave' });
const hire = doc({
  id: 'hire',
  title: 'Приказ о приёме на работу',
  description: '',
  subject: 'Нуржанов Диас',
  status: 'draft',
  number: null,
  authorName: 'Ёлкина Мария',
  createdAt: '2026-08-01T06:00:00.000Z',
  updatedAt: '2026-08-01T06:00:00.000Z',
});
const all = [leave, hire];

function ids(query: string): string[] {
  return searchDocuments(all, query).map((d) => d.id);
}

describe('поиск по реестру («Тест день 2»)', () => {
  it('пустой запрос оставляет все документы', () => {
    expect(ids('   ')).toEqual(['leave', 'hire']);
  });

  it.each([
    ['номеру', '12-к'],
    ['названию', 'отпуск'],
    ['тому, для кого', 'ахметов'],
    ['описанию', 'полугодие'],
    ['тому, кто заполнил', 'сейтова'],
    ['дате создания', '21.09.2026'],
    ['дате изменения', '22.09.2026'],
  ])('находит по %s', (_what, query) => {
    expect(ids(query)).toEqual(['leave']);
  });

  it('находит по состоянию на обоих языках', () => {
    expect(ids('черновик')).toEqual(['hire']);
    expect(ids('draft')).toEqual(['hire']);
  });

  it('несколько слов сужают поиск', () => {
    expect(ids('приказ')).toEqual(['leave', 'hire']);
    expect(ids('приказ нуржанов')).toEqual(['hire']);
    expect(ids('приказ нуржанов отпуск')).toEqual([]);
  });

  it('не различает регистр и «ё»', () => {
    expect(ids('ЕЛКИНА')).toEqual(['hire']);
    expect(ids('приём')).toEqual(['hire']);
    expect(ids('прием')).toEqual(['hire']);
  });
});

describe('поиск по изменённому документу (оптимизация 01.10)', () => {
  it('поля документа запоминаются, но правка документа – новая запись, и поиск её видит', () => {
    const before = doc({ id: 'x', subject: 'Ахметов Асхат Каирович' });
    expect(searchDocuments([before], 'ахметов')).toEqual([before]);
    expect(searchDocuments([before], 'ахметов')).toEqual([before]);

    const after = { ...before, subject: 'Ким Ирина Сергеевна' };
    expect(searchDocuments([after], 'ахметов')).toEqual([]);
    expect(searchDocuments([after], 'ким')).toEqual([after]);
  });

  it('300 документов и 15 нажатий – быстро', () => {
    const many = Array.from({ length: 300 }, (_, i) => doc({ id: `d-${i}`, subject: `Работник ${i}`, description: `Командировка ${i}` }));
    const started = performance.now();
    for (const query of ['к', 'ки', 'ким', 'ким ', 'ким и', 'ким ир', 'ким ири', 'ким ирин', 'ким ирина', 'ким ирина ', 'р', 'ра', 'раб', 'рабо', 'работ']) {
      searchDocuments(many, query);
    }
    // Замер 01.10 на машине разработчика: было 530 мс, стало 16 мс. Предел
    // 400 мс – с запасом для медленной машины, но прежнюю скорость не пропустит.
    expect(performance.now() - started).toBeLessThan(400);
  });
});
