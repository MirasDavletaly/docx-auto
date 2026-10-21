/**
 * Хранилище демонстрации.
 *
 * Всё, что раньше было разбросано по мокам и памяти вкладки, лежит здесь:
 * компании, люди, учётные записи, документы и журнал действий.
 *
 * Хранилище — `localStorage`, а не `sessionStorage`, как было раньше. Причина
 * прямая: человек просил, чтобы черновик не пропадал при перезагрузке и при
 * случайном уходе со страницы, а учётные записи переживали закрытие вкладки.
 * Цена — содержимое документов остаётся в браузере после закрытия вкладки.
 * На сервере так не будет: там документ живёт в базе, а в браузере — только
 * то, что сейчас на экране.
 *
 * Изоляция компаний держится на `companyId` в каждой записи и на том, что
 * читать записи можно только через функции этого файла. Прямого доступа к
 * массиву у экранов нет.
 *
 * Учётные записи и компании (с этапа 1а) и персонал (с этапа 1б) живут на
 * сервере, а здесь – их копия с сервера: она заменяется целиком после входа
 * и после каждого изменения и стирается при выходе. Паролей и их хешей в
 * браузере нет. Прежние учётные записи браузера при первом открытии
 * откладываются для переноса на сервер (`store/legacy.ts`).
 */
import { companies as seedCompanies } from '@/api/mock/companies';
import { captureLegacy } from '@/store/legacy';
import { withRussianSpelling } from '@/utils/names';

import type {
  AllowedAddress,
  ArchiveFile,
  AuditEntry,
  Company,
  CustomTemplate,
  DocumentRecord,
  EmployeeBrief,
  PlatformSettings,
  User,
} from '@/api/types';

const STORAGE_KEY = 'docflow.local.db';
/**
 * 4 – персонал с сервера; карточки, заведённые в браузере, убраны (13.10).
 * 5 – документы, шаблоны и архив с сервера; прежние отложены (15.10).
 */
const VERSION = 5;

/**
 * Документы, шаблоны и описания архива, заведённые в этом браузере до
 * сервера. Человек решил их не переносить (docs/plans/phase-01c-documents.md),
 * но и не стирать: они лежат отдельной записью и на экране не показываются.
 */
export const LEGACY_DOCUMENTS_KEY = 'docflow.legacy.documents';

function stashLegacyDocuments(db: Database): boolean {
  if (db.documents.length === 0 && db.templates.length === 0 && db.archive.length === 0) return true;
  try {
    if (localStorage.getItem(LEGACY_DOCUMENTS_KEY) === null) {
      localStorage.setItem(
        LEGACY_DOCUMENTS_KEY,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          documents: db.documents,
          templates: db.templates,
          archive: db.archive,
          images: db.images,
        }),
      );
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Компании, убранные из группы после того, как попали в браузеры.
 *
 * Исходный набор читается из хранилища, а не из кода, поэтому компания,
 * вычеркнутая из `companies.ts`, осталась бы у всех, кто уже работал в
 * системе. ТОО NOVALLIANCE убрана по просьбе человека 25.09.
 */
const REMOVED_COMPANY_IDS = ['c-novalliance'];

/** Учётная запись в браузере – копия с сервера, без пароля. */
export type StoredUser = User;

/** Поля учётной записи до этапа 1а: вход проверялся в браузере. */
interface LegacyAccountFields {
  password?: unknown;
  failedAttempts?: number;
  lockedUntil?: string;
}

const isLegacyAccount = (u: unknown): boolean =>
  typeof u === 'object' && u !== null && 'password' in u;

export interface Database {
  version: number;
  companies: Company[];
  employees: EmployeeBrief[];
  users: StoredUser[];
  documents: DocumentRecord[];
  /** Загруженные в архив файлы: здесь только описание, сам файл – в IndexedDB. */
  archive: ArchiveFile[];
  /** Шаблоны из конструктора («Тест день 3»): у каждого своя компания. */
  templates: CustomTemplate[];
  /**
   * Картинки из снимков документов, по одной копии на картинку.
   *
   * Загруженный логотип компании – строка data:URL до ~700 тысяч знаков, и
   * снимок реквизитов копировал его в каждый сохранённый документ. Хранилище
   * браузера вмещает около пяти миллионов знаков: на седьмом-восьмом
   * документе запись переставала проходить (оценка 25.09). Теперь в снимке
   * ссылка «image:…», а сама картинка лежит здесь один раз.
   */
  images: Record<string, string>;
  audit: AuditEntry[];
  settings: PlatformSettings;
}

/**
 * Пустая база.
 *
 * Учётных записей и персонала нет: они приходят с сервера после входа.
 */
function seed(): Database {
  return {
    version: VERSION,
    companies: seedCompanies.map((c) => ({ ...c })),
    employees: [],
    users: [],
    documents: [],
    archive: [],
    templates: [],
    images: {},
    audit: [],
    settings: { adminIpAllowList: [] },
  };
}

let cache: Database | null = null;
const listeners = new Set<() => void>();

export function loadDb(): Database {
  if (cache !== null) return cache;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as Partial<Database>;
      cache = migrate(parsed);
      // Хеши паролей прежней версии стираются из хранилища сразу; разовые
      // шаги приведения (запись прежней версии) – тоже записываются сразу.
      if ((parsed.users ?? []).some(isLegacyAccount) || (parsed.version ?? 0) < VERSION) {
        saveDb(cache);
      }
      return cache;
    }
  } catch {
    // Хранилище недоступно: приватное окно, запрет на сайт, переполнение.
    // Это не повод не открыть страницу — работаем в памяти.
  }

  cache = seed();
  saveDb(cache);
  return cache;
}

