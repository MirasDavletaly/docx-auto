/**
 * Лист документа.
 *
 * Проверяется то, что имеет юридические последствия: выпущенный документ не
 * меняется, когда правят справочник (CLAUDE.md, п. 3.4), и подписи в нём нет
 * линии, которую человек просил убрать.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DocumentSheet } from './DocumentSheet';
import { orderBody } from '@/api/mock/blank';
import { resetDb, updateDb } from '@/store/db';

import type { Company, DocumentTemplate, EmployeeBrief } from '@/api/types';
import type { Root } from 'react-dom/client';

const company: Company = {
  id: 'c-test',
  name: 'ТОО «Пример»',
  legalName: 'Товарищество с ограниченной ответственностью «Пример»',
  bin: '000000000000',
  address: 'город Астана, улица Примерная, 1',
  directorName: 'Хамит Нурдаулет Алмазович',
  directorNameShort: 'Хамит Н.А.',
  directorTitle: 'Генеральный директор',
  directorTitleGenitive: 'Генерального директора',
  directorNameGenitive: 'Хамита Нурдаулета Алмазовича',
  directorBasis: 'Устава',
  city: 'Астана',
  accent: '#2f3b8f',
  monogram: 'ПР',
};

const template: DocumentTemplate = {
  id: 'test-order',
  title: 'Приказ',
  sectionId: 'hr',
  subsectionId: 'hr-personnel-orders',
  series: 'К',
  profile: 'standard',
  purpose: 'Тестовый приказ.',
  reviewed: false,
  layout: 'order',
  langs: ['ru'],
  fields: [
    { id: 'employee', kind: 'employee', label: 'Работник', required: true, group: 'Работник' },
  ],
  body: orderBody({
    subject: { ru: [[{ text: 'О приёме на работу', bold: true }]] },
    body: { ru: [[{ text: 'Принять ' }, { field: 'employee' }, { text: '.' }]] },
  }),
};

const person: EmployeeBrief = {
  id: 'c-test:e-1',
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

function render(node: React.ReactElement) {
  act(() => {
    root.render(node);
  });
}

describe('снимок справочника', () => {
  it('выпущенный документ берёт фамилию из своего снимка, а не из справочника', () => {
    render(
      <DocumentSheet
        template={template}
        values={{ employee: person.id }}
        company={company}
        date="2026-09-22"
        people={{ [person.id]: person }}
      />,
    );

    expect(container.textContent).toContain('Ахметова Асхата Каировича');
  });

  it('правка карточки в справочнике не меняет уже выпущенный документ', () => {
    // Кадровик исправил фамилию в справочнике после того, как приказ выпущен.
    const renamed: EmployeeBrief = { ...person, fullNameGenitive: 'Другого Человека Друговича' };
    updateDb((db) => ({ ...db, employees: [...db.employees, renamed] }));

    // Черновик снимка не имеет и смотрит в справочник: там уже новая фамилия.
    render(
      <DocumentSheet
        template={template}
        values={{ employee: person.id }}
        company={company}
        date="2026-09-22"
      />,
    );
    expect(container.textContent).toContain('Другого Человека Друговича');

    // Выпущенный документ со своим снимком остаётся прежним.
    render(
      <DocumentSheet
        template={template}
        values={{ employee: person.id }}
        company={company}
        date="2026-09-22"
        people={{ [person.id]: person }}
      />,
    );
    expect(container.textContent).toContain('Ахметова Асхата Каировича');
    expect(container.textContent).not.toContain('Другого Человека Друговича');
  });

  it('удаление карточки не оставляет в тексте идентификатор вместо фамилии', () => {
    // Карточки в справочнике нет вовсе, но у документа есть снимок.
    render(
      <DocumentSheet
        template={template}
        values={{ employee: person.id }}
        company={company}
        date="2026-09-22"
        people={{ [person.id]: person }}
      />,
    );

    expect(container.textContent).toContain('Ахметова Асхата Каировича');
    expect(container.textContent).not.toContain(person.id);
  });

  it('ФИО, вписанное руками, идёт в документ как есть', () => {
    render(
      <DocumentSheet
        template={template}
        values={{ employee: 'Иванов Иван Иванович' }}
        company={company}
        date="2026-09-22"
      />,
    );

    expect(container.textContent).toContain('Иванов Иван Иванович');
  });
});

describe('подпись', () => {
  it('стоят должность и фамилия с инициалами, черты между ними нет', () => {
    render(
      <DocumentSheet
        template={template}
        values={{}}
        company={company}
        date="2026-09-22"
      />,
    );

    expect(container.textContent).toContain('Генеральный директор');
    // Под подписью стоит фамилия с инициалами, а не полное имя.
    expect(container.textContent).toContain('Хамит Н.А.');
    expect(container.textContent).not.toContain('Хамит Нурдаулет Алмазович');

    // Черты между должностью и фамилией нет: место для росписи остаётся
    // пустым («Исправление.docx»).
    const signature = container.querySelector('[class*="signature"]');
    expect(signature).not.toBeNull();
    expect(container.innerHTML).not.toContain('signatureLine');
  });
});
