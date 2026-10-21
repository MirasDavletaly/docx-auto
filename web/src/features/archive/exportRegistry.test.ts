/**
 * Реестр архива в Excel: те же строки и колонки, что на экране, на языке
 * интерфейса («Тест день 3»).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { registryFileName, registryHeader, registryRows } from './exportRegistry';
import { setLanguage } from '@/i18n';

import type { RegistryRow } from './exportRegistry';

afterEach(() => setLanguage('ru'));

const rows: RegistryRow[] = [
  {
    kind: 'document',
    section: 'Кадры',
    doc: {
      id: 'd-1',
      templateId: 'hr-hire-order',
      companyId: 'c-a',
      title: 'Приказ о приёме на работу',
      description: 'основной штат',
      subject: 'Жақсылықова Динара Талғатқызы',
      status: 'saved',
      number: '07-К',
      createdAt: '2026-09-24T06:00:00.000Z',
      updatedAt: '2026-09-24T06:00:00.000Z',
      values: {},
      authorId: 'u-1',
      authorName: 'Мирас Давлеталы',
    },
  },
  {
    kind: 'file',
    section: 'Кадры',
    file: {
      id: 'f-1',
      companyId: 'c-a',
      title: 'Приказ 2019 года',
      number: null,
      documentDate: '2019-03-01',
      sectionId: 'hr',
      description: 'скан',
      fileName: 'a.pdf',
      size: 1,
      sha256: 'x',
      uploadedBy: 'u-1',
      uploadedByName: 'Мирас Давлеталы',
      uploadedAt: '2026-09-23T00:00:00.000Z',
    },
  },
];

describe('реестр в Excel', () => {
  it('колонки и строки – как на экране, по порядку', () => {
    expect(registryHeader()).toEqual([
      '№', 'Номер', 'Документ', 'Для кого', 'Описание', 'Дата', 'Раздел', 'Откуда', 'Кто',
    ]);
    const [first, second] = registryRows(rows);
    expect(first).toEqual([
      '1', '07-К', 'Приказ о приёме на работу', 'Жаксылыкова Динара Талгаткызы', 'основной штат',
      '24.09.2026', 'Кадры', 'Создан в системе', 'Мирас Давлеталы',
    ]);
    expect(second?.[0]).toBe('2');
    expect(second?.[1]).toBe('б/н');
    expect(second?.[7]).toBe('Загружен файлом PDF');
  });

  it('строки нескольких компаний – с колонкой «Компания» после описания (16.10)', () => {
    const [doc, file] = rows;
    const mixed: RegistryRow[] = [
      { ...doc!, company: 'ТОО «Algoritmi KZ»' },
      { ...file!, company: 'Kazakhstan New Technologies LLP' },
    ];
    expect(registryHeader(true)).toEqual([
      '№', 'Номер', 'Документ', 'Для кого', 'Описание', 'Компания', 'Дата', 'Раздел', 'Откуда', 'Кто',
    ]);
    const [first, second] = registryRows(mixed, true);
    expect(first?.[5]).toBe('ТОО «Algoritmi KZ»');
    expect(first?.[6]).toBe('24.09.2026');
    expect(second?.[5]).toBe('Kazakhstan New Technologies LLP');
    expect(second?.[8]).toBe('Загружен файлом PDF');
  });

  it('на английском – английские названия и имена латиницей', () => {
    setLanguage('en');
    const [first] = registryRows(rows);
    expect(first?.[2]).toBe('Hiring order');
    expect(first?.[3]).toBe('Dinara Zhaksylykova');
    expect(first?.[8]).toBe('Miras Davletaly');
  });

  it('имя файла без знаков, запрещённых в Windows', () => {
    expect(registryFileName('ТОО «ExLumen»', '2026-09-25')).toBe('Реестр документов ТОО ExLumen 2026-09-25.xlsx');
  });
});
