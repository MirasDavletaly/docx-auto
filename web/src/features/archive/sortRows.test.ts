/**
 * Сортировка архива по колонкам («в архиве нет сортировки», 02.10).
 */
import { describe, expect, it } from 'vitest';

import { archiveColumns, parseArchiveColumn, sortRows } from './sortRows';

import type { ArchiveColumn } from './sortRows';

interface R {
  id: string;
  number: string;
  title: string;
  company: string;
  date: string;
  section: string;
  source: string;
  who: string;
}

const rows: R[] = [
  { id: 'a', number: '10-К', title: 'Приказ о приёме', company: 'ТОО «ExLumen»', date: '2026-09-20', section: 'Кадры', source: 'Создан', who: 'Ким И.' },
  { id: 'b', number: '2-К', title: 'Акт выполненных работ', company: 'Kazakhstan New Technologies LLP', date: '2026-09-25', section: 'Финансы', source: 'PDF', who: 'Ахметов А.' },
  { id: 'c', number: '', title: 'Договор поставки', company: 'ТОО «Algoritmi KZ»', date: '2026-09-01', section: 'Юристы', source: 'PDF', who: 'Оспанов Н.' },
];
const text = (row: R, column: ArchiveColumn) => row[column];
const ids = (column: ArchiveColumn, direction: 'asc' | 'desc') => sortRows(rows, column, direction, text).map((r) => r.id);

describe('сортировка архива', () => {
  it('по умолчанию – по дате, новые сверху', () => {
    expect(parseArchiveColumn(null)).toBe('date');
    expect(parseArchiveColumn('чужое')).toBe('date');
    expect(ids('date', 'desc')).toEqual(['b', 'a', 'c']);
    expect(ids('date', 'asc')).toEqual(['c', 'a', 'b']);
  });

  it('номер – с учётом чисел: «2-К» раньше «10-К»; без номера – в конце в обе стороны', () => {
    expect(ids('number', 'asc')).toEqual(['b', 'a', 'c']);
    expect(ids('number', 'desc')).toEqual(['a', 'b', 'c']);
  });

  it('документ, раздел, откуда, кто – по алфавиту', () => {
    expect(ids('title', 'asc')).toEqual(['b', 'c', 'a']);
    expect(ids('section', 'asc')).toEqual(['a', 'b', 'c']);
    expect(ids('who', 'desc')).toEqual(['c', 'a', 'b']);
  });

  it('компания – по алфавиту; колонка – только у того, у кого компаний несколько (16.10)', () => {
    // Порядок «ru»: кириллица раньше латиницы.
    expect(ids('company', 'asc')).toEqual(['c', 'a', 'b']);
    expect(parseArchiveColumn('company')).toBe('company');
    expect(archiveColumns(true)).toContain('company');
    expect(archiveColumns(false)).not.toContain('company');
  });

  it('при равных значениях порядок прежний (по дате)', () => {
    // У «b» и «c» источник один – PDF: между собой они стоят как стояли.
    const order = ids('source', 'asc').filter((id) => id !== 'a');
    expect(order).toEqual(['b', 'c']);
    expect(ids('source', 'desc').filter((id) => id !== 'a')).toEqual(['b', 'c']);
  });

  it('исходный список не меняется', () => {
    sortRows(rows, 'title', 'asc', text);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});
