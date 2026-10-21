/**
 * Документы с таблицей позиций – по образцам из «Тест день 4», дополнение
 * от 29.09: акт выполненных работ (форма Р-1), накладная на отпуск запасов
 * на сторону (форма З-2), счёт на оплату и коммерческое предложение по
 * образцу Green Spark Limited.
 *
 * Р-1 и З-2 – формы приказа Министра финансов РК от 20 декабря 2012 года
 * № 562 (приложения 50 и 26). Их вид задан приказом, а не бланком группы,
 * поэтому они стоят на своём листе (`layout: 'form'`), на русском, как в
 * присланных образцах. Текст формы взят из образцов, не придуман; шаблоны
 * всё равно помечены как непроверенные (CLAUDE.md, п. 4.9).
 *
 * Суммы, НДС и «прописью» считает таблица позиций (`utils/items.ts`): цена
 * указывается с НДС, НДС выделяется – решение человека 30.09.
 *
 * Прежние трёхъязычные «Акт выполненных работ», «Счёт на оплату» и
 * «Коммерческое предложение» заменены этими (решение 30.09); документы,
 * уже созданные по ним, открываются по-прежнему (`replacedBy`).
 */
import { p } from '@/api/mock/generic';

import type { DocumentTemplate, FieldDef, GridCell, ItemsSpec, Para } from '@/api/types';

/* ── Ячейки формы ─────────────────────────────────────────────────────── */

type CellOptions = Omit<GridCell, 'paras'>;

/** Ячейка из строки с разметкой (`{поле}`, `**полужирный**`); перевод строки – новый абзац. */
function c(text = '', options: CellOptions = {}): GridCell {
  return { paras: text === '' ? [] : text.split('\n').map((line) => p(line)), ...options };
}

/** Ячейка в рамке. */
const box = (text: string, options: CellOptions = {}): GridCell => c(text, { border: 'box', ...options });

/** Строка для заполнения: значение над чертой, подпись под ней. */
const line = (text: string, caption?: string, options: CellOptions = {}): GridCell =>
  c(text, { border: 'line', align: 'center', ...(caption === undefined ? {} : { caption }), ...options });

/** Шапка таблицы позиций: мелко, по центру, в рамке. */
const th = (text: string, options: CellOptions = {}): GridCell =>
  box(text, { align: 'center', valign: 'middle', size: 'small', ...options });

/** Строка номеров колонок под шапкой формы: 1, 2, 3… */
function columnNumbers(count: number): GridCell[] {
  return Array.from({ length: count }, (_, index) => th(String(index + 1)));
}

const para = (source: string): Para => p(source);

/** Ссылка на приказ Минфина над формой. */
function formNote(appendix: number, form: string): DocumentTemplate['body'][number] {
  return {
    kind: 'form-note',
    lines: [
      `Приложение ${appendix}`,
      'к приказу Министра финансов',
      'Республики Казахстан',
      'от 20 декабря 2012 года № 562',
      form,
    ],
  };
}

/* ── Поля ─────────────────────────────────────────────────────────────── */

const text = (id: string, label: string, group: string, extra: Partial<FieldDef> = {}): FieldDef => ({
  id,
  kind: 'text',
  label,
  group,
  required: true,
  ...extra,
});

const counterparty = (label: string, group: string): FieldDef => ({
  id: 'counterparty',
  kind: 'counterparty',
  label,
  group,
  required: true,
  hint: 'Выберите из справочника – ИИН/БИН и адрес подставятся сами, или впишите наименование с ТОО или ИП',
});

const counterpartyBin = (group: string): FieldDef =>
  text('counterpartyBin', 'ИИН/БИН контрагента', group, { hint: 'Двенадцать цифр' });

const counterpartyAddress = (group: string, required = true): FieldDef =>
  text('counterpartyAddress', 'Адрес и телефон контрагента', group, { required });

const items = (label: string, spec: ItemsSpec): FieldDef => ({
  id: 'items',
  kind: 'items',
  label,
  group: 'Позиции',
  required: true,
  hint: 'Enter в последней строке добавляет следующую. Суммы и итог считаются сами',
  items: spec,
});

/* ═══ Акт выполненных работ (оказанных услуг), форма Р-1 ════════════════ */