/**
 * Приводит запись из хранилища к текущему виду.
 *
 * В браузере может лежать база, записанная прежней версией сайта. Полей,
 * появившихся позже, там нет, и без приведения на экране оказалось бы
 * «undefined» вместо описания или состояние, которого больше не существует.
 */
function migrate(raw: Partial<Database>): Database {
  const base = seed();

  const documents = (raw.documents ?? []).map<DocumentRecord>((doc) => ({
    ...doc,
    values: renamePositionKeys(doc.values ?? {}),
    description: typeof doc.description === 'string' ? doc.description : '',
    subject: typeof doc.subject === 'string' ? doc.subject : '',
    // Согласования и утверждения больше нет: всё, что не черновик, — сохранено.
    status: doc.status === 'draft' ? 'draft' : 'saved',
    number: typeof doc.number === 'string' && doc.number !== '' ? doc.number : null,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : doc.createdAt,
    authorId: typeof doc.authorId === 'string' ? doc.authorId : '',
    authorName: typeof doc.authorName === 'string' ? doc.authorName : '',
  }));

  const migrated: Database = {
    version: VERSION,
    // Компании и справочник людей правятся в админ-панели, поэтому берутся
    // из хранилища. Если их там нет — подставляется исходный набор.
    companies:
      raw.companies !== undefined && raw.companies.length > 0
        ? raw.companies.map((company) => withSeedDefaults(company, base.companies))
        : base.companies,
    // Русское ФИО – без казахских букв, казахское – в своём поле («Тест
    // день 3»). Выпущенные документы от этого не меняются: у них снимок.
    employees: (raw.employees ?? base.employees).map(withRussianSpelling),
    users: (raw.users ?? []).map(publicUser),
    documents,
    archive: raw.archive ?? [],
    templates: raw.templates ?? [],
    images: raw.images ?? {},
    audit: raw.audit ?? [],
    settings: { adminIpAllowList: migrateAllowList(raw.settings?.adminIpAllowList) },
  };

  const withoutRemoved = REMOVED_COMPANY_IDS.reduce(
    (db, id) => (db.companies.some((c) => c.id === id) ? dropCompany(db, id, '') : db),
    migrated,
  );
  const withPersonnel = (raw.version ?? 0) < 4 ? withoutLocalPersonnel(withoutRemoved) : withoutRemoved;
  // Документы с этой версии – копия с сервера; прежние – в сторону. Не
  // поместились в хранилище – остаются как есть (копия с сервера их затрёт
  // только у вошедшего, а отложить их можно будет в следующий раз).
  const current =
    (raw.version ?? 0) < 5 && stashLegacyDocuments(internSnapshotImages(withPersonnel))
      ? { ...withPersonnel, documents: [], templates: [], archive: [], images: {} }
      : withPersonnel;

  // Учётные записи, заведённые в браузере до сервера: откладываются для
  // переноса, а копия с сервера появится после входа.
  if ((raw.users ?? []).some(isLegacyAccount)) {
    captureLegacy(current.companies, current.users);
    return internSnapshotImages({ ...current, users: [] });
  }
  return internSnapshotImages(current);
}

