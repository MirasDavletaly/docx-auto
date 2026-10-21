/**
 * Перевод значения поля в казахскую и английскую колонку документа.
 *
 * «Тест день 4»: город, подразделение, организация, «кем выдано» – по-русски
 * во всех трёх колонках, «а надо, чтобы автоматом на три языка и по местам
 * поставил». Что переводится и как, решает поле (`FieldDef.translate`):
 *
 *  - `dictionary` – словарь должностей и подразделений (`jobTitles.ts`) и
 *    частые обороты («по месту требования»);
 *  - `place` – город: словарь городов Казахстана, иначе латиницей;
 *  - `organization` – «ТОО «X»» → «X» ЖШС / X LLP, «АО» → АҚ / JSC,
 *    «ИП» → ЖК / IE; имя собственное латиницей;
 *  - `issuer` – кто выдал удостоверение: «МВД РК», «МЮ РК»;
 *  - `address` – адрес на английском по частям (`address.ts`).
 *
 * Нет перевода – `undefined`: в колонку идёт то, что человек впишет сам,
 * а пустое заменяется русским. Правила – docs/translation-rules.md.
 */
import { englishAddress } from './address';
import { cityEn, cityKk } from './companyTranslations';
import { translateJobTitle } from './jobTitles';
import { transliterate } from './names';

export type TranslateMode = 'dictionary' | 'place' | 'organization' | 'issuer' | 'address';

type Lang = 'kk' | 'en';

/** Формы собственности: сокращение по-русски → по-казахски и по-английски. */
const LEGAL_FORMS: Array<{ ru: RegExp; kk: string; en: string }> = [
  { ru: /^ТОО\s+(.+)$/u, kk: 'ЖШС', en: 'LLP' },
  { ru: /^АО\s+(.+)$/u, kk: 'АҚ', en: 'JSC' },
  { ru: /^ИП\s+(.+)$/u, kk: 'ЖК', en: 'IE' },
];

/** «ТОО «Тұлпар Сервис»» → «Тұлпар Сервис» ЖШС / Tulpar Servis LLP. */
export function organizationName(ru: string, lang: Lang): string | undefined {
  const text = ru.trim();
  if (text === '') return undefined;

  for (const form of LEGAL_FORMS) {
    const name = text.match(form.ru)?.[1];
    if (name === undefined) continue;
    // По-казахски форма стоит после наименования, как в реквизитах: «X» ЖШС.
    // По-английски – без кавычек, латиницей: X LLP. ИП – перед именем.
    if (form.en === 'IE') return lang === 'kk' ? `ЖК ${name}` : `IE ${transliterate(name)}`;
    const bare = name.replace(/[«»"]/gu, '').trim();
    return lang === 'kk' ? `«${bare}» ${form.kk}` : `${transliterate(bare)} ${form.en}`;
  }

  // Без формы собственности – имя собственное: по-казахски как есть,
  // по-английски латиницей.
  return lang === 'en' ? transliterate(text) : undefined;
}

/** Кто выдал удостоверение личности: так пишут в удостоверениях РК. */
const ISSUERS: Record<string, { kk: string; en: string }> = {
  'мвд рк': { kk: 'ҚР ІІМ', en: 'Ministry of Internal Affairs of the Republic of Kazakhstan' },
  'мвд республики казахстан': {
    kk: 'Қазақстан Республикасының Ішкі істер министрлігі',
    en: 'Ministry of Internal Affairs of the Republic of Kazakhstan',
  },
  'мю рк': { kk: 'ҚР ӘМ', en: 'Ministry of Justice of the Republic of Kazakhstan' },
  'министерство юстиции республики казахстан': {
    kk: 'Қазақстан Республикасының Әділет министрлігі',
    en: 'Ministry of Justice of the Republic of Kazakhstan',
  },
};

/**
 * Частые обороты, которые не должность и не город: «Куда предъявляется» в
 * справке с места работы. Перевод – на проверку носителю языка.
 */
const PHRASES: Record<string, { kk: string; en: string }> = {
  'по месту требования': { kk: 'талап етілетін жерге', en: 'to whom it may concern' },
  'в банк': { kk: 'банкке', en: 'to the bank' },
  'в посольство': { kk: 'елшілікке', en: 'to the embassy' },
  'в налоговый орган': { kk: 'салық органына', en: 'to the tax authority' },
};

function issuerName(ru: string, lang: Lang): string | undefined {
  const key = ru.trim().toLocaleLowerCase('ru').replace(/\./gu, '').replace(/\s+/gu, ' ');
  return ISSUERS[key]?.[lang];
}

export function autoTranslate(mode: TranslateMode, ru: string, lang: Lang): string | undefined {
  if (ru.trim() === '') return undefined;
  switch (mode) {
    case 'place':
      return lang === 'kk' ? cityKk(ru) || undefined : cityEn(ru);
    case 'organization':
      return organizationName(ru, lang);
    case 'issuer':
      return issuerName(ru, lang);
    case 'address':
      return lang === 'en' ? englishAddress(ru) : undefined;
    case 'dictionary':
    default:
      return translateJobTitle(ru, lang) ?? PHRASES[ru.trim().toLocaleLowerCase('ru')]?.[lang];
  }
}
