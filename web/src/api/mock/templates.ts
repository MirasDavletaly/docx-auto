/**
 * Шаблоны документов.
 *
 * Шаблон описывает две вещи сразу: какие поля показать в форме и как из них
 * собирается лист. Это та же пара, что в каталоге — `fields.yaml` рядом с
 * `template.ru.docx`, — только здесь она в одном объекте.
 *
 * ТЕКСТ ДОКУМЕНТОВ — ЧЕРНОВИК, ПРОВЕРИТЬ ЮРИСТУ. Формулировки взяты по смыслу
 * из практики кадрового делопроизводства, ссылок на статьи закона в них нет
 * намеренно: реквизиты норм права не выдумываются (CLAUDE.md, п. 4.9).
 *
 * Поля, начинающиеся с «@», подставляются системой, а не человеком:
 * реквизиты компании, руководитель, город, дата и номер документа.
 */
import { DOCUMENT_WORDS, documentBody, orderBody } from '@/api/mock/blank';
import { genericTemplatesA } from '@/api/mock/templates-generic';
import { genericTemplatesB } from '@/api/mock/templates-generic-2';
import { blankTemplates } from '@/api/mock/templates-blank';
import { formTemplates } from '@/api/mock/templates-forms';
import { activityOrders } from '@/api/mock/templates-orders';

import type { CatalogEntry, DocumentTemplate } from '@/api/types';

/**
 * Статья Трудового кодекса для приказа о расторжении – по основанию.
 *
 * Номера статей даны человеком 23.09.2026: общий перечень оснований – 49,
 * расторжение по инициативе работника – 56. Для «иных оснований» названы
 * статьи 57–58, но какое из значений списка к ним относится, не сказано –
 * вопрос в docs/questions.md, Q32.
 */
const DISMISSAL_ARTICLE: Record<string, string> = {
  'по инициативе работника': '56',
};

/**
 * Шаблоны на простом одноязычном листе.
 *
 * Документы, для которых ещё нет проверенного казахского и английского
 * текста. Как только перевод придёт, они переезжают в `templates-blank.ts`
 * на настоящий бланк группы – тот же, что у приказа о приёме на работу.
 */
