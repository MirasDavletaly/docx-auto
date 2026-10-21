/**
 * Число прописью на казахском, русском и английском.
 *
 * В документах группы число дублируется словами: «5 (бес / пять / five)
 * күнтізбелік күн». Раньше слова вписывали руками в три поля («Тест день
 * 2»: «и ещё с прописными календарными днями»); теперь они считаются из
 * числа, а поле остаётся для правки.
 *
 * Слова – в именительном падеже, как в скобках после числа. Русский род
 * мужской («один день», «два тенге»), у тысяч – женский («две тысячи»).
 * Считаются целые числа до триллиона: суммы на сайте вводятся в целых
 * тенге, тиынов в поле суммы нет (CLAUDE.md, п. 3.9 – серверная функция
 * с тиынами появится на этапе 3).
 */

export type WordsLang = 'kk' | 'ru' | 'en';

const LIMIT = 1_000_000_000_000;

/* ── Русский ─────────────────────────────────────────────────────────── */

const RU_UNITS = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const RU_UNITS_F = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
const RU_TEENS = [
  'десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать',
  'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать',
];
const RU_TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const RU_HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
/** Разряды: форма для 1, для 2–4, для 5 и больше; род. */
const RU_SCALES: Array<[string, string, string, boolean]> = [
  ['', '', '', false],
  ['тысяча', 'тысячи', 'тысяч', true],
  ['миллион', 'миллиона', 'миллионов', false],
  ['миллиард', 'миллиарда', 'миллиардов', false],
];

function ruTriple(n: number, feminine: boolean): string[] {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) words.push(RU_HUNDREDS[hundreds] ?? '');
  if (rest >= 10 && rest < 20) {
    words.push(RU_TEENS[rest - 10] ?? '');
  } else {
    const tens = Math.floor(rest / 10);
    const units = rest % 10;
    if (tens > 0) words.push(RU_TENS[tens] ?? '');
    if (units > 0) words.push((feminine ? RU_UNITS_F : RU_UNITS)[units] ?? '');
  }
  return words;
}

function ruPlural(n: number, forms: [string, string, string]): string {
  const last2 = n % 100;
  const last = n % 10;
  if (last2 >= 11 && last2 <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

function russian(n: number): string {
  if (n === 0) return 'ноль';
  const words: string[] = [];
  let scale = 0;
  const groups: string[][] = [];
  let rest = n;
  while (rest > 0) {
    const triple = rest % 1000;
    const [one, few, many, feminine] = RU_SCALES[scale] ?? ['', '', '', false];
    if (triple > 0) {
      const part = ruTriple(triple, feminine);
      if (scale > 0) part.push(ruPlural(triple, [one, few, many]));
      groups.unshift(part);
    }
    rest = Math.floor(rest / 1000);
    scale += 1;
  }
  for (const group of groups) words.push(...group);
  return words.join(' ');
}

/* ── Казахский ───────────────────────────────────────────────────────── */

const KK_UNITS = ['', 'бір', 'екі', 'үш', 'төрт', 'бес', 'алты', 'жеті', 'сегіз', 'тоғыз'];
const KK_TENS = ['', 'он', 'жиырма', 'отыз', 'қырық', 'елу', 'алпыс', 'жетпіс', 'сексен', 'тоқсан'];
const KK_SCALES = ['', 'мың', 'миллион', 'миллиард'];

/** «жүз» без «бір» для ровной сотни: «жүз елу», но «екі жүз». */
function kkTriple(n: number): string[] {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const units = n % 10;
  if (hundreds > 0) {
    if (hundreds > 1) words.push(KK_UNITS[hundreds] ?? '');
    words.push('жүз');
  }
  if (tens > 0) words.push(KK_TENS[tens] ?? '');
  if (units > 0) words.push(KK_UNITS[units] ?? '');
  return words;
}

function kazakh(n: number): string {
  if (n === 0) return 'нөл';
  const groups: string[][] = [];
  let rest = n;
  let scale = 0;
  while (rest > 0) {
    const triple = rest % 1000;
    if (triple > 0) {
      const part = kkTriple(triple);
      // Разряд тысяч и выше называется с «бір»: «бір мың», «бір миллион».
      if (scale > 0 && triple === 1) part.splice(0, part.length, 'бір');
      if (scale > 0) part.push(KK_SCALES[scale] ?? '');
      groups.unshift(part);
    }
    rest = Math.floor(rest / 1000);
    scale += 1;
  }
  return groups.flat().join(' ');
}

/* ── Английский ──────────────────────────────────────────────────────── */

const EN_UNITS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const EN_TEENS = [
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const EN_SCALES = ['', 'thousand', 'million', 'billion'];

function enBelowHundred(n: number): string {
  if (n < 10) return EN_UNITS[n] ?? '';
  if (n < 20) return EN_TEENS[n - 10] ?? '';
  const tens = EN_TENS[Math.floor(n / 10)] ?? '';
  const units = n % 10;
  return units === 0 ? tens : `${tens}-${EN_UNITS[units] ?? ''}`;
}

/** Британский порядок, как в договорах: «one hundred and fifty». */
function enTriple(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) return enBelowHundred(rest);
  const head = `${EN_UNITS[hundreds] ?? ''} hundred`;
  return rest === 0 ? head : `${head} and ${enBelowHundred(rest)}`;
}

function english(n: number): string {
  if (n === 0) return 'zero';
  const groups: Array<{ scale: number; value: number }> = [];
  let rest = n;
  let scale = 0;
  while (rest > 0) {
    const triple = rest % 1000;
    if (triple > 0) groups.unshift({ scale, value: triple });
    rest = Math.floor(rest / 1000);
    scale += 1;
  }

  return groups
    .map(({ scale: s, value }, i) => {
      const words = `${enTriple(value)}${s > 0 ? ` ${EN_SCALES[s] ?? ''}` : ''}`;
      // «one thousand and five»: «and» перед последней группой меньше сотни.
      const last = i === groups.length - 1 && i > 0 && s === 0 && value < 100;
      return last ? `and ${words}` : words;
    })
    .join(' ');
}

/**
 * Целое число прописью. Не число, отрицательное или больше триллиона –
 * пустая строка: в документ лучше пропуск, чем неверные слова.
 */
export function numberToWords(value: number | string, lang: WordsLang): string {
  // Пустое поле – не ноль: `Number('')` дал бы 0 и слово «ноль» в документе.
  let n: number;
  if (typeof value === 'number') {
    n = value;
  } else {
    const digits = value.replace(/\s/gu, '');
    if (digits === '') return '';
    n = Number(digits);
  }
  if (!Number.isInteger(n) || n < 0 || n >= LIMIT) return '';
  if (lang === 'kk') return kazakh(n);
  if (lang === 'en') return english(n);
  return russian(n);
}
