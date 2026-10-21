/**
 * Таблица позиций в документе: строки, суммы, итог, НДС.
 *
 * Значение поля – JSON: строки, как их ввёл человек, и то, что по ним
 * посчитано (суммы строк, итог, НДС, итог прописью). Посчитанное хранится,
 * а не считается при показе: сохранённый документ – снимок (CLAUDE.md,
 * п. 3.4), и правка расчёта или правил прописи не должна менять уже
 * выпущенные акты и накладные. Пересчёт идёт в форме при каждой правке.
 *
 * Суммы – в тиынах строкой (`bigint` в JSON не пишется), количество – в
 * тысячных (`utils/money.ts`).
 */
import {
  lineAmount,
  parseMoney,
  parseQuantity,
  quantityWords,
  tiynWords,
  vatIncluded,
} from './money';

import type { ItemColumn, ItemsSpec } from '@/api/types';

/**
 * Ставка НДС – 16 % (Налоговый кодекс РК с 1 января 2026 года, «Тест день
 * 4»: «НДС 16 процентов»). Применяется только у компании-плательщика НДС.
 */
export const VAT_RATE_PERCENT = 16;

export type ItemRow = Record<string, string>;

export interface ItemsValue {
  rows: ItemRow[];
  /** По строке на каждую строку таблицы; `null` – строка пуста или в ней не число. */
  lines: Array<{ amount: string; vat: string | null } | null>;
  /** Итог в тиынах. */
  total: string;
  /** НДС в итоге; `null` – без НДС. */
  vat: string | null;
  vatRate: number | null;
  /** Сумма количеств в тысячных: «всего отпущено». */
  quantity: string;
  /** Итог прописью: «Два миллиона сто тысяч тенге 00 тиын». */
  words: string;
  /** Количество прописью: «Десять тысяч». */
  quantityWords: string;
}

/** Что не так с таблицей: первая причина, как у остальных полей. */
export type ItemsProblem =
  | { kind: 'empty' }
  | { kind: 'missing'; row: number; column: string }
  | { kind: 'number'; row: number; column: string };

/** Новая строка: колонки со значением по умолчанию («шт», «Услуга»). */
export function emptyRow(spec: ItemsSpec): ItemRow {
  const row: ItemRow = {};
  for (const column of spec.columns) {
    if (column.initial !== undefined) row[column.id] = column.initial;
  }
  return row;
}

/** В строке что-то вписано, кроме значений по умолчанию. */
export function isFilled(row: ItemRow, spec: ItemsSpec): boolean {
  return spec.columns.some((column) => {
    const value = (row[column.id] ?? '').trim();
    return value !== '' && value !== (column.initial ?? '');
  });
}

/** Значение колонки; пустое – из колонки `sameAs` (отпущено = подлежит отпуску). */
export function cellValue(row: ItemRow, column: ItemColumn): string {
  const own = (row[column.id] ?? '').trim();
  if (own !== '' || column.sameAs === undefined) return own;
  return (row[column.sameAs] ?? '').trim();
}

function columnById(spec: ItemsSpec, id: string): ItemColumn | undefined {
  return spec.columns.find((column) => column.id === id);
}

/** Заполненные строки с номерами: 1, 2, 3 или 10, 20, 30. */
export function filledRows(rows: ItemRow[], spec: ItemsSpec): Array<{ row: ItemRow; index: number; number: number }> {
  const step = spec.step ?? 1;
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => isFilled(row, spec))
    .map((entry, position) => ({ ...entry, number: (position + 1) * step }));
}

/**
 * Считает таблицу. `vatRate` – ставка компании (`null` – не плательщик НДС);
 * у шаблона без НДС (`spec.vat` не задан) она не применяется.
 */
export function computeItems(rows: ItemRow[], spec: ItemsSpec, vatRate: number | null): ItemsValue {
  const rate = spec.vat === true ? vatRate : null;
  const quantityColumn = columnById(spec, spec.quantity);
  const priceColumn = columnById(spec, spec.price);

  let total = 0n;
  let vat = 0n;
  let quantity = 0n;

  const lines = rows.map((row) => {
    if (!isFilled(row, spec) || quantityColumn === undefined || priceColumn === undefined) return null;
    const qty = parseQuantity(cellValue(row, quantityColumn));
    const price = parseMoney(cellValue(row, priceColumn));
    if (qty === null || price === null) return null;

    const amount = lineAmount(qty, price);
    const lineVat = rate === null ? null : vatIncluded(amount, rate);
    total += amount;
    quantity += qty;
    if (lineVat !== null) vat += lineVat;
    return { amount: amount.toString(), vat: lineVat === null ? null : lineVat.toString() };
  });

  return {
    rows,
    lines,
    total: total.toString(),
    vat: rate === null ? null : vat.toString(),
    vatRate: rate,
    quantity: quantity.toString(),
    words: tiynWords(total),
    quantityWords: quantityWords(quantity),
  };
}

export function writeItems(value: ItemsValue): string {
  return JSON.stringify(value);
}

/** Таблица из значения поля. Пустое или испорченное – `null`. */
export function readItems(raw: string): ItemsValue | null {
  if (raw.trim() === '') return null;
  try {
    const value = JSON.parse(raw) as Partial<ItemsValue> | null;
    if (
      value === null ||
      typeof value !== 'object' ||
      !Array.isArray(value.rows) ||
      !Array.isArray(value.lines) ||
      typeof value.total !== 'string'
    ) {
      return null;
    }
    return value as ItemsValue;
  } catch {
    return null;
  }
}

/** Первая причина, почему таблицу нельзя сохранить. Всё в порядке – `null`. */
export function itemsProblem(raw: string, spec: ItemsSpec): ItemsProblem | null {
  const value = readItems(raw);
  const rows = value?.rows ?? [];
  if (!rows.some((row) => isFilled(row, spec))) return { kind: 'empty' };

  for (const [index, row] of rows.entries()) {
    if (!isFilled(row, spec)) continue;
    for (const column of spec.columns) {
      const cell = cellValue(row, column);
      if (cell === '') {
        if (column.required === true) return { kind: 'missing', row: index + 1, column: column.label };
        continue;
      }
      const parsed =
        column.kind === 'quantity' ? parseQuantity(cell) : column.kind === 'money' ? parseMoney(cell) : 0n;
      if (parsed === null) return { kind: 'number', row: index + 1, column: column.label };
    }
  }
  return null;
}
