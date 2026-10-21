/**
 * Проверка дат в документе.
 *
 * Ровно та ошибка, которую человек нашёл руками: в приказе о командировке
 * дата возвращения оказалась раньше даты выезда, и документ сохранился.
 * Тест закрывает оба пути: выбор мышью (границы у органа ввода) и ввод
 * руками (проверка при сохранении).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { checkField, dateBounds, today, validateFields } from './validation';

import type { FieldDef } from '@/api/types';

const NOW = new Date('2026-09-22T09:00:00.000Z');

const from: FieldDef = {
  id: 'from',
  kind: 'date',
  label: 'Дата выезда',
  required: true,
  group: 'Сроки',
  dateLimits: { notBefore: 'today' },
};

const to: FieldDef = {
  id: 'to',
  kind: 'date',
  label: 'Дата возвращения',
  required: true,
  group: 'Сроки',
  dateLimits: { afterField: 'from' },
};

const contractDate: FieldDef = {
  id: 'contractDate',
  kind: 'date',
  label: 'Дата трудового договора',
  required: true,
  group: 'Основание',
  dateLimits: { notAfter: 'today' },
};

const note: FieldDef = {
  id: 'note',
  kind: 'text',
  label: 'Заметка',
  required: false,
  group: 'Прочее',
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('границы для органа ввода', () => {
  it('дата возвращения не раньше даты выезда', () => {
    expect(dateBounds(to, { from: '2026-09-24' })).toEqual({ min: '2026-09-24' });
  });

  it('пока дата выезда не выбрана, нижней границы у возвращения нет', () => {
    expect(dateBounds(to, {})).toEqual({});
  });

  it('дата выезда не раньше сегодняшнего дня', () => {
    expect(dateBounds(from, {})).toEqual({ min: today() });
  });

  it('дата договора не позже сегодняшнего дня', () => {
    expect(dateBounds(contractDate, {})).toEqual({ max: today() });
  });

  it('у поля без ограничений границ нет', () => {
    expect(dateBounds(note, {})).toEqual({});
  });
});

describe('проверка при сохранении', () => {
  it('ловит дату возвращения раньше даты выезда, вписанную руками', () => {
    const values = { from: '2026-09-24', to: '2026-09-06' };
    const message = checkField(to, values, [from, to]);

    expect(message).not.toBeNull();
    expect(message).toContain('Дата выезда');
  });

  it('пропускает возвращение в тот же день', () => {
    expect(checkField(to, { from: '2026-09-24', to: '2026-09-24' }, [from, to])).toBeNull();
  });

  it('пропускает возвращение позже выезда', () => {
    expect(checkField(to, { from: '2026-09-24', to: '2026-10-01' }, [from, to])).toBeNull();
  });

  it('не даёт выписать приказ задним числом', () => {
    expect(checkField(from, { from: '2026-09-21' }, [from])).not.toBeNull();
    expect(checkField(from, { from: '2026-09-22' }, [from])).toBeNull();
    expect(checkField(from, { from: '2026-09-23' }, [from])).toBeNull();
  });

  it('не даёт сослаться на договор, который ещё не подписан', () => {
    expect(checkField(contractDate, { contractDate: '2026-09-23' }, [contractDate])).not.toBeNull();
    expect(checkField(contractDate, { contractDate: '2026-09-01' }, [contractDate])).toBeNull();
  });

  it('пустое обязательное поле – ошибка, пустое необязательное – нет', () => {
    expect(checkField(from, {}, [from])).not.toBeNull();
    expect(checkField(note, {}, [note])).toBeNull();
  });
});

describe('вся форма', () => {
  it('возвращает замечания в порядке полей: первое получает фокус', () => {
    const problems = validateFields([from, to], { from: '', to: '2026-09-06' });
    expect(problems.map((p) => p.fieldId)).toEqual(['from']);
  });

  it('заполненная верно форма замечаний не даёт', () => {
    const problems = validateFields([from, to, note], {
      from: '2026-09-24',
      to: '2026-10-01',
    });
    expect(problems).toEqual([]);
  });
});

describe('таблица позиций («Тест день 4», дополнение)', () => {
  const items: FieldDef = {
    id: 'items',
    kind: 'items',
    label: 'Позиции',
    required: true,
    group: 'Позиции',
    items: {
      columns: [
        { id: 'name', label: 'Наименование', kind: 'text', required: true },
        { id: 'qty', label: 'Количество', kind: 'quantity', required: true },
        { id: 'price', label: 'Цена', kind: 'money', required: true },
      ],
      quantity: 'qty',
      price: 'price',
    },
  };
  const table = (rows: Array<Record<string, string>>) =>
    JSON.stringify({ rows, lines: [], total: '0', vat: null, vatRate: null, quantity: '0', words: '', quantityWords: '' });

  it('пустая таблица – как пустое обязательное поле', () => {
    expect(checkField(items, {}, [items])).toBe(checkField(from, {}, [from]));
    expect(checkField(items, { items: table([{}]) }, [items])).toBe(checkField(from, {}, [from]));
  });

  it('называет строку и колонку, которой не хватает или где не число', () => {
    expect(checkField(items, { items: table([{ name: 'Товар', qty: '2' }]) }, [items])).toBe(
      'Строка 1: заполните «Цена»',
    );
    expect(checkField(items, { items: table([{ name: 'Товар', qty: 'два', price: '5' }]) }, [items])).toBe(
      'Строка 1: в «Количество» должно быть число',
    );
  });

  it('заполненная таблица замечаний не даёт', () => {
    expect(checkField(items, { items: table([{ name: 'Товар', qty: '2', price: '5' }]) }, [items])).toBeNull();
  });
});
