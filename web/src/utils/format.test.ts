import { describe, expect, it } from 'vitest';

import { formatDateTime } from './format';

describe('дата и время документа', () => {
  it('показывается по времени Казахстана, UTC+5', () => {
    expect(formatDateTime('2026-09-23T09:05:00.000Z')).toBe('23.09.2026, 14:05');
  });

  it('переходит на следующий день, если в UTC ещё вечер', () => {
    expect(formatDateTime('2026-12-31T20:30:00.000Z')).toBe('01.01.2027, 01:30');
  });

  it('непонятное значение возвращается как есть, а не превращается в NaN', () => {
    expect(formatDateTime('вчера')).toBe('вчера');
  });
});
