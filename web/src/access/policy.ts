/**
 * Политика доступа. Единственное место, где написано, кому что можно.
 *
 * В экранах нет проверок вида `if (user.role === 'director')` — только вызов
 * отсюда (CLAUDE.md, п. 3.2). Когда появится серверный `internal/access`,
 * этот файл должен повторять его, а не жить своей жизнью, поэтому правила
 * записаны так же: право, роль, компания.
 *
 * ВАЖНО. Это удобство интерфейса, а не защита. Всё, что решает браузер,
 * обходится через инструменты разработчика. Настоящую проверку делает
 * сервер (CLAUDE.md, п. 3.3: «сайт ничего не решает»).
 */
import { roleCan, roles } from '@/api/mock/roles';
import { sections } from '@/api/mock/sections';

import type {
  Action,
  ArchiveFile,
  AuditEntry,
  CustomTemplate,
  DocumentGrant,
  DocumentRecord,
  RoleId,
  User,
} from '@/api/types';

/** Кто спрашивает: человек и компания, в которой он сейчас работает. */
export interface Subject {
  user: User | null;
  companyId: string | null;
}

/**
 * Права, которые выдаются человеку поверх роли («Тест день 3»: доступ к
 * созданию шаблонов выдают директор и администратор). Всё, чего нет в этом
 * списке, выдачей не получить: запись в учётной записи не превратит
 * работника в администратора.
 */
export const GRANTABLE_ACTIONS: readonly Action[] = ['templates.create'];

/** Может ли человек выполнить действие. Без входа — ничего. */
export function can(subject: Subject, action: Action): boolean {
  if (subject.user === null || subject.user.blocked === true) return false;
  if (roleCan(subject.user.role, action)) return true;
  return GRANTABLE_ACTIONS.includes(action) && (subject.user.grantedActions ?? []).includes(action);
}

/**
 * Какие права поверх роли человек может выдавать сотрудникам. Выдаёт тот,
 * кто управляет людьми, и только то, что может сам.
 */
export function grantableActions(subject: Subject): Action[] {
  const scope = managedCompanyIds(subject);
  if (scope !== null && scope.length === 0) return [];
  return GRANTABLE_ACTIONS.filter((action) => can(subject, action));
}

/** Работает ли человек во всех компаниях группы или только в своих. */
export function isPlatformWide(user: User | null): boolean {
  return user !== null && user.role === 'platform-admin';
}

/**
 * Доступна ли человеку компания.
 *
 * Администратор платформы работает во всех. Остальные — только там, где им
 * выдали доступ: список компаний берётся из учётной записи, а не из адреса
 * страницы (CLAUDE.md, п. 3.1).
 */
export function canUseCompany(user: User | null, companyId: string): boolean {
  if (user === null || user.blocked === true) return false;
  if (isPlatformWide(user)) return true;
  return user.companyIds.includes(companyId);
}

/**
 * Разрешён ли человеку раздел каталога — «юрисдикция».
 *
 * У директора и администратора список разделов пуст, и это значит «все».
 * У работника пустой список значит «ни одного»: по умолчанию запрещено,
 * разделы выдаёт администратор.
 */
export function canUseSection(user: User | null, sectionId: string): boolean {
  if (user === null || user.blocked === true) return false;
  if (user.role !== 'employee') return true;
  return user.sectionIds.includes(sectionId);
}

/**
 * Раздел, к которому относится документ.
 *
 * У записей прежней версии раздела нет. Он восстанавливается из шаблона:
 * идентификатор шаблона начинается с идентификатора раздела («hr-hire-order»),
 * и это соглашение проверяет тест каталога.
 */
export function sectionOfDocument(doc: DocumentRecord): string | undefined {
  if (doc.sectionId !== undefined) return doc.sectionId;
  // Самый длинный подходящий: «procurement-sales-…» не должен уйти в «procurement».
  return sections
    .filter((section) => doc.templateId.startsWith(`${section.id}-`))
    .sort((a, b) => b.id.length - a.id.length)[0]?.id;
}

