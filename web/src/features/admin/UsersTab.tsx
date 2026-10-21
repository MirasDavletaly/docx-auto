/**
 * Вкладка «Пользователи»: учётные записи, роли, разделы и доступ к шаблонам.
 *
 * Часть админ-панели (`AdminPage.tsx`): что в ней видно, решает политика по
 * правам, а не проверка роли на экране.
 */
import { useState } from 'react';

import {
  assignableRoles,
  can,
  canManageUser,
  grantableActions,
  managedCompanyIds,
} from '@/access/policy';
import { roles } from '@/api/mock/roles';
import { sections } from '@/api/mock/sections';
import { t } from '@/i18n';
import { companyName } from '@/i18n/company';
import { tc } from '@/i18n/content';
import { personName } from '@/i18n/person';
import { positionName } from '@/i18n/position';
import { MIN_PASSWORD_LENGTH } from '@/store/password';
import { useSession } from '@/store/session';
import { cx } from '@/utils/cx';
import { matchesQuery } from '@/utils/search';

import styles from './AdminPage.module.css';
import { userSearchFields } from './searchFields';
import { NothingFound } from './shared';

import type { Subject } from '@/access/policy';
import type { Outcome } from '@/store/session';
import type { Action, RoleId, User } from '@/api/types';
import type { TabProps } from './shared';

function roleTitle(id: RoleId): string {
  return tc(roles.find((r) => r.id === id)?.title ?? id);
}

/** Названия разделов через запятую; у директора и администратора – «все». */
function sectionNames(user: User, ids: string[]): string {
  if (user.role !== 'employee') return t.admin.userAllSections;
  const names = sections.filter((s) => ids.includes(s.id)).map((s) => tc(s.short));
  return names.length === 0 ? t.admin.userNone : names.join(', ');
}

type UserFormState = { mode: 'create' } | { mode: 'edit'; user: User };

