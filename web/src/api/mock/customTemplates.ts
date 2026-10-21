/**
 * Шаблоны из конструктора: как текст человека становится листом.
 *
 * «Тест день 3»: «новая кнопка, чтобы можно было создать новый шаблон».
 * Человек пишет текст так, как видит документ: абзац на строку, поле – его
 * названием в фигурных скобках, реквизит компании – тоже словом:
 *
 *     Принять {Работник|падеж} на должность {Должность} с {Дата приёма}.
 *     **Основание:** заявление работника.
 *
 * Здесь этот текст превращается в тот же шаблон, что у документов каталога:
 * тот же бланк группы, та же подпись, те же поля формы. Отдельной вёрстки у
 * шаблона из конструктора нет – бланк один на все документы.
 *
 * Непонятное название в скобках не пропадает, а остаётся на листе как есть:
 * человек сразу видит, что поле не нашлось.
 */
import { ORDER_WORDS, documentBody } from './blank';

import type {
  CustomTemplate,
  DocBlock,
  DocLang,
  DocumentTemplate,
  FieldDef,
  Para,
  Run,
  TemplateField,
  TriRow,
} from '@/api/types';

/** Серии номеров из catalog/series.yaml, из которых выбирает конструктор. */
export const SERIES: ReadonlyArray<{ id: string; title: string }> = [
  { id: 'К', title: 'Приказы по личному составу' },
  { id: 'ОД', title: 'Приказы по основной деятельности' },
  { id: 'ТД', title: 'Трудовые договоры' },
  { id: 'Д', title: 'Договоры с контрагентами' },
  { id: 'Дов', title: 'Доверенности' },
  { id: 'Исх', title: 'Исходящая корреспонденция' },
  { id: 'Вх', title: 'Входящая корреспонденция' },
  { id: 'Фин', title: 'Финансовые документы' },
  { id: 'Зак', title: 'Закупочные документы' },
  { id: 'Скл', title: 'Складские документы' },
];

/** Заголовок нового шаблона по умолчанию – как у приказа. */
export const DEFAULT_HEADING = { ...ORDER_WORDS };

/** Группа полей на форме: у шаблона из конструктора она одна. */
export const CUSTOM_GROUP = 'Поля документа';

type CompanyRef = { field: string; fallback?: string };

/**
 * Реквизиты компании, которые вставляются в текст словом. Слово принимается
 * по-русски и по-английски – каким бы ни был язык интерфейса у того, кто
 * пишет шаблон. В каждой колонке реквизит берётся на её языке, а если его
 * нет – русский, как во всех шаблонах каталога.
 */
export const COMPANY_PLACEHOLDERS: ReadonlyArray<{
  ru: string;
  en: string;
  refs: Record<DocLang, CompanyRef>;
}> = [
  {
    ru: 'Компания',
    en: 'Company',
    refs: {
      kk: { field: '@company.legalNameKk', fallback: '@company.legalName' },
      ru: { field: '@company.legalName' },
      en: { field: '@company.legalNameEn', fallback: '@company.legalName' },
    },
  },
  {
    ru: 'БИН',
    en: 'BIN',
    refs: {
      kk: { field: '@company.bin' },
      ru: { field: '@company.bin' },
      en: { field: '@company.bin' },
    },
  },
  {
    ru: 'Адрес компании',
    en: 'Company address',
    refs: {
      kk: { field: '@company.address' },
      ru: { field: '@company.address' },
      en: { field: '@company.addressEn', fallback: '@company.address' },
    },
  },
  {
    ru: 'Руководитель',
    en: 'Director',
    refs: {
      kk: { field: '@company.directorName' },
      ru: { field: '@company.directorName' },
      en: { field: '@company.directorNameEn', fallback: '@company.directorName' },
    },
  },
  {
    ru: 'Должность руководителя',
    en: 'Director title',
    refs: {
      kk: { field: '@company.directorTitleKk', fallback: '@company.directorTitle' },
      ru: { field: '@company.directorTitle' },
      en: { field: '@company.directorTitleEn', fallback: '@company.directorTitle' },
    },
  },
  {
    ru: 'Город',
    en: 'City',
    refs: {
      kk: { field: '@company.cityKk', fallback: '@company.city' },
      ru: { field: '@company.city' },
      en: { field: '@company.cityEn', fallback: '@company.city' },
    },
  },
];

/**
 * Слово после черты, которое просит ФИО работника в форме приказа, а не в
 * именительном падеже: «принять Ахметова Асхата», «Ахметовке демалыс беру».
 */
const CASE_WORDS = ['падеж', 'case', 'септік'];

const key = (text: string) => text.trim().toLocaleLowerCase('ru');

/** Поле или реквизит по слову в скобках; `null` – такого нет. */
function resolveToken(token: string, fields: TemplateField[], lang: DocLang): Run | null {
  const [rawName = '', modifier = ''] = token.split('|');
  const name = key(rawName);

  const company = COMPANY_PLACEHOLDERS.find((c) => key(c.ru) === name || key(c.en) === name);
  if (company !== undefined) {
    const ref = company.refs[lang];
    return ref.fallback === undefined ? { field: ref.field } : { field: ref.field, fallback: ref.fallback };
  }

  const field = fields.find((f) => key(f.label) === name);
  if (field === undefined) return null;

  if (field.kind === 'employee') {
    return CASE_WORDS.includes(key(modifier)) ? { field: field.id } : { field: `${field.id}:nom` };
  }
  return { field: field.id };
}

const MARKUP = /\{([^{}]+)\}|\*\*([^*]+)\*\*/gu;

