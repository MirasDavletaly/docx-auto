/**
 * Поиск по словам: общий для реестра документов, архива и админ-панели.
 *
 * Запрос делится на слова, и запись подходит, если в ней встретились все
 * слова: «приказ отпуск Ахметов» сужает, а не расширяет выдачу.
 *
 * Имя человек набирает так, как помнит («Тест день 3»): по-русски, с
 * казахскими буквами или латиницей. Поэтому слово ищется дважды – в тексте,
 * где казахские буквы сведены к русским («Нұрлан» = «Нурлан»), и в том же
 * тексте латиницей по тем же правилам, по которым имя пишется на английском
 * экране («Нурлан» = «Nurlan»).
 */
import { russianLetters, transliterate } from './names';

/** Строка для сравнения: без регистра, «ё» как «е», казахские буквы как русские. */
export function fold(text: string): string {
  // Для русских и казахских букв toLowerCase даёт то же, что
  // toLocaleLowerCase('ru'), и заметно быстрее (utils/search.test.ts).
  return russianLetters(text.toLowerCase()).replace(/ё/gu, 'е').replace(/\s+/gu, ' ');
}

/**
 * Подготовленный текст записи: сведённый и латиницей.
 *
 * Готовится один раз на одну и ту же строку, а не на каждое нажатие клавиши:
 * при 300 документах в реестре подготовка каждой записи заново занимала
 * 140 мс на нажатие на среднем ноутбуке (замер 01.10). Запомненных строк –
 * не больше `PREPARED_LIMIT`, дальше запоминание начинается заново.
 */
interface Prepared {
  text: string;
  latin: string;
}

const PREPARED_LIMIT = 5000;
const prepared = new Map<string, Prepared>();

function prepare(source: string): Prepared {
  const cached = prepared.get(source);
  if (cached !== undefined) return cached;
  if (prepared.size >= PREPARED_LIMIT) prepared.clear();
  const text = fold(source);
  const value = { text, latin: transliterate(text) };
  prepared.set(source, value);
  return value;
}

/** Слова запроса – сведённые и латиницей; запрос готовится один раз на весь список. */
interface PreparedQuery {
  words: Array<{ text: string; latin: string }>;
}

let lastQuery: { source: string; value: PreparedQuery } | null = null;

function prepareQuery(query: string): PreparedQuery {
  if (lastQuery?.source === query) return lastQuery.value;
  const words = fold(query)
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => ({ text: word, latin: transliterate(word) }));
  const value = { words };
  lastQuery = { source: query, value };
  return value;
}

/** Встретились ли все слова запроса хотя бы в одном из полей. Пустой запрос – да. */
export function matchesQuery(query: string, fields: Array<string | null | undefined>): boolean {
  const { words } = prepareQuery(query);
  if (words.length === 0) return true;

  const { text, latin } = prepare(fields.filter((f): f is string => typeof f === 'string').join('\n'));
  return words.every((word) => text.includes(word.text) || latin.includes(word.latin));
}
