/**
 * Сессия: кто вошёл, в какой компании работает и что ему видно.
 *
 * С этапа 1а вход проверяет сервер (`api/client.ts`, `api/server.ts`):
 *
 *  - access-токен – в памяти вкладки, refresh – в httpOnly-cookie. При
 *    открытии сайта вход восстанавливается обновлением токена;
 *  - компания – только из токена: выбор компании – запрос к серверу, ни
 *    адрес страницы, ни тело запроса её не задают (CLAUDE.md, п. 3.1);
 *  - учётные записи, компании и персонал – копия с сервера
 *    (`store/accounts.ts`); персонал правит сервер.
 *
 * Документы, шаблоны компании и описания архива с этапа 1б, часть 2 – тоже
 * копия с сервера (`store/documentsSync.ts`): запись ложится в копию сразу и
 * уходит на сервер очередью. Проверка прав здесь – удобство и первая линия:
 * то же правило ещё раз проверяет сервер. Всё, что относится к правам,
 * вынесено в `@/access/policy`.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  can,
  canDeleteArchiveFile,
  canDeleteDocument,
  canGrantDocument,
  canPurgeArchiveFile,
  canPurgeDocument,
  canReceiveGrant,
  canRestoreArchiveFile,
  canRestoreDocument,
  canSeeAuditEntry,
  canSeeUser,
  canCreateTemplate,
  canEditTemplate,
  canUploadArchive,
  canUseCompany,
  canViewArchiveFile,
  visibleArchive,
  visibleDocuments,
  visibleTemplates,
} from '@/access/policy';
import {
  ApiError,
  NetworkError,
  onRefreshed,
  onSessionLost,
  refreshSession,
  setAccessToken,
  setRefreshCompany,
} from '@/api/client';
import { checkTemplate, toDocumentTemplate } from '@/api/mock/customTemplates';
import { server } from '@/api/server';
import { OK, clearAccounts, failed, importLegacy, syncAccounts, userInputOf } from '@/store/accounts';
import {
  appendAudit,
  dropCompany,
  employeesOf,
  findCompanyIn,
  findEmployeeIn,
  internImage,
  loadDb,
  newId,
  pruneImages,
  publicUser,
  resolveImage,
  restored,
  subscribeDb,
  trashed,
  updateDb,
} from '@/store/db';
import { DocumentNumberTakenError, findNumberHolder } from '@/store/documentNumber';
import {
  clearDocuments,
  documentAction,
  flushDocument,
  pushTemplate,
  queueDocument,
  removeTemplate,
  syncDocuments,
} from '@/store/documentsSync';
import { forgetActivity, useIdleTimeout } from '@/store/idle';
import { clearLegacy, readLegacy } from '@/store/legacy';
import { withRussianSpelling } from '@/utils/names';
import { MAX_PDF_BYTES, isPdf, readBytes, sha256Hex } from '@/utils/pdf';

import type { Me, PersonCard, Session } from '@/api/server';
import type {
  ArchiveFile,
  AuditEntry,
  Company,
  CustomTemplate,
  DocumentRecord,
  DocumentTemplate,
  EmployeeBrief,
  PlatformSettings,
  RoleId,
  Action,
  User,
} from '@/api/types';
import type { ImportOutcome, Outcome, UserAccessPatch } from '@/store/accounts';
import type { PushResult } from '@/store/documentsSync';
import type { Database } from '@/store/db';
import type { LegacySnapshot } from '@/store/legacy';
import type { ReactNode } from 'react';

export type { Outcome, UserAccessPatch } from '@/store/accounts';
export type { PushResult } from '@/store/documentsSync';

/**
 * Итог входа. Причину отказа сервер не называет (CLAUDE.md, п. 3.8): нет
 * логина, неверный пароль, блокировка – всё «неверный логин или пароль».
 */
export type SignInResult = 'ok' | 'failed' | 'throttled' | 'unavailable';

/**
 * Что человек правит в своём профиле.
 *
 * Логина, роли, компаний и разделов здесь нет намеренно: их выдаёт
 * администратор, и человек не должен уметь расширить себе доступ.
 * `avatar: undefined` означает «убрать фотографию».
 */
export interface ProfilePatch {
  /** Свой новый логин – только с правом users.login (16.10). */
  login?: string;
  displayName?: string;
  phone?: string;
  email?: string;
  avatar?: string | undefined;
}

export interface NewUserInput {
  login: string;
  displayName: string;
  password: string;
  role: RoleId;
  companyIds: string[];
  sectionIds: string[];
  viewSectionIds: string[];
  /** Права поверх роли: сервер оставит только те, что выдающий может выдать. */
  grantedActions?: Action[];
  position?: string;
  email?: string;
  phone?: string;
}

/** Итог заведения учётной записи. */
export type CreateUserResult = Outcome & { reason?: 'login-taken' };

/** Новый человек в персонале: карточка, логин и необязательный пароль. */
export type NewEmployeeInput = Omit<EmployeeBrief, 'id' | 'companyId' | 'lockVersion'> & {
  login: string;
  password: string;
};

/** Карточка для сервера: без идентификаторов и версии. */
function cardOf({
  id: _id,
  companyId: _companyId,
  lockVersion: _lockVersion,
  ...card
}: PersonCard & Partial<Pick<EmployeeBrief, 'id' | 'companyId' | 'lockVersion'>>): PersonCard {
  return card;
}

/** Шаблон из конструктора, каким его отдаёт экран: без компании и автора. */
export type TemplateInput = Omit<
  CustomTemplate,
  'id' | 'companyId' | 'authorId' | 'authorName' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'deletedBy'
> & { id?: string };

/** Старый документ, который кладут в архив файлом PDF. */
export interface ArchiveUploadInput {
  file: File;
  title: string;
  number: string;
  documentDate: string;
  sectionId: string;
  description: string;
}

export type ArchiveUploadResult =
  | 'ok'
  | 'denied'
  | 'not-pdf'
  | 'too-big'
  | 'duplicate'
  | 'storage-failed';

export type ArchiveOpenResult =
  | { ok: true; blob: Blob; file: ArchiveFile }
  | { ok: false; reason: 'denied' | 'missing' | 'corrupted' };

