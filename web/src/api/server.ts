/**
 * Обращения к серверу: вход, учётные записи, компании, перенос (этап 1а),
 * персонал (этап 1б). Формы ответов – как в `api/openapi.yaml`.
 */
import { api } from './client';

import type { SessionPayload } from './client';
import type {
  Action,
  ArchiveFile,
  Company,
  CustomTemplate,
  DocumentRecord,
  EmployeeBrief,
  RoleId,
  User,
} from './types';

/** Кто вошёл – как его видит сервер. */
export interface Me {
  user: User;
  permissions: Action[];
  /** Выбранная компания; пусто – не выбрана. */
  companyId: string;
  platform: boolean;
}

export type Session = SessionPayload<Me>;

/** Профиль: то, что человек правит о себе сам. Должность – в персонале. */
export interface ProfileFields {
  employeeId?: string;
  phone?: string;
  email?: string;
  avatar?: string;
}

export interface UserInput extends ProfileFields {
  /** Новый логин; тот же – не смена. Меняет только тот, у кого право users.login. */
  login?: string;
  displayName: string;
  role: RoleId;
  companyIds: string[];
  sectionIds: string[];
  viewSectionIds: string[];
  grantedActions: Action[];
  blocked: boolean;
}

export interface ImportUser extends ProfileFields {
  id: string;
  /** Должность из браузера – уходит в персонал каждой компании человека. */
  position?: string;
  login: string;
  displayName: string;
  role: RoleId;
  companyIds: string[];
  sectionIds: string[];
  viewSectionIds: string[];
  grantedActions: Action[];
  blocked: boolean;
  createdAt: string;
}

/** Карточка персонала, как её правят: имя, его формы, должность, подразделение. */
export type PersonCard = Omit<EmployeeBrief, 'id' | 'companyId' | 'lockVersion'>;

/** Новый человек в персонале текущей компании; пароль необязателен. */
export interface NewPerson extends PersonCard {
  login: string;
  password?: string;
}

export interface ImportResult {
  companies: number;
  users: number;
  skipped: string[];
}

/** Документ, как его записывают: без полей, которые ставит сервер. */
export interface DocumentInput {
  templateId: string;
  sectionId: string;
  title: string;
  titleEn?: string;
  description: string;
  subject: string;
  status: DocumentRecord['status'];
  number: string;
  values: Record<string, string>;
  companySnapshot?: Company;
  peopleSnapshot?: DocumentRecord['peopleSnapshot'];
  templateSnapshot?: DocumentRecord['templateSnapshot'];
  /** 0 – новый документ. */
  lockVersion: number;
}

export interface DocumentPage {
  items: DocumentRecord[];
  /** Картинки снимков этой страницы: ссылка – data:URL. */
  images: Record<string, string>;
  next?: string;
}

export interface ArchivePage {
  items: ArchiveFile[];
  next?: string;
}

export interface ArchiveUploadInput {
  title: string;
  number: string;
  documentDate: string;
  sectionId: string;
  description: string;
  fileName: string;
  size: number;
  sha256: string;
}

export interface ArchiveUpload {
  id: string;
  parts: number;
  partSize: number;
}

const enc = encodeURIComponent;
const page = (cursor: string) => (cursor === '' ? '' : `?cursor=${enc(cursor)}`);

