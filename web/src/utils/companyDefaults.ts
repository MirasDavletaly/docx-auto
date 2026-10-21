/**
 * Поля, которые форма заполняет из реквизитов компании
 * (`defaultFrom: '@company.…'`): должность и ФИО директора в подписи.
 *
 * Пока человек поле не правил, значения в документе у него нет, и оно
 * берётся из текущей карточки: директора сменили – черновик показывает
 * нового (19.10, docs/plans/phase-01e-company-fresh.md). Значение есть, даже
 * пустое, – поле правили руками, оно остаётся. Выпущенный документ хранит
 * полные значения (CLAUDE.md, п. 3.4): их пишет «Сохранить».
 */
import type { Company, FieldDef } from '@/api/types';

/** Значение поля из карточки компании; у поля без `defaultFrom` – нет. */
function companyDefault(field: FieldDef, company: Company): string | undefined {
  if (field.defaultFrom?.startsWith('@company.') !== true) return undefined;
  const value = company[field.defaultFrom.slice('@company.'.length) as keyof Company];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * Значения документа с полями из реквизитов, которых человек не правил.
 * Подставлять нечего – тот же объект: лист не перерисовывается зря.
 */
export function withCompanyDefaults(
  fields: FieldDef[],
  values: Record<string, string>,
  company: Company | null,
): Record<string, string> {
  if (company === null) return values;
  let out = values;
  for (const field of fields) {
    if (values[field.id] !== undefined) continue;
    const value = companyDefault(field, company);
    if (value === undefined) continue;
    if (out === values) out = { ...values };
    out[field.id] = value;
  }
  return out;
}

/**
 * Черновик, записанный до 19.10: поле из реквизитов в нём уже вписано.
 * Совпадает с текущей карточкой – поле считается нетронутым и снова следует
 * карточке. Отличается – это ручная правка или прежний директор, их не
 * различить, и значение остаётся.
 */
export function releaseCompanyDefaults(
  fields: FieldDef[],
  values: Record<string, string>,
  company: Company | null,
): Record<string, string> {
  if (company === null) return values;
  let out = values;
  for (const field of fields) {
    const value = companyDefault(field, company);
    if (value === undefined || values[field.id] !== value) continue;
    if (out === values) out = { ...values };
    delete out[field.id];
  }
  return out;
}
