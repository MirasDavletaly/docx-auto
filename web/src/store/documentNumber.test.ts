/**
 * Номер документа не повторяется в компании («Тест день 2»).
 */
import { describe, expect, it } from 'vitest';

import { findNumberHolder, normalizeDocumentNumber } from './documentNumber';

import type { DocumentRecord } from '@/api/types';

function doc(overrides: Partial<DocumentRecord>): DocumentRecord {
  return {
    id: 'd-1',
    templateId: 'hr-hire-order',
    companyId: 'c-a',
    title: 'Приказ о приёме на работу',
    description: '',
    subject: '',
    status: 'saved',
    number: '12-К/2026',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    values: {},
    authorId: 'u-1',
    authorName: 'Работник',
    ...overrides,
  };
}

describe('номер документа', () => {
  it.each([
    ['12-К/2026', '12-к/2026'],
    ['№ 12-К/2026', '12-к/2026'],
    ['№12-К/2026', '12-к/2026'],
    ['  7  ', '7'],
    ['7   ОД', '7 од'],
  ])('«%s» сравнивается как «%s»', (raw, normalized) => {
    expect(normalizeDocumentNumber(raw)).toBe(normalized);
  });

  it('занят, если стоит на другом сохранённом документе этой компании', () => {
    const docs = [doc({ id: 'd-1' })];
    expect(findNumberHolder(docs, 'c-a', '№ 12-к/2026')?.id).toBe('d-1');
  });

  it('свой же номер при исправлении документа не мешает', () => {
    const docs = [doc({ id: 'd-1' })];
    expect(findNumberHolder(docs, 'c-a', '12-К/2026', 'd-1')).toBeUndefined();
  });

  it('в другой компании тот же номер свободен', () => {
    const docs = [doc({ companyId: 'c-b' })];
    expect(findNumberHolder(docs, 'c-a', '12-К/2026')).toBeUndefined();
  });

  it('черновик и удалённый документ номер не занимают', () => {
    const docs = [
      doc({ id: 'd-draft', status: 'draft' }),
      doc({ id: 'd-gone', deletedAt: '2026-02-01T00:00:00.000Z' }),
    ];
    expect(findNumberHolder(docs, 'c-a', '12-К/2026')).toBeUndefined();
  });

  it('пустой номер не проверяется: документ без номера остаётся с прочерком', () => {
    const docs = [doc({ number: null })];
    expect(findNumberHolder(docs, 'c-a', '   ')).toBeUndefined();
  });
});