const actR1: DocumentTemplate = {
  id: 'finance-act-r1',
  title: 'Акт выполненных работ',
  sectionId: 'finance',
  subsectionId: 'finance-primary',
  series: 'Фин',
  profile: 'standard',
  purpose: 'Форма Р-1: работы выполнены или услуги оказаны – что, когда, сколько и на какую сумму.',
  reviewed: false,
  layout: 'form',
  orientation: 'landscape',
  langs: ['ru'],
  fields: [
    counterparty('Заказчик', 'Заказчик'),
    counterpartyBin('Заказчик'),
    counterpartyAddress('Заказчик', false),
    text('contract', 'Договор (контракт)', 'Заказчик', {
      hint: 'Номер и дата договора; если его нет – «Без договора»',
      defaultValue: 'Без договора',
    }),
    items('Работы и услуги', {
      columns: [
        { id: 'name', label: 'Наименование работ (услуг)', kind: 'text', required: true, wide: true },
        {
          id: 'period',
          label: 'Дата выполнения работ (оказания услуг)',
          kind: 'text',
          hint: 'с 01.09.2026 по 30.09.2026',
          wide: true,
        },
        {
          id: 'report',
          label: 'Сведения об отчёте (дата, номер, страниц)',
          kind: 'text',
          hint: 'Для научных, маркетинговых, консультационных услуг',
          wide: true,
        },
        { id: 'unit', label: 'Единица измерения', kind: 'text', initial: 'Услуга', required: true },
        { id: 'qty', label: 'Количество', kind: 'quantity', initial: '1', required: true },
        { id: 'price', label: 'Цена за единицу', kind: 'money', required: true },
      ],
      quantity: 'qty',
      price: 'price',
    }),
    text('stocks', 'Сведения об использовании запасов заказчика', 'Приложения', {
      required: false,
      hint: 'Наименование, количество, стоимость – если работы шли из материалов заказчика',
    }),
    { id: 'attachmentPages', kind: 'number', label: 'Приложение: перечень документации, страниц', group: 'Приложения', required: false },
    text('executorPosition', 'Должность (исполнитель)', 'Подписи', { defaultFrom: '@company.directorTitle' }),
    text('executorName', 'Расшифровка подписи (исполнитель)', 'Подписи', { defaultFrom: '@company.directorNameShort' }),
    text('customerPosition', 'Должность (заказчик)', 'Подписи', { required: false }),
    text('customerName', 'Расшифровка подписи (заказчик)', 'Подписи', { required: false }),
    { id: 'signDate', kind: 'date', label: 'Дата подписания (принятия) работ', group: 'Подписи', required: false },
  ],
  body: [
    formNote(50, 'Форма Р-1'),
    {
      kind: 'grid',
      widths: [12, 62, 4, 22],
      rows: [
        [c(), c(), c(), c('**ИИН/БИН**', { align: 'center' })],
        [
          c('Заказчик'),
          line('{*counterparty}, {counterpartyAddress}', 'полное наименование, адрес, данные о средствах связи'),
          c(),
          box('{counterpartyBin}', { align: 'center', valign: 'middle' }),
        ],
        [c(' '), c(), c(), c()],
        [
          c('Исполнитель'),
          line('{*@company.legalName}, {@company.address}, {@company.phone}', 'полное наименование, адрес, данные о средствах связи'),
          c(),
          box('{@company.bin}', { align: 'center', valign: 'middle' }),
        ],
      ],
    },
    {
      kind: 'grid',
      widths: [12, 46, 12, 15, 15],
      rows: [
        [c(), c(), c(), th('Номер документа'), th('Дата составления')],
        [
          c('Договор (контракт)'),
          line('{contract}', undefined, { align: 'left' }),
          c(),
          box('{@number}', { align: 'center', bold: true }),
          box('{@date}', { align: 'center', bold: true }),
        ],
      ],
    },
    { kind: 'para', runs: para('АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ)'), align: 'center', size: 'title', keepWithNext: true },
    {
      kind: 'items',
      field: 'items',
      widths: [5, 29, 12, 18, 9, 8, 9, 10],
      head: [
        [
          th('Номер по порядку', { rowSpan: 2 }),
          th(
            'Наименование работ (услуг) (в разрезе их подвидов в соответствии с технической спецификацией, заданием, графиком выполнения работ (услуг) при их наличии)',
            { rowSpan: 2 },
          ),
          th('Дата выполнения работ (оказания услуг)', { rowSpan: 2 }),
          th(
            'Сведения об отчёте о научных исследованиях, маркетинговых, консультационных и прочих услугах (дата, номер, количество страниц) (при их наличии)',
            { rowSpan: 2 },
          ),
          th('Единица измерения', { rowSpan: 2 }),
          th('Выполнено работ (оказано услуг)', { span: 3 }),
        ],
        [th('количество'), th('цена за единицу'), th('стоимость')],
        columnNumbers(8),
      ],
      columns: [
        { value: 'n', align: 'center' },
        { value: 'name' },
        { value: 'period', align: 'center' },
        { value: 'report' },
        { value: 'unit', align: 'center' },
        { value: 'qty', align: 'right' },
        { value: 'price', align: 'right' },
        { value: 'amount', align: 'right' },
      ],
      total: [
        [
          c('', { span: 4 }),
          box('Итого', { align: 'right' }),
          box('{items:quantity}', { align: 'right' }),
          box('x', { align: 'center' }),
          box('{*items:total}', { align: 'right' }),
        ],
      ],
    },
    {
      kind: 'grid',
      widths: [36, 64],
      rows: [[c('Сведения об использовании запасов, полученных от заказчика'), line('{stocks}', 'наименование, количество, стоимость')]],
    },
    {
      kind: 'para',
      runs: para(
        'Приложение: Перечень документации, в том числе отчёт(ы) о маркетинговых, научных исследованиях, консультационных и прочих услугах (обязательны при его (их) наличии) на {attachmentPages} страниц',
      ),
      size: 'small',
    },
    {
      kind: 'grid',
      widths: [12, 11, 2, 9, 2, 13, 4, 12, 11, 2, 9, 2, 11],
      rows: [
        [
          c('Сдал (Исполнитель)'),
          line('{executorPosition}', 'должность'),
          c('/', { align: 'center' }),
          line('', 'подпись'),
          c('/', { align: 'center' }),
          line('{executorName}', 'расшифровка подписи'),
          c(),
          c('Принял (Заказчик)'),
          line('{customerPosition}', 'должность'),
          c('/', { align: 'center' }),
          line('', 'подпись'),
          c('/', { align: 'center' }),
          line('{customerName}', 'расшифровка подписи'),
        ],
        [c(' ', { span: 13 })],
        [
          c('**М.П.**', { span: 6 }),
          c(),
          c('Дата подписания (принятия) работ (услуг)', { span: 3 }),
          line('{signDate}', undefined, { span: 3 }),
        ],
        [c('', { span: 7 }), c('**М.П.**', { span: 6 })],
      ],
    },
  ],
};

