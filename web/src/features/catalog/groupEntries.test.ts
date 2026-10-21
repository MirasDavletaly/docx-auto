/**
 * Порядок каталога «Создать документ» («Тест день 4»: «пусть будет по
 * порядку, а не вразброс: если кадры – то все кадры подряд, потом другой
 * раздел»).
 */
import { describe, expect, it } from 'vitest';

import { groupEntries } from './groupEntries';
import { sections } from '@/api/mock/sections';
import { catalogEntries } from '@/api/mock/templates';

describe('каталог по порядку разделов', () => {
  const groups = groupEntries(catalogEntries, new Map());
  const sectionOrder = groups.map((g) => g.sectionId);

  it('каждый раздел идёт одним куском, а не вразброс', () => {
    const seen = new Set<string>();
    let previous = '';
    for (const id of sectionOrder) {
      if (id !== previous) {
        expect(seen.has(id), `раздел ${id} встречается ещё раз ниже`).toBe(false);
        seen.add(id);
      }
      previous = id;
    }
  });

  it('разделы – в порядке справочника: кадры, юристы, корпоративное, финансы…', () => {
    const expected = sections.map((s) => s.id).filter((id) => sectionOrder.includes(id));
    expect([...new Set(sectionOrder)]).toEqual(expected);
  });

  it('подразделы внутри раздела – в порядке справочника', () => {
    const hr = groups.filter((g) => g.sectionId === 'hr').map((g) => g.subsectionId);
    const order = sections.find((s) => s.id === 'hr')?.subsections.map((s) => s.id) ?? [];
    expect(hr).toEqual(order.filter((id) => hr.includes(id)));
    expect(hr[0]).toBe('hr-personnel-orders');
  });
});