/**
 * Персонал с этапа 1б – пользователи компании на сервере, его копия придёт
 * после входа. Карточки, заведённые в этом браузере (условные люди и
 * заведённые руками), уходят один раз – у записи версии меньше 4.
 */
function withoutLocalPersonnel(db: Database): Database {
  const removed = new Map(db.employees.map((e) => [e.id, e]));
  return {
    ...db,
    employees: [],
    documents: removed.size === 0 ? db.documents : db.documents.map((doc) => keepingPeople(doc, removed)),
  };
}

/**
 * Документ, ссылавшийся на убранную карточку, не должен показать
 * идентификатор вместо фамилии. Выпущенному карточка дописывается в снимок –
 * лист выглядит как прежде, значения не меняются (CLAUDE.md, п. 3.4). В
 * черновике идентификатор заменяется ФИО текстом – как вписанное руками.
 */
function keepingPeople(doc: DocumentRecord, removed: Map<string, EmployeeBrief>): DocumentRecord {
  // Запись прежней версии могла сохранить не строку: исключение здесь
  // обернулось бы пустой базой вместо данных человека.
  const lines = (value: unknown): string[] => (typeof value === 'string' ? value.split('\n') : []);
  const referenced = [...new Set(Object.values(doc.values).flatMap(lines))].filter((v) => removed.has(v));
  if (referenced.length === 0) return doc;

  if (doc.status === 'saved') {
    const snapshot = { ...(doc.peopleSnapshot ?? {}) };
    for (const id of referenced) {
      const person = removed.get(id);
      if (person !== undefined && snapshot[id] === undefined) snapshot[id] = { ...person };
    }
    return { ...doc, peopleSnapshot: snapshot };
  }

  const values = Object.fromEntries(
    Object.entries(doc.values).map(([field, value]) => [
      field,
      typeof value === 'string'
        ? value
            .split('\n')
            .map((line) => removed.get(line)?.fullName ?? line)
            .join('\n')
        : value,
    ]),
  );
  return { ...doc, values };
}

/**
 * Логотипы, которые прежняя версия сайта копировала в снимок каждого
 * документа, переезжают в общее хранилище картинок: база сжимается сразу,
 * при первом чтении.
 */
function internSnapshotImages(db: Database): Database {
  let next = db;
  const documents = db.documents.map((doc) => {
    const logo = doc.companySnapshot?.logo;
    if (doc.companySnapshot === undefined || logo === undefined || !logo.startsWith('data:')) return doc;
    const [withImage, ref] = internImage(next, logo);
    next = withImage;
    return { ...doc, companySnapshot: { ...doc.companySnapshot, logo: ref } };
  });
  return next === db ? db : { ...next, documents };
}