export function UsersTab({ subject, query }: TabProps) {
  const { users, companies, updateUser, removeUser, setUserPassword } = useSession();
  const [form, setForm] = useState<UserFormState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Действие на сервере: удалось – сообщение, нет – причина. */
  async function act(run: () => Promise<Outcome>, done?: string) {
    setMessage(null);
    setError(null);
    const outcome = await run();
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    if (done !== undefined) setMessage(done);
  }

  const adminCount = users.filter((u) => u.role === 'platform-admin').length;
  const companiesOf = (user: User) =>
    user.role === 'platform-admin'
      ? t.common.all
      : companies
          .filter((c) => user.companyIds.includes(c.id))
          .map(companyName)
          .join(', ') || t.common.none;

  const found = users.filter((u) => matchesQuery(query, userSearchFields(u, companies)));

  // Список по ролям: администраторы, директора, работники («Тест день 2»).
  const groups = roles
    .map((role) => ({ role, members: found.filter((u) => u.role === role.id) }))
    .filter((group) => group.members.length > 0);

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <p className={styles.sectionBody}>{t.admin.usersBody}</p>
        {assignableRoles(subject).length === 0 ? null : (
          <button
            type="button"
            className={styles.primary}
            onClick={() => setForm(form?.mode === 'create' ? null : { mode: 'create' })}
          >
            {t.admin.userAdd}
          </button>
        )}
      </div>

      {form === null ? null : (
        <UserForm
          key={form.mode === 'edit' ? form.user.id : 'create'}
          subject={subject}
          state={form}
          onCancel={() => setForm(null)}
          onDone={(text) => {
            setMessage(text);
            setForm(null);
          }}
        />
      )}

      {message === null ? null : <p className={styles.ok}>{message}</p>}
      {error === null ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {groups.length === 0 ? <NothingFound /> : null}

      {groups.map(({ role, members }) => (
        <div key={role.id} className={styles.group}>
          <h3 className={styles.groupTitle}>
            {roleTitle(role.id)} <span className={cx(styles.muted, 'tabular')}>{members.length}</span>
          </h3>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t.auth.login}</th>
                <th>{t.profile.displayName}</th>
                <th>{t.admin.userCompanies}</th>
                <th>{t.admin.userSections}</th>
                <th>{t.admin.userViewSections}</th>
                <th aria-label={t.common.edit} />
              </tr>
            </thead>
            <tbody>
              {members.map((user) => {
                const lastAdmin = user.role === 'platform-admin' && adminCount === 1;
                const manageable = canManageUser(subject, user);

                return (
                  <tr key={user.id}>
                    <td className="tabular">{user.login}</td>
                    <td>
                      {personName(user.displayName)}
                      {user.position === undefined || user.position === '' ? null : (
                        <div className={styles.muted}>{positionName(user.position)}</div>
                      )}
                      {user.blocked === true ? (
                        <span className={styles.badge}>{t.admin.userBlocked}</span>
                      ) : null}
                      {user.hasPassword === false ? (
                        <span className={styles.badge}>{t.admin.userNoPassword}</span>
                      ) : null}
                      {user.grantedActions?.includes('templates.create') === true ? (
                        <span className={styles.badge} title={t.templates.grantLabel}>
                          {t.templates.grantBadge}
                        </span>
                      ) : null}
                    </td>
                    <td className={styles.muted}>{companiesOf(user)}</td>
                    <td className={styles.muted}>{sectionNames(user, user.sectionIds)}</td>
                    <td className={styles.muted}>
                      {sectionNames(user, user.viewSectionIds ?? [])}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        {manageable ? (
                          <>
                            <button
                              type="button"
                              className={styles.link}
                              onClick={() => setForm({ mode: 'edit', user })}
                            >
                              {t.admin.userAccess}
                            </button>
                            <button
                              type="button"
                              className={styles.link}
                              onClick={() => {
                                const next = window.prompt(t.admin.userResetPassword);
                                if (next === null) return;
                                if (next.length < MIN_PASSWORD_LENGTH) {
                                  setMessage(t.auth.passwordTooShort);
                                  return;
                                }
                                void act(
                                  () => setUserPassword(user.id, next),
                                  t.admin.userPasswordSet,
                                );
                              }}
                            >
                              {t.admin.userResetPassword}
                            </button>
                            <button
                              type="button"
                              className={styles.link}
                              onClick={() =>
                                void act(() => updateUser(user.id, { blocked: user.blocked !== true }))
                              }
                            >
                              {user.blocked === true ? t.admin.userUnblock : t.admin.userBlock}
                            </button>
                            <button
                              type="button"
                              className={styles.danger}
                              disabled={lastAdmin}
                              title={lastAdmin ? t.admin.userLastAdmin : undefined}
                              onClick={() => {
                                if (window.confirm(t.admin.userRemoveConfirm)) {
                                  void act(() => removeUser(user.id));
                                }
                              }}
                            >
                              {t.common.remove}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

/**
 * Сотрудник: новая учётная запись или доступ существующей.
 *
 * Роли и компании в списках – только те, что человек может выдавать
 * (`assignableRoles`, `managedCompanyIds`). Сессия проверяет то же самое
 * ещё раз при сохранении.
 */
function UserForm({
  subject,
  state,
  onDone,
  onCancel,
}: {
  subject: Subject;
  state: UserFormState;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const { companies, createUser, updateUser } = useSession();
  const editing = state.mode === 'edit' ? state.user : null;

  const scope = managedCompanyIds(subject);
  const ownCompanies = companies.filter((c) => scope === null || scope.includes(c.id));
  const roleChoices = assignableRoles(subject);

  // Логин при правке меняет только тот, у кого право users.login (16.10 –
  // администратор платформы); при создании его задаёт каждый, кто заводит.
  const canChangeLogin = can(subject, 'users.login');
  const [login, setLogin] = useState(editing?.login ?? '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(editing?.displayName ?? '');
  const [position, setPosition] = useState(editing?.position ?? '');
  const [role, setRole] = useState<RoleId>(editing?.role ?? roleChoices.at(-1) ?? 'employee');
  const [companyIds, setCompanyIds] = useState<string[]>(
    editing?.companyIds ?? (ownCompanies.length === 1 ? ownCompanies.map((c) => c.id) : []),
  );
  const [sectionIds, setSectionIds] = useState<string[]>(editing?.sectionIds ?? []);
  const [viewSectionIds, setViewSectionIds] = useState<string[]>(editing?.viewSectionIds ?? []);
  // Доступ к конструктору шаблонов выдают директор и администратор
  // («Тест день 3»); у них самих он есть по роли.
  const canGrantTemplates = grantableActions(subject).includes('templates.create');
  const [templateAccess, setTemplateAccess] = useState(
    editing?.grantedActions?.includes('templates.create') === true,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  async function submit() {
    setError(null);

    const chosen = companyIds.filter((id) => ownCompanies.some((c) => c.id === id));
    if (role !== 'platform-admin' && chosen.length === 0) {
      setError(t.admin.userNoCompanies);
      return;
    }

    const access = {
      role,
      companyIds: role === 'platform-admin' ? [] : companyIds,
      sectionIds: role === 'employee' ? sectionIds : [],
      viewSectionIds: role === 'employee' ? viewSectionIds : [],
      ...(canGrantTemplates
        ? {
            grantedActions:
              role === 'employee' && templateAccess ? (['templates.create'] as Action[]) : [],
          }
        : {}),
    };

    if (editing !== null) {
      const newLogin = canChangeLogin && login.trim() !== editing.login;
      if (newLogin && login.trim().length < 4) {
        setError(t.auth.loginTooShort);
        return;
      }
      setBusy(true);
      const outcome = await updateUser(editing.id, {
        ...access,
        displayName,
        ...(newLogin ? { login: login.trim() } : {}),
      });
      setBusy(false);
      if (!outcome.ok) {
        setError(outcome.field === 'login' ? t.auth.loginTaken : outcome.message);
        return;
      }
      onDone(t.admin.userAccessSaved);
      return;
    }

    if (login.trim().length < 4) {
      setError(t.auth.loginTooShort);
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t.auth.passwordTooShort);
      return;
    }

    setBusy(true);
    const result = await createUser({
      login,
      displayName: displayName.trim() === '' ? login.trim() : displayName,
      password,
      ...access,
      ...(position.trim() === '' ? {} : { position: position.trim() }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.reason === 'login-taken' ? t.auth.loginTaken : result.message);
      return;
    }
    onDone(t.admin.userCreated);
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className={styles.fieldLabel}>
        {editing === null ? t.admin.userAdd : `${t.admin.userAccessTitle}: ${editing.login}`}
      </div>

      <div className={styles.formGrid}>
        {editing === null || canChangeLogin ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t.auth.login}</span>
            <input className={styles.input} value={login} onChange={(e) => setLogin(e.target.value)} />
          </label>
        ) : null}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t.profile.displayName}</span>
          <input
            className={styles.input}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t.profile.position}</span>
          {/* Должность – в карточке персонала, своя в каждой компании; здесь
              она задаётся только при создании. */}
          <input
            className={styles.input}
            value={position}
            readOnly={editing !== null}
            onChange={(e) => setPosition(e.target.value)}
          />
          {editing === null ? null : <span className={styles.fieldHint}>{t.profile.positionNote}</span>}
        </label>

        {editing === null ? (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>{t.auth.password}</span>
            <input
              className={styles.input}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        ) : null}

        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t.admin.userRole}</span>
          <select
            className={styles.input}
            value={role}
            disabled={roleChoices.length < 2}
            onChange={(e) => setRole(e.target.value as RoleId)}
          >
            {roleChoices.map((id) => (
              <option key={id} value={id}>
                {roleTitle(id)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className={styles.roleNote}>{tc(roles.find((r) => r.id === role)?.description ?? '')}</p>

      {role === 'platform-admin' ? null : (
        <fieldset className={styles.check}>
          <legend className={styles.fieldLabel}>{t.admin.userCompanies}</legend>
          <div className={styles.checkList}>
            {ownCompanies.map((company) => (
              <label key={company.id} className={styles.checkItem}>
                <input
                  type="checkbox"
                  checked={companyIds.includes(company.id)}
                  onChange={() => setCompanyIds((prev) => toggle(prev, company.id))}
                />
                {companyName(company)}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {role === 'employee' ? (
        <>
          <fieldset className={styles.check}>
            <legend className={styles.fieldLabel}>{t.admin.userSections}</legend>
            <p className={styles.sectionBody}>{t.admin.userSectionsHint}</p>
            <div className={styles.checkList}>
              {sections.map((section) => (
                <label key={section.id} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={sectionIds.includes(section.id)}
                    onChange={() => setSectionIds((prev) => toggle(prev, section.id))}
                  />
                  {tc(section.short)}
                </label>
              ))}
            </div>
          </fieldset>

          {canGrantTemplates ? (
            <label className={styles.checkItem}>
              <input
                type="checkbox"
                checked={templateAccess}
                onChange={(e) => setTemplateAccess(e.target.checked)}
              />
              <span>
                {t.templates.grantLabel}
                <span className={styles.fieldHint}> – {t.templates.grantHint}</span>
              </span>
            </label>
          ) : null}

          <fieldset className={styles.check}>
            <legend className={styles.fieldLabel}>{t.admin.userViewSections}</legend>
            <p className={styles.sectionBody}>{t.admin.userViewSectionsHint}</p>
            <div className={styles.checkList}>
              {sections.map((section) => (
                <label key={section.id} className={styles.checkItem}>
                  <input
                    type="checkbox"
                    checked={viewSectionIds.includes(section.id)}
                    onChange={() => setViewSectionIds((prev) => toggle(prev, section.id))}
                  />
                  {tc(section.short)}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}

      {error === null ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.rowActions}>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          {t.common.cancel}
        </button>
        <button type="submit" className={styles.primary} disabled={busy}>
          {editing === null ? t.common.add : t.common.save}
        </button>
      </div>
    </form>
  );
}
