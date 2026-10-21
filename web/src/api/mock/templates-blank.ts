/**
 * Шаблоны на настоящем бланке группы.
 *
 * Текст взят из документов, которые вы прислали (папка «Шаблоны»), а не
 * составлен заново. Переменные части – ФИО, должности, даты, номера – вынуты
 * в поля формы, постоянные оставлены буквой в букву, включая ссылки на статьи
 * Трудового кодекса: реквизиты норм права не выдумываются (CLAUDE.md, п. 4.9),
 * а здесь они пришли из ваших же приказов.
 *
 * Откуда что взято:
 *
 * | Шаблон                        | Образец                                  |
 * |-------------------------------|------------------------------------------|
 * | Приём на работу               | Order EA Дидар Сагын, Приказ EA Aliya    |
 * | Ежегодный трудовой отпуск     | AL Maksut, AL Nurdaulet KNT              |
 * | Отпуск без сохранения з/п     | unpaid leave Dias 13.03.2026             |
 * | Назначение директора          | Order EA Dinara Kakimova, Приказ о назн. |
 * | Доверенность                  | PoA Nurdaulet KNT, Доверенность GS       |
 *
 * ЧТО ОБЯЗАТЕЛЬНО ПРОВЕРИТЬ КАЗАХОЯЗЫЧНОМУ ЮРИСТУ. В казахском падежное
 * окончание зависит от последнего звука слова: в ваших приказах стоит и
 * «23.06.2026-нан», и «04.09.2026-дан», и «02.07.2026-ті», и «27.09.2026-ны».
 * Выбрать окончание программно нельзя – оно зависит от того, как число
 * читается вслух. Здесь окончания оставлены такими, как в образце, и при
 * других датах будут неверными. Это главная причина, по которой все эти
 * шаблоны помечены `reviewed: false`.
 */
import type { DocumentTemplate } from '@/api/types';

/** Ссылка на Трудовой кодекс так, как она напечатана в ваших приказах. */
const LABOUR_CODE = {
  kk: 'ҚР 2015 жылғы 23 қарашадағы №414-V Еңбек кодексінің',
  ru: 'Трудового Кодекса РК от 23 ноября 2015 года №414-V',
  en: 'of the Labor Code of the Republic of Kazakhstan dated November 23, 2015 No. 414-V',
};

/**
 * Заголовок приказа.
 *
 * Разрядка записана прямо в тексте, а не считается кодом: в ваших приказах
 * вразрядку набрано только казахское слово, а «ПРИКАЗ» и «ORDER» – обычным
 * набором. Считать это программно значило бы решать за документ.
 */
const ORDER_WORDS = { kk: 'Б Ұ Й Р Ы Қ', ru: 'ПРИКАЗ', en: 'ORDER' };

/** Строка перед распоряжением. Здесь вразрядку уже и казахское, и русское. */
const ORDERED_WORDS = {
  kk: 'Б Ұ Й Ы Р А М Ы Н',
  ru: 'П Р И К А З Ы В А Ю',
  en: 'IT IS HEREBY ORDERED:',
};