/* ═══ Накладная на отпуск запасов на сторону, форма З-2 ══════════════════ */

const releaseZ2: DocumentTemplate = {
  id: 'warehouse-release-z2',
  title: 'Накладная на отпуск запасов на сторону',
  sectionId: 'warehouse',
  subsectionId: '',
  series: 'Скл',
  profile: 'standard',
  purpose: 'Форма З-2: отпуск товаров и материалов покупателю – с суммой, НДС и итогом прописью.',
  reviewed: false,
  layout: 'form',
  orientation: 'landscape',
  langs: ['ru'],
  fields: [
    counterparty('Организация-получатель', 'Получатель'),
    { id: 'responsible', kind: 'employee', label: 'Ответственный за поставку', group: 'Получатель', required: true },
    text('transport', 'Транспортная организация', 'Получатель', { required: false }),
    text('ttn', 'Товарно-транспортная накладная (номер, дата)', 'Получатель', { required: false }),
    items('Запасы', {
      columns: [
        { id: 'name', label: 'Наименование, характеристика', kind: 'text', required: true, wide: true },
        { id: 'code', label: 'Номенклатурный номер', kind: 'text' },
        { id: 'unit', label: 'Единица измерения', kind: 'text', initial: 'шт', required: true },
        { id: 'planned', label: 'Количество: подлежит отпуску', kind: 'quantity', required: true },
        {
          id: 'released',
          label: 'Количество: отпущено',
          kind: 'quantity',
          sameAs: 'planned',
          hint: 'Пусто – столько же, сколько подлежит отпуску',
        },
        { id: 'price', label: 'Цена за единицу с НДС, KZT', kind: 'money', required: true },
      ],
      quantity: 'released',
      price: 'price',
      vat: true,
    }),
    text('allowedPosition', 'Отпуск разрешил: должность', 'Подписи', { defaultFrom: '@company.directorTitle' }),
    text('allowedName', 'Отпуск разрешил: расшифровка подписи', 'Подписи', { defaultFrom: '@company.directorNameShort' }),
    text('accountant', 'Главный бухгалтер: расшифровка подписи', 'Подписи', { required: false }),
    { id: 'releasedBy', kind: 'employee', label: 'Отпустил', group: 'Подписи', required: false },
    text('poaNumber', 'По доверенности: номер и дата', 'Получение', { required: false }),
    text('poaIssuedTo', 'Кому выдана доверенность (ФИО)', 'Получение', { required: false }),
    text('receivedBy', 'Запасы получил: расшифровка подписи', 'Получение', { required: false }),
  ],
  body: [
    formNote(26, 'Форма З-2'),
    {
      kind: 'grid',
      widths: [24, 50, 8, 18],
      rows: [
        [
          c('Организация (индивидуальный предприниматель)', { size: 'small' }),
          line('{@company.legalName}', undefined, { bold: true }),
          c('ИИН/БИН', { align: 'right', valign: 'middle' }),
          box('{@company.bin}', { align: 'center', valign: 'middle', bold: true }),
        ],
      ],
    },
    {
      kind: 'grid',
      widths: [70, 15, 15],
      rows: [
        [c(), th('Номер документа'), th('Дата составления')],
        [c(), box('{@number}', { align: 'center', bold: true }), box('{@date}', { align: 'center', bold: true })],
      ],
    },
    { kind: 'para', runs: para('НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ'), align: 'center', size: 'title', keepWithNext: true },
    {
      kind: 'grid',
      widths: [20, 20, 20, 20, 20],
      rows: [
        [
          th('Организация (индивидуальный предприниматель) – отправитель'),
          th('Организация (индивидуальный предприниматель) – получатель'),
          th('Ответственный за поставку (Ф.И.О.)'),
          th('Транспортная организация'),
          th('Товарно-транспортная накладная (номер, дата)'),
        ],
        [
          box('{@company.name}', { align: 'center' }),
          box('{counterparty}', { align: 'center' }),
          box('{responsible:nom}', { align: 'center' }),
          box('{transport}', { align: 'center' }),
          box('{ttn}', { align: 'center' }),
        ],
      ],
    },
    {
      kind: 'items',
      field: 'items',
      widths: [5, 27, 10, 8, 9, 9, 10, 11, 11],
      head: [
        [
          th('Номер по порядку', { rowSpan: 2 }),
          th('Наименование, характеристика', { rowSpan: 2 }),
          th('Номенклатурный номер', { rowSpan: 2 }),
          th('Единица измерения', { rowSpan: 2 }),
          th('Количество', { span: 2 }),
          th('Цена за единицу, в KZT', { rowSpan: 2 }),
          th('Сумма с НДС, в KZT', { rowSpan: 2 }),
          th('Сумма НДС, в KZT', { rowSpan: 2 }),
        ],
        [th('подлежит отпуску'), th('отпущено')],
        columnNumbers(9),
      ],
      columns: [
        { value: 'n', align: 'center' },
        { value: 'name' },
        { value: 'code', align: 'center' },
        { value: 'unit', align: 'center' },
        { value: 'planned', align: 'right' },
        { value: 'released', align: 'right' },
        { value: 'price', align: 'right' },
        { value: 'amount', align: 'right' },
        { value: 'vat', align: 'right' },
      ],
      total: [
        [
          c('', { span: 6 }),
          box('**Итого**', { align: 'right' }),
          box('{*items:total}', { align: 'right' }),
          box('{*items:vat}', { align: 'right' }),
        ],
      ],
    },
    {
      kind: 'grid',
      widths: [24, 28, 18, 30],
      rows: [
        [
          c('Всего отпущено количество запасов (прописью)'),
          line('{items:quantityWords}', undefined, { italic: true }),
          c('на сумму (прописью), в KZT', { align: 'right' }),
          line('{items:words}', undefined, { italic: true }),
        ],
      ],
    },
    {
      kind: 'grid',
      widths: [14, 11, 2, 11, 2, 14, 6, 13, 27],
      rows: [
        [
          c('Отпуск разрешил'),
          line('{allowedPosition}', 'должность'),
          c('/', { align: 'center' }),
          line('', 'подпись'),
          c('/', { align: 'center' }),
          line('{allowedName}', 'расшифровка подписи'),
          c(),
          c('По доверенности'),
          line('{poaNumber}', 'номер и дата доверенности'),
        ],
        [c(' ', { span: 9 })],
        [
          c('Главный бухгалтер'),
          line('', 'подпись'),
          c('/', { align: 'center' }),
          line('{accountant}', 'расшифровка подписи', { span: 3 }),
          c(),
          c('выданной'),
          line('{poaIssuedTo}', 'ФИО кому выдана доверенность'),
        ],
        [c(' ', { span: 9 })],
        [c('**М.П.**', { span: 6 }), c(), c(), c()],
        [
          c('Отпустил'),
          line('', 'подпись'),
          c('/', { align: 'center' }),
          line('{releasedBy:nom}', 'расшифровка подписи', { span: 3 }),
          c(),
          c('Запасы получил'),
          line('{receivedBy}', 'подпись / расшифровка подписи'),
        ],
      ],
    },
  ],
};

