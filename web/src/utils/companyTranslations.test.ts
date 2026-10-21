/**
 * Новая компания: переводы реквизитов по правилам («Тест день 3»).
 */
import { describe, expect, it } from 'vitest';

import {
  cityEn,
  cityKk,
  legalNameEn,
  legalNameKk,
  missingCases,
  shortNameEn,
  surnameInitials,
  withCompanyTranslations,
} from './companyTranslations';

import type { Company } from '@/api/types';

const blank: Company = {
  id: 'c-new',
  name: 'Новая компания',
  legalName: 'Новая компания',
  bin: '',
  address: '',
  directorName: '',
  directorTitle: 'Директор',
  directorTitleGenitive: 'Директора',
  directorNameGenitive: '',
  directorBasis: 'Устава',
  city: '',
  accent: '#2f3b8f',
  monogram: 'НК',
};

describe('наименование', () => {
  it('ТОО – по образцу бланков группы', () => {
    const full = 'Товарищество с ограниченной ответственностью «Тұлпар Сервис»';
    expect(legalNameKk(full)).toBe('ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК «Тұлпар Сервис»');
    expect(legalNameEn(full)).toBe('«Tulpar Servis» LLP');
    expect(shortNameEn('ТОО «EFFEGI EURASIA»')).toBe('EFFEGI EURASIA LLP');
  });

  it('незнакомая форма собственности не выдумывается', () => {
    expect(legalNameKk('Акционерное общество «Банк»')).toBe('');
    expect(legalNameEn('Акционерное общество «Банк»')).toBe('');
  });
});

describe('город', () => {
  it.each([
    ['Уральск', 'Орал', 'Uralsk'],
    ['Аксай', 'Ақсай', 'Aksai'],
    ['Усть-Каменогорск', 'Өскемен', 'Ust-Kamenogorsk'],
  ])('«%s» – «%s», «%s»', (ru, kk, en) => {
    expect(cityKk(ru)).toBe(kk);
    expect(cityEn(ru)).toBe(en);
  });

  it('нет в словаре – казахского нет, английский латиницей', () => {
    expect(cityKk('Бейнеу')).toBe('');
    expect(cityEn('Бейнеу')).toBe('Beineu');
  });
});

describe('правка карточки', () => {
  it('переводы заполняются сами', () => {
    let company = withCompanyTranslations(blank, {
      legalName: 'Товарищество с ограниченной ответственностью «Тест»',
    });
    company = withCompanyTranslations(company, { name: 'ТОО «Тест»' });
    company = withCompanyTranslations(company, { city: 'Атырау' });
    company = withCompanyTranslations(company, { directorName: 'Иванов Иван Иванович' });
    company = withCompanyTranslations(company, { directorTitle: 'Генеральный директор' });

    expect(company.legalNameKk).toBe('ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК «Тест»');
    expect(company.legalNameEn).toBe('«Test» LLP');
    expect(company.nameEn).toBe('Test LLP');
    expect(company.cityKk).toBe('Атырау');
    expect(company.cityEn).toBe('Atyrau');
    expect(company.directorNameEn).toBe('Ivan Ivanov');
    expect(company.directorTitleKk).toBe('Бас директор');
    expect(company.directorTitleEn).toBe('General Director');
  });

  it('поправленное руками не затирается', () => {
    const own = { ...blank, city: 'Атырау', cityEn: 'Atyrau city' };
    const next = withCompanyTranslations(own, { city: 'Аксай' });
    expect(next.cityEn).toBe('Atyrau city');
    expect(next.cityKk).toBe('Ақсай');
  });

  it('прежняя подстановка пересобирается', () => {
    const first = withCompanyTranslations(blank, { city: 'Атырау' });
    const second = withCompanyTranslations(first, { city: 'Уральск' });
    expect(second.cityEn).toBe('Uralsk');
    expect(second.cityKk).toBe('Орал');
  });

  it('родительный падеж не подставляется', () => {
    const next = withCompanyTranslations(blank, { directorName: 'Иванов Иван Иванович' });
    expect(next.directorNameGenitive).toBe('');
  });
});

/**
 * Фамилия с инициалами для подписи (19.10): сменили ФИО руководителя –
 * подпись в документах следует, если её не вписывали руками.
 */
