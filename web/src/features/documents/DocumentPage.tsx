/**
 * Страница сохранённого документа.
 *
 * Здесь документ существует как предмет: лист, состояние, реквизиты и
 * действия — распечатать, исправить, удалить. Печатается ровно тот лист,
 * который человек видел при заполнении (styles/print.css оставляет на бумаге
 * только его).
 *
 * Лист собирается из снимка реквизитов компании, а не из текущих значений:
 * смена директора или адреса не должна переписывать уже выпущенные приказы
 * задним числом (CLAUDE.md, п. 3.4). У черновика снимка нет — он ещё не
 * выпущен и показывает то, что есть у компании сейчас.
 */
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  canDeleteDocument,
  canEditDocument,
  canPurgeDocument,
  canRestoreDocument,
} from '@/access/policy';
import { findTemplate } from '@/api/mock/templates';
import { DocumentSheet } from '@/components/DocumentSheet/DocumentSheet';
import { SheetViewport } from '@/components/DocumentSheet/SheetViewport';
import { StatusStamp } from '@/components/StatusStamp/StatusStamp';
import { t } from '@/i18n';
import { companyName } from '@/i18n/company';
import { documentTitle } from '@/i18n/content';
import { documentSubject, personName } from '@/i18n/person';
import { useSession } from '@/store/session';
import { formatDateTime } from '@/utils/format';

import { DocumentAccess } from './DocumentAccess';
import { exportPdf, pdfFileName } from './exportPdf';

import styles from './DocumentPage.module.css';

