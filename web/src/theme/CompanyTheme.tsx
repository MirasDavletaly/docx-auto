/**
 * Брендинг компании.
 *
 * После входа интерфейс перекрашивается в цвет компании: работая одновременно
 * в двух организациях группы, человек должен видеть по экрану, где он сейчас
 * находится. Ошибиться компанией здесь — значит выпустить приказ не от того
 * юридического лица.
 *
 * Меняется только шкала акцента; чернила, бумага и состояния документов
 * общие — иначе четыре компании получат четыре несопоставимых интерфейса.
 */
import { useEffect } from 'react';

import { buildAccentPalette } from './color';

import type { Company } from '@/api/types';

export function CompanyTheme({ company }: { company: Company | null }) {
  useEffect(() => {
    const root = document.documentElement;
    if (company === null) {
      root.removeAttribute('style');
      return;
    }

    const palette = buildAccentPalette(company.accent);
    root.style.setProperty('--accent', palette.accent);
    root.style.setProperty('--accent-hover', palette.hover);
    root.style.setProperty('--accent-active', palette.active);
    root.style.setProperty('--accent-soft', palette.soft);
    root.style.setProperty('--accent-line', palette.line);
    root.style.setProperty('--accent-on', palette.on);
  }, [company]);

  return null;
}
