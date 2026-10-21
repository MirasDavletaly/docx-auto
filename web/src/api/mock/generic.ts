/**
 * Типовые шаблоны: построители по видам документов.
 *
 * Для этих документов образца от компании нет. По просьбе человека («Тест
 * день 2») они собраны по распространённым образцам и поставлены на тот же
 * бланк группы: шапка, город и дата, заголовок с номером, тело в три
 * колонки, подпись. Каждый помечен `generic: true` – интерфейс называет его
 * неконкретным – и `reviewed: false`: текст черновой, пока его не проверит
 * юрист (CLAUDE.md, п. 4.9). Ссылок на статьи законов в них нет нарочно.
 *
 * Вид документа задаёт порядок частей, а шаблон приносит только текст.
 * Текст пишется строками с разметкой: `{поле}` – подстановка, `{поле|запасное}`
 * – подстановка с запасным полем, `{*поле}` – подстановка полужирным,
 * `**текст**` – полужирный текст.
 */
import { documentBody } from '@/api/mock/blank';

import type {
  BiRow,
  DocBlock,
  DocumentTemplate,
  FieldDef,
  Para,
  Run,
  TriRow,
  TriText,
} from '@/api/types';

/** Одна мысль на трёх языках: казахский, русский, английский. */
export type Tri = readonly [kk: string, ru: string, en: string];

const MARKUP = /\{(\*?)([^}|]+)(?:\|([^}]+))?\}|\*\*([^*]+)\*\*/gu;

/** Абзац из строки с разметкой. */
export function p(source: string): Para {
  const runs: Run[] = [];
  let last = 0;

  for (const match of source.matchAll(MARKUP)) {
    const index = match.index;
    if (index > last) runs.push({ text: source.slice(last, index) });

    const [, star, field, fallback, bold] = match;
    if (bold !== undefined) {
      runs.push({ text: bold, bold: true });
    } else if (field !== undefined) {
      runs.push({
        field,
        ...(fallback === undefined ? {} : { fallback }),
        ...(star === '*' ? { bold: true } : {}),
      });
    }
    last = index + match[0].length;
  }

  if (last < source.length) runs.push({ text: source.slice(last) });
  return runs;
}

/** Строка таблицы: по абзацу на каждый язык, или несколько абзацев подряд. */
export function row(...paras: Tri[]): TriRow {
  return {
    kk: paras.map((para) => p(para[0])),
    ru: paras.map((para) => p(para[1])),
    en: paras.map((para) => p(para[2])),
  };
}

/** Пункты с номерами: каждый пункт – своя строка, чтобы языки шли вровень. */
export function numbered(clauses: readonly Tri[], start = 1): TriRow[] {
  return clauses.map((clause, i) =>
    row([
      `${start + i}. ${clause[0]}`,
      `${start + i}. ${clause[1]}`,
      `${start + i}. ${clause[2]}`,
    ]),
  );
}

/** Заголовок раздела внутри документа – полужирным. */
export function heading(title: Tri): TriRow {
  return row([`**${title[0]}**`, `**${title[1]}**`, `**${title[2]}**`]);
}

function tri(words: Tri): TriText {
  return { kk: words[0], ru: words[1], en: words[2] };
}

/* ── Реквизиты компании в тексте ─────────────────────────────────────── */

export const COMPANY: Tri = [
  '{@company.legalNameKk|@company.legalName}',
  '{@company.legalName}',
  '{@company.legalNameEn|@company.legalName}',
];

/** «в лице Генерального директора Ихсановой С.Т., действующего на основании Устава». */
const REPRESENTED: Tri = [
  '{@company.directorTitleKk|@company.directorTitle} {@company.directorName} атынан',
  'в лице {@company.directorTitleGenitive} {@company.directorNameGenitive}, действующего на основании {@company.directorBasis}',
  'represented by {@company.directorTitleEn|@company.directorTitle} {@company.directorNameEn|@company.directorName}',
];

/* ── Поля ─────────────────────────────────────────────────────────────── */

type Extra = Partial<Omit<FieldDef, 'id' | 'kind' | 'label' | 'group'>>;