export default function DocumentPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const {
    findDocument,
    findCompanyTemplate,
    company,
    user,
    deleteDocument,
    restoreDocument,
    purgeDocument,
  } = useSession();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfFailed, setPdfFailed] = useState(false);

  const record = documentId === undefined ? undefined : findDocument(documentId);
  const template =
    record === undefined
      ? undefined
      : (findTemplate(record.templateId) ?? findCompanyTemplate(record.templateId, record));

  if (record === undefined || template === undefined || company === null) {
    return (
      <div className={styles.missing}>
        <h1>{t.errors.documentNotFound}</h1>
        <Link to="/documents">{t.document.back}</Link>
      </div>
    );
  }

  const subject = { user, companyId: company.id };
  const justSaved = params.get('saved') === '1';
  const isDraft = record.status === 'draft';

  // Снимок реквизитов на момент сохранения. У черновика его нет.
  const sheetCompany = record.companySnapshot ?? company;
  const requisitesFrozen = record.companySnapshot !== undefined;

  async function downloadPdf() {
    const root = sheetRef.current;
    if (root === null || record === undefined) return;

    setPdfBusy(true);
    setPdfFailed(false);
    try {
      const title = documentTitle(record);
      await exportPdf(root, pdfFileName(title, record.number), title);
    } catch {
      setPdfFailed(true);
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={`${styles.bar} no-print`}>
        <Link className={styles.back} to="/documents">
          ← {t.document.back}
        </Link>

        <div className={styles.barActions}>
          {canEditDocument(subject, record) ? (
            <Link className={styles.edit} to={`/create/${record.templateId}?doc=${record.id}`}>
              {t.document.edit}
            </Link>
          ) : null}

          {canRestoreDocument(subject, record) ? (
            <button
              type="button"
              className={styles.edit}
              onClick={() => {
                restoreDocument(record.id);
                navigate(`/documents/${record.id}`, { replace: true });
              }}
            >
              {t.document.restore}
            </button>
          ) : null}

          {canPurgeDocument(subject, record) ? (
            <button
              type="button"
              className={styles.delete}
              onClick={() => {
                if (!window.confirm(t.admin.purgeConfirm)) return;
                purgeDocument(record.id);
                navigate('/admin?tab=documents', { replace: true });
              }}
            >
              {t.admin.purge}
            </button>
          ) : null}

          {canDeleteDocument(subject, record) ? (
            <button
              type="button"
              className={styles.delete}
              onClick={() => {
                if (!window.confirm(t.document.deleteConfirm)) return;
                deleteDocument(record.id);
                navigate('/documents', { replace: true });
              }}
            >
              {t.document.delete}
            </button>
          ) : null}

          <button type="button" className={styles.edit} onClick={() => window.print()}>
            {t.document.print}
          </button>

          <button
            type="button"
            className={styles.print}
            disabled={pdfBusy}
            onClick={() => void downloadPdf()}
          >
            {pdfBusy ? t.document.pdfBusy : t.document.downloadPdf}
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <aside className={`${styles.side} no-print`}>
          {pdfFailed ? (
            <div className={styles.draftNote} role="alert">
              <p className={styles.savedBody}>{t.document.pdfFailed}</p>
            </div>
          ) : null}

          {justSaved ? (
            <div className={styles.saved} role="status">
              <div className={styles.savedTitle}>{t.document.savedTitle}</div>
              <p className={styles.savedBody}>{t.document.savedBody}</p>
            </div>
          ) : null}

          {record.deletedAt === undefined ? null : (
            <div className={styles.draftNote} role="note">
              <div className={styles.savedTitle}>{t.document.deletedTitle}</div>
              <p className={styles.savedBody}>
                {formatDateTime(record.deletedAt)}
                {record.deletedBy === undefined || record.deletedBy === ''
                  ? null
                  : `, ${personName(record.deletedBy)}`}
                . {t.document.deletedBody}
              </p>
            </div>
          )}

          {template.generic === true ? (
            <div className={styles.draftNote} role="note">
              <div className={styles.savedTitle}>{t.form.genericTitle}</div>
              <p className={styles.savedBody}>{t.form.genericBody}</p>
            </div>
          ) : null}

          {template.custom === true ? (
            <div className={styles.draftNote} role="note">
              <div className={styles.savedTitle}>{t.templates.previewTitle}</div>
              <p className={styles.savedBody}>{t.templates.previewBody}</p>
            </div>
          ) : null}

          {isDraft ? (
            <div className={styles.draftNote} role="note">
              <div className={styles.savedTitle}>{t.document.draftTitle}</div>
              <p className={styles.savedBody}>{t.document.draftBody}</p>
            </div>
          ) : null}

          <h1 className={styles.title}>{documentTitle(record)}</h1>

          <dl className={styles.meta}>
            <div className={styles.metaRow}>
              <dt>{t.document.meta.status}</dt>
              <dd>
                <StatusStamp status={record.status} size="sm" />
              </dd>
            </div>
            <div className={styles.metaRow}>
              <dt>{t.document.meta.number}</dt>
              <dd className={record.number === null ? styles.metaMuted : 'tabular'}>
                {record.number ?? t.document.noNumber}
              </dd>
            </div>
            {record.subject === '' ? null : (
              <div className={styles.metaRow}>
                <dt>{t.document.meta.subject}</dt>
                <dd>{documentSubject(record)}</dd>
              </div>
            )}
            {/* Дата и время создания и последнего изменения видны всегда:
                по ним сверяют, тот ли это экземпляр («Тест день 2»). */}
            <div className={styles.metaRow}>
              <dt>{t.document.meta.created}</dt>
              <dd className="tabular">{formatDateTime(record.createdAt)}</dd>
            </div>
            <div className={styles.metaRow}>
              <dt>{t.document.meta.updated}</dt>
              <dd className="tabular">{formatDateTime(record.updatedAt)}</dd>
            </div>
            <div className={styles.metaRow}>
              <dt>{t.document.meta.author}</dt>
              <dd>{personName(record.authorName)}</dd>
            </div>
            <div className={styles.metaRow}>
              <dt>{t.document.meta.company}</dt>
              <dd>{companyName(sheetCompany)}</dd>
            </div>
          </dl>

          {record.description === '' ? null : (
            <div className={styles.description}>
              <div className={styles.descriptionTitle}>{t.document.meta.description}</div>
              <p className={styles.descriptionBody}>{record.description}</p>
            </div>
          )}

          {requisitesFrozen ? (
            <div className={styles.snapshot}>
              <div className={styles.descriptionTitle}>{t.document.snapshotTitle}</div>
              <p className={styles.descriptionBody}>{t.document.snapshotBody}</p>
            </div>
          ) : null}

          <DocumentAccess record={record} />

          <p className={styles.hint}>{t.document.printHint}</p>
          <p className={styles.note}>{t.document.serverPdfNote}</p>
        </aside>

        <div className={styles.sheetArea}>
          {/* print-root: при печати на бумагу попадает только это поддерево. */}
          <div className="print-root" ref={sheetRef}>
            <SheetViewport>
              <DocumentSheet
                template={template}
                values={record.values}
                company={sheetCompany}
                date={record.createdAt}
                number={record.number}
                {...(record.peopleSnapshot === undefined
                  ? {}
                  : { people: record.peopleSnapshot })}
              />
            </SheetViewport>
          </div>
        </div>
      </div>
    </div>
  );
}
