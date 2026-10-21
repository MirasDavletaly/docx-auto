/**
 * Имена на языке интерфейса («Тест день 3», второй снимок: на английском
 * экране под «Disciplinary action order» стояло «Жақсылықова Динара
 * Талғатқызы»).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { documentSubject, personName } from './person';
import { setLanguage } from './index';

import type { DocumentRecord } from '@/api/types';

afterEach(() => setLanguage('ru'));

const doc: DocumentRecord = {
  id: 'd-1',
  templateId: 'hr-discipline-order',
  companyId: 'c-a',
  title: 'Приказ о дисциплинарном взыскании',
  description: '',
  subject: 'Жақсылықова Динара Талғатқызы',
  status: 'saved',
  number: '58',
  createdAt: '2026-09-24T06:00:00.000Z',
  updatedAt: '2026-09-24T06:00:00.000Z',
  values: {},
  authorId: 'u-1',
  authorName: 'Мирас Давлеталы',
};

describe('на английском', () => {
  it('«для кого» – латиницей', () => {
    setLanguage('en');
    expect(documentSubject(doc)).toBe('Dinara Zhaksylykova');
  });

  it('написание из карточки главнее транслитерации', () => {
    setLanguage('en');
    const withCard: DocumentRecord = {
      ...doc,
      peopleSnapshot: {
        'e-6': {
          id: 'e-6',
          companyId: 'c-a',
          fullName: 'Жаксылыкова Динара Талгаткызы',
          fullNameGenitive: '',
          fullNameEn: 'Dinara Zhaqsylyqova',
          position: '',
          unit: '',
        },
      },
    };
    expect(documentSubject(withCard)).toBe('Dinara Zhaqsylyqova');
  });

  it('«кто создал» – латиницей', () => {
    setLanguage('en');
    expect(personName(doc.authorName)).toBe('Miras Davletaly');
    expect(personName('Miras')).toBe('Miras');
  });
});

describe('на русском', () => {
  it('без казахских букв', () => {
    expect(documentSubject(doc)).toBe('Жаксылыкова Динара Талгаткызы');
    expect(personName('Мирас Давлеталы')).toBe('Мирас Давлеталы');
  });

  it('пустое остаётся пустым', () => {
    setLanguage('en');
    expect(personName('')).toBe('');
  });
});
