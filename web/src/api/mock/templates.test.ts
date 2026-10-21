/**
 * Бланк один на все документы.
 *
 * Просьба была прямая: во всех компаниях, во всех шаблонах и во всех
 * документах оформление должно быть таким же, как в присланном приказе.
 * Этот тест не даёт завести документ мимо бланка – ни сейчас, ни потом,
 * когда шаблонов станет четыреста.
 *
 * Исключение – формы по образцам («Тест день 4», дополнение от 29.09):
 * акт Р-1 и накладная З-2 – формы приказа Минфина № 562 со своим видом,
 * счёт и КП Green Spark – по присланным образцам. Они перечислены явно
 * (`FORMS`): мимо бланка документ попадает только осознанно.
 */
import { describe, expect, it } from 'vitest';

import { ORDER_WORDS, ORDERED_WORDS } from './blank';
import { catalogEntries, templates } from './templates';

import type { DocBlock, DocumentTemplate } from '@/api/types';

function kinds(tpl: DocumentTemplate): string[] {
  return tpl.body.map((block: DocBlock) => block.kind);
}

const orders = templates.filter((tpl) => tpl.layout === 'order');
const poa = templates.filter((tpl) => tpl.layout === 'poa');
const forms = templates.filter((tpl) => tpl.layout === 'form');
/** Бланк группы: приказ и доверенность. */
const blank = [...orders, ...poa];

/** Формы по образцам – список, а не вывод из данных: см. выше. */
const FORMS = ['finance-act-r1', 'warehouse-release-z2', 'finance-invoice-kz', 'procurement-sales-quote'];

describe('все документы', () => {
  // Раздел старых записей восстанавливается по началу идентификатора шаблона
  // (`sectionOfDocument`), и от этого зависит, кто видит документ.
  // Слова считаются из числа (`wordsOf`): поле «прописью» без источника
  // снова пришлось бы заполнять руками в трёх колонках.
  it('у каждого поля «прописью» есть число, из которого оно считается', () => {
    for (const tpl of templates) {
      for (const def of tpl.fields.filter((f) => f.id.endsWith('Words'))) {
        const source = tpl.fields.find((f) => f.id === def.wordsOf);
        expect(source?.kind, `${tpl.id}: ${def.id}`).toMatch(/^(number|money)$/u);
        expect(def.perLang, `${tpl.id}: ${def.id}`).toBe(true);
      }
    }
  });

  it('идентификатор шаблона начинается с его раздела', () => {
    for (const tpl of templates) {
      expect(tpl.id.startsWith(`${tpl.sectionId}-`), tpl.id).toBe(true);
    }
  });

  it('стоят на бланке – приказ или доверенность – либо это форма по образцу из списка', () => {
    expect(orders.length + poa.length + forms.length).toBe(templates.length);
    expect(orders.length).toBeGreaterThan(0);
    expect(poa.length).toBeGreaterThan(0);
    expect(forms.map((tpl) => tpl.id).sort()).toEqual([...FORMS].sort());
  });

  it('начинаются с шапки компании', () => {
    for (const tpl of blank) {
      expect(kinds(tpl)[0], tpl.title).toBe('letterhead');
    }
  });

  it('у приказов под шапкой стоит строка «город – дата»', () => {
    // У доверенности её нет: место и дата выдачи стоят внутри её заголовка,
    // как в присланном образце.
    for (const tpl of orders) {
      expect(kinds(tpl)[1], tpl.title).toBe('place-date');
    }
  });

  it('заканчиваются подписью', () => {
    for (const tpl of blank) {
      expect(kinds(tpl), tpl.title).toContain(
        tpl.layout === 'poa' ? 'poa-signature' : 'tri-signature',
      );
    }
  });

  it('помечены как непроверенные юристом', () => {
    // Казахские окончания взяты из образца, а ссылок на статьи у половины
    // документов нет вовсе: до проверки юристом это черновики.
    expect(templates.every((tpl) => !tpl.reviewed)).toBe(true);
  });

  it('объявляют языки, на которых текст действительно написан', () => {
    for (const tpl of blank) {
      expect(tpl.langs.length, tpl.title).toBeGreaterThan(0);
      expect(tpl.langs, tpl.title).toContain('ru');
    }
  });
});

