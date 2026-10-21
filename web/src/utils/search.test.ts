/**
 * Поиск по словам («Тест день 3»: «поиск работает, но некорректно, на
 * английском невозможно поискать»).
 *
 * Человек набирает имя так, как помнит: по-русски, по-казахски или
 * латиницей. Найтись должна одна и та же запись.
 */
import { describe, expect, it } from 'vitest';

import { matchesQuery } from './search';

const nurlan = ['Оспанов Нұрлан Ерболатович', 'Менеджер по закупкам'];

describe('поиск', () => {
  it('«Нурлан» находит «Нұрлан»: казахские буквы не мешают', () => {
    expect(matchesQuery('Нурлан', nurlan)).toBe(true);
    expect(matchesQuery('оспанов нурлан', nurlan)).toBe(true);
  });

  it('и наоборот: «Нұрлан» находит «Нурлан»', () => {
    expect(matchesQuery('Нұрлан', ['Оспанов Нурлан Ерболатович'])).toBe(true);
  });

  it('латиницей по кириллице: «Nurlan Ospanov»', () => {
    expect(matchesQuery('Nurlan Ospanov', nurlan)).toBe(true);
    expect(matchesQuery('zhaksylykova', ['Жақсылықова Динара Талғатқызы'])).toBe(true);
  });

  it('кириллицей по латинице: «Мирас» находит «Miras»', () => {
    expect(matchesQuery('Мирас', ['Miras'])).toBe(true);
  });

  it('все слова должны встретиться', () => {
    expect(matchesQuery('nurlan kim', nurlan)).toBe(false);
    expect(matchesQuery('Нурлан бухгалтер', nurlan)).toBe(false);
  });

  it('«ё» как «е», регистр и лишние пробелы не важны', () => {
    expect(matchesQuery('  ЁЛКИНА   мария ', ['Елкина Мария'])).toBe(true);
  });

  it('пустой запрос подходит всем', () => {
    expect(matchesQuery('   ', nurlan)).toBe(true);
  });
});

describe('быстрый поиск (оптимизация 01.10)', () => {
  it('нижний регистр без учёта языка совпадает с русским для всех русских и казахских букв', () => {
    // На этом держится быстрый поиск: toLocaleLowerCase('ru') на каждой
    // букве был самым дорогим местом реестра при 300 документах.
    const letters = 'АБВГҒДЕЁЖЗИЙКҚЛМНҢОӨПРСТУҰҮФХҺЦЧШЩЪЫІЬЭЮЯӘ';
    for (const letter of letters) {
      expect(letter.toLowerCase(), letter).toBe(letter.toLocaleLowerCase('ru'));
    }
  });

  it('повторный поиск по тем же полям даёт тот же ответ', () => {
    const fields = ['Оспанов Нұрлан Ерболатович', 'Приказ о приёме'];
    for (let i = 0; i < 3; i += 1) {
      expect(matchesQuery('нурлан прием', fields)).toBe(true);
      expect(matchesQuery('Nurlan Ospanov', fields)).toBe(true);
      expect(matchesQuery('ахметов', fields)).toBe(false);
    }
  });
});
