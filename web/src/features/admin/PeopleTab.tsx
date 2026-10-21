/**
 * Вкладка «Персонал»: люди компании для документов.
 *
 * С этапа 1б персонал – пользователи текущей компании на сервере: один
 * человек – одна запись (docs/plans/phase-01b-personnel.md). Другая
 * компания – переключателем компании. Что можно, решает сервер; экран лишь
 * не показывает кнопку, которая заведомо получит отказ.
 */
import { useState } from 'react';

import { canManageUser } from '@/access/policy';
import { lang, t } from '@/i18n';
import { useSession } from '@/store/session';
import { translateJobTitle } from '@/utils/jobTitles';
import { englishName, kazakhDative, withRussianSpelling } from '@/utils/names';
import { matchesQuery } from '@/utils/search';

import styles from './AdminPage.module.css';
import { employeeSearchFields } from './searchFields';
import { NothingFound } from './shared';

import type { EmployeeBrief } from '@/api/types';
import type { TabProps } from './shared';

/** Новый человек – карточка без идентификатора: его выдаст сервер. */
const NEW = '';

export function PeopleTab({ subject, query }: TabProps) {
  const { allEmployees, company, users, createEmployee, saveEmployee, removeEmployee } = useSession();
  const companyId = company?.id ?? '';

  const [draft, setDraft] = useState<EmployeeBrief | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Персонал текущей компании. Записи другой компании сюда не попадают
  // даже у администратора: смешать их значит подставить чужого человека
  // в приказ.
  const visible = allEmployees.filter(
    (e) => e.companyId === companyId && matchesQuery(query, employeeSearchFields(e)),
  );

  function open(next: EmployeeBrief | null) {
    setDraft(next);
    setLogin('');
    setPassword('');
    setError(null);
  }

  async function submit(card: EmployeeBrief) {
    setBusy(true);
    setError(null);
    const outcome =
      card.id === NEW
        ? await createEmployee({ ...card, login, password })
        : await saveEmployee(card);
    setBusy(false);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    open(null);
  }

  async function remove(person: EmployeeBrief) {
    if (!window.confirm(t.admin.personRemoveConfirm)) return;
    setBusy(true);
    setError(null);
    const outcome = await removeEmployee(person.id);
    setBusy(false);
    if (!outcome.ok) setError(outcome.message);
  }

  /** Убрать из компании можно тех же, чей доступ человек правит в «Пользователях». */
  const removable = (person: EmployeeBrief): boolean => {
    const account = users.find((u) => u.id === person.id);
    return account !== undefined && canManageUser(subject, account);
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <p className={styles.sectionBody}>{t.admin.peopleBody}</p>
        <button
          type="button"
          className={styles.primary}
          disabled={companyId === '' || busy}
          onClick={() =>
            open({ id: NEW, companyId, fullName: '', fullNameGenitive: '', position: '', unit: '' })
          }
        >
          {t.admin.personAdd}
        </button>
      </div>

      {error === null ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {draft === null ? null : (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            void submit({ ...draft, companyId });
          }}
        >
          <p className={styles.fieldHint}>{t.admin.personAutoHint}</p>
          {draft.id !== NEW ? null : (
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t.auth.login}</span>
                <input
                  className={styles.input}
                  value={login}
                  autoComplete="off"
                  required
                  onChange={(e) => setLogin(e.target.value)}
                />
                <span className={styles.fieldHint}>{t.admin.personLoginHint}</span>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>{t.auth.password}</span>
                <input
                  className={styles.input}
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span className={styles.fieldHint}>{t.admin.personPasswordHint}</span>
              </label>
            </div>
          )}
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t.admin.personFullName}</span>
              <input
                className={styles.input}
                value={draft.fullName}
                onChange={(e) => setDraft(withTranslations(draft, { fullName: e.target.value }))}
                onBlur={() => setDraft(withRussianSpelling(draft))}
              />
              <span className={styles.fieldHint}>{t.admin.personRussianHint}</span>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t.admin.personGenitive}</span>
              <input
                className={styles.input}
                value={draft.fullNameGenitive}
                onChange={(e) => setDraft({ ...draft, fullNameGenitive: e.target.value })}
                onBlur={() => setDraft(withRussianSpelling(draft))}
              />
              <span className={styles.fieldHint}>{t.admin.personGenitiveHint}</span>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t.admin.personNameKk}</span>
              <input
                className={styles.input}
                value={draft.fullNameKk ?? ''}
                onChange={(e) => setDraft(withTranslations(draft, { fullNameKk: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t.admin.personNameKkDative}</span>
              <input
                className={styles.input}
                value={draft.fullNameKkDative ?? ''}
                onChange={(e) => setDraft({ ...draft, fullNameKkDative: e.target.value })}
              />
              <span className={styles.fieldHint}>{t.admin.personNameKkDativeHint}</span>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t.admin.personNameEn}</span>
              <input
                className={styles.input}
                value={draft.fullNameEn ?? ''}
                onChange={(e) => setDraft({ ...draft, fullNameEn: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t.admin.personPosition}</span>
              <input
                className={styles.input}
                value={draft.position}
                onChange={(e) => setDraft(withTranslations(draft, { position: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t.admin.personPositionKk}</span>
              <input
                className={styles.input}
                value={draft.positionKk ?? ''}
                onChange={(e) => setDraft({ ...draft, positionKk: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t.admin.personPositionEn}</span>
              <input
                className={styles.input}
                value={draft.positionEn ?? ''}
                onChange={(e) => setDraft({ ...draft, positionEn: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t.admin.personUnit}</span>
              <input
                className={styles.input}
                value={draft.unit}
                onChange={(e) => setDraft(withTranslations(draft, { unit: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t.admin.personUnitKk}</span>
              <input
                className={styles.input}
                value={draft.unitKk ?? ''}
                onChange={(e) => setDraft({ ...draft, unitKk: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t.admin.personUnitEn}</span>
              <input
                className={styles.input}
                value={draft.unitEn ?? ''}
                onChange={(e) => setDraft({ ...draft, unitEn: e.target.value })}
              />
            </label>
          </div>

          <div className={styles.rowActions}>
            <button type="button" className={styles.secondary} disabled={busy} onClick={() => open(null)}>
              {t.common.cancel}
            </button>
            <button type="submit" className={styles.primary} disabled={busy}>
              {t.common.save}
            </button>
          </div>
        </form>
      )}

      {visible.length === 0 ? (
        <NothingFound />
      ) : (
        <table className={styles.table}>
          <thead>
            {/* На английском экране главное – английские значения: имя
                латиницей, должность и подразделение по-английски. Русская
                форма остаётся рядом – по ней человека находят в приказах. */}
            {lang === 'en' ? (
              <tr>
                <th>{t.admin.personFullName}</th>
                <th>{t.admin.personNameRu}</th>
                <th>{t.admin.personNameKk}</th>
                <th>{t.admin.personPosition}</th>
                <th>{t.admin.personUnit}</th>
                <th aria-label={t.common.remove} />
              </tr>
            ) : (
              <tr>
                <th>{t.admin.personFullName}</th>
                <th>{t.admin.personGenitive}</th>
                <th>{t.admin.personNameKk}</th>
                <th>{t.admin.personNameEn}</th>
                <th>{t.admin.personPosition}</th>
                <th>{t.admin.personUnit}</th>
                <th aria-label={t.common.remove} />
              </tr>
            )}
          </thead>
          <tbody>
            {visible.map((person) => (
              <tr key={person.id}>
                {/* Чего нет в карточке, показано так, как это соберёт документ:
                    казахское имя – как русское, латиница – транслитерацией,
                    должность и подразделение – из словаря. */}
                {lang === 'en' ? (
                  <>
                    <td>{person.fullNameEn ?? englishName(person.fullName)}</td>
                    <td className={styles.muted}>{person.fullName}</td>
                    <td className={styles.muted}>{person.fullNameKk ?? person.fullName}</td>
                    <td>{person.positionEn ?? translateJobTitle(person.position, 'en') ?? person.position}</td>
                    <td className={styles.muted}>
                      {person.unitEn ?? translateJobTitle(person.unit, 'en') ?? person.unit}
                    </td>
                  </>
                ) : (
                  <>
                    <td>{person.fullName}</td>
                    <td className={styles.muted}>{person.fullNameGenitive}</td>
                    <td className={styles.muted}>{person.fullNameKk ?? person.fullName}</td>
                    <td className={styles.muted}>{person.fullNameEn ?? englishName(person.fullName)}</td>
                    <td>
                      {person.position}
                      <div className={styles.muted}>
                        {[
                          person.positionKk ?? translateJobTitle(person.position, 'kk'),
                          person.positionEn ?? translateJobTitle(person.position, 'en'),
                        ]
                          .filter(Boolean)
                          .join(' / ')}
                      </div>
                    </td>
                    <td className={styles.muted}>
                      {person.unit}
                      <div>
                        {[
                          person.unitKk ?? translateJobTitle(person.unit, 'kk'),
                          person.unitEn ?? translateJobTitle(person.unit, 'en'),
                        ]
                          .filter(Boolean)
                          .join(' / ')}
                      </div>
                    </td>
                  </>
                )}
                <td>
                  <div className={styles.rowActions}>
                    <button type="button" className={styles.link} disabled={busy} onClick={() => open(person)}>
                      {t.common.edit}
                    </button>
                    {removable(person) ? (
                      <button
                        type="button"
                        className={styles.danger}
                        disabled={busy}
                        onClick={() => void remove(person)}
                      >
                        {t.common.remove}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * Правка карточки с автоматическими переводами.
 *
 * Меняется ФИО – латиница, казахское написание и дательный падеж
 * пересобираются; меняется должность или подразделение – казахский и
 * английский берутся из словаря. Перевод, который поправили руками, не
 * затирается: пересобирается только то, что было подставлено само.
 */
function withTranslations(draft: EmployeeBrief, patch: Partial<EmployeeBrief>): EmployeeBrief {
  const next: EmployeeBrief = { ...draft, ...patch };

  const replace = <K extends keyof EmployeeBrief>(key: K, before: string, after: string) => {
    const current = draft[key];
    if (current === undefined || current === '' || current === before) {
      (next as unknown as Record<string, unknown>)[key] = after;
    }
  };

  if (patch.fullName !== undefined) {
    replace('fullNameEn', englishName(draft.fullName), englishName(patch.fullName));
    replace('fullNameKk', draft.fullName, patch.fullName);
  }
  if (patch.fullName !== undefined || patch.fullNameKk !== undefined) {
    const kkBefore = draft.fullNameKk ?? draft.fullName;
    const kkAfter = next.fullNameKk ?? next.fullName;
    replace('fullNameKkDative', kazakhDative(kkBefore), kazakhDative(kkAfter));
  }
  if (patch.position !== undefined) {
    for (const [key, lang] of [['positionKk', 'kk'], ['positionEn', 'en']] as const) {
      replace(key, translateJobTitle(draft.position, lang) ?? '', translateJobTitle(patch.position, lang) ?? '');
    }
  }
  if (patch.unit !== undefined) {
    for (const [key, lang] of [['unitKk', 'kk'], ['unitEn', 'en']] as const) {
      replace(key, translateJobTitle(draft.unit, lang) ?? '', translateJobTitle(patch.unit, lang) ?? '');
    }
  }
  return next;
}
