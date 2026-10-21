/**
 * Архив.
 *
 * Одно место для всех выпущенных бумаг («Тест день 2»): документы,
 * сохранённые в системе, и старые документы, которые принесли файлом PDF.
 * Черновиков здесь нет – они ещё не выпущены и живут в реестре.
 *
 * Архив – во всех компаниях человека, а не только в выбранной (16.10): у
 * кого компаний несколько, у строк есть колонка «Компания». Загрузка – в
 * текущую компанию.
 *
 * Что человек видит, решает политика: сохранённые документы – по
 * `visibleDocuments`, файлы – по `visibleArchive`. Экран ничего не фильтрует
 * по ролям сам.
 */
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  canDeleteArchiveFile,
  canDeleteDocument,
  canUploadArchive,
  canUseSection,
  sectionOfDocument,
} from '@/access/policy';
import { sections } from '@/api/mock/sections';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { ShowMoreButton, useShowMore } from '@/components/ShowMore/ShowMore';
import { today } from '@/features/document-form/validation';
import { searchDocuments } from '@/features/documents/search';
import { t } from '@/i18n';
import { companyName } from '@/i18n/company';
import { documentTitle, tc } from '@/i18n/content';
import { documentSubject, personName } from '@/i18n/person';
import { useSession } from '@/store/session';
import { cx } from '@/utils/cx';
import { formatShortDate } from '@/utils/format';
import { matchesQuery } from '@/utils/search';

import styles from './ArchivePage.module.css';
import { downloadRegistry } from './exportRegistry';
import { OffscreenPdf } from './OffscreenPdf';
import { archiveColumns, parseArchiveColumn, sortRows } from './sortRows';

import type { ArchiveFile, Company, DocumentRecord, DocumentTemplate } from '@/api/types';
import type { ArchiveUploadResult } from '@/store/session';
import type { ArchiveColumn, Direction } from './sortRows';

type Filter = 'all' | 'created' | 'uploaded';

type Row =
  | { kind: 'document'; date: string; doc: DocumentRecord }
  | { kind: 'file'; date: string; file: ArchiveFile };

function sectionTitle(id: string | undefined): string {
  const section = sections.find((s) => s.id === id);
  return section === undefined ? t.registry.noValue : tc(section.short);
}

function rowCompanyId(row: Row): string {
  return row.kind === 'document' ? row.doc.companyId : row.file.companyId;
}

/**
 * Что стоит в колонке строки – по этому и сортируется. Дата – ГГГГ-ММ-ДД.
 * `companyTitle` – название компании по идентификатору, на языке интерфейса.
 */
function cellText(row: Row, column: ArchiveColumn, companyTitle: (id: string) => string): string {
  const doc = row.kind === 'document' ? row.doc : null;
  const file = row.kind === 'file' ? row.file : null;
  switch (column) {
    case 'number':
      return (doc?.number ?? file?.number) ?? '';
    case 'title':
      return doc === null ? (file?.title ?? '') : documentTitle(doc);
    case 'company':
      return companyTitle(rowCompanyId(row));
    case 'date':
      return row.date.slice(0, 10);
    case 'section':
      return sectionTitle(doc === null ? file?.sectionId : sectionOfDocument(doc));
    case 'source':
      return doc === null ? t.archive.sourceUploaded : t.archive.sourceCreated;
    case 'who':
      return personName(doc === null ? (file?.uploadedByName ?? '') : doc.authorName);
  }
}

