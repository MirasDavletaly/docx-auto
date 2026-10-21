/**
 * Типовые шаблоны: закупки и продажи, склад, АХО, проекты, ИТ и ИБ, HSE,
 * маркетинг.
 *
 * Образца от компании для них нет – текст собран по распространённым
 * образцам и помечен как неконкретный (`generic`). Что это значит и почему
 * так – в `generic.ts`. Текст черновой: проверяет юрист (docs/legal-review.md).
 */
import {
  CAPTION,
  COMPANY,
  act,
  amountWords,
  contract,
  field,
  goodsPowerOfAttorney,
  letter,
  listDocument,
  policy,
  request,
} from '@/api/mock/generic';

import type { Tri } from '@/api/mock/generic';
import type { DocumentTemplate } from '@/api/types';

const [CO_KK, CO_RU, CO_EN] = COMPANY;

const COMMISSION_SIGNS: Tri = [
  'Комиссия мүшелері: ________________',
  'Члены комиссии: ________________',
  'Commission members: ________________',
];

export const genericTemplatesB: DocumentTemplate[] = [
  /* ═══ Закупки и продажи ═══════════════════════════════════════════════ */

  request({
    id: 'procurement-sales-purchase-request',
    title: 'Заявка на закупку',
    sectionId: 'procurement-sales',
    subsectionId: 'procurement',
    series: 'Зак',
    purpose: 'Просьба подразделения закупить товары, работы или услуги.',
    words: ['САТЫП АЛУҒА ӨТІНІМ', 'ЗАЯВКА НА ЗАКУПКУ', 'PURCHASE REQUEST'],
    fields: [
      field.area('items', 'Что закупить', 'Закупка', {
        hint: 'По одной позиции на строку: наименование, количество, требования',
      }),
      field.money('estimate', 'Ориентировочная стоимость', 'Закупка', { required: false }),
      field.date('neededBy', 'Нужно к', 'Закупка', { dateLimits: { notBefore: 'today' } }),
      field.area('reason', 'Обоснование', 'Закупка'),
    ],
    clauses: [
      ['Мынаны сатып алуды сұраймын: {items}', 'Прошу закупить: {items}', 'Please purchase: {items}'],
      [
        'Шамамен құны – {estimate} теңге. Қажетті мерзімі – {neededBy} дейін.',
        'Ориентировочная стоимость – {estimate} тенге. Необходимо к {neededBy}.',
        'Estimated cost: KZT {estimate}. Needed by {neededBy}.',
      ],
      ['Негіздеме: {reason}', 'Обоснование: {reason}', 'Justification: {reason}'],
    ],
  }),

  letter({
    id: 'procurement-sales-rfq',
    title: 'Запрос коммерческих предложений',
    sectionId: 'procurement-sales',
    subsectionId: 'procurement',
    series: 'Зак',
    purpose: 'Просьба к поставщику прислать цену и условия поставки.',
    words: ['КОММЕРЦИЯЛЫҚ ҰСЫНЫСТАР СҰРАУ', 'ЗАПРОС КОММЕРЧЕСКИХ ПРЕДЛОЖЕНИЙ', 'REQUEST FOR QUOTATIONS'],
    subject: [
      'Коммерциялық ұсыныс беру туралы',
      'О предоставлении коммерческого предложения',
      'On submitting a quotation',
    ],
    fields: [
      field.area('items', 'Что требуется', 'Запрос'),
      field.date('deadline', 'Срок подачи предложения', 'Запрос', {
        dateLimits: { notBefore: 'today' },
      }),
      field.tri('contact', 'Контактное лицо', 'Запрос', { hint: 'ФИО, телефон, почта' }),
    ],
    plain: true,
    clauses: [
      [
        `${CO_KK} мына тауарларға (жұмыстарға, қызметтерге) коммерциялық ұсыныс беруді сұрайды: {items}`,
        `${CO_RU} просит предоставить коммерческое предложение на следующие товары (работы, услуги): {items}`,
        `${CO_EN} requests a quotation for the following goods (work, services): {items}`,
      ],
      [
        'Ұсыныста бағаны, жеткізу мерзімін, төлем шарттары мен кепілдікті көрсетуді сұраймыз.',
        'В предложении просим указать цену, сроки поставки, условия оплаты и гарантию.',
        'Please state the price, delivery time, payment terms and warranty.',
      ],
      [
        'Ұсынысты {deadline} дейін жіберуді сұраймыз. Байланыс тұлғасы: {contact}.',
        'Предложение просим направить до {deadline}. Контактное лицо: {contact}.',
        'Please send your quotation by {deadline}. Contact person: {contact}.',
      ],
    ],
  }),

  listDocument({
    id: 'procurement-sales-supplier-selection',
    title: 'Протокол выбора поставщика',
    sectionId: 'procurement-sales',
    subsectionId: 'procurement',
    series: 'Зак',
    purpose: 'Какие предложения рассмотрены и почему выбран этот поставщик.',
    words: ['ЖЕТКІЗУШІНІ ТАҢДАУ ХАТТАМАСЫ', 'ПРОТОКОЛ ВЫБОРА ПОСТАВЩИКА', 'SUPPLIER SELECTION MINUTES'],
    fields: [
      field.tri('purchaseSubject', 'Предмет закупки', 'Закупка'),
      field.area('commission', 'Состав комиссии', 'Комиссия', {
        hint: 'По одному на строку: ФИО и должность',
      }),
      field.area('offers', 'Рассмотренные предложения', 'Предложения', {
        hint: 'По одному на строку: поставщик, цена, срок',
      }),
      field.counterparty('Победитель'),
      field.money('winnerPrice', 'Цена победителя', 'Победитель'),
      field.area('criteria', 'Почему выбран', 'Победитель'),
    ],
    intro: [
      ['**Сатып алу нысанасы:** {purchaseSubject}', '**Предмет закупки:** {purchaseSubject}', '**Subject of purchase:** {purchaseSubject}'],
      ['**Комиссия құрамы:** {commission}', '**Состав комиссии:** {commission}', '**Commission:** {commission}'],
    ],
    clauses: [
      ['**Қаралған ұсыныстар:** {offers}', '**Рассмотренные предложения:** {offers}', '**Offers considered:** {offers}'],
      [
        '**ШЕШІМ:** жеткізуші ретінде {counterparty} таңдалсын, бағасы {winnerPrice} теңге.',
        '**РЕШЕНИЕ:** выбрать поставщиком {counterparty} с ценой {winnerPrice} тенге.',
        '**DECISION:** to select {counterparty} as the supplier at KZT {winnerPrice}.',
      ],
      ['**Таңдау негіздемесі:** {criteria}', '**Обоснование выбора:** {criteria}', '**Grounds for the choice:** {criteria}'],
    ],
    signs: [COMMISSION_SIGNS],
    caption: CAPTION.approve,
  }),

  letter({
    id: 'procurement-sales-offer',
    title: 'Коммерческое предложение',
    sectionId: 'procurement-sales',
    subsectionId: 'sales',
    series: 'Зак',
    purpose: 'Предложение клиенту: что предлагаем, по какой цене и на каких условиях.',
    words: ['КОММЕРЦИЯЛЫҚ ҰСЫНЫС', 'КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ', 'COMMERCIAL OFFER'],
    subject: ['Тауарларды (қызметтерді) жеткізу туралы', 'О поставке товаров (услуг)', 'On supply of goods (services)'],
    fields: [
      field.area('items', 'Что предлагаем', 'Предложение', {
        hint: 'По одной позиции на строку: наименование, количество, цена',
      }),
      field.money('amount', 'Общая стоимость', 'Предложение'),
      amountWords('amountWords', 'Предложение'),
      field.tri('deliveryTerms', 'Сроки поставки', 'Условия'),
      field.tri('paymentTerms', 'Порядок оплаты', 'Условия'),
      field.date('offerValidUntil', 'Предложение действует до', 'Условия', {
        dateLimits: { notBefore: 'today' },
      }),
    ],
    plain: true,
    clauses: [
      [`${CO_KK} сізге мынаны ұсынады: {items}`, `${CO_RU} предлагает вам: {items}`, `${CO_EN} offers you: {items}`],
      [
        'Жалпы құны – {amount} ({amountWords}) теңге.',
        'Общая стоимость – {amount} ({amountWords}) тенге.',
        'Total cost: KZT {amount} ({amountWords}).',
      ],
      [
        'Жеткізу мерзімі: {deliveryTerms}. Төлем тәртібі: {paymentTerms}.',
        'Сроки поставки: {deliveryTerms}. Порядок оплаты: {paymentTerms}.',
        'Delivery: {deliveryTerms}. Payment: {paymentTerms}.',
      ],
      [
        'Ұсыныс {offerValidUntil} дейін жарамды.',
        'Предложение действует до {offerValidUntil}.',
        'The offer is valid until {offerValidUntil}.',
      ],
    ],
  }),

  listDocument({
    id: 'procurement-sales-specification',
    title: 'Спецификация к договору',
    sectionId: 'procurement-sales',
    subsectionId: 'sales',
    series: 'Зак',
    purpose: 'Перечень позиций, цены и сроки поставки по договору.',
    words: ['ШАРТҚА СПЕЦИФИКАЦИЯ', 'СПЕЦИФИКАЦИЯ К ДОГОВОРУ', 'CONTRACT SPECIFICATION'],
    fields: [
      field.counterparty(),
      field.tri('counterpartySigner', 'Подписант контрагента', 'Стороны', {
        hint: 'Должность и ФИО в том виде, как они стоят в договоре',
      }),
      field.text('contractNumber', 'Номер договора', 'Основание'),
      field.date('contractDate', 'Дата договора', 'Основание', { dateLimits: { notAfter: 'today' } }),
      field.area('items', 'Позиции', 'Спецификация', {
        hint: 'По одной на строку: наименование, единица, количество, цена, сумма',
      }),
      field.money('amount', 'Итого', 'Спецификация'),
      amountWords('amountWords', 'Спецификация'),
      field.date('deliveryDate', 'Срок поставки', 'Спецификация', { dateLimits: { notBefore: 'today' } }),
    ],
    intro: [
      [
        `${CO_KK} мен {counterparty} арасында жасалған {contractDate} № {contractNumber} шартқа.`,
        `к договору № {contractNumber} от {contractDate}, заключённому между ${CO_RU} и {counterparty}.`,
        `to contract No. {contractNumber} dated {contractDate} between ${CO_EN} and {counterparty}.`,
      ],
    ],
    clauses: [
      ['**Позициялар:** {items}', '**Позиции:** {items}', '**Items:** {items}'],
      [
        '**Барлығы:** {amount} ({amountWords}) теңге. **Жеткізу мерзімі:** {deliveryDate} дейін.',
        '**Итого:** {amount} ({amountWords}) тенге. **Срок поставки:** до {deliveryDate}.',
        '**Total:** KZT {amount} ({amountWords}). **Delivery by:** {deliveryDate}.',
      ],
      [
        'Спецификация шарттың ажырамас бөлігі болып табылады.',
        'Спецификация является неотъемлемой частью договора.',
        'This specification forms an integral part of the contract.',
      ],
    ],
    signs: [
      [
        '**Контрагент:** ________________ {counterpartySigner}',
        '**Контрагент:** ________________ {counterpartySigner}',
        '**Counterparty:** ________________ {counterpartySigner}',
      ],
    ],
    caption: CAPTION.company,
  }),

  /* ═══ Склад и логистика ═══════════════════════════════════════════════ */

  listDocument({
    id: 'warehouse-receipt-note',
    title: 'Приходная накладная',
    sectionId: 'warehouse',
    subsectionId: '',
    series: 'Скл',
    purpose: 'Приём товарно-материальных ценностей на склад от поставщика.',
    words: ['КІРІС ЖҮКҚҰЖАТЫ', 'ПРИХОДНАЯ НАКЛАДНАЯ', 'GOODS RECEIVED NOTE'],
    fields: [
      field.counterparty('Поставщик'),
      field.tri('basisDoc', 'Документ-основание', 'Поступление', {
        hint: 'Например: договор № 12, счёт-фактура № 45',
      }),
      field.tri('warehouse', 'Склад', 'Поступление'),
      field.area('items', 'Принятые ценности', 'Ценности', {
        hint: 'По одной на строку: наименование, единица, количество, цена, сумма',
      }),
      field.money('amount', 'Итого', 'Ценности'),
      field.employee('storekeeper', 'Принял (кладовщик)', 'Приёмка'),
    ],
    intro: [
      ['**Жеткізуші:** {counterparty}', '**Поставщик:** {counterparty}', '**Supplier:** {counterparty}'],
      [
        '**Негіздеме:** {basisDoc}. **Қойма:** {warehouse}',
        '**Основание:** {basisDoc}. **Склад:** {warehouse}',
        '**Basis:** {basisDoc}. **Warehouse:** {warehouse}',
      ],
    ],
    clauses: [
      ['**Қабылданған құндылықтар:** {items}', '**Принятые ценности:** {items}', '**Items received:** {items}'],
      ['**Барлығы:** {amount} теңге', '**Итого:** {amount} тенге', '**Total:** KZT {amount}'],
    ],
    signs: [
      [
        'Қабылдады: ________________ {storekeeper:nom}',
        'Принял: ________________ {storekeeper:nom}',
        'Received by: ________________ {storekeeper:nom}',
      ],
    ],
  }),

  listDocument({
    id: 'warehouse-transfer-note',
    title: 'Накладная на внутреннее перемещение',
    sectionId: 'warehouse',
    subsectionId: '',
    series: 'Скл',
    purpose: 'Перемещение ценностей между складами и подразделениями компании.',
    words: ['ІШКІ ОРЫН АУЫСТЫРУҒА ЖҮКҚҰЖАТ', 'НАКЛАДНАЯ НА ВНУТРЕННЕЕ ПЕРЕМЕЩЕНИЕ', 'INTERNAL TRANSFER NOTE'],
    fields: [
      field.tri('fromPlace', 'Откуда', 'Перемещение'),
      field.tri('toPlace', 'Куда', 'Перемещение'),
      field.area('items', 'Перемещаемые ценности', 'Ценности', {
        hint: 'По одной на строку: наименование, единица, количество',
      }),
      field.employee('handedBy', 'Сдал', 'Подписи'),
      field.employee('receivedBy', 'Принял', 'Подписи'),
    ],
    intro: [
      [
        '**Қайдан:** {fromPlace}. **Қайда:** {toPlace}',
        '**Откуда:** {fromPlace}. **Куда:** {toPlace}',
        '**From:** {fromPlace}. **To:** {toPlace}',
      ],
    ],
    clauses: [['**Құндылықтар:** {items}', '**Ценности:** {items}', '**Items:** {items}']],
    signs: [
      ['Тапсырды: ________________ {handedBy:nom}', 'Сдал: ________________ {handedBy:nom}', 'Handed over by: ________________ {handedBy:nom}'],
      ['Қабылдады: ________________ {receivedBy:nom}', 'Принял: ________________ {receivedBy:nom}', 'Received by: ________________ {receivedBy:nom}'],
    ],
  }),

  listDocument({
    id: 'warehouse-waybill',
    title: 'Путевой лист',
    sectionId: 'warehouse',
    subsectionId: '',
    series: 'Скл',
    purpose: 'Рейс служебного автомобиля: водитель, маршрут, пробег и топливо.',
    words: ['ЖОЛ ПАРАҒЫ', 'ПУТЕВОЙ ЛИСТ', 'WAYBILL'],
    fields: [
      field.employee('driver', 'Водитель', 'Водитель'),
      field.tri('vehicle', 'Автомобиль', 'Автомобиль', { hint: 'Марка и государственный номер' }),
      field.number('odometerStart', 'Показания спидометра при выезде', 'Автомобиль', { unit: 'км' }),
      field.number('fuel', 'Выдано топлива', 'Автомобиль', { unit: 'л', required: false }),
      field.date('tripDate', 'Дата рейса', 'Рейс'),
      field.area('route', 'Маршрут', 'Рейс'),
    ],
    intro: [
      ['**Жүргізуші:** {driver:nom}', '**Водитель:** {driver:nom}', '**Driver:** {driver:nom}'],
      ['**Автокөлік:** {vehicle}', '**Автомобиль:** {vehicle}', '**Vehicle:** {vehicle}'],
    ],
    clauses: [
      [
        '**Рейс күні:** {tripDate}. **Бағыт:** {route}',
        '**Дата рейса:** {tripDate}. **Маршрут:** {route}',
        '**Date:** {tripDate}. **Route:** {route}',
      ],
      [
        '**Шыққандағы спидометр көрсеткіші:** {odometerStart} км. **Берілген отын:** {fuel} л',
        '**Спидометр при выезде:** {odometerStart} км. **Выдано топлива:** {fuel} л',
        '**Odometer at departure:** {odometerStart} km. **Fuel issued:** {fuel} l',
      ],
      [
        'Жүргізуші денсаулық жағдайы бойынша көлік жүргізуге жіберілді, автокөлік техникалық жағынан жарамды.',
        'Водитель по состоянию здоровья к управлению допущен, автомобиль технически исправен.',
        'The driver is fit to drive and the vehicle is technically sound.',
      ],
    ],
    signs: [
      ['Жүргізуші: ________________ {driver:nom}', 'Водитель: ________________ {driver:nom}', 'Driver: ________________ {driver:nom}'],
    ],
    caption: CAPTION.departure,
  }),

  act({
    id: 'warehouse-stocktaking-act',
    title: 'Акт инвентаризации склада',
    sectionId: 'warehouse',
    subsectionId: '',
    series: 'Скл',
    purpose: 'Результаты инвентаризации: что по учёту, что фактически и расхождения.',
    words: ['ҚОЙМАНЫ ТҮГЕНДЕУ АКТІСІ', 'АКТ ИНВЕНТАРИЗАЦИИ СКЛАДА', 'WAREHOUSE STOCKTAKING REPORT'],
    fields: [
      field.tri('warehouse', 'Склад', 'Инвентаризация'),
      field.date('stocktakingDate', 'Дата инвентаризации', 'Инвентаризация', {
        dateLimits: { notAfter: 'today' },
      }),
      field.area('commission', 'Состав комиссии', 'Комиссия', {
        hint: 'По одному на строку: ФИО и должность',
      }),
      field.area('results', 'Результаты', 'Результаты', {
        hint: 'По одной позиции на строку: наименование, по учёту, фактически, разница',
      }),
      field.area('conclusion', 'Выводы комиссии', 'Результаты'),
    ],
    preamble: [
      'Мына құрамдағы комиссия: {commission} – {stocktakingDate} «{warehouse}» қоймасында түгендеу жүргізді.',
      'Комиссия в составе: {commission} – провела {stocktakingDate} инвентаризацию склада «{warehouse}».',
      'A commission consisting of {commission} carried out a stocktaking of the “{warehouse}” warehouse on {stocktakingDate}.',
    ],
    clauses: [
      ['Түгендеу нәтижелері: {results}', 'Результаты инвентаризации: {results}', 'Results: {results}'],
      ['Комиссияның қорытындысы: {conclusion}', 'Выводы комиссии: {conclusion}', 'Conclusions of the commission: {conclusion}'],
    ],
    signs: [COMMISSION_SIGNS],
    caption: CAPTION.approve,
  }),

  goodsPowerOfAttorney({
    id: 'warehouse-goods-poa',
    title: 'Доверенность на получение товара',
    sectionId: 'warehouse',
    subsectionId: '',
    series: 'Скл',
    purpose: 'Полномочие работнику получить товарно-материальные ценности у поставщика.',
    words: { ru: 'Доверенность', en: 'Power of Attorney' },
    fields: [
      field.employee('employee', 'Поверенный', 'Кому выдаётся'),
      field.text('idNumber', 'Номер удостоверения личности', 'Кому выдаётся'),
      field.date('idDate', 'Дата выдачи удостоверения', 'Кому выдаётся', {
        dateLimits: { notAfter: 'today' },
      }),
      field.text('idIssuer', 'Кем выдано удостоверение', 'Кому выдаётся', {
        hint: 'Например: МВД Республики Казахстан',
        perLang: true,
        translate: 'issuer',
      }),
      field.counterparty('Поставщик'),
      field.tri('basisDoc', 'Документ-основание', 'Ценности', {
        hint: 'Например: договор № 12, счёт № 45',
      }),
      field.area('goods', 'Какие ценности получить', 'Ценности'),
      field.date('until', 'Действительна до', 'Срок', { dateLimits: { notBefore: 'today' } }),
    ],
    rows: [
      [
        `**Доверитель:** ${CO_RU}, БИН {@company.bin}, {@company.address}`,
        `**Principal:** ${CO_EN}, BIN {@company.bin}, {@company.addressEn|@company.address}`,
      ],
      [
        '**Поверенный:** {employee:nom}, удостоверение личности № {idNumber}, выдано {idDate} {idIssuer}',
        '**Attorney:** {employee:nom}, ID card No. {idNumber} issued on {idDate} by {idIssuer}',
      ],
      [
        'Поверенный уполномочен получить от {counterparty} по документу {basisDoc} следующие товарно-материальные ценности: {goods}',
        'The attorney is authorised to receive from {counterparty} under {basisDoc} the following goods: {goods}',
      ],
      [
        'Доверенность действительна до {until}. Подпись поверенного ________________ удостоверяю.',
        'This power of attorney is valid until {until}. I certify the signature of the attorney ________________.',
      ],
    ],
  }),

  /* ═══ АХО ═════════════════════════════════════════════════════════════ */

  listDocument({
    id: 'administration-meeting-minutes',
    title: 'Протокол совещания',
    sectionId: 'administration',
    subsectionId: 'administration-records',
    series: 'ОД',
    purpose: 'Кто присутствовал, что обсуждали и какие решения приняли.',
    words: ['КЕҢЕС ХАТТАМАСЫ', 'ПРОТОКОЛ СОВЕЩАНИЯ', 'MEETING MINUTES'],
    fields: [
      field.date('meetingDate', 'Дата совещания', 'Совещание', { dateLimits: { notAfter: 'today' } }),
      field.employee('chair', 'Председатель', 'Совещание'),
      field.area('attendees', 'Присутствовали', 'Совещание', { hint: 'По одному на строку' }),
      field.area('agenda', 'Повестка', 'Совещание'),
      field.area('decisions', 'Решения', 'Решения', {
        hint: 'По одному на строку: что сделать, кто отвечает, срок',
      }),
    ],
    intro: [
      [
        '**Өткізілген күні:** {meetingDate}. **Төраға:** {chair:nom}',
        '**Дата:** {meetingDate}. **Председатель:** {chair:nom}',
        '**Date:** {meetingDate}. **Chair:** {chair:nom}',
      ],
      ['**Қатысқандар:** {attendees}', '**Присутствовали:** {attendees}', '**Present:** {attendees}'],
      ['**Күн тәртібі:** {agenda}', '**Повестка:** {agenda}', '**Agenda:** {agenda}'],
    ],
    clauses: [['**ШЕШІМДЕР:** {decisions}', '**РЕШЕНИЯ:** {decisions}', '**DECISIONS:** {decisions}']],
    signs: [['Төраға: ________________ {chair:nom}', 'Председатель: ________________ {chair:nom}', 'Chair: ________________ {chair:nom}']],
    caption: CAPTION.approve,
  }),

  listDocument({
    id: 'administration-file-list',
    title: 'Номенклатура дел',
    sectionId: 'administration',
    subsectionId: 'administration-records',
    series: 'ОД',
    profile: 'register',
    purpose: 'Перечень дел компании на год со сроками хранения.',
    words: ['ІСТЕР НОМЕНКЛАТУРАСЫ', 'НОМЕНКЛАТУРА ДЕЛ', 'FILE CLASSIFICATION LIST'],
    fields: [
      field.text('year', 'На какой год', 'Номенклатура', { hint: 'Четыре цифры: 2027' }),
      field.area('files', 'Дела', 'Номенклатура', {
        hint: 'По одному на строку: индекс, заголовок дела, срок хранения',
      }),
    ],
    intro: [['{year} жылға', 'на {year} год', 'for {year}']],
    clauses: [
      ['**Істер тізбесі:** {files}', '**Перечень дел:** {files}', '**List of files:** {files}'],
      [
        'Номенклатура {year} жылғы 1 қаңтардан бастап қолданысқа енгізіледі.',
        'Номенклатура вводится в действие с 1 января {year} года.',
        'The list takes effect on 1 January {year}.',
      ],
    ],
    caption: CAPTION.approve,
  }),

  act({
    id: 'administration-files-handover',
    title: 'Акт приёма-передачи дел',
    sectionId: 'administration',
    subsectionId: 'administration-records',
    series: 'ОД',
    purpose: 'Передача дел и документов от одного работника другому.',
    words: ['ІСТЕРДІ ҚАБЫЛДАУ-ТАПСЫРУ АКТІСІ', 'АКТ ПРИЁМА-ПЕРЕДАЧИ ДЕЛ', 'FILES HANDOVER CERTIFICATE'],
    fields: [
      field.employee('handedBy', 'Сдал', 'Стороны'),
      field.employee('receivedBy', 'Принял', 'Стороны'),
      field.tri('reason', 'Причина передачи', 'Передача', {
        hint: 'Например: увольнение, отпуск, смена должности',
      }),
      field.area('files', 'Передаваемые дела и документы', 'Передача', { hint: 'По одному на строку' }),
    ],
    preamble: [
      'Біз, төменде қол қойғандар, {handedBy:nom} (тапсырушы) және {receivedBy:nom} (қабылдаушы), осы актіні жасадық. Тапсыру себебі: {reason}.',
      'Мы, нижеподписавшиеся, {handedBy:nom} (сдающий) и {receivedBy:nom} (принимающий), составили настоящий акт. Причина передачи: {reason}.',
      'We, the undersigned, {handedBy:nom} (handing over) and {receivedBy:nom} (receiving), have drawn up this certificate. Reason: {reason}.',
    ],
    clauses: [
      [
        'Мына істер мен құжаттар тапсырылды: {files}',
        'Переданы следующие дела и документы: {files}',
        'The following files and documents have been handed over: {files}',
      ],
      [
        'Қабылдаушыда тапсырылған істердің құрамы мен жай-күйі бойынша ескертулер жоқ.',
        'Замечаний к составу и состоянию переданных дел у принимающего нет.',
        'The receiving party has no remarks on the content or condition of the files.',
      ],
    ],
    signs: [
      ['Тапсырды: ________________ {handedBy:nom}', 'Сдал: ________________ {handedBy:nom}', 'Handed over by: ________________ {handedBy:nom}'],
      ['Қабылдады: ________________ {receivedBy:nom}', 'Принял: ________________ {receivedBy:nom}', 'Received by: ________________ {receivedBy:nom}'],
    ],
    caption: CAPTION.approve,
  }),

  request({
    id: 'administration-repair-request',
    title: 'Заявка на ремонт',
    sectionId: 'administration',
    subsectionId: 'administration-facilities',
    series: 'ОД',
    purpose: 'Сообщение о неисправности в помещении или оборудовании.',
    words: ['ЖӨНДЕУГЕ ӨТІНІМ', 'ЗАЯВКА НА РЕМОНТ', 'REPAIR REQUEST'],
    fields: [
      field.tri('location', 'Где', 'Неисправность', { hint: 'Здание, этаж, кабинет' }),
      field.area('problem', 'Что неисправно', 'Неисправность'),
      field.tri('urgency', 'Срочность', 'Неисправность', { hint: 'Например: срочно, в течение недели' }),
    ],
    clauses: [
      ['Мына жерде жөндеу жүргізуді сұраймын: {location}.', 'Прошу провести ремонт: {location}.', 'Please arrange a repair at: {location}.'],
      ['Ақаудың сипаттамасы: {problem}', 'Описание неисправности: {problem}', 'Description of the fault: {problem}'],
      ['Шұғылдығы: {urgency}.', 'Срочность: {urgency}.', 'Urgency: {urgency}.'],
    ],
  }),

  request({
    id: 'administration-supplies-request',
    title: 'Заявка на хозяйственные нужды',
    sectionId: 'administration',
    subsectionId: 'administration-facilities',
    series: 'ОД',
    purpose: 'Просьба выдать канцелярию, расходные материалы, инвентарь.',
    words: ['ШАРУАШЫЛЫҚ ҚАЖЕТТІЛІКТЕРГЕ ӨТІНІМ', 'ЗАЯВКА НА ХОЗЯЙСТВЕННЫЕ НУЖДЫ', 'SUPPLIES REQUEST'],
    fields: [
      field.area('items', 'Что нужно', 'Потребность', {
        hint: 'По одной позиции на строку: наименование, количество',
      }),
      field.area('needFor', 'Для чего', 'Потребность'),
      field.date('neededBy', 'Нужно к', 'Потребность', { dateLimits: { notBefore: 'today' } }),
    ],
    clauses: [
      ['Шаруашылық қажеттіліктер үшін мыналарды беруді сұраймын: {items}', 'Прошу выдать для хозяйственных нужд: {items}', 'Please provide the following supplies: {items}'],
      ['Мақсаты: {needFor}', 'Для чего: {needFor}', 'Purpose: {needFor}'],
      ['Қажетті мерзімі – {neededBy} дейін.', 'Необходимо к {neededBy}.', 'Needed by {neededBy}.'],
    ],
  }),

  /* ═══ Проекты ═════════════════════════════════════════════════════════ */

  listDocument({
    id: 'projects-charter',
    title: 'Устав проекта',
    sectionId: 'projects',
    subsectionId: 'projects-initiation',
    series: 'ОД',
    purpose: 'Цели, содержание, сроки, бюджет и руководитель проекта.',
    words: ['ЖОБА ЖАРҒЫСЫ', 'УСТАВ ПРОЕКТА', 'PROJECT CHARTER'],
    fields: [
      field.tri('projectName', 'Название проекта', 'Проект'),
      field.employee('manager', 'Руководитель проекта', 'Проект'),
      field.area('goals', 'Цели проекта', 'Содержание'),
      field.area('scope', 'Содержание работ', 'Содержание'),
      field.date('projectStart', 'Начало проекта', 'Сроки и бюджет'),
      field.date('projectEnd', 'Плановое окончание', 'Сроки и бюджет', {
        dateLimits: { afterField: 'projectStart' },
      }),
      field.money('budget', 'Бюджет проекта', 'Сроки и бюджет'),
      field.area('risks', 'Основные риски', 'Содержание', { required: false }),
    ],
    intro: [
      ['**Жоба:** {projectName}', '**Проект:** {projectName}', '**Project:** {projectName}'],
      ['**Жоба жетекшісі:** {manager:nom}', '**Руководитель проекта:** {manager:nom}', '**Project manager:** {manager:nom}'],
    ],
    clauses: [
      ['**Жобаның мақсаттары:** {goals}', '**Цели проекта:** {goals}', '**Goals:** {goals}'],
      ['**Жұмыстардың мазмұны:** {scope}', '**Содержание работ:** {scope}', '**Scope:** {scope}'],
      [
        '**Мерзімдері:** {projectStart} – {projectEnd}. **Бюджеті:** {budget} теңге',
        '**Сроки:** {projectStart} – {projectEnd}. **Бюджет:** {budget} тенге',
        '**Timeline:** {projectStart} – {projectEnd}. **Budget:** KZT {budget}',
      ],
      ['**Негізгі тәуекелдер:** {risks}', '**Основные риски:** {risks}', '**Key risks:** {risks}'],
    ],
    caption: CAPTION.approve,
  }),

  listDocument({
    id: 'projects-terms-of-reference',
    title: 'Техническое задание',
    sectionId: 'projects',
    subsectionId: 'projects-planning',
    series: 'ОД',
    purpose: 'Что должно получиться, требования к результату, сроки и приёмка.',
    words: ['ТЕХНИКАЛЫҚ ТАПСЫРМА', 'ТЕХНИЧЕСКОЕ ЗАДАНИЕ', 'TERMS OF REFERENCE'],
    fields: [
      field.tri('projectName', 'Название проекта', 'Проект'),
      field.area('background', 'Назначение и обоснование', 'Задание'),
      field.area('requirements', 'Требования к результату', 'Задание'),
      field.area('deliverables', 'Что передаётся по окончании', 'Задание'),
      field.date('deadline', 'Срок выполнения', 'Сроки', { dateLimits: { notBefore: 'today' } }),
      field.area('acceptance', 'Порядок приёмки', 'Сроки'),
    ],
    intro: [['**Жоба:** {projectName}', '**Проект:** {projectName}', '**Project:** {projectName}']],
    clauses: [
      ['**Мақсаты мен негіздемесі:** {background}', '**Назначение и обоснование:** {background}', '**Purpose and rationale:** {background}'],
      ['**Нәтижеге қойылатын талаптар:** {requirements}', '**Требования к результату:** {requirements}', '**Requirements:** {requirements}'],
      ['**Тапсырылатын нәтижелер:** {deliverables}', '**Что передаётся по окончании:** {deliverables}', '**Deliverables:** {deliverables}'],
      ['**Орындау мерзімі:** {deadline} дейін', '**Срок выполнения:** до {deadline}', '**Deadline:** {deadline}'],
      ['**Қабылдау тәртібі:** {acceptance}', '**Порядок приёмки:** {acceptance}', '**Acceptance:** {acceptance}'],
    ],
    caption: CAPTION.approve,
  }),

  listDocument({
    id: 'projects-status-report',
    title: 'Статус-отчёт по проекту',
    sectionId: 'projects',
    subsectionId: 'projects-execution',
    series: 'ОД',
    purpose: 'Что сделано за период, что дальше, какие проблемы.',
    words: ['ЖОБА БОЙЫНША МӘРТЕБЕ-ЕСЕП', 'СТАТУС-ОТЧЁТ ПО ПРОЕКТУ', 'PROJECT STATUS REPORT'],
    fields: [
      field.tri('projectName', 'Название проекта', 'Проект'),
      field.employee('manager', 'Руководитель проекта', 'Проект'),
      field.date('periodFrom', 'Период с', 'Период', { dateLimits: { notAfter: 'today' } }),
      field.date('periodTo', 'Период по', 'Период', { dateLimits: { afterField: 'periodFrom' } }),
      field.tri('status', 'Общий статус', 'Статус', {
        hint: 'Например: в графике; отставание на две недели',
      }),
      field.area('done', 'Сделано за период', 'Статус'),
      field.area('planned', 'План на следующий период', 'Статус'),
      field.area('issues', 'Проблемы и риски', 'Статус', { required: false }),
    ],
    intro: [
      ['**Жоба:** {projectName}', '**Проект:** {projectName}', '**Project:** {projectName}'],
      [
        '**Кезең:** {periodFrom} – {periodTo}. **Жалпы мәртебе:** {status}',
        '**Период:** {periodFrom} – {periodTo}. **Общий статус:** {status}',
        '**Period:** {periodFrom} – {periodTo}. **Overall status:** {status}',
      ],
    ],
    clauses: [
      ['**Кезеңде орындалды:** {done}', '**Сделано за период:** {done}', '**Done:** {done}'],
      ['**Келесі кезеңге жоспар:** {planned}', '**План на следующий период:** {planned}', '**Next:** {planned}'],
      ['**Мәселелер мен тәуекелдер:** {issues}', '**Проблемы и риски:** {issues}', '**Issues and risks:** {issues}'],
    ],
    signs: [
      ['Жоба жетекшісі: ________________ {manager:nom}', 'Руководитель проекта: ________________ {manager:nom}', 'Project manager: ________________ {manager:nom}'],
    ],
    caption: CAPTION.acknowledge,
  }),

  act({
    id: 'projects-acceptance-act',
    title: 'Акт приёмки результатов проекта',
    sectionId: 'projects',
    subsectionId: 'projects-closing',
    series: 'ОД',
    purpose: 'Результаты проекта приняты, проект закрыт.',
    words: ['ЖОБА НӘТИЖЕЛЕРІН ҚАБЫЛДАУ АКТІСІ', 'АКТ ПРИЁМКИ РЕЗУЛЬТАТОВ ПРОЕКТА', 'PROJECT ACCEPTANCE CERTIFICATE'],
    fields: [
      field.tri('projectName', 'Название проекта', 'Проект'),
      field.employee('manager', 'Руководитель проекта', 'Проект'),
      field.area('results', 'Полученные результаты', 'Приёмка'),
      field.area('remarks', 'Замечания', 'Приёмка', { required: false }),
    ],
    preamble: [
      'Комиссия «{projectName}» жобасының нәтижелерін қарап, осы актіні жасады.',
      'Комиссия, рассмотрев результаты проекта «{projectName}», составила настоящий акт.',
      'Having reviewed the results of the project “{projectName}”, the commission has drawn up this certificate.',
    ],
    clauses: [
      ['Алынған нәтижелер: {results}', 'Получены результаты: {results}', 'Results achieved: {results}'],
      ['Ескертулер: {remarks}', 'Замечания: {remarks}', 'Remarks: {remarks}'],
      [
        'Жоба нәтижелері қабылданды, жоба жабылды деп танылады.',
        'Результаты проекта приняты, проект считается закрытым.',
        'The project results are accepted and the project is closed.',
      ],
    ],
    signs: [
      ['Жоба жетекшісі: ________________ {manager:nom}', 'Руководитель проекта: ________________ {manager:nom}', 'Project manager: ________________ {manager:nom}'],
      COMMISSION_SIGNS,
    ],
    caption: CAPTION.approve,
  }),

  /* ═══ ИТ и ИБ ═════════════════════════════════════════════════════════ */

  request({
    id: 'it-security-service-request',
    title: 'Заявка на ИТ-обслуживание',
    sectionId: 'it-security',
    subsectionId: 'it',
    series: 'ОД',
    purpose: 'Сообщение о проблеме с техникой или программой.',
    words: ['АТ ҚЫЗМЕТ КӨРСЕТУГЕ ӨТІНІМ', 'ЗАЯВКА НА ИТ-ОБСЛУЖИВАНИЕ', 'IT SERVICE REQUEST'],
    fields: [
      field.tri('equipment', 'Оборудование или система', 'Проблема', {
        hint: 'Например: ноутбук, 1С, электронная почта',
      }),
      field.area('problem', 'Что случилось', 'Проблема'),
      field.tri('urgency', 'Срочность', 'Проблема', { hint: 'Например: срочно, в течение дня' }),
    ],
    clauses: [
      ['Мына жабдыққа (жүйеге) қызмет көрсетуді сұраймын: {equipment}.', 'Прошу выполнить обслуживание: {equipment}.', 'Please service: {equipment}.'],
      ['Мәселенің сипаттамасы: {problem}', 'Описание проблемы: {problem}', 'Description of the issue: {problem}'],
      ['Шұғылдығы: {urgency}.', 'Срочность: {urgency}.', 'Urgency: {urgency}.'],
    ],
  }),

  act({
    id: 'it-security-equipment-handover',
    title: 'Акт приёма-передачи техники работнику',
    sectionId: 'it-security',
    subsectionId: 'it',
    series: 'ОД',
    purpose: 'Какая техника выдана работнику и в каком состоянии.',
    words: [
      'ҚЫЗМЕТКЕРГЕ ТЕХНИКАНЫ ҚАБЫЛДАУ-ТАПСЫРУ АКТІСІ',
      'АКТ ПРИЁМА-ПЕРЕДАЧИ ТЕХНИКИ РАБОТНИКУ',
      'EQUIPMENT HANDOVER CERTIFICATE',
    ],
    fields: [
      field.employee('employee', 'Работник', 'Работник'),
      field.tri('position', 'Должность', 'Работник'),
      field.area('equipmentList', 'Передаваемая техника', 'Техника', {
        hint: 'По одной на строку: наименование, модель, серийный и инвентарный номер',
      }),
      field.employee('handedBy', 'Передал (ИТ)', 'Техника'),
    ],
    preamble: [
      `Қызметкер {employee:nom} ({position}) ${CO_KK} ұйымынан жұмыста пайдалану үшін мына техниканы алды.`,
      `${CO_RU} передаёт работнику {employee:nom} ({position}) для использования в работе следующую технику.`,
      `${CO_EN} hands over to the employee {employee:nom} ({position}) the following equipment for work use.`,
    ],
    clauses: [
      ['Техника тізбесі: {equipmentList}', 'Перечень техники: {equipmentList}', 'Equipment: {equipmentList}'],
      [
        'Техника жарамды күйде берілді. Қызметкер оның сақталуына жауап береді және жұмыстан босатылғанда оны қайтарады.',
        'Техника передана в исправном состоянии. Работник отвечает за её сохранность и возвращает её при увольнении.',
        'The equipment is handed over in working order. The employee is responsible for keeping it safe and returns it on leaving the company.',
      ],
    ],
    signs: [
      ['Тапсырды: ________________ {handedBy:nom}', 'Передал: ________________ {handedBy:nom}', 'Handed over by: ________________ {handedBy:nom}'],
      ['Қабылдады: ________________ {employee:nom}', 'Принял: ________________ {employee:nom}', 'Received by: ________________ {employee:nom}'],
    ],
  }),

  request({
    id: 'it-security-access-request',
    title: 'Заявка на предоставление доступа',
    sectionId: 'it-security',
    subsectionId: 'security',
    series: 'ОД',
    purpose: 'Доступ работника к информационным системам: к каким, зачем и до какого срока.',
    words: ['ҚОЛЖЕТІМДІЛІК БЕРУГЕ ӨТІНІМ', 'ЗАЯВКА НА ПРЕДОСТАВЛЕНИЕ ДОСТУПА', 'ACCESS REQUEST'],
    fields: [
      field.employee('forWhom', 'Кому нужен доступ', 'Доступ'),
      field.area('systems', 'К каким системам', 'Доступ', { hint: 'Система и роль: по одной на строку' }),
      field.area('reason', 'Для чего', 'Доступ'),
      field.date('accessUntil', 'Доступ до', 'Доступ', {
        required: false,
        dateLimits: { notBefore: 'today' },
      }),
    ],
    clauses: [
      [
        'Қызметкер {forWhom:nom} үшін мына жүйелерге қолжетімділік беруді сұраймын: {systems}',
        'Прошу предоставить работнику {forWhom:nom} доступ к системам: {systems}',
        'Please grant {forWhom:nom} access to: {systems}',
      ],
      ['Мақсаты: {reason}', 'Для чего: {reason}', 'Purpose: {reason}'],
      ['Қолжетімділік мерзімі – {accessUntil} дейін.', 'Срок доступа – до {accessUntil}.', 'Access until {accessUntil}.'],
    ],
  }),

  policy({
    id: 'it-security-policy',
    title: 'Политика информационной безопасности',
    sectionId: 'it-security',
    subsectionId: 'security',
    series: 'ОД',
    purpose: 'Правила доступа, паролей, защиты данных и порядок действий при инциденте.',
    words: ['АҚПАРАТТЫҚ ҚАУІПСІЗДІК САЯСАТЫ', 'ПОЛИТИКА ИНФОРМАЦИОННОЙ БЕЗОПАСНОСТИ', 'INFORMATION SECURITY POLICY'],
    fields: [
      field.employee('securityOfficer', 'Ответственный за ИБ', 'Ответственный'),
      field.number('passwordDays', 'Смена пароля', 'Правила', { unit: 'дней' }),
    ],
    sections: [
      {
        title: ['Жалпы ережелер', 'Общие положения', 'General provisions'],
        clauses: [
          [
            'Саясат Компанияның ақпаратын қорғау қағидаларын белгілейді және барлық қызметкерлер үшін міндетті.',
            'Политика устанавливает правила защиты информации Компании и обязательна для всех работников.',
            'This policy sets the rules for protecting the Company’s information and is binding on all employees.',
          ],
          [
            'Ақпараттық қауіпсіздікке жауапты – {securityOfficer:nom}.',
            'Ответственный за информационную безопасность – {securityOfficer:nom}.',
            'The information security officer is {securityOfficer:nom}.',
          ],
        ],
      },
      {
        title: ['Қолжетімділік', 'Доступ', 'Access'],
        clauses: [
          [
            'Қолжетімділік жұмысқа қажетті көлемде ғана беріледі. Есептік жазба дербес, оны басқа адамға беруге болмайды.',
            'Доступ предоставляется только в объёме, необходимом для работы. Учётная запись персональна и не передаётся другим лицам.',
            'Access is granted only to the extent needed for the job. Accounts are personal and must not be shared.',
          ],
          [
            'Құпиясөз кемінде {passwordDays} күнде бір рет ауыстырылады және ешкімге айтылмайды.',
            'Пароль меняется не реже одного раза в {passwordDays} дней и никому не сообщается.',
            'Passwords are changed at least every {passwordDays} days and are never disclosed.',
          ],
        ],
      },
      {
        title: ['Деректерді қорғау', 'Защита данных', 'Data protection'],
        clauses: [
          [
            'Құпия ақпарат жеке мессенджерлер мен жеке поштаға жіберілмейді. Маңызды деректердің сақтық көшірмесі жасалады.',
            'Конфиденциальная информация не пересылается через личные мессенджеры и личную почту. Важные данные резервируются.',
            'Confidential information is not sent via personal messengers or personal e-mail. Important data is backed up.',
          ],
        ],
      },
      {
        title: ['Оқиғалар', 'Инциденты', 'Incidents'],
        clauses: [
          [
            'Күдікті хат, вирус, құрылғының жоғалуы немесе рұқсатсыз кіру туралы {securityOfficer:nom} дереу хабардар етіледі.',
            'О подозрительном письме, вирусе, утере устройства или несанкционированном доступе немедленно сообщается {securityOfficer:nom}.',
            'Suspicious e-mails, viruses, lost devices or unauthorised access are reported to {securityOfficer:nom} immediately.',
          ],
        ],
      },
      {
        title: ['Жауапкершілік', 'Ответственность', 'Responsibility'],
        clauses: [
          [
            'Саясатты бұзғаны үшін қызметкерлер Қазақстан Республикасының заңнамасына сәйкес жауап береді.',
            'За нарушение Политики работники несут ответственность в соответствии с законодательством Республики Казахстан.',
            'Employees are liable for breaches of this policy under the legislation of the Republic of Kazakhstan.',
          ],
        ],
      },
    ],
  }),

  /* ═══ HSE ═════════════════════════════════════════════════════════════ */

  listDocument({
    id: 'hse-induction-log',
    title: 'Журнал вводного инструктажа',
    sectionId: 'hse',
    subsectionId: 'hse-labour',
    series: 'ОД',
    profile: 'register',
    purpose: 'Лист журнала: кто и когда прошёл вводный инструктаж.',
    words: ['КІРІСПЕ НҰСҚАМАНЫ ТІРКЕУ ЖУРНАЛЫ', 'ЖУРНАЛ ВВОДНОГО ИНСТРУКТАЖА', 'INDUCTION BRIEFING LOG'],
    fields: [
      field.date('briefingDate', 'Дата инструктажа', 'Инструктаж', { dateLimits: { notAfter: 'today' } }),
      field.employee('instructor', 'Кто проводил', 'Инструктаж'),
      field.tri('program', 'Программа инструктажа', 'Инструктаж', {
        hint: 'Например: вводный инструктаж по охране труда',
      }),
      field.area('entries', 'Прошли инструктаж', 'Участники', {
        hint: 'По одному на строку: ФИО и должность',
      }),
    ],
    intro: [
      [
        '**Нұсқама күні:** {briefingDate}. **Нұсқаманы жүргізген:** {instructor:nom}',
        '**Дата инструктажа:** {briefingDate}. **Провёл:** {instructor:nom}',
        '**Date:** {briefingDate}. **Conducted by:** {instructor:nom}',
      ],
      ['**Бағдарлама:** {program}', '**Программа:** {program}', '**Programme:** {program}'],
    ],
    clauses: [['**Нұсқамадан өткендер:** {entries}', '**Прошли инструктаж:** {entries}', '**Briefed:** {entries}']],
    signs: [
      ['Нұсқаманы жүргізген: ________________ {instructor:nom}', 'Провёл: ________________ {instructor:nom}', 'Conducted by: ________________ {instructor:nom}'],
    ],
  }),

  listDocument({
    id: 'hse-work-permit',
    title: 'Наряд-допуск на работы повышенной опасности',
    sectionId: 'hse',
    subsectionId: 'hse-labour',
    series: 'ОД',
    purpose: 'Допуск бригады к опасным работам: где, что, какие меры безопасности.',
    words: [
      'ЖОҒАРЫ ҚАУІПТІ ЖҰМЫСТАРҒА РҰҚСАТ-НАРЯД',
      'НАРЯД-ДОПУСК НА РАБОТЫ ПОВЫШЕННОЙ ОПАСНОСТИ',
      'PERMIT TO WORK FOR HIGH-RISK WORK',
    ],
    fields: [
      field.employee('supervisor', 'Ответственный руководитель работ', 'Работы'),
      field.tri('workPlace', 'Место работ', 'Работы'),
      field.area('workDescription', 'Содержание работ', 'Работы'),
      field.area('crew', 'Состав бригады', 'Работы', { hint: 'По одному на строку: ФИО и допуск' }),
      field.area('safetyMeasures', 'Меры безопасности', 'Безопасность'),
      field.date('workStart', 'Начало работ', 'Сроки', { dateLimits: { notBefore: 'today' } }),
      field.date('workEnd', 'Окончание работ', 'Сроки', { dateLimits: { afterField: 'workStart' } }),
    ],
    intro: [
      ['**Жұмыс жетекшісі:** {supervisor:nom}', '**Ответственный руководитель работ:** {supervisor:nom}', '**Work supervisor:** {supervisor:nom}'],
      ['**Жұмыс орны:** {workPlace}', '**Место работ:** {workPlace}', '**Work location:** {workPlace}'],
    ],
    clauses: [
      ['**Жұмыстардың мазмұны:** {workDescription}', '**Содержание работ:** {workDescription}', '**Work to be done:** {workDescription}'],
      ['**Бригада құрамы:** {crew}', '**Состав бригады:** {crew}', '**Crew:** {crew}'],
      ['**Қауіпсіздік шаралары:** {safetyMeasures}', '**Меры безопасности:** {safetyMeasures}', '**Safety measures:** {safetyMeasures}'],
      [
        '**Жұмыс мерзімі:** {workStart} – {workEnd}',
        '**Срок работ:** {workStart} – {workEnd}',
        '**Period:** {workStart} – {workEnd}',
      ],
    ],
    signs: [
      ['Жұмыс жетекшісі: ________________ {supervisor:nom}', 'Руководитель работ: ________________ {supervisor:nom}', 'Supervisor: ________________ {supervisor:nom}'],
    ],
    caption: CAPTION.permit,
  }),

  act({
    id: 'hse-accident-act',
    title: 'Акт о несчастном случае',
    sectionId: 'hse',
    subsectionId: 'hse-incidents',
    series: 'ОД',
    profile: 'sensitive',
    purpose: 'Результаты расследования несчастного случая: обстоятельства, причины, меры.',
    words: ['ЖАЗАТАЙЫМ ОҚИҒА ТУРАЛЫ АКТІ', 'АКТ О НЕСЧАСТНОМ СЛУЧАЕ', 'ACCIDENT REPORT'],
    fields: [
      field.employee('victim', 'Пострадавший', 'Пострадавший'),
      field.tri('position', 'Должность', 'Пострадавший'),
      field.date('accidentDate', 'Дата происшествия', 'Происшествие', { dateLimits: { notAfter: 'today' } }),
      field.tri('place', 'Место происшествия', 'Происшествие'),
      field.area('circumstances', 'Обстоятельства', 'Происшествие'),
      field.area('causes', 'Причины', 'Расследование'),
      field.area('measures', 'Меры по устранению причин', 'Расследование'),
      field.area('commission', 'Состав комиссии', 'Комиссия', {
        hint: 'По одному на строку: ФИО и должность',
      }),
    ],
    preamble: [
      'Мына құрамдағы комиссия: {commission} – {accidentDate} болған жазатайым оқиғаны тексерді.',
      'Комиссия в составе: {commission} – расследовала несчастный случай, произошедший {accidentDate}.',
      'A commission consisting of {commission} investigated the accident of {accidentDate}.',
    ],
    clauses: [
      [
        'Зардап шегуші: {victim:nom}, {position}. Оқиға орны: {place}.',
        'Пострадавший: {victim:nom}, {position}. Место происшествия: {place}.',
        'Injured person: {victim:nom}, {position}. Place: {place}.',
      ],
      ['Мән-жайлары: {circumstances}', 'Обстоятельства: {circumstances}', 'Circumstances: {circumstances}'],
      ['Себептері: {causes}', 'Причины: {causes}', 'Causes: {causes}'],
      ['Себептерді жою шаралары: {measures}', 'Меры по устранению причин: {measures}', 'Corrective measures: {measures}'],
    ],
    signs: [COMMISSION_SIGNS],
    caption: CAPTION.approve,
  }),

  policy({
    id: 'hse-fire-instruction',
    title: 'Инструкция о мерах пожарной безопасности',
    sectionId: 'hse',
    subsectionId: 'hse-fire',
    series: 'ОД',
    purpose: 'Как не допустить пожара и что делать, если он случился.',
    words: [
      'ӨРТ ҚАУІПСІЗДІГІ ШАРАЛАРЫ ТУРАЛЫ НҰСҚАУЛЫҚ',
      'ИНСТРУКЦИЯ О МЕРАХ ПОЖАРНОЙ БЕЗОПАСНОСТИ',
      'FIRE SAFETY INSTRUCTION',
    ],
    fields: [
      field.employee('fireOfficer', 'Ответственный за пожарную безопасность', 'Ответственный'),
      field.tri('smokingPlace', 'Место для курения', 'Правила', {
        hint: 'Например: площадка у запасного выхода',
      }),
    ],
    sections: [
      {
        title: ['Жалпы ережелер', 'Общие положения', 'General provisions'],
        clauses: [
          [
            'Нұсқаулық Компанияның барлық қызметкерлері мен келушілері үшін міндетті. Өрт қауіпсіздігіне жауапты – {fireOfficer:nom}.',
            'Инструкция обязательна для всех работников и посетителей Компании. Ответственный за пожарную безопасность – {fireOfficer:nom}.',
            'This instruction is binding on all employees and visitors of the Company. The fire safety officer is {fireOfficer:nom}.',
          ],
        ],
      },
      {
        title: ['Өрттің алдын алу', 'Предупреждение пожара', 'Fire prevention'],
        clauses: [
          [
            'Эвакуациялық жолдар мен шығулар бос ұсталады. Ақаулы розеткаларды пайдалануға және жылытқыштарды қараусыз қалдыруға тыйым салынады.',
            'Эвакуационные пути и выходы держатся свободными. Запрещается пользоваться неисправными розетками и оставлять обогреватели без присмотра.',
            'Escape routes and exits are kept clear. Faulty sockets must not be used and heaters must not be left unattended.',
          ],
          [
            'Темекі тек белгіленген жерде шегіледі: {smokingPlace}.',
            'Курение допускается только в отведённом месте: {smokingPlace}.',
            'Smoking is allowed only in the designated place: {smokingPlace}.',
          ],
        ],
      },
      {
        title: ['Өрт кезіндегі әрекеттер', 'Действия при пожаре', 'In case of fire'],
        clauses: [
          [
            '101 немесе 112 нөміріне қоңырау шалу, адамдарды эвакуациялау, қауіпсіз болса – өрт сөндіргішті пайдалану, {fireOfficer:nom} хабардар ету.',
            'Позвонить по номеру 101 или 112, эвакуировать людей, если безопасно – применить огнетушитель, сообщить {fireOfficer:nom}.',
            'Call 101 or 112, evacuate people, use an extinguisher if it is safe, and inform {fireOfficer:nom}.',
          ],
        ],
      },
      {
        title: ['Жауапкершілік', 'Ответственность', 'Responsibility'],
        clauses: [
          [
            'Нұсқаулықты бұзғаны үшін қызметкерлер Қазақстан Республикасының заңнамасына сәйкес жауап береді.',
            'За нарушение Инструкции работники несут ответственность в соответствии с законодательством Республики Казахстан.',
            'Employees are liable for breaches of this instruction under the legislation of the Republic of Kazakhstan.',
          ],
        ],
      },
    ],
  }),

  /* ═══ Маркетинг ═══════════════════════════════════════════════════════ */

  listDocument({
    id: 'marketing-brief',
    title: 'Бриф на рекламу',
    sectionId: 'marketing',
    subsectionId: '',
    series: 'ОД',
    purpose: 'Задание на рекламную кампанию: что, для кого, зачем, где и за какие деньги.',
    words: ['ЖАРНАМАҒА БРИФ', 'БРИФ НА РЕКЛАМУ', 'ADVERTISING BRIEF'],
    fields: [
      field.tri('product', 'Что рекламируем', 'Кампания'),
      field.area('audience', 'Целевая аудитория', 'Кампания'),
      field.area('goals', 'Цели кампании', 'Кампания'),
      field.area('channels', 'Каналы', 'Кампания', { hint: 'Например: соцсети, наружная реклама, радио' }),
      field.money('budget', 'Бюджет', 'Сроки и бюджет'),
      field.date('campaignStart', 'Начало кампании', 'Сроки и бюджет', { dateLimits: { notBefore: 'today' } }),
      field.date('campaignEnd', 'Окончание кампании', 'Сроки и бюджет', {
        dateLimits: { afterField: 'campaignStart' },
      }),
    ],
    intro: [['**Жарнама нысаны:** {product}', '**Что рекламируем:** {product}', '**Product:** {product}']],
    clauses: [
      ['**Мақсатты аудитория:** {audience}', '**Целевая аудитория:** {audience}', '**Target audience:** {audience}'],
      ['**Науқанның мақсаттары:** {goals}', '**Цели кампании:** {goals}', '**Campaign goals:** {goals}'],
      ['**Арналар:** {channels}', '**Каналы:** {channels}', '**Channels:** {channels}'],
      [
        '**Мерзімдері:** {campaignStart} – {campaignEnd}. **Бюджеті:** {budget} теңге',
        '**Сроки:** {campaignStart} – {campaignEnd}. **Бюджет:** {budget} тенге',
        '**Timeline:** {campaignStart} – {campaignEnd}. **Budget:** KZT {budget}',
      ],
    ],
    caption: CAPTION.approve,
  }),

  contract({
    id: 'marketing-agency-contract',
    title: 'Договор с рекламным агентством',
    sectionId: 'marketing',
    subsectionId: '',
    series: 'Д',
    purpose: 'Рекламные услуги агентства: что, сроки, стоимость, права на материалы.',
    words: ['ЖАРНАМА АГЕНТТІГІМЕН ШАРТ', 'ДОГОВОР С РЕКЛАМНЫМ АГЕНТСТВОМ', 'ADVERTISING AGENCY CONTRACT'],
    roles: {
      company: ['Тапсырыс беруші', 'Заказчик', 'Customer'],
      other: ['Агенттік', 'Агентство', 'Agency'],
    },
    fields: [
      field.area('services', 'Рекламные услуги', 'Предмет'),
      field.date('campaignStart', 'Начало кампании', 'Сроки'),
      field.date('campaignEnd', 'Окончание кампании', 'Сроки', { dateLimits: { afterField: 'campaignStart' } }),
      field.money('amount', 'Стоимость услуг', 'Цена'),
      amountWords('amountWords', 'Цена'),
      field.tri('paymentTerms', 'Порядок оплаты', 'Цена'),
    ],
    clauses: [
      [
        'Агенттік Тапсырыс беруші үшін мына жарнамалық қызметтерді көрсетуге міндеттенеді: {services}',
        'Агентство обязуется оказать Заказчику следующие рекламные услуги: {services}',
        'The Agency undertakes to provide the Customer with the following advertising services: {services}',
      ],
      [
        'Қызметтер {campaignStart} бастап {campaignEnd} дейін көрсетіледі.',
        'Услуги оказываются с {campaignStart} по {campaignEnd}.',
        'The services are provided from {campaignStart} to {campaignEnd}.',
      ],
      [
        'Қызметтердің құны {amount} ({amountWords}) теңге. Төлем тәртібі: {paymentTerms}.',
        'Стоимость услуг – {amount} ({amountWords}) тенге. Порядок оплаты: {paymentTerms}.',
        'The cost of the services is KZT {amount} ({amountWords}). Payment terms: {paymentTerms}.',
      ],
      [
        'Жарнамалық материалдар жарияланғанға дейін Тапсырыс берушімен келісіледі. Жарнаманың заңнамаға сәйкестігіне Агенттік жауап береді.',
        'Рекламные материалы согласуются с Заказчиком до размещения. За соответствие рекламы законодательству отвечает Агентство.',
        'Advertising materials are approved by the Customer before placement. The Agency is responsible for compliance of the advertising with the law.',
      ],
      [
        'Қызмет көрсету барысында жасалған материалдарға айрықша құқықтар Тапсырыс берушіге өтеді.',
        'Исключительные права на материалы, созданные при оказании услуг, переходят к Заказчику.',
        'Exclusive rights to materials created under this contract pass to the Customer.',
      ],
    ],
  }),

  listDocument({
    id: 'marketing-campaign-report',
    title: 'Отчёт о рекламной кампании',
    sectionId: 'marketing',
    subsectionId: '',
    series: 'ОД',
    purpose: 'Сколько потрачено, какие результаты, выводы на будущее.',
    words: ['ЖАРНАМАЛЫҚ НАУҚАН ТУРАЛЫ ЕСЕП', 'ОТЧЁТ О РЕКЛАМНОЙ КАМПАНИИ', 'ADVERTISING CAMPAIGN REPORT'],
    fields: [
      field.tri('campaign', 'Кампания', 'Кампания'),
      field.employee('author', 'Кто подготовил', 'Кампания'),
      field.date('periodFrom', 'Период с', 'Период', { dateLimits: { notAfter: 'today' } }),
      field.date('periodTo', 'Период по', 'Период', { dateLimits: { afterField: 'periodFrom' } }),
      field.money('spent', 'Израсходовано', 'Итоги'),
      field.area('results', 'Результаты', 'Итоги', { hint: 'Охват, обращения, продажи' }),
      field.area('conclusions', 'Выводы и предложения', 'Итоги'),
    ],
    intro: [
      ['**Науқан:** {campaign}', '**Кампания:** {campaign}', '**Campaign:** {campaign}'],
      ['**Кезең:** {periodFrom} – {periodTo}', '**Период:** {periodFrom} – {periodTo}', '**Period:** {periodFrom} – {periodTo}'],
    ],
    clauses: [
      ['**Жұмсалды:** {spent} теңге', '**Израсходовано:** {spent} тенге', '**Spent:** KZT {spent}'],
      ['**Нәтижелер:** {results}', '**Результаты:** {results}', '**Results:** {results}'],
      ['**Қорытындылар мен ұсыныстар:** {conclusions}', '**Выводы и предложения:** {conclusions}', '**Conclusions and proposals:** {conclusions}'],
    ],
    signs: [['Дайындаған: ________________ {author:nom}', 'Подготовил: ________________ {author:nom}', 'Prepared by: ________________ {author:nom}']],
    caption: CAPTION.acknowledge,
  }),
];
