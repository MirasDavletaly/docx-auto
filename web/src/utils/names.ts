/**
 * Имена на других языках документа, когда их не вписали руками.
 *
 * В карточке работника казахское и латинское написание не обязательны, и
 * без них в английскую колонку шла кириллица, а в казахскую – имя без
 * дательного падежа («Тест день 2»: «пусть автоматически переводит на
 * английский и казахский»). Здесь – замена по правилам, а не перевод:
 * человек всегда может поправить написание в карточке или в форме.
 */

/**
 * Латиница по правилам, близким к паспортным (ICAO 9303) и к тому, как
 * написаны имена в документах группы: «Хамит» – «Khamit», «Қабыл» –
 * «Kabyl». Для «я» и «ю» – «ya», «yu», как в «Sofiya».
 */
const LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
  ә: 'a', ғ: 'g', қ: 'k', ң: 'n', ө: 'o', ұ: 'u', ү: 'u', һ: 'h', і: 'i',
};

/** Кириллица латиницей; заглавная буква остаётся заглавной: «Жан» – «Zhan». */
export function transliterate(text: string): string {
  let out = '';
  for (const char of text) {
    // toLowerCase, а не toLocaleLowerCase('ru'): для русских и казахских
    // букв результат тот же (тест в utils/search.test.ts), а языковая версия
    // на каждой букве была самым дорогим местом поиска по реестру.
    const lower = char.toLowerCase();
    const latin = LATIN[lower];
    if (latin === undefined) {
      out += char;
    } else if (char !== lower && latin !== '') {
      out += latin.charAt(0).toUpperCase() + latin.slice(1);
    } else {
      out += latin;
    }
  }
  return out;
}

/**
 * Казахские буквы в русском написании – их русские пары («Тест день 3»:
 * «Нұрлан на русский должен переводиться как Нурлан»). Казахское написание
 * при этом не теряется: оно лежит в своём поле карточки.
 */
const RUSSIAN: Record<string, string> = {
  ә: 'а', ғ: 'г', қ: 'к', ң: 'н', ө: 'о', ұ: 'у', ү: 'у', һ: 'х', і: 'и',
  Ә: 'А', Ғ: 'Г', Қ: 'К', Ң: 'Н', Ө: 'О', Ұ: 'У', Ү: 'У', Һ: 'Х', І: 'И',
};

const KAZAKH_LETTERS = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/u;

/** Есть ли в тексте буквы, которых нет в русском алфавите. */
export function hasKazakhLetters(text: string): boolean {
  return KAZAKH_LETTERS.test(text);
}

/** «Оспанов Нұрлан» – «Оспанов Нурлан». Остальное не меняется. */
export function russianLetters(text: string): string {
  return hasKazakhLetters(text) ? text.replace(/[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/gu, (c) => RUSSIAN[c] ?? c) : text;
}

interface Spelled {
  fullName: string;
  fullNameGenitive: string;
  fullNameKk?: string;
}

/**
 * Карточка по правилу «русское написание – русскими буквами».
 *
 * Имя, вписанное с казахскими буквами, переходит в казахское поле (если оно
 * ещё пустое), а русское и родительный падеж получают русские пары букв.
 * Вписанное руками казахское написание не затирается.
 */
export function withRussianSpelling<T extends Spelled>(person: T): T {
  if (!hasKazakhLetters(person.fullName) && !hasKazakhLetters(person.fullNameGenitive)) {
    return person;
  }
  const kk = person.fullNameKk === undefined || person.fullNameKk.trim() === '' ? person.fullName : person.fullNameKk;
  return {
    ...person,
    fullName: russianLetters(person.fullName),
    fullNameGenitive: russianLetters(person.fullNameGenitive),
    fullNameKk: kk,
  };
}

/** Отчество по окончанию: «-ович», «-овна», «-ұлы», «-қызы». */
function isPatronymic(word: string): boolean {
  return /(вич|вна|ична|инична|ұлы|улы|қызы|кызы)$/iu.test(word);
}

/**
 * Имя для английской колонки: «Ахметов Асхат Каирович» – «Askhat Akhmetov».
 *
 * В английских документах группы имя идёт первым, отчества нет. Порядок
 * меняется, только если по отчеству видно, что запись русская: «Фамилия Имя
 * Отчество». Два слова и инициалы остаются в том порядке, как записаны.
 */
export function englishName(fullName: string): string {
  const words = fullName.trim().split(/\s+/u).filter(Boolean);
  const [surname, given, patronymic] = words;
  if (words.length === 3 && surname !== undefined && given !== undefined && patronymic !== undefined && isPatronymic(patronymic)) {
    return transliterate(`${given} ${surname}`);
  }
  return transliterate(words.join(' '));
}

const BACK_VOWELS = 'аоұыуяёю';
const FRONT_VOWELS = 'әеөүіиэ';
const VOICELESS = 'кқпстфхцчшщ';

/**
 * Казахский дательный падеж имени: «Нуржанов Диас Жанболатович» –
 * «…Жанболатовичке», «Ким Ирина Сергеевна» – «…Сергеевнаға».
 *
 * Окончание ставится на последнее слово. Твёрдое или мягкое – по последней
 * гласной слова, «қ/к» или «ғ/г» – по последнему звуку: после глухих
 * согласных «-қа/-ке», иначе «-ға/-ге». У «-ұлы», «-қызы» – «-на»:
 * «Бақытқызына».
 */
export function kazakhDative(name: string): string {
  const trimmed = name.trim();
  if (trimmed === '') return trimmed;
  if (/(ұлы|улы|қызы|кызы)$/iu.test(trimmed)) return `${trimmed}на`;

  const lower = trimmed.toLocaleLowerCase('ru');
  const last = lower.at(-1) ?? '';

  let back = true;
  for (let i = lower.length - 1; i >= 0; i -= 1) {
    const char = lower[i] ?? '';
    if (BACK_VOWELS.includes(char)) break;
    if (FRONT_VOWELS.includes(char)) {
      back = false;
      break;
    }
  }

  const voiceless = VOICELESS.includes(last);
  const suffix = voiceless ? (back ? 'қа' : 'ке') : back ? 'ға' : 'ге';
  return `${trimmed}${suffix}`;
}
