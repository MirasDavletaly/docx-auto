/**
 * Реквизиты всех компаний на английском («где английский в реквизитах
 * компаний?»). Проверяется то, что показывает английский экран: ни в одной
 * строке не остаётся кириллицы. Казахское наименование и должность на
 * казахском сюда не входят – это реквизиты на казахском, а не перевод.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { companies } from './companies';
import { companyBasis, companyCity, companyDirector, companyDirectorTitle, companyName } from '@/i18n/company';
import { tc } from '@/i18n/content';
import { setLanguage } from '@/i18n';

const CYRILLIC = /[А-Яа-яЁёӘәҒғҚқҢңӨөҰұҮүҺһІі]/u;

afterEach(() => setLanguage('ru'));

describe('реквизиты компаний на английском', () => {
  it.each(companies.map((c) => [c.name, c] as const))('%s', (_name, company) => {
    setLanguage('en');

    const shown = [
      companyName(company),
      companyCity(company),
      companyDirector(company),
      companyDirectorTitle(company),
      companyBasis(company),
      company.legalNameEn ?? '',
      company.addressEn ?? '',
      company.actualAddress === undefined ? '' : (company.actualAddressEn ?? ''),
      company.bank === undefined ? '' : tc(company.bank.name),
      company.taxOffice === undefined ? '' : tc(company.taxOffice.name),
    ];

    expect(company.addressEn, 'адрес на английском').toBeDefined();
    if (company.actualAddress !== undefined) {
      expect(company.actualAddressEn, 'фактический адрес на английском').toBeDefined();
    }
    expect(shown.filter((text) => CYRILLIC.test(text))).toEqual([]);
  });
});
