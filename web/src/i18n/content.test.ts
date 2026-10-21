/**
 * Перевод каталога полон («Тест день 2»: «разделы и всё в «Создать документ»
 * не переводятся на английский»).
 *
 * Каждая строка, которую человек видит в каталоге и в форме, должна иметь
 * английский вариант. Новый шаблон без перевода ловится здесь, а не на
 * экране у человека, переключившего язык.
 */
import { afterEach, describe, expect, it } from 'vitest';

import { contentEn } from './content-en';
import { tc } from './content';
import { setLanguage } from './index';
import { roles } from '@/api/mock/roles';
import { sections } from '@/api/mock/sections';
import { catalogEntries, templates } from '@/api/mock/templates';

function catalogStrings(): string[] {
  const out = new Set<string>();

  for (const section of sections) {
    out.add(section.title);
    out.add(section.short);
    for (const sub of section.subsections) out.add(sub.title);
  }
  for (const role of roles) {
    out.add(role.title);
    out.add(role.description);
  }
  for (const entry of catalogEntries) out.add(entry.title);
  for (const tpl of templates) {
    out.add(tpl.title);
    out.add(tpl.purpose);
    for (const field of tpl.fields) {
      out.add(field.label);
      out.add(field.group);
      if (field.hint !== undefined) out.add(field.hint);
      if (field.unit !== undefined) out.add(field.unit);
      for (const option of field.options ?? []) out.add(option);
    }
  }

  return [...out];
}

afterEach(() => setLanguage('ru'));

describe('перевод каталога на английский', () => {
  it('есть у каждой строки каталога и формы', () => {
    const missing = catalogStrings().filter((text) => !(text in contentEn));
    expect(missing).toEqual([]);
  });

  it('без непереведённого русского в переводе', () => {
    // Кириллица допустима только как казахский пример в подсказке: «в
    // дательном падеже: бас директорға» – это образец для поля на казахском,
    // а не забытый перевод. Такой пример узнаётся по казахским буквам.
    const kazakh = /[әғқңөұүһі]/iu;
    const russian = Object.entries(contentEn).filter(
      ([, en]) => /[а-яё]/iu.test(en) && !kazakh.test(en),
    );
    expect(russian).toEqual([]);
  });

  it('без длинного тире: в текстах сайта только короткое «–»', () => {
    const dashes = Object.entries(contentEn).filter(([ru, en]) => ru.includes('—') || en.includes('—'));
    expect(dashes).toEqual([]);
  });

  it('на русском интерфейсе строка остаётся русской, на английском – переводится', () => {
    setLanguage('ru');
    expect(tc('Приказ о приёме на работу')).toBe('Приказ о приёме на работу');
    setLanguage('en');
    expect(tc('Приказ о приёме на работу')).toBe('Hiring order');
    // Строки без перевода не пропадают, а остаются как есть.
    expect(tc('Строка, которой нет в каталоге')).toBe('Строка, которой нет в каталоге');
  });
});