/** Доступ, выданный человеку на этот документ, если он есть. */
export function grantOf(doc: DocumentRecord, userId: string): DocumentGrant | undefined {
  return doc.grants?.find((grant) => grant.userId === userId);
}

/**
 * Видит ли человек документ.
 *
 * Прежде всего документ должен быть в компании, к которой у человека есть
 * доступ: ни раздел, ни выданный доступ не открывают чужую компанию.
 *
 * Дальше: администратор видит все, директор – все документы своих компаний.
 * Работник видит свои; сохранённые документы разделов, просмотр которых ему
 * открыт; и документы, доступ к которым ему выдали. Чужие черновики не видит
 * никто, кроме автора, директора и администратора: черновик ещё не выпущен.
 *
 * Удалённый документ видит только тот, кто может его вернуть, и только в
 * корзине админ-панели: из реестров он пропадает у всех (`visibleDocuments`).
 */
export function canViewDocument(subject: Subject, doc: DocumentRecord): boolean {
  const { user } = subject;
  if (user === null || user.blocked === true) return false;
  if (!canUseCompany(user, doc.companyId)) return false;

  if (doc.deletedAt !== undefined && !can(subject, 'documents.restore')) return false;

  if (can(subject, 'documents.viewAll')) return true;
  if (doc.authorId === user.id) return true;
  if (grantOf(doc, user.id) !== undefined) return true;

  const section = sectionOfDocument(doc);
  return (
    doc.status === 'saved' &&
    section !== undefined &&
    (user.viewSectionIds ?? []).includes(section)
  );
}

/**
 * Может ли человек править документ.
 *
 * Черновик правит тот, кто его завёл. Сохранённый документ правят директор,
 * администратор и тот, кому они выдали доступ на правку («Тест день 2»).
 * На сервере такая правка будет создавать новую версию и запись в аудите.
 */
export function canEditDocument(subject: Subject, doc: DocumentRecord): boolean {
  if (!canViewDocument(subject, doc)) return false;
  if (doc.deletedAt !== undefined) return false;

  if (can(subject, 'documents.editAny')) return true;
  if (subject.user !== null && grantOf(doc, subject.user.id)?.level === 'edit') return true;
  return doc.authorId === subject.user?.id && doc.status === 'draft';
}

/** Может ли человек удалить документ. Удаление — пометка, а не стирание. */
export function canDeleteDocument(subject: Subject, doc: DocumentRecord): boolean {
  if (!canViewDocument(subject, doc)) return false;
  if (doc.deletedAt !== undefined) return false;
  return can(subject, 'documents.delete');
}

/** Может ли человек вернуть удалённый документ в реестр. */
export function canRestoreDocument(subject: Subject, doc: DocumentRecord): boolean {
  if (doc.deletedAt === undefined) return false;
  return canViewDocument(subject, doc) && can(subject, 'documents.restore');
}

/**
 * Может ли человек стереть документ навсегда («Тест день 3»).
 *
 * Отступление от CLAUDE.md, п. 3.4 («физического удаления нет») по решению
 * человека, docs/questions.md. Ограничено так, чтобы случайно стереть было
 * нельзя: только из корзины, то есть после обычного удаления, и только тем,
 * кто может документ вернуть, – директором своей компании и администратором.
 * Запись в журнале остаётся.
 */
export function canPurgeDocument(subject: Subject, doc: DocumentRecord): boolean {
  if (doc.deletedAt === undefined) return false;
  return canViewDocument(subject, doc) && can(subject, 'documents.purge');
}

/** Может ли человек выдавать другим доступ к этому документу. */
export function canGrantDocument(subject: Subject, doc: DocumentRecord): boolean {
  if (doc.deletedAt !== undefined) return false;
  return canViewDocument(subject, doc) && can(subject, 'documents.grant');
}

/**
 * Кому можно выдать доступ к документу.
 *
 * Только людям той же компании: выдать доступ к документу компании А
 * человеку из компании Б значит устроить утечку своими руками
 * (CLAUDE.md, п. 3.1). Тем, кто и так видит все документы компании, выдавать
 * нечего, а себе самому – незачем.
 */