export interface SaveDocumentInput {
  /** Есть — правим существующую запись, нет — заводим новую. */
  id?: string;
  templateId: string;
  /** Раздел каталога: по нему открывается просмотр документов раздела. */
  sectionId: string;
  title: string;
  /** Английское название шаблона из конструктора. */
  titleEn?: string;
  number: string;
  description: string;
  subject: string;
  values: Record<string, string>;
  /** Черновик или сохранённый документ. */
  status: DocumentRecord['status'];
}

interface SessionValue {
  user: User | null;
  company: Company | null;
  /** Компании, доступные этому человеку. */
  companies: Company[];
  /** Документы, которые человеку видны в текущей компании. */
  documents: DocumentRecord[];
  /**
   * Все видимые документы во всех доступных компаниях, включая удалённые:
   * только для админ-панели, где из корзины их возвращают.
   */
  allVisibleDocuments: DocumentRecord[];
  /** Люди текущей компании: список выбора в формах. */
  employees: EmployeeBrief[];
  /** Справочники всех компаний: нужны только админ-панели. */
  allEmployees: EmployeeBrief[];
  /** Учётные записи, которые человеку видны в админ-панели (`canSeeUser`). */
  users: User[];
  /** Записи журнала, которые человеку видны (`canSeeAuditEntry`). */
  audit: AuditEntry[];
  settings: PlatformSettings;
  /** Вход ещё восстанавливается по refresh-cookie: решать «вошёл ли» рано. */
  restoring: boolean;
  /**
   * Пароль для админ-панели уже подтверждён в этом входе. Спрашивается один
   * раз и забывается при выходе («Тест день 2»).
   */
  adminUnlocked: boolean;
  unlockAdmin: () => void;
  lockAdmin: () => void;

  signIn: (login: string, password: string) => Promise<SignInResult>;
  signOut: () => void;
  /**
   * Вход завершился сам – 30 минут без действий (`store/idle.ts`). Экран
   * входа говорит об этом, чтобы человек не гадал, почему его выбросило.
   */
  signedOutForIdle: boolean;
  /** Повторная проверка пароля: вход в админ-панель (CLAUDE.md, п. 3.8). */
  confirmPassword: (password: string) => Promise<boolean>;
  /** Выбор компании – новый токен с ней. Пусто – вернуться к выбору. */
  selectCompany: (companyId: string) => Promise<Outcome>;

  /**
   * Сохраняет документ. Сохранение с номером, который уже стоит на другом
   * документе компании, отказывается исключением `DocumentNumberTakenError`:
   * экран проверяет номер заранее через `numberTaken`, а это – последняя
   * линия защиты.
   */
  saveDocument: (input: SaveDocumentInput) => DocumentRecord;
  /**
   * Ждёт, пока документ дойдёт до сервера. «Сохранить» ждёт ответа: занятый
   * номер, отказ и отсутствие связи видны сразу на форме.
   */
  syncDocument: (id: string) => Promise<PushResult>;
  /** Занят ли номер в текущей компании другим сохранённым документом. */
  numberTaken: (number: string, exceptId?: string) => boolean;
  deleteDocument: (id: string) => void;
  /** Возвращает удалённый документ в реестр. */
  restoreDocument: (id: string) => void;
  /**
   * Стирает документ из корзины навсегда («Тест день 3»). Живой документ не
   * стирается: сначала он должен попасть в корзину. В журнале остаётся запись.
   */
  purgeDocument: (id: string) => void;
  /** Файлы архива всех компаний человека, которые ему видны (16.10). */
  archive: ArchiveFile[];
  /** Сохранённые документы всех компаний человека, которые ему видны: архив. */
  archiveDocuments: DocumentRecord[];
  uploadArchiveFile: (input: ArchiveUploadInput) => Promise<ArchiveUploadResult>;
  /** Достаёт файл и сверяет его SHA-256 с тем, что записали при загрузке. */
  openArchiveFile: (id: string) => Promise<ArchiveOpenResult>;
  deleteArchiveFile: (id: string) => void;
  /** Удалённые файлы архива во всех доступных компаниях: корзина админ-панели. */
  archiveBin: ArchiveFile[];
  restoreArchiveFile: (id: string) => void;
  /** Стирает файл из корзины навсегда: запись и сам файл в хранилище. */
  purgeArchiveFile: (id: string) => Promise<void>;
  /** Выдаёт или снимает (`null`) доступ человека к документу. */
  setDocumentGrant: (docId: string, userId: string, level: 'view' | 'edit' | null) => void;
  findDocument: (id: string) => DocumentRecord | undefined;

  updateProfile: (patch: ProfilePatch) => Promise<Outcome>;
  changePassword: (current: string, next: string) => Promise<Outcome>;

  createUser: (input: NewUserInput) => Promise<CreateUserResult>;
  updateUser: (id: string, patch: UserAccessPatch) => Promise<Outcome>;
  setUserPassword: (id: string, password: string) => Promise<Outcome>;
  removeUser: (id: string) => Promise<Outcome>;

  saveCompany: (company: Company) => Promise<Outcome>;
  removeCompany: (id: string) => Promise<Outcome>;

  /** Учётные записи и компании этого браузера до сервера, если остались. */
  legacy: LegacySnapshot | null;
  /** Перенос их на сервер (администратор платформы, один раз). */
  importLegacy: () => Promise<ImportOutcome>;
  /** Стереть их из браузера, не перенося. */
  forgetLegacy: () => void;

  /**
   * Персонал текущей компании – её пользователи на сервере (этап 1б).
   * Новый человек – учётная запись работника; пароль необязателен.
   */
  createEmployee: (input: NewEmployeeInput) => Promise<CreateUserResult>;
  /** Карточка: имя и его формы – общие, должность и подразделение – в этой компании. */
  saveEmployee: (employee: EmployeeBrief) => Promise<Outcome>;
  /** Убрать из персонала компании; других компаний нет – учётная запись удаляется. */
  removeEmployee: (id: string) => Promise<Outcome>;

  saveSettings: (settings: PlatformSettings) => void;

