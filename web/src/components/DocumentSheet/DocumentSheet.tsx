/**
 * Лист документа.
 *
 * Это главный предмет на экране: человек заполняет форму и сразу видит
 * настоящий лист А4, а не «предпросмотр» за отдельной кнопкой. Ошибка в
 * утверждённом документе имеет юридические последствия, поэтому видеть
 * результат нужно до сохранения, а не после.
 *
 * Бланк повторяет настоящий документ группы – приказ «AL Nurdaulet KNT» –
 * вплоть до начертаний и кеглей: наименование 9 пунктов полужирным по центру,
 * город и дата 12 пунктов полужирным, тело в колонках по выключке, подпись
 * с чертой и лист ознакомления курсивом 9 пунктов. Размеры сняты с самого
 * файла, а не подобраны на глаз.
 *
 * Бланк один на все документы. Число колонок в теле задаёт сам шаблон
 * (`langs`): три – казахская, русская, английская; одна – пока перевода нет.
 *
 * Тот же компонент печатается: класс .print-root оставляет на бумаге только
 * лист (см. styles/print.css).
 *
 * Документ длиннее листа раскладывается на несколько листов A4 (`paginate`):
 * каждый блок бланка и каждая строка таблицы – отдельный кусок, и кусок,
 * который не помещается, уходит на следующий лист целиком.
 */
import { memo, useLayoutEffect, useRef, useState } from 'react';

import { findCounterparty } from '@/api/mock/directory';
import { findEmployeeIn } from '@/store/db';
import { autoTranslate } from '@/utils/autoTranslate';
import { withCompanyDefaults } from '@/utils/companyDefaults';
import { translateJobTitle } from '@/utils/jobTitles';
import { englishName, kazakhDative } from '@/utils/names';
import { t } from '@/i18n';
import { formatDocumentDate, formatLongDate, formatMoney, formatShortDate } from '@/utils/format';
import { cellValue, filledRows, readItems } from '@/utils/items';
import { formatQuantity, formatTiyn, parseMoney, parseQuantity } from '@/utils/money';

import {
  PAGE_CONTENT_LANDSCAPE_MM,
  PAGE_CONTENT_MM,
  PX_PER_MM,
  cutsBetweenLines,
  layoutPages,
  sameLayout,
} from './paginate';

import styles from './DocumentSheet.module.css';

import type {
  BiRow,
  Company,
  DocBlock,
  DocLang,
  DocumentTemplate,
  EmployeeBrief,
  FieldDef,
  GridCell,
  ItemsColumnView,
  ItemsSpec,
  Para,
  Run,
} from '@/api/types';
import type { ItemRow, ItemsValue } from '@/utils/items';
import type { Piece, Slice } from './paginate';
import type { ReactNode } from 'react';

/** Доверенность выходит на русском и английском: казахской колонки в ней нет. */
const BI_LANGS: Array<keyof BiRow> = ['ru', 'en'];

/**
 * Черта для росписи.
 *
 * Это знаки подчёркивания, а не линия в оформлении: в документах группы
 * набрано именно так, и при копировании текста из листа черта не пропадает.
 */
const UNDERSCORE = '_'.repeat(48);

/**
 * Пропуск незаполненного поля – знаки подчёркивания, как в бумажном бланке
 * и как черта для росписи. Раньше это была линия в оформлении, приподнятая
 * к середине строки, и на листе она читалась как длинное тире («на листе
 * длинные дефисы – поменяй на нижнее подчёркивание», 29.09).
 */
const BLANK = '_'.repeat(14);

/** Держит пустую строку подписи на своей высоте. */
const NBSP = '\u00a0';

interface Props {
  template: DocumentTemplate;
  values: Record<string, string>;
  company: Company;
  /** Дата документа. */
  date: string;
  /**
   * Номер документа. Вводится вручную при заполнении и может отсутствовать:
   * тогда в листе стоит прочерк, как на неподписанном бланке.
   */
  number?: string | null;
  /** Поле, на котором сейчас стоит курсор в форме: подсвечивается в листе. */
  activeFieldId?: string | null;
  /**
   * Снимок карточек людей из сохранённого документа. Пока его нет (черновик),
   * фамилии берутся из текущего справочника компании.
   */
  people?: Record<string, EmployeeBrief>;
}

/**
 * Лист не перерисовывается, пока его данные те же: форма перерисовывается на
 * каждое нажатие клавиши, а лист получает значения отложенно
 * (`DocumentFormPage`, `useDeferredValue`).
 */
