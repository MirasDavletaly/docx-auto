/**
 * Таблица позиций в форме: ввод строк, пересчёт, Enter – новая строка
 * («Тест день 4», дополнение: «номер по порядку после нажатия Enter»).
 */
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readItems } from '@/utils/items';
import { ItemsEditor } from './ItemsEditor';

import type { ItemsSpec } from '@/api/types';
import type { Root } from 'react-dom/client';

const spec: ItemsSpec = {
  columns: [
    { id: 'name', label: 'Наименование', kind: 'text', required: true, wide: true },
    { id: 'unit', label: 'Единица', kind: 'text', initial: 'шт', required: true },
    { id: 'qty', label: 'Количество', kind: 'quantity', required: true },
    { id: 'price', label: 'Цена', kind: 'money', required: true },
  ],
  quantity: 'qty',
  price: 'price',
  vat: true,
};

let container: HTMLDivElement;
let root: Root;
let value = '';

function Harness({ vatRate }: { vatRate: number | null }) {
  const [current, setCurrent] = useState('');
  value = current;
  return (
    <form>
      <ItemsEditor
        id="field-items"
        value={current}
        spec={spec}
        vatRate={vatRate}
        currency="₸"
        onChange={setCurrent}
        onFocus={() => undefined}
        onBlur={() => undefined}
      />
    </form>
  );
}

function open(vatRate: number | null = 16) {
  act(() => root.render(<Harness vatRate={vatRate} />));
}

const cell = (row: number, column: string) =>
  container.querySelector<HTMLInputElement>(`[id="field-items-${row}-${column}"]`) ??
  (row === 0 && column === 'name' ? container.querySelector<HTMLInputElement>('[id="field-items"]') : null);

function typeInto(input: HTMLInputElement | null, text: string) {
  if (input === null) throw new Error('нет ячейки');
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function fillRow(row: number, name: string, qty: string, price: string) {
  typeInto(cell(row, 'name'), name);
  typeInto(cell(row, 'qty'), qty);
  typeInto(cell(row, 'price'), price);
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('таблица позиций в форме', () => {
  it('сначала одна строка; единица по умолчанию уже стоит', () => {
    open();
    expect(container.querySelector('[id="field-items"]')).not.toBeNull();
    expect(cell(0, 'unit')?.value).toBe('шт');
  });

  it('сумма строки и итог с НДС считаются сразу и попадают в значение', () => {
    open();
    fillRow(0, 'Товар1', '4 000', '210');
    const items = readItems(value);
    expect(items?.total).toBe('84000000');
    expect(items?.vat).toBe('11586207');
    expect(container.textContent?.replace(/ /gu, ' ')).toContain('840 000,00');
    expect(container.textContent?.replace(/ /gu, ' ')).toContain('115 862,07');
  });

  it('у компании без свидетельства НДС – «без НДС»', () => {
    open(null);
    fillRow(0, 'Товар1', '1', '100');
    expect(readItems(value)?.vat).toBeNull();
    expect(container.textContent).toContain('Без НДС');
  });

  it('Enter в последней строке добавляет новую и ставит в неё курсор; форма не отправляется', () => {
    open();
    fillRow(0, 'Товар1', '1', '100');
    let submitted = false;
    container.querySelector('form')?.addEventListener('submit', () => {
      submitted = true;
    });
    const price = cell(0, 'price');
    act(() => {
      price?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    expect(cell(1, 'name')).not.toBeNull();
    expect(document.activeElement).toBe(cell(1, 'name'));
    expect(submitted).toBe(false);
    expect(readItems(value)?.rows).toHaveLength(2);
  });

  it('строку можно убрать; итог пересчитывается', () => {
    open();
    fillRow(0, 'Товар1', '1', '100');
    act(() => {
      cell(0, 'price')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    fillRow(1, 'Товар2', '2', '50');
    expect(readItems(value)?.total).toBe('20000');
    const remove = container.querySelectorAll<HTMLButtonElement>('button[aria-label="Убрать строку"]');
    act(() => remove[0]?.click());
    expect(readItems(value)?.rows.map((r) => r['name'])).toEqual(['Товар2']);
    expect(readItems(value)?.total).toBe('10000');
  });
});