export const field = {
  text: (id: string, label: string, group: string, extra: Extra = {}): FieldDef => ({
    id,
    kind: 'text',
    label,
    group,
    required: true,
    ...extra,
  }),
  /** Текст, который в каждой колонке пишется на своём языке. */
  tri: (id: string, label: string, group: string, extra: Extra = {}): FieldDef => ({
    id,
    kind: 'text',
    label,
    group,
    required: true,
    perLang: true,
    ...extra,
  }),
  area: (id: string, label: string, group: string, extra: Extra = {}): FieldDef => ({
    id,
    kind: 'textarea',
    label,
    group,
    required: true,
    perLang: true,
    ...extra,
  }),
  date: (id: string, label: string, group: string, extra: Extra = {}): FieldDef => ({
    id,
    kind: 'date',
    label,
    group,
    required: true,
    ...extra,
  }),
  money: (id: string, label: string, group: string, extra: Extra = {}): FieldDef => ({
    id,
    kind: 'money',
    label,
    group,
    required: true,
    unit: '₸',
    ...extra,
  }),
  number: (id: string, label: string, group: string, extra: Extra = {}): FieldDef => ({
    id,
    kind: 'number',
    label,
    group,
    required: true,
    ...extra,
  }),
  employee: (id: string, label: string, group: string, extra: Extra = {}): FieldDef => ({
    id,
    kind: 'employee',
    label,
    group,
    required: true,
    perLang: true,
    ...extra,
  }),
  counterparty: (group = 'Стороны'): FieldDef => ({
    id: 'counterparty',
    kind: 'counterparty',
    label: 'Контрагент',
    group,
    required: true,
    hint: 'Выберите из справочника или впишите наименование',
  }),
};

/**
 * Сумма прописью – на каждом языке своя. Считается из поля суммы: по
 * умолчанию из поля с тем же именем без «Words» («salaryWords» – из «salary»).
 */
export function amountWords(
  id = 'amountWords',
  group = 'Сумма',
  source = id.replace(/Words$/u, ''),
): FieldDef {
  return field.tri(id, 'Сумма прописью', group, {
    hint: 'Считается из суммы, можно поправить',
    wordsOf: source,
  });
}

/* ── Общее для всех типовых шаблонов ─────────────────────────────────── */

interface Common {
  id: string;
  title: string;
  sectionId: string;
  subsectionId: string;
  series: string;
  profile?: DocumentTemplate['profile'];
  purpose: string;
  /** Заголовок на бланке: «ШАРТ / ДОГОВОР / CONTRACT». */
  words: Tri;
  fields: FieldDef[];
}

function template(common: Common, body: DocBlock[]): DocumentTemplate {
  return {
    id: common.id,
    title: common.title,
    sectionId: common.sectionId,
    subsectionId: common.subsectionId,
    series: common.series,
    profile: common.profile ?? 'standard',
    purpose: common.purpose,
    reviewed: false,
    generic: true,
    layout: 'order',
    langs: ['kk', 'ru', 'en'],
    fields: common.fields,
    body,
  };
}

/* ── Договор с контрагентом ──────────────────────────────────────────── */

interface ContractSpec extends Common {
  /** Как называются стороны: компания и контрагент. */
  roles: { company: Tri; other: Tri };
  clauses: readonly Tri[];
  /**
   * Заключительные пункты вместо общих «срок, споры, экземпляры». Нужны там,
   * где документ – не договор, а соглашение к нему: у него нет своего срока.
   */
  end?: readonly Tri[];
}

const COUNTERPARTY_FIELDS: FieldDef[] = [
  field.counterparty(),
  field.text('counterpartyBin', 'БИН контрагента', 'Стороны', {
    hint: 'Двенадцать цифр',
  }),
  field.tri('counterpartySigner', 'Подписант контрагента', 'Стороны', {
    hint: 'Должность и ФИО в том виде, как они стоят в договоре',
  }),
];

