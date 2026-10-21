/**
 * Таблица позиций в форме: товары, работы, услуги.
 *
 * Форма узкая (лист документа рядом), поэтому строка таблицы – карточка:
 * колонки стоят подписанными полями, сумма строки видна сразу. Enter в
 * последней строке добавляет следующую и ставит в неё курсор («Тест день
 * 4», дополнение: «номер по порядку после нажатия Enter»); в строке выше –
 * переводит в ту же колонку ниже. Форма по Enter не отправляется.
 *
 * При каждой правке таблица пересчитывается (`utils/items.ts`), и в
 * значение поля уходят и строки, и посчитанные суммы – они же попадут в
 * снимок документа.
 */
import { useEffect, useRef } from 'react';

import { t } from '@/i18n';
import { tc } from '@/i18n/content';
import { computeItems, emptyRow, readItems, writeItems } from '@/utils/items';
import { formatTiyn } from '@/utils/money';

import styles from './Field.module.css';

import type { ItemsSpec } from '@/api/types';
import type { ItemRow } from '@/utils/items';
import type { KeyboardEvent } from 'react';

interface Props {
  id: string;
  value: string;
  spec: ItemsSpec;
  /** Ставка НДС компании; `null` – компания не плательщик НДС. */
  vatRate: number | null;
  /** Знак валюты у сумм: «₸», «EUR». */
  currency: string;
  invalid?: boolean;
  describedBy?: string | undefined;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}

export function ItemsEditor({
  id,
  value,
  spec,
  vatRate,
  currency,
  invalid = false,
  describedBy,
  onChange,
  onFocus,
  onBlur,
}: Props) {
  const stored = readItems(value);
  const rows: ItemRow[] = stored === null || stored.rows.length === 0 ? [emptyRow(spec)] : stored.rows;
  // Посчитано заново, а не взято из значения: так и ставка НДС, и правила
  // расчёта – текущие, пока документ ещё правится.
  const calc = computeItems(rows, spec, vatRate);
  const focusAfterRender = useRef<string | null>(null);

  useEffect(() => {
    if (focusAfterRender.current === null) return;
    document.getElementById(focusAfterRender.current)?.focus();
    focusAfterRender.current = null;
  });

  const firstColumn = spec.columns[0]?.id ?? '';
  const cellId = (row: number, column: string) => (row === 0 && column === firstColumn ? id : `${id}-${row}-${column}`);
  const write = (next: ItemRow[]) => onChange(writeItems(computeItems(next, spec, vatRate)));

  function setCell(rowIndex: number, column: string, text: string) {
    write(rows.map((row, index) => (index === rowIndex ? { ...row, [column]: text } : row)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, rowIndex: number, column: string) {
    if (event.key !== 'Enter') return;
    // Внутри формы Enter отправил бы её: здесь он значит «следующая строка».
    event.preventDefault();
    if (rowIndex === rows.length - 1) {
      focusAfterRender.current = cellId(rowIndex + 1, firstColumn);
      write([...rows, emptyRow(spec)]);
    } else {
      document.getElementById(cellId(rowIndex + 1, column))?.focus();
    }
  }

  const money = (tiyn: string) => `${formatTiyn(BigInt(tiyn))} ${currency}`;

  return (
    <div className={styles.items} aria-describedby={describedBy}>
      {rows.map((row, rowIndex) => {
        const line = calc.lines[rowIndex] ?? null;
        return (
          // Строки не переставляются – номер строки служит ключом.
          <div key={rowIndex} className={styles.itemCard}>
            <div className={styles.itemHead}>
              <span className={styles.itemTitle}>
                {t.form.itemsRow} {rowIndex + 1}
              </span>
              <span className={`${styles.itemAmount} tabular`}>
                {line === null ? null : money(line.amount)}
                {line?.vat == null ? null : (
                  <span className={styles.itemVat}>
                    {' '}
                    {t.form.itemsVatIncluded} {formatTiyn(BigInt(line.vat))}
                  </span>
                )}
              </span>
              <button
                type="button"
                className={styles.rowRemove}
                aria-label={t.form.itemsRemove}
                title={t.form.itemsRemove}
                onClick={() => write(rows.length === 1 ? [emptyRow(spec)] : rows.filter((_, i) => i !== rowIndex))}
              >
                ×
              </button>
            </div>
            <div className={styles.itemGrid}>
              {spec.columns.map((column) => {
                const inputId = cellId(rowIndex, column.id);
                const common = {
                  id: inputId,
                  className: invalid ? `${styles.input} ${styles.inputInvalid}` : styles.input,
                  value: row[column.id] ?? '',
                  placeholder:
                    column.sameAs === undefined ? (column.hint === undefined ? '' : tc(column.hint)) : (row[column.sameAs] ?? ''),
                  onFocus,
                  onBlur,
                };
                return (
                  <label
                    key={column.id}
                    className={column.wide === true || column.kind === 'lines' ? styles.itemCellWide : styles.itemCell}
                  >
                    <span className={styles.itemLabel}>{tc(column.label)}</span>
                    {column.kind === 'lines' ? (
                      <textarea
                        {...common}
                        className={`${common.className} ${styles.textarea}`}
                        rows={3}
                        onChange={(e) => setCell(rowIndex, column.id, e.target.value)}
                      />
                    ) : (
                      <input
                        {...common}
                        className={
                          column.kind === 'text' ? common.className : `${common.className} ${styles.itemNumber} tabular`
                        }
                        type="text"
                        inputMode={column.kind === 'text' ? undefined : 'decimal'}
                        onChange={(e) => setCell(rowIndex, column.id, e.target.value)}
                        onKeyDown={(e) => onKeyDown(e, rowIndex, column.id)}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <button type="button" className={styles.rowAdd} onClick={() => write([...rows, emptyRow(spec)])}>
        + {t.form.itemsAdd}
      </button>

      <div className={`${styles.itemsTotal} tabular`}>
        <span>
          {t.form.itemsTotal}: <strong>{money(calc.total)}</strong>
        </span>
        {spec.vat !== true ? null : calc.vat === null ? (
          <span>{t.form.itemsNoVat}</span>
        ) : (
          <span>
            {t.form.itemsVatIncluded} {calc.vatRate} %: {money(calc.vat)}
          </span>
        )}
      </div>
    </div>
  );
}
