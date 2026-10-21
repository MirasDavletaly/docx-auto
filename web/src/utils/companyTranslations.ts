/**
 * Реквизиты новой компании на казахском и английском – сами, по правилам.
 *
 * «Тест день 3»: «в будущем будем добавлять компании и персонал, чтобы
 * она автоматически переводила слова и имена». Правила записаны в
 * `docs/translation-rules.md` и здесь повторены кодом:
 *
 *  - форма собственности ТОО – по образцу бланков группы:
 *    «ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК «X»» и «X LLP»; само
 *    наименование – имя собственное и не переводится, в английском оно
 *    пишется латиницей («Тұлпар» – «Tulpar»);
 *  - город – из словаря городов Казахстана, иначе латиницей;
 *  - адрес – по частям (`englishAddress`);
 *  - руководитель – «Имя Фамилия» латиницей, должность – из словаря
 *    должностей.
 *
 * Подставляется только туда, где пусто или стоит прежняя подстановка:
 * поправленное руками не затирается. Родительный падеж не подставляется
 * никогда: склонять фамилии программно нельзя.
 */
import { englishAddress } from './address';
import { translateJobTitle } from './jobTitles';
import { englishName, transliterate } from './names';

import type { Company } from '@/api/types';

type Place = { kk: string; en: string };

/**
 * Города Казахстана. Казахское название не выводится из русского
 * («Уральск» – «Орал»), поэтому только словарём. Нет в словаре – казахское
 * поле остаётся пустым, английское пишется латиницей.
 */
const CITIES: Record<string, Place> = {
  'астана': { kk: 'Астана', en: 'Astana' },
  'алматы': { kk: 'Алматы', en: 'Almaty' },
  'шымкент': { kk: 'Шымкент', en: 'Shymkent' },
  'атырау': { kk: 'Атырау', en: 'Atyrau' },
  'актау': { kk: 'Ақтау', en: 'Aktau' },
  'аксай': { kk: 'Ақсай', en: 'Aksai' },
  'уральск': { kk: 'Орал', en: 'Uralsk' },
  'актобе': { kk: 'Ақтөбе', en: 'Aktobe' },
  'караганда': { kk: 'Қарағанды', en: 'Karaganda' },
  'костанай': { kk: 'Қостанай', en: 'Kostanay' },
  'павлодар': { kk: 'Павлодар', en: 'Pavlodar' },
  'усть-каменогорск': { kk: 'Өскемен', en: 'Ust-Kamenogorsk' },
  'семей': { kk: 'Семей', en: 'Semey' },
  'петропавловск': { kk: 'Петропавл', en: 'Petropavlovsk' },
  'кызылорда': { kk: 'Қызылорда', en: 'Kyzylorda' },
  'тараз': { kk: 'Тараз', en: 'Taraz' },
  'туркестан': { kk: 'Түркістан', en: 'Turkistan' },
  'кокшетау': { kk: 'Көкшетау', en: 'Kokshetau' },
  'талдыкорган': { kk: 'Талдықорған', en: 'Taldykorgan' },
  'жезказган': { kk: 'Жезқазған', en: 'Zhezkazgan' },
  'экибастуз': { kk: 'Екібастұз', en: 'Ekibastuz' },
  'темиртау': { kk: 'Теміртау', en: 'Temirtau' },
  'жанаозен': { kk: 'Жаңаөзен', en: 'Zhanaozen' },
  'конаев': { kk: 'Қонаев', en: 'Konaev' },
  'кульсары': { kk: 'Құлсары', en: 'Kulsary' },
  'жанибек': { kk: 'Жәнібек', en: 'Zhanibek' },
};

export function cityKk(city: string): string {
  return CITIES[city.trim().toLocaleLowerCase('ru')]?.kk ?? '';
}

export function cityEn(city: string): string {
  const trimmed = city.trim();
  return CITIES[trimmed.toLocaleLowerCase('ru')]?.en ?? transliterate(trimmed);
}

const LLP_FULL = /^Товарищество с ограниченной ответственностью\s+(.+)$/iu;
const LLP_SHORT = /^ТОО\s+(.+)$/u;

/** «Товарищество с ограниченной ответственностью «X»» – «ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК «X»». */
export function legalNameKk(legalName: string): string {
  const name = legalName.trim().match(LLP_FULL)?.[1];
  return name === undefined ? '' : `ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК ${name}`;
}

/** «Товарищество с ограниченной ответственностью «X»» – «X» LLP. */
export function legalNameEn(legalName: string): string {
  const name = legalName.trim().match(LLP_FULL)?.[1];
  return name === undefined ? '' : `${transliterate(name)} LLP`;
}