export default function ArchivePage() {
  const {
    archiveDocuments,
    archive,
    companies,
    user,
    company,
    openArchiveFile,
    deleteArchiveFile,
    deleteDocument,
    findDocument,
    findCompanyTemplate,
  } = useSession();
  // Документ, PDF которого сейчас собирается вне экрана.
  const [pdfFor, setPdfFor] = useState<{
    record: DocumentRecord;
    template: DocumentTemplate;
    company: Company;
  } | null>(null);
  const [params, setParams] = useSearchParams();
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const subject = { user, companyId: company?.id ?? null };
  // Поле поиска держит запрос у себя, список следует за ним, адрес – после
  // паузы в наборе: так буква появляется сразу (оптимизация 01.10, как в
  // реестре).
  const [query, setQueryText] = useState(() => params.get('q') ?? '');
  const deferredQuery = useDeferredValue(query);
  const urlTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(urlTimer.current), []);
  const filter: Filter =
    params.get('show') === 'created' || params.get('show') === 'uploaded'
      ? (params.get('show') as Filter)
      : 'all';

  function setParam(key: string, value: string) {
    if (value === '' || value === 'all') params.delete(key);
    else params.set(key, value);
    setParams(params, { replace: true });
  }

  function setQuery(next: string) {
    setQueryText(next);
    window.clearTimeout(urlTimer.current);
    urlTimer.current = window.setTimeout(() => setParam('q', next), 400);
  }

  // Компании человека: архив показывает их все. Колонка «Компания» – только
  // когда их больше одной.
  const companyTitle = (id: string) => {
    const found = companies.find((c) => c.id === id);
    return found === undefined ? '' : companyName(found);
  };
  const withCompany = companies.length > 1;
  const columns = archiveColumns(withCompany);

  const saved = archiveDocuments;
  const foundDocs = searchDocuments(saved, deferredQuery, (doc) => [
    sectionTitle(sectionOfDocument(doc)),
    companyTitle(doc.companyId),
  ]);
  const foundFiles = archive.filter((file) =>
    matchesQuery(deferredQuery, [
      file.title,
      file.number,
      file.description,
      file.fileName,
      file.uploadedByName,
      formatShortDate(file.documentDate),
      sectionTitle(file.sectionId),
      companyTitle(file.companyId),
    ]),
  );

  const byDate: Row[] = [
    ...(filter === 'uploaded'
      ? []
      : foundDocs.map<Row>((doc) => ({ kind: 'document', date: doc.createdAt, doc }))),
    ...(filter === 'created'
      ? []
      : foundFiles.map<Row>((file) => ({ kind: 'file', date: file.documentDate, file }))),
  ].sort((a, b) => b.date.localeCompare(a.date));

  // Сортировка по колонке («в архиве нет сортировки», 02.10) – как в
  // реестре: в адресе, щелчок по заголовку, повторный – обратный порядок.
  // Без выбора – по дате, новые сверху. Выгрузка в Excel идёт в том же
  // порядке, что на экране.
  const sortBy = parseArchiveColumn(params.get('sort'));
  const direction: Direction =
    params.get('dir') === 'asc' || (params.get('dir') === null && sortBy !== 'date') ? 'asc' : 'desc';
  const rows = sortRows(byDate, sortBy, direction, (row, column) => cellText(row, column, companyTitle));

  function toggleSort(column: ArchiveColumn) {
    const next: Direction = sortBy === column && direction === 'asc' ? 'desc' : 'asc';
    params.set('sort', column);
    params.set('dir', next);
    setParams(params, { replace: true });
  }

  // На экране – по сто строк; выгрузка в Excel – все найденные (`rows`).
  const more = useShowMore(rows, `${deferredQuery}|${filter}|${sortBy}|${direction}`);

  const uploadSections = sections.filter((s) => canUseSection(user, s.id));
  const empty = saved.length === 0 && archive.length === 0;

  /**
   * «Скачать PDF» созданного документа прямо из архива («Тест день 4»).
   * Шаблоны каталога грузятся только по нажатию: архив без них легче.
   */
  async function downloadCreated(doc: DocumentRecord) {
    setProblem(null);
    // Запись – через сессию: там проверка доступа и логотип из снимка.
    const record = findDocument(doc.id);
    if (record === undefined || company === null) return;

    const { findTemplate } = await import('@/api/mock/templates');
    const template = findTemplate(record.templateId) ?? findCompanyTemplate(record.templateId, record);
    if (template === undefined) {
      setProblem(t.document.pdfFailed);
      return;
    }
    setPdfFor({ record, template, company: record.companySnapshot ?? company });
  }

  async function open(file: ArchiveFile, download: boolean) {
    setProblem(null);
    const result = await openArchiveFile(file.id);
    if (!result.ok) {
      setProblem(result.reason === 'corrupted' ? t.archive.corrupted : t.archive.missing);
      return;
    }

    const url = URL.createObjectURL(result.blob);
    if (download) {
      const link = document.createElement('a');
      link.href = url;
      link.download = file.fileName;
      link.click();
    } else {
      window.open(url, '_blank', 'noopener');
    }
    // Ссылку держим минуту: новой вкладке нужно успеть её прочитать.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={t.archive.title}
        subtitle={t.archive.subtitle}
        actions={
          uploadSections.length === 0 ? null : (
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                setNotice(null);
                setUploading(!uploading);
              }}
            >
              {t.archive.upload}
            </button>
          )
        }
      />

      <div className={styles.body}>
        {uploading && company !== null ? (
          <UploadForm
            sectionIds={uploadSections
              .filter((s) => canUploadArchive(subject, company.id, s.id))
              .map((s) => s.id)}
            onCancel={() => setUploading(false)}
            onDone={() => {
              setUploading(false);
              setNotice(t.archive.uploaded);
            }}
          />
        ) : null}

        {notice === null ? null : (
          <p className={styles.ok} role="status">
            {notice}
          </p>
        )}
        {problem === null ? null : (
          <p className={styles.error} role="alert">
            {problem}
          </p>
        )}

        {pdfFor === null ? null : (
          <OffscreenPdf
            record={pdfFor.record}
            template={pdfFor.template}
            company={pdfFor.company}
            onDone={(ok) => {
              setPdfFor(null);
              if (!ok) setProblem(t.document.pdfFailed);
            }}
          />
        )}

        {empty ? (
          <p className={styles.muted}>{t.archive.empty}</p>
        ) : (
          <>
            <div className={styles.toolbar}>
              <div className={styles.filters} role="group" aria-label={t.archive.columns.source}>
                {(['all', 'created', 'uploaded'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    className={cx(styles.chip, filter === value && styles.chipActive)}
                    onClick={() => setParam('show', value)}
                  >
                    {value === 'all'
                      ? t.archive.filterAll
                      : value === 'created'
                        ? t.archive.filterCreated
                        : t.archive.filterUploaded}
                  </button>
                ))}
              </div>

              <div className={styles.toolbarEnd}>
                <input
                  className={styles.search}
                  type="search"
                  value={query}
                  placeholder={t.archive.search}
                  aria-label={t.archive.search}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.secondary}
                  title={t.archive.exportHint}
                  disabled={rows.length === 0}
                  onClick={() => {
                    // Имя файла – по компании строк; строки нескольких – «несколько компаний».
                    const inRows = new Set(rows.map(rowCompanyId));
                    const [only] = [...inRows];
                    downloadRegistry(
                      rows.map((row) =>
                        row.kind === 'document'
                          ? { ...row, section: sectionTitle(sectionOfDocument(row.doc)), company: companyTitle(row.doc.companyId) }
                          : { ...row, section: sectionTitle(row.file.sectionId), company: companyTitle(row.file.companyId) },
                      ),
                      inRows.size > 1 ? t.archive.exportSeveral : companyTitle(only ?? company?.id ?? ''),
                      today(),
                      withCompany,
                    );
                  }}
                >
                  {t.archive.export}
                </button>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className={styles.muted}>{t.archive.nothingFound}</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th
                          key={column}
                          aria-sort={sortBy === column ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          <button
                            type="button"
                            className={cx(styles.sortButton, sortBy === column && styles.sortButtonActive)}
                            onClick={() => toggleSort(column)}
                            title={sortBy === column ? (direction === 'asc' ? t.registry.sortAsc : t.registry.sortDesc) : undefined}
                          >
                            {t.archive.columns[column]}
                            <span className={styles.sortMark} aria-hidden="true">
                              {sortBy === column ? (direction === 'asc' ? '▲' : '▼') : '·'}
                            </span>
                          </button>
                        </th>
                      ))}
                      <th aria-label={t.archive.open} />
                    </tr>
                  </thead>
                  <tbody>
                    {more.shown.map((row) =>
                      row.kind === 'document' ? (
                        <tr key={row.doc.id}>
                          <td className={cx(styles.number, 'tabular')}>
                            {row.doc.number ?? t.registry.noNumber}
                          </td>
                          <td>
                            <Link className={styles.link} to={`/documents/${row.doc.id}`}>
                              {documentTitle(row.doc)}
                            </Link>
                            {row.doc.subject === '' ? null : (
                              <div className={styles.sub}>{documentSubject(row.doc)}</div>
                            )}
                          </td>
                          {withCompany ? <td>{companyTitle(row.doc.companyId)}</td> : null}
                          <td className="tabular">{formatShortDate(row.doc.createdAt)}</td>
                          <td>{sectionTitle(sectionOfDocument(row.doc))}</td>
                          <td>
                            <span className={styles.source}>{t.archive.sourceCreated}</span>
                          </td>
                          <td className={styles.sub}>{personName(row.doc.authorName)}</td>
                          <td>
                            <div className={styles.actions}>
                              <Link className={styles.action} to={`/documents/${row.doc.id}`}>
                                {t.archive.open}
                              </Link>
                              <button
                                type="button"
                                className={styles.action}
                                disabled={pdfFor !== null}
                                onClick={() => void downloadCreated(row.doc)}
                              >
                                {pdfFor?.record.id === row.doc.id ? t.document.pdfBusy : t.document.downloadPdf}
                              </button>
                              {/* Удаление – в корзину админ-панели, как из реестра
                                  («Тест день 3»: «в архиве не могу удалить документ»). */}
                              {canDeleteDocument(subject, row.doc) ? (
                                <button
                                  type="button"
                                  className={styles.danger}
                                  onClick={() => {
                                    if (window.confirm(t.document.deleteConfirm)) {
                                      deleteDocument(row.doc.id);
                                    }
                                  }}
                                >
                                  {t.common.remove}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={row.file.id}>
                          <td className={cx(styles.number, 'tabular')}>
                            {row.file.number ?? t.registry.noNumber}
                          </td>
                          <td>
                            {row.file.title}
                            {row.file.description === '' ? null : (
                              <div className={styles.sub}>{row.file.description}</div>
                            )}
                          </td>
                          {withCompany ? <td>{companyTitle(row.file.companyId)}</td> : null}
                          <td className="tabular">{formatShortDate(row.file.documentDate)}</td>
                          <td>{sectionTitle(row.file.sectionId)}</td>
                          <td>
                            <span className={cx(styles.source, styles.sourcePdf)}>
                              {t.archive.sourceUploaded}
                            </span>
                          </td>
                          <td className={styles.sub}>{personName(row.file.uploadedByName)}</td>
                          <td>
                            <div className={styles.actions}>
                              <button
                                type="button"
                                className={styles.action}
                                onClick={() => void open(row.file, false)}
                              >
                                {t.archive.open}
                              </button>
                              <button
                                type="button"
                                className={styles.action}
                                onClick={() => void open(row.file, true)}
                              >
                                {t.archive.download}
                              </button>
                              {canDeleteArchiveFile(subject, row.file) ? (
                                <button
                                  type="button"
                                  className={styles.danger}
                                  onClick={() => {
                                    if (window.confirm(t.archive.deleteConfirm)) {
                                      deleteArchiveFile(row.file.id);
                                    }
                                  }}
                                >
                                  {t.common.remove}
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {rows.length === 0 ? null : <ShowMoreButton rest={more.rest} showMore={more.showMore} />}
          </>
        )}
      </div>
    </div>
  );
}

const UPLOAD_ERRORS: Record<Exclude<ArchiveUploadResult, 'ok'>, () => string> = {
  denied: () => t.archive.denied,
  'not-pdf': () => t.archive.notPdf,
  'too-big': () => t.archive.tooBig,
  duplicate: () => t.archive.duplicate,
  'storage-failed': () => t.archive.storageFailed,
};

function UploadForm({
  sectionIds,
  onDone,
  onCancel,
}: {
  sectionIds: string[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const { uploadArchiveFile } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [number, setNumber] = useState('');
  const [documentDate, setDocumentDate] = useState('');
  const [sectionId, setSectionId] = useState(sectionIds.length === 1 ? (sectionIds[0] ?? '') : '');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (file === null || title.trim() === '' || documentDate === '' || sectionId === '') {
      setError(t.archive.required);
      return;
    }
    if (documentDate > today()) {
      setError(t.archive.dateInFuture);
      return;
    }

    setBusy(true);
    const result = await uploadArchiveFile({
      file,
      title,
      number,
      documentDate,
      sectionId,
      description,
    });
    setBusy(false);

    if (result === 'ok') onDone();
    else setError(UPLOAD_ERRORS[result]());
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className={styles.formTitle}>{t.archive.uploadTitle}</div>
      <p className={styles.hint}>{t.archive.uploadBody}</p>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span className={styles.label}>{t.archive.file}</span>
          <input
            className={styles.input}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              const chosen = e.target.files?.[0] ?? null;
              setFile(chosen);
              // Название подсказывается именем файла, но остаётся правкой.
              if (chosen !== null && title.trim() === '') {
                setTitle(chosen.name.replace(/\.pdf$/iu, ''));
              }
            }}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t.archive.docTitle}</span>
          <input
            className={styles.input}
            value={title}
            placeholder={t.archive.docTitleHint}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t.archive.number}</span>
          <input
            className={cx(styles.input, 'tabular')}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t.archive.date}</span>
          <input
            className={styles.input}
            type="date"
            max={today()}
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t.archive.section}</span>
          <select
            className={styles.input}
            value={sectionId}
            onChange={(e) => setSectionId(e.target.value)}
          >
            <option value="">{t.form.selectOption}</option>
            {sections
              .filter((s) => sectionIds.includes(s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {tc(s.title)}
                </option>
              ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t.archive.description}</span>
          <input
            className={styles.input}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </div>

      {error === null ? null : (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.formActions}>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          {t.common.cancel}
        </button>
        <button type="submit" className={styles.primary} disabled={busy}>
          {busy ? t.archive.uploading : t.archive.submit}
        </button>
      </div>
    </form>
  );
}
