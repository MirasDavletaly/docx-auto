/**
 * Несколько человек из персонала – члены комиссии.
 *
 * Каждый человек – своя строка с тем же полем, что у «Работника»: начинают
 * вводить ФИО, персонал подсказывает («Тест день 4», дополнение: «чтобы как
 * в остальных выбиралась, а не вот так тупо. Несколько людей пусть
 * выбирается»). Кого нет в персонале, вписывают в ту же строку: «Иванов
 * И. И. – внешний эксперт» идёт в документ как написано.
 *
 * Значение – по строке на человека: идентификатор карточки или вписанный
 * текст, в том порядке, в каком их добавили. Лист документа читает его как
 * раньше (`DocumentSheet`, `employees`).
 */
import { useId } from 'react';

import { lang, t } from '@/i18n';
import { translateJobTitle } from '@/utils/jobTitles';

import styles from './Field.module.css';

import type { EmployeeBrief } from '@/api/types';

interface Props {
  id: string;
  value: string;
  employees: EmployeeBrief[];
  invalid?: boolean;
  describedBy?: string | undefined;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}

export function PeoplePicker({ id, value, employees, invalid = false, describedBy, onChange, onFocus, onBlur }: Props) {
  const listPrefix = useId();
  // Пустое значение – одна пустая строка: поле для выбора есть всегда.
  const rows = value.split('\n');

  const write = (next: string[]) => onChange(next.join('\n'));
  const nameOf = (row: string) => employees.find((e) => e.id === row)?.fullName ?? row;
  const positionOf = (person: EmployeeBrief) =>
    lang === 'en' ? (person.positionEn ?? translateJobTitle(person.position, 'en') ?? person.position) : person.position;

  return (
    <div className={styles.peopleRows}>
      {employees.length === 0 ? <p className={styles.hint}>{t.form.noEmployees}</p> : null}
      {rows.map((row, index) => {
        const listId = `${listPrefix}-${index}`;
        // Уже выбранных в других строках не предлагаем второй раз.
        const taken = new Set(rows.filter((_, i) => i !== index));
        return (
          // Строки не переставляются, только добавляются в конец и убираются:
          // номер строки – устойчивый ключ.
          <div key={index} className={styles.personRow}>
            <input
              id={index === 0 ? id : `${id}-${index}`}
              className={invalid ? `${styles.input} ${styles.inputInvalid}` : styles.input}
              type="text"
              list={listId}
              aria-label={`${t.form.member} ${index + 1}`}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              value={nameOf(row)}
              placeholder={employees.length === 0 ? t.form.memberManualHint : t.form.selectEmployee}
              onFocus={onFocus}
              onBlur={onBlur}
              onChange={(e) => {
                const typed = e.target.value;
                const match = employees.find((emp) => emp.fullName === typed);
                const next = [...rows];
                next[index] = match === undefined ? typed : match.id;
                write(next);
              }}
            />
            <datalist id={listId}>
              {employees
                .filter((employee) => !taken.has(employee.id))
                .map((employee) => (
                  <option key={employee.id} value={employee.fullName}>
                    {positionOf(employee)}
                  </option>
                ))}
            </datalist>
            <button
              type="button"
              className={styles.rowRemove}
              aria-label={t.form.removePerson}
              title={t.form.removePerson}
              onClick={() => write(rows.length === 1 ? [''] : rows.filter((_, i) => i !== index))}
            >
              ×
            </button>
          </div>
        );
      })}
      <button type="button" className={styles.rowAdd} onClick={() => write([...rows, ''])}>
        + {t.form.addPerson}
      </button>
    </div>
  );
}
