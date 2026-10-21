import { canGrantDocument, canReceiveGrant, grantOf } from '@/access/policy';
import { t } from '@/i18n';
import { personName } from '@/i18n/person';
import { positionName } from '@/i18n/position';
import { useSession } from '@/store/session';

import styles from './DocumentAccess.module.css';

import type { DocumentRecord } from '@/api/types';

type Level = 'view' | 'edit';

export function DocumentAccess({ record }: { record: DocumentRecord }) {
  const { users, user, company, setDocumentGrant } = useSession();
  const subject = { user, companyId: company?.id ?? null };

  if (!canGrantDocument(subject, record)) return null;

  const candidates = users
    .filter((target) => canReceiveGrant(subject, record, target))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ru'));

  return (
    <section className={styles.access} aria-labelledby="document-access-title">
      <div id="document-access-title" className={styles.title}>
        {t.document.accessTitle}
      </div>
      <p className={styles.body}>{t.document.accessBody}</p>

      {candidates.length === 0 ? (
        <p className={styles.body}>{t.document.accessEmpty}</p>
      ) : (
        <ul className={styles.list}>
          {candidates.map((target) => (
            <li key={target.id} className={styles.row}>
              <span className={styles.person}>
                {personName(target.displayName)}
                {target.position === undefined || target.position === '' ? null : (
                  <span className={styles.position}>{positionName(target.position)}</span>
                )}
              </span>
              <select
                className={styles.level}
                aria-label={`${t.document.accessTitle}: ${personName(target.displayName)}`}
                value={grantOf(record, target.id)?.level ?? ''}
                onChange={(e) =>
                  setDocumentGrant(
                    record.id,
                    target.id,
                    e.target.value === '' ? null : (e.target.value as Level),
                  )
                }
              >
                <option value="">{t.document.accessNone}</option>
                <option value="view">{t.document.accessView}</option>
                <option value="edit">{t.document.accessEdit}</option>
              </select>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