  /** Шаблоны из конструктора текущей компании, которые человеку видны. */
  templates: CustomTemplate[];
  /**
   * Шаблон компании для формы и листа. У сохранённого документа – его снимок:
   * правка и удаление шаблона выпущенный документ не меняют (CLAUDE.md,
   * п. 3.4). Шаблоны каталога здесь не ищутся – их экраны берут сами.
   */
  findCompanyTemplate: (id: string, record?: DocumentRecord) => DocumentTemplate | undefined;
  /** Шаблон для правки в конструкторе, если человеку его можно править. */
  editableTemplate: (id: string) => CustomTemplate | undefined;
  /** Сохраняет шаблон. Нет права или шаблон не заполнен – `null`. */
  saveTemplate: (input: TemplateInput) => CustomTemplate | null;
  /** Убирает шаблон из каталога. Созданные по нему документы остаются. */
  deleteTemplate: (id: string) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

const SESSION_KEY = 'docflow.session';

/**
 * Что вкладка помнит о входе: выбранную компанию (сервер проверит доступ
 * при обновлении токена) и отметку «пароль админ-панели подтверждён». Кто
 * вошёл, здесь не хранится – это знает только сервер.
 */
interface Persisted {
  companyId: string | null;
  adminUnlocked?: boolean;
}

function readSession(): Persisted {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw === null) return { companyId: null };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      companyId: typeof parsed.companyId === 'string' ? parsed.companyId : null,
      adminUnlocked: parsed.adminUnlocked === true,
    };
  } catch {
    return { companyId: null };
  }
}

/**
 * Отметка «в этом браузере есть вход». Самого входа в ней нет – только
 * признак, что refresh-cookie стоит проверять: без него каждый открывший
 * сайт без входа получал бы лишний отказ сервера.
 */
const SIGNED_IN_KEY = 'docflow.signed-in';

function markSignedIn(on: boolean): void {
  try {
    if (on) localStorage.setItem(SIGNED_IN_KEY, '1');
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    // Хранилище недоступно: вход проверится по cookie в любом случае.
  }
}

function maybeSignedIn(): boolean {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) !== null;
  } catch {
    return true;
  }
}