export const server = {
  login: (login: string, password: string) =>
    api<Session>('POST', '/auth/login', { login, password }, { noRefresh: true }),
  logout: () => api<undefined>('POST', '/auth/logout', undefined, { noRefresh: true }),
  selectCompany: (companyId: string) => api<Session>('POST', '/auth/company', { companyId }),
  confirmPassword: (password: string) => api<undefined>('POST', '/auth/confirm', { password }),

  me: () => api<Me>('GET', '/me'),
  /** `login` – свой новый логин, только с правом users.login. */
  updateProfile: (input: ProfileFields & { displayName: string; lockVersion: number; login?: string }) =>
    api<Me>('PATCH', '/me', input),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<Session>('POST', '/me/password', { currentPassword, newPassword }),

  users: () => api<{ items: User[] }>('GET', '/users').then((r) => r.items),
  createUser: (input: UserInput & { login: string; password: string; position?: string }) =>
    api<User>('POST', '/users', input, { idempotent: true }),
  updateUser: (id: string, input: UserInput & { lockVersion: number }) =>
    api<User>('PATCH', `/users/${encodeURIComponent(id)}`, input),
  deleteUser: (id: string, lockVersion: number) =>
    api<undefined>('DELETE', `/users/${encodeURIComponent(id)}?lockVersion=${lockVersion}`),
  setUserPassword: (id: string, password: string) =>
    api<undefined>('POST', `/users/${encodeURIComponent(id)}/password`, { password }),

  /** Персонал текущей компании (администратору платформы – всех). */
  personnel: () => api<{ items: EmployeeBrief[] }>('GET', '/personnel').then((r) => r.items),
  createPerson: (input: NewPerson) => api<EmployeeBrief>('POST', '/personnel', input, { idempotent: true }),
  updatePerson: (id: string, input: PersonCard & { lockVersion: number }) =>
    api<EmployeeBrief>('PATCH', `/personnel/${encodeURIComponent(id)}`, input),
  removePerson: (id: string, lockVersion: number) =>
    api<undefined>('DELETE', `/personnel/${encodeURIComponent(id)}?lockVersion=${lockVersion}`),

  companies: () => api<{ items: Company[] }>('GET', '/companies').then((r) => r.items),
  createCompany: (company: Company) =>
    api<Company>('POST', '/companies', company, { idempotent: true }),
  updateCompany: (company: Company) =>
    api<Company>('PATCH', `/companies/${encodeURIComponent(company.id)}`, company),
  deleteCompany: (id: string, lockVersion: number) =>
    api<undefined>('DELETE', `/companies/${encodeURIComponent(id)}?lockVersion=${lockVersion}`),

  importData: (data: { companies: Company[]; users: ImportUser[] }) =>
    api<ImportResult>('POST', '/admin/import', data, { idempotent: true }),

  // ── Документы, шаблоны компании, архив (docs/plans/phase-01c-documents.md) ──

  /** Страница видимых документов всех доступных компаний. */
  documents: (cursor = '') => api<DocumentPage>('GET', `/documents${page(cursor)}`),
  /** Создать (lockVersion 0) или исправить. Повтор того же запроса не удваивает. */
  saveDocument: (id: string, input: DocumentInput) =>
    api<DocumentRecord>('PUT', `/documents/${enc(id)}`, input),
  deleteDocument: (id: string, lockVersion: number) =>
    api<undefined>('DELETE', `/documents/${enc(id)}?lockVersion=${lockVersion}`),
  restoreDocument: (id: string, lockVersion: number) =>
    api<undefined>('POST', `/documents/${enc(id)}/restore?lockVersion=${lockVersion}`),
  purgeDocument: (id: string, lockVersion: number) =>
    api<undefined>('POST', `/documents/${enc(id)}/purge?lockVersion=${lockVersion}`),
  grant: (id: string, userId: string, level: 'view' | 'edit') =>
    api<DocumentRecord>('PUT', `/documents/${enc(id)}/grants/${enc(userId)}`, { level }),
  revoke: (id: string, userId: string) =>
    api<DocumentRecord>('DELETE', `/documents/${enc(id)}/grants/${enc(userId)}`),
  /** Картинка снимка (логотип) в текущую компанию; ответ – ссылка на неё. */
  putImage: (data: string) => api<{ ref: string }>('PUT', '/images', { data }).then((r) => r.ref),

  templates: () => api<{ items: CustomTemplate[] }>('GET', '/templates').then((r) => r.items),
  saveTemplate: (id: string, template: Omit<CustomTemplate, 'id' | 'companyId'>, lockVersion: number) =>
    api<CustomTemplate>('PUT', `/templates/${enc(id)}`, { template, lockVersion }),
  deleteTemplate: (id: string, lockVersion: number) =>
    api<undefined>('DELETE', `/templates/${enc(id)}?lockVersion=${lockVersion}`),

  archive: (cursor = '') => api<ArchivePage>('GET', `/archive${page(cursor)}`),
  startUpload: (input: ArchiveUploadInput) =>
    api<ArchiveUpload>('POST', '/archive', input, { idempotent: true }),
  putPart: (id: string, part: number, data: Uint8Array) =>
    api<undefined>('PUT', `/archive/${enc(id)}/parts/${part}`, data),
  completeUpload: (id: string) => api<ArchiveFile>('POST', `/archive/${enc(id)}/complete`),
  part: (id: string, part: number) =>
    api<ArrayBuffer>('GET', `/archive/${enc(id)}/parts/${part}`, undefined, { binary: true }),
  deleteArchiveFile: (id: string) => api<undefined>('DELETE', `/archive/${enc(id)}`),
  restoreArchiveFile: (id: string) => api<undefined>('POST', `/archive/${enc(id)}/restore`),
  purgeArchiveFile: (id: string) => api<undefined>('POST', `/archive/${enc(id)}/purge`),
};
