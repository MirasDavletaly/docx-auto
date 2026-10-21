/**
 * Админ-панель.
 *
 * Отдельная страница со своим входом: пароль спрашивается ещё раз, чтобы
 * в неё нельзя было попасть случайно, оставив открытой вкладку. Спрашивается
 * один раз до следующего входа – переключение языка или переход на другой
 * экран панель не закрывают («Тест день 2»).
 *
 * Панель одна на администратора и директора, а что в ней видно, решает
 * политика по правам. Администратор работает со всей группой. Директор –
 * только со своей компанией: сотрудники и их доступ, персонал, документы,
 * журнал. Списка компаний группы и настроек платформы у директора нет.
 *
 * Пароль, учётные записи и компании проверяет и хранит сервер (этап 1а).
 * ЧЕГО ЭТА СТРАНИЦА ПОКА НЕ ДЕЛАЕТ: документы, персонал, шаблоны и архив до
 * этапа 1б лежат в браузере, и их здесь ничто не защищает от того, у кого
 * есть доступ к этому браузеру. Ограничение входа по адресу только хранится
 * (TODO(phase-01): проверка IP на сервере).
 */
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { can } from '@/access/policy';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { t } from '@/i18n';
import { useSession } from '@/store/session';
import { cx } from '@/utils/cx';

import styles from './AdminPage.module.css';
import { AuditTab } from './AuditTab';
import { CompaniesTab } from './CompaniesTab';
import { DocumentsTab } from './DocumentsTab';
import { ImportCard } from './ImportCard';
import { PeopleTab } from './PeopleTab';
import { SettingsTab } from './SettingsTab';
import { UsersTab } from './UsersTab';

import type { Subject } from '@/access/policy';
import type { Action } from '@/api/types';

type Tab = 'companies' | 'users' | 'people' | 'documents' | 'audit' | 'settings';

/** Вкладка видна тому, у кого есть право. Роль на экране не проверяется. */
const TABS: Array<{ id: Tab; action: Action; title: () => string }> = [
  { id: 'companies', action: 'company.create', title: () => t.admin.tabCompanies },
  { id: 'users', action: 'people.manage', title: () => t.admin.tabUsers },
  { id: 'people', action: 'people.manage', title: () => t.admin.tabPeople },
  { id: 'documents', action: 'documents.viewAll', title: () => t.admin.tabDocuments },
  { id: 'audit', action: 'audit.view', title: () => t.admin.tabAudit },
  { id: 'settings', action: 'settings.manage', title: () => t.admin.tabSettings },
];

export default function AdminPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const subject: Subject = { user: session.user, companyId: session.company?.id ?? null };

  if (!can(subject, 'admin.panel')) {
    return (
      <div className={styles.denied}>
        <h1>{t.errors.noAccessTitle}</h1>
        <p>{t.errors.noAccessBody}</p>
        <Link to="/">{t.errors.notFoundAction}</Link>
      </div>
    );
  }

  if (!session.adminUnlocked) return <PasswordGate onUnlock={session.unlockAdmin} />;

  const tabs = TABS.filter((item) => can(subject, item.action));
  // Вкладка и запрос живут в адресе: переключение языка перерисовывает
  // страницу, и человек остаётся там же, где был.
  const tab = tabs.find((item) => item.id === params.get('tab'))?.id ?? tabs[0]?.id;
  const query = params.get('q') ?? '';

  function setTab(next: Tab) {
    params.set('tab', next);
    params.delete('q');
    setParams(params, { replace: true });
  }

  function setQuery(next: string) {
    if (next === '') params.delete('q');
    else params.set('q', next);
    setParams(params, { replace: true });
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={t.admin.title}
        subtitle={can(subject, 'company.create') ? t.admin.subtitle : t.admin.subtitleCompany}
        actions={
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              session.lockAdmin();
              navigate('/');
            }}
          >
            {t.admin.leave}
          </button>
        }
      />

      <div className={styles.tabsRow}>
        <div className={styles.tabs} role="tablist">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={cx(styles.tab, tab === item.id && styles.tabActive)}
              onClick={() => setTab(item.id)}
            >
              {item.title()}
            </button>
          ))}
        </div>

        <input
          className={styles.search}
          type="search"
          value={query}
          placeholder={t.admin.search}
          aria-label={t.admin.search}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.body}>
        {session.legacy !== null && can(subject, 'company.create') ? (
          <ImportCard legacy={session.legacy} />
        ) : null}

        {tab === 'companies' ? <CompaniesTab subject={subject} query={query} /> : null}
        {tab === 'users' ? <UsersTab subject={subject} query={query} /> : null}
        {tab === 'people' ? <PeopleTab subject={subject} query={query} /> : null}
        {tab === 'documents' ? <DocumentsTab subject={subject} query={query} /> : null}
        {tab === 'audit' ? <AuditTab subject={subject} query={query} /> : null}
        {tab === 'settings' ? <SettingsTab /> : null}
      </div>
    </div>
  );
}

/** Повторная проверка пароля того же аккаунта: панель не открывается случайно. */
function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const { confirmPassword } = useSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className={styles.gate}>
      <form
        className={styles.gateForm}
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void confirmPassword(password).then((ok) => {
            setBusy(false);
            if (ok) onUnlock();
            else setError(true);
          });
        }}
      >
        <h1 className={styles.gateTitle}>{t.admin.confirmTitle}</h1>
        <p className={styles.gateBody}>{t.admin.confirmBody}</p>

        <input
          className={styles.input}
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => {
            setError(false);
            setPassword(e.target.value);
          }}
        />

        {error ? (
          <p className={styles.error} role="alert">
            {t.admin.confirmFailed}
          </p>
        ) : null}

        <button type="submit" className={styles.primary} disabled={busy}>
          {t.admin.confirmSubmit}
        </button>
      </form>
    </div>
  );
}