/** Короткая сумма строки (cyrb53): ключ картинки в хранилище. */
function hashOf(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const IMAGE_REF = 'image:';

/**
 * Кладёт картинку в общее хранилище и отдаёт ссылку на неё. Та же картинка
 * второй раз не копируется. Не data:URL (логотип из сборки сайта – обычный
 * адрес файла) остаётся как есть.
 */
export function internImage(db: Database, image: string): [Database, string] {
  if (!image.startsWith('data:')) return [db, image];
  // Длина в ключе – вторая защита от совпадения сумм у разных картинок.
  const ref = `${IMAGE_REF}${hashOf(image)}.${image.length.toString(36)}`;
  if (db.images[ref] === image) return [db, ref];
  return [{ ...db, images: { ...db.images, [ref]: image } }, ref];
}

/** Картинка по ссылке из снимка; обычный адрес и data:URL – как есть. */
export function resolveImage(ref: string | undefined): string | undefined {
  if (ref === undefined || !ref.startsWith(IMAGE_REF)) return ref;
  return loadDb().images[ref];
}

/** Убирает картинки, на которые больше не ссылается ни один снимок. */
export function pruneImages(db: Database): Database {
  const used = new Set(db.documents.map((d) => d.companySnapshot?.logo).filter((l) => l !== undefined));
  const kept = Object.fromEntries(Object.entries(db.images).filter(([ref]) => used.has(ref)));
  return Object.keys(kept).length === Object.keys(db.images).length ? db : { ...db, images: kept };
}

/**
 * Убирает компанию из базы.
 *
 * Уходят реквизиты, персонал и доступ людей к этой компании. Документы и
 * файлы архива не стираются молча: они ложатся в корзину админ-панели,
 * откуда их возвращают или удаляют навсегда – это решает человек, а не
 * побочный эффект удаления компании.
 */
export function dropCompany(db: Database, id: string, by: string): Database {
  const now = new Date().toISOString();
  const trash = <T extends Trashable & { companyId: string }>(item: T): T =>
    item.companyId !== id || item.deletedAt !== undefined ? item : trashed(item, by, now);

  return {
    ...db,
    companies: db.companies.filter((c) => c.id !== id),
    employees: db.employees.filter((e) => e.companyId !== id),
    users: db.users.map((u) =>
      u.companyIds.includes(id) ? { ...u, companyIds: u.companyIds.filter((c) => c !== id) } : u,
    ),
    documents: db.documents.map(trash),
    archive: db.archive.map(trash),
    templates: db.templates.map(trash),
  };
}

/** Запись, которую удаляют пометкой: документ, файл архива, шаблон. */
interface Trashable {
  deletedAt?: string;
  deletedBy?: string;
}

/** Пометка «удалено»: запись уходит в корзину, а не стирается. */
export function trashed<T extends Trashable>(item: T, by: string, at = new Date().toISOString()): T {
  return { ...item, deletedAt: at, deletedBy: by };
}

/**
 * Возврат из корзины. Свойства именно удаляются, а не ставятся в
 * `undefined`: при `exactOptionalPropertyTypes` это разные вещи.
 */
export function restored<T extends Trashable>(item: T): T {
  const { deletedAt: _at, deletedBy: _by, ...alive } = item;
  return alive as T;
}

/**
 * Разрешённые адреса раньше были списком строк, теперь – адрес и название
 * («Тест день 2»). Старая строка становится адресом без названия.
 */
export function migrateAllowList(raw: unknown): AllowedAddress[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap<AllowedAddress>((item: unknown) => {
    if (typeof item === 'string') return item.trim() === '' ? [] : [{ ip: item.trim(), name: '' }];
    if (typeof item === 'object' && item !== null && 'ip' in item) {
      const { ip, name } = item as { ip: unknown; name?: unknown };
      if (typeof ip !== 'string' || ip.trim() === '') return [];
      return [{ ip: ip.trim(), name: typeof name === 'string' ? name : '' }];
    }
    return [];
  });
}

/**
 * Перевод должности раньше лежал в отдельных полях `positionKk`/`positionEn`,
 * теперь – под ключами «position.kk» и «position.en», как у любого значения на
 * трёх языках. Без переименования в старых черновиках пропал бы перевод.
 */
function renamePositionKeys(values: Record<string, string>): Record<string, string> {
  if (!('positionKk' in values) && !('positionEn' in values)) return values;

  const { positionKk, positionEn, ...rest } = values;
  return {
    ...rest,
    ...(positionKk === undefined || 'position.kk' in rest ? {} : { 'position.kk': positionKk }),
    ...(positionEn === undefined || 'position.en' in rest ? {} : { 'position.en': positionEn }),
  };
}

/**
 * Дополняет карточку компании тем, чего в ней ещё нет.
 *
 * В браузере лежит база, записанная прежней версией сайта. Реквизитов,
 * появившихся позже – казахского наименования, города на трёх языках,
 * должности руководителя на казахском и английском, логотипа, – там нет
 * вовсе. Без этого человек, уже пользовавшийся системой, видел бы документы
 * без казахской строки в шапке и без «Бас директор» в подписи, пока не стёр
 * бы всё и не завёл заново.
 *
 * Заполняется только отсутствующее. Пустая строка – это осознанно очищенный
 * реквизит, и её мы не трогаем; правка на странице реквизитов тоже новее
 * исходного набора и остаётся как есть.
 */
function withSeedDefaults(company: Company, seeded: Company[]): Company {
  const original = seeded.find((c) => c.id === company.id);
  if (original === undefined) return company;

  const missing: Partial<Company> = {};
  let changed = false;

  for (const key of Object.keys(original) as Array<keyof Company>) {
    if (company[key] === undefined && original[key] !== undefined) {
      // Присваивание через Object.assign: по ключу-объединению TypeScript не
      // сводит тип значения к типу поля, а приводить тут нечего – значение
      // взято из карточки того же вида.
      Object.assign(missing, { [key]: original[key] });
      changed = true;
    }
  }

  return changed ? { ...company, ...missing } : company;
}

let failing = false;

/**
 * Не прошла ли последняя запись («хранилище заполнено»).
 *
 * Раньше сбой глотался молча: сайт продолжал работать в памяти, человек
 * видел «сохранено», а после перезагрузки всё сделанное пропадало. Теперь
 * боковая панель показывает предупреждение, пока запись снова не пройдёт.
 */
export function storageFailing(): boolean {
  return failing;
}

export function saveDb(next: Database): void {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    failing = false;
  } catch {
    // Не сохранилось: работаем в памяти до перезагрузки и говорим об этом.
    failing = true;
  }
  for (const listener of listeners) listener();
}

