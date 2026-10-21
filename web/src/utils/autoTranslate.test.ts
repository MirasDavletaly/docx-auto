/**
 * Перевод значения поля в казахскую и английскую колонку («Тест день 4»).
 */
import { describe, expect, it } from 'vitest';

import { autoTranslate, organizationName } from './autoTranslate';

describe('город', () => {
  it('по словарю городов, нет в словаре – латиницей и без казахского', () => {
    expect(autoTranslate('place', 'Астана', 'kk')).toBe('Астана');
    expect(autoTranslate('place', 'Уральск', 'kk')).toBe('Орал');
    expect(autoTranslate('place', 'Уральск', 'en')).toBe('Uralsk');
    expect(autoTranslate('place', 'Бейнеу', 'kk')).toBeUndefined();
    expect(autoTranslate('place', 'Бейнеу', 'en')).toBe('Beineu');
  });
});

describe('организация', () => {
  it.each([
    ['ТОО «Тұлпар Сервис»', '«Тұлпар Сервис» ЖШС', 'Tulpar Servis LLP'],
    ['АО «Банк ЦентрКредит»', '«Банк ЦентрКредит» АҚ', 'Bank TsentrKredit JSC'],
    ['ИП Каримов Р. А.', 'ЖК Каримов Р. А.', 'IE Karimov R. A.'],
  ])('«%s» → «%s», «%s»', (ru, kk, en) => {
    expect(organizationName(ru, 'kk')).toBe(kk);
    expect(organizationName(ru, 'en')).toBe(en);
  });

  it('без формы собственности – имя собственное: по-английски латиницей', () => {
    expect(organizationName('Шеврон', 'kk')).toBeUndefined();
    expect(organizationName('Шеврон', 'en')).toBe('Shevron');
  });
});

describe('подразделение и должность – словарь', () => {
  it('«Проектный отдел» на трёх языках', () => {
    expect(autoTranslate('dictionary', 'Проектный отдел', 'kk')).toBe('Жобалау бөлімі');
    expect(autoTranslate('dictionary', 'Проектный отдел', 'en')).toBe('Design Department');
  });

  it('частые обороты справки: «по месту требования»', () => {
    expect(autoTranslate('dictionary', 'По месту требования', 'en')).toBe('to whom it may concern');
    expect(autoTranslate('dictionary', 'в банк', 'kk')).toBe('банкке');
  });

  it('нет в словаре – перевод не выдумывается', () => {
    expect(autoTranslate('dictionary', 'Отдел инноваций', 'en')).toBeUndefined();
  });
});

describe('удостоверение и адрес', () => {
  it('«МВД РК» – как пишут в удостоверениях', () => {
    expect(autoTranslate('issuer', 'МВД РК', 'kk')).toBe('ҚР ІІМ');
    expect(autoTranslate('issuer', 'м.в.д. рк', 'en')).toBe(
      'Ministry of Internal Affairs of the Republic of Kazakhstan',
    );
    expect(autoTranslate('issuer', 'ЦОН', 'en')).toBeUndefined();
  });

  it('адрес – на английском по правилу, казахского правила нет', () => {
    expect(autoTranslate('address', 'город Атырау, улица Мусина, дом 10', 'en')).toBe(
      'Atyrau city, Musina street, house 10',
    );
    expect(autoTranslate('address', 'город Атырау', 'kk')).toBeUndefined();
  });
});

it('пустое значение не переводится', () => {
  expect(autoTranslate('place', '  ', 'en')).toBeUndefined();
});