export function canReceiveGrant(subject: Subject, doc: DocumentRecord, target: User): boolean {
  if (target.blocked === true || target.id === subject.user?.id) return false;
  if (!canUseCompany(target, doc.companyId)) return false;
  return !roleCan(target.role, 'documents.viewAll');
}

/**
 * Отбирает документы, которые человеку видны.
 *
 * Фильтр стоит здесь, а не в экранах: на сервере он же уйдёт в SQL-запрос,
 * а не в цикл после выборки (CLAUDE.md, п. 3.2). Пока данные лежат в
 * браузере, важно хотя бы то, что правило одно и записано один раз.
 *
 * Удалённые документы в выборку не попадают. Их просит только корзина
 * админ-панели – флагом `withDeleted`.
 */
export function visibleDocuments(
  subject: Subject,
  documents: DocumentRecord[],
  { withDeleted = false }: { withDeleted?: boolean } = {},
): DocumentRecord[] {
  return documents.filter(
    (doc) => (withDeleted || doc.deletedAt === undefined) && canViewDocument(subject, doc),
  );
}

/* ── Люди и учётные записи ─────────────────────────────────────────────── */

/**
 * Компании, в которых человек управляет сотрудниками.
 *
 * `null` значит «во всех» – у администратора платформы. Директор управляет
 * только своими компаниями («Тест день 2»). Пустой список – ни в одной.
 */
export function managedCompanyIds(subject: Subject): string[] | null {
  if (!can(subject, 'people.manage') || subject.user === null) return [];
  return isPlatformWide(subject.user) ? null : subject.user.companyIds;
}

/**
 * Может ли человек править учётную запись: доступ, блокировку, пароль.
 *
 * Администратор – любую. Директор – сотрудников своих компаний, но не
 * администраторов и не других директоров: иначе директор одной компании мог
 * бы заблокировать директора, который работает ещё и в другой. Себя не
 * блокирует и не удаляет никто: своё правится в профиле.
 */
export function canManageUser(subject: Subject, target: User): boolean {
  if (target.id === subject.user?.id) return false;

  const scope = managedCompanyIds(subject);
  if (scope === null) return true;
  if (scope.length === 0 || target.role !== 'employee') return false;
  return target.companyIds.some((id) => scope.includes(id));
}

/** Какие роли человек может выдавать. Директор заводит только сотрудников. */
export function assignableRoles(subject: Subject): RoleId[] {
  const scope = managedCompanyIds(subject);
  if (scope === null) return roles.map((role) => role.id);
  return scope.length === 0 ? [] : ['employee'];
}

/**
 * Видна ли учётная запись в списке админ-панели.
 *
 * Директору видны люди его компаний, включая других директоров, – чтобы
 * знать, кто ещё работает в компании, – но править он может не всех
 * (`canManageUser`). Администраторов платформы директор не видит.
 */
export function canSeeUser(subject: Subject, target: User): boolean {
  const scope = managedCompanyIds(subject);
  if (scope === null) return true;
  if (target.role === 'platform-admin') return false;
  return target.companyIds.some((id) => scope.includes(id));
}

/**
 * Видна ли запись журнала.
 *
 * Администратор видит весь журнал. Директор – записи своих компаний.
 * Записи без компании (вход, действия администратора) директору не видны.
 */
export function canSeeAuditEntry(subject: Subject, entry: AuditEntry): boolean {
  if (!can(subject, 'audit.view') || subject.user === null) return false;
  if (isPlatformWide(subject.user)) return true;
  return entry.companyId !== '' && subject.user.companyIds.includes(entry.companyId);
}

/* ── Шаблоны из конструктора ───────────────────────────────────────────── */

/**
 * Может ли человек создать шаблон в разделе («Тест день 3»).
 *
 * Директор и администратор – по роли, работник – если доступ ему выдали, и
 * только в разделах, где он сам создаёт документы. Шаблон создаётся в той
 * компании, где человек работает сейчас: компания берётся из сессии, а не
 * из формы (CLAUDE.md, п. 3.1).
 */
