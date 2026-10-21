/**
 * Адрес на английском, если его не вписали в карточку.
 *
 * Английский адрес компании лучше вписать руками – так, как он стоит в её
 * документах. Эта функция – запасной путь для новой компании: без неё на
 * английском экране реквизитов стоял бы русский адрес («Тест день 2»).
 * Адрес разбирается по частям через запятую, адресные слова заменяются
 * английскими («город Атырау» – «Atyrau city», «улица Мусина» – «Musina
 * street»), имена собственные пишутся латиницей.
 */
import { transliterate } from './names';

/** Буква в номере дома пишется той латинской, на которую похожа: «113В» – «113B». */
const LOOKALIKE: Record<string, string> = {
  А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X',
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', х: 'x',
};

function latin(text: string): string {
  return text
    .split(/(\s+)/u)
    .map((word) =>
      /^\d/u.test(word)
        ? [...word].map((char) => LOOKALIKE[char] ?? transliterate(char)).join('')
        : transliterate(word),
    )
    .join('');
}

/** «Бурлинский» – «Burlin», «Атырауская» – «Atyrau»: прилагательное без окончания. */
function stem(adjective: string): string {
  return latin(adjective.replace(/(ский|ская|ское|цкий|цкая)$/u, ''));
}

type Rule = [RegExp, (m: RegExpMatchArray) => string];

/** Правила для одной части адреса. Первое подошедшее побеждает. */
const RULES: Rule[] = [
  [/^Республика Казахстан$/iu, () => 'Republic of Kazakhstan'],
  [/^Западно-Казахстанская область$/iu, () => 'West Kazakhstan region'],
  [/^Северо-Казахстанская область$/iu, () => 'North Kazakhstan region'],
  [/^Восточно-Казахстанская область$/iu, () => 'East Kazakhstan region'],
  [/^(\S+) область$/iu, (m) => `${stem(m[1] ?? '')} region`],
  [/^(\S+) район$/iu, (m) => `${stem(m[1] ?? '')} district`],
  [/^район (.+)$/iu, (m) => `${latin(m[1] ?? '')} district`],
  [/^(\S+) сельский округ$/iu, (m) => `${stem(m[1] ?? '')} rural district`],
  [/^(?:город|г\.)\s*(.+)$/iu, (m) => `${latin(m[1] ?? '')} city`],
  [/^(?:село|с\.)\s*(.+)$/iu, (m) => `${latin(m[1] ?? '')} village`],
  [/^(?:улица|ул\.)\s*(.+)$/iu, (m) => `${latin(m[1] ?? '')} street`],
  [/^(?:проспект|пр\.|пр-т)\s*(.+)$/iu, (m) => `${latin(m[1] ?? '')} Ave.`],
  [/^(?:микрорайон|мкр\.?)\s*(.+)$/iu, (m) => `microdistrict ${latin(m[1] ?? '')}`],
  [/^(.+) микрорайон$/iu, (m) => `microdistrict ${latin(m[1] ?? '')}`],
  [/^(?:строение|здание|стр\.)\s*(.+)$/iu, (m) => `building ${latin(m[1] ?? '')}`],
  [/^(?:дом|д\.)\s*(.+)$/iu, (m) => `house ${latin(m[1] ?? '')}`],
  [/^(?:квартира|кв\.)\s*(.+)$/iu, (m) => `apartment ${latin(m[1] ?? '')}`],
  [/^офисы\s*(.+)$/iu, (m) => `offices ${latin(m[1] ?? '')}`],
  [/^(?:офис|оф\.)\s*(.+)$/iu, (m) => `office ${latin(m[1] ?? '')}`],
  [/^блок\s*(.+)$/iu, (m) => `block ${latin(m[1] ?? '')}`],
  [/^Промышленная зона$/iu, () => 'Industrial Zone'],
];

function part(text: string): string {
  const trimmed = text.trim();
  for (const [pattern, build] of RULES) {
    const match = trimmed.match(pattern);
    if (match !== null) return build(match);
  }
  return latin(trimmed);
}

/** Русский адрес – английским: по частям через запятую. */
export function englishAddress(address: string): string {
  return address
    .split(',')
    .map(part)
    .filter((piece) => piece !== '')
    .join(', ');
}
