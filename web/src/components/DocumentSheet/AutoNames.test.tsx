/**
 * Имя работника и число прописью встают в колонки сами («Тест день 2»).
 *
 * Раньше у карточки без казахского и латинского написания в английской
 * колонке оставалась кириллица, а в казахской – имя без дательного падежа.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DocumentSheet } from './DocumentSheet';
import { templates } from '@/api/mock/templates';
import { resetDb } from '@/store/db';

import type { Company, EmployeeBrief } from '@/api/types';
import type { Root } from 'react-dom/client';

const company: Company = {
  id: 'c-test',
  name: 'Тест',
  legalName: 'ТОО «Тест»',
  bin: '200840900077',
  address: 'г. Астана',
  directorName: 'Ихсанова София Талаповна',
  directorTitle: 'Генеральный директор',
  directorTitleGenitive: 'Генерального директора',
  directorNameGenitive: 'Ихсановой Софии Талаповны',
  directorBasis: 'Устава',
  city: 'Астана',
  accent: '#1f5c4a',
  monogram: 'Т',
};

/** Карточка без казахского и латинского написания – как в справочнике по умолчанию. */
const bare: EmployeeBrief = {
  id: 'p-1',
  companyId: 'c-test',
  fullName: 'Ахметов Асхат Каирович',
  fullNameGenitive: 'Ахметова Асхата Каировича',
  position: 'Инженер',
  unit: 'Проектный отдел',
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  resetDb();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(id: string, values: Record<string, string>): string {
  const template = templates.find((tpl) => tpl.id === id);
  if (template === undefined) throw new Error(id);
  act(() => {
    root.render(
      <DocumentSheet
        template={template}
        values={values}
        company={company}
        date="2026-09-24"
        people={{ [bare.id]: bare }}
      />,
    );
  });
  return container.textContent ?? '';
}

describe('имя работника без перевода в карточке', () => {
  it('в английской колонке – латиница, а не кириллица', () => {
    const text = render('hr-vacation-order', { employee: 'p-1' });
    expect(text).toContain('Askhat Akhmetov');
  });

  it('в казахской колонке – с дательным падежом', () => {
    const text = render('hr-vacation-order', { employee: 'p-1' });
    expect(text).toContain('Ахметов Асхат Каировичке');
  });

  it('поправленное руками казахское написание тоже получает падеж', () => {
    const text = render('hr-vacation-order', { employee: 'p-1', 'employee.kk': 'Ахметов Асхат Қайырұлы' });
    expect(text).toContain('Ахметов Асхат Қайырұлына');
  });

  it('вписанное руками ФИО: латиница и падеж по правилам', () => {
    const text = render('hr-vacation-order', { employee: 'Ким Ирина Сергеевна' });
    expect(text).toContain('Irina Kim');
    expect(text).toContain('Ким Ирина Сергеевнаға');
  });
});

describe('должность без перевода', () => {
  it('из словаря частых должностей встаёт в казахскую и английскую колонки', () => {
    const text = render('hr-vacation-order', { employee: 'p-1', position: 'Бухгалтер' });
    expect(text).toContain('Accountant');
  });

  it('вписанный руками перевод главнее словаря', () => {
    const text = render('hr-vacation-order', {
      employee: 'p-1',
      position: 'Бухгалтер',
      'position.en': 'Senior Accountant',
    });
    expect(text).toContain('Senior Accountant');
  });
});
