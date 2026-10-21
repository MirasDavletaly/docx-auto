/**
 * Учётные записи и компании, которые жили в этом браузере до сервера.
 *
 * До этапа 1а у каждого браузера была своя база учётных записей (с хешами
 * паролей) и свои реквизиты компаний. Теперь они на сервере, а здесь –
 * копия с сервера. Чтобы прежние данные не пропали при первой же
 * синхронизации, при первом открытии новой версии сайта они откладываются
 * сюда – без хешей паролей: сервер их не принимает, пароли задаются заново.
 *
 * Администратор переносит отложенное на сервер из админ-панели
 * (docs/plans/phase-01a-users-db.md, «Перенос из браузера»), после чего
 * копия стирается.
 */
import type { ImportUser } from '@/api/server';
import type { Company, User } from '@/api/types';

const LEGACY_KEY = 'docflow.legacy-export';

export interface LegacySnapshot {
  capturedAt: string;
  companies: Company[];
  users: User[];
}

/** Откладывает прежние данные. Уже отложенное не перезаписывается. */
export function captureLegacy(companies: Company[], users: User[]): void {
  try {
    if (localStorage.getItem(LEGACY_KEY) !== null) return;
    const snapshot: LegacySnapshot = { capturedAt: new Date().toISOString(), companies, users };
    localStorage.setItem(LEGACY_KEY, JSON.stringify(snapshot));
  } catch {
    // Хранилище недоступно – переносить нечего и некуда.
  }
}

export function readLegacy(): LegacySnapshot | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<LegacySnapshot>;
    if (!Array.isArray(parsed.companies) || !Array.isArray(parsed.users)) return null;
    return {
      capturedAt: parsed.capturedAt ?? '',
      companies: parsed.companies,
      users: parsed.users,
    };
  } catch {
    return null;
  }
}

export function clearLegacy(): void {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Нечего стирать.
  }
}

/** Что уходит на сервер одним запросом и что досылается правками. */
export interface ImportPlan {
  data: { companies: Company[]; users: ImportUser[] };
  /** Загруженные логотипы (data:URL) по компании – правкой компании после переноса. */
  logos: Record<string, string>;
  /** Фотографии по учётной записи – правкой учётной записи после переноса. */
  avatars: Record<string, string>;
  /** Учётные записи без единой компании: на сервере такой работник не нужен. */
  dropped: string[];
}

const isDataUrl = (v: string | undefined): v is string => v !== undefined && v.startsWith('data:');

/**
 * Готовит перенос. Картинки в data:URL вынимаются из запроса: с ними тело
 * легко выходит за 1 МБ (CLAUDE.md, п. 3.11), поэтому они идут отдельно.
 */
export function buildImport(snapshot: LegacySnapshot): ImportPlan {
  const logos: Record<string, string> = {};
  const avatars: Record<string, string> = {};
  const dropped: string[] = [];
  const known = new Set(snapshot.companies.map((c) => c.id));

  const companies = snapshot.companies.map((company) => {
    const { lockVersion: _version, ...rest } = company;
    if (!isDataUrl(rest.logo)) return rest;
    logos[company.id] = rest.logo;
    const { logo: _logo, ...withoutLogo } = rest;
    return withoutLogo;
  });

  const users: ImportUser[] = [];
  for (const u of snapshot.users) {
    const companyIds = u.role === 'platform-admin' ? [] : u.companyIds.filter((id) => known.has(id));
    if (u.role !== 'platform-admin' && companyIds.length === 0) {
      dropped.push(u.login);
      continue;
    }
    if (isDataUrl(u.avatar)) avatars[u.id] = u.avatar;
    users.push({
      id: u.id,
      login: u.login,
      displayName: u.displayName,
      role: u.role,
      companyIds,
      sectionIds: u.sectionIds,
      viewSectionIds: u.viewSectionIds ?? [],
      grantedActions: u.grantedActions ?? [],
      blocked: u.blocked === true,
      createdAt: u.createdAt,
      ...(u.employeeId === undefined ? {} : { employeeId: u.employeeId }),
      ...(u.position === undefined ? {} : { position: u.position }),
      ...(u.phone === undefined ? {} : { phone: u.phone }),
      ...(u.email === undefined ? {} : { email: u.email }),
    });
  }

  return { data: { companies, users }, logos, avatars, dropped };
}