export const blankTemplates: DocumentTemplate[] = [
  /* ═══════════════════════════════════════════════════════════════════════
     Приказ о приёме на работу
     Образец: «Order EA Дидар Сагын.docx», «Приказ EA Aliya.docx»
     ═══════════════════════════════════════════════════════════════════════ */
  {
    id: 'hr-hire-order',
    title: 'Приказ о приёме на работу',
    sectionId: 'hr',
    subsectionId: 'hr-personnel-orders',
    series: 'ЛС',
    profile: 'standard',
    purpose: 'Оформляет выход нового работника. Основание – подписанный трудовой договор.',
    reviewed: false,
    layout: 'order',
    langs: ['kk', 'ru', 'en'],
    fields: [
      {
        id: 'employee',
        kind: 'employee',
        label: 'Работник',
        required: true,
        group: 'Работник',
        hint: 'Должность подставится из справочника. ФИО на казахском и латиницей берётся оттуда же',
        perLang: true,
      },
      { id: 'position', kind: 'text', label: 'Должность', required: true, group: 'Работник', perLang: true },
      {
        id: 'startDate',
        kind: 'date',
        label: 'Дата приёма',
        required: true,
        group: 'Условия',
        dateLimits: { notBefore: 'today' },
      },
      {
        id: 'contractNumber',
        kind: 'text',
        label: 'Номер трудового договора',
        required: true,
        group: 'Основание',
        hint: 'Как в договоре: 004-2026/GS',
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
    body: [
      { kind: 'letterhead' },
      { kind: 'place-date' },
      { kind: 'order-title', words: ORDER_WORDS },
      {
        kind: 'tri-table',
        rows: [
          {
            kk: [
              [{ text: '«Жұмысқа қабылдау туралы»', bold: true }],
              [
                {
                  text:
                    'ҚР Еңбек Кодексінің 2015 жылғы 23 қарашадағы № 414-V ҚРЗ ' +
                    '34-бабына сәйкес',
                },
              ],
            ],
            ru: [
              [{ text: '«О приеме на работу»', bold: true }],
              [
                {
                  text:
                    'В соответствии со статьей 34 Трудового Кодекса РК от 23 ноября ' +
                    '2015 г. № 414-V',
                },
              ],
            ],
            en: [
              [{ text: '“Employment order”', bold: true }],
              [
                {
                  text:
                    'In accordance with Article 34 of the Labor Code of the Republic ' +
                    'of Kazakhstan dated November 23, 2015 No. 414-V',
                },
              ],
            ],
          },
        ],
      },
      { kind: 'tri-line', words: ORDERED_WORDS },
      {
        kind: 'tri-table',
        rows: [
          {
            kk: [
              [
                { field: 'employee:nom' },
                { text: ', ' },
                { field: 'contractDate' },
                { text: ' жылғы № ' },
                { field: 'contractNumber' },
                { text: ' еңбек шартына сәйкес ' },
                { field: 'startDate' },
                { text: ' бастап «' },
                { field: 'position' },
                { text: '» ретінде қабылдансын.' },
              ],
            ],
            ru: [
              [
                { text: 'Принять ' },
                { field: 'employee' },
                { text: ' в качестве «' },
                { field: 'position' },
                { text: '» с ' },
                { field: 'startDate' },
                { text: ' в соответствии с Трудовым Договором № ' },
                { field: 'contractNumber' },
                { text: ' от ' },
                { field: 'contractDate' },
                { text: ' года.' },
              ],
            ],
            en: [
              [
                { text: 'To accept ' },
                { field: 'employee' },
                { text: ' as a “' },
                { field: 'position' },
                { text: '” from ' },
                { field: 'startDate' },
                { text: ', in accordance with the Labor Contract No. ' },
                { field: 'contractNumber' },
                { text: ' dated ' },
                { field: 'contractDate' },
                { text: '.' },
              ],
            ],
          },
          {
            kk: [
              [
                { text: 'Негіз: ' },
                { field: 'contractDate' },
                { text: ' жылғы № ' },
                { field: 'contractNumber' },
                { text: ' Еңбек шарты.' },
              ],
            ],
            ru: [
              [
                { text: 'Основание: Трудовой договор № ' },
                { field: 'contractNumber' },
                { text: ' от ' },
                { field: 'contractDate' },
                { text: ' года.' },
              ],
            ],
            en: [
              [
                { text: 'Basis: Employment contract No. ' },
                { field: 'contractNumber' },
                { text: ' dated ' },
                { field: 'contractDate' },
                { text: '.' },
              ],
            ],
          },
        ],
      },
      { kind: 'tri-signature' },
      { kind: 'tri-acquaint' },
    ],
  },

  /* ═══════════════════════════════════════════════════════════════════════
     Приказ о предоставлении ежегодного трудового отпуска
     Образец: «AL Maksut 07.09.2026.docx», «AL Nurdaulet KNT.docx»
     ═══════════════════════════════════════════════════════════════════════ */
  {
    id: 'hr-vacation-order',
    title: 'Приказ о предоставлении ежегодного трудового отпуска',
    sectionId: 'hr',
    subsectionId: 'hr-personnel-orders',
    series: 'ЛС',
    profile: 'standard',
    purpose: 'Ежегодный оплачиваемый трудовой отпуск по заявлению работника.',
    reviewed: false,
    layout: 'order',
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
        id: 'days',
        kind: 'number',
        label: 'Продолжительность',
        required: true,
        unit: 'кал. дней',
        group: 'Период отпуска',
      },
      {
        id: 'daysWords',
        // Число прописью в каждой колонке своё: «двадцать четыре»,
        // «жиырма төрт», «twenty-four». Считается из числа дней, но
        // остаётся полем – слова можно поправить.
        wordsOf: 'days',
        perLang: true,
        kind: 'text',
        label: 'Продолжительность прописью',
        required: true,
        group: 'Период отпуска',
        // В ваших приказах число всегда продублировано словами: «10 (десять)»,
        // «24 (двадцать четыре)». Сумма и число прописью – серверная функция с
        // табличными тестами (CLAUDE.md, п. 3.9), её ещё нет; пока вводится руками.
        hint: 'Как в приказе: десять, двадцать четыре',
      },
      {
        id: 'from',
        kind: 'date',
        label: 'Первый день отпуска',
        required: true,
        group: 'Период отпуска',
        dateLimits: { notBefore: 'today' },
      },
      {
        id: 'to',
        kind: 'date',
        label: 'Последний день отпуска',
        required: true,
        group: 'Период отпуска',
        dateLimits: { afterField: 'from' },
      },
      {
        id: 'workedFrom',
        kind: 'date',
        label: 'Рабочий период с',
        required: true,
        group: 'Рабочий период',
        dateLimits: { notAfter: 'today' },
        hint: 'За какой отработанный период даётся отпуск',
      },
      {
        id: 'workedTo',
        kind: 'date',
        label: 'Рабочий период по',
        required: true,
        group: 'Рабочий период',
        dateLimits: { afterField: 'workedFrom' },
      },
      {
        id: 'applicationDate',
        kind: 'date',
        label: 'Дата заявления работника',
        required: true,
        group: 'Основание',
        dateLimits: { notAfter: 'today' },
      },
    ],
    body: [
      { kind: 'letterhead' },
      { kind: 'place-date' },
      { kind: 'order-title', words: ORDER_WORDS },
      {
        kind: 'tri-table',
        rows: [
          {
            kk: [
              [{ text: '«Жыл сайынғы еңбек демалысын беру туралы»', bold: true }],
              [{ text: `${LABOUR_CODE.kk} 87-бабының 2-тармағына сәйкес.` }],
            ],
            ru: [
              [{ text: '«О предоставлении ежегодного трудового отпуска»', bold: true }],
              [{ text: `В соответствии с пунктом 2 статьи 87 ${LABOUR_CODE.ru}.` }],
            ],
            en: [
              [{ text: '“On annual vacation leave”', bold: true }],
              [{ text: `In accordance with paragraph 2 of Article 87 ${LABOUR_CODE.en}.` }],
            ],
          },
        ],
      },
      { kind: 'tri-line', words: ORDERED_WORDS },
      {
        kind: 'tri-table',
        rows: [
          {
            kk: [
              [
                { text: '1. ' },
                { field: 'employee' },
                { text: ' ' },
                { field: 'position' },
                { text: ' ' },
                { field: 'from' },
                { text: ' бастап ' },
                { field: 'to' },
                { text: ' қоса алғанда, ' },
                { field: 'workedFrom' },
                { text: ' – ' },
                { field: 'workedTo' },
                { text: ' жұмыс кезеңі үшін ұзақтығы ' },
                { field: 'days' },
                { text: ' (' },
                { field: 'daysWords' },
                { text: ') күнтізбелік күн жыл сайынғы ақылы еңбек демалысын беру.' },
              ],
              [
                {
                  text:
                    '2. Бухгалтерия Қазақстан Республикасының қолданыстағы заңнамасында ' +
                    'белгіленген мерзімде және тәртіппен жұмыс істеген кезеңі үшін демалыс ' +
                    'күндерін есептесін.',
                },
              ],
              [
                { text: '3. Негіздеме: ' },
                { field: 'applicationDate' },
                { text: ' жылғы ' },
                { field: 'employee:nom' },
                { text: 'ның жеке мәлімдемесі.' },
              ],
            ],
            ru: [
              [
                { text: '1. Предоставить ежегодный оплачиваемый трудовой отпуск ' },
                { field: 'position' },
                { text: ' ' },
                { field: 'employee' },
                { text: ' продолжительностью ' },
                { field: 'days' },
                { text: ' (' },
                { field: 'daysWords' },
                { text: ') календарных дней с ' },
                { field: 'from' },
                { text: ' по ' },
                { field: 'to' },
                { text: ' включительно, за период работы с ' },
                { field: 'workedFrom' },
                { text: ' по ' },
                { field: 'workedTo' },
                { text: '.' },
              ],
              [
                {
                  text:
                    '2. Бухгалтерии рассчитать отпускные дни за отработанный период работы ' +
                    'в срок и в порядке, установленные действующим законодательством ' +
                    'Республики Казахстан.',
                },
              ],
              [
                { text: '3. Основание: личное заявление ' },
                { field: 'employee' },
                { text: ' от ' },
                { field: 'applicationDate' },
                { text: ' года.' },
              ],
            ],
            en: [
              [
                { text: '1. To provide paid annual leave to the ' },
                { field: 'position' },
                { text: ' ' },
                { field: 'employee' },
                { text: ', for the duration of ' },
                { field: 'days' },
                { text: ' (' },
                { field: 'daysWords' },
                { text: ') calendar days from ' },
                { field: 'from' },
                { text: ' to ' },
                { field: 'to' },
                { text: ' inclusive, for the worked period from ' },
                { field: 'workedFrom' },
                { text: ' till ' },
                { field: 'workedTo' },
                { text: '.' },
              ],
              [
                {
                  text:
                    '2. To Accountant Department – to perform payment for the worked period ' +
                    'within the time and according to the procedure stated by the current ' +
                    'legislation of the Republic of Kazakhstan.',
                },
              ],
              [
                { text: '3. Basis: personal statement of ' },
                { field: 'employee' },
                { text: ' dated ' },
                { field: 'applicationDate' },
                { text: '.' },
              ],
            ],
          },
        ],
      },
      { kind: 'tri-signature' },
      { kind: 'tri-acquaint' },
    ],
  },

  /* ═══════════════════════════════════════════════════════════════════════
     Приказ о предоставлении отпуска без сохранения заработной платы
     Образец: «unpaid leave Dias 13.03.2026.docx»
     ═══════════════════════════════════════════════════════════════════════ */
  {
    id: 'hr-unpaid-leave-order',
    title: 'Приказ о предоставлении отпуска без сохранения заработной платы',
    sectionId: 'hr',
    subsectionId: 'hr-personnel-orders',
    series: 'ЛС',
    profile: 'standard',
    purpose: 'Отпуск за свой счёт по личному заявлению работника.',
    reviewed: false,
    layout: 'order',
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
        id: 'from',
        kind: 'date',
        label: 'Первый день отпуска',
        required: true,
        group: 'Отпуск',
        dateLimits: { notBefore: 'today' },
      },
      {
        id: 'days',
        kind: 'number',
        label: 'Продолжительность',
        required: true,
        unit: 'кал. дней',
        group: 'Отпуск',
      },
      {
        id: 'daysWords',
        // Число прописью в каждой колонке своё: «двадцать четыре»,
        // «жиырма төрт», «twenty-four». Считается из числа дней, но
        // остаётся полем – слова можно поправить.
        wordsOf: 'days',
        perLang: true,
        kind: 'text',
        label: 'Продолжительность прописью',
        required: true,
        group: 'Отпуск',
        hint: 'Как в приказе: один, три',
      },
      {
        id: 'applicationDate',
        kind: 'date',
        label: 'Дата заявления работника',
        required: true,
        group: 'Основание',
        dateLimits: { notAfter: 'today' },
      },
    ],
    body: [
      { kind: 'letterhead' },
      { kind: 'place-date' },
      { kind: 'order-title', words: ORDER_WORDS },
      {
        kind: 'tri-table',
        rows: [
          {
            kk: [
              [{ text: '«Жалақысы сақталмайтын демалысын беру туралы»', bold: true }],
              [
                {
                  text:
                    'Қазақстан Республикасының 2015 жылғы 23 қарашадағы № 414-V ' +
                    'Еңбек кодексінің 87-бабының 5-тармағының 1-тармақшасына сәйкес.',
                },
              ],
            ],
            ru: [
              [{ text: '«О предоставлении отпуска без сохранения заработной платы»', bold: true }],
              [
                {
                  text:
                    'В соответствии с подпунктом 1, пункта 5 статьи 87 Трудового ' +
                    'Кодекса РК от 23 ноября 2015 года №414-V.',
                },
              ],
            ],
            en: [
              [{ text: '“On granting unpaid leave”', bold: true }],
              [
                {
                  text:
                    'In accordance with subparagraph 1, paragraph 5 of Article 87 of ' +
                    'the Labor Code of the Republic of Kazakhstan dated November 23, ' +
                    '2015 No. 414-V.',
                },
              ],
            ],
          },
        ],
      },
      { kind: 'tri-line', words: ORDERED_WORDS },
      {
        kind: 'tri-table',
        rows: [
          {
            kk: [
              [
                { text: '1. ' },
                { field: 'position' },
                { text: ' ' },
                { field: 'employee' },
                { text: ' ' },
                { field: 'from' },
                { text: ' бастап ' },
                { field: 'days' },
                { text: ' (' },
                { field: 'daysWords' },
                { text: ') күнтізбелік күн мерзімге ақысыз демалыс беру.' },
              ],
              [
                { text: 'Негіздеме: ' },
                { field: 'employee:nom' },
                { text: 'ның ' },
                { field: 'applicationDate' },
                { text: ' жылғы жеке өтініші.' },
              ],
            ],
            ru: [
              [
                { text: '1. Предоставить отпуск без сохранения заработной платы ' },
                { field: 'position' },
                { text: ' ' },
                { field: 'employee' },
                { text: ' с ' },
                { field: 'from' },
                { text: ' сроком на ' },
                { field: 'days' },
                { text: ' (' },
                { field: 'daysWords' },
                { text: ') календарный день.' },
              ],
              [
                { text: 'Основание: личное заявление ' },
                { field: 'employee' },
                { text: ' от ' },
                { field: 'applicationDate' },
                { text: ' года.' },
              ],
            ],
            en: [
              [
                { text: '1. To grant unpaid leave to the ' },
                { field: 'position' },
                { text: ' ' },
                { field: 'employee' },
                { text: ' from ' },
                { field: 'from' },
                { text: ', for a period of ' },
                { field: 'days' },
                { text: ' (' },
                { field: 'daysWords' },
                { text: ') calendar day(s).' },
              ],
              [
                { text: 'Basis: Personal request of ' },
                { field: 'employee' },
                { text: ' dated ' },
                { field: 'applicationDate' },
                { text: '.' },
              ],
            ],
          },
        ],
      },
      { kind: 'tri-signature' },
      { kind: 'tri-acquaint' },
    ],
  },

  /* ═══════════════════════════════════════════════════════════════════════
     Приказ о назначении директора
     Образец: «Order EA Dinara Kakimova.docx», «Приказ о назн. директора.docx»
     ═══════════════════════════════════════════════════════════════════════ */
  {
    id: 'corporate-director-appointment',
    title: 'Приказ о назначении директора',
    sectionId: 'corporate',
    subsectionId: 'corporate-orders',
    series: 'Корп',
    // Назначение первого руководителя – узкий круг: приказ ложится в основу
    // права первой подписи (catalog/profiles.yaml, профиль sensitive).
    profile: 'sensitive',
    purpose: 'Вступление руководителя в должность с правом первой подписи.',
    reviewed: false,
    layout: 'order',
    langs: ['kk', 'ru', 'en'],
    fields: [
      {
        id: 'employee',
        kind: 'employee',
        label: 'Кто назначается',
        required: true,
        group: 'Назначение',
        hint: 'Если человека ещё нет в справочнике, впишите ФИО вручную',
        perLang: true,
      },
      {
        id: 'position',
        kind: 'text',
        label: 'Должность',
        required: true,
        group: 'Назначение',
        hint: 'Как в уставе: Генеральный директор, Директор',
        perLang: true,
      },
      {
        id: 'startDate',
        kind: 'date',
        label: 'Вступает в должность с',
        required: true,
        group: 'Назначение',
        dateLimits: { notBefore: 'today' },
      },
      {
        id: 'decisionDate',
        kind: 'date',
        label: 'Дата решения участников',
        required: true,
        group: 'Основание',
        dateLimits: { notAfter: 'today' },
        // «2026 жылғы 22 қыркүйегіндегі», «22 сентября 2026 года»,
        // «September 22, 2026» – в приказе о назначении дата написана
        // прописью, а не числами.
        dateStyle: 'long',
      },
    ],
    body: [
      { kind: 'letterhead' },
      { kind: 'place-date' },
      { kind: 'order-title', words: ORDER_WORDS },
      {
        kind: 'tri-table',
        rows: [
          {
            kk: [
              [{ text: '«Директорды тағайындау туралы»', bold: true }],
              [
                { field: '@company.legalNameKk', fallback: '@company.legalName' },
                { text: ' қатысушыларының ' },
                { field: 'decisionDate' },
                { text: ' шешіміне сәйкес.' },
              ],
            ],
            ru: [
              [{ text: '«О назначении Директора»', bold: true }],
              [
                { text: 'На основании решения участников ' },
                { field: '@company.name' },
                { text: ' от ' },
                { field: 'decisionDate' },
                { text: ' года.' },
              ],
            ],
            en: [
              [{ text: '“On the appointment of the Director”', bold: true }],
              [
                { text: 'Based on the decision of the participants of ' },
                { field: '@company.legalNameEn', fallback: '@company.legalName' },
                { text: ' dated ' },
                { field: 'decisionDate' },
                { text: '.' },
              ],
            ],
          },
        ],
      },
      { kind: 'tri-line', words: ORDERED_WORDS },
      {
        kind: 'tri-table',
        rows: [
          {
            kk: [
              [
                { field: 'employee:nom' },
                { text: ' ' },
                { field: 'startDate' },
                { text: ' бастап «' },
                { field: 'position' },
                { text: '» лауазымына барлық коммерциялық, бухгалтерлік және банктік ' },
                { text: 'құжаттарға бірінші қол қою құқығымен тағайындалсын.' },
              ],
            ],
            ru: [
              [
                { text: 'Назначить ' },
                { field: 'employee' },
                { text: ' на должность «' },
                { field: 'position' },
                { text: '» с ' },
                { field: 'startDate' },
                { text: ' с правом первой подписи на всех коммерческих, бухгалтерских ' },
                { text: 'и банковских документах.' },
              ],
            ],
            en: [
              [
                { text: 'To appoint ' },
                { field: 'employee' },
                { text: ' to the position of “' },
                { field: 'position' },
                { text: '” from ' },
                { field: 'startDate' },
                { text: ', with the right of first signature on all commercial, accounting ' },
                { text: 'and banking documents.' },
              ],
            ],
          },
        ],
      },
      { kind: 'tri-signature' },
      { kind: 'tri-acquaint' },
    ],
  },

  /* ═══════════════════════════════════════════════════════════════════════
     Доверенность
     Образец: «PoA Nurdaulet KNT.docx», «Доверенность GS Гульжиян.docx»
     Казахской колонки в ваших доверенностях нет – только русская и английская.
     ═══════════════════════════════════════════════════════════════════════ */
  {
    id: 'legal-power-single',
    title: 'Доверенность',
    sectionId: 'legal',
    subsectionId: 'legal-powers',
    series: 'PoA',
    profile: 'standard',
    purpose: 'Полномочия работнику подписывать документы и представлять компанию.',
    reviewed: false,
    layout: 'poa',
    langs: ['ru', 'en'],
    fields: [
      {
        id: 'employee',
        kind: 'employee',
        label: 'Поверенный',
        required: true,
        group: 'Кому выдаётся',
        hint: 'Кому выдаётся доверенность',
        perLang: true,
      },
      {
        id: 'birthDate',
        kind: 'date',
        label: 'Дата рождения',
        required: true,
        group: 'Кому выдаётся',
        dateLimits: { notAfter: 'today' },
      },
      {
        id: 'iin',
        kind: 'text',
        label: 'ИИН',
        required: true,
        group: 'Кому выдаётся',
        // ИИН – персональные данные. По CLAUDE.md, п. 3.10 он шифруется в базе
        // на уровне поля и маскируется на экране. Пока данные лежат в браузере,
        // он хранится открытым: см. PROGRESS.md, «Не сделано».
        hint: 'Двенадцать цифр. Попадает в текст доверенности',
      },
      {
        id: 'idNumber',
        kind: 'text',
        label: 'Номер удостоверения личности',
        required: true,
        group: 'Кому выдаётся',
      },
      {
        id: 'idDate',
        kind: 'date',
        label: 'Дата выдачи удостоверения',
        required: true,
        group: 'Кому выдаётся',
        dateLimits: { notAfter: 'today' },
      },
      {
        id: 'idIssuer',
        kind: 'text',
        label: 'Кем выдано удостоверение',
        required: true,
        group: 'Кому выдаётся',
        hint: 'Например: МВД Республики Казахстан',
        // На каждом языке доверенности; «МВД РК» переводится само («Тест день 4»).
        perLang: true,
        translate: 'issuer',
      },
      {
        id: 'address',
        kind: 'text',
        label: 'Адрес проживания',
        required: true,
        group: 'Кому выдаётся',
        hint: 'Английский подставится сам по правилам адреса',
        perLang: true,
        translate: 'address',
      },
      {
        id: 'powers',
        kind: 'textarea',
        label: 'Полномочия',
        required: true,
        group: 'Полномочия',
        hint: 'Перечислите с новой строки, как в доверенности',
      },
      {
        id: 'powersEn',
        kind: 'textarea',
        label: 'Полномочия на английском',
        required: false,
        group: 'Полномочия',
        hint: 'Не заполните – в английской колонке останется русский текст',
      },
      {
        id: 'until',
        kind: 'date',
        label: 'Действительна до',
        required: true,
        group: 'Срок',
        dateLimits: { notBefore: 'today' },
      },
    ],
    body: [
      { kind: 'letterhead' },
      {
        kind: 'poa-title',
        words: { ru: 'Доверенность', en: 'Power of Attorney' },
      },
      {
        kind: 'bi-table',
        rows: [
          {
            ru: [
              [
                { field: '@company.legalName' },
                { text: ', БИН ' },
                { field: '@company.bin' },
                { text: ', зарегистрированное в соответствии с законодательством Республики ' },
                { text: 'Казахстан, по адресу: ' },
                { field: '@company.address' },
                { text: ', в лице ' },
                { field: '@company.directorTitleGenitive' },
                { text: ' ' },
                { field: '@company.directorNameGenitive' },
                { text: ', действующего на основании ' },
                { field: '@company.directorBasis' },
                { text: ', (далее «Доверитель»), данным документом назначает и уполномочивает ' },
                { text: 'гражданина Республики Казахстан ' },
                { field: 'employee' },
                { text: ', ' },
                { field: 'birthDate' },
                { text: ' года рождения, ИИН ' },
                { field: 'iin' },
                { text: ', удостоверение личности № ' },
                { field: 'idNumber' },
                { text: ', выданное ' },
                { field: 'idDate' },
                { text: ' года ' },
                { field: 'idIssuer' },
                { text: ', проживающего по адресу: ' },
                { field: 'address' },
                { text: ' (далее – «Поверенный»), совершать от имени и в интересах Доверителя ' },
                { text: 'на территории Республики Казахстан следующие действия:' },
              ],
              [{ field: 'powers' }],
              [
                { text: 'Настоящая доверенность выдана без права передоверия сроком до ' },
                { field: 'until' },
                { text: ' включительно.' },
              ],
            ],
            en: [
              [
                { field: '@company.legalNameEn', fallback: '@company.legalName' },
                { text: ', BIN ' },
                { field: '@company.bin' },
                { text: ', registered in accordance with the legislation of the Republic of ' },
                { text: 'Kazakhstan, at the address: ' },
                { field: '@company.addressEn', fallback: '@company.address' },
                { text: ', represented by ' },
                { field: '@company.directorTitleEn', fallback: '@company.directorTitle' },
                { text: ' ' },
                { field: '@company.directorNameEn', fallback: '@company.directorName' },
                { text: ', acting on the basis of the Charter (hereinafter the “Principal”), ' },
                { text: 'hereby constitutes and appoints the citizen of the Republic of ' },
                { text: 'Kazakhstan ' },
                { field: 'employee' },
                { text: ', born on ' },
                { field: 'birthDate' },
                { text: ', IIN ' },
                { field: 'iin' },
                { text: ', identification card No. ' },
                { field: 'idNumber' },
                { text: ', issued on ' },
                { field: 'idDate' },
                { text: ' by ' },
                { field: 'idIssuer' },
                { text: ', residing at: ' },
                { field: 'address' },
                { text: ' (the “Attorney”), to perform on behalf of and in the interests of ' },
                { text: 'the Principal in the territory of the Republic of Kazakhstan the ' },
                { text: 'following actions:' },
              ],
              [{ field: 'powersEn', fallback: 'powers' }],
              [
                { text: 'This Power of Attorney is issued without the right of substitution ' },
                { text: 'for a period until ' },
                { field: 'until' },
                { text: ' inclusive.' },
              ],
            ],
          },
        ],
      },
      { kind: 'poa-signature' },
    ],
  },
];