/* ═══ Счёт на оплату ═════════════════════════════════════════════════════ */

const invoice: DocumentTemplate = {
  id: 'finance-invoice-kz',
  title: 'Счёт на оплату',
  sectionId: 'finance',
  subsectionId: 'finance-primary',
  series: 'Фин',
  profile: 'standard',
  purpose: 'Счёт покупателю: реквизиты для оплаты, позиции, итог с НДС и прописью.',
  reviewed: false,
  // Образца от компании нет – собран по распространённому виду счёта в
  // Казахстане: образец платёжного поручения, стороны, таблица, итог.
  generic: true,
  layout: 'form',
  langs: ['ru'],
  fields: [
    counterparty('Покупатель', 'Покупатель'),
    counterpartyBin('Покупатель'),
    counterpartyAddress('Покупатель'),
    text('contract', 'Договор', 'Покупатель', { required: false, defaultValue: 'Без договора' }),
    text('paymentCode', 'Код назначения платежа (КНП)', 'Покупатель', {
      required: false,
      hint: 'По классификатору Национального банка',
    }),
    items('Товары и услуги', {
      columns: [
        { id: 'name', label: 'Наименование', kind: 'text', required: true, wide: true },
        { id: 'code', label: 'Код', kind: 'text' },
        { id: 'unit', label: 'Единица', kind: 'text', initial: 'шт', required: true },
        { id: 'qty', label: 'Количество', kind: 'quantity', required: true },
        { id: 'price', label: 'Цена с НДС, KZT', kind: 'money', required: true },
      ],
      quantity: 'qty',
      price: 'price',
      vat: true,
    }),
    text('executorName', 'Исполнитель: расшифровка подписи', 'Подпись', { defaultFrom: '@company.directorNameShort' }),
  ],
  body: [
    { kind: 'para', runs: para('Образец платёжного поручения'), bold: true, space: 'none' },
    {
      kind: 'grid',
      widths: [50, 30, 20],
      rows: [
        [
          box('**Бенефициар:**\n{*@company.legalName}\nБИН: {@company.bin}', { rowSpan: 2 }),
          box('**ИИК**', { align: 'center' }),
          box('**Кбе**', { align: 'center' }),
        ],
        [box('{@bank.iban}', { align: 'center', bold: true }), box('{@company.kbe}', { align: 'center', bold: true })],
        [
          box('Банк бенефициара:\n{@bank.name}', { rowSpan: 2 }),
          box('**БИК**', { align: 'center' }),
          box('**Код назначения платежа**', { align: 'center' }),
        ],
        [box('{@bank.bik}', { align: 'center', bold: true }), box('{paymentCode}', { align: 'center' })],
      ],
    },
    { kind: 'para', runs: para('Счёт на оплату № {@number} от {@date:long} г.'), size: 'title', keepWithNext: true },
    {
      kind: 'grid',
      widths: [16, 84],
      rows: [
        [c('Поставщик:'), c('БИН / ИИН {@company.bin}, {@company.legalName}, {@company.address}', { bold: true })],
        [c('Покупатель:'), c('БИН / ИИН {counterpartyBin}, {counterparty}, {counterpartyAddress}', { bold: true })],
        [c('Договор:'), c('{contract}')],
      ],
    },
    {
      kind: 'items',
      field: 'items',
      widths: [5, 12, 43, 10, 7, 11, 12],
      head: [[th('№'), th('Код'), th('Наименование'), th('Кол-во'), th('Ед.'), th('Цена'), th('Сумма')]],
      columns: [
        { value: 'n', align: 'center' },
        { value: 'code', align: 'center' },
        { value: 'name' },
        { value: 'qty', align: 'right' },
        { value: 'unit', align: 'center' },
        { value: 'price', align: 'right' },
        { value: 'amount', align: 'right' },
      ],
      total: [
        [c('**Итого:**', { span: 6, align: 'right' }), c('{*items:total}', { align: 'right' })],
        [c('{*items:vatLabel}', { span: 6, align: 'right' }), c('{*items:vatOrDash}', { align: 'right' })],
      ],
    },
    { kind: 'para', runs: para('Всего наименований {items:count}, на сумму {items:total} KZT') },
    { kind: 'para', runs: para('Всего к оплате: {items:words}'), bold: true, space: 'none' },
    {
      kind: 'grid',
      widths: [14, 26, 3, 30, 27],
      rows: [
        [
          c('Исполнитель'),
          line('', 'подпись'),
          c('/', { align: 'center' }),
          line('{executorName}', 'расшифровка подписи'),
          c(),
        ],
      ],
    },
  ],
};

