/**
 * Таблица позиций: расчёт по строкам, итог, НДС и хранение в снимке
 * документа. Образец – накладная З-2 из «Тест день 4».
 */
import { describe, expect, it } from 'vitest';

import { computeItems, emptyRow, filledRows, itemsProblem, readItems, writeItems } from './items';

import type { ItemsSpec } from '@/api/types';

const waybill: ItemsSpec = {
  columns: [
    { id: 'name', label: 'Наименование', kind: 'text', required: true },
    { id: 'code', label: 'Номенклатурный номер', kind: 'text' },
    { id: 'unit', label: 'Единица измерения', kind: 'text', initial: 'шт', required: true },
    { id: 'planned', label: 'Подлежит отпуску', kind: 'quantity', required: true },
    { id: 'released', label: 'Отпущено', kind: 'quantity', sameAs: 'planned' },
    { id: 'price', label: 'Цена за единицу', kind: 'money', required: true },
  ],
  quantity: 'released',
  price: 'price',
  vat: true,
};

const sample = [
  { name: 'Товар1', code: '000001', unit: 'кг', planned: '4 000', released: '4000', price: '210' },
  { name: 'Товар2', code: '000002', unit: 'кг', planned: '6000', released: '', price: '210,00' },
];

describe('расчёт таблицы позиций', () => {
  it('образец накладной: суммы строк, НДС, итог и прописью', () => {
    // Образец считан по прежней ставке 12 %: так видно, что цифры сходятся.
    const value = computeItems(sample, waybill, 12);
    expect(value.lines).toEqual([
      { amount: '84000000', vat: '9000000' },
      { amount: '126000000', vat: '13500000' },
    ]);
    expect(value.total).toBe('210000000');
    expect(value.vat).toBe('22500000');
    expect(value.vatRate).toBe(12);
    expect(value.quantity).toBe('10000000');
    expect(value.words).toBe('Два миллиона сто тысяч тенге 00 тиын');
    expect(value.quantityWords).toBe('Десять тысяч');
  });

  it('пустое «отпущено» берётся из «подлежит отпуску»', () => {
    const value = computeItems(sample, waybill, 16);
    expect(value.lines[1]?.amount).toBe('126000000');
  });

  it('НДС 16 % выделяется из суммы строки', () => {
    const value = computeItems([{ name: 'Услуга', unit: 'шт', planned: '1', price: '1 160' }], waybill, 16);
    expect(value.lines[0]).toEqual({ amount: '116000', vat: '16000' });
    expect(value.vat).toBe('16000');
  });

  it('компания не плательщик НДС – «без НДС»', () => {
    const value = computeItems(sample, waybill, null);
    expect(value.vat).toBeNull();
    expect(value.lines[0]?.vat).toBeNull();
    expect(value.total).toBe('210000000');
  });

  it('у таблицы без НДС в шаблоне ставка компании не применяется', () => {
    const value = computeItems(sample, { ...waybill, vat: false }, 16);
    expect(value.vat).toBeNull();
    expect(value.vatRate).toBeNull();
  });

  it('пустые строки не считаются и не нумеруются, строка с неверным числом – без суммы', () => {
    const rows = [emptyRow(waybill), sample[0]!, { ...sample[1]!, price: 'дорого' }];
    const value = computeItems(rows, waybill, 16);
    expect(value.lines).toEqual([null, { amount: '84000000', vat: '11586207' }, null]);
    expect(value.total).toBe('84000000');
    expect(filledRows(rows, waybill).map((r) => r.number)).toEqual([1, 2]);
  });

  it('номера строк с шагом 10 – как в КП Green Spark', () => {
    expect(filledRows(sample, { ...waybill, step: 10 }).map((r) => r.number)).toEqual([10, 20]);
  });

  it('новая строка – со значениями по умолчанию', () => {
    expect(emptyRow(waybill)).toEqual({ unit: 'шт' });
  });
});

describe('хранение в снимке', () => {
  it('записанное читается обратно', () => {
    const value = computeItems(sample, waybill, 16);
    expect(readItems(writeItems(value))).toEqual(value);
  });

  it('пустое и испорченное значение – нет таблицы', () => {
    expect(readItems('')).toBeNull();
    expect(readItems('не json')).toBeNull();
    expect(readItems('{"rows":5}')).toBeNull();
  });
});

describe('что не так с таблицей', () => {
  it('нет ни одной заполненной строки', () => {
    expect(itemsProblem('', waybill)).toEqual({ kind: 'empty' });
    expect(itemsProblem(writeItems(computeItems([emptyRow(waybill)], waybill, 16)), waybill)).toEqual({ kind: 'empty' });
  });

  it('в строке не хватает обязательной колонки', () => {
    const raw = writeItems(computeItems([sample[0]!, { name: 'Товар3', unit: 'кг', planned: '1' }], waybill, 16));
    expect(itemsProblem(raw, waybill)).toEqual({ kind: 'missing', row: 2, column: 'Цена за единицу' });
  });

  it('в числовой колонке не число', () => {
    const raw = writeItems(computeItems([{ ...sample[0]!, planned: 'много' }], waybill, 16));
    expect(itemsProblem(raw, waybill)).toEqual({ kind: 'number', row: 1, column: 'Подлежит отпуску' });
  });

  it('всё заполнено – замечаний нет', () => {
    expect(itemsProblem(writeItems(computeItems(sample, waybill, 16)), waybill)).toBeNull();
  });
});
