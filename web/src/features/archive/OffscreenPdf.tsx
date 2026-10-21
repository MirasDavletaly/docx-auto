/**
 * «Скачать PDF» из архива, не открывая документ («Тест день 4»: «кнопка,
 * чтобы все документы можно было скачивать по отдельности, как мои
 * загруженные PDF, а не заходить в документ»).
 *
 * Лист собирается тем же `DocumentSheet`, что и на странице документа, со
 * снимками реквизитов, людей и шаблона, – только вне экрана. Снимает его тот
 * же `exportPdf`, поэтому файл совпадает с тем, что скачивается со страницы
 * документа.
 */
import { useEffect, useRef } from 'react';

import { DocumentSheet } from '@/components/DocumentSheet/DocumentSheet';
import { exportPdf, pdfFileName } from '@/features/documents/exportPdf';
import { documentTitle } from '@/i18n/content';

import styles from './ArchivePage.module.css';

import type { Company, DocumentRecord, DocumentTemplate } from '@/api/types';

interface Props {
  record: DocumentRecord;
  template: DocumentTemplate;
  /** Реквизиты для листа: снимок сохранённого документа или текущие. */
  company: Company;
  onDone: (ok: boolean) => void;
}

export function OffscreenPdf({ record, template, company, onDone }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Лист раскладывается по страницам после первой отрисовки, а шрифты
      // могут ещё грузиться: ждём два кадра и шрифты, как ждал бы человек,
      // открывший документ.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await document.fonts.ready;
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (cancelled || root.current === null) return;

      const title = documentTitle(record);
      try {
        await exportPdf(root.current, pdfFileName(title, record.number), title);
        if (!cancelled) done.current(true);
      } catch {
        if (!cancelled) done.current(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [record]);

  return (
    <div ref={root} className={styles.offscreen} aria-hidden="true">
      <DocumentSheet
        template={template}
        values={record.values}
        company={company}
        date={record.createdAt}
        number={record.number}
        {...(record.peopleSnapshot === undefined ? {} : { people: record.peopleSnapshot })}
      />
    </div>
  );
}