export function canCreateTemplate(subject: Subject, sectionId: string): boolean {
  if (subject.companyId === null || !canUseCompany(subject.user, subject.companyId)) return false;
  return can(subject, 'templates.create') && canUseSection(subject.user, sectionId);
}

/**
 * Видит ли человек шаблон в каталоге.
 *
 * Шаблон принадлежит компании, как документ, и виден только в ней – даже
 * администратору, пока он работает в другой компании: в каталоге одной
 * компании не должно быть бланков другой.
 */
export function canSeeTemplate(subject: Subject, tpl: CustomTemplate): boolean {
  if (tpl.deletedAt !== undefined) return false;
  if (subject.companyId === null || tpl.companyId !== subject.companyId) return false;
  return canUseCompany(subject.user, tpl.companyId) && canUseSection(subject.user, tpl.sectionId);
}

/** Правит и убирает шаблон его автор, директор и администратор своей компании. */
export function canEditTemplate(subject: Subject, tpl: CustomTemplate): boolean {
  if (!canSeeTemplate(subject, tpl) || !can(subject, 'templates.create')) return false;
  return tpl.authorId === subject.user?.id || can(subject, 'documents.editAny');
}

export function visibleTemplates(subject: Subject, list: CustomTemplate[]): CustomTemplate[] {
  return list.filter((tpl) => canSeeTemplate(subject, tpl));
}

/* ── Архив загруженных файлов ──────────────────────────────────────────── */

/**
 * Видит ли человек загруженный в архив файл.
 *
 * Правило то же, что у документа: только своя компания; директор и
 * администратор – все файлы компании; работник – загруженные им самим и
 * файлы разделов, просмотр которых ему открыт. Удалённый файл – только тот,
 * кто может возвращать удалённое.
 */
export function canViewArchiveFile(subject: Subject, file: ArchiveFile): boolean {
  const { user } = subject;
  if (user === null || user.blocked === true) return false;
  if (!canUseCompany(user, file.companyId)) return false;
  if (file.deletedAt !== undefined && !can(subject, 'documents.restore')) return false;

  if (can(subject, 'documents.viewAll')) return true;
  if (file.uploadedBy === user.id) return true;
  return (user.viewSectionIds ?? []).includes(file.sectionId);
}

/**
 * Может ли человек загрузить файл в раздел архива своей компании.
 *
 * Загружает тот, кто работает в этом разделе: кадровик кладёт старые
 * кадровые приказы, но не договоры юристов.
 */
export function canUploadArchive(subject: Subject, companyId: string, sectionId: string): boolean {
  return canUseCompany(subject.user, companyId) && canUseSection(subject.user, sectionId);
}

/** Удалить файл из архива – пометкой, как и документ. */
export function canDeleteArchiveFile(subject: Subject, file: ArchiveFile): boolean {
  if (file.deletedAt !== undefined) return false;
  return canViewArchiveFile(subject, file) && can(subject, 'documents.delete');
}

/** Вернуть удалённый файл в архив – тот же, кто возвращает документы. */
export function canRestoreArchiveFile(subject: Subject, file: ArchiveFile): boolean {
  if (file.deletedAt === undefined) return false;
  return canViewArchiveFile(subject, file) && can(subject, 'documents.restore');
}

/** Стереть файл навсегда – только из корзины, как документ (`canPurgeDocument`). */
export function canPurgeArchiveFile(subject: Subject, file: ArchiveFile): boolean {
  if (file.deletedAt === undefined) return false;
  return canViewArchiveFile(subject, file) && can(subject, 'documents.purge');
}

/**
 * Отбор файлов архива – одно правило для списка и для поштучной проверки.
 * Удалённые – только по флагу `withDeleted`: их просит корзина админ-панели.
 */
export function visibleArchive(
  subject: Subject,
  files: ArchiveFile[],
  { withDeleted = false }: { withDeleted?: boolean } = {},
): ArchiveFile[] {
  return files.filter(
    (file) => (withDeleted || file.deletedAt === undefined) && canViewArchiveFile(subject, file),
  );
}
