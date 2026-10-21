/**
 * Реквизиты компании на английском интерфейсе («на английском выборе
 * компании её информация не переводится»).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { companyBasis, companyCity, companyDirector, companyName } from './company';
import { setLanguage } from './index';

import type { Company } from '@/api/types';

const knt: Company = {
  id: 'c-knt',
  name: 'Kazakhstan New Technologies LLP',
  nameEn: 'Kazakhstan New Technologies LLP',
  legalName: 'ТОО «KNT»',
  bin: '200840900077',
  address: 'г. Астана',
  directorName: 'Гезини Алессандро',
  directorNameEn: 'Ghesini Alessandro',
  directorTitle: 'Генеральный директор',
  directorTitleGenitive: 'Генерального директора',
  directorNameGenitive: 'Гезини Алессандро',
  directorBasis: 'Устава',
  city: 'Астана',
  cityEn: 'Astana city',
  accent: '#1f5c4a',
  monogram: 'KN',
};

/** Новая компания: английских реквизитов в карточке ещё нет. */
const fresh: Company = {
  ...knt,
  name: 'ТОО «Новая компания»',
  directorName: 'Султангалиева А.Т.',
  city: 'Аксай',
};
delete (fresh as Partial<Company>).nameEn;
delete (fresh as Partial<Company>).directorNameEn;
delete (fresh as Partial<Company>).cityEn;

afterEach(() => setLanguage('ru'));

describe('реквизиты компании на языке интерфейса', () => {
  it('на русском – как в карточке', () => {
    setLanguage('ru');
    expect(companyName(knt)).toBe('Kazakhstan New Technologies LLP');
    expect(companyCity(knt)).toBe('Астана');
    expect(companyDirector(knt)).toBe('Гезини Алессандро');
    expect(companyBasis(knt)).toBe('Устава');
  });

  it('на английском – английские значения карточки, город без «city»', () => {
    setLanguage('en');
    expect(companyCity(knt)).toBe('Astana');
    expect(companyDirector(knt)).toBe('Ghesini Alessandro');
    expect(companyBasis(knt)).toBe('the Charter');
  });

  it('чего нет в карточке, собирается латиницей, а не остаётся кириллицей', () => {
    setLanguage('en');
    expect(companyName(fresh)).toBe('Novaya kompaniya LLP');
    expect(companyCity(fresh)).toBe('Aksai');
    expect(companyDirector(fresh)).toBe('Sultangalieva A.T.');
  });
});