const CONTRACT_END: readonly Tri[] = [
  [
    'Шарт Тараптар қол қойған күннен бастап күшіне енеді және {validUntil} дейін қолданылады.',
    'Договор вступает в силу с даты подписания Сторонами и действует до {validUntil}.',
    'The contract enters into force on the date of signing by the Parties and remains in effect until {validUntil}.',
  ],
  [
    'Даулар келіссөздер арқылы, ал келісімге қол жеткізілмесе, Қазақстан Республикасының заңнамасына сәйкес сот тәртібімен шешіледі.',
    'Споры разрешаются путём переговоров, а при недостижении согласия – в судебном порядке по законодательству Республики Казахстан.',
    'Disputes are settled by negotiation and, failing agreement, in court under the legislation of the Republic of Kazakhstan.',
  ],
  [
    'Шарт қазақ, орыс және ағылшын тілдерінде бірдей заңды күші бар екі данада жасалды, әр Тарапқа бір данадан.',
    'Договор составлен на казахском, русском и английском языках в двух экземплярах равной юридической силы, по одному для каждой Стороны.',
    'The contract is made in Kazakh, Russian and English in two counterparts of equal legal force, one for each Party.',
  ],
];

export function contract(spec: ContractSpec): DocumentTemplate {
  const { company, other } = spec.roles;

  const preamble = row([
    `${COMPANY[0]}, бұдан әрі «${company[0]}» деп аталатын, ${REPRESENTED[0]}, бір тараптан, және {counterparty}, бұдан әрі «${other[0]}» деп аталатын, {counterpartySigner} атынан, екінші тараптан, бірлесіп «Тараптар» деп аталатындар, төмендегілер туралы осы шартты жасасты:`,
    `${COMPANY[1]}, именуемое в дальнейшем «${company[1]}», ${REPRESENTED[1]}, с одной стороны, и {counterparty}, именуемое в дальнейшем «${other[1]}», в лице {counterpartySigner}, с другой стороны, совместно именуемые «Стороны», заключили настоящий договор о нижеследующем:`,
    `${COMPANY[2]}, hereinafter the “${company[2]}”, ${REPRESENTED[2]}, on the one part, and {counterparty}, hereinafter the “${other[2]}”, represented by {counterpartySigner}, on the other part, together the “Parties”, have concluded this contract as follows:`,
  ]);

  const details = row([
    `**Тараптардың деректемелері:** ${COMPANY[0]}, БСН {@company.bin}, {@company.address}. {counterparty}, БСН {counterpartyBin}.`,
    `**Реквизиты сторон:** ${COMPANY[1]}, БИН {@company.bin}, {@company.address}. {counterparty}, БИН {counterpartyBin}.`,
    `**Details of the parties:** ${COMPANY[2]}, BIN {@company.bin}, {@company.addressEn|@company.address}. {counterparty}, BIN {counterpartyBin}.`,
  ]);

  const otherSigns = row([
    `**${other[0]}:** ________________ {counterpartySigner}`,
    `**${other[1]}:** ________________ {counterpartySigner}`,
    `**${other[2]}:** ________________ {counterpartySigner}`,
  ]);

  return template(
    {
      ...spec,
      fields: [
        ...COUNTERPARTY_FIELDS,
        ...spec.fields,
        // Дата «до» пишется цифрами: прописью в казахском была бы форма
        // «…ындағы», а перед «дейін» она неграмотна.
        ...(spec.end === undefined
          ? [
              field.date('validUntil', 'Действует до', 'Срок договора', {
                dateLimits: { notBefore: 'today' },
              }),
            ]
          : []),
      ],
    },
    documentBody({
      words: tri(spec.words),
      body: [
        preamble,
        ...numbered([...spec.clauses, ...(spec.end ?? CONTRACT_END)]),
        details,
        otherSigns,
      ],
      caption: tri(company),
    }),
  );
}

/* ── Договор или соглашение с работником ─────────────────────────────── */

interface LabourSpec extends Common {
  clauses: readonly Tri[];
}