/** «ТОО «X»» – «X LLP»: краткое наименование без кавычек. */
export function shortNameEn(name: string): string {
  const bare = name.trim().match(LLP_SHORT)?.[1];
  return bare === undefined ? '' : `${transliterate(bare.replace(/[«»"]/gu, ''))} LLP`;
}

/**
 * «Танатаров Амир Маратович» – «Танатаров А.М.»: так руководитель стоит в
 * подписи. Порядок слов – «Фамилия Имя Отчество»; записанное иначе
 * («Самал Кабешова») правило не угадает, и подпись тогда вписывают руками.
 */
export function surnameInitials(fullName: string): string {
  const [surname, ...rest] = fullName.trim().split(/\s+/u);
  if (surname === undefined || surname === '') return '';
  const initials = rest.map((word) => `${([...word][0] ?? '').toLocaleUpperCase('ru')}.`).join('');
  return initials === '' ? surname : `${surname} ${initials}`;
}

/** Что из чего подставляется: поле-источник и правило. */
const DERIVED: Array<[source: keyof Company, target: keyof Company, rule: (value: string) => string]> = [
  ['name', 'nameEn', shortNameEn],
  ['legalName', 'legalNameKk', legalNameKk],
  ['legalName', 'legalNameEn', legalNameEn],
  ['address', 'addressEn', englishAddress],
  ['actualAddress', 'actualAddressEn', englishAddress],
  ['city', 'cityKk', cityKk],
  ['city', 'cityEn', cityEn],
];

/**
 * Руководитель на трёх языках (19.10, замечание человека): ФИО и должность
 * меняются, когда меняется человек, и прежние подпись, латиница и перевод
 * должности – это уже другой человек. Поэтому здесь правило жёстче, чем у
 * адреса и города: зависимое пересобирается всегда, даже вписанное раньше
 * руками; остаётся только то, что поправили в этой же правке.
 */
const FOLLOWING: Array<[source: keyof Company, target: keyof Company, rule: (value: string) => string]> = [
  ['directorName', 'directorNameShort', surnameInitials],
  ['directorName', 'directorNameEn', englishName],
  ['directorTitle', 'directorTitleKk', (title) => translateJobTitle(title, 'kk') ?? ''],
  ['directorTitle', 'directorTitleEn', (title) => translateJobTitle(title, 'en') ?? ''],
];

/**
 * Родительный падеж («в лице Генерального директора Кабешовой С.А.»).
 * Склонять фамилии программно нельзя, а падеж прежнего человека – ошибка в
 * каждом документе: при смене ФИО или должности падеж очищается, и без него
 * реквизиты не сохраняются (`missingCases`).
 */
const CASES: Array<[source: keyof Company, target: keyof Company]> = [
  ['directorName', 'directorNameGenitive'],
  ['directorTitle', 'directorTitleGenitive'],
];

/** Одна правка карточки: какой она была до правки и что в ней уже поправили руками. */
export interface EditSession {
  original: Company;
  edited: ReadonlySet<string>;
}

/**
 * Правка карточки компании с переводами.
 *
 * Поменялось поле-источник – переводы от него пересобираются, если в них
 * пусто или стоит то, что правило дало из прежнего значения. Руководитель и
 * его должность – по правилу `FOLLOWING` и `CASES`; вернули источник как был
 * до правки – зависимое тоже возвращается прежним.
 */
export function withCompanyTranslations(
  draft: Company,
  patch: Partial<Company>,
  session: EditSession = { original: draft, edited: new Set() },
): Company {
  const next: Company = { ...draft, ...patch };

  for (const [source, target, rule] of DERIVED) {
    if (!(source in patch)) continue;

    const before = String(draft[source] ?? '');
    const after = String(next[source] ?? '');
    const current = draft[target];

    if (current === undefined || current === '' || current === rule(before)) {
      Object.assign(next, { [target]: rule(after) });
    }
  }

  const { original, edited } = session;
  const follow = (source: keyof Company, target: keyof Company, derived: (after: string) => string) => {
    if (!(source in patch) || edited.has(target)) return;
    const after = String(next[source] ?? '');
    const value = after === String(original[source] ?? '') ? original[target] : derived(after);
    Object.assign(next, { [target]: value });
  };
  for (const [source, target, rule] of FOLLOWING) follow(source, target, rule);
  for (const [source, target] of CASES) follow(source, target, () => '');

  return next;
}

/**
 * Падежи, которые надо вписать перед сохранением: ФИО или должность
 * руководителя сменили, а родительный падеж пуст.
 */
export function missingCases(original: Company, draft: Company): Array<keyof Company> {
  return CASES.filter(
    ([source, target]) =>
      String(draft[source] ?? '').trim() !== String(original[source] ?? '').trim() &&
      String(draft[target] ?? '').trim() === '',
  ).map(([, target]) => target);
}
