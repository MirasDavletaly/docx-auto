/**
 * По чему ищется строка в каждой вкладке админ-панели.
 *
 * «Тест день 3»: «на английском невозможно поискать». Человек видит строку
 * на языке интерфейса, а помнить её может на другом: должность «Бухгалтер»
 * на английском экране написана «Accountant», событие журнала – «Document
 * created». Поэтому в поиск идёт и русское значение, и перевод, какой бы
 * язык ни стоял сейчас. Имена латиницей находятся и без этого: поиск сам
 * сравнивает латиницу с кириллицей (`utils/search.ts`).
 */
import { roles } from '@/api/mock/roles';
import { contentEn } from '@/i18n/content-en';
import { en } from '@/i18n/en';
import { ru } from '@/i18n/ru';
import { formatDateTime } from '@/utils/format';
import { translateJobTitle } from '@/utils/jobTitles';
import { englishName } from '@/utils/names';

import type { AuditEntry, Company, EmployeeBrief, RoleId, User } from '@/api/types';

/** Строка содержимого и её английский перевод, если он есть. */
function bothLangs(text: string | undefined): string[] {
  if (text === undefined || text === '') return [];
  const translated = contentEn[text];
  return translated === undefined ? [text] : [text, translated];
}

/** Должность или подразделение: как записано, на казахском и английском. */
function title(ru_: string, kk: string | undefined, en_: string | undefined): string[] {
  return [
    ru_,
    kk ?? translateJobTitle(ru_, 'kk') ?? '',
    en_ ?? translateJobTitle(ru_, 'en') ?? '',
  ];
}

export function employeeSearchFields(person: EmployeeBrief): string[] {
  return [
    person.fullName,
    person.fullNameGenitive,
    person.fullNameKk ?? '',
    person.fullNameEn ?? englishName(person.fullName),
    ...title(person.position, person.positionKk, person.positionEn),
    ...title(person.unit, person.unitKk, person.unitEn),
  ];
}

export function companySearchFields(company: Company): string[] {
  return [
    company.name,
    company.nameEn ?? '',
    company.legalName,
    company.legalNameKk ?? '',
    company.legalNameEn ?? '',
    company.bin,
    company.directorName,
    company.directorNameEn ?? '',
    company.city,
    company.cityKk ?? '',
    company.cityEn ?? '',
  ];
}

function roleTitles(id: RoleId): string[] {
  return bothLangs(roles.find((role) => role.id === id)?.title);
}

export function userSearchFields(user: User, companies: Company[]): string[] {
  const own = companies.filter((c) => user.companyIds.includes(c.id));
  return [
    user.login,
    user.displayName,
    user.position ?? '',
    ...title(user.position ?? '', undefined, undefined),
    ...roleTitles(user.role),
    ...own.flatMap((c) => [c.name, c.nameEn ?? '']),
  ];
}

export function auditSearchFields(entry: AuditEntry, companies: Company[]): string[] {
  const company = companies.find((c) => c.id === entry.companyId);
  return [
    formatDateTime(entry.at),
    entry.userName,
    company?.name ?? '',
    company?.nameEn ?? '',
    ru.admin.events[entry.event] ?? entry.event,
    en.admin.events[entry.event] ?? entry.event,
    ...bothLangs(entry.target),
  ];
}

/** Название компании на обоих языках: для строки документа в админ-панели. */
export function companyNames(company: Company | undefined): string[] {
  return company === undefined ? [] : [company.name, company.nameEn ?? ''];
}
