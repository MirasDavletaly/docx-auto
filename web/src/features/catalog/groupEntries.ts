/**
 * Группы каталога «Создать документ»: раздел › подраздел, как документы
 * лежат в деле.
 *
 * Группы идут в порядке справочника разделов (`catalog/sections.yaml`):
 * отдел кадров целиком, потом юридический отдел и так далее; внутри раздела –
 * подразделы в порядке справочника. Раньше порядок был порядком шаблонов в
 * коде, и «Отдел кадров» встречался пять раз вперемешку с другими разделами
 * («Тест день 4»: «пусть будет по порядку, а не вразброс»).
 */
import { sections } from '@/api/mock/sections';
import { documentTitle, tc } from '@/i18n/content';

import type { CatalogEntry, CustomTemplate } from '@/api/types';

export interface Group {
  key: string;
  sectionId: string;
  subsectionId: string;
  sectionTitle: string;
  subsectionTitle: string;
  entries: CatalogEntry[];
}

/** Название строки каталога: у шаблона компании – его английское, если вписано. */
export function titleOf(entry: CatalogEntry, custom: Map<string, CustomTemplate>): string {
  const own = custom.get(entry.id);
  return own === undefined ? tc(entry.title) : documentTitle(own);
}

/** Место в справочнике; неизвестное – в конец, а не в начало. */
function position(index: number): number {
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

export function groupEntries(entries: CatalogEntry[], custom: Map<string, CustomTemplate>): Group[] {
  const groups = new Map<string, Group>();

  for (const entry of entries) {
    const key = `${entry.sectionId}/${entry.subsectionId}`;
    let group = groups.get(key);

    if (group === undefined) {
      const section = sections.find((s) => s.id === entry.sectionId);
      const subsection = section?.subsections.find((s) => s.id === entry.subsectionId);
      group = {
        key,
        sectionId: entry.sectionId,
        subsectionId: entry.subsectionId,
        sectionTitle: tc(section?.title ?? entry.sectionId),
        subsectionTitle: subsection === undefined ? '' : tc(subsection.title),
        entries: [],
      };
      groups.set(key, group);
    }

    group.entries.push(entry);
  }

  // Готовые шаблоны — первыми внутри группы: их можно создать прямо сейчас.
  for (const group of groups.values()) {
    group.entries.sort((a, b) => {
      if (a.state !== b.state) return a.state === 'ready' ? -1 : 1;
      return titleOf(a, custom).localeCompare(titleOf(b, custom), 'ru');
    });
  }

  const sectionIndex = (id: string) => position(sections.findIndex((s) => s.id === id));
  const subsectionIndex = (sectionId: string, id: string) =>
    position(sections.find((s) => s.id === sectionId)?.subsections.findIndex((s) => s.id === id) ?? -1);

  return [...groups.values()].sort(
    (a, b) =>
      sectionIndex(a.sectionId) - sectionIndex(b.sectionId) ||
      subsectionIndex(a.sectionId, a.subsectionId) - subsectionIndex(b.sectionId, b.subsectionId),
  );
}