/** Строка текста – абзац листа. */
export function parseLine(line: string, fields: TemplateField[], lang: DocLang): Para {
  const runs: Run[] = [];
  let last = 0;

  for (const match of line.matchAll(MARKUP)) {
    const index = match.index;
    if (index > last) runs.push({ text: line.slice(last, index) });

    const [whole, token, bold] = match;
    if (bold !== undefined) {
      runs.push({ text: bold, bold: true });
    } else if (token !== undefined) {
      runs.push(resolveToken(token, fields, lang) ?? { text: whole });
    }
    last = index + whole.length;
  }

  if (last < line.length) runs.push({ text: line.slice(last) });
  return runs;
}

/** Абзацы текста одного языка: строка – абзац, пустые строки не в счёт. */
function linesOf(text: string | undefined): string[] {
  return (text ?? '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

function fieldDef(field: TemplateField, multilingual: boolean): FieldDef {
  return {
    id: field.id,
    kind: field.kind,
    label: field.label,
    group: CUSTOM_GROUP,
    required: field.required,
    ...(field.kind === 'select' ? { options: field.options ?? [] } : {}),
    ...(field.kind === 'money' ? { unit: '₸' } : {}),
    // Имя работника в каждой колонке – на её языке и в её падеже, как в
    // шаблонах каталога; остальное – по отметке в конструкторе.
    ...(multilingual && (field.kind === 'employee' || field.perLang === true) ? { perLang: true } : {}),
  };
}

/**
 * Шаблон листа из шаблона конструктора.
 *
 * Строки таблицы идут вровень по номеру абзаца: первый абзац казахского
 * текста стоит рядом с первым русским. Текст помечен как не проверенный
 * юристом (CLAUDE.md, п. 4.9) и как шаблон компании.
 */
export function toDocumentTemplate(custom: CustomTemplate): DocumentTemplate {
  const langs = custom.langs.length === 0 ? (['ru'] as DocLang[]) : custom.langs;
  const lines = Object.fromEntries(langs.map((lang) => [lang, linesOf(custom.body[lang])])) as Record<
    DocLang,
    string[]
  >;
  const count = Math.max(0, ...langs.map((lang) => lines[lang].length));

  const rows: TriRow[] = [];
  for (let i = 0; i < count; i += 1) {
    const row: TriRow = {};
    for (const lang of langs) {
      const line = lines[lang][i];
      row[lang] = line === undefined ? [] : [parseLine(line, custom.fields, lang)];
    }
    rows.push(row);
  }

  const body: DocBlock[] = [
    ...documentBody({ words: custom.heading, body: rows }),
    ...(custom.acquaint ? [{ kind: 'tri-acquaint' } as DocBlock] : []),
  ];

  const titleEn = custom.titleEn?.trim() ?? '';
  return {
    id: custom.id,
    title: custom.title,
    ...(titleEn === '' ? {} : { titleEn }),
    sectionId: custom.sectionId,
    subsectionId: custom.subsectionId,
    series: custom.series,
    profile: 'standard',
    purpose: custom.purpose,
    reviewed: false,
    custom: true,
    layout: 'order',
    langs,
    fields: custom.fields.map((field) => fieldDef(field, langs.length > 1)),
    body,
  };
}

/** Идентификатор нового поля: не зависит от названия, переименование его не ломает. */
export function nextFieldId(fields: TemplateField[]): string {
  let n = fields.length + 1;
  while (fields.some((f) => f.id === `f${n}`)) n += 1;
  return `f${n}`;
}

/**
 * Переименование поля переписывает его название и в тексте: иначе поле
 * выпало бы из документа, а в листе остались бы скобки со старым словом.
 */
export function renameInBody(
  body: CustomTemplate['body'],
  from: string,
  to: string,
): CustomTemplate['body'] {
  if (from.trim() === '' || from === to) return body;
  const pattern = new RegExp(`\\{\\s*${escapeRegExp(from.trim())}\\s*(\\|[^{}]*)?\\}`, 'giu');
  const next: CustomTemplate['body'] = {};
  for (const [lang, text] of Object.entries(body) as Array<[DocLang, string | undefined]>) {
    if (text !== undefined) next[lang] = text.replace(pattern, (_m, mod: string | undefined) => `{${to}${mod ?? ''}}`);
  }
  return next;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** Что не так с шаблоном; пустой список – можно сохранять. */
export type TemplateProblem =
  | 'title'
  | 'section'
  | 'heading'
  | 'langs'
  | 'body'
  | 'field-label'
  | 'field-duplicate'
  | 'field-options';

export function checkTemplate(custom: CustomTemplate): TemplateProblem[] {
  const problems: TemplateProblem[] = [];
  if (custom.title.trim() === '') problems.push('title');
  if (custom.sectionId === '' || custom.subsectionId === '') problems.push('section');
  if (Object.values(custom.heading).some((word) => word.trim() === '')) problems.push('heading');
  if (custom.langs.length === 0) problems.push('langs');
  if (custom.langs.some((lang) => linesOf(custom.body[lang]).length === 0)) problems.push('body');
  if (custom.fields.some((f) => f.label.trim() === '')) problems.push('field-label');
  const labels = custom.fields.map((f) => key(f.label));
  const reserved = COMPANY_PLACEHOLDERS.flatMap((c) => [key(c.ru), key(c.en)]);
  if (new Set(labels).size !== labels.length || labels.some((l) => reserved.includes(l))) {
    problems.push('field-duplicate');
  }
  if (custom.fields.some((f) => f.kind === 'select' && (f.options ?? []).filter((o) => o.trim() !== '').length < 2)) {
    problems.push('field-options');
  }
  return problems;
}