export const DocumentSheet = memo(function DocumentSheet({
  template,
  values: written,
  company,
  date,
  number = null,
  activeFieldId = null,
  people,
}: Props) {
  // Поля подписи из реквизитов, которых не правили руками, – из карточки:
  // у черновика текущей, у выпущенного – его снимка (19.10).
  const values = withCompanyDefaults(template.fields, written, company);
  const fieldsById = new Map<string, FieldDef>(template.fields.map((f) => [f.id, f]));
  const pagesRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Slice[][] | null>(null);

  /**
   * `blank` – чем показать незаполненное поле: знаками подчёркивания или
   * пробелом. В строке для заполнения черта уже нарисована, и
   * подчёркивания легли бы на неё второй чертой.
   */
  function renderRuns(runs: Run[], keyPrefix: string, lang: DocLang = 'ru', blank: 'underscore' | 'space' = 'underscore') {
    return runs.map((run, index) => {
      const key = `${keyPrefix}-${index}`;

      if ('text' in run) {
        return run.bold === true ? (
          <strong key={key}>{run.text}</strong>
        ) : (
          <span key={key}>{run.text}</span>
        );
      }

      const resolved =
        run.map !== undefined
          ? (run.map[values[baseFieldId(run.field)] ?? ''] ?? run.otherwise ?? '')
          : (documentRef(run.field, number, date) ??
            (resolveField(run.field, values, company, fieldsById, people, lang) ||
              (run.fallback === undefined
                ? ''
                : resolveField(run.fallback, values, company, fieldsById, people, lang))));
      const isActive = activeFieldId !== null && baseFieldId(run.field) === activeFieldId;

      if (resolved === '') {
        return (
          <span
            key={key}
            className={isActive ? `${styles.blank} ${styles.blankActive}` : styles.blank}
            aria-label={t.form.emptyPlaceholder}
          >
            {blank === 'space' ? NBSP : BLANK}
          </span>
        );
      }

      const className = [
        isActive ? styles.valueActive : styles.value,
        // ФИО работника в приказе набрано полужирным – так в образце.
        run.bold === true ? styles.strong : '',
      ]
        .filter(Boolean)
        .join(' ');

      return (
        <span key={key} className={className}>
          {resolved}
        </span>
      );
    });
  }

  /** Ячейка таблицы: несколько абзацев одного языка. */
  function renderCell(paras: Para[] | undefined, keyPrefix: string, lang: DocLang) {
    return (paras ?? []).map((para, index) => (
      <p key={`${keyPrefix}-${index}`} className={styles.cellPara}>
        {renderRuns(para, `${keyPrefix}-${index}`, lang)}
      </p>
    ));
  }

  function renderBlock(block: DocBlock, index: number) {
    const key = `b-${index}`;

    switch (block.kind) {
      case 'letterhead': {
        // Логотип слева, три строки наименования по центру – так стоит на
        // настоящих бланках группы. Казахская строка первая: документ на
        // государственном языке идёт первым.
        const names = [company.legalNameKk, company.legalName, company.legalNameEn].filter(
          isFilled,
        );

        return (
          <header key={key} className={styles.letterhead}>
            <div className={styles.letterheadMark}>
              {company.logo === undefined ? (
                <span className={styles.letterheadMonogram} aria-hidden="true">
                  {company.monogram}
                </span>
              ) : (
                <img className={styles.letterheadLogo} src={company.logo} alt="" />
              )}
            </div>
            <div className={styles.letterheadNames}>
              {names.map((name) => (
                <div key={name} className={styles.letterheadName}>
                  {name}
                </div>
              ))}
            </div>
          </header>
        );
      }

      case 'place-date':
        // «Астана қ./г. Астана / Astana city» слева, дата справа. Разделители
        // стоят ровно так, как в образце.
        return (
          <div key={key} className={styles.placeDate}>
            <span className={styles.place}>{placeLine(company)}</span>
            <span className={styles.date}>{formatShortDate(date)}</span>
          </div>
        );

      case 'order-title': {
        // Номер стоит в той же строке, что и слово «ПРИКАЗ», и подсвечивается,
        // когда курсор в поле номера.
        const numberActive = activeFieldId === '@number';
        return (
          <h1 key={key} className={styles.orderTitle}>
            {block.words.kk} / {block.words.ru} / {block.words.en} №{' '}
            <span
              className={[
                number === null ? styles.numberBlank : styles.numberValue,
                numberActive ? styles.numberHighlight : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {number ?? t.sheet.numberPlaceholder}
            </span>
          </h1>
        );
      }

      case 'tri-line':
        return (
          <p key={key} className={styles.triLine}>
            {block.words.kk} / {block.words.ru} / {block.words.en}
          </p>
        );

      case 'tri-table':
        // Строки таблицы раскладываются по листам поштучно (`fragmentsOf`),
        // сюда приходит таблица из одной строки.
        return (
          <div key={key} className={styles.triTable}>
            {block.rows.map((row, rowIndex) => (
              <div
                key={`${key}-${rowIndex}`}
                className={styles.triRow}
                style={{ gridTemplateColumns: `repeat(${template.langs.length}, minmax(0, 1fr))` }}
              >
                {template.langs.map((lang) => (
                  <div key={lang} className={styles.triCell} lang={lang}>
                    {renderCell(row[lang], `${key}-${rowIndex}-${lang}`, lang)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );

      case 'tri-signature': {
        // Должность столбиком на трёх языках слева, подпись справа. Черты
        // между ними нет: место для росписи остаётся пустым.
        //
        // Справа стоит фамилия с инициалами – «Ихсанова С.Т.», а не полное
        // имя: так подписаны документы группы.
        const roles = [
          company.directorTitleKk,
          company.directorTitle,
          company.directorTitleEn,
        ].filter(isFilled);
        const name = [
          company.directorNameShort ?? company.directorName,
          company.directorNameEn,
        ]
          .filter(isFilled)
          .join(' / ');
        const middle = Math.floor(roles.length / 2);

        // Строка над подписью: своя у документа (договор, заявка) или
        // «Жұмыс беруші» из бланка компании.
        const caption =
          block.caption === undefined
            ? company.employerCaption === true
              ? t.sheet.employer
              : null
            : block.caption === null
              ? null
              : `${block.caption.kk} / ${block.caption.ru} / ${block.caption.en}:`;

        return (
          <div key={key} className={styles.signature}>
            {caption === null ? null : (
              <div className={styles.signatureCaption}>{caption}</div>
            )}
            <div className={styles.signatureRows}>
              <div className={styles.signatureRoles}>
                {roles.map((role) => (
                  <div key={role}>{role}</div>
                ))}
              </div>
              <div className={styles.signatureNames}>
                {roles.map((role, roleIndex) => (
                  <div key={role}>{roleIndex === middle ? name : NBSP}</div>
                ))}
              </div>
            </div>
          </div>
        );
      }

      case 'tri-acquaint':
        // Лист ознакомления стоит справа, под подписью руководителя, а черта
        // набрана знаками подчёркивания – так в документах группы, и так она
        // переживает копирование текста из листа.
        return (
          <div key={key} className={styles.acquaint}>
            <div>{t.sheet.acquaintKk}</div>
            <div>{t.sheet.acquaintTitle}</div>
            <div>{t.sheet.acquaintEn}</div>
            <div className={styles.acquaintLine}>{UNDERSCORE}</div>
            <div>{t.sheet.signatureCaption}</div>
          </div>
        );

      case 'executor':
        return (
          <div key={key} className={styles.executor}>
            {renderRuns(block.runs, key)}
          </div>
        );

      // ── Бланк доверенности ──────────────────────────────────────────────

      case 'poa-title':
        return (
          <div key={key} className={styles.poaTitle}>
            <div className={styles.poaTitleCell} lang="ru">
              <div className={styles.poaTitleText}>{block.words.ru}</div>
              <div className={styles.poaTitleMeta}>
                Выдана в г. {company.city}, {formatDocumentDate(date)}
              </div>
            </div>
            <div className={styles.poaTitleCell} lang="en">
              <div className={styles.poaTitleText}>{block.words.en}</div>
              <div className={styles.poaTitleMeta}>
                Issued in {company.cityEn ?? company.city} city, {formatShortDate(date)}
              </div>
            </div>
          </div>
        );

      case 'bi-table':
        return (
          <div key={key} className={styles.biTable}>
            {block.rows.map((row, rowIndex) => (
              <div key={`${key}-${rowIndex}`} className={styles.biRow}>
                {BI_LANGS.map((lang) => (
                  <div key={lang} className={styles.biCell} lang={lang}>
                    {renderCell(row[lang], `${key}-${rowIndex}-${lang}`, lang)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );

      case 'poa-signature':
        return (
          <div key={key} className={styles.poaSignature}>
            <div className={styles.poaSignatureLine}>{UNDERSCORE}</div>
            <div>
              {[company.directorTitle, company.directorTitleEn].filter(isFilled).join(' / ')}
            </div>
            <div>{company.name}</div>
            <div>
              {[company.directorNameShort ?? company.directorName, company.directorNameEn]
                .filter(isFilled)
                .join(' / ')}
            </div>
          </div>
        );

      // ── Формы с таблицей позиций ────────────────────────────────────────

      case 'form-note':
        return (
          <div key={key} className={styles.formNote}>
            {block.lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        );

      case 'logo':
        return (
          <div key={key} className={styles.formLogo}>
            {company.logo === undefined ? (
              <span className={styles.letterheadMonogram} aria-hidden="true">
                {company.monogram}
              </span>
            ) : (
              <img className={styles.formLogoImage} src={company.logo} alt="" />
            )}
          </div>
        );

      case 'grid':
        return renderGrid(block.widths, block.rows, key, block.space === 'none' ? undefined : styles.spaced);

      case 'para':
        return (
          <p
            key={key}
            className={[
              styles.formPara,
              block.space === 'none' ? '' : styles.spaced,
              block.bold === true ? styles.strongText : '',
              block.size === 'small' ? styles.small : block.size === 'title' ? styles.formTitle : '',
              ALIGN[block.align ?? 'left'],
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {renderRuns(block.runs, key)}
          </p>
        );

      case 'items':
        // Раскладывается по листам поштучно (`fragmentsOf`): шапка, строки, итог.
        return (
          <div key={key}>
            {itemsPieces(block).map((piece) => (
              <div key={piece.key}>{piece.node}</div>
            ))}
          </div>
        );

      default:
        return null;
    }
  }

  /** Таблица из ячеек формы. Ширины – доли, как колонки в Word. */
  function renderGrid(widths: number[], rows: GridCell[][], key: string, extraClass?: string) {
    const sum = widths.reduce((a, b) => a + b, 0) || 1;
    return (
      <table key={key} className={[styles.grid, extraClass ?? ''].filter(Boolean).join(' ')}>
        <colgroup>
          {widths.map((width, index) => (
            <col key={index} style={{ width: `${(width / sum) * 100}%` }} />
          ))}
        </colgroup>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} colSpan={cell.span} rowSpan={cell.rowSpan} className={cellClass(cell)}>
                  {/* Строка для заполнения: черта – под самим значением, подпись
                      («должность», «подпись») – строго под чертой. */}
                  <div className={cell.border === 'line' ? styles.lineValue : undefined}>
                    {(cell.paras ?? []).map((para, paraIndex) => (
                      <p key={paraIndex} className={styles.gridPara}>
                        {renderRuns(
                          para,
                          `${key}-${rowIndex}-${cellIndex}-${paraIndex}`,
                          'ru',
                          cell.border === 'line' ? 'space' : 'underscore',
                        )}
                      </p>
                    ))}
                  </div>
                  {cell.caption === undefined ? null : <div className={styles.gridCaption}>{cell.caption}</div>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  /**
   * Таблица позиций: куски для раскладки по листам – по куску на строку и
   * итог. Шапка идёт одним куском с первой строкой: шапка без строк внизу
   * листа – как «не отрывать от следующего» в Word. Ширины колонок у всех
   * кусков одни, поэтому колонки идут ровно, на каком бы листе строка ни
   * оказалась.
   */
  function itemsPieces(block: Extract<DocBlock, { kind: 'items' }>): Array<{ key: string; node: ReactNode }> {
    const spec = fieldsById.get(block.field)?.items;
    const stored = readItems(values[block.field] ?? '');
    const key = `items-${block.field}`;
    const head = renderGrid(block.widths, block.head, `${key}-head`, styles.itemsHead);
    const pieces: Array<{ key: string; node: ReactNode }> = [];

    const rows = spec === undefined || stored === null ? [] : filledRows(stored.rows, spec);
    if (spec === undefined || stored === null || rows.length === 0) {
      // Пустая таблица – одна пустая строка: форма остаётся формой.
      const empty: GridCell[] = block.columns.map(() => ({ border: 'box', paras: [[{ text: NBSP }]] }));
      pieces.push({ key: `${key}-empty`, node: renderGrid(block.widths, [empty], `${key}-empty`, styles.itemsRow) });
    } else {
      for (const { row, index, number: n } of rows) {
        const cells: GridCell[] = block.columns.map((view) => ({
          border: 'box',
          align: view.align ?? 'left',
          paras: itemCell(view, row, index, n, spec, stored).map((text) => [{ text }]),
        }));
        pieces.push({
          key: `${key}-${index}`,
          node: renderGrid(block.widths, [cells], `${key}-${index}`, styles.itemsRow),
        });
      }
    }

    const first = pieces[0];
    if (first !== undefined) {
      pieces[0] = {
        key: first.key,
        node: (
          <>
            {head}
            {first.node}
          </>
        ),
      };
    }

    if (block.total !== undefined) {
      pieces.push({ key: `${key}-total`, node: renderGrid(block.widths, block.total, `${key}-total`, styles.itemsRow) });
    }
    return pieces;
  }

  /** Текст ячейки таблицы позиций: по абзацу на строку (описание в КП многострочное). */
  function itemCell(
    view: ItemsColumnView,
    row: ItemRow,
    index: number,
    n: number,
    spec: ItemsSpec,
    stored: ItemsValue,
  ): string[] {
    const style = spec.format ?? 'kz';
    const line = stored.lines[index] ?? null;
    let text: string;
    if (view.value === 'n') {
      text = String(n);
    } else if (view.value === 'amount') {
      text = line === null ? '' : formatTiyn(BigInt(line.amount), style);
    } else if (view.value === 'vat') {
      text = line?.vat == null ? (stored.vat === null ? t.sheet.noVat : '') : formatTiyn(BigInt(line.vat), style);
    } else {
      const column = spec.columns.find((c) => c.id === view.value);
      const raw = column === undefined ? '' : cellValue(row, column);
      if (column?.kind === 'quantity') {
        const qty = parseQuantity(raw);
        text = qty === null ? raw : formatQuantity(qty, style);
      } else if (column?.kind === 'money') {
        const money = parseMoney(raw);
        text = money === null ? raw : formatTiyn(money, style);
      } else {
        text = raw;
      }
    }
    if (view.format !== undefined && text !== '') {
      text = view.format
        .replace(/\{row:([\w-]+)\}/gu, (_, id: string) => row[id] ?? '')
        .replace(/\{field:([\w-]+)\}/gu, (_, id: string) => values[id] ?? '')
        .replace('{}', text);
    }
    return text.split('\n');
  }

  /**
   * Куски, которые раскладываются по листам.
   *
   * Таблица режется по строкам: тело приказа – это таблица, и целиком она на
   * следующий лист не переезжает. Первая строка таблицы держит отступ перед
   * таблицей, следующие – отступ между строками, как и было в одном блоке.
   */
  function fragmentsOf(block: DocBlock, index: number): Fragment[] {
    if (block.kind === 'tri-table' || block.kind === 'bi-table') {
      return block.rows.map((_, rowIndex) => {
        const single: DocBlock =
          block.kind === 'tri-table'
            ? { kind: 'tri-table', rows: block.rows.slice(rowIndex, rowIndex + 1) }
            : { kind: 'bi-table', rows: block.rows.slice(rowIndex, rowIndex + 1) };
        const node = renderBlock(single, index);
        return {
          key: `b-${index}-${rowIndex}`,
          node:
            rowIndex === 0 ? node : <div className={styles.tableContinued}>{node}</div>,
          // Строку тела можно разорвать между строками текста, как в Word.
          splittable: true,
        };
      });
    }
    if (block.kind === 'items') {
      return itemsPieces(block).map((piece, pieceIndex) => ({
        key: `b-${index}-${piece.key}`,
        node: piece.node,
        splittable: false,
        // Первый кусок – шапка со своей рамкой; у строк и итога верха нет.
        openTop: pieceIndex > 0,
      }));
    }
    return [
      {
        key: `b-${index}`,
        node: renderBlock(block, index),
        splittable: false,
        keepWithNext: block.kind === 'para' && block.keepWithNext === true,
      },
    ];
  }

  const fragments = joinKeptWithNext(template.body.flatMap(fragmentsOf));
  const landscape = template.orientation === 'landscape';
  const pageHeightMm = landscape ? PAGE_CONTENT_LANDSCAPE_MM : PAGE_CONTENT_MM;

  // Раскладка считается по настоящей высоте кусков после отрисовки. Высота
  // куска не зависит от того, на каком он листе: ширина у всех листов одна.
  useLayoutEffect(() => {
    const root = pagesRef.current;
    if (root === null) return undefined;

    const measure = () => {
      const next = layoutPages(measurePieces(root, fragments.length), pageHeightMm * PX_PER_MM);
      setLayout((prev) => (sameLayout(prev, next) ? prev : next));
    };

    measure();

    // Логотип и шрифты догружаются позже первой отрисовки и меняют высоту.
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    root.querySelectorAll('[data-piece]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  });

  const pages: Slice[][] =
    layout !== null && sameIndices(layout, fragments.length)
      ? layout
      : [fragments.map((_, index) => ({ index, from: 0, to: 0 }))];

  // Сколько частей у каждого куска: одна – кусок показан целиком.
  const splitCount = new Map<number, number>();
  for (const slice of pages.flat()) {
    splitCount.set(slice.index, (splitCount.get(slice.index) ?? 0) + 1);
  }

  // Водяного знака на листе нет: документ должен выглядеть ровно так, как
  // он выйдет на бумагу. Что запись ещё черновик, видно рядом с листом –
  // штампом состояния и пометкой на странице документа.
  return (
    <div className={styles.pages} ref={pagesRef}>
      {pages.map((slices, pageIndex) => (
        <article
          key={pageIndex}
          className={landscape ? `${styles.sheet} ${styles.sheetLandscape}` : styles.sheet}
          lang="ru"
          data-page={pageIndex + 1}
          data-orientation={landscape ? 'landscape' : 'portrait'}
        >
          <div className={styles.content}>
            {slices.map((slice, sliceIndex) => {
              const fragment = fragments[slice.index];
              if (fragment === undefined) return null;
              const opensPage = pageIndex > 0 && sliceIndex === 0 && fragment.openTop === true;

              const body = (
                <div
                  className={opensPage ? `${styles.fragment} ${styles.pageTop}` : styles.fragment}
                  data-piece={slice.index}
                  data-splittable={fragment.splittable ? '' : undefined}
                  style={slice.from > 0 ? { marginTop: -slice.from } : undefined}
                >
                  {fragment.node}
                </div>
              );

              // Кусок целиком – как есть. Часть разорванной строки – окно
              // нужной высоты, в котором строка сдвинута на уже показанное.
              return (splitCount.get(slice.index) ?? 0) < 2 ? (
                <div key={`${fragment.key}-${slice.from}`}>{body}</div>
              ) : (
                <div
                  key={`${fragment.key}-${slice.from}`}
                  className={styles.slice}
                  style={{ height: slice.to - slice.from }}
                  // Продолжение повторяет текст куска – читалке экрана
                  // хватает первой части.
                  aria-hidden={slice.from > 0 ? true : undefined}
                >
                  {body}
                </div>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
});

interface Fragment {
  key: string;
  node: ReactNode;
  /** Можно ли разорвать кусок между строками текста. */
  splittable: boolean;
  /** Идёт на лист вместе со следующим куском (заголовок и его таблица). */
  keepWithNext?: boolean;
  /**
   * Строка таблицы позиций без верхней черты: её рисует нижняя черта строки
   * выше. Строке, с которой начинается лист, нужна своя – строка выше
   * осталась на прошлом листе.
   */
  openTop?: boolean;
}

/**
 * Склеивает кусок «не отрывать от следующего» со следующим: заголовок
 * «Price table» или «АКТ ВЫПОЛНЕННЫХ РАБОТ» не остаётся внизу листа без
 * своей таблицы – как одноимённая настройка абзаца в Word.
 */
function joinKeptWithNext(list: Fragment[]): Fragment[] {
  const out: Fragment[] = [];
  let pending: Fragment | null = null;
  for (const fragment of list) {
    const current: Fragment =
      pending === null
        ? fragment
        : {
            key: `${pending.key}+${fragment.key}`,
            node: (
              <>
                {pending.node}
                {fragment.node}
              </>
            ),
            splittable: false,
            keepWithNext: fragment.keepWithNext === true,
          };
    if (current.keepWithNext === true) {
      pending = current;
    } else {
      out.push(current);
      pending = null;
    }
  }
  if (pending !== null) out.push(pending);
  return out;
}

const ALIGN: Record<'left' | 'center' | 'right' | 'justify', string> = {
  left: '',
  center: styles.alignCenter ?? '',
  right: styles.alignRight ?? '',
  justify: styles.alignJustify ?? '',
};

function cellClass(cell: GridCell): string {
  return [
    styles.gridCell,
    cell.border === 'box' ? styles.cellBox : '',
    ALIGN[cell.align ?? 'left'],
    cell.valign === 'middle' ? styles.valignMiddle : cell.valign === 'bottom' ? styles.valignBottom : '',
    cell.bold === true ? styles.strongText : '',
    cell.italic === true ? styles.italic : '',
    cell.size === 'small' ? styles.small : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Номер и дата документа в тексте формы: `@number` – номер, `@date` –
 * «31.03.2024», `@date:long` – «31 марта 2024», `@date:slash` –
 * «17/09/2026», как в КП Green Spark. Не такая ссылка – `undefined`, её
 * разбирает `resolveField`.
 */
function documentRef(fieldId: string, number: string | null, date: string): string | undefined {
  switch (fieldId) {
    case '@number':
      return number ?? '';
    case '@date':
      return formatShortDate(date);
    case '@date:long':
      return formatLongDate(date, 'ru');
    case '@date:slash':
      return formatShortDate(date).replace(/\./gu, '/');
    default:
      return undefined;
  }
}

/** Раскладка относится к этим же кускам: число кусков совпадает. */
function sameIndices(layout: Slice[][], count: number): boolean {
  const seen = new Set(layout.flatMap((page) => page.map((slice) => slice.index)));
  return seen.size === count;
}

/**
 * Высота каждого куска и места, где его можно разорвать.
 *
 * Меряется содержимое куска, а не окно, в котором он показан: у разорванной
 * строки окно ниже содержимого. Лист на экране уменьшен (`SheetViewport`),
 * поэтому координаты строк текста пересчитываются в настоящий размер.
 */
function measurePieces(root: HTMLElement, count: number): Piece[] {
  const pieces: Piece[] = Array.from({ length: count }, () => ({ height: 0 }));
  const measured = new Set<number>();

  root.querySelectorAll<HTMLElement>('[data-piece]').forEach((node) => {
    const index = Number(node.dataset.piece);
    if (measured.has(index) || index >= count) return;
    measured.add(index);

    const height = node.offsetHeight;
    const piece: Piece = { height };

    if (node.dataset.splittable !== undefined && height > 0) {
      const box = node.getBoundingClientRect();
      const scale = box.height / height || 1;
      const lines: Array<{ top: number; bottom: number }> = [];

      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) {
        if ((text.textContent ?? '').trim() === '') continue;
        range.selectNodeContents(text);
        for (const rect of Array.from(range.getClientRects())) {
          if (rect.height === 0) continue;
          lines.push({
            top: (rect.top - box.top) / scale,
            bottom: (rect.bottom - box.top) / scale,
          });
        }
      }
      piece.cuts = cutsBetweenLines(lines);
    }

    pieces[index] = piece;
  });

  return pieces;
}

/**
 * Город в шапке: «Астана қ./г. Астана / Astana city».
 *
 * Разделители стоят как в образце: после казахского названия «қ.» и сразу
 * косая без пробела. Английское написание печатается ровно так, как оно
 * записано в карточке: слово «city» стоит не во всех бланках группы, и
 * дописывать его кодом нельзя. Если казахского или английского написания
 * нет, часть просто не печатается – три одинаковых слова через косую
 * выглядели бы как ошибка.
 */
function placeLine(company: Company): string {
  const parts: string[] = [];
  if (isFilled(company.cityKk)) parts.push(`${company.cityKk} қ./`);
  parts.push(`г. ${company.city}`);
  if (isFilled(company.cityEn)) parts.push(` / ${company.cityEn}`);
  return parts.join('');
}

/** Реквизит заполнен: необязательные поля компании приходят и пустыми. */
function isFilled(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== '';
}

/**
 * Поле в шаблоне может быть записано с формой слова: `employee:nom`.
 *
 * Это не новое поле, а то же самое в другом падеже. По умолчанию берётся та
 * форма, в какой ФИО стоит после глагола приказа: «принять Ахметова»,
 * «Ахметовке демалыс беру». `:nom` – именительный падеж, он нужен там, где
 * работник стоит подлежащим: «Сағын Дидар Есболұлы ... қабылдансын».
 *
 * Значение и подсветка при этом общие, поэтому имя поля отделяется от формы.
 */
function baseFieldId(fieldId: string): string {
  const colon = fieldId.indexOf(':');
  return colon === -1 ? fieldId : fieldId.slice(0, colon);
}

function fieldForm(fieldId: string): 'nom' | 'obj' {
  return fieldId.endsWith(':nom') ? 'nom' : 'obj';
}

/**
 * ФИО работника на нужном языке и в нужной форме.
 *
 * Падежи и написание латиницей хранятся данными, а не вычисляются: склонять
 * казахские и составные фамилии программно нельзя, ошибка попадёт прямо в
 * текст приказа. Чего нет в карточке, то заменяется основной формой – она
 * видна на листе, и человек сразу поймёт, что данных не хватает.
 */
function employeeName(person: EmployeeBrief, lang: DocLang, form: 'nom' | 'obj'): string {
  // В английском падежей нет: обе формы дают одно и то же написание. Нет
  // латиницы в карточке – собирается транслитерацией, а не идёт кириллица.
  if (lang === 'en') return person.fullNameEn ?? englishName(person.fullName);

  const nominative = lang === 'kk' ? (person.fullNameKk ?? person.fullName) : person.fullName;
  if (form === 'nom') return nominative;

  // Дательный падеж в казахском: с карточки, иначе окончание ставится по
  // правилам («…Жанболатовичке»).
  return lang === 'kk'
    ? (person.fullNameKkDative ?? kazakhDative(nominative))
    : person.fullNameGenitive;
}

/**
 * Подставляет значение поля в текст документа.
 *
 * Поля, начинающиеся с «@», берутся из реквизитов компании: их человек не
 * вводит, и подменить их через форму нельзя.
 */
function resolveField(
  rawFieldId: string,
  values: Record<string, string>,
  company: Company,
  fieldsById: Map<string, FieldDef>,
  people: Record<string, EmployeeBrief> | undefined,
  lang: DocLang,
): string {
  const fieldId = baseFieldId(rawFieldId);
  const form = fieldForm(rawFieldId);

  if (fieldId.startsWith('@company.')) {
    const key = fieldId.slice('@company.'.length) as keyof Company;
    const value = company[key];
    return typeof value === 'string' ? value : '';
  }

  // Банк компании для счёта: название, БИК и счёт в тенге (первый, если
  // счёта в тенге нет).
  if (fieldId.startsWith('@bank.')) {
    const bank = company.bank;
    if (bank === undefined) return '';
    const account = bank.accounts.find((a) => a.currency === 'KZT') ?? bank.accounts[0];
    if (fieldId === '@bank.name') return bank.name;
    if (fieldId === '@bank.bik') return bank.bik;
    if (fieldId === '@bank.iban') return account?.iban ?? '';
    return '';
  }

  const raw = values[fieldId];
  if (raw === undefined || raw === '') return '';

  const def = fieldsById.get(fieldId);

  // Итоги таблицы позиций: `items:total`, `items:vat`, `items:words`… –
  // из посчитанного и сохранённого в снимке.
  if (def?.kind === 'items' && def.items !== undefined) {
    return itemsSummary(raw, def.items, rawFieldId.slice(fieldId.length + 1));
  }

  // Значение, написанное для этой колонки отдельно: имя и число прописью
  // заполняются на каждом языке своим полем.
  if (def?.perLang === true && lang !== 'ru') {
    const written = values[`${fieldId}.${lang}`];
    if (written !== undefined && written.trim() !== '') {
      // Имя на казахском в приказе стоит в дательном падеже. Написание
      // совпадает с карточкой – падеж берётся с неё, иначе окончание
      // ставится к тому, что вписано.
      if (def.kind === 'employee' && lang === 'kk' && form === 'obj') {
        const person = people?.[raw] ?? findEmployeeIn(company.id, raw);
        const cardName = person === undefined ? undefined : (person.fullNameKk ?? person.fullName);
        return cardName === written.trim() && person?.fullNameKkDative !== undefined
          ? person.fullNameKkDative
          : kazakhDative(written);
      }
      return written;
    }
    // Перевода не вписали, но его можно получить по правилу поля: должность
    // и подразделение – из словаря, город, организация, адрес – по своим
    // правилам («Тест день 4»). В колонку идёт перевод, а не русское слово.
    if (def.kind === 'text' || def.kind === 'textarea') {
      const translated = autoTranslate(def.translate ?? 'dictionary', raw, lang);
      if (translated !== undefined) return translated;
    }
  }

  // Вариант списка – на языке колонки; значение хранится русским.
  if ((def?.kind === 'select' || def?.kind === 'multiselect') && lang !== 'ru') {
    const labels = def.optionLabels ?? {};
    return lines(raw)
      .map((option) => labels[option]?.[lang] ?? option)
      .join(', ');
  }

  switch (def?.kind) {
    case 'employee': {
      // У сохранённого документа фамилия берётся из его собственного снимка:
      // правка или удаление карточки в справочнике не должна менять уже
      // выпущенный приказ (CLAUDE.md, п. 3.4). У черновика снимка нет, и он
      // смотрит в текущий справочник компании.
      //
      // Если ФИО вписано руками, а не выбрано из справочника, падежа у него
      // нет – оно идёт в документ как есть. Форма об этом предупреждает.
      const person = people?.[raw] ?? findEmployeeIn(company.id, raw);
      if (person !== undefined) return employeeName(person, lang, form);
      // ФИО вписано руками: по-русски как есть, латиницей и в казахском
      // падеже – по правилам.
      if (lang === 'en') return englishName(raw);
      return lang === 'kk' && form === 'obj' ? kazakhDative(raw) : raw;
    }
    case 'multiselect':
      return lines(raw).join(', ');
    case 'employees':
      // Члены комиссии: ФИО и должность каждого – на языке колонки, из
      // карточки персонала или снимка документа. Кого нет в персонале,
      // вписан строкой и идёт как есть.
      return lines(raw)
        .map((line) => {
          const person = people?.[line] ?? findEmployeeIn(company.id, line);
          return person === undefined ? line : memberLine(person, lang);
        })
        .join('; ');
    case 'counterparty':
      // Вписанная руками организация идёт в документ как есть.
      return findCounterparty(raw)?.name ?? raw;
    case 'date':
      // В документе дата пишется числами – «с 04.09.2026 по 27.09.2026», как
      // в настоящих приказах группы. Там, где шаблон просит прописью, она
      // пишется словами на языке своей колонки.
      if (def.dateStyle === 'long') return formatLongDate(raw, lang);
      return def.dateStyle === 'slash' ? formatShortDate(raw).replace(/\./gu, '/') : formatShortDate(raw);
    case 'money':
      return formatMoney(raw);
    default:
      return raw;
  }
}

/** Итог таблицы позиций для текста документа. */
function itemsSummary(raw: string, spec: ItemsSpec, what: string): string {
  const stored = readItems(raw);
  if (stored === null) return '';
  const style = spec.format ?? 'kz';
  switch (what) {
    case 'total':
      return formatTiyn(BigInt(stored.total), style);
    case 'vat':
      return stored.vat === null ? t.sheet.noVat : formatTiyn(BigInt(stored.vat), style);
    case 'vatRate':
      return stored.vatRate === null ? '' : String(stored.vatRate);
    // Строка под итогом счёта: «В том числе НДС:» и сумма, у компании без
    // НДС – «Без налога (НДС)» и прочерк, как в счетах 1С.
    case 'vatLabel':
      return stored.vat === null ? t.sheet.vatNone : t.sheet.vatIncluded;
    case 'vatOrDash':
      return stored.vat === null ? '–' : formatTiyn(BigInt(stored.vat), style);
    case 'words':
      return stored.words;
    case 'quantity':
      return formatQuantity(BigInt(stored.quantity), style);
    case 'quantityWords':
      return stored.quantityWords;
    case 'count':
      return String(filledRows(stored.rows, spec).length);
    default:
      return '';
  }
}

/** Непустые строки многострочного значения. */
function lines(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/**
 * Член комиссии в строке приказа: «Ким Ирина Сергеевна – бухгалтер»,
 * «Irina Kim, Accountant». Должность со строчной буквы, если это не
 * сокращение («HR-менеджер» остаётся как есть).
 */
function memberLine(person: EmployeeBrief, lang: DocLang): string {
  const name = employeeName(person, lang, 'nom');
  const position =
    lang === 'ru'
      ? person.position
      : lang === 'kk'
        ? (person.positionKk ?? translateJobTitle(person.position, 'kk') ?? person.position)
        : (person.positionEn ?? translateJobTitle(person.position, 'en') ?? person.position);
  if (position.trim() === '') return name;
  if (lang === 'en') return `${name}, ${position}`;
  const second = position.charAt(1);
  const lower =
    second !== '' && second === second.toLocaleLowerCase('ru')
      ? position.charAt(0).toLocaleLowerCase('ru') + position.slice(1)
      : position;
  return `${name} – ${lower}`;
}
