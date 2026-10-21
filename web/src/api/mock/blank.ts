/**
 * Бланк документа группы.
 *
 * Собран по настоящему приказу «AL Nurdaulet KNT»: логотип и наименование на
 * трёх языках, город слева и дата справа, заголовок с номером, тема приказа,
 * строка распоряжения, тело, подпись с чертой и лист ознакомления.
 *
 * Порядок блоков здесь один на все документы. Шаблон приносит только текст,
 * а не вёрстку: тогда бланк нельзя случайно собрать по-разному в разных
 * приказах, и правка бланка сразу расходится на весь каталог.
 */
import type { DocBlock, Para, TriRow } from '@/api/types';

/**
 * Заголовок приказа.
 *
 * Разрядка записана прямо в тексте, а не считается кодом: в образце
 * вразрядку набрано только казахское слово, а «ПРИКАЗ» и «ORDER» – обычным
 * набором. Считать это программно значило бы решать за документ.
 */
export const ORDER_WORDS = { kk: 'Б Ұ Й Р Ы Қ', ru: 'ПРИКАЗ', en: 'ORDER' };

/** Строка перед распоряжением. Здесь вразрядку и казахское, и русское. */
export const ORDERED_WORDS = {
  kk: 'Б Ұ Й Ы Р А М Ы Н',
  ru: 'П Р И К А З Ы В А Ю',
  en: 'IT IS HEREBY ORDERED:',
};

/** Заголовок документа, который приказом не является: справки, письма. */
export const DOCUMENT_WORDS = {
  certificate: { kk: 'А Н Ы Қ Т А М А', ru: 'СПРАВКА', en: 'CERTIFICATE' },
};

interface OrderInput {
  /** Тема приказа: «О приёме на работу». Печатается полужирным. */
  subject: TriRow;
  /** Ссылка на статью закона под темой. Её может не быть. */
  basis?: TriRow;
  /** Пункты распоряжения и основание – одной строкой таблицы. */
  body: TriRow;
  /** Кто подготовил документ. Есть не во всех приказах. */
  executor?: Para;
  /** Лист ознакомления. У приказов по личному составу он обязателен. */
  acquaint?: boolean;
}

/** Бланк приказа. */
export function orderBody({
  subject,
  basis,
  body,
  executor,
  acquaint = true,
}: OrderInput): DocBlock[] {
  const head: TriRow = basis === undefined ? subject : mergeRows(subject, basis);

  return [
    { kind: 'letterhead' },
    { kind: 'place-date' },
    { kind: 'order-title', words: ORDER_WORDS },
    { kind: 'tri-table', rows: [head] },
    { kind: 'tri-line', words: ORDERED_WORDS },
    { kind: 'tri-table', rows: [body] },
    { kind: 'tri-signature' },
    ...(acquaint ? [{ kind: 'tri-acquaint' } as DocBlock] : []),
    ...(executor === undefined ? [] : [{ kind: 'executor', runs: executor } as DocBlock]),
  ];
}

interface DocumentInput {
  /** Заголовок: «СПРАВКА». Тот же вид, что и «ПРИКАЗ». */
  words: { kk: string; ru: string; en: string };
  /** Тело: одна строка таблицы или несколько – по пункту на строку. */
  body: TriRow | TriRow[];
  /** Строка над подписью руководителя (см. `tri-signature`). */
  caption?: { kk: string; ru: string; en: string } | null;
}

/**
 * Бланк документа без распоряжения.
 *
 * Справка не приказывает и никого не знакомит под подпись, поэтому строки
 * «ПРИКАЗЫВАЮ» и листа ознакомления у неё нет. Всё остальное – шапка,
 * город с датой, заголовок с номером, подпись – то же самое.
 */
export function documentBody({ words, body, caption }: DocumentInput): DocBlock[] {
  return [
    { kind: 'letterhead' },
    { kind: 'place-date' },
    { kind: 'order-title', words },
    { kind: 'tri-table', rows: Array.isArray(body) ? body : [body] },
    caption === undefined ? { kind: 'tri-signature' } : { kind: 'tri-signature', caption },
  ];
}

/** Тема и ссылка на закон стоят в одной ячейке двумя абзацами. */
function mergeRows(first: TriRow, second: TriRow): TriRow {
  const merged: TriRow = {};
  for (const lang of ['kk', 'ru', 'en'] as const) {
    const paras = [...(first[lang] ?? []), ...(second[lang] ?? [])];
    if (paras.length > 0) merged[lang] = paras;
  }
  return merged;
}
