/**
 * Реестр архива в Excel («Тест день 3»).
 *
 * Выгружается ровно то, что человек видит на экране: тот же отбор по
 * источнику и поиску, те же колонки, на языке интерфейса. Список уже
 * отобран политикой (`visibleDocuments`, `visibleArchive`), поэтому чужого
 * документа в файле быть не может.
 *
 * Архив – во всех компаниях человека (16.10): у кого их несколько, в
 * таблице есть колонка «Компания», как на экране.
 *
 * Таблица чёрно-белая: без цвета, без плашек «Создан» / «PDF» – вместо них
 * слово в колонке «Откуда» (`utils/xlsx.ts`).
 */
import { t } from '@/i18n';
import { documentTitle } from '@/i18n/content';
import { documentSubject, personName } from '@/i18n/person';
import { formatShortDate } from '@/utils/format';
import { XLSX_TYPE, buildXlsx } from '@/utils/xlsx';

import type { ArchiveFile, DocumentRecord } from '@/api/types';

/** `company` – название компании строки; нужно, когда колонка «Компания» есть. */
export type RegistryRow =
  | { kind: 'document'; doc: DocumentRecord; section: string; company?: string }
  | { kind: 'file'; file: ArchiveFile; section: string; company?: string };

/** Колонка «Компания» – после описания, перед датой: как на экране, после названия. */
function insertCompany<T>(cells: T[], company: T, withCompany: boolean): T[] {
  return withCompany ? [...cells.slice(0, 5), company, ...cells.slice(5)] : cells;
}

export function registryHeader(withCompany = false): string[] {
  const c = t.archive.columns;
  return insertCompany(
    ['№', c.number, c.title, t.registry.columns.subject, t.archive.description, c.date, c.section, c.source, c.who],
    c.company,
    withCompany,
  );
}

/** Строки таблицы в том же порядке, что на экране. */
export function registryRows(rows: RegistryRow[], withCompany = false): string[][] {
  return rows.map((row, index) =>
    insertCompany(
      row.kind === 'document'
        ? [
            String(index + 1),
            row.doc.number ?? t.registry.noNumber,
            documentTitle(row.doc),
            documentSubject(row.doc),
            row.doc.description,
            formatShortDate(row.doc.createdAt),
            row.section,
            t.archive.exportCreated,
            personName(row.doc.authorName),
          ]
        : [
            String(index + 1),
            row.file.number ?? t.registry.noNumber,
            row.file.title,
            '',
            row.file.description,
            formatShortDate(row.file.documentDate),
            row.section,
            t.archive.exportUploaded,
            personName(row.file.uploadedByName),
          ],
      row.company ?? '',
      withCompany,
    ),
  );
}

/** Имя файла без знаков, которые Windows в имени не пускает. */
export function registryFileName(companyName: string, date: string): string {
  const safe = `${t.archive.exportFileName} ${companyName} ${date}`.replace(/[\\/:*?"<>|«»]/gu, '').replace(/\s+/gu, ' ');
  return `${safe.trim()}.xlsx`;
}

/**
 * `companyName` – для имени файла: название компании или «несколько
 * компаний», если строки из разных.
 */
export function downloadRegistry(rows: RegistryRow[], companyName: string, date: string, withCompany = false): void {
  const bytes = buildXlsx({
    name: t.archive.exportFileName,
    header: registryHeader(withCompany),
    rows: registryRows(rows, withCompany),
    widths: insertCompany([5, 14, 48, 32, 30, 12, 18, 18, 24], 28, withCompany),
  });

  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_TYPE }));
  const link = document.createElement('a');
  link.href = url;
  link.download = registryFileName(companyName, date);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