describe('формы по образцам', () => {
  it('на одном языке: Р-1, З-2 и счёт – на русском, КП – на английском', () => {
    for (const tpl of forms) {
      expect(tpl.langs, tpl.id).toEqual(tpl.id === 'procurement-sales-quote' ? ['en'] : ['ru']);
    }
  });

  it('у каждой – таблица позиций по полю «items»', () => {
    for (const tpl of forms) {
      const block = tpl.body.find((b) => b.kind === 'items');
      expect(block, tpl.id).toBeDefined();
      if (block?.kind !== 'items') continue;
      const field = tpl.fields.find((f) => f.id === block.field);
      expect(field?.kind, tpl.id).toBe('items');
      // Колонки листа – номер, сумма, НДС или колонки ввода этой таблицы.
      const ids = new Set(['n', 'amount', 'vat', ...(field?.items?.columns.map((col) => col.id) ?? [])]);
      for (const view of block.columns) expect(ids.has(view.value), `${tpl.id}: ${view.value}`).toBe(true);
      expect(block.widths.length, tpl.id).toBe(block.columns.length);
    }
  });

  it('Р-1 и З-2 – с отсылкой к приказу Минфина № 562, как в образцах', () => {
    for (const [id, form] of [
      ['finance-act-r1', 'Форма Р-1'],
      ['warehouse-release-z2', 'Форма З-2'],
    ] as const) {
      const note = templates.find((tpl) => tpl.id === id)?.body[0];
      expect(note?.kind, id).toBe('form-note');
      if (note?.kind !== 'form-note') continue;
      expect(note.lines, id).toContain('от 20 декабря 2012 года № 562');
      expect(note.lines.at(-1), id).toBe(form);
    }
  });

  it('НДС считают накладная и счёт; акт Р-1 и КП – без НДС, как в образцах', () => {
    const vat = (id: string) => templates.find((tpl) => tpl.id === id)?.fields.find((f) => f.kind === 'items')?.items?.vat;
    expect(vat('warehouse-release-z2')).toBe(true);
    expect(vat('finance-invoice-kz')).toBe(true);
    expect(vat('finance-act-r1')).toBeUndefined();
    expect(vat('procurement-sales-quote')).toBeUndefined();
  });

  it('прежние трёхъязычные акт, счёт и КП заменены: в каталоге их нет, сами шаблоны остались', () => {
    const replaced = templates.filter((tpl) => tpl.replacedBy !== undefined);
    expect(replaced.map((tpl) => tpl.id).sort()).toEqual(['finance-invoice', 'finance-work-act', 'procurement-sales-offer']);
    for (const tpl of replaced) {
      expect(FORMS, tpl.id).toContain(tpl.replacedBy);
      expect(catalogEntries.some((entry) => entry.id === tpl.id), tpl.id).toBe(false);
    }
  });
});

describe('бланк приказа', () => {
  it('везде один и тот же порядок блоков', () => {
    for (const tpl of orders) {
      const order = kinds(tpl).filter((kind) => kind !== 'executor');
      const head = ['letterhead', 'place-date', 'order-title', 'tri-table'];

      expect(order.slice(0, 4), tpl.title).toEqual(head);
      expect(order, tpl.title).toContain('tri-signature');
    }
  });

  it('у приказов есть строка распоряжения и лист ознакомления', () => {
    // Справка не приказывает и никого не знакомит под подпись – у неё их нет.
    for (const tpl of orders) {
      const order = kinds(tpl);
      const isOrder = tpl.title.startsWith('Приказ');
      expect(order.includes('tri-line'), tpl.title).toBe(isOrder);
      expect(order.includes('tri-acquaint'), tpl.title).toBe(isOrder);
    }
  });

  it('заголовок и строка распоряжения взяты из образца', () => {
    for (const tpl of orders) {
      for (const block of tpl.body) {
        if (block.kind === 'order-title' && tpl.title.startsWith('Приказ')) {
          expect(block.words, tpl.title).toEqual(ORDER_WORDS);
        }
        if (block.kind === 'tri-line') {
          expect(block.words, tpl.title).toEqual(ORDERED_WORDS);
        }
      }
    }
  });

  it('тема приказа набрана полужирным', () => {
    // У справки темы нет: её название стоит прямо в заголовке, как «СПРАВКА».
    for (const tpl of orders.filter((tpl) => tpl.title.startsWith('Приказ'))) {
      const first = tpl.body.find((block) => block.kind === 'tri-table');
      expect(first, tpl.title).toBeDefined();
      if (first?.kind !== 'tri-table') continue;

      const subject = first.rows[0]?.ru?.[0];
      expect(subject, tpl.title).toBeDefined();
      expect(subject?.some((run) => run.bold === true), tpl.title).toBe(true);
    }
  });
});

describe('колонки', () => {
  /**
   * Документы, у которых казахского и английского текста ещё нет.
   *
   * Список именно перечислен, а не выведен из данных: перевод добавляется
   * этапами, и каждый раз должно быть видно, что осталось. Пустой список –
   * значит все документы вышли в три колонки.
   */
  const AWAITING_TRANSLATION: string[] = [];

  it('одноязычными остались только те, что ждут перевода', () => {
    const one = blank.filter((tpl) => tpl.langs.length === 1).map((tpl) => tpl.id);
    expect(one.sort()).toEqual([...AWAITING_TRANSLATION].sort());
  });

  it('доверенность выходит на двух языках, остальные – на трёх', () => {
    for (const tpl of blank) {
      if (AWAITING_TRANSLATION.includes(tpl.id)) continue;
      expect(tpl.langs, tpl.title).toEqual(
        tpl.layout === 'poa' ? ['ru', 'en'] : ['kk', 'ru', 'en'],
      );
    }
  });

  it('остальные приказы выходят в три колонки', () => {
    for (const tpl of orders) {
      if (AWAITING_TRANSLATION.includes(tpl.id)) continue;
      expect(tpl.langs, tpl.title).toEqual(['kk', 'ru', 'en']);
    }
  });

  it('в каждой строке таблицы заполнены ровно объявленные языки', () => {
    for (const tpl of orders) {
      for (const block of tpl.body) {
        if (block.kind !== 'tri-table') continue;
        for (const row of block.rows) {
          for (const lang of tpl.langs) {
            expect(row[lang], `${tpl.title}: ${lang}`).toBeDefined();
          }
        }
      }
    }
  });
});
