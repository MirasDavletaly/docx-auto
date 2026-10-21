/**
 * Формы по образцам на листе («Тест день 4», дополнение): накладная З-2,
 * акт Р-1, счёт, КП Green Spark. Проверяется то, что видно на бумаге:
 * посчитанные суммы и НДС, прописью, реквизиты сторон, альбомный лист.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { templates } from '@/api/mock/templates';
import { resetDb } from '@/store/db';
import { computeItems, writeItems } from '@/utils/items';
import { DocumentSheet } from './DocumentSheet';

import type { Company, DocumentTemplate } from '@/api/types';
import type { Root } from 'react-dom/client';

const company: Company = {
  id: 'c-test',
  name: 'ТОО «GREENSPARKLIMITED»',
  nameEn: 'GREEN SPARK LIMITED',
  legalName: 'Товарищество с ограниченной ответственностью «GREENSPARKLIMITED»',
  bin: '170340025267',
  address: 'ЗКО, город Аксай, промышленная зона, здание 225H',
  kbe: '17',
  bank: { name: 'АО «Банк ЦентрКредит»', bik: 'KCJBKZKX', accounts: [{ iban: 'KZ118562203105747452', currency: 'KZT' }] },
  vat: { series: '27001', number: '0012345' },
  directorName: 'Кабешова Самал Амангелдиевна',
  directorNameShort: 'Кабешова С.А.',
  directorNameEn: 'Samal Kabeshova',
  directorTitle: 'Генеральный директор',
  directorTitleEn: 'General Director',
  directorTitleGenitive: 'Генерального директора',
  directorNameGenitive: 'Кабешовой Самал Амангелдиевны',
  directorBasis: 'Устава',
  city: 'Аксай',
  accent: '#2f6b55',
  monogram: 'GS',
};

let container: HTMLDivElement;
let root: Root;

function template(id: string): DocumentTemplate {
  const found = templates.find((tpl) => tpl.id === id);
  if (found === undefined) throw new Error(id);
  return found;
}

function itemsOf(tpl: DocumentTemplate, rows: Array<Record<string, string>>, vatRate: number | null): string {
  const spec = tpl.fields.find((f) => f.kind === 'items')?.items;
  if (spec === undefined) throw new Error('нет таблицы');
  return writeItems(computeItems(rows, spec, vatRate));
}

function render(tpl: DocumentTemplate, values: Record<string, string>, number = '111') {
  act(() => {
    root.render(<DocumentSheet template={tpl} values={values} company={company} date="2026-09-30" number={number} />);
  });
  return (container.textContent ?? '').replace(/ /gu, ' ');
}

beforeEach(() => {
  localStorage.clear();
  resetDb();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('накладная на отпуск запасов, форма З-2', () => {
  const tpl = template('warehouse-release-z2');
  const rows = [
    { name: 'Товар1', code: '000001', unit: 'кг', planned: '4000', price: '210' },
    { name: 'Товар2', code: '000002', unit: 'кг', planned: '6000', released: '6000', price: '210' },
  ];

  it('суммы строк, НДС 16 % из суммы, итог и прописью', () => {
    const text = render(tpl, { counterparty: 'ТОО «Покупатель»', items: itemsOf(tpl, rows, 16) });
    expect(text).toContain('840 000,00');
    expect(text).toContain('1 260 000,00');
    expect(text).toContain('2 100 000,00');
    // 840 000 × 16/116 = 115 862,07; 1 260 000 × 16/116 = 173 793,10
    expect(text).toContain('115 862,07');
    expect(text).toContain('173 793,10');
    expect(text).toContain('289 655,17');
    expect(text).toContain('Два миллиона сто тысяч тенге 00 тиын');
    expect(text).toContain('Десять тысяч');
  });

  it('шапка формы, реквизиты отправителя и получателя, номер и дата', () => {
    const text = render(tpl, { counterparty: 'ТОО «Покупатель»', items: itemsOf(tpl, rows, 16) });
    expect(text).toContain('Приложение 26');
    expect(text).toContain('от 20 декабря 2012 года № 562');
    expect(text).toContain('Форма З-2');
    expect(text).toContain('НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ');
    expect(text).toContain('170340025267');
    expect(text).toContain('ТОО «Покупатель»');
    expect(text).toContain('111');
    expect(text).toContain('30.09.2026');
    // Пустое «отпущено» – из «подлежит отпуску».
    expect(text.match(/4 000/gu)?.length).toBeGreaterThanOrEqual(2);
  });

  it('лист альбомный', () => {
    render(tpl, { items: itemsOf(tpl, rows, 16) });
    expect(container.querySelector('[data-page]')?.getAttribute('data-orientation')).toBe('landscape');
  });

  it('компания без НДС – «Без НДС» вместо сумм налога', () => {
    const text = render(tpl, { items: itemsOf(tpl, rows, null) });
    expect(text).toContain('Без НДС');
    expect(text).not.toContain('289 655,17');
  });
});

describe('акт выполненных работ, форма Р-1', () => {
  const tpl = template('finance-act-r1');

  it('стороны с ИИН/БИН, таблица и итог', () => {
    const text = render(tpl, {
      counterparty: 'ТОО «Заказчик»',
      counterpartyBin: '123456789012',
      contract: 'Без договора',
      items: itemsOf(
        tpl,
        [{ name: 'Техническая доработка сайта', period: 'с 01.09.2026 по 30.09.2026', unit: 'Услуга', qty: '1', price: '80000' }],
        16,
      ),
    });
    expect(text).toContain('Форма Р-1');
    expect(text).toContain('АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ)');
    expect(text).toContain('123456789012');
    expect(text).toContain('170340025267');
    expect(text).toContain('Техническая доработка сайта');
    expect(text).toContain('80 000,00');
    expect(text).toContain('Без договора');
    // Р-1 НДС не выделяет: в образце таких колонок нет.
    expect(text).not.toContain('Без НДС');
  });
});

describe('счёт на оплату', () => {
  const tpl = template('finance-invoice-kz');

  it('реквизиты банка компании, итог, НДС и прописью', () => {
    const text = render(tpl, {
      counterparty: 'ТОО «Покупатель»',
      counterpartyBin: '123456789012',
      items: itemsOf(tpl, [{ name: 'Кабель', unit: 'м', qty: '10', price: '1 160' }], 16),
    });
    expect(text).toContain('KZ118562203105747452');
    expect(text).toContain('KCJBKZKX');
    expect(text).toContain('АО «Банк ЦентрКредит»');
    expect(text).toContain('Счёт на оплату № 111 от 30 сентября 2026 г.');
    expect(text).toContain('11 600,00');
    expect(text).toContain('В том числе НДС:');
    expect(text).toContain('1 600,00');
    expect(text).toContain('Всего наименований 1, на сумму 11 600,00 KZT');
    expect(text).toContain('Одиннадцать тысяч шестьсот тенге 00 тиын');
  });

  it('без НДС – «Без налога (НДС)»', () => {
    const text = render(tpl, { items: itemsOf(tpl, [{ name: 'Кабель', unit: 'м', qty: '1', price: '100' }], null) });
    expect(text).toContain('Без налога (НДС)');
  });
});

describe('коммерческое предложение по образцу Green Spark', () => {
  const tpl = template('procurement-sales-quote');

  it('как в образце: номера 10, 20, цены «3.350,00 EUR / 1 PC», итог', () => {
    const text = render(tpl, {
      client: 'Kaz Complect',
      attention: 'Gabit S.',
      reference: 'OFF. GS-Q-261170',
      subject: 'Costacurta VICO-Tex Separators',
      currency: 'EUR',
      items: itemsOf(
        tpl,
        [
          { description: '7000001\nVICO-Tex_Mist eliminator_G.L.S', qty: '6', unit: 'PC', price: '3350' },
          { description: '7000001\nVICO-Tex MIST ELIMINATORS', qty: '3', unit: 'PC', price: '4737,50' },
        ],
        16,
      ),
    });
    expect(text).toContain('30/09/2026');
    expect(text).toContain('Messrs.');
    expect(text).toContain('Kaz Complect');
    expect(text).toContain('Ref. no. OFF. GS-Q-261170');
    expect(text).toContain('6,00 PC');
    expect(text).toContain('3.350,00 EUR / 1 PC');
    expect(text).toContain('20.100,00 EUR');
    expect(text).toContain('14.212,50 EUR');
    expect(text).toContain('Total Amount');
    expect(text).toContain('34.312,50 EUR');
    expect(text).toContain('For GREEN SPARK LIMITED');
    // Номера позиций – 10 и 20, как в образце.
    const numbers = [...container.querySelectorAll('td')].map((td) => td.textContent?.trim());
    expect(numbers).toContain('10');
    expect(numbers).toContain('20');
    // КП в образце – без НДС: ставка компании его не меняет.
    expect(text).not.toContain('НДС');
  });

  it('лист книжный (просьба 12.10)', () => {
    render(tpl, { items: itemsOf(tpl, [{ description: 'PV module', qty: '1', unit: 'PC', price: '100' }], null) });
    expect(container.querySelector('[data-page]')?.getAttribute('data-orientation')).toBe('portrait');
  });
});

describe('таблица позиций на нескольких листах', () => {
  const tpl = template('warehouse-release-z2');
  const rows = Array.from({ length: 12 }, (_, k) => ({
    name: `Позиция ${k + 1}`,
    code: String(k + 1),
    unit: 'шт',
    planned: '1',
    price: '100',
  }));

  // В jsdom вёрстки нет и высота любого элемента – 0. Каждому куску листа
  // даётся 200 пикселей: на альбомный лист (697 пикселей поля) их ложится три.
  let restore: () => void;
  beforeEach(() => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset['piece'] === undefined ? 0 : 200;
      },
    });
    restore = () => {
      if (original !== undefined) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original);
    };
  });
  afterEach(() => restore());

  it('строка, с которой начинается лист, – со своей верхней чертой', () => {
    render(tpl, { items: itemsOf(tpl, rows, 16) });
    const pages = [...container.querySelectorAll('[data-page]')];
    expect(pages.length).toBeGreaterThan(1);

    // Строка таблицы – кусок с таблицей строк и без шапки.
    const isRow = (piece: Element) =>
      piece.querySelector('[class*="itemsRow"]') !== null && piece.querySelector('[class*="itemsHead"]') === null;
    const rowsOpeningPage = pages
      .slice(1)
      .map((page) => page.querySelector('[data-piece]'))
      .filter((piece): piece is Element => piece !== null && isRow(piece));
    expect(rowsOpeningPage.length).toBeGreaterThan(0);

    // Черту получают ровно они: строка в середине листа берёт её у строки
    // выше, заголовок и шапка формы на верху листа – со своей рамкой.
    const marked = [...container.querySelectorAll('[data-piece]')].filter((piece) => piece.className.includes('pageTop'));
    expect(marked).toEqual(rowsOpeningPage);
  });
});

describe('поля подписи из реквизитов (19.10)', () => {
  it('нетронутое поле – текущий директор из карточки, правленное – как вписано', () => {
    const tpl = template('finance-act-r1');
    expect(render(tpl, {})).toContain('Кабешова С.А.');
    expect(render(tpl, {}, '111')).toContain('Генеральный директор');

    const own = render(tpl, { executorName: 'Сидоров С.С.' });
    expect(own).toContain('Сидоров С.С.');
    expect(own).not.toContain('Кабешова С.А.');
  });
});
