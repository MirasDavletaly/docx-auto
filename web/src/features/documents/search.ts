/**
 * Поиск по реестру документов.
 *
 * Ищется по всему, что человек видит в строке реестра: номер, название,
 * «для кого», описание, состояние, кто заполнил, дата создания и изменения
 * («Тест день 2»). Несколько слов сужают поиск: «приказ отпуск Ахметов»
 * найдёт документ, где встретились все три.
 *
 * Поиск идёт по списку, который политика уже отобрала для человека
 * (`visibleDocuments`), поэтому найти чужой документ им нельзя. На сервере
 * он уйдёт в SQL-запрос с тем же фильтром доступа (CLAUDE.md, п. 3.2).
 */
import { contentEn } from '@/i18n/content-en';
import { en } from '@/i18n/en';
import { ru } from '@/i18n/ru';
import { formatDateTime, formatShortDate } from '@/utils/format';
import { matchesQuery } from '@/utils/search';

import type { DocumentRecord } from '@/api/types';

/**
 * Всё, по чему документ находится.
 *
 * Состояние и название ищутся на обоих языках интерфейса: человек, который
 * переключился на английский, всё равно может набрать «черновик».
 */
function fieldsOf(doc: DocumentRecord): string[] {
  const cached = fieldsCache.get(doc);
  if (cached !== undefined) return cached;
  const fields = [
    doc.number ?? '',
    doc.title,
    contentEn[doc.title] ?? '',
    doc.subject,
    doc.description,
    doc.authorName,
    ru.status[doc.status],
    en.status[doc.status],
    formatShortDate(doc.createdAt),
    formatDateTime(doc.createdAt),
    formatDateTime(doc.updatedAt),
  ];
  fieldsCache.set(doc, fields);
  return fields;
}

/**
 * Поля документа запоминаются на сам объект записи: запись неизменяема, и
 * правка документа – это новый объект, для которого поля соберутся заново.
 * Удалённые из списка записи уходят из памяти вместе с ним (WeakMap).
 */
const fieldsCache = new WeakMap<DocumentRecord, string[]>();

/**
 * Документы, в которых встретились все слова запроса. Пустой запрос – все.
 *
 * `extra` – что ещё видно в строке на этом экране: в админ-панели это
 * название компании.
 */
export function searchDocuments(
  documents: DocumentRecord[],
  query: string,
  extra: (doc: DocumentRecord) => string[] = () => [],
): DocumentRecord[] {
  if (query.trim() === '') return documents;
  return documents.filter((doc) => matchesQuery(query, [...fieldsOf(doc), ...extra(doc)]));
}
