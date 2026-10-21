/**
 * Уникальность номера документа.
 *
 * Номер пока вводит человек (docs/questions.md, Q17), и два приказа с одним
 * номером – это два документа, на которые нельзя однозначно сослаться.
 * Поэтому номер занят, если он уже стоит на другом сохранённом документе
 * той же компании.
 *
 * Черновики номер не занимают: черновик ещё не выпущен и может так и не
 * выйти. Коллизия всплывёт при сохранении второго документа, а не на каждом
 * нажатии клавиши в чужом черновике (Q33).
 *
 * На сервере то же правило станет уникальным ограничением в БД – последней
 * линией защиты (CLAUDE.md, п. 3.5).
 */
import type { DocumentRecord } from '@/api/types';

/**
 * Номер в виде для сравнения: «№ 12-К/2026» и «12-к/2026» – один номер.
 *
 * Убираются знак «№» в начале, пробелы по краям и повторные пробелы внутри,
 * регистр не учитывается.
 */
export function normalizeDocumentNumber(raw: string): string {
  return raw
    .trim()
    .replace(/^№\s*/u, '')
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('ru');
}

/**
 * Документ, на котором уже стоит этот номер, или `undefined`.
 *
 * `exceptId` – сам сохраняемый документ: исправление приказа не должно
 * спотыкаться о его же номер.
 */
export function findNumberHolder(
  documents: DocumentRecord[],
  companyId: string,
  number: string,
  exceptId?: string,
): DocumentRecord | undefined {
  const wanted = normalizeDocumentNumber(number);
  if (wanted === '') return undefined;

  return documents.find(
    (doc) =>
      doc.companyId === companyId &&
      doc.id !== exceptId &&
      doc.status === 'saved' &&
      doc.deletedAt === undefined &&
      doc.number !== null &&
      normalizeDocumentNumber(doc.number) === wanted,
  );
}

/** Сохранение отказано: номер уже занят. Экран ловит это до сохранения. */
export class DocumentNumberTakenError extends Error {
  constructor(number: string) {
    super(`номер документа уже занят: ${number}`);
    this.name = 'DocumentNumberTakenError';
  }
}