const simpleTemplates: DocumentTemplate[] = [
  {
    id: 'hr-trip-order',
    title: 'Приказ о направлении в командировку',
    sectionId: 'hr',
    subsectionId: 'hr-personnel-orders',
    series: 'К',
    profile: 'standard',
    purpose: 'Служебная поездка работника с выдачей аванса на расходы.',
    reviewed: false,
    layout: 'order',
    // Казахский и английский текст написан по образцу присланных приказов
    // теми же оборотами. Ссылки на статью закона здесь нет: для этого
    // документа она не прислана, а нормы права не выдумываются.
    langs: ['kk', 'ru', 'en'],
    fields: [
      {
        id: 'employee',
        kind: 'employee',
        label: 'Работник',
        required: true,
        group: 'Работник',
        perLang: true,
      },
      { id: 'position', kind: 'text', label: 'Должность', required: true, group: 'Работник', perLang: true },
      {
        id: 'city',
        kind: 'text',
        label: 'Город назначения',
        required: true,
        group: 'Командировка',
        perLang: true,
        translate: 'place',
        hint: 'Казахский и английский подставятся сами',
      },
      {
        id: 'organization',
        kind: 'text',
        label: 'Принимающая организация',
        required: true,
        group: 'Командировка',
        perLang: true,
        translate: 'organization',
        hint: 'Например: ТОО «Тұлпар Сервис». Казахский и английский подставятся сами',
      },
      {
        id: 'purpose',
        kind: 'textarea',
        label: 'Цель командировки',
        required: true,
        group: 'Командировка',
        perLang: true,
        hint: 'Одной фразой: что именно нужно сделать',
      },
      { id: 'days', kind: 'number', label: 'Срок', required: true, unit: 'кал. дней', group: 'Сроки' },
      {
        id: 'daysWords',
        wordsOf: 'days',
        kind: 'text',
        label: 'Срок прописью',
        required: true,
        group: 'Сроки',
        hint: 'Как в приказе: пять, двенадцать',
        perLang: true,
      },
      {
        id: 'from',
        kind: 'date',
        label: 'Дата выезда',
        required: true,
        group: 'Сроки',
        dateLimits: { notBefore: 'today' },
      },
      {
        id: 'to',
        kind: 'date',
        label: 'Дата возвращения',
        required: true,
        group: 'Сроки',
        // Вернуться раньше, чем выехал, нельзя. Проверка стоит и в органе
        // ввода, и при сохранении: дату можно вписать руками.
        dateLimits: { afterField: 'from' },
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Іссапарға жіберу туралы»', bold: true }]],
        ru: [[{ text: '«О направлении в командировку»', bold: true }]],
        en: [[{ text: '“On business trip assignment”', bold: true }]],
      },
      basis: {
        kk: [[{ text: 'ҚР 2015 жылғы 23 қарашадағы №414-V Еңбек кодексінің 127-бабына сәйкес.' }]],
        ru: [[{ text: 'В соответствии со статьей 127 Трудового Кодекса РК от 23 ноября 2015 года №414-V.' }]],
        en: [[{ text: 'In accordance with Article 127 of the Labor Code of the Republic of Kazakhstan dated November 23, 2015 No. 414-V.' }]],
      },
      body: {
        kk: [
          [
            { text: '1. ' },
            { field: 'employee:nom', bold: true },
            { text: ' ' },
            { field: 'position' },
            { text: ' ' },
            { field: 'from' },
            { text: ' бастап ' },
            { field: 'to' },
            { text: ' қоса алғанда ' },
            { field: 'days' },
            { text: ' (' },
            { field: 'daysWords' },
            { text: ') күнтізбелік күн мерзімге ' },
            { field: 'city' },
            { text: ' қаласына, ' },
            { field: 'organization' },
            { text: ', іссапарға жіберілсін.' },
          ],
          [{ text: '2. Іссапардың мақсаты: ' }, { field: 'purpose' }, { text: '.' }],
          [{ text: '3. Бухгалтерия іссапар шығыстарына аванс шығу күніне дейін берсін.' }],
          [
            {
              text:
                '4. Қызметкер оралғаннан кейін белгіленген мерзімде аванстық есеп ' +
                'тапсырсын.',
            },
          ],
          [
            { text: 'Негіздеме: ', bold: true },
            { text: 'бөлім басшысының қызметтік жазбасы.' },
          ],
        ],
        ru: [
          [
            { text: '1. Направить ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ', в командировку в г. ' },
            { field: 'city' },
            { text: ', ' },
            { field: 'organization' },
            { text: ', сроком на ' },
            { field: 'days' },
            { text: ' (' },
            { field: 'daysWords' },
            { text: ') календарных дней с ' },
            { field: 'from' },
            { text: ' по ' },
            { field: 'to' },
            { text: '.' },
          ],
          [{ text: '2. Цель командировки: ' }, { field: 'purpose' }, { text: '.' }],
          [{ text: '3. Бухгалтерии выдать аванс на командировочные расходы до даты выезда.' }],
          [
            {
              text:
                '4. Работнику представить авансовый отчёт в установленный срок после ' +
                'возвращения.',
            },
          ],
          [
            { text: 'Основание: ', bold: true },
            { text: 'служебная записка руководителя подразделения.' },
          ],
        ],
        en: [
          [
            { text: '1. To send ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ', on a business trip to ' },
            { field: 'city' },
            { text: ', ' },
            { field: 'organization' },
            { text: ', for ' },
            { field: 'days' },
            { text: ' (' },
            { field: 'daysWords' },
            { text: ') calendar days from ' },
            { field: 'from' },
            { text: ' to ' },
            { field: 'to' },
            { text: '.' },
          ],
          [{ text: '2. Purpose of the trip: ' }, { field: 'purpose' }, { text: '.' }],
          [
            {
              text:
                '3. To Accountant Department – to issue an advance for travel expenses ' +
                'before the departure date.',
            },
          ],
          [
            {
              text:
                '4. The employee shall submit an expense report within the established ' +
                'period after return.',
            },
          ],
          [
            { text: 'Basis: ', bold: true },
            { text: 'memorandum of the head of the department.' },
          ],
        ],
      },
    }),
  },

  {
    id: 'hr-transfer-order',
    title: 'Приказ о переводе на другую должность',
    sectionId: 'hr',
    subsectionId: 'hr-personnel-orders',
    series: 'К',
    profile: 'standard',
    purpose: 'Перевод работника на другую должность или в другое подразделение.',
    reviewed: false,
    layout: 'order',
    // Казахский и английский текст написан по образцу присланных приказов
    // теми же оборотами. Ссылки на статью закона здесь нет: для этого
    // документа она не прислана, а нормы права не выдумываются.
    langs: ['kk', 'ru', 'en'],
    fields: [
      {
        id: 'employee',
        kind: 'employee',
        label: 'Работник',
        required: true,
        group: 'Работник',
        perLang: true,
      },
      {
        id: 'positionFrom',
        kind: 'text',
        label: 'Прежняя должность',
        required: true,
        group: 'Работник',
        hint: 'Подставится из справочника',
        perLang: true,
      },
      { id: 'position', kind: 'text', label: 'Новая должность', required: true, group: 'Перевод', perLang: true },
      {
        id: 'unit',
        kind: 'text',
        label: 'Новое подразделение',
        required: true,
        group: 'Перевод',
        perLang: true,
      },
      {
        id: 'transferDate',
        kind: 'date',
        label: 'Дата перевода',
        required: true,
        group: 'Перевод',
        dateLimits: { notBefore: 'today' },
      },
      {
        id: 'salary',
        kind: 'money',
        label: 'Должностной оклад',
        required: true,
        unit: '₸',
        group: 'Перевод',
        hint: 'В месяц, до удержаний',
      },
      {
        id: 'agreementNumber',
        kind: 'text',
        label: 'Номер дополнительного соглашения',
        required: true,
        group: 'Основание',
      },
      {
        id: 'agreementDate',
        kind: 'date',
        label: 'Дата дополнительного соглашения',
        required: true,
        group: 'Основание',
        dateLimits: { notAfter: 'today' },
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Басқа лауазымға ауыстыру туралы»', bold: true }]],
        ru: [[{ text: '«О переводе на другую должность»', bold: true }]],
        en: [[{ text: '“On transfer to another position”', bold: true }]],
      },
      basis: {
        kk: [[{ text: 'ҚР 2015 жылғы 23 қарашадағы №414-V Еңбек кодексінің 45-бабына сәйкес.' }]],
        ru: [[{ text: 'В соответствии со статьей 45 Трудового Кодекса РК от 23 ноября 2015 года №414-V.' }]],
        en: [[{ text: 'In accordance with Article 45 of the Labor Code of the Republic of Kazakhstan dated November 23, 2015 No. 414-V.' }]],
      },
      body: {
        kk: [
          [
            { text: '1. ' },
            { field: 'employee:nom', bold: true },
            { text: ' ' },
            { field: 'transferDate' },
            { text: ' бастап «' },
            { field: 'positionFrom' },
            { text: '» лауазымынан «' },
            { field: 'position' },
            { text: '» лауазымына «' },
            { field: 'unit' },
            { text: '» бөліміне ауыстырылсын.' },
          ],
          [
            { text: '2. Ауыстырылған күннен бастап айына ' },
            { field: 'salary' },
            { text: ' теңге лауазымдық жалақы белгіленсін.' },
          ],
          [
            {
              text:
                '3. Кадр бөлімі ауыстыру туралы жазбаны еңбек кітапшасына және жеке ' +
                'карточкасына енгізсін, бухгалтерия жаңа жалақы бойынша есептесін.',
            },
          ],
          [
            { text: 'Негіздеме: ', bold: true },
            { field: 'agreementDate' },
            { text: ' жылғы № ' },
            { field: 'agreementNumber' },
            { text: ' еңбек шартына қосымша келісім.' },
          ],
        ],
        ru: [
          [
            { text: '1. Перевести ' },
            { field: 'employee', bold: true },
            { text: ' с должности «' },
            { field: 'positionFrom' },
            { text: '» на должность «' },
            { field: 'position' },
            { text: '» в подразделение «' },
            { field: 'unit' },
            { text: '» с ' },
            { field: 'transferDate' },
            { text: '.' },
          ],
          [
            { text: '2. Установить должностной оклад в размере ' },
            { field: 'salary' },
            { text: ' тенге в месяц с даты перевода.' },
          ],
          [
            {
              text:
                '3. Отделу кадров внести запись о переводе в трудовую книжку и личную ' +
                'карточку работника, бухгалтерии – производить начисление по новому окладу.',
            },
          ],
          [
            { text: 'Основание: ', bold: true },
            { text: 'дополнительное соглашение к трудовому договору от ' },
            { field: 'agreementDate' },
            { text: ' № ' },
            { field: 'agreementNumber' },
            { text: '.' },
          ],
        ],
        en: [
          [
            { text: '1. To transfer ' },
            { field: 'employee', bold: true },
            { text: ' from the position of “' },
            { field: 'positionFrom' },
            { text: '” to the position of “' },
            { field: 'position' },
            { text: '” in the “' },
            { field: 'unit' },
            { text: '” unit from ' },
            { field: 'transferDate' },
            { text: '.' },
          ],
          [
            { text: '2. To set the official salary of ' },
            { field: 'salary' },
            { text: ' tenge per month from the date of transfer.' },
          ],
          [
            {
              text:
                '3. To HR Department – to enter the transfer record in the employment ' +
                'record book and the personal card of the employee; to Accountant ' +
                'Department – to calculate payments at the new salary.',
            },
          ],
          [
            { text: 'Basis: ', bold: true },
            { text: 'supplementary agreement to the employment contract dated ' },
            { field: 'agreementDate' },
            { text: ' No. ' },
            { field: 'agreementNumber' },
            { text: '.' },
          ],
        ],
      },
    }),
  },

  {
    id: 'hr-salary-order',
    title: 'Приказ об изменении оклада',
    sectionId: 'hr',
    subsectionId: 'hr-personnel-orders',
    series: 'К',
    // Оклад – узкий круг: приказ виден не всем, у кого есть доступ к кадрам
    // (catalog/profiles.yaml, профиль sensitive).
    profile: 'sensitive',
    purpose: 'Изменение должностного оклада работника с определённой даты.',
    reviewed: false,
    layout: 'order',
    // Казахский и английский текст написан по образцу присланных приказов
    // теми же оборотами. Ссылки на статью закона здесь нет: для этого
    // документа она не прислана, а нормы права не выдумываются.
    langs: ['kk', 'ru', 'en'],
    fields: [
      {
        id: 'employee',
        kind: 'employee',
        label: 'Работник',
        required: true,
        group: 'Работник',
        perLang: true,
      },
      { id: 'position', kind: 'text', label: 'Должность', required: true, group: 'Работник', perLang: true },
      {
        id: 'salary',
        kind: 'money',
        label: 'Новый оклад',
        required: true,
        unit: '₸',
        group: 'Оклад',
        hint: 'В месяц, до удержаний',
      },
      {
        id: 'fromDate',
        kind: 'date',
        label: 'Применяется с',
        required: true,
        group: 'Оклад',
        dateLimits: { notBefore: 'today' },
      },
      {
        id: 'agreementNumber',
        kind: 'text',
        label: 'Номер дополнительного соглашения',
        required: true,
        group: 'Основание',
      },
      {
        id: 'agreementDate',
        kind: 'date',
        label: 'Дата дополнительного соглашения',
        required: true,
        group: 'Основание',
        dateLimits: { notAfter: 'today' },
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Лауазымдық жалақыны өзгерту туралы»', bold: true }]],
        ru: [[{ text: '«Об изменении должностного оклада»', bold: true }]],
        en: [[{ text: '“On change of the official salary”', bold: true }]],
      },
      basis: {
        kk: [[{ text: 'ҚР 2015 жылғы 23 қарашадағы №414-V Еңбек кодексінің 46-бабына сәйкес.' }]],
        ru: [[{ text: 'В соответствии со статьей 46 Трудового Кодекса РК от 23 ноября 2015 года №414-V.' }]],
        en: [[{ text: 'In accordance with Article 46 of the Labor Code of the Republic of Kazakhstan dated November 23, 2015 No. 414-V.' }]],
      },
      body: {
        kk: [
          [
            { text: '1. ' },
            { field: 'employee:nom', bold: true },
            { text: ' ' },
            { field: 'position' },
            { text: ' ' },
            { field: 'fromDate' },
            { text: ' бастап айына ' },
            { field: 'salary' },
            { text: ' теңге лауазымдық жалақы белгіленсін.' },
          ],
          [{ text: '2. Бухгалтерия осы бұйрықты ескере отырып жалақы есептесін.' }],
          [
            {
              text:
                '3. Кадр бөлімі штат кестесіне және қызметкердің жеке карточкасына ' +
                'өзгеріс енгізсін.',
            },
          ],
          [
            { text: 'Негіздеме: ', bold: true },
            { field: 'agreementDate' },
            { text: ' жылғы № ' },
            { field: 'agreementNumber' },
            { text: ' еңбек шартына қосымша келісім.' },
          ],
        ],
        ru: [
          [
            { text: '1. Установить ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ', должностной оклад в размере ' },
            { field: 'salary' },
            { text: ' тенге в месяц с ' },
            { field: 'fromDate' },
            { text: '.' },
          ],
          [
            {
              text:
                '2. Бухгалтерии производить начисление заработной платы с учётом ' +
                'настоящего приказа.',
            },
          ],
          [
            {
              text:
                '3. Отделу кадров внести изменение в штатное расписание и личную ' +
                'карточку работника.',
            },
          ],
          [
            { text: 'Основание: ', bold: true },
            { text: 'дополнительное соглашение к трудовому договору от ' },
            { field: 'agreementDate' },
            { text: ' № ' },
            { field: 'agreementNumber' },
            { text: '.' },
          ],
        ],
        en: [
          [
            { text: '1. To set for ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ', the official salary of ' },
            { field: 'salary' },
            { text: ' tenge per month from ' },
            { field: 'fromDate' },
            { text: '.' },
          ],
          [
            {
              text:
                '2. To Accountant Department – to calculate wages taking this order ' +
                'into account.',
            },
          ],
          [
            {
              text:
                '3. To HR Department – to amend the staffing table and the personal ' +
                'card of the employee.',
            },
          ],
          [
            { text: 'Basis: ', bold: true },
            { text: 'supplementary agreement to the employment contract dated ' },
            { field: 'agreementDate' },
            { text: ' No. ' },
            { field: 'agreementNumber' },
            { text: '.' },
          ],
        ],
      },
    }),
  },

  {
    id: 'hr-dismissal-order',
    title: 'Приказ о расторжении трудового договора',
    sectionId: 'hr',
    subsectionId: 'hr-personnel-orders',
    series: 'К',
    profile: 'standard',
    purpose: 'Прекращение трудовых отношений с работником и окончательный расчёт.',
    reviewed: false,
    layout: 'order',
    // Казахский и английский текст написан по образцу присланных приказов
    // теми же оборотами. Ссылки на статью закона здесь нет: для этого
    // документа она не прислана, а нормы права не выдумываются.
    langs: ['kk', 'ru', 'en'],
    fields: [
      {
        id: 'employee',
        kind: 'employee',
        label: 'Работник',
        required: true,
        group: 'Работник',
        perLang: true,
      },
      { id: 'position', kind: 'text', label: 'Должность', required: true, group: 'Работник', perLang: true },
      { id: 'unit', kind: 'text', label: 'Подразделение', required: true, group: 'Работник', perLang: true },
      {
        id: 'dismissDate',
        kind: 'date',
        label: 'Последний рабочий день',
        required: true,
        group: 'Расторжение',
        dateLimits: { notBefore: 'today' },
        hint: 'День увольнения – последний день работы',
      },
      {
        // Статья закона в текст не подставляется: реквизиты норм права
        // не выдумываются (CLAUDE.md, п. 4.9). Норму вписывает юрист.
        id: 'reason',
        kind: 'select',
        label: 'Основание расторжения',
        required: true,
        group: 'Расторжение',
        options: [
          'по соглашению сторон',
          'по инициативе работника',
          'по истечении срока трудового договора',
          'по инициативе работодателя',
        ],
        // Перевод – на проверку юристу и носителю языка (docs/questions.md).
        optionLabels: {
          'по соглашению сторон': {
            kk: 'тараптардың келісімі бойынша',
            en: 'by agreement of the parties',
          },
          'по инициативе работника': {
            kk: 'қызметкердің бастамасы бойынша',
            en: 'at the initiative of the employee',
          },
          'по истечении срока трудового договора': {
            kk: 'еңбек шартының мерзімі өтуіне байланысты',
            en: 'upon expiry of the employment contract',
          },
          'по инициативе работодателя': {
            kk: 'жұмыс берушінің бастамасы бойынша',
            en: 'at the initiative of the employer',
          },
        },
      },
      {
        id: 'compensationDays',
        kind: 'number',
        label: 'Компенсация за неиспользованный отпуск',
        required: true,
        unit: 'кал. дней',
        group: 'Расчёт',
        hint: 'Ноль, если отпуск использован полностью',
      },
      {
        id: 'contractNumber',
        kind: 'text',
        label: 'Номер трудового договора',
        required: true,
        group: 'Основание',
      },
      {
        id: 'contractDate',
        kind: 'date',
        label: 'Дата трудового договора',
        required: true,
        group: 'Основание',
        dateLimits: { notAfter: 'today' },
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Еңбек шартын бұзу туралы»', bold: true }]],
        ru: [[{ text: '«О расторжении трудового договора»', bold: true }]],
        en: [[{ text: '“On termination of the employment contract”', bold: true }]],
      },
      basis: {
        kk: [
          [
            { text: 'ҚР 2015 жылғы 23 қарашадағы №414-V Еңбек кодексінің ' },
            { field: 'reason', map: DISMISSAL_ARTICLE, otherwise: '49' },
            { text: '-бабына сәйкес.' },
          ],
        ],
        ru: [
          [
            { text: 'В соответствии со статьей ' },
            { field: 'reason', map: DISMISSAL_ARTICLE, otherwise: '49' },
            { text: ' Трудового Кодекса РК от 23 ноября 2015 года №414-V.' },
          ],
        ],
        en: [
          [
            { text: 'In accordance with Article ' },
            { field: 'reason', map: DISMISSAL_ARTICLE, otherwise: '49' },
            { text: ' of the Labor Code of the Republic of Kazakhstan dated November 23, 2015 No. 414-V.' },
          ],
        ],
      },
      body: {
        kk: [
          [
            { text: '1. «' },
            { field: 'unit' },
            { text: '» бөлімінің ' },
            { field: 'position' },
            { text: ' ' },
            { field: 'employee:nom', bold: true },
            { text: ' ' },
            { text: '(' },
            { field: 'reason' },
            { text: ') еңбек шарты бұзылсын. Соңғы жұмыс күні – ' },
            { field: 'dismissDate' },
            { text: '.' },
          ],
          [
            { text: '2. Бухгалтерия пайдаланылмаған еңбек демалысының ' },
            { field: 'compensationDays' },
            { text: ' күнтізбелік күні үшін өтемақыны қоса, түпкілікті есеп айырылсын.' },
          ],
          [
            {
              text:
                '3. Кадр бөлімі жұмыстан шығарылған күні қызметкерге еңбек кітапшасын ' +
                'және жалақы туралы анықтаманы берсін.',
            },
          ],
          [
            { text: 'Негіздеме: ', bold: true },
            { field: 'contractDate' },
            { text: ' жылғы № ' },
            { field: 'contractNumber' },
            { text: ' еңбек шарты.' },
          ],
        ],
        ru: [
          [
            { text: '1. Расторгнуть трудовой договор с ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ' подразделения «' },
            { field: 'unit' },
            { text: '», ' },
            { field: 'reason' },
            { text: '. Последний рабочий день – ' },
            { field: 'dismissDate' },
            { text: '.' },
          ],
          [
            { text: '2. Бухгалтерии произвести окончательный расчёт, включая компенсацию за ' },
            { field: 'compensationDays' },
            { text: ' календарных дней неиспользованного трудового отпуска.' },
          ],
          [
            {
              text:
                '3. Отделу кадров выдать работнику трудовую книжку и справку о заработной ' +
                'плате в день увольнения.',
            },
          ],
          [
            { text: 'Основание: ', bold: true },
            { text: 'трудовой договор от ' },
            { field: 'contractDate' },
            { text: ' № ' },
            { field: 'contractNumber' },
            { text: '.' },
          ],
        ],
        en: [
          [
            { text: '1. To terminate the employment contract with ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ' of the “' },
            { field: 'unit' },
            { text: '” unit, ' },
            { field: 'reason' },
            { text: '. The last working day is ' },
            { field: 'dismissDate' },
            { text: '.' },
          ],
          [
            {
              text: '2. To Accountant Department – to make the final settlement, including ',
            },
            { field: 'compensationDays' },
            { text: ' calendar days of compensation for the unused labour leave.' },
          ],
          [
            {
              text:
                '3. To HR Department – to hand the employee the employment record book and ' +
                'the salary certificate on the day of dismissal.',
            },
          ],
          [
            { text: 'Basis: ', bold: true },
            { text: 'employment contract dated ' },
            { field: 'contractDate' },
            { text: ' No. ' },
            { field: 'contractNumber' },
            { text: '.' },
          ],
        ],
      },
    }),
  },

  {
    id: 'hr-vacation-recall-order',
    title: 'Приказ об отзыве из отпуска',
    sectionId: 'hr',
    subsectionId: 'hr-personnel-orders',
    series: 'К',
    profile: 'standard',
    purpose: 'Возвращение работника из отпуска с его согласия. Остаток переносится.',
    reviewed: false,
    layout: 'order',
    // Казахский и английский текст написан по образцу присланных приказов
    // теми же оборотами. Ссылки на статью закона здесь нет: для этого
    // документа она не прислана, а нормы права не выдумываются.
    langs: ['kk', 'ru', 'en'],
    fields: [
      {
        id: 'employee',
        kind: 'employee',
        label: 'Работник',
        required: true,
        group: 'Работник',
        perLang: true,
      },
      { id: 'position', kind: 'text', label: 'Должность', required: true, group: 'Работник', perLang: true },
      {
        id: 'recallDate',
        kind: 'date',
        label: 'Выйти на работу с',
        required: true,
        group: 'Отзыв',
        dateLimits: { notBefore: 'today' },
      },
      {
        id: 'remainingDays',
        kind: 'number',
        label: 'Неиспользованный остаток',
        required: true,
        unit: 'кал. дней',
        group: 'Отзыв',
      },
      {
        id: 'remainingDaysWords',
        wordsOf: 'remainingDays',
        kind: 'text',
        label: 'Остаток прописью',
        required: true,
        group: 'Отзыв',
        hint: 'Как в приказе: семь, четырнадцать',
        perLang: true,
      },
      {
        id: 'reason',
        kind: 'textarea',
        label: 'Причина отзыва',
        required: true,
        group: 'Отзыв',
        perLang: true,
        hint: 'Одной фразой: почему работник нужен на месте',
      },
      {
        // Отзыв без письменного согласия работника недействителен, поэтому
        // дата согласия обязательна и в будущем стоять не может.
        id: 'consentDate',
        kind: 'date',
        label: 'Дата согласия работника',
        required: true,
        group: 'Основание',
        dateLimits: { notAfter: 'today' },
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Еңбек демалысынан кері шақыру туралы»', bold: true }]],
        ru: [[{ text: '«Об отзыве из трудового отпуска»', bold: true }]],
        en: [[{ text: '“On recall from labour leave”', bold: true }]],
      },
      body: {
        kk: [
          [
            { text: '1. ' },
            { field: 'employee:nom', bold: true },
            { text: ' ' },
            { field: 'position' },
            { text: ' ' },
            { field: 'recallDate' },
            { text: ' бастап жыл сайынғы ақылы еңбек демалысынан кері шақырылсын. Себебі: ' },
            { field: 'reason' },
            { text: '.' },
          ],
          [
            { text: '2. Демалыстың пайдаланылмаған ' },
            { field: 'remainingDays' },
            { text: ' (' },
            { field: 'remainingDaysWords' },
            { text: ') күнтізбелік күні қызметкермен келісілген мерзімде берілсін.' },
          ],
          [{ text: '3. Бухгалтерия демалыс ақысын қайта есептесін.' }],
          [
            { text: 'Негіздеме: ', bold: true },
            { text: 'қызметкердің ' },
            { field: 'consentDate' },
            { text: ' жылғы жазбаша келісімі.' },
          ],
        ],
        ru: [
          [
            { text: '1. Отозвать ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ', из ежегодного оплачиваемого трудового отпуска с ' },
            { field: 'recallDate' },
            { text: '. Причина: ' },
            { field: 'reason' },
            { text: '.' },
          ],
          [
            { text: '2. Неиспользованную часть отпуска продолжительностью ' },
            { field: 'remainingDays' },
            { text: ' (' },
            { field: 'remainingDaysWords' },
            { text: ') календарных дней предоставить в согласованный с работником срок.' },
          ],
          [{ text: '3. Бухгалтерии произвести перерасчёт отпускных выплат.' }],
          [
            { text: 'Основание: ', bold: true },
            { text: 'письменное согласие работника от ' },
            { field: 'consentDate' },
            { text: '.' },
          ],
        ],
        en: [
          [
            { text: '1. To recall ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ', from the annual paid labour leave from ' },
            { field: 'recallDate' },
            { text: '. Reason: ' },
            { field: 'reason' },
            { text: '.' },
          ],
          [
            { text: '2. The unused part of the leave of ' },
            { field: 'remainingDays' },
            { text: ' (' },
            { field: 'remainingDaysWords' },
            { text: ') calendar days shall be granted at a time agreed with the employee.' },
          ],
          [{ text: '3. To Accountant Department – to recalculate the leave payments.' }],
          [
            { text: 'Basis: ', bold: true },
            { text: 'written consent of the employee dated ' },
            { field: 'consentDate' },
            { text: '.' },
          ],
        ],
      },
    }),
  },

  {
    id: 'hr-bonus-order',
    title: 'Приказ о поощрении (премировании)',
    sectionId: 'hr',
    subsectionId: 'hr-personnel-orders',
    series: 'К',
    profile: 'standard',
    purpose: 'Премия, благодарность или иное поощрение работника за результат.',
    reviewed: false,
    layout: 'order',
    // Казахский и английский текст написан по образцу присланных приказов
    // теми же оборотами. Ссылки на статью закона здесь нет: для этого
    // документа она не прислана, а нормы права не выдумываются.
    langs: ['kk', 'ru', 'en'],
    fields: [
      {
        id: 'employee',
        kind: 'employee',
        label: 'Работник',
        required: true,
        group: 'Работник',
        perLang: true,
      },
      { id: 'position', kind: 'text', label: 'Должность', required: true, group: 'Работник', perLang: true },
      {
        id: 'kind',
        kind: 'select',
        label: 'Вид поощрения',
        required: true,
        group: 'Поощрение',
        options: ['премия', 'благодарность', 'ценный подарок', 'почётная грамота'],
        // Виды поощрения по Трудовому кодексу РК; перевод – на проверку
        // носителю языка (docs/questions.md).
        optionLabels: {
          'премия': { kk: 'сыйлықақы', en: 'bonus' },
          'благодарность': { kk: 'алғыс', en: 'commendation' },
          'ценный подарок': { kk: 'бағалы сыйлық', en: 'valuable gift' },
          'почётная грамота': { kk: 'құрмет грамотасы', en: 'certificate of honour' },
        },
      },
      {
        id: 'amount',
        kind: 'money',
        label: 'Сумма премии',
        required: false,
        unit: '₸',
        group: 'Поощрение',
        hint: 'Только для денежного поощрения. Для благодарности оставьте пустым',
      },
      {
        id: 'reason',
        kind: 'textarea',
        label: 'За что',
        required: true,
        group: 'Поощрение',
        perLang: true,
        hint: 'Например: за досрочное завершение проекта подстанции',
      },
      {
        id: 'memoDate',
        kind: 'date',
        label: 'Дата представления руководителя',
        required: true,
        group: 'Основание',
        dateLimits: { notAfter: 'today' },
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Қызметкерді көтермелеу туралы»', bold: true }]],
        ru: [[{ text: '«О поощрении работника»', bold: true }]],
        en: [[{ text: '“On the incentive award to the employee”', bold: true }]],
      },
      body: {
        kk: [
          [
            { text: '1. ' },
            { field: 'position' },
            { text: ' ' },
            { field: 'employee:nom', bold: true },
            { text: ' көтермеленсін. Көтермелеу түрі: ' },
            { field: 'kind' },
            { text: '. Себебі: ' },
            { field: 'reason' },
            { text: '.' },
          ],
          [
            { text: '2. Бухгалтерия ' },
            { field: 'amount' },
            { text: ' теңге сыйақыны ең жақын жалақы төлемімен бірге төлесін.' },
          ],
          [
            {
              text:
                '3. Кадр бөлімі көтермелеу туралы мәліметті қызметкердің жеке карточкасына ' +
                'енгізсін.',
            },
          ],
          [
            { text: 'Негіздеме: ', bold: true },
            { text: 'бөлім басшысының ' },
            { field: 'memoDate' },
            { text: ' жылғы ұсынысы.' },
          ],
        ],
        ru: [
          [
            { text: '1. Поощрить ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: '. Вид поощрения: ' },
            { field: 'kind' },
            { text: '. За ' },
            { field: 'reason' },
            { text: '.' },
          ],
          [
            { text: '2. Бухгалтерии выплатить премию в размере ' },
            { field: 'amount' },
            { text: ' тенге в ближайшую выплату заработной платы.' },
          ],
          [
            {
              text:
                '3. Отделу кадров внести сведения о поощрении в личную карточку работника.',
            },
          ],
          [
            { text: 'Основание: ', bold: true },
            { text: 'представление руководителя подразделения от ' },
            { field: 'memoDate' },
            { text: '.' },
          ],
        ],
        en: [
          [
            { text: '1. To award ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: '. Type of award: ' },
            { field: 'kind' },
            { text: '. For ' },
            { field: 'reason' },
            { text: '.' },
          ],
          [
            { text: '2. To Accountant Department – to pay the bonus of ' },
            { field: 'amount' },
            { text: ' tenge together with the nearest salary payment.' },
          ],
          [
            {
              text:
                '3. To HR Department – to enter the award record in the personal card of ' +
                'the employee.',
            },
          ],
          [
            { text: 'Basis: ', bold: true },
            { text: 'proposal of the head of the department dated ' },
            { field: 'memoDate' },
            { text: '.' },
          ],
        ],
      },
    }),
  },

  {
    id: 'hr-discipline-order',
    title: 'Приказ о применении дисциплинарного взыскания',
    sectionId: 'hr',
    subsectionId: 'hr-personnel-orders',
    series: 'К',
    // Взыскание – узкий круг (catalog/profiles.yaml, профиль sensitive).
    profile: 'sensitive',
    purpose: 'Замечание или выговор работнику. Объяснительная обязательна до приказа.',
    reviewed: false,
    layout: 'order',
    // Казахский и английский текст написан по образцу присланных приказов
    // теми же оборотами. Ссылки на статью закона здесь нет: для этого
    // документа она не прислана, а нормы права не выдумываются.
    langs: ['kk', 'ru', 'en'],
    fields: [
      {
        id: 'employee',
        kind: 'employee',
        label: 'Работник',
        required: true,
        group: 'Работник',
        perLang: true,
      },
      { id: 'position', kind: 'text', label: 'Должность', required: true, group: 'Работник', perLang: true },
      {
        id: 'penalty',
        kind: 'select',
        label: 'Вид взыскания',
        required: true,
        group: 'Взыскание',
        options: ['замечание', 'выговор', 'строгий выговор'],
        // Виды взыскания по статье 64 Трудового кодекса РК; перевод – на
        // проверку носителю языка (docs/questions.md).
        optionLabels: {
          'замечание': { kk: 'ескерту', en: 'remark' },
          'выговор': { kk: 'сөгіс', en: 'reprimand' },
          'строгий выговор': { kk: 'қатаң сөгіс', en: 'severe reprimand' },
        },
      },
      {
        id: 'violationDate',
        kind: 'date',
        label: 'Дата проступка',
        required: true,
        group: 'Взыскание',
        dateLimits: { notAfter: 'today' },
      },
      {
        id: 'violation',
        kind: 'textarea',
        label: 'В чём состоит проступок',
        required: true,
        group: 'Взыскание',
        perLang: true,
        hint: 'Что именно нарушено и чем это подтверждается',
      },
      {
        // Взыскание без затребованного объяснения оспаривается, поэтому
        // дата обязательна и в будущем стоять не может.
        id: 'explanationDate',
        kind: 'date',
        label: 'Дата объяснительной работника',
        required: true,
        group: 'Основание',
        dateLimits: { notAfter: 'today' },
      },
      {
        id: 'actNumber',
        kind: 'text',
        label: 'Номер акта или служебной записки',
        required: true,
        group: 'Основание',
      },
    ],
    body: orderBody({
      subject: {
        kk: [[{ text: '«Тәртіптік жаза қолдану туралы»', bold: true }]],
        ru: [[{ text: '«О применении дисциплинарного взыскания»', bold: true }]],
        en: [[{ text: '“On imposing a disciplinary sanction”', bold: true }]],
      },
      basis: {
        kk: [[{ text: 'ҚР 2015 жылғы 23 қарашадағы №414-V Еңбек кодексінің 64-бабына сәйкес.' }]],
        ru: [[{ text: 'В соответствии со статьей 64 Трудового Кодекса РК от 23 ноября 2015 года №414-V.' }]],
        en: [[{ text: 'In accordance with Article 64 of the Labor Code of the Republic of Kazakhstan dated November 23, 2015 No. 414-V.' }]],
      },
      body: {
        kk: [
          [
            { text: '1. ' },
            { field: 'position' },
            { text: ' ' },
            { field: 'employee:nom', bold: true },
            { text: ' ' },
            { field: 'violationDate' },
            { text: ' жіберген тәртіп бұзушылығы үшін «' },
            { field: 'penalty' },
            { text: '» түріндегі тәртіптік жаза қолданылсын: ' },
            { field: 'violation' },
            { text: '.' },
          ],
          [
            {
              text:
                '2. Кадр бөлімі қызметкерді осы бұйрықпен қол қойғыза отырып таныстырсын ' +
                'және бұйрықты жеке іс материалдарына тіркесін.',
            },
          ],
          [
            { text: 'Негіздеме: ', bold: true },
            { text: 'қызметкердің ' },
            { field: 'explanationDate' },
            { text: ' жылғы түсініктемесі, № ' },
            { field: 'actNumber' },
            { text: ' акт.' },
          ],
        ],
        ru: [
          [
            { text: '1. Применить к ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ', дисциплинарное взыскание в виде «' },
            { field: 'penalty' },
            { text: '» за нарушение, допущенное ' },
            { field: 'violationDate' },
            { text: ': ' },
            { field: 'violation' },
            { text: '.' },
          ],
          [
            {
              text:
                '2. Отделу кадров ознакомить работника с настоящим приказом под подпись ' +
                'и приобщить приказ к материалам личного дела.',
            },
          ],
          [
            { text: 'Основание: ', bold: true },
            { text: 'объяснительная работника от ' },
            { field: 'explanationDate' },
            { text: ', акт № ' },
            { field: 'actNumber' },
            { text: '.' },
          ],
        ],
        en: [
          [
            { text: '1. To impose on ' },
            { field: 'employee', bold: true },
            { text: ', ' },
            { field: 'position' },
            { text: ', a disciplinary sanction in the form of “' },
            { field: 'penalty' },
            { text: '” for the violation committed on ' },
            { field: 'violationDate' },
            { text: ': ' },
            { field: 'violation' },
            { text: '.' },
          ],
          [
            {
              text:
                '2. To HR Department – to acquaint the employee with this order against ' +
                'signature and to attach the order to the personal file.',
            },
          ],
          [
            { text: 'Basis: ', bold: true },
            { text: 'explanatory note of the employee dated ' },
            { field: 'explanationDate' },
            { text: ', act No. ' },
            { field: 'actNumber' },
            { text: '.' },
          ],
        ],
      },
    }),
  },

  {
    id: 'hr-work-certificate',
    title: 'Справка с места работы',
    sectionId: 'hr',
    subsectionId: 'hr-documents',
    series: 'Исх',
    profile: 'standard',
    purpose: 'Подтверждает место работы и должность. Выдаётся по заявлению работника.',
    reviewed: false,
    layout: 'order',
    // Казахский и английский текст написан по образцу присланных приказов
    // теми же оборотами. Ссылки на статью закона здесь нет: для этого
    // документа она не прислана, а нормы права не выдумываются.
    langs: ['kk', 'ru', 'en'],
    fields: [
      {
        id: 'employee',
        kind: 'employee',
        label: 'Работник',
        required: true,
        group: 'Работник',
        perLang: true,
      },
      { id: 'position', kind: 'text', label: 'Должность', required: true, group: 'Работник', perLang: true },
      { id: 'unit', kind: 'text', label: 'Подразделение', required: true, group: 'Работник', perLang: true },
      {
        id: 'startDate',
        kind: 'date',
        label: 'Работает с',
        required: true,
        group: 'Работник',
        dateLimits: { notAfter: 'today' },
      },
      {
        id: 'destination',
        kind: 'text',
        label: 'Куда предъявляется',
        required: true,
        group: 'Назначение',
        perLang: true,
        hint: 'Например: по месту требования, в банк, в посольство',
      },
    ],
    body: documentBody({
      words: DOCUMENT_WORDS.certificate,
      body: {
        kk: [
          [
            { field: 'employee:nom', bold: true },
            { text: ' ' },
            { field: '@company.legalNameKk', fallback: '@company.legalName' },
            { text: ' ұйымында «' },
            { field: 'unit' },
            { text: '» бөлімінде «' },
            { field: 'position' },
            { text: '» лауазымында ' },
            { field: 'startDate' },
            { text: ' бастап осы уақытқа дейін жұмыс істейтіні туралы осы анықтама берілді.' },
          ],
          [
            { text: 'Анықтама ' },
            { field: 'destination' },
            { text: ' үшін берілді.' },
          ],
        ],
        ru: [
          [
            { text: 'Настоящая справка выдана в том, что ' },
            { field: 'employee:nom', bold: true },
            { text: ' работает в организации ' },
            { field: '@company.legalName' },
            { text: ' в должности «' },
            { field: 'position' },
            { text: '» в подразделении «' },
            { field: 'unit' },
            { text: '» с ' },
            { field: 'startDate' },
            { text: ' по настоящее время.' },
          ],
          [
            { text: 'Справка выдана для предъявления: ' },
            { field: 'destination' },
            { text: '.' },
          ],
        ],
        en: [
          [
            { text: 'This certificate is issued to confirm that ' },
            { field: 'employee', bold: true },
            { text: ' works at ' },
            { field: '@company.legalNameEn', fallback: '@company.legalName' },
            { text: ' in the position of “' },
            { field: 'position' },
            { text: '” in the “' },
            { field: 'unit' },
            { text: '” unit from ' },
            { field: 'startDate' },
            { text: ' to the present time.' },
          ],
          [
            { text: 'The certificate is issued for submission to: ' },
            { field: 'destination' },
            { text: '.' },
          ],
        ],
      },
    }),
  },
];

/**
 * Все шаблоны системы.
 *
 * Сначала те, что стоят на настоящем бланке группы: их человек открывает
 * чаще, и именно они показывают, как документ выглядит на бумаге.
 */
/**
 * Трёхъязычные шаблоны, заменённые формами по образцам («Тест день 4»,
 * дополнение; решение человека 30.09): старый → новый.
 */
const REPLACED: Record<string, string> = {
  'finance-work-act': 'finance-act-r1',
  'finance-invoice': 'finance-invoice-kz',
  'procurement-sales-offer': 'procurement-sales-quote',
};

export const templates: DocumentTemplate[] = [
  ...blankTemplates,
  ...simpleTemplates,
  ...activityOrders,
  // Формы с таблицей позиций: акт Р-1, накладная З-2, счёт, КП.
  ...formTemplates,
  // Типовые шаблоны – в конце: образца от компании для них нет.
  ...genericTemplatesA,
  ...genericTemplatesB,
].map((tpl) => {
  const replacedBy = REPLACED[tpl.id];
  return replacedBy === undefined ? tpl : { ...tpl, replacedBy };
});

/**
 * Шаблоны по идентификатору. Каталог спрашивает шаблон для каждой из ~350
 * строк, и поиск перебором по списку на каждой строке делал это ~120 тысяч
 * сравнений на одно нажатие клавиши в поиске (оптимизация 01.10).
 */
const templatesById = new Map(templates.map((tpl) => [tpl.id, tpl]));

export function findTemplate(id: string): DocumentTemplate | undefined {
  return templatesById.get(id);
}

/**
 * Документы, которые учтены в каталоге, но шаблон для них ещё не заполнен.
 *
 * Показываются наравне с готовыми и честно помечаются: иначе человек решит,
 * что система документ не поддерживает, и уйдёт делать его в Word. Сейчас
 * список пуст: оставшиеся документы получили типовые шаблоны
 * (`templates-generic*.ts`, «Тест день 2»). Новый документ каталога без
 * шаблона добавляется сюда.
 */
const soon: Array<[string, string, string]> = [];

export const catalogEntries: CatalogEntry[] = [
  // Заменённые шаблоны в каталоге не показываются: создать по ним новый
  // документ нельзя, открыть созданный – можно.
  ...templates.filter((tpl) => tpl.replacedBy === undefined).map<CatalogEntry>((tpl) => ({
    id: tpl.id,
    title: tpl.title,
    sectionId: tpl.sectionId,
    subsectionId: tpl.subsectionId,
    state: 'ready',
  })),
  ...soon.map<CatalogEntry>(([title, sectionId, subsectionId], index) => ({
    id: `soon-${index}`,
    title,
    sectionId,
    subsectionId,
    state: 'soon',
  })),
];