function writeSession(state: Persisted): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    // Работаем в памяти до перезагрузки.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const db = useSyncExternalStore(subscribeDb, loadDb);

  const initial = readSession();
  // Пока вход восстанавливается по refresh-cookie, экраны не решают, вошёл
  // ли человек: иначе перезагрузка страницы на миг показывала бы вход.
  const [restoring, setRestoring] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  // Живёт в `sessionStorage` вместе с выбранной компанией: переключение языка
  // перерисовывает дерево и раньше выбрасывало из панели, а выход стирает
  // отметку целиком.
  const [adminUnlocked, setAdminUnlocked] = useState(initial.adminUnlocked === true);
  const [signedOutForIdle, setSignedOutForIdle] = useState(false);
  const [legacy, setLegacy] = useState<LegacySnapshot | null>(() => readLegacy());

  const user = me?.user ?? null;

  const persist = useCallback((next: Partial<Persisted>) => {
    writeSession({ ...readSession(), ...next });
  }, []);

  /** Ответ сервера на вход, обновление, выбор компании, смену пароля. */
  const applySession = useCallback(
    (session: Session) => {
      setAccessToken(session.accessToken);
      markSignedIn(true);
      setMe(session.me);
      const chosen = session.me.companyId === '' ? null : session.me.companyId;
      setCompanyId(chosen);
      persist({ companyId: chosen });
      void syncAccounts().catch(() => undefined);
      void syncDocuments().catch(() => undefined);
    },
    [persist],
  );

  /** Конец входа на этой вкладке: токен, копия учётных записей, отметки. */
  const forget = useCallback(() => {
    setAccessToken(null);
    markSignedIn(false);
    setMe(null);
    setCompanyId(null);
    setAdminUnlocked(false);
    forgetActivity();
    clearAccounts();
    clearDocuments();
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Нечего чистить.
    }
  }, []);

  useEffect(() => {
    setRefreshCompany(() => readSession().companyId ?? '');
    onRefreshed((payload) => applySession(payload as Session));
    const off = onSessionLost(forget);
    let alive = true;
    if (maybeSignedIn()) {
      void refreshSession()
        .then((ok) => {
          // Cookie истекла или отозвана: в следующий раз не спрашиваем.
          if (!ok) markSignedIn(false);
        })
        .finally(() => {
          if (alive) setRestoring(false);
        });
    } else {
      setRestoring(false);
    }
    return () => {
      alive = false;
      off();
    };
  }, [applySession, forget]);

  // Документы, реквизиты компаний и персонал правят и на других компьютерах:
  // свежая копия раз в минуту и при возврате на вкладку. Реквизиты – чтобы
  // форма и лист показывали текущие, а не те, что были при входе (19.10).
  useEffect(() => {
    if (me === null) return undefined;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void syncDocuments().catch(() => undefined);
      void syncAccounts().catch(() => undefined);
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [me]);

  const signIn = useCallback<SessionValue['signIn']>(
    async (login, password) => {
      try {
        const session = await server.login(login.trim(), password);
        setAdminUnlocked(false);
        setSignedOutForIdle(false);
        persist({ adminUnlocked: false });
        applySession(session);
        return 'ok';
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) return 'throttled';
        if (error instanceof ApiError && error.status === 401) return 'failed';
        if (error instanceof NetworkError) return 'unavailable';
        return error instanceof ApiError && error.status < 500 ? 'failed' : 'unavailable';
      }
    },
    [applySession, persist],
  );

  const signOut = useCallback(() => {
    // Сервер отзывает цепочку refresh; не ответил – вкладка всё равно
    // выходит, а cookie истечёт сама.
    void server.logout().catch(() => undefined);
    setSignedOutForIdle(false);
    forget();
  }, [forget]);

  const signOutForIdle = useCallback(() => {
    signOut();
    setSignedOutForIdle(true);
  }, [signOut]);
  useIdleTimeout(user !== null, signOutForIdle);

  const confirmPassword = useCallback<SessionValue['confirmPassword']>(async (password) => {
    try {
      await server.confirmPassword(password);
      return true;
    } catch {
      return false;
    }
  }, []);

  const unlockAdmin = useCallback(() => {
    setAdminUnlocked(true);
    persist({ adminUnlocked: true });
  }, [persist]);

  const lockAdmin = useCallback(() => {
    setAdminUnlocked(false);
    persist({ adminUnlocked: false });
  }, [persist]);

  const selectCompany = useCallback<SessionValue['selectCompany']>(
    async (id) => {
      // Пусто – вернуться к выбору компании: токен с прежней компанией
      // остаётся, но экраны компании закрываются до нового выбора.
      if (id === '') {
        setCompanyId(null);
        persist({ companyId: null });
        return OK;
      }
      try {
        applySession(await server.selectCompany(id));
        return OK;
      } catch (error) {
        return failed(error);
      }
    },
    [applySession, persist],
  );

  const subject = useMemo(() => ({ user, companyId }), [user, companyId]);

  const companies = useMemo(() => {
    if (user === null) return [];
    return db.companies.filter((c) => canUseCompany(user, c.id));
  }, [db.companies, user]);

  const documents = useMemo(() => {
    if (companyId === null) return [];
    return visibleDocuments(
      subject,
      db.documents.filter((d) => d.companyId === companyId),
    ).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }, [db.documents, companyId, subject]);

  const allVisibleDocuments = useMemo(
    () =>
      visibleDocuments(subject, db.documents, { withDeleted: true }).sort(
        (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      ),
    [db.documents, subject],
  );

  // Архив – во всех компаниях человека, а не только в текущей (решение
  // человека 16.10, docs/plans/phase-01d-archive-login.md): кадровик двух
  // компаний видит файлы и сохранённые документы обеих. Изоляция – по доступу
  // к компании: политика видит строку, только если человек в её компании, и
  // сервер присылает только такие.
  const archive = useMemo(() => {
    if (companyId === null) return [];
    return visibleArchive(subject, db.archive).sort((a, b) => b.documentDate.localeCompare(a.documentDate));
  }, [db.archive, companyId, subject]);

  const archiveDocuments = useMemo(() => {
    if (companyId === null) return [];
    return visibleDocuments(
      subject,
      db.documents.filter((d) => d.status === 'saved'),
    ).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }, [db.documents, companyId, subject]);

  const employees = useMemo(
    () => (companyId === null ? [] : employeesOf(companyId)),
    // db.employees в зависимостях нарочно: справочник правится в админ-панели,
    // и список выбора должен обновиться сразу.
    [companyId, db.employees],
  );

  const users = useMemo(
    () => db.users.map(publicUser).filter((target) => canSeeUser(subject, target)),
    [db.users, subject],
  );

  const audit = useMemo(
    () => db.audit.filter((entry) => canSeeAuditEntry(subject, entry)),
    [db.audit, subject],
  );

  const saveDocument = useCallback<SessionValue['saveDocument']>(
    (input) => {
      const now = new Date().toISOString();
      const company = companyId === null ? undefined : findCompanyIn(companyId);
      const existing =
        input.id === undefined ? undefined : loadDb().documents.find((d) => d.id === input.id);

      if (
        input.status === 'saved' &&
        findNumberHolder(loadDb().documents, companyId ?? '', input.number, existing?.id) !==
          undefined
      ) {
        throw new DocumentNumberTakenError(input.number);
      }

      const record: DocumentRecord = {
        id: existing?.id ?? newId('d'),
        templateId: input.templateId,
        sectionId: input.sectionId,
        companyId: companyId ?? '',
        title: input.title,
        ...(input.titleEn === undefined || input.titleEn === '' ? {} : { titleEn: input.titleEn }),
        description: input.description.trim(),
        subject: input.subject.trim(),
        status: input.status,
        // Номер вводит человек. Это отступление от CLAUDE.md, п. 3.4, где
        // номер присваивает сервер при утверждении из счётчика под
        // блокировкой (docs/questions.md, Q17). Пустая строка остаётся null.
        number: input.number.trim() === '' ? null : input.number.trim(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        values: input.values,
        // Снимок делается при сохранении, а не у черновика: черновик ещё не
        // выпущен и должен показывать текущие реквизиты и текущий справочник.
        ...(input.status === 'saved' && company !== undefined
          ? { companySnapshot: { ...company } }
          : {}),
        ...(input.status === 'saved'
          ? { peopleSnapshot: peopleReferencedBy(input.values, companyId ?? '') }
          : {}),
        ...templateSnapshotFor(input.templateId, companyId ?? '', existing),
        authorId: existing?.authorId ?? user?.id ?? '',
        authorName: existing?.authorName ?? user?.displayName ?? '',
        // Выданный доступ переживает правку документа.
        ...(existing?.grants === undefined ? {} : { grants: existing.grants }),
        ...(existing?.lockVersion === undefined ? {} : { lockVersion: existing.lockVersion }),
      };
      let queued: DocumentRecord = record;

      updateDb((current) => {
        // Логотип из снимка – в общее хранилище картинок, в снимке – ссылка:
        // иначе каждый документ нёс бы свою копию картинки (`Database.images`).
        const logo = record.companySnapshot?.logo;
        const [cur, logoRef] =
          logo === undefined ? [current, undefined] : internImage(current, logo);
        const stored: DocumentRecord =
          record.companySnapshot === undefined || logoRef === undefined
            ? record
            : { ...record, companySnapshot: { ...record.companySnapshot, logo: logoRef } };

        queued = stored;
        const documents =
          existing === undefined
            ? [stored, ...cur.documents]
            : cur.documents.map((d) => (d.id === stored.id ? stored : d));

        // Черновик пишется при каждом нажатии клавиши — в журнал попадает
        // только создание и сохранение, иначе журнал станет нечитаемым.
        if (existing !== undefined && input.status === 'draft') {
          return { ...cur, documents };
        }

        return appendAudit(
          { ...cur, documents },
          by(
            user,
            record.companyId,
            existing === undefined ? 'document.create' : 'document.update',
            record.title,
          ),
        );
      });

      queueDocument(queued);
      return record;
    },
    [companyId, user],
  );

  const deleteDocument = useCallback<SessionValue['deleteDocument']>(
    (id) => {
      const now = new Date().toISOString();
      const found = loadDb().documents.find((d) => d.id === id);
      // Проверка – здесь, а не только на экране; решает сервер (CLAUDE.md, п. 3.2).
      if (found === undefined || !canDeleteDocument(subject, found)) return;
      void documentAction(
        id,
        (version) => server.deleteDocument(id, version).then(() => undefined),
        (version) => setVersion(id, version),
      );

      updateDb((cur) => {
        const target = cur.documents.find((d) => d.id === id);
        if (target === undefined) return cur;

        return appendAudit(
          {
            ...cur,
            // Удаление – пометка: запись пропадает из реестров и лежит в
            // корзине, откуда её возвращают или стирают навсегда.
            documents: cur.documents.map((d) =>
              d.id === id ? trashed(d, user?.displayName ?? '', now) : d,
            ),
          },
          by(user, target.companyId, 'document.delete', target.title),
        );
      });
    },
    [subject, user],
  );

  const numberTaken = useCallback<SessionValue['numberTaken']>(
    (number, exceptId) =>
      // Проверка идёт по всем документам компании, а не по видимым человеку:
      // номер уникален в компании, как ограничение в базе. Наружу уходит
      // только «занят», без названия чужого документа.
      companyId !== null &&
      findNumberHolder(db.documents, companyId, number, exceptId) !== undefined,
    [db.documents, companyId],
  );

  const restoreDocument = useCallback<SessionValue['restoreDocument']>(
    (id) => {
      const found = loadDb().documents.find((d) => d.id === id);
      if (found === undefined || !canRestoreDocument(subject, found)) return;
      void documentAction(
        id,
        (version) => server.restoreDocument(id, version).then(() => undefined),
        (version) => setVersion(id, version),
      );
      updateDb((cur) => {
        const target = cur.documents.find((d) => d.id === id);
        if (target === undefined) return cur;

        return appendAudit(
          {
            ...cur,
            documents: cur.documents.map((d) => (d.id === id ? restored(d) : d)),
          },
          by(user, target.companyId, 'document.restore', target.title),
        );
      });
    },
    [subject, user],
  );

  const purgeDocument = useCallback<SessionValue['purgeDocument']>(
    (id) => {
      const found = loadDb().documents.find((d) => d.id === id);
      if (found === undefined || !canPurgeDocument(subject, found)) return;
      void documentAction(
        id,
        (version) => server.purgeDocument(id, version).then(() => undefined),
        () => undefined,
      );
      updateDb((cur) => {
        const target = cur.documents.find((d) => d.id === id);
        if (target === undefined) return cur;

        return appendAudit(
          pruneImages({ ...cur, documents: cur.documents.filter((d) => d.id !== id) }),
          // Самого документа больше нет: в журнале остаётся, что это было.
          by(
            user,
            target.companyId,
            'document.purge',
            target.number === null ? target.title : `${target.title} № ${target.number}`,
          ),
        );
      });
    },
    [subject, user],
  );

  const uploadArchiveFile = useCallback<SessionValue['uploadArchiveFile']>(
    async (input) => {
      // Компания – только из токена, не из формы (CLAUDE.md, п. 3.1).
      if (companyId === null || user === null) return 'denied';
      if (!canUploadArchive(subject, companyId, input.sectionId)) return 'denied';
      if (input.file.size > MAX_PDF_BYTES) return 'too-big';

      const buffer = await readBytes(input.file);
      if (!isPdf(new Uint8Array(buffer))) return 'not-pdf';

      const sha256 = await sha256Hex(buffer);
      // Один и тот же файл дважды в архиве компании – дубль; решает сервер,
      // здесь – чтобы не гнать файл зря.
      const duplicate = loadDb().archive.some(
        (f) => f.companyId === companyId && f.deletedAt === undefined && f.sha256 === sha256,
      );
      if (duplicate) return 'duplicate';

      let record: ArchiveFile;
      try {
        // Файл идёт частями: описание, части, завершение – сервер сверяет
        // размер и SHA-256 (CLAUDE.md, п. 3.7).
        const up = await server.startUpload({
          title: input.title.trim(),
          number: input.number.trim(),
          documentDate: input.documentDate,
          sectionId: input.sectionId,
          description: input.description.trim(),
          fileName: input.file.name,
          size: buffer.byteLength,
          sha256,
        });
        for (let part = 0; part < up.parts; part += 1) {
          const start = part * up.partSize;
          const end = Math.min(start + up.partSize, buffer.byteLength);
          await server.putPart(up.id, part, new Uint8Array(buffer.slice(start, end)));
        }
        record = await server.completeUpload(up.id);
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) return 'duplicate';
        if (error instanceof ApiError && error.status === 403) return 'denied';
        return 'storage-failed';
      }

      updateDb((cur) =>
        appendAudit(
          { ...cur, archive: [archiveCopy(record), ...cur.archive.filter((f) => f.id !== record.id)] },
          {
            userId: user.id,
            userName: user.displayName,
            companyId,
            event: 'archive.upload',
            target: record.title,
          },
        ),
      );
      return 'ok';
    },
    [companyId, subject, user],
  );

  const openArchiveFile = useCallback<SessionValue['openArchiveFile']>(
    async (id) => {
      const file = loadDb().archive.find((f) => f.id === id);
      if (file === undefined || !canViewArchiveFile(subject, file)) {
        return { ok: false, reason: 'denied' };
      }

      const parts: ArrayBuffer[] = [];
      try {
        const count = file.parts ?? Math.ceil(file.size / ARCHIVE_PART_SIZE);
        for (let part = 0; part < count; part += 1) parts.push(await server.part(id, part));
      } catch (error) {
        return { ok: false, reason: error instanceof ApiError && error.status === 404 ? 'denied' : 'missing' };
      }
      const blob = new Blob(parts, { type: 'application/pdf' });

      // Файл, который дошёл не тем, что загружали, не выдаётся.
      const actual = await sha256Hex(await readBytes(blob));
      if (actual !== file.sha256) return { ok: false, reason: 'corrupted' };

      return { ok: true, blob, file };
    },
    [subject],
  );

  const deleteArchiveFile = useCallback<SessionValue['deleteArchiveFile']>(
    (id) => {
      const found = loadDb().archive.find((f) => f.id === id);
      if (found === undefined || !canDeleteArchiveFile(subject, found)) return;
      const now = new Date().toISOString();
      updateDb((cur) =>
        appendAudit(
          {
            ...cur,
            archive: cur.archive.map((f) => (f.id === id ? trashed(f, user?.displayName ?? '', now) : f)),
          },
          by(user, found.companyId, 'archive.delete', found.title),
        ),
      );
      void server.deleteArchiveFile(id).catch(resync);
    },
    [subject, user],
  );

  const archiveBin = useMemo(
    () =>
      visibleArchive(subject, db.archive, { withDeleted: true })
        .filter((f) => f.deletedAt !== undefined)
        .sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? '')),
    [db.archive, subject],
  );

  const restoreArchiveFile = useCallback<SessionValue['restoreArchiveFile']>(
    (id) => {
      const found = loadDb().archive.find((f) => f.id === id);
      if (found === undefined || !canRestoreArchiveFile(subject, found)) return;
      updateDb((cur) =>
        appendAudit(
          { ...cur, archive: cur.archive.map((f) => (f.id === id ? restored(f) : f)) },
          by(user, found.companyId, 'archive.restore', found.title),
        ),
      );
      void server.restoreArchiveFile(id).catch(resync);
    },
    [subject, user],
  );

  const purgeArchiveFile = useCallback<SessionValue['purgeArchiveFile']>(
    async (id) => {
      const target = loadDb().archive.find((f) => f.id === id);
      if (target === undefined || !canPurgeArchiveFile(subject, target)) return;

      updateDb((cur) =>
        appendAudit(
          { ...cur, archive: cur.archive.filter((f) => f.id !== id) },
          by(user, target.companyId, 'archive.purge', target.title),
        ),
      );
      await server.purgeArchiveFile(id).catch(resync);
    },
    [subject, user],
  );

  const setDocumentGrant = useCallback<SessionValue['setDocumentGrant']>(
    (docId, targetId, level) => {
      const db0 = loadDb();
      const doc = db0.documents.find((d) => d.id === docId);
      const target = db0.users.find((u) => u.id === targetId);
      if (doc === undefined || target === undefined) return;

      // Проверка – здесь, а не только на экране (CLAUDE.md, п. 3.2): кнопку
      // можно вызвать и мимо интерфейса. Решает сервер.
      if (!canGrantDocument(subject, doc)) return;
      if (level !== null && !canReceiveGrant(subject, doc, publicUser(target))) return;

      void documentAction(
        docId,
        () => (level === null ? server.revoke(docId, targetId) : server.grant(docId, targetId, level)),
        () => undefined,
      );

      updateDb((cur) => {
        const current = cur.documents.find((d) => d.id === docId);
        if (current === undefined) return cur;
        const rest = (current.grants ?? []).filter((g) => g.userId !== targetId);
        const grants =
          level === null
            ? rest
            : [
                ...rest,
                {
                  userId: targetId,
                  level,
                  grantedBy: user?.displayName ?? '',
                  grantedAt: new Date().toISOString(),
                },
              ];

        return appendAudit(
          {
            ...cur,
            documents: cur.documents.map((d) => (d.id === docId ? { ...d, grants } : d)),
          },
          by(
            user,
            doc.companyId,
            level === null ? 'document.revoke' : `document.grant.${level}`,
            `${doc.title} – ${target.displayName}`,
          ),
        );
      });
    },
    [subject, user],
  );

  const updateProfile = useCallback<SessionValue['updateProfile']>(
    async (patch) => {
      if (user === null) return failed(null);
      // `avatar: undefined` – убрать фотографию: поле не отправляется.
      const avatar = 'avatar' in patch ? patch.avatar : user.avatar;
      const phone = patch.phone ?? user.phone;
      const email = patch.email ?? user.email;
      try {
        const next = await server.updateProfile({
          displayName: (patch.displayName ?? user.displayName).trim(),
          lockVersion: user.lockVersion ?? 0,
          ...(patch.login === undefined ? {} : { login: patch.login.trim() }),
          ...(user.employeeId === undefined ? {} : { employeeId: user.employeeId }),
          ...(phone === undefined || phone === '' ? {} : { phone }),
          ...(email === undefined || email === '' ? {} : { email }),
          ...(avatar === undefined ? {} : { avatar }),
        });
        setMe(next);
        void syncAccounts().catch(() => undefined);
        return OK;
      } catch (error) {
        return failed(error);
      }
    },
    [user],
  );

  const changePassword = useCallback<SessionValue['changePassword']>(
    async (current, next) => {
      try {
        // Прежние входы закрываются, эта вкладка продолжает с новыми токенами.
        applySession(await server.changePassword(current, next));
        return OK;
      } catch (error) {
        return failed(error);
      }
    },
    [applySession],
  );

  /** Любое изменение учётных записей, компаний и персонала – и свежая копия с сервера. */
  const mutate = useCallback(async (run: () => Promise<unknown>): Promise<Outcome> => {
    try {
      await run();
    } catch (error) {
      // Конфликт или «не найдено» – копия устарела: берём свежую.
      void syncAccounts().catch(() => undefined);
      return failed(error);
    }
    await syncAccounts().catch(() => undefined);
    return OK;
  }, []);

  // Права, роли и компании проверяет сервер (CLAUDE.md, п. 3.2); здесь –
  // только запрос и свежая копия.
  const createUser = useCallback<SessionValue['createUser']>(
    async (input) => {
      const { login, password, position, email, phone, ...access } = input;
      const outcome = await mutate(() =>
        server.createUser({
          login: login.trim(),
          password,
          ...access,
          displayName: access.displayName.trim(),
          role: access.role,
          companyIds: access.role === 'platform-admin' ? [] : access.companyIds,
          grantedActions: access.grantedActions ?? [],
          blocked: false,
          ...(position === undefined || position === '' ? {} : { position }),
          ...(email === undefined || email === '' ? {} : { email }),
          ...(phone === undefined || phone === '' ? {} : { phone }),
        }),
      );
      if (!outcome.ok && outcome.field === 'login') return { ...outcome, reason: 'login-taken' };
      return outcome;
    },
    [mutate],
  );

  const updateUser = useCallback<SessionValue['updateUser']>(
    (id, patch) => {
      const target = loadDb().users.find((u) => u.id === id);
      if (target === undefined) return Promise.resolve(failed(null));
      return mutate(() =>
        server.updateUser(id, { ...userInputOf(target, patch), lockVersion: target.lockVersion ?? 0 }),
      );
    },
    [mutate],
  );

  const setUserPassword = useCallback<SessionValue['setUserPassword']>(
    (id, password) => mutate(() => server.setUserPassword(id, password)),
    [mutate],
  );

  const removeUser = useCallback<SessionValue['removeUser']>(
    (id) => {
      const target = loadDb().users.find((u) => u.id === id);
      if (target === undefined) return Promise.resolve(failed(null));
      return mutate(() => server.deleteUser(id, target.lockVersion ?? 0));
    },
    [mutate],
  );

  const saveCompany = useCallback<SessionValue['saveCompany']>(
    (company) => {
      const exists = loadDb().companies.some((c) => c.id === company.id);
      return mutate(() => (exists ? server.updateCompany(company) : server.createCompany(company)));
    },
    [mutate],
  );

  const removeCompany = useCallback<SessionValue['removeCompany']>(
    async (id) => {
      const target = loadDb().companies.find((c) => c.id === id);
      if (target === undefined) return failed(null);
      const outcome = await mutate(() => server.deleteCompany(id, target.lockVersion ?? 0));
      if (!outcome.ok) return outcome;
      // Документы, файлы и шаблоны этой компании в браузере (до этапа 1б)
      // уходят в корзину, как и раньше, а не стираются молча.
      updateDb((cur) =>
        appendAudit(
          dropCompany({ ...cur, companies: [...cur.companies, target] }, id, user?.displayName ?? ''),
          by(user, id, 'company.delete', target.name),
        ),
      );
      return OK;
    },
    [mutate, user],
  );

  const runImport = useCallback<SessionValue['importLegacy']>(async () => {
    if (legacy === null) return { ok: false, message: '', notEmpty: false };
    // Карточка переноса остаётся до перезагрузки, чтобы человек прочёл итог;
    // копия в хранилище после переноса уже стёрта.
    return importLegacy(legacy);
  }, [legacy]);

  const forgetLegacy = useCallback(() => {
    clearLegacy();
    setLegacy(null);
  }, []);

  // Персонал правит сервер (права, компания из токена, журнал); здесь –
  // правило написания имён и свежая копия после изменения.
  const createEmployee = useCallback<SessionValue['createEmployee']>(
    async ({ login, password, ...card }) => {
      const outcome = await mutate(() =>
        server.createPerson({
          ...cardOf(withRussianSpelling(card)),
          login: login.trim(),
          ...(password === '' ? {} : { password }),
        }),
      );
      if (!outcome.ok && outcome.field === 'login') return { ...outcome, reason: 'login-taken' };
      return outcome;
    },
    [mutate],
  );

  const saveEmployee = useCallback<SessionValue['saveEmployee']>(
    (employee) =>
      mutate(() =>
        server.updatePerson(employee.id, {
          ...cardOf(withRussianSpelling(employee)),
          lockVersion: employee.lockVersion ?? 0,
        }),
      ),
    [mutate],
  );

  const removeEmployee = useCallback<SessionValue['removeEmployee']>(
    (id) => {
      const target = loadDb().employees.find((e) => e.id === id && e.companyId === companyId);
      if (target === undefined) return Promise.resolve(failed(null));
      return mutate(() => server.removePerson(id, target.lockVersion ?? 0));
    },
    [companyId, mutate],
  );

  const saveSettings = useCallback<SessionValue['saveSettings']>(
    (settings) => {
      if (!can(subject, 'settings.manage')) return;
      updateDb((cur: Database) =>
        appendAudit(
          { ...cur, settings },
          by(user, '', 'settings.save', settings.adminIpAllowList.map((a) => a.ip).join(', ')),
        ),
      );
    },
    [subject, user],
  );

  const templates = useMemo(
    () =>
      visibleTemplates(subject, db.templates).sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    [db.templates, subject],
  );

  const findCompanyTemplate = useCallback<SessionValue['findCompanyTemplate']>(
    (id, record) => {
      if (record?.status === 'saved' && record.templateSnapshot !== undefined) {
        return record.templateSnapshot;
      }
      const live = templates.find((tpl) => tpl.id === id);
      return live === undefined ? record?.templateSnapshot : toDocumentTemplate(live);
    },
    [templates],
  );

  const editableTemplate = useCallback<SessionValue['editableTemplate']>(
    (id) => {
      const found = db.templates.find((tpl) => tpl.id === id);
      return found !== undefined && canEditTemplate(subject, found) ? found : undefined;
    },
    [db.templates, subject],
  );

  const saveTemplate = useCallback<SessionValue['saveTemplate']>(
    (input) => {
      // Компания – только из сессии (CLAUDE.md, п. 3.1): шаблон не завести в
      // чужой компании, подменив поле в запросе.
      if (companyId === null || user === null) return null;

      const existing =
        input.id === undefined ? undefined : loadDb().templates.find((tpl) => tpl.id === input.id);
      if (existing !== undefined && !canEditTemplate(subject, existing)) return null;
      if (!canCreateTemplate(subject, input.sectionId)) return null;

      const now = new Date().toISOString();
      const { id: _id, ...fields } = input;
      const record: CustomTemplate = {
        ...fields,
        id: existing?.id ?? newId('custom'),
        companyId,
        authorId: existing?.authorId ?? user.id,
        authorName: existing?.authorName ?? user.displayName,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      if (checkTemplate(record).length > 0) return null;
      const stored: CustomTemplate =
        existing?.lockVersion === undefined ? record : { ...record, lockVersion: existing.lockVersion };

      updateDb((cur) =>
        appendAudit(
          {
            ...cur,
            templates:
              existing === undefined
                ? [...cur.templates, stored]
                : cur.templates.map((tpl) => (tpl.id === stored.id ? stored : tpl)),
          },
          {
            userId: user.id,
            userName: user.displayName,
            companyId,
            event: existing === undefined ? 'template.create' : 'template.update',
            target: record.title,
          },
        ),
      );
      void pushTemplate(stored);
      return record;
    },
    [companyId, subject, user],
  );

  const deleteTemplate = useCallback<SessionValue['deleteTemplate']>(
    (id) => {
      const found = loadDb().templates.find((tpl) => tpl.id === id);
      if (found === undefined || !canEditTemplate(subject, found)) return;
      void removeTemplate(id);
      updateDb((cur) => {
        const target = cur.templates.find((tpl) => tpl.id === id);
        if (target === undefined) return cur;

        return appendAudit(
          {
            ...cur,
            templates: cur.templates.map((tpl) =>
              tpl.id === id ? trashed(tpl, user?.displayName ?? '') : tpl,
            ),
          },
          by(user, target.companyId, 'template.delete', target.title),
        );
      });
    },
    [subject, user],
  );

  const value = useMemo<SessionValue>(
    () => ({
      user,
      restoring,
      company: companyId === null ? null : (findCompanyIn(companyId) ?? null),
      companies,
      documents,
      allVisibleDocuments,
      employees,
      allEmployees: db.employees,
      users,
      audit,
      settings: db.settings,
      adminUnlocked,
      unlockAdmin,
      lockAdmin,
      signIn,
      signOut,
      signedOutForIdle,
      confirmPassword,
      selectCompany,
      saveDocument,
      syncDocument: flushDocument,
      numberTaken,
      deleteDocument,
      restoreDocument,
      purgeDocument,
      setDocumentGrant,
      archive,
      archiveDocuments,
      uploadArchiveFile,
      openArchiveFile,
      deleteArchiveFile,
      archiveBin,
      restoreArchiveFile,
      purgeArchiveFile,
      findDocument: (id) => {
        const found = loadDb().documents.find((d) => d.id === id);
        if (found === undefined) return undefined;
        // Удалённый документ открывается из корзины админ-панели: политика
        // пустит к нему только того, кто может его вернуть.
        const visible = visibleDocuments(subject, [found], { withDeleted: true })[0];
        const snapshot = visible?.companySnapshot;
        if (visible === undefined || snapshot?.logo === undefined) return visible;
        // В снимке – ссылка на картинку в общем хранилище; лист получает саму картинку.
        const logo = resolveImage(snapshot.logo);
        const { logo: _ref, ...rest } = snapshot;
        return { ...visible, companySnapshot: logo === undefined ? rest : { ...rest, logo } };
      },
      updateProfile,
      changePassword,
      createUser,
      updateUser,
      setUserPassword,
      removeUser,
      saveCompany,
      removeCompany,
      legacy,
      importLegacy: runImport,
      forgetLegacy,
      createEmployee,
      saveEmployee,
      removeEmployee,
      saveSettings,
      templates,
      findCompanyTemplate,
      editableTemplate,
      saveTemplate,
      deleteTemplate,
    }),
    [
      templates,
      findCompanyTemplate,
      editableTemplate,
      saveTemplate,
      deleteTemplate,
      user,
      restoring,
      companyId,
      companies,
      documents,
      allVisibleDocuments,
      employees,
      db.employees,
      users,
      audit,
      db.settings,
      adminUnlocked,
      unlockAdmin,
      lockAdmin,
      setDocumentGrant,
      archive,
      archiveDocuments,
      uploadArchiveFile,
      openArchiveFile,
      deleteArchiveFile,
      archiveBin,
      restoreArchiveFile,
      purgeArchiveFile,
      purgeDocument,
      db.companies,
      subject,
      signIn,
      signOut,
      signedOutForIdle,
      confirmPassword,
      selectCompany,
      saveDocument,
      numberTaken,
      deleteDocument,
      restoreDocument,
      updateProfile,
      changePassword,
      createUser,
      updateUser,
      setUserPassword,
      removeUser,
      saveCompany,
      removeCompany,
      legacy,
      runImport,
      forgetLegacy,
      createEmployee,
      saveEmployee,
      removeEmployee,
      saveSettings,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/**
 * Карточки людей, на которых ссылаются значения полей.
 *
 * Работник лежит в значениях идентификатором, и без снимка правка справочника
 * переписала бы уже выпущенный документ (CLAUDE.md, п. 3.4). Вписанное руками
 * ФИО идентификатором не является и в снимок не попадает: оно и так хранится
 * текстом.
 */
function peopleReferencedBy(
  values: Record<string, string>,
  companyId: string,
): Record<string, EmployeeBrief> {
  const snapshot: Record<string, EmployeeBrief> = {};

  // Значение может быть списком людей по строке на человека (члены
  // комиссии, «Тест день 4»): в снимок идёт каждый.
  for (const value of Object.values(values).flatMap((v) => v.split('\n'))) {
    if (value === '' || value in snapshot) continue;

    const person = findEmployeeIn(companyId, value);
    if (person !== undefined) snapshot[value] = { ...person };
  }

  return snapshot;
}

/** Размер части файла архива – как ArchivePartSize на сервере. */
const ARCHIVE_PART_SIZE = 768 * 1024;

/** Версия документа на сервере после действия без ответа-документа. */
function setVersion(id: string, lockVersion: number): void {
  updateDb((cur) => ({
    ...cur,
    documents: cur.documents.map((d) => (d.id === id ? { ...d, lockVersion } : d)),
  }));
}

/** Сервер отказал в действии над архивом: копию – заново. */
function resync(): void {
  void syncDocuments().catch(() => undefined);
}

/** Файл архива с сервера – в вид копии. */
function archiveCopy(file: ArchiveFile): ArchiveFile {
  const { deletedAt, deletedBy, ...rest } = file;
  return deletedAt === undefined || deletedAt === null ? rest : { ...rest, deletedAt, deletedBy: deletedBy ?? '' };
}

/**
 * Строка журнала от имени того, кто сейчас работает. Одна функция вместо
 * одинакового блока в каждом действии сессии.
 */
function by(user: User | null, companyId: string, event: string, target: string) {
  return { userId: user?.id ?? '', userName: user?.displayName ?? '', companyId, event, target };
}

/**
 * Снимок шаблона компании для записи документа.
 *
 * Выпущенный документ держит тот шаблон, по которому его выпустили: правка
 * сохранённого документа снимок не меняет. Черновик и новый документ берут
 * текущую версию шаблона. У шаблонов каталога снимка нет.
 */
function templateSnapshotFor(
  templateId: string,
  companyId: string,
  existing: DocumentRecord | undefined,
): { templateSnapshot?: DocumentTemplate } {
  if (existing?.status === 'saved' && existing.templateSnapshot !== undefined) {
    return { templateSnapshot: existing.templateSnapshot };
  }
  const custom = loadDb().templates.find(
    (tpl) => tpl.id === templateId && tpl.companyId === companyId && tpl.deletedAt === undefined,
  );
  if (custom !== undefined) return { templateSnapshot: toDocumentTemplate(custom) };
  return existing?.templateSnapshot === undefined ? {} : { templateSnapshot: existing.templateSnapshot };
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error('useSession вызван вне SessionProvider');
  }
  return value;
}
