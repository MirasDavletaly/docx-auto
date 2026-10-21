/**
 * Бланк компании: логотип и наименование на трёх языках.
 *
 * Проверяется то, что легко перепутать и трудно заметить: логотип есть у
 * каждой компании, и он у каждой свой. Чужой логотип в шапке приказа – это
 * документ, выпущенный от имени не той компании.
 */
import { describe, expect, it } from 'vitest';

import { companies } from './companies';
import { loadDb, reloadDb, resetDb, updateDb } from '@/store/db';

describe('логотипы компаний', () => {
  it('есть у каждой компании', () => {
    for (const company of companies) {
      expect(company.logo, company.name).toBeDefined();
    }
  });

  it('у каждой компании свой', () => {
    const logos = companies.map((c) => c.logo);
    expect(new Set(logos).size).toBe(companies.length);
  });

  it('компании идут в том же порядке, в каком присланы логотипы', () => {
    expect(companies.map((c) => c.id)).toEqual([
      'c-exlumen',
      'c-knt',
      'c-algoritmi',
      'c-greenspark-power',
      'c-greensparklimited',
      'c-effegi',
    ]);
  });
});

describe('трёхъязычная шапка', () => {
  // Образец – бланк ТОО «Algoritmi KZ»: логотип и наименование на казахском,
  // русском и английском. Так должно быть у каждой компании: приказ без
  // казахской строки в шапке – это документ не по форме.
  const REQUIRED = [
    'legalNameKk',
    'legalNameEn',
    'cityKk',
    'cityEn',
    'directorTitleKk',
    'directorTitleEn',
  ] as const;

  it('заполнена у всех компаний', () => {
    for (const company of companies) {
      for (const key of REQUIRED) {
        expect(company[key], `${company.name}: ${key}`).toBeTruthy();
      }
    }
  });

  it('наименование на трёх языках у каждой компании разное', () => {
    for (const company of companies) {
      expect(company.legalNameKk, company.name).not.toBe(company.legalName);
      expect(company.legalNameEn, company.name).not.toBe(company.legalName);
    }
  });

  it('форма собственности записана так же, как в присланных бланках', () => {
    for (const company of companies) {
      expect(company.legalNameKk, company.name).toContain(
        'ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК',
      );
    }
  });
});

describe('база, записанная прежней версией сайта', () => {
  /**
   * Ровно тот случай, который человек увидел у себя: компании заведены в
   * браузере раньше, чем появились казахское наименование, город на трёх
   * языках и должность руководителя на казахском и английском. Документ
   * выходил без казахской строки в шапке и без «Бас директор» в подписи.
   */
  it('получает реквизиты, появившиеся позже', () => {
    localStorage.clear();
    resetDb();

    const before = loadDb();
    localStorage.setItem(
      'docflow.local.db',
      JSON.stringify({
        ...before,
        companies: before.companies.map(
          ({
            legalNameKk: _kk,
            cityKk: _cityKk,
            cityEn: _cityEn,
            directorTitleKk: _titleKk,
            directorTitleEn: _titleEn,
            logo: _logo,
            ...rest
          }) => rest,
        ),
      }),
    );

    reloadDb();

    for (const company of loadDb().companies) {
      expect(company.legalNameKk, company.name).toBeTruthy();
      expect(company.cityKk, company.name).toBeTruthy();
      expect(company.cityEn, company.name).toBeTruthy();
      expect(company.directorTitleKk, company.name).toBeTruthy();
      expect(company.directorTitleEn, company.name).toBeTruthy();
      expect(company.logo, company.name).toBeTruthy();
    }
  });

  it('не трогает то, что человек поправил сам', () => {
    localStorage.clear();
    resetDb();

    const before = loadDb();
    localStorage.setItem(
      'docflow.local.db',
      JSON.stringify({
        ...before,
        companies: before.companies.map((c, i) =>
          i === 0 ? { ...c, legalNameKk: 'СВОЁ НАИМЕНОВАНИЕ', cityKk: '' } : c,
        ),
      }),
    );

    reloadDb();

    const first = loadDb().companies[0];
    expect(first?.legalNameKk).toBe('СВОЁ НАИМЕНОВАНИЕ');
    // Пустая строка – осознанно очищенный реквизит, а не отсутствующий.
    expect(first?.cityKk).toBe('');
  });
});

describe('база, записанная до появления логотипов', () => {
  it('получает логотип при чтении', () => {
    localStorage.clear();
    resetDb();

    // Кладём в хранилище прежнюю запись: компании те же, но без логотипов.
    // Пишем прямо в localStorage, а не через saveDb: saveDb заполняет кэш, и
    // чтение вернуло бы записанное, не пройдя приведение к текущему виду.
    const before = loadDb();
    localStorage.setItem(
      'docflow.local.db',
      JSON.stringify({
        ...before,
        companies: before.companies.map(({ logo: _logo, ...rest }) => rest),
      }),
    );

    // Так базу читает вкладка, открытая после обновления сайта.
    reloadDb();

    const companiesAfter = loadDb().companies;
    expect(companiesAfter).toHaveLength(before.companies.length);
    for (const company of companiesAfter) {
      expect(company.logo, company.name).toBeDefined();
    }
  });

  it('свой загруженный логотип не затирается', () => {
    localStorage.clear();
    resetDb();

    const own = 'data:image/png;base64,iVBORw0KGgo=';
    updateDb((db) => ({
      ...db,
      companies: db.companies.map((c, i) => (i === 0 ? { ...c, logo: own } : c)),
    }));

    expect(loadDb().companies[0]?.logo).toBe(own);
  });
});
