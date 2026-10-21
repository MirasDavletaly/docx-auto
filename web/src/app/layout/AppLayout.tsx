/**
 * Оболочка рабочих экранов: «стол», на котором лежит документ.
 *
 * Боковая панель тёмная и плотная — она не должна спорить с листом за
 * внимание. Всё светлое пространство справа принадлежит документу.
 */
import { useSyncExternalStore } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { can, canUseSection } from '@/access/policy';
import { sections } from '@/api/mock/sections';
import { LanguageSwitch } from '@/components/LanguageSwitch/LanguageSwitch';
import { t } from '@/i18n';
import { companyName } from '@/i18n/company';
import { tc } from '@/i18n/content';
import { personName } from '@/i18n/person';
import { storageFailing, subscribeDb } from '@/store/db';
import { dismissProblem, subscribeSync, syncStatus } from '@/store/documentsSync';
import { useSession } from '@/store/session';
import { cx } from '@/utils/cx';

import styles from './AppLayout.module.css';

export function AppLayout() {
  const { company, user, companies, signOut, selectCompany } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  // Запись в хранилище браузера не прошла: всё, что сделано после этого,
  // пропадёт при перезагрузке. Человек должен узнать об этом сразу.
  const storageFull = useSyncExternalStore(subscribeDb, storageFailing);
  // Документы уходят на сервер очередью: нет связи или отказ – видно сразу.
  const sync = useSyncExternalStore(subscribeSync, syncStatus);

  if (company === null || user === null) return null;

  // У кого компаний несколько – администратор или сотрудник, – для того
  // логотип в углу – переключатель: возвращает на выбор компании (16.10).
  // У кого компания одна, переключать нечего: логотип ведёт на её реквизиты.
  const switchesCompany = companies.length > 1;

  function handleCompanyClick() {
    if (switchesCompany) {
      void selectCompany('');
      navigate('/choose-company');
      return;
    }
    navigate('/company');
  }

  /**
   * Раздел выбран, только если он стоит в адресе.
   *
   * `NavLink` сравнивает лишь путь и не смотрит на строку запроса, поэтому
   * на `/create` подсвечивались сразу все разделы: у всех ссылок путь
   * одинаковый, а различает их `?section=`.
   */
  const activeSection = location.pathname === '/create' ? params.get('section') : null;

  const allowedSections = sections.filter((section) => canUseSection(user, section.id));
  const showAdmin = can({ user, companyId: company.id }, 'admin.panel');
  const seesAll = can({ user, companyId: company.id }, 'documents.viewAll');

  return (
    <div className={styles.shell}>
      <nav className={`${styles.rail} no-print`} aria-label={t.nav.sections}>
        <button
          type="button"
          className={styles.company}
          onClick={handleCompanyClick}
          title={switchesCompany ? t.nav.switchCompany : t.nav.requisites}
        >
          {/* Логотип на белой подложке: в присланных файлах фон у части
              компаний прозрачный, у части белый, и на тёмной панели без
              подложки одни выглядели бы вырезанными, другие – заплаткой.
              Логотипы у группы словесные, поэтому название под ними не
              повторяется: его заменяет подпись «Компания». */}
          {company.logo === undefined ? (
            <>
              <span className={styles.companyMark} aria-hidden="true">
                {company.monogram}
              </span>
              <span className={styles.companyText}>
                <span className={styles.companyName}>{companyName(company)}</span>
                <span className={styles.companyHint}>{t.nav.company}</span>
              </span>
            </>
          ) : (
            <span className={styles.companyText}>
              <span className={styles.companyLogoBox}>
                <img className={styles.companyLogo} src={company.logo} alt={companyName(company)} />
              </span>
              <span className={styles.companyHint}>{t.nav.company}</span>
            </span>
          )}
        </button>

        <NavLink to="/create" className={cx(styles.primary)}>
          <span className={styles.primaryPlus} aria-hidden="true">
            +
          </span>
          {t.nav.create}
        </NavLink>

        <ul className={styles.mainNav}>
          <li>
            <NavLink to="/" end className={navClass}>
              {t.dashboard.title}
            </NavLink>
          </li>
          <li>
            <NavLink to="/documents" className={navClass}>
              {seesAll ? t.nav.companyDocuments : t.nav.myDocuments}
            </NavLink>
          </li>
          <li>
            <NavLink to="/archive" className={navClass}>
              {t.nav.archive}
            </NavLink>
          </li>
          <li>
            <NavLink to="/company" className={navClass}>
              {t.nav.requisites}
            </NavLink>
          </li>
          {showAdmin ? (
            <li>
              <NavLink to="/admin" className={navClass}>
                {t.nav.admin}
              </NavLink>
            </li>
          ) : null}
        </ul>

        {allowedSections.length === 0 ? null : (
          <div className={styles.railGroup}>
            <div className={styles.railGroupTitle}>{t.nav.sections}</div>
            <ul className={styles.sectionNav}>
              {allowedSections.map((section) => (
                <li key={section.id}>
                  <NavLink
                    to={`/create?section=${section.id}`}
                    className={cx(
                      styles.navItem,
                      activeSection === section.id && styles.navItemActive,
                    )}
                  >
                    {tc(section.short)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.railFooter}>
          <div className={styles.language}>
            <LanguageSwitch />
          </div>

          <NavLink to="/profile" className={cx(styles.user)}>
            <span className={styles.avatar} aria-hidden="true">
              {user.avatar === undefined ? (
                initials(personName(user.displayName))
              ) : (
                <img className={styles.avatarImage} src={user.avatar} alt="" />
              )}
            </span>
            <span className={styles.userText}>
              <span className={styles.userName}>{personName(user.displayName)}</span>
              <span className={styles.userLogin}>{t.nav.profile}</span>
            </span>
          </NavLink>

          <button type="button" className={styles.logout} onClick={signOut}>
            {t.nav.logout}
          </button>
        </div>
      </nav>

      <div className={styles.work}>
        {storageFull ? (
          <div className={styles.storageFull} role="alert">
            <div className={styles.storageFullTitle}>{t.app.storageFullTitle}</div>
            <p className={styles.storageFullBody}>{t.app.storageFullBody}</p>
          </div>
        ) : null}
        {sync.offline && sync.unsynced > 0 ? (
          <div className={styles.syncNotice} role="status">
            {t.sync.offlineBanner}
          </div>
        ) : null}
        {sync.problem === null ? null : (
          <div className={styles.syncProblem} role="alert">
            <span>
              {sync.problem.reason === 'conflict' ? t.sync.conflictBanner : t.sync.rejectedBanner}
              {sync.problem.message === '' ? null : ` ${sync.problem.message}`}
            </span>
            <button type="button" className={styles.syncDismiss} onClick={dismissProblem}>
              {t.sync.dismiss}
            </button>
          </div>
        )}
        <Outlet />
      </div>
    </div>
  );
}

function navClass({ isActive }: { isActive: boolean }): string {
  return cx(styles.navItem, isActive && styles.navItemActive);
}

/** Буквы в кружке, пока фотографии нет. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