/* ═══ Коммерческое предложение по образцу Green Spark ════════════════════ */

/**
 * Письмо на английском, альбомный A4 – как «Quote Template - Green Spark» и
 * заполненный «Filled in - Jai». Для всех компаний (решение 30.09): логотип,
 * название и подпись – компании, в которой создают документ. Условия
 * (оплата, валюта, НДС, оговорка) – текст образца, правится в форме.
 */
const quote: DocumentTemplate = {
  id: 'procurement-sales-quote',
  title: 'Коммерческое предложение',
  sectionId: 'procurement-sales',
  subsectionId: 'sales',
  series: 'Зак',
  profile: 'standard',
  purpose: 'Предложение клиенту на английском, как в образце Green Spark: условия и таблица цен.',
  reviewed: false,
  layout: 'form',
  langs: ['en'],
  fields: [
    text('client', 'Messrs. – компания клиента', 'Клиент'),
    text('attention', 'Kind attn. – контактное лицо', 'Клиент'),
    text('reference', 'Ref. no. – номер предложения', 'Клиент', { hint: 'Например: OFF. GS-Q-261170' }),
    text('subject', 'Subject – тема', 'Клиент'),
    text('timeframe', 'Timeframe – срок и условия поставки', 'Условия', { defaultValue: 'DDP KAZAKHSTAN' }),
    {
      id: 'paymentTerms',
      kind: 'textarea',
      label: 'Terms of payment – оплата',
      group: 'Условия',
      required: true,
      defaultValue: '100% payment due within 30 days after the delivery of goods.',
    },
    {
      id: 'currency',
      kind: 'select',
      label: 'Валюта цен',
      group: 'Условия',
      required: true,
      options: ['EUR', 'USD', 'KZT'],
      defaultValue: 'EUR',
    },
    {
      id: 'currencyNote',
      kind: 'textarea',
      label: 'Currency – пояснение о курсе',
      group: 'Условия',
      required: true,
      hint: 'Впишите дату и курс Национального банка',
      defaultValue:
        'Prices are quoted in EUR, with the KZT equivalent calculated using the official exchange rate of the National Bank of the RoK as of __/__/____ (USD/KZT = ______).',
    },
    {
      id: 'priceForSow',
      kind: 'textarea',
      label: 'Price for SOW',
      group: 'Условия',
      required: true,
      defaultValue: 'Please refer to the table below for detailed pricing.',
    },
    text('vatNote', 'VAT – НДС', 'Условия', { defaultValue: 'Price excludes VAT.' }),
    { id: 'validity', kind: 'date', label: 'Price validity – предложение действует до', group: 'Условия', required: true, dateStyle: 'slash', dateLimits: { notBefore: 'today' } },
    {
      id: 'remarks',
      kind: 'textarea',
      label: 'Remarks – оговорка',
      group: 'Условия',
      required: true,
      defaultValue:
        'We reserve the right to adjust our offer if the resulting order differs in technical or commercial scope. Any changes to the scope will result in corresponding adjustments to the price.',
    },
    items('Price table – таблица цен', {
      columns: [
        {
          id: 'description',
          label: 'Material/Description',
          kind: 'lines',
          required: true,
          hint: 'Код, наименование и характеристики – каждая с новой строки',
        },
        { id: 'qty', label: 'Quantity', kind: 'quantity', required: true },
        { id: 'unit', label: 'Unit', kind: 'text', initial: 'PC', required: true },
        { id: 'price', label: 'Unit Price', kind: 'money', required: true },
      ],
      quantity: 'qty',
      price: 'price',
      step: 10,
      format: 'eu',
      currencyField: 'currency',
    }),
    { id: 'notes', kind: 'textarea', label: 'Notes', group: 'Подпись', required: false },
    text('signerName', 'Подписант (латиницей)', 'Подпись', { defaultFrom: '@company.directorNameEn' }),
    text('signerTitle', 'Должность подписанта (на английском)', 'Подпись', { defaultFrom: '@company.directorTitleEn' }),
  ],
  body: [
    { kind: 'logo' },
    { kind: 'para', runs: para('{@date:slash}'), bold: true, space: 'none' },
    {
      kind: 'grid',
      widths: [10, 40, 50],
      rows: [
        [c('Messrs.'), c(), c()],
        [c(), c('{client}'), c()],
        [c('Kind attn.'), c('{attention}', { span: 2 })],
      ],
    },
    { kind: 'para', runs: para('Ref. no. {reference}'), bold: true, align: 'justify' },
    { kind: 'para', runs: para('Subject: {subject}'), bold: true, align: 'justify', space: 'none' },
    { kind: 'para', runs: para('Dear Sirs,'), align: 'justify' },
    {
      kind: 'para',
      runs: para(
        'Many thanks for your inquiry and we are pleased to quote without engagement according with our Terms and Conditions of service, as outlined below:',
      ),
      align: 'justify',
    },
    {
      kind: 'grid',
      // На книжном листе «TERMS OF PAYMENT:» в 16 % не помещался в строку.
      widths: [20, 80],
      rows: [
        [c('**TIMEFRAME:**'), c('{timeframe}\n ')],
        [c('**TERMS OF PAYMENT:**'), c('{paymentTerms}\n ')],
        [c('**CURRENCY:**'), c('{currencyNote}\n ')],
        [c('**PRICE FOR SOW:**'), c('{priceForSow}\n ')],
        [c('**VAT:**'), c('{vatNote}\n ')],
        [c('**PRICE VALIDITY:**'), c('{validity}\n ')],
        [c('**REMARKS:**'), c('{remarks}')],
      ],
    },
    { kind: 'para', runs: para('Yours faithfully,') },
    { kind: 'para', runs: para(' '), space: 'none' },
    { kind: 'para', runs: para('{signerName}'), space: 'none' },
    { kind: 'para', runs: para('{signerTitle}'), space: 'none' },
    { kind: 'para', runs: para('For {@company.nameEn|@company.name}'), space: 'none' },
    { kind: 'para', runs: para('**Price table**'), keepWithNext: true },
    {
      kind: 'items',
      field: 'items',
      widths: [8, 44, 14, 18, 16],
      head: [[th('**Item**'), th('**Material/Description**'), th('**Quantity**'), th('**Unit Price**'), th('**Net Amount**')]],
      columns: [
        { value: 'n', align: 'center' },
        { value: 'description' },
        { value: 'qty', align: 'center', format: '{} {row:unit}' },
        { value: 'price', align: 'center', format: '{} {field:currency} / 1 {row:unit}' },
        { value: 'amount', align: 'center', format: '{} {field:currency}' },
      ],
      total: [[box('**Total Amount**', { span: 4, align: 'right' }), box('{items:total} {currency}', { align: 'center', bold: true })]],
    },
    { kind: 'para', runs: para('**Notes:** {notes}') },
  ],
};

export const formTemplates: DocumentTemplate[] = [actR1, releaseZ2, invoice, quote];
