/**
 * Вкладка «Компании»: компании группы. Видна только администратору платформы.
 *
 * Часть админ-панели (`AdminPage.tsx`): что в ней видно, решает политика по
 * правам, а не проверка роли на экране.
 */
import { useState } from 'react';

import { t } from '@/i18n';
import { companyDirector, companyName } from '@/i18n/company';
import { newId } from '@/store/db';
import { useSession } from '@/store/session';
import { matchesQuery } from '@/utils/search';

import styles from './AdminPage.module.css';
import { companySearchFields } from './searchFields';
import { NothingFound } from './shared';

import type { Company } from '@/api/types';
import type { TabProps } from './shared';

export function CompaniesTab({ query }: TabProps) {
  const { companies, saveCompany, removeCompany } = useSession();
  // Новую компанию сервер заводит только с наименованием и верным БИН:
  // остальные реквизиты правятся на странице компании.
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [bin, setBin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const found = companies.filter((c) => matchesQuery(query, companySearchFields(c)));

  async function addCompany() {
    setBusy(true);
    setError(null);
    const outcome = await saveCompany({
      id: newId('c'),
      name: name.trim(),
      legalName: name.trim(),
      bin: bin.trim(),
      address: '',
      directorName: '',
      directorTitle: 'Директор',
      directorTitleGenitive: 'Директора',
      directorNameGenitive: '',
      directorBasis: 'Устава',
      city: '',
      accent: '#2f3b8f',
      monogram: 'НК',
      // Реквизитов ещё нет: пометка условных данных стоит сразу, чтобы от
      // имени такой компании не выпустили документ.
      placeholder: true,
    });
    setBusy(false);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    setAdding(false);
    setName('');
    setBin('');
  }

  async function remove(company: Company) {
    if (!window.confirm(t.admin.companyRemoveConfirm)) return;
    setError(null);
    const outcome = await removeCompany(company.id);
    if (!outcome.ok) setError(outcome.message);
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <p className={styles.sectionBody}>{t.admin.companiesBody}</p>
        <button type="button" className={styles.primary} onClick={() => setAdding(!adding)}>
          {t.admin.companyAdd}
        </button>
      </div>

      {adding ? (
        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            void addCompany();
          }}
        >
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t.company.shortName}</span>
              <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t.company.bin}</span>
              <input
                className={styles.input}
                inputMode="numeric"
                maxLength={12}
                value={bin}
                onChange={(e) => setBin(e.target.value)}
              />
            </label>
          </div>
          <div className={styles.rowActions}>
            <button type="submit" className={styles.primary} disabled={busy}>
              {t.common.save}
            </button>
            <button type="button" className={styles.secondary} onClick={() => setAdding(false)}>
              {t.common.cancel}
            </button>
          </div>
        </form>
      ) : null}

      {error === null ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {found.length === 0 ? (
        <NothingFound />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t.company.shortName}</th>
              <th>{t.company.bin}</th>
              <th>{t.company.director}</th>
              <th aria-label={t.common.remove} />
            </tr>
          </thead>
          <tbody>
            {found.map((company: Company) => (
              <tr key={company.id}>
                <td>
                  {companyName(company)}
                  {company.placeholder === true ? (
                    <span className={styles.badge}>{t.auth.companyPlaceholder}</span>
                  ) : null}
                </td>
                <td className="tabular">{company.bin === '' ? t.company.missing : company.bin}</td>
                <td>{company.directorName === '' ? t.company.missing : companyDirector(company)}</td>
                <td>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.danger}
                      onClick={() => void remove(company)}
                    >
                      {t.common.remove}
                    </button>
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