export function labourAgreement(spec: LabourSpec): DocumentTemplate {
  const preamble = row([
    `${COMPANY[0]}, бұдан әрі «Жұмыс беруші» деп аталатын, ${REPRESENTED[0]}, бір тараптан, және {employee:nom}, бұдан әрі «Қызметкер» деп аталатын, екінші тараптан, төмендегілер туралы келісті:`,
    `${COMPANY[1]}, именуемое в дальнейшем «Работодатель», ${REPRESENTED[1]}, с одной стороны, и {employee:nom}, именуемый(ая) в дальнейшем «Работник», с другой стороны, договорились о нижеследующем:`,
    `${COMPANY[2]}, hereinafter the “Employer”, ${REPRESENTED[2]}, on the one part, and {employee:nom}, hereinafter the “Employee”, on the other part, have agreed as follows:`,
  ]);

  const employeeSigns = row([
    '**Қызметкер:** ________________ {employee:nom}, ЖСН {iin}',
    '**Работник:** ________________ {employee:nom}, ИИН {iin}',
    '**Employee:** ________________ {employee:nom}, IIN {iin}',
  ]);

  return template(
    {
      ...spec,
      fields: [
        field.employee('employee', 'Работник', 'Работник'),
        field.text('iin', 'ИИН', 'Работник', { hint: 'Двенадцать цифр' }),
        ...spec.fields,
      ],
    },
    documentBody({
      words: tri(spec.words),
      body: [preamble, ...numbered(spec.clauses), employeeSigns],
    }),
  );
}

/* ── Заявка, служебная записка ───────────────────────────────────────── */

interface RequestSpec extends Common {
  clauses: readonly Tri[];
}

const APPROVED: Tri = ['Келісілді', 'Согласовано', 'Approved'];

/** Строки над подписью руководителя. */
export const CAPTION = {
  approve: ['Бекітемін', 'Утверждаю', 'Approved'] as Tri,
  accept: ['Орындауға қабылдадым', 'Принято к исполнению', 'Accepted for execution'] as Tri,
  acknowledge: ['Таныстым', 'Ознакомлен', 'Acknowledged'] as Tri,
  company: ['Компания атынан', 'От Компании', 'For the Company'] as Tri,
  departure: ['Шығуға рұқсат етемін', 'Выезд разрешаю', 'Departure authorised'] as Tri,
  permit: ['Жұмысқа рұқсат беремін', 'Допуск разрешаю', 'Work authorised'] as Tri,
};

export function request(spec: RequestSpec): DocumentTemplate {
  const applicant = row([
    '**Өтініш беруші:** {employee:nom}, {position}',
    '**Заявитель:** {employee:nom}, {position}',
    '**Applicant:** {employee:nom}, {position}',
  ]);
  const signs = row([
    'Өтініш беруші: ________________ {employee:nom}',
    'Заявитель: ________________ {employee:nom}',
    'Applicant: ________________ {employee:nom}',
  ]);

  return template(
    {
      ...spec,
      profile: spec.profile ?? 'self-service',
      fields: [
        field.employee('employee', 'Заявитель', 'Заявитель'),
        field.tri('position', 'Должность', 'Заявитель'),
        ...spec.fields,
      ],
    },
    documentBody({
      words: tri(spec.words),
      body: [applicant, ...numbered(spec.clauses), signs],
      caption: tri(APPROVED),
    }),
  );
}

/* ── Акт ─────────────────────────────────────────────────────────────── */

interface ActSpec extends Common {
  /** «Мы, нижеподписавшиеся, …» – кто составил акт. */
  preamble: Tri;
  clauses: readonly Tri[];
  /** Подпись второй стороны или членов комиссии: по строке на подписанта. */
  signs: readonly Tri[];
  caption?: Tri | null;
}

export function act(spec: ActSpec): DocumentTemplate {
  return template(
    spec,
    documentBody({
      words: tri(spec.words),
      body: [row(spec.preamble), ...numbered(spec.clauses), row(...spec.signs)],
      caption: spec.caption === undefined || spec.caption === null ? null : tri(spec.caption),
    }),
  );
}

/* ── Письмо ──────────────────────────────────────────────────────────── */

interface LetterSpec extends Common {
  /** Тема письма – полужирным под адресатом. */
  subject: Tri;
  clauses: readonly Tri[];
  /** Пункты без номеров: письмо, а не договор. */
  plain?: boolean;
}

export function letter(spec: LetterSpec): DocumentTemplate {
  const addressee = row([
    '**Кімге:** {counterparty}',
    '**Кому:** {counterparty}',
    '**To:** {counterparty}',
  ]);
  const body = spec.plain === true ? spec.clauses.map((c) => row(c)) : numbered(spec.clauses);

  return template(
    {
      ...spec,
      fields: [field.counterparty('Адресат'), ...spec.fields],
    },
    documentBody({
      words: tri(spec.words),
      body: [addressee, heading(spec.subject), ...body],
      caption: null,
    }),
  );
}

