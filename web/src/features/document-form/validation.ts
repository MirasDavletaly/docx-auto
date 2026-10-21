import { t } from '@/i18n';
import { tc } from '@/i18n/content';
import { formatDocumentDate } from '@/utils/format';
import { itemsProblem } from '@/utils/items';

import type { FieldDef } from '@/api/types';

export interface FieldProblem {
  fieldId: string;
  message: string;
}

/** Сегодняшний день в том же виде, в каком его отдаёт `<input type="date">`. */
export function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Границы для органа ввода: браузер не даст выбрать дату вне них. */
export function dateBounds(
  def: FieldDef,
  values: Record<string, string>,
): { min?: string; max?: string } {
  const limits = def.dateLimits;
  if (limits === undefined) return {};

  const mins: string[] = [];
  if (limits.notBefore === 'today') mins.push(today());
  if (limits.afterField !== undefined) {
    const other = values[limits.afterField] ?? '';
    if (other !== '') mins.push(other);
  }

  const min = mins.sort().at(-1);
  const max = limits.notAfter === 'today' ? today() : undefined;

  return {
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  };
}

/**
 * Проверяет одно поле. Пустое необязательное поле ошибкой не является.
 *
 * Возвращается первая найденная причина: показывать под полем список
 * претензий незачем, человек всё равно чинит их по одной.
 */
export function checkField(
  def: FieldDef,
  values: Record<string, string>,
  fields: FieldDef[],
): string | null {
  const value = (values[def.id] ?? '').trim();

  // Таблица позиций: пустая – как пустое поле; иначе называется строка и
  // колонка, где не хватает значения или стоит не число.
  if (def.kind === 'items' && def.items !== undefined) {
    const problem = itemsProblem(value, def.items);
    if (problem === null) return null;
    if (problem.kind === 'empty') return def.required ? t.form.required : null;
    const where = `${t.form.itemsRow} ${problem.row}: `;
    return problem.kind === 'missing'
      ? `${where}${t.form.itemsFill} «${tc(problem.column)}»`
      : `${where}${t.form.itemsIn} «${tc(problem.column)}» ${t.form.itemsNumber}`;
  }

  if (value === '') {
    return def.required ? t.form.required : null;
  }

  const limits = def.dateLimits;
  if (def.kind !== 'date' || limits === undefined) return null;

  if (limits.notBefore === 'today' && value < today()) {
    return t.form.dateNotBefore;
  }

  if (limits.notAfter === 'today' && value > today()) {
    return t.form.dateNotAfter;
  }

  if (limits.afterField !== undefined) {
    const other = (values[limits.afterField] ?? '').trim();
    if (other !== '' && value < other) {
      const label = fields.find((f) => f.id === limits.afterField)?.label ?? limits.afterField;
      return `${t.form.dateAfter} «${tc(label)}» (${formatDocumentDate(other)})`;
    }
  }

  return null;
}

/** Все замечания по форме, в порядке полей: первое из них получает фокус. */
export function validateFields(
  fields: FieldDef[],
  values: Record<string, string>,
): FieldProblem[] {
  const problems: FieldProblem[] = [];

  for (const def of fields) {
    const message = checkField(def, values, fields);
    if (message !== null) problems.push({ fieldId: def.id, message });
  }

  return problems;
}
