/**
 * Вкладка «Документы»: все документы с корзиной и удалёнными файлами архива.
 *
 * Часть админ-панели (`AdminPage.tsx`): что в ней видно, решает политика по
 * правам, а не проверка роли на экране.
 */
import { Link } from 'react-router-dom';

import {
  canDeleteDocument,
  canEditDocument,
  canPurgeArchiveFile,
  canPurgeDocument,
  canRestoreArchiveFile,
  canRestoreDocument,
} from '@/access/policy';
import { ShowMoreButton, useShowMore } from '@/components/ShowMore/ShowMore';
import { StatusStamp } from '@/components/StatusStamp/StatusStamp';
import { searchDocuments } from '@/features/documents/search';
import { t } from '@/i18n';
import { companyName } from '@/i18n/company';
import { documentTitle } from '@/i18n/content';
import { documentSubject, personName } from '@/i18n/person';
import { useSession } from '@/store/session';
import { cx } from '@/utils/cx';
import { formatShortDate } from '@/utils/format';
import { matchesQuery } from '@/utils/search';

import styles from './AdminPage.module.css';
import { companyNames } from './searchFields';
import { NothingFound } from './shared';

import type { TabProps } from './shared';

export function DocumentsTab({ subject, query }: TabProps) {
  const { allVisibleDocuments, companies, deleteDocument, restoreDocument, purgeDocument } =
    useSession();

  // Документ компании, которую убрали из группы, лежит в корзине: вместо
  // идентификатора пишем, что компании больше нет.
  const nameOf = (id: string) => {
    const found = companies.find((c) => c.id === id);
    return found === undefined ? t.admin.companyGone : companyName(found);
  };
  const found = searchDocuments(allVisibleDocuments, query, (doc) =>
    companyNames(companies.find((c) => c.id === doc.companyId)),
  );
  // По сто строк: документы всех компаний – самый длинный список сайта.
  const more = useShowMore(found, query);

  return (
    <section className={styles.section}>
      <p className={styles.sectionBody}>{t.admin.documentsBody}</p>

      {allVisibleDocuments.length === 0 ? (
        <p className={styles.muted}>{t.admin.documentsEmpty}</p>
      ) : found.length === 0 ? (
        <NothingFound />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t.registry.columns.number}</th>
              <th>{t.registry.columns.title}</th>
              <th>{t.nav.company}</th>
              <th>{t.registry.columns.subject}</th>
              <th>{t.registry.columns.author}</th>
              <th>{t.registry.columns.status}</th>
              <th>{t.registry.columns.created}</th>
              <th aria-label={t.common.remove} />
            </tr>
          </thead>
          <tbody>
            {more.shown.map((doc) => (
              <tr key={doc.id} className={doc.deletedAt === undefined ? undefined : styles.gone}>
                <td className="tabular">{doc.number ?? t.registry.noNumber}</td>
                <td>
                  <Link className={styles.link} to={`/documents/${doc.id}`}>
                    {documentTitle(doc)}
                  </Link>
                </td>
                <td className={styles.muted}>{nameOf(doc.companyId)}</td>
                <td>{doc.subject === '' ? t.registry.noValue : documentSubject(doc)}</td>
                <td className={styles.muted}>{personName(doc.authorName)}</td>
                <td>
                  {doc.deletedAt === undefined ? (
                    <StatusStamp status={doc.status} size="sm" />
                  ) : (
                    <span className={styles.badge}>{t.admin.documentDeleted}</span>
                  )}
                </td>
                <td className={cx(styles.muted, 'tabular')}>{formatShortDate(doc.createdAt)}</td>
                <td>
                  <div className={styles.rowActions}>
                    {canEditDocument(subject, doc) ? (
                      <Link className={styles.link} to={`/create/${doc.templateId}?doc=${doc.id}`}>
                        {t.common.edit}
                      </Link>
                    ) : null}
                    {canDeleteDocument(subject, doc) ? (
                      <button
                        type="button"
                        className={styles.danger}
                        onClick={() => {
                          if (window.confirm(t.document.deleteConfirm)) deleteDocument(doc.id);
                        }}
                      >
                        {t.common.remove}
                      </button>
                    ) : null}
                    {canRestoreDocument(subject, doc) ? (
                      <button
                        type="button"
                        className={styles.link}
                        onClick={() => restoreDocument(doc.id)}
                      >
                        {t.document.restore}
                      </button>
                    ) : null}
                    {canPurgeDocument(subject, doc) ? (
                      <button
                        type="button"
                        className={styles.danger}
                        onClick={() => {
                          if (window.confirm(t.admin.purgeConfirm)) purgeDocument(doc.id);
                        }}
                      >
                        {t.admin.purge}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ShowMoreButton rest={more.rest} showMore={more.showMore} />

      <ArchiveBin subject={subject} query={query} nameOf={nameOf} />
    </section>
  );
}

/**
 * Удалённые файлы архива («Тест день 3»): в архиве их больше не видно,
 * здесь – вернуть или удалить навсегда. Пустая корзина не показывается.
 */
function ArchiveBin({ subject, query, nameOf }: TabProps & { nameOf: (id: string) => string }) {
  const { archiveBin, restoreArchiveFile, purgeArchiveFile } = useSession();

  const found = archiveBin.filter((file) =>
    matchesQuery(query, [
      file.title,
      file.number,
      file.description,
      file.fileName,
      file.uploadedByName,
      file.deletedBy,
      nameOf(file.companyId),
    ]),
  );

  if (archiveBin.length === 0) return null;

  return (
    <div className={styles.group}>
      <h3 className={styles.groupTitle}>
        {t.admin.binFilesTitle} <span className={cx(styles.muted, 'tabular')}>{archiveBin.length}</span>
      </h3>
      <p className={styles.sectionBody}>{t.admin.binFilesBody}</p>

      {found.length === 0 ? (
        <NothingFound />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t.archive.columns.number}</th>
              <th>{t.archive.columns.title}</th>
              <th>{t.nav.company}</th>
              <th>{t.archive.columns.date}</th>
              <th>{t.archive.columns.who}</th>
              <th aria-label={t.common.remove} />
            </tr>
          </thead>
          <tbody>
            {found.map((file) => (
              <tr key={file.id} className={styles.gone}>
                <td className="tabular">{file.number ?? t.registry.noNumber}</td>
                <td>
                  {file.title}
                  <div className={styles.muted}>{file.fileName}</div>
                </td>
                <td className={styles.muted}>{nameOf(file.companyId)}</td>
                <td className={cx(styles.muted, 'tabular')}>{formatShortDate(file.documentDate)}</td>
                <td className={styles.muted}>{personName(file.uploadedByName)}</td>
                <td>
                  <div className={styles.rowActions}>
                    {canRestoreArchiveFile(subject, file) ? (
                      <button
                        type="button"
                        className={styles.link}
                        onClick={() => restoreArchiveFile(file.id)}
                      >
                        {t.admin.restoreFile}
                      </button>
                    ) : null}
                    {canPurgeArchiveFile(subject, file) ? (
                      <button
                        type="button"
                        className={styles.danger}
                        onClick={() => {
                          if (window.confirm(t.admin.purgeFileConfirm)) void purgeArchiveFile(file.id);
                        }}
                      >
                        {t.admin.purge}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
