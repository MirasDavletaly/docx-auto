/**
 * Учётные записи, компании (этап 1а) и персонал (этап 1б) с сервера.
 *
 * Сервер – источник: решает, кому что видно и можно. Здесь – копия в базе
 * браузера, чтобы остальной сайт (документы, формы, лист) читал людей и
 * компании как раньше. Копия заменяется целиком, а не правится по месту:
 * так она не расходится с сервером.
 */
import { ApiError, NetworkError } from '@/api/client';
import { companies as seedCompanies } from '@/api/mock/companies';
import { server } from '@/api/server';
import { t } from '@/i18n';
import { updateDb } from '@/store/db';
import { buildImport, clearLegacy } from '@/store/legacy';
import { withRussianSpelling } from '@/utils/names';

import type { ImportResult, UserInput } from '@/api/server';
import type { Action, Company, User } from '@/api/types';
import type { LegacySnapshot } from '@/store/legacy';

/** Итог действия на сервере: удалось или почему нет – текстом для человека. */
export type Outcome = { ok: true } | { ok: false; message: string; field?: string };

export const OK: Outcome = { ok: true };

/** Ошибка сервера – текстом на языке интерфейса (CLAUDE.md, п. 6, «Сайт»). */
export function describeError(error: unknown): { message: string; field?: string } {
  if (error instanceof NetworkError) return { message: t.errors.network };
  if (!(error instanceof ApiError)) return { message: t.errors.server };
  switch (error.code) {
    case 'conflict':
      return { message: t.errors.conflict };
    case 'rate_limited':
      return { message: t.errors.rateLimited };
    case 'not_found':
      return { message: t.errors.notFound };
    case 'forbidden':
      return { message: t.errors.forbidden };
    case 'validation_failed': {
      // Пояснение по полю – с сервера; первое из них показывается у формы.
      const first = error.fields[0];
      return first === undefined
        ? { message: t.errors.validation }
        : { message: first.message, field: first.field };
    }
    default:
      return { message: error.status >= 500 ? t.errors.server : error.message };
  }
}

export function failed(error: unknown): Outcome {
  return { ok: false, ...describeError(error) };
}

/**
 * Берёт с сервера компании, учётные записи и персонал и кладёт копию в базу
 * браузера. Персонал – текущей компании (администратору – всех).
 */
export async function syncAccounts(): Promise<void> {
  const [companies, users, employees] = await Promise.all([
    server.companies(),
    server.users(),
    server.personnel(),
  ]);
  // Русское ФИО – русскими буквами, казахское – в своём поле: то же правило,
  // что при записи карточки (docs/translation-rules.md).
  updateDb((cur) => ({
    ...cur,
    companies: companies.map(withBundledLogo),
    users,
    employees: employees.map(withRussianSpelling),
  }));
}

/**
 * Логотип компании из сборки сайта. На сервере у компании, перенесённой из
 * браузера, лежит адрес файла той сборки, где её переносили (на компьютере
 * разработчика – `/src/assets/…`), и на другом сайте картинки по нему нет.
 * Загруженный вручную логотип – data:URL – остаётся как есть; адрес файла
 * заменяется логотипом этой компании из текущей сборки.
 */
function withBundledLogo(company: Company): Company {
  // Нет логотипа – его убрали на странице реквизитов: так и остаётся.
  if (company.logo === undefined || company.logo.startsWith('data:')) return company;
  const bundled = seedCompanies.find((c) => c.id === company.id)?.logo;
  return bundled === undefined ? company : { ...company, logo: bundled };
}

/** Выход: учётных записей и персонала другого человека в браузере не остаётся. */
export function clearAccounts(): void {
  updateDb((cur) => ({ ...cur, users: [], companies: [], employees: [] }));
}

/** Что директор и администратор меняют в чужой учётной записи. Должность – в персонале. */
export interface UserAccessPatch {
  /** Новый логин – только с правом users.login (16.10); сервер проверит сам. */
  login?: string;
  displayName?: string;
  role?: User['role'];
  companyIds?: string[];
  sectionIds?: string[];
  viewSectionIds?: string[];
  grantedActions?: Action[];
  blocked?: boolean;
}

/**
 * Учётная запись целиком для правки на сервере: то, что видно сейчас,
 * плюс изменения. Сервер сам оставит доступы и права, которые этот человек
 * выдавать не может.
 */
export function userInputOf(user: User, patch: UserAccessPatch): UserInput {
  const role = patch.role ?? user.role;
  const profile = {
    ...(user.employeeId === undefined ? {} : { employeeId: user.employeeId }),
    ...(user.phone === undefined ? {} : { phone: user.phone }),
    ...(user.email === undefined ? {} : { email: user.email }),
    ...(user.avatar === undefined ? {} : { avatar: user.avatar }),
  };
  return {
    ...profile,
    // Логин уходит всегда: тот же – не смена, и форма того, кто логины не
    // меняет, проходит.
    login: (patch.login ?? user.login).trim(),
    displayName: (patch.displayName ?? user.displayName).trim(),
    role,
    companyIds: role === 'platform-admin' ? [] : (patch.companyIds ?? user.companyIds),
    sectionIds: patch.sectionIds ?? user.sectionIds,
    viewSectionIds: patch.viewSectionIds ?? user.viewSectionIds ?? [],
    grantedActions: patch.grantedActions ?? user.grantedActions ?? [],
    blocked: patch.blocked ?? user.blocked === true,
  };
}

export type ImportOutcome =
  | { ok: true; result: ImportResult; dropped: string[]; imagesFailed: boolean }
  | { ok: false; message: string; notEmpty: boolean };

/**
 * Перенос прежних данных браузера на сервер: одним запросом без картинок,
 * затем логотипы и фотографии – правками по одной (тело ≤ 1 МБ).
 */
export async function importLegacy(snapshot: LegacySnapshot): Promise<ImportOutcome> {
  const plan = buildImport(snapshot);
  let result: ImportResult;
  try {
    result = await server.importData(plan.data);
  } catch (error) {
    const notEmpty = error instanceof ApiError && error.code === 'conflict';
    return { ok: false, notEmpty, message: notEmpty ? t.admin.importNotEmpty : describeError(error).message };
  }

  // Перенос уже состоялся: копия в браузере больше не нужна, даже если
  // картинки ниже не дойдут – их загрузят заново.
  clearLegacy();

  let imagesFailed = false;
  if (Object.keys(plan.logos).length > 0 || Object.keys(plan.avatars).length > 0) {
    try {
      const [companies, users] = await Promise.all([server.companies(), server.users()]);
      for (const company of companies) {
        const logo = plan.logos[company.id];
        if (logo === undefined) continue;
        await server.updateCompany({ ...company, logo }).catch(() => {
          imagesFailed = true;
        });
      }
      for (const user of users) {
        const avatar = plan.avatars[user.id];
        if (avatar === undefined || result.skipped.includes(user.login)) continue;
        await server
          .updateUser(user.id, { ...userInputOf(user, {}), avatar, lockVersion: user.lockVersion ?? 0 })
          .catch(() => {
            imagesFailed = true;
          });
      }
    } catch {
      imagesFailed = true;
    }
  }

  await syncAccounts().catch(() => undefined);
  return { ok: true, result, dropped: plan.dropped, imagesFailed };
}