/** Изменяет базу одним куском: читать и писать по отдельности незачем. */
export function updateDb(change: (db: Database) => Database): Database {
  const next = change(loadDb());
  saveDb(next);
  return next;
}

/** Подписка для React: экраны обновляются сами после записи. */
export function subscribeDb(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Стирает базу целиком: возврат к первому запуску. */
export function resetDb(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Нечего чистить.
  }
  cache = null;
  for (const listener of listeners) listener();
}

/**
 * Перечитывает базу из хранилища, ничего не стирая.
 *
 * Нужно, когда хранилище поменяли мимо этой вкладки: человек открыл систему
 * в двух вкладках и завёл документ в одной. Без этого вторая вкладка так и
 * держала бы старый список и могла бы затереть чужую запись.
 */
export function reloadDb(): void {
  cache = null;
  for (const listener of listeners) listener();
}

// Правка из другой вкладки. Событие приходит только тем вкладкам, которые
// сами не писали, поэтому цикла здесь не возникает.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) reloadDb();
  });
}

/** Идентификатор записи. Времени и случайности хватает для демонстрации. */
export function newId(prefix: string): string {
  const random = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return `${prefix}-${Date.now().toString(36)}-${random.toString(36)}`;
}

/** Учётная запись без полей входа прежней версии (хеш пароля, попытки). */
export function publicUser(stored: StoredUser): User {
  const {
    password: _password,
    failedAttempts: _failed,
    lockedUntil: _locked,
    ...rest
  } = stored as User & LegacyAccountFields;
  return rest;
}

/** Люди компании. Справочник другой компании отсюда получить нельзя. */
export function employeesOf(companyId: string): EmployeeBrief[] {
  return loadDb()
    .employees.filter((e) => e.companyId === companyId)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'));
}

export function findEmployeeIn(companyId: string, id: string): EmployeeBrief | undefined {
  return loadDb().employees.find((e) => e.companyId === companyId && e.id === id);
}

export function findCompanyIn(id: string): Company | undefined {
  return loadDb().companies.find((c) => c.id === id);
}

/**
 * Пишет строку в журнал действий. Журнал не редактируется; в браузере
 * хранятся последние 500 записей, чтобы не переполнить хранилище. Полный
 * журнал без удаления – на сервере (CLAUDE.md, п. 3.4).
 */
export function appendAudit(db: Database, entry: Omit<AuditEntry, 'id' | 'at'>): Database {
  return {
    ...db,
    audit: [{ ...entry, id: newId('a'), at: new Date().toISOString() }, ...db.audit].slice(0, 500),
  };
}
