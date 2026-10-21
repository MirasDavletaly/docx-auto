/**
 * Приказы по основной деятельности.
 *
 * Документы из каталога, для которых образца вы не присылали. Они ложатся на
 * тот же бланк, что и кадровые приказы: шапка, город с датой, «Б Ұ Й Р Ы Қ /
 * ПРИКАЗ / ORDER», тема, распоряжение в три колонки, подпись, лист
 * ознакомления.
 *
 * ТЕКСТ – ЧЕРНОВИК. Формулировки взяты по смыслу из практики делопроизводства
 * и собраны теми же оборотами, что в ваших приказах («бекітілсін»,
 * «тағайындалсын», «Негіздеме:»). Ссылок на статьи закона в них нет: реквизиты
 * норм права не выдумываются (CLAUDE.md, п. 4.9). Все стоят `reviewed: false`,
 * и интерфейс говорит об этом на каждом документе.
 *
 * Что проверить казахоязычному юристу – `docs/legal-review.md`.
 */
import { orderBody } from '@/api/mock/blank';

import type { DocumentTemplate, FieldDef } from '@/api/types';

/** Работник из справочника: имя пишется на каждом языке отдельно. */
function employeeField(label: string, group: string): FieldDef {
  return { id: 'employee', kind: 'employee', label, required: true, group, perLang: true };
}

/** Контроль за исполнением – последний пункт почти любого приказа. */
const CONTROL = {
  kk: 'Бұйрықтың орындалуын бақылауды өзіме қалдырамын.',
  ru: 'Контроль за исполнением настоящего приказа оставляю за собой.',
  en: 'I reserve the control over the execution of this order.',
};

/** «Негіздеме / Основание / Basis» – приложение к самому приказу. */
const ANNEX = {
  kk: 'осы бұйрыққа № 1 қосымша.',
  ru: 'приложение № 1 к настоящему приказу.',
  en: 'Annex No. 1 to this order.',
};

/**
 * Виды документов для приказа о праве подписи («Тест день 4»: «пусть тут
 * будет выборка, где нужно выбрать, и автоматом напишется на трёх языках»).
 * Порядок – как в документе. Перевод – на проверку носителю языка.
 */
const SIGNED_DOCUMENTS: ReadonlyArray<readonly [ru: string, kk: string, en: string]> = [
  ['договоры', 'шарттар', 'contracts'],
  ['дополнительные соглашения', 'қосымша келісімдер', 'supplementary agreements'],
  ['счета на оплату', 'төлемге арналған шоттар', 'invoices for payment'],
  ['счета-фактуры', 'шот-фактуралар', 'VAT invoices'],
  ['акты выполненных работ', 'орындалған жұмыстар актілері', 'certificates of completed works'],
  ['накладные', 'жүкқұжаттар', 'waybills'],
  ['доверенности', 'сенімхаттар', 'powers of attorney'],
  ['платёжные поручения', 'төлем тапсырмалары', 'payment orders'],
  ['исходящие письма', 'шығыс хаттар', 'outgoing letters'],
  ['кадровые документы', 'кадрлық құжаттар', 'HR documents'],
  ['бухгалтерская и налоговая отчётность', 'бухгалтерлік және салықтық есептілік', 'accounting and tax reports'],
];