describe('руководитель в подписи', () => {
  it('фамилия и инициалы из «Фамилия Имя Отчество», и казахское отчество тоже', () => {
    expect(surnameInitials('Танатаров Амир Маратович')).toBe('Танатаров А.М.');
    expect(surnameInitials('Қабыл Нұрмахамбет Маханбетханұлы')).toBe('Қабыл Н.М.');
    expect(surnameInitials('  Хамит   Нурдаулет ')).toBe('Хамит Н.');
    expect(surnameInitials('')).toBe('');
  });

  it('сменили руководителя – подпись следом, если стояла прежняя подстановка', () => {
    const before = { ...blank, directorName: 'Танатаров Амир Маратович', directorNameShort: 'Танатаров А.М.' };
    expect(withCompanyTranslations(before, { directorName: 'Иванов Иван Иванович' }).directorNameShort).toBe('Иванов И.И.');
    expect(withCompanyTranslations(blank, { directorName: 'Иванов Иван Иванович' }).directorNameShort).toBe('Иванов И.И.');
  });

});

/**
 * Руководитель на трёх языках (19.10, замечание человека): сменили ФИО –
 * меняется всё, что от него зависит, даже вписанное раньше руками: прежние
 * подпись и латиница – это другой человек. Остаётся только то, что
 * поправили в этой же правке.
 */
describe('смена руководителя – на всех языках', () => {
  // KNT как в системе до правки: руководитель Гезини, подпись – Ихсанова
  // (Q26), всё вписано руками.
  const knt: Company = {
    ...blank,
    directorName: 'Гезини Алессандро',
    directorNameShort: 'Ихсанова С.Т.',
    directorNameEn: 'Ghesini Alessandro',
    directorNameGenitive: 'Гезини Алессандро',
    directorTitle: 'Генеральный директор',
    directorTitleKk: 'Бас директор',
    directorTitleEn: 'General Director',
    directorTitleGenitive: 'Генерального директора',
  };
  const session = (edited: string[] = []) => ({ original: knt, edited: new Set(edited) });

  it('подпись и латиница – от нового ФИО, падеж очищен: его вписывают', () => {
    const next = withCompanyTranslations(knt, { directorName: 'Ихсанова София Талаповна' }, session());
    expect(next.directorNameShort).toBe('Ихсанова С.Т.');
    expect(next.directorNameEn).toBe('Sofiya Ikhsanova');
    expect(next.directorNameGenitive).toBe('');
  });

  it('поправленное в этой же правке остаётся', () => {
    const next = withCompanyTranslations(
      { ...knt, directorNameEn: 'Sofia Ikhsanova', directorNameGenitive: 'Ихсановой Софии Талаповны' },
      { directorName: 'Ихсанова София Талаповна' },
      session(['directorNameEn', 'directorNameGenitive']),
    );
    expect(next.directorNameEn).toBe('Sofia Ikhsanova');
    expect(next.directorNameGenitive).toBe('Ихсановой Софии Талаповны');
  });

  it('ФИО вернули как было – прежние подпись, латиница и падеж на месте', () => {
    const typed = withCompanyTranslations(knt, { directorName: 'Гезини Алессандрo1' }, session());
    const back = withCompanyTranslations(typed, { directorName: 'Гезини Алессандро' }, session());
    expect(back.directorNameShort).toBe('Ихсанова С.Т.');
    expect(back.directorNameEn).toBe('Ghesini Alessandro');
    expect(back.directorNameGenitive).toBe('Гезини Алессандро');
  });

  it('сменили должность – казахская и английская следом, падеж должности очищен', () => {
    const next = withCompanyTranslations(knt, { directorTitle: 'Директор' }, session());
    expect(next.directorTitleKk).toBe('Директор');
    expect(next.directorTitleEn).toBe('Director');
    expect(next.directorTitleGenitive).toBe('');
  });

  it('без падежа после смены ФИО или должности реквизиты не сохраняются', () => {
    const renamed = withCompanyTranslations(knt, { directorName: 'Ихсанова София Талаповна' }, session());
    expect(missingCases(knt, renamed)).toEqual(['directorNameGenitive']);
    expect(missingCases(knt, { ...renamed, directorNameGenitive: 'Ихсановой Софии Талаповны' })).toEqual([]);
    expect(missingCases(knt, { ...knt, directorTitle: 'Директор', directorTitleGenitive: ' ' })).toEqual(['directorTitleGenitive']);
    // Не меняли – пустой падеж прежних реквизитов сохранению не мешает.
    expect(missingCases({ ...knt, directorNameGenitive: '' }, { ...knt, directorNameGenitive: '', city: 'Астана' })).toEqual([]);
  });
});

