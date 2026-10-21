/**
 * Число прописью: табличные тесты по CLAUDE.md, п. 3.9 – 0, 1, 2, 5, 11, 21,
 * 1 000, 1 000 000 и суммы из документов.
 */
import { describe, expect, it } from 'vitest';

import { numberToWords } from './numberWords';

describe('число прописью', () => {
  it.each([
    [0, 'нөл', 'ноль', 'zero'],
    [1, 'бір', 'один', 'one'],
    [2, 'екі', 'два', 'two'],
    [5, 'бес', 'пять', 'five'],
    [11, 'он бір', 'одиннадцать', 'eleven'],
    [21, 'жиырма бір', 'двадцать один', 'twenty-one'],
    [24, 'жиырма төрт', 'двадцать четыре', 'twenty-four'],
    [100, 'жүз', 'сто', 'one hundred'],
    [150, 'жүз елу', 'сто пятьдесят', 'one hundred and fifty'],
    [1000, 'бір мың', 'одна тысяча', 'one thousand'],
    [1005, 'бір мың бес', 'одна тысяча пять', 'one thousand and five'],
    [2000, 'екі мың', 'две тысячи', 'two thousand'],
    [5000, 'бес мың', 'пять тысяч', 'five thousand'],
    [11000, 'он бір мың', 'одиннадцать тысяч', 'eleven thousand'],
    [21000, 'жиырма бір мың', 'двадцать одна тысяча', 'twenty-one thousand'],
    [150000, 'жүз елу мың', 'сто пятьдесят тысяч', 'one hundred and fifty thousand'],
    [450000, 'төрт жүз елу мың', 'четыреста пятьдесят тысяч', 'four hundred and fifty thousand'],
    [1000000, 'бір миллион', 'один миллион', 'one million'],
    [2500000, 'екі миллион бес жүз мың', 'два миллиона пятьсот тысяч', 'two million five hundred thousand'],
  ])('%i: %s / %s / %s', (n, kk, ru, en) => {
    expect(numberToWords(n, 'kk')).toBe(kk);
    expect(numberToWords(n, 'ru')).toBe(ru);
    expect(numberToWords(n, 'en')).toBe(en);
  });

  it('понимает строку из поля ввода, в том числе с пробелами разрядов', () => {
    expect(numberToWords('150 000', 'ru')).toBe('сто пятьдесят тысяч');
  });

  it('не число, дробь и отрицательное – пропуск, а не неверные слова', () => {
    expect(numberToWords('', 'ru')).toBe('');
    expect(numberToWords('abc', 'ru')).toBe('');
    expect(numberToWords(1.5, 'ru')).toBe('');
    expect(numberToWords(-3, 'ru')).toBe('');
  });
});