export const activityOrders: DocumentTemplate[] = [
  /* ═══ Штатное расписание ════════════════════════════════════════════════ */
  {
    id: 'hr-staffing-order',
    title: 'Приказ об утверждении штатного расписания',
    sectionId: 'hr',
    subsectionId: 'hr-activity-orders',
    series: 'ОД',
    profile: 'sensitive',
    purpose: 'Утверждает штатное расписание и вводит его в действие.',
    reviewed: false,
    layout: 'order',
    langs: ['kk', 'ru', 'en'],
    fields: [
      {
        id: 'headcount',
        kind: 'number',
        label: 'Штатных единиц',
        required: true,
        unit: 'ед.',
        group: 'Штатное расписание',
      },
      {
        id: 'payroll',
        kind: 'money',
        label: 'Месячный фонд оплаты труда',
        required: true,
        unit: '₸',
        group: 'Штатное расписание',
      },
      {
        id: 'effectiveDate',
        kind: 'date',
        label: 'Вводится в действие с',
        required: true,
        group: 'Штатное расписание',
        dateLimits: { notBefore: 'today' },
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Штат кестесін бекіту туралы»', bold: true }]],
        ru: [[{ text: '«Об утверждении штатного расписания»', bold: true }]],
        en: [[{ text: '“On approval of the staffing table”', bold: true }]],
      },
      body: {
        kk: [
          [
            { text: '1. ' },
            { field: 'headcount' },
            { text: ' штат бірлігі және айлық еңбекақы қоры ' },
            { field: 'payroll' },
            { text: ' теңге болатын штат кестесі бекітілсін және ' },
            { field: 'effectiveDate' },
            { text: ' бастап қолданысқа енгізілсін.' },
          ],
          [{ text: '2. Кадр бөлімі бөлім басшыларын осы бұйрықпен таныстырсын.' }],
          [{ text: `3. ${CONTROL.kk}` }],
          [{ text: 'Негіздеме: ', bold: true }, { text: ANNEX.kk }],
        ],
        ru: [
          [
            { text: '1. Утвердить штатное расписание в количестве ' },
            { field: 'headcount' },
            { text: ' штатных единиц с месячным фондом оплаты труда ' },
            { field: 'payroll' },
            { text: ' тенге и ввести его в действие с ' },
            { field: 'effectiveDate' },
            { text: '.' },
          ],
          [
            {
              text:
                '2. Отделу кадров ознакомить руководителей подразделений с настоящим ' +
                'приказом.',
            },
          ],
          [{ text: `3. ${CONTROL.ru}` }],
          [{ text: 'Основание: ', bold: true }, { text: ANNEX.ru }],
        ],
        en: [
          [
            { text: '1. To approve the staffing table of ' },
            { field: 'headcount' },
            { text: ' staff units with a monthly payroll of ' },
            { field: 'payroll' },
            { text: ' tenge and to put it into effect from ' },
            { field: 'effectiveDate' },
            { text: '.' },
          ],
          [
            {
              text:
                '2. To HR Department – to acquaint the heads of departments with this order.',
            },
          ],
          [{ text: `3. ${CONTROL.en}` }],
          [{ text: 'Basis: ', bold: true }, { text: ANNEX.en }],
        ],
      },
    }),
  },

  /* ═══ График отпусков ═══════════════════════════════════════════════════ */
  {
    id: 'hr-vacation-schedule-order',
    title: 'Приказ об утверждении графика отпусков',
    sectionId: 'hr',
    subsectionId: 'hr-activity-orders',
    series: 'ОД',
    profile: 'standard',
    purpose: 'Утверждает график ежегодных отпусков работников на год.',
    reviewed: false,
    layout: 'order',
    langs: ['kk', 'ru', 'en'],
    fields: [
      {
        id: 'year',
        kind: 'number',
        label: 'На какой год',
        required: true,
        group: 'График',
        hint: 'Четыре цифры: 2027',
      },
      {
        id: 'noticeDate',
        kind: 'date',
        label: 'Ознакомить работников до',
        required: true,
        group: 'График',
        dateLimits: { notBefore: 'today' },
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Демалыс кестесін бекіту туралы»', bold: true }]],
        ru: [[{ text: '«Об утверждении графика отпусков»', bold: true }]],
        en: [[{ text: '“On approval of the leave schedule”', bold: true }]],
      },
      body: {
        kk: [
          [
            { text: '1. ' },
            { field: 'year' },
            { text: ' жылға арналған қызметкерлердің жыл сайынғы ақылы еңбек демалыстарының кестесі бекітілсін.' },
          ],
          [
            { text: '2. Кадр бөлімі қызметкерлерді кестемен ' },
            { field: 'noticeDate' },
            { text: ' мерзіміне дейін қол қойғыза отырып таныстырсын.' },
          ],
          [{ text: '3. Бөлім басшылары кестенің сақталуын қамтамасыз етсін.' }],
          [{ text: 'Негіздеме: ', bold: true }, { text: ANNEX.kk }],
        ],
        ru: [
          [
            { text: '1. Утвердить график ежегодных оплачиваемых трудовых отпусков работников на ' },
            { field: 'year' },
            { text: ' год.' },
          ],
          [
            { text: '2. Отделу кадров ознакомить работников с графиком под подпись в срок до ' },
            { field: 'noticeDate' },
            { text: '.' },
          ],
          [{ text: '3. Руководителям подразделений обеспечить соблюдение графика.' }],
          [{ text: 'Основание: ', bold: true }, { text: ANNEX.ru }],
        ],
        en: [
          [
            { text: '1. To approve the schedule of annual paid labour leaves of the employees for ' },
            { field: 'year' },
            { text: '.' },
          ],
          [
            { text: '2. To HR Department – to acquaint the employees with the schedule against signature by ' },
            { field: 'noticeDate' },
            { text: '.' },
          ],
          [{ text: '3. To the heads of departments – to ensure that the schedule is observed.' }],
          [{ text: 'Basis: ', bold: true }, { text: ANNEX.en }],
        ],
      },
    }),
  },

  /* ═══ Аттестация работников ═════════════════════════════════════════════ */
  {
    id: 'hr-attestation-order',
    title: 'Приказ о проведении аттестации работников',
    sectionId: 'hr',
    subsectionId: 'hr-activity-orders',
    series: 'ОД',
    profile: 'standard',
    purpose: 'Назначает сроки аттестации и состав комиссии.',
    reviewed: false,
    layout: 'order',
    langs: ['kk', 'ru', 'en'],
    fields: [
      { id: 'unit', kind: 'text', label: 'Подразделение', required: true, group: 'Аттестация', perLang: true },
      {
        id: 'from',
        kind: 'date',
        label: 'Начало аттестации',
        required: true,
        group: 'Аттестация',
        dateLimits: { notBefore: 'today' },
      },
      {
        id: 'to',
        kind: 'date',
        label: 'Окончание аттестации',
        required: true,
        group: 'Аттестация',
        dateLimits: { afterField: 'from' },
      },
      employeeField('Председатель комиссии', 'Комиссия'),
      {
        id: 'members',
        kind: 'employees',
        label: 'Члены комиссии',
        required: true,
        group: 'Комиссия',
        hint: 'Начните вводить ФИО – персонал подскажет. ФИО и должность встанут в каждую колонку на её языке',
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Қызметкерлерді аттестаттауды өткізу туралы»', bold: true }]],
        ru: [[{ text: '«О проведении аттестации работников»', bold: true }]],
        en: [[{ text: '“On conducting the certification of employees”', bold: true }]],
      },
      body: {
        kk: [
          [
            { text: '1. «' },
            { field: 'unit' },
            { text: '» бөлімінің қызметкерлерін аттестаттау ' },
            { field: 'from' },
            { text: ' бастап ' },
            { field: 'to' },
            { text: ' аралығында өткізілсін.' },
          ],
          [
            { text: '2. Аттестаттау комиссиясының төрағасы болып ' },
            { field: 'employee:nom', bold: true },
            { text: ' тағайындалсын. Комиссия мүшелері: ' },
            { field: 'members' },
            { text: '.' },
          ],
          [{ text: '3. Кадр бөлімі қызметкерлерді осы бұйрықпен таныстырсын.' }],
          [{ text: `4. ${CONTROL.kk}` }],
        ],
        ru: [
          [
            { text: '1. Провести аттестацию работников подразделения «' },
            { field: 'unit' },
            { text: '» в период с ' },
            { field: 'from' },
            { text: ' по ' },
            { field: 'to' },
            { text: '.' },
          ],
          [
            { text: '2. Назначить председателем аттестационной комиссии ' },
            { field: 'employee', bold: true },
            { text: '. Члены комиссии: ' },
            { field: 'members' },
            { text: '.' },
          ],
          [{ text: '3. Отделу кадров ознакомить работников с настоящим приказом.' }],
          [{ text: `4. ${CONTROL.ru}` }],
        ],
        en: [
          [
            { text: '1. To conduct the certification of the employees of the “' },
            { field: 'unit' },
            { text: '” unit from ' },
            { field: 'from' },
            { text: ' to ' },
            { field: 'to' },
            { text: '.' },
          ],
          [
            { text: '2. To appoint ' },
            { field: 'employee', bold: true },
            { text: ' as the chairperson of the certification commission. Members: ' },
            { field: 'members' },
            { text: '.' },
          ],
          [{ text: '3. To HR Department – to acquaint the employees with this order.' }],
          [{ text: `4. ${CONTROL.en}` }],
        ],
      },
    }),
  },

  /* ═══ Отзыв доверенности ════════════════════════════════════════════════ */
  {
    id: 'legal-power-revoke-order',
    title: 'Приказ об отзыве доверенности',
    sectionId: 'legal',
    subsectionId: 'legal-powers',
    series: 'ОД',
    profile: 'standard',
    purpose: 'Прекращает действие выданной доверенности.',
    reviewed: false,
    layout: 'order',
    langs: ['kk', 'ru', 'en'],
    fields: [
      employeeField('Поверенный', 'Доверенность'),
      {
        id: 'powerNumber',
        kind: 'text',
        label: 'Номер доверенности',
        required: true,
        group: 'Доверенность',
      },
      {
        id: 'powerDate',
        kind: 'date',
        label: 'Дата выдачи доверенности',
        required: true,
        group: 'Доверенность',
        dateLimits: { notAfter: 'today' },
      },
      {
        id: 'revokeDate',
        kind: 'date',
        label: 'Отзывается с',
        required: true,
        group: 'Доверенность',
        dateLimits: { notBefore: 'today' },
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Сенімхатты кері қайтарып алу туралы»', bold: true }]],
        ru: [[{ text: '«Об отзыве доверенности»', bold: true }]],
        en: [[{ text: '“On revocation of the power of attorney”', bold: true }]],
      },
      body: {
        kk: [
          [
            { text: '1. ' },
            { field: 'employee:nom', bold: true },
            { text: ' атына ' },
            { field: 'powerDate' },
            { text: ' жылғы № ' },
            { field: 'powerNumber' },
            { text: ' берілген сенімхаттың күші ' },
            { field: 'revokeDate' },
            { text: ' бастап жойылсын.' },
          ],
          [
            {
              text:
                '2. Заңгер сенімхаттың кері қайтарып алынғаны туралы мүдделі тұлғаларды ' +
                'хабардар етсін.',
            },
          ],
          [{ text: '3. Сенімхаттың түпнұсқасы қайтарылсын.' }],
          [{ text: `4. ${CONTROL.kk}` }],
        ],
        ru: [
          [
            { text: '1. Отозвать с ' },
            { field: 'revokeDate' },
            { text: ' доверенность № ' },
            { field: 'powerNumber' },
            { text: ' от ' },
            { field: 'powerDate' },
            { text: ', выданную на имя ' },
            { field: 'employee', bold: true },
            { text: '.' },
          ],
          [{ text: '2. Юристу уведомить заинтересованных лиц об отзыве доверенности.' }],
          [{ text: '3. Обеспечить возврат оригинала доверенности.' }],
          [{ text: `4. ${CONTROL.ru}` }],
        ],
        en: [
          [
            { text: '1. To revoke from ' },
            { field: 'revokeDate' },
            { text: ' the power of attorney No. ' },
            { field: 'powerNumber' },
            { text: ' dated ' },
            { field: 'powerDate' },
            { text: ', issued in the name of ' },
            { field: 'employee', bold: true },
            { text: '.' },
          ],
          [{ text: '2. To the lawyer – to notify the interested parties of the revocation.' }],
          [{ text: '3. To ensure the return of the original power of attorney.' }],
          [{ text: `4. ${CONTROL.en}` }],
        ],
      },
    }),
  },

  /* ═══ Создание комиссии ═════════════════════════════════════════════════ */
  {
    id: 'corporate-commission-order',
    title: 'Приказ о создании комиссии',
    sectionId: 'corporate',
    subsectionId: 'corporate-orders',
    series: 'Корп',
    profile: 'standard',
    purpose: 'Создаёт комиссию, назначает председателя и срок работы.',
    reviewed: false,
    layout: 'order',
    langs: ['kk', 'ru', 'en'],
    fields: [
      {
        id: 'subject',
        kind: 'text',
        label: 'Какая комиссия',
        required: true,
        group: 'Комиссия',
        perLang: true,
        hint: 'Например: по списанию основных средств',
      },
      employeeField('Председатель комиссии', 'Комиссия'),
      {
        id: 'members',
        kind: 'employees',
        label: 'Члены комиссии',
        required: true,
        group: 'Комиссия',
        hint: 'Начните вводить ФИО – персонал подскажет. ФИО и должность встанут в каждую колонку на её языке',
      },
      {
        id: 'reportDate',
        kind: 'date',
        label: 'Представить результаты до',
        required: true,
        group: 'Сроки',
        dateLimits: { notBefore: 'today' },
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Комиссия құру туралы»', bold: true }]],
        ru: [[{ text: '«О создании комиссии»', bold: true }]],
        en: [[{ text: '“On establishing a commission”', bold: true }]],
      },
      body: {
        kk: [
          [
            { text: '1. ' },
            { field: 'subject' },
            { text: ' комиссиясы құрылсын.' },
          ],
          [
            { text: '2. Комиссия төрағасы болып ' },
            { field: 'employee:nom', bold: true },
            { text: ' тағайындалсын. Комиссия мүшелері: ' },
            { field: 'members' },
            { text: '.' },
          ],
          [
            { text: '3. Комиссия жұмысының нәтижелерін ' },
            { field: 'reportDate' },
            { text: ' мерзіміне дейін ұсынсын.' },
          ],
          [{ text: `4. ${CONTROL.kk}` }],
        ],
        ru: [
          [{ text: '1. Создать комиссию ' }, { field: 'subject' }, { text: '.' }],
          [
            { text: '2. Назначить председателем комиссии ' },
            { field: 'employee', bold: true },
            { text: '. Члены комиссии: ' },
            { field: 'members' },
            { text: '.' },
          ],
          [
            { text: '3. Комиссии представить результаты работы в срок до ' },
            { field: 'reportDate' },
            { text: '.' },
          ],
          [{ text: `4. ${CONTROL.ru}` }],
        ],
        en: [
          [{ text: '1. To establish a commission ' }, { field: 'subject' }, { text: '.' }],
          [
            { text: '2. To appoint ' },
            { field: 'employee', bold: true },
            { text: ' as the chairperson of the commission. Members: ' },
            { field: 'members' },
            { text: '.' },
          ],
          [
            { text: '3. The commission shall submit the results of its work by ' },
            { field: 'reportDate' },
            { text: '.' },
          ],
          [{ text: `4. ${CONTROL.en}` }],
        ],
      },
    }),
  },

  /* ═══ Право подписи ═════════════════════════════════════════════════════ */
  {
    id: 'corporate-signature-right-order',
    title: 'Приказ о праве подписи документов',
    sectionId: 'corporate',
    subsectionId: 'corporate-orders',
    series: 'Корп',
    profile: 'sensitive',
    purpose: 'Предоставляет работнику право подписи определённых документов.',
    reviewed: false,
    layout: 'order',
    langs: ['kk', 'ru', 'en'],
    fields: [
      employeeField('Кому предоставляется', 'Право подписи'),
      { id: 'position', kind: 'text', label: 'Должность', required: true, group: 'Право подписи', perLang: true },
      {
        id: 'scope',
        kind: 'multiselect',
        label: 'Какие документы',
        required: true,
        group: 'Право подписи',
        hint: 'Отметьте нужные виды документов',
        options: SIGNED_DOCUMENTS.map(([ru]) => ru),
        optionLabels: Object.fromEntries(SIGNED_DOCUMENTS.map(([ru, kk, en]) => [ru, { kk, en }])),
      },
      {
        id: 'fromDate',
        kind: 'date',
        label: 'Действует с',
        required: true,
        group: 'Срок',
        dateLimits: { notBefore: 'today' },
      },
      {
        id: 'untilDate',
        kind: 'date',
        label: 'Действует по',
        required: true,
        group: 'Срок',
        dateLimits: { afterField: 'fromDate' },
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Құжаттарға қол қою құқығы туралы»', bold: true }]],
        ru: [[{ text: '«О праве подписи документов»', bold: true }]],
        en: [[{ text: '“On the right to sign documents”', bold: true }]],
      },
      body: {
        kk: [
          [
            { text: '1. ' },
            { field: 'employee:nom', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ', ' },
            { field: 'fromDate' },
            { text: ' бастап ' },
            { field: 'untilDate' },
            { text: ' аралығында мынадай құжаттарға қол қою құқығы берілсін: ' },
            { field: 'scope' },
            { text: '.' },
          ],
          [{ text: '2. Қол қою үлгісі осы бұйрыққа қоса беріледі.' }],
          [{ text: `3. ${CONTROL.kk}` }],
        ],
        ru: [
          [
            { text: '1. Предоставить ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ', право подписи следующих документов: ' },
            { field: 'scope' },
            { text: ', в период с ' },
            { field: 'fromDate' },
            { text: ' по ' },
            { field: 'untilDate' },
            { text: '.' },
          ],
          [{ text: '2. Образец подписи прилагается к настоящему приказу.' }],
          [{ text: `3. ${CONTROL.ru}` }],
        ],
        en: [
          [
            { text: '1. To grant ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ', the right to sign the following documents: ' },
            { field: 'scope' },
            { text: ', from ' },
            { field: 'fromDate' },
            { text: ' to ' },
            { field: 'untilDate' },
            { text: '.' },
          ],
          [{ text: '2. The specimen signature is attached to this order.' }],
          [{ text: `3. ${CONTROL.en}` }],
        ],
      },
    }),
  },

  /* ═══ Учётная политика ══════════════════════════════════════════════════ */
  {
    id: 'finance-accounting-policy-order',
    title: 'Приказ об учётной политике',
    sectionId: 'finance',
    subsectionId: 'finance-orders',
    series: 'Фин',
    profile: 'policy',
    purpose: 'Утверждает учётную политику и вводит её в действие.',
    reviewed: false,
    layout: 'order',
    langs: ['kk', 'ru', 'en'],
    fields: [
      {
        id: 'year',
        kind: 'number',
        label: 'На какой год',
        required: true,
        group: 'Учётная политика',
        hint: 'Четыре цифры: 2027',
      },
      {
        id: 'effectiveDate',
        kind: 'date',
        label: 'Вводится в действие с',
        required: true,
        group: 'Учётная политика',
        dateLimits: { notBefore: 'today' },
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Есеп саясатын бекіту туралы»', bold: true }]],
        ru: [[{ text: '«Об утверждении учётной политики»', bold: true }]],
        en: [[{ text: '“On approval of the accounting policy”', bold: true }]],
      },
      body: {
        kk: [
          [
            { text: '1. ' },
            { field: 'year' },
            { text: ' жылға арналған есеп саясаты бекітілсін және ' },
            { field: 'effectiveDate' },
            { text: ' бастап қолданысқа енгізілсін.' },
          ],
          [{ text: '2. Бас бухгалтер есеп саясатының сақталуын қамтамасыз етсін.' }],
          [{ text: `3. ${CONTROL.kk}` }],
          [{ text: 'Негіздеме: ', bold: true }, { text: ANNEX.kk }],
        ],
        ru: [
          [
            { text: '1. Утвердить учётную политику на ' },
            { field: 'year' },
            { text: ' год и ввести её в действие с ' },
            { field: 'effectiveDate' },
            { text: '.' },
          ],
          [{ text: '2. Главному бухгалтеру обеспечить соблюдение учётной политики.' }],
          [{ text: `3. ${CONTROL.ru}` }],
          [{ text: 'Основание: ', bold: true }, { text: ANNEX.ru }],
        ],
        en: [
          [
            { text: '1. To approve the accounting policy for ' },
            { field: 'year' },
            { text: ' and to put it into effect from ' },
            { field: 'effectiveDate' },
            { text: '.' },
          ],
          [
            {
              text: '2. To the chief accountant – to ensure that the accounting policy is observed.',
            },
          ],
          [{ text: `3. ${CONTROL.en}` }],
          [{ text: 'Basis: ', bold: true }, { text: ANNEX.en }],
        ],
      },
    }),
  },

  /* ═══ Инвентаризация ════════════════════════════════════════════════════ */
  {
    id: 'finance-inventory-order',
    title: 'Приказ о проведении инвентаризации',
    sectionId: 'finance',
    subsectionId: 'finance-orders',
    series: 'Фин',
    profile: 'standard',
    purpose: 'Назначает сроки инвентаризации и состав комиссии.',
    reviewed: false,
    layout: 'order',
    langs: ['kk', 'ru', 'en'],
    fields: [
      {
        id: 'scope',
        kind: 'text',
        label: 'Что инвентаризируется',
        required: true,
        group: 'Инвентаризация',
        perLang: true,
        hint: 'Например: основные средства и товарно-материальные запасы',
      },
      {
        id: 'from',
        kind: 'date',
        label: 'Начало',
        required: true,
        group: 'Инвентаризация',
        dateLimits: { notBefore: 'today' },
      },
      {
        id: 'to',
        kind: 'date',
        label: 'Окончание',
        required: true,
        group: 'Инвентаризация',
        dateLimits: { afterField: 'from' },
      },
      employeeField('Председатель комиссии', 'Комиссия'),
      {
        id: 'members',
        kind: 'employees',
        label: 'Члены комиссии',
        required: true,
        group: 'Комиссия',
        hint: 'Начните вводить ФИО – персонал подскажет. ФИО и должность встанут в каждую колонку на её языке',
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Түгендеу жүргізу туралы»', bold: true }]],
        ru: [[{ text: '«О проведении инвентаризации»', bold: true }]],
        en: [[{ text: '“On conducting an inventory count”', bold: true }]],
      },
      body: {
        kk: [
          [
            { text: '1. ' },
            { field: 'scope' },
            { text: ' түгендеуі ' },
            { field: 'from' },
            { text: ' бастап ' },
            { field: 'to' },
            { text: ' аралығында жүргізілсін.' },
          ],
          [
            { text: '2. Түгендеу комиссиясының төрағасы болып ' },
            { field: 'employee:nom', bold: true },
            { text: ' тағайындалсын. Комиссия мүшелері: ' },
            { field: 'members' },
            { text: '.' },
          ],
          [{ text: '3. Комиссия түгендеу нәтижелері бойынша акт жасасын.' }],
          [{ text: `4. ${CONTROL.kk}` }],
        ],
        ru: [
          [
            { text: '1. Провести инвентаризацию ' },
            { field: 'scope' },
            { text: ' в период с ' },
            { field: 'from' },
            { text: ' по ' },
            { field: 'to' },
            { text: '.' },
          ],
          [
            { text: '2. Назначить председателем инвентаризационной комиссии ' },
            { field: 'employee', bold: true },
            { text: '. Члены комиссии: ' },
            { field: 'members' },
            { text: '.' },
          ],
          [{ text: '3. Комиссии составить акт по результатам инвентаризации.' }],
          [{ text: `4. ${CONTROL.ru}` }],
        ],
        en: [
          [
            { text: '1. To conduct an inventory count of ' },
            { field: 'scope' },
            { text: ' from ' },
            { field: 'from' },
            { text: ' to ' },
            { field: 'to' },
            { text: '.' },
          ],
          [
            { text: '2. To appoint ' },
            { field: 'employee', bold: true },
            { text: ' as the chairperson of the inventory commission. Members: ' },
            { field: 'members' },
            { text: '.' },
          ],
          [{ text: '3. The commission shall draw up an act on the results of the count.' }],
          [{ text: `4. ${CONTROL.en}` }],
        ],
      },
    }),
  },

  /* ═══ Открытие проекта ══════════════════════════════════════════════════ */
  {
    id: 'projects-open-order',
    title: 'Приказ об открытии проекта',
    sectionId: 'projects',
    subsectionId: 'projects-initiation',
    series: 'Пр',
    profile: 'standard',
    purpose: 'Открывает проект, назначает руководителя и сроки.',
    reviewed: false,
    layout: 'order',
    langs: ['kk', 'ru', 'en'],
    fields: [
      { id: 'project', kind: 'text', label: 'Название проекта', required: true, group: 'Проект', perLang: true },
      employeeField('Руководитель проекта', 'Проект'),
      {
        id: 'from',
        kind: 'date',
        label: 'Начало проекта',
        required: true,
        group: 'Сроки',
        dateLimits: { notBefore: 'today' },
      },
      {
        id: 'to',
        kind: 'date',
        label: 'Плановое окончание',
        required: true,
        group: 'Сроки',
        dateLimits: { afterField: 'from' },
      },
      {
        id: 'budget',
        kind: 'money',
        label: 'Бюджет проекта',
        required: true,
        unit: '₸',
        group: 'Сроки',
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Жобаны ашу туралы»', bold: true }]],
        ru: [[{ text: '«Об открытии проекта»', bold: true }]],
        en: [[{ text: '“On the opening of the project”', bold: true }]],
      },
      body: {
        kk: [
          [
            { text: '1. «' },
            { field: 'project' },
            { text: '» жобасы ' },
            { field: 'from' },
            { text: ' бастап ' },
            { field: 'to' },
            { text: ' аралығында ашылсын. Жоба бюджеті – ' },
            { field: 'budget' },
            { text: ' теңге.' },
          ],
          [
            { text: '2. Жоба жетекшісі болып ' },
            { field: 'employee:nom', bold: true },
            { text: ' тағайындалсын.' },
          ],
          [{ text: '3. Жоба жетекшісі жоба жарғысын әзірлесін.' }],
          [{ text: `4. ${CONTROL.kk}` }],
        ],
        ru: [
          [
            { text: '1. Открыть проект «' },
            { field: 'project' },
            { text: '» со сроком выполнения с ' },
            { field: 'from' },
            { text: ' по ' },
            { field: 'to' },
            { text: '. Бюджет проекта – ' },
            { field: 'budget' },
            { text: ' тенге.' },
          ],
          [
            { text: '2. Назначить руководителем проекта ' },
            { field: 'employee', bold: true },
            { text: '.' },
          ],
          [{ text: '3. Руководителю проекта разработать устав проекта.' }],
          [{ text: `4. ${CONTROL.ru}` }],
        ],
        en: [
          [
            { text: '1. To open the project “' },
            { field: 'project' },
            { text: '” with the term from ' },
            { field: 'from' },
            { text: ' to ' },
            { field: 'to' },
            { text: '. The project budget is ' },
            { field: 'budget' },
            { text: ' tenge.' },
          ],
          [
            { text: '2. To appoint ' },
            { field: 'employee', bold: true },
            { text: ' as the project manager.' },
          ],
          [{ text: '3. The project manager shall develop the project charter.' }],
          [{ text: `4. ${CONTROL.en}` }],
        ],
      },
    }),
  },

  /* ═══ Ответственный за охрану труда ═════════════════════════════════════ */
  {
    id: 'hse-safety-officer-order',
    title: 'Приказ о назначении ответственного за охрану труда',
    sectionId: 'hse',
    subsectionId: 'hse-general',
    series: 'ОТ',
    profile: 'standard',
    purpose: 'Назначает работника, отвечающего за охрану труда.',
    reviewed: false,
    layout: 'order',
    langs: ['kk', 'ru', 'en'],
    fields: [
      employeeField('Кто назначается', 'Назначение'),
      { id: 'position', kind: 'text', label: 'Должность', required: true, group: 'Назначение', perLang: true },
      {
        id: 'fromDate',
        kind: 'date',
        label: 'Назначается с',
        required: true,
        group: 'Назначение',
        dateLimits: { notBefore: 'today' },
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Еңбекті қорғау жөніндегі жауапты тұлғаны тағайындау туралы»', bold: true }]],
        ru: [[{ text: '«О назначении ответственного за охрану труда»', bold: true }]],
        en: [[{ text: '“On the appointment of the occupational safety officer”', bold: true }]],
      },
      body: {
        kk: [
          [
            { text: '1. ' },
            { field: 'employee:nom', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ', ' },
            { field: 'fromDate' },
            { text: ' бастап еңбекті қорғау жөніндегі жауапты тұлға болып тағайындалсын.' },
          ],
          [
            {
              text:
                '2. Жауапты тұлға нұсқамалардың өткізілуін және еңбекті қорғау журналдарының ' +
                'жүргізілуін қамтамасыз етсін.',
            },
          ],
          [{ text: `3. ${CONTROL.kk}` }],
        ],
        ru: [
          [
            { text: '1. Назначить ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ', ответственным за охрану труда с ' },
            { field: 'fromDate' },
            { text: '.' },
          ],
          [
            {
              text:
                '2. Ответственному обеспечить проведение инструктажей и ведение журналов ' +
                'по охране труда.',
            },
          ],
          [{ text: `3. ${CONTROL.ru}` }],
        ],
        en: [
          [
            { text: '1. To appoint ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ', as the person responsible for occupational safety from ' },
            { field: 'fromDate' },
            { text: '.' },
          ],
          [
            {
              text:
                '2. The responsible person shall ensure that briefings are held and that the ' +
                'occupational safety logs are kept.',
            },
          ],
          [{ text: `3. ${CONTROL.en}` }],
        ],
      },
    }),
  },
];
