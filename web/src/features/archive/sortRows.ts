/**
 * Сортировка строк архива по колонке («в архиве нет сортировки», 02.10).
 *
 * Как в реестре: колонка и направление живут в адресе страницы, номера
 * сравниваются с учётом чисел («2-К» раньше «10-К»). Пустое значение – всегда
 * в конце, в какую сторону ни сортируй: документ без номера не должен
 * открывать список. При равных значениях строки остаются в прежнем порядке –
 * по дате, новые сверху.
 */

export type ArchiveColumn = 'number' | 'title' | 'company' | 'date' | 'section' | 'source' | 'who';
export type Direction = 'asc' | 'desc';

/**
 * Колонки по порядку. «Компания» – только у того, у кого компаний несколько:
 * архив показывает все его компании (16.10), одной компании колонка не нужна.
 */
export const ARCHIVE_COLUMNS: ArchiveColumn[] = ['number', 'title', 'company', 'date', 'section', 'source', 'who'];

export function archiveColumns(withCompany: boolean): ArchiveColumn[] {
  return withCompany ? ARCHIVE_COLUMNS : ARCHIVE_COLUMNS.filter((column) => column !== 'company');
}

export function parseArchiveColumn(raw: string | null): ArchiveColumn {
  return ARCHIVE_COLUMNS.find((column) => column === raw) ?? 'date';
}

const collator = new Intl.Collator('ru', { numeric: true, sensitivity: 'base' });

/** Новый список; `text` – значение строки в колонке (дата – в виде ГГГГ-ММ-ДД). */
export function sortRows<T>(
  rows: T[],
  column: ArchiveColumn,
  direction: Direction,
  text: (row: T, column: ArchiveColumn) => string,
): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = text(a, column).trim();
    const y = text(b, column).trim();
    if (x === '' || y === '') return x === y ? 0 : x === '' ? 1 : -1;
    return sign * collator.compare(x, y);
  });
}
