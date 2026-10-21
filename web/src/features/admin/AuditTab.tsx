/**
 * Вкладка «Журнал действий»: кто, что и когда.
 *
 * Часть админ-панели (`AdminPage.tsx`): что в ней видно, решает политика по
 * правам, а не проверка роли на экране.
 */

import { t } from '@/i18n';
import { companyName } from '@/i18n/company';
import { tc } from '@/i18n/content';
import { personName } from '@/i18n/person';
import { useSession } from '@/store/session';
import { cx } from '@/utils/cx';
import { formatDateTime } from '@/utils/format';
import { matchesQuery } from '@/utils/search';

import styles from './AdminPage.module.css';
import { auditSearchFields } from './searchFields';
import { NothingFound } from './shared';

import type { TabProps } from './shared';

export function AuditTab({ query }: TabProps) {
  const { audit, companies } = useSession();

  // Действие без компании – вход, настройки платформы, работа администратора
  // вне компании – помечается прочерком, а не пустой клеткой.
  const nameOf = (id: string) => {
    if (id === '') return t.registry.noValue;
    const found = companies.find((c) => c.id === id);
    return found === undefined ? id : companyName(found);
  };
  const eventName = (event: string) => t.admin.events[event] ?? event;

  const found = audit.filter((entry) => matchesQuery(query, auditSearchFields(entry, companies)));

  return (
    <section className={styles.section}>
      <p className={styles.sectionBody}>{t.admin.auditBody}</p>

      {audit.length === 0 ? (
        <p className={styles.muted}>{t.admin.auditEmpty}</p>
      ) : found.length === 0 ? (
        <NothingFound />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t.admin.auditWhen}</th>
              <th>{t.admin.auditWho}</th>
              <th>{t.admin.auditCompany}</th>
              <th>{t.admin.auditWhat}</th>
              <th>{t.admin.auditTarget}</th>
            </tr>
          </thead>
          <tbody>
            {found.map((entry) => (
              <tr key={entry.id}>
                <td className={cx(styles.muted, 'tabular')}>{formatDateTime(entry.at)}</td>
                <td>{personName(entry.userName)}</td>
                <td className={styles.muted}>{nameOf(entry.companyId)}</td>
                <td>{eventName(entry.event)}</td>
                <td className={styles.muted}>{tc(entry.target)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