/* ── Положение, правила, инструкция, политика ────────────────────────── */

interface PolicySpec extends Common {
  sections: ReadonlyArray<{ title: Tri; clauses: readonly Tri[] }>;
}

export function policy(spec: PolicySpec): DocumentTemplate {
  const approval = row([
    '**БЕКІТІЛДІ** {approvalDate} № {approvalOrder} бұйрығымен',
    '**УТВЕРЖДЕНО** приказом от {approvalDate} № {approvalOrder}',
    '**APPROVED** by order No. {approvalOrder} dated {approvalDate}',
  ]);

  const rows: TriRow[] = [approval];
  spec.sections.forEach((section, index) => {
    rows.push(
      heading([
        `${index + 1}. ${section.title[0]}`,
        `${index + 1}. ${section.title[1]}`,
        `${index + 1}. ${section.title[2]}`,
      ]),
    );
    rows.push(
      ...section.clauses.map((clause, i) =>
        row([
          `${index + 1}.${i + 1}. ${clause[0]}`,
          `${index + 1}.${i + 1}. ${clause[1]}`,
          `${index + 1}.${i + 1}. ${clause[2]}`,
        ]),
      ),
    );
  });

  return template(
    {
      ...spec,
      profile: spec.profile ?? 'policy',
      fields: [
        field.text('approvalOrder', 'Номер приказа об утверждении', 'Утверждение'),
        field.date('approvalDate', 'Дата приказа об утверждении', 'Утверждение', {
          dateLimits: { notAfter: 'today' },
        }),
        ...spec.fields,
      ],
    },
    documentBody({ words: tri(spec.words), body: rows, caption: null }),
  );
}

/* ── Протокол, решение ───────────────────────────────────────────────── */

interface MinutesSpec extends Common {
  /** Кто присутствовал / кто принимает решение. */
  intro: readonly Tri[];
  clauses: readonly Tri[];
  signs: readonly Tri[];
  caption?: Tri | null;
}

export function minutes(spec: MinutesSpec): DocumentTemplate {
  return template(
    spec,
    documentBody({
      words: tri(spec.words),
      body: [...spec.intro.map((line) => row(line)), ...numbered(spec.clauses), row(...spec.signs)],
      caption: spec.caption === undefined || spec.caption === null ? null : tri(spec.caption),
    }),
  );
}

/* ── Документ с перечнем позиций: счёт, накладная, отчёт ─────────────── */

interface ListSpec extends Common {
  intro: readonly Tri[];
  /** Перечень позиций и итоговые строки. */
  clauses: readonly Tri[];
  signs?: readonly Tri[];
  caption?: Tri | null;
}

export function listDocument(spec: ListSpec): DocumentTemplate {
  return template(
    spec,
    documentBody({
      words: tri(spec.words),
      body: [
        ...spec.intro.map((line) => row(line)),
        ...spec.clauses.map((line) => row(line)),
        ...(spec.signs === undefined ? [] : [row(...spec.signs)]),
      ],
      caption: spec.caption === undefined || spec.caption === null ? null : tri(spec.caption),
    }),
  );
}

/* ── Доверенность на получение ТМЦ: бланк доверенности ───────────────── */

interface PoaSpec extends Omit<Common, 'words'> {
  words: { ru: string; en: string };
  rows: ReadonlyArray<readonly [ru: string, en: string]>;
}

export function goodsPowerOfAttorney(spec: PoaSpec): DocumentTemplate {
  const rows: BiRow[] = spec.rows.map(([ru, en]) => ({ ru: [p(ru)], en: [p(en)] }));
  return {
    id: spec.id,
    title: spec.title,
    sectionId: spec.sectionId,
    subsectionId: spec.subsectionId,
    series: spec.series,
    profile: spec.profile ?? 'standard',
    purpose: spec.purpose,
    reviewed: false,
    generic: true,
    layout: 'poa',
    langs: ['ru', 'en'],
    fields: spec.fields,
    body: [
      { kind: 'letterhead' },
      { kind: 'poa-title', words: spec.words },
      { kind: 'bi-table', rows },
      { kind: 'poa-signature' },
    ],
  };
}
