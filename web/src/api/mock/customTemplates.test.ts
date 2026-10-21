/**
 * Шаблон из конструктора («Тест день 3»): текст человека превращается в
 * тот же лист, что у документов каталога.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_HEADING, checkTemplate, parseLine, renameInBody, toDocumentTemplate } from './customTemplates';

import type { CustomTemplate, TemplateField } from '@/api/types';

const fields: TemplateField[] = [
  { id: 'f1', label: 'Работник', kind: 'employee', required: true },
  { id: 'f2', label: 'Дата приёма', kind: 'date', required: true },
  { id: 'f3', label: 'Должность', kind: 'text', required: true, perLang: true },
];

function template(overrides: Partial<CustomTemplate> = {}): CustomTemplate {
  return {
    id: 'custom-1',
    companyId: 'c-a',
    title: 'Приказ о стажировке',
    purpose: 'Направление на стажировку',
    sectionId: 'hr',
    subsectionId: 'hr-personnel-orders',
    series: 'К',
    heading: { ...DEFAULT_HEADING },
    langs: ['kk', 'ru', 'en'],
    fields,
    body: {
      kk: '{Работник|падеж} тағылымдамаға жіберу.\n{Компания}',
      ru: 'Направить {Работник|падеж} на стажировку с {Дата приёма}.\n**Основание:** {Компания}',
      en: 'Send {Employee} for an internship.',
    },
    acquaint: true,
    authorId: 'u-1',
    authorName: 'Мирас',
    createdAt: '2026-09-25T00:00:00.000Z',
    updatedAt: '2026-09-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('текст шаблона', () => {
  it('поле по названию, работник – в падеже приказа или в именительном', () => {
    expect(parseLine('Направить {Работник|падеж} с {Дата приёма}.', fields, 'ru')).toEqual([
      { text: 'Направить ' },
      { field: 'f1' },
      { text: ' с ' },
      { field: 'f2' },
      { text: '.' },
    ]);
    expect(parseLine('{работник}', fields, 'ru')).toEqual([{ field: 'f1:nom' }]);
  });

  it('реквизит компании – на языке своей колонки, по-русски и по-английски', () => {
    expect(parseLine('{Компания}', fields, 'kk')).toEqual([
      { field: '@company.legalNameKk', fallback: '@company.legalName' },
    ]);
    expect(parseLine('{Company}', fields, 'ru')).toEqual([{ field: '@company.legalName' }]);
  });

  it('непонятное слово остаётся на листе как есть, полужирный – полужирным', () => {
    expect(parseLine('{Нет такого} и **важно**', fields, 'ru')).toEqual([
      { text: '{Нет такого}' },
      { text: ' и ' },
      { text: 'важно', bold: true },
    ]);
  });
});

describe('шаблон листа', () => {
  const doc = toDocumentTemplate(template());

  it('на бланке группы, помечен как шаблон компании и не проверен юристом', () => {
    expect(doc.layout).toBe('order');
    expect(doc.custom).toBe(true);
    expect(doc.reviewed).toBe(false);
    expect(doc.body[0]).toEqual({ kind: 'letterhead' });
    expect(doc.body.at(-1)).toEqual({ kind: 'tri-acquaint' });
  });

  it('абзацы разных языков стоят вровень, недостающий – пустой ячейкой', () => {
    const table = doc.body.find((b) => b.kind === 'tri-table');
    if (table?.kind !== 'tri-table') throw new Error('нет таблицы');
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1]?.en).toEqual([]);
    expect(table.rows[1]?.ru?.[0]?.[0]).toEqual({ text: 'Основание:', bold: true });
  });

  it('поля формы: работник и отмеченные – на каждом языке', () => {
    expect(doc.fields.map((f) => [f.id, f.kind, f.perLang ?? false])).toEqual([
      ['f1', 'employee', true],
      ['f2', 'date', false],
      ['f3', 'text', true],
    ]);
  });

  it('одноязычный шаблон – одна колонка, без полей на других языках', () => {
    const ru = toDocumentTemplate(template({ langs: ['ru'] }));
    expect(ru.langs).toEqual(['ru']);
    expect(ru.fields.some((f) => f.perLang === true)).toBe(false);
  });
});

describe('конструктор', () => {
  it('переименование поля переписывает его и в тексте', () => {
    const body = renameInBody({ ru: 'С {Дата приёма} и {дата приёма|x}' }, 'Дата приёма', 'Дата начала');
    expect(body.ru).toBe('С {Дата начала} и {Дата начала|x}');
  });

  it('без названия, текста или с двумя одинаковыми полями не сохраняется', () => {
    expect(checkTemplate(template())).toEqual([]);
    expect(checkTemplate(template({ title: ' ' }))).toContain('title');
    expect(checkTemplate(template({ body: { ru: 'текст' } }))).toContain('body');
    expect(
      checkTemplate(template({ fields: [...fields, { id: 'f9', label: 'работник', kind: 'text', required: false }] })),
    ).toContain('field-duplicate');
    // Название поля не может совпасть с реквизитом компании.
    expect(
      checkTemplate(template({ fields: [{ id: 'f9', label: 'Компания', kind: 'text', required: false }] })),
    ).toContain('field-duplicate');
    expect(
      checkTemplate(template({ fields: [{ id: 'f9', label: 'Вид', kind: 'select', required: true, options: ['один'] }] })),
    ).toContain('field-options');
  });
});
