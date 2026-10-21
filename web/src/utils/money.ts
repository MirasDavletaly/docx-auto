/**
 * Деньги и количества в документах с таблицей позиций: акт Р-1, накладная
 * З-2, счёт на оплату, коммерческое предложение («Тест день 4», дополнение).
 *
 * Сумма хранится в тиынах целым числом (`bigint`), количество – в тысячных
 * долях: `float` для денег запрещён (CLAUDE.md, п. 3.9) – 0,1 + 0,2 в нём
 * не равно 0,3, и в итоге накладной это видно. Округление – до тиына,
 * половина вверх, как в бухгалтерии.
 *
 * Считает браузер, потому что сервера пока нет. По CLAUDE.md суммы считает
 * сервер – TODO(phase-03): расчёт на сервере той же функцией с теми же
 * тестами. Посчитанное хранится в снимке документа (`utils/items.ts`), поэтому
 * правка этого файла выпущенные документы не меняет.
 */
import { numberToWords } from './numberWords';

/** Тиынов в тенге. */
const TIYN = 100n;
/** Тысячных в единице количества. */
const MILLI = 1000n;

/** Оформление числа: «840 000,00» – по-казахстански, «20.100,00» – как в образце КП Green Spark. */
export type NumberStyle = 'kz' | 'eu';

/** Деление с округлением половины вверх. Только для неотрицательных. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

function strip(text: string): string {
  return text.replace(/[\s  ]/gu, '');
}

/**
 * Сумма из ввода человека в тиынах. Понимает «1 234 567,89», «210.5» и
 * записи с разрядами через точку или запятую («3.350,00», «3,350.00»).
 * Не сумма (буквы, минус, три знака после запятой без разрядов) – `null`:
 * форма покажет ошибку, а не посчитает неверно.
 */
export function parseMoney(text: string): bigint | null {
  const s = strip(text);
  let whole: string;
  let fraction = '';

  const plain = /^(\d+)(?:[.,](\d{1,2}))?$/u.exec(s);
  const european = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/u.exec(s);
  const american = /^(\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/u.exec(s);
  if (plain !== null) {
    whole = plain[1] ?? '';
    fraction = plain[2] ?? '';
  } else if (european !== null) {
    whole = (european[1] ?? '').replace(/\./gu, '');
    fraction = european[2] ?? '';
  } else if (american !== null) {
    whole = (american[1] ?? '').replace(/,/gu, '');
    fraction = american[2] ?? '';
  } else {
    return null;
  }
  return BigInt(whole) * TIYN + BigInt(fraction.padEnd(2, '0'));
}

/** Количество в тысячных: «4 000», «2,5», «0.125». Запятая и точка – дробная часть. */
export function parseQuantity(text: string): bigint | null {
  const match = /^(\d+)(?:[.,](\d{1,3}))?$/u.exec(strip(text));
  if (match === null) return null;
  return BigInt(match[1] ?? '0') * MILLI + BigInt((match[2] ?? '').padEnd(3, '0'));
}

/** Сумма строки: количество × цена, до тиына. */
export function lineAmount(quantityMilli: bigint, priceTiyn: bigint): bigint {
  return divRound(quantityMilli * priceTiyn, MILLI);
}

/**
 * НДС, который уже сидит в сумме: сумма × ставка / (100 + ставка). Так
 * считает накладная З-2 – «сумма с НДС» и «сумма НДС» в ней (решение
 * человека 30.09: цена указывается с НДС, НДС выделяется).
 */
export function vatIncluded(grossTiyn: bigint, ratePercent: number): bigint {
  const rate = BigInt(ratePercent);
  return divRound(grossTiyn * rate, 100n + rate);
}

function groupDigits(digits: string, separator: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/gu, separator);
}

/** «840 000,00» или «20.100,00». Пробел между разрядами – неразрывный. */
export function formatTiyn(tiyn: bigint, style: NumberStyle = 'kz'): string {
  const whole = (tiyn / TIYN).toString();
  const fraction = (tiyn % TIYN).toString().padStart(2, '0');
  return `${groupDigits(whole, style === 'eu' ? '.' : ' ')},${fraction}`;
}

/**
 * Количество: «4 000», «2,5» – без лишних нулей; в стиле КП – всегда два
 * знака, «6,00», как в образце.
 */
export function formatQuantity(milli: bigint, style: NumberStyle = 'kz'): string {
  const whole = groupDigits((milli / MILLI).toString(), style === 'eu' ? '.' : ' ');
  let fraction = (milli % MILLI).toString().padStart(3, '0').replace(/0+$/u, '');
  if (style === 'eu') fraction = fraction.padEnd(2, '0');
  return fraction === '' ? whole : `${whole},${fraction}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('ru') + text.slice(1);
}

/** «Два миллиона сто тысяч тенге 00 тиын» – как в накладной З-2. */
export function tiynWords(tiyn: bigint): string {
  const words = numberToWords((tiyn / TIYN).toString(), 'ru');
  const fraction = (tiyn % TIYN).toString().padStart(2, '0');
  return `${capitalize(words)} тенге ${fraction} тиын`;
}

/**
 * Количество прописью: «Десять тысяч». Дробное – числом: долей словами
 * («две целых пять десятых») в формах группы не пишут.
 */
export function quantityWords(milli: bigint): string {
  if (milli % MILLI !== 0n) return formatQuantity(milli);
  return capitalize(numberToWords((milli / MILLI).toString(), 'ru'));
}
