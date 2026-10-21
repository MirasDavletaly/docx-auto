/**
 * «Тест день 4»: значения полей – на языке своей колонки, а не по-русски во
 * всех трёх. Каждый тест – замечание из файла.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { templates } from '@/api/mock/templates';
import { DocumentSheet } from './DocumentSheet';
import { resetDb, updateDb } from '@/store/db';

import type { Company, DocumentTemplate, EmployeeBrief } from '@/api/types';
import type { Root } from 'react-dom/client';

const company: Company = {
  id: 'c-test',
  name: 'ТОО «Тест»',
  legalName: 'Товарищество с ограниченной ответственностью «Тест»',
  legalNameKk: 'ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК «Тест»',
  legalNameEn: '«Test» LLP',
  bin: '170340025267',
  address: 'город Атырау',
  directorName: 'Кабешова Самал Амангелдиевна',
  directorTitle: 'Генеральный директор',
  directorTitleGenitive: 'Генерального директора',
  directorNameGenitive: 'Кабешовой Самал Амангелдиевны',
  directorBasis: 'Устава',
  city: 'Атырау',
  accent: '#2f6b55',
  monogram: 'Т',
};

const kim: EmployeeBrief = {
  id: 'c-test:e-2',
  companyId: 'c-test',
  fullName: 'Ким Ирина Сергеевна',
  fullNameGenitive: 'Ким Ирину Сергеевну',
  position: 'Бухгалтер',
  unit: 'Бухгалтерия',
};

const ospanov: EmployeeBrief = {
  id: 'c-test:e-4',
  companyId: 'c-test',
  fullName: 'Оспанов Нурлан Ерболатович',
  fullNameGenitive: 'Оспанова Нурлана Ерболатовича',
  fullNameKk: 'Оспанов Нұрлан Ерболатович',
  position: 'Менеджер по закупкам',
  unit: 'Отдел снабжения',
};

function template(id: string): DocumentTemplate {
  const found = templates.find((tpl) => tpl.id === id);
  if (found === undefined) throw new Error(`шаблон ${id} не найден`);
  return found;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  resetDb();
  updateDb((db) => ({ ...db, employees: [kim, ospanov] }));
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(id: string, values: Record<string, string>): string {
  act(() => {
    root.render(<DocumentSheet template={template(id)} values={values} company={company} date="2026-09-29" />);
  });
  return container.textContent ?? '';
}

describe('незаполненное поле', () => {
  it('на листе – знаки подчёркивания, как в бумажном бланке, а не черта посреди строки', () => {
    const text = render('hr-trip-order', {});
    expect(text).toContain('_'.repeat(14));
    // Пропуск по-прежнему помечен для экранного диктора.
    expect(container.querySelector('[aria-label="не заполнено"]')?.textContent).toBe('_'.repeat(14));
  });
});

describe('варианты списка – на языке колонки', () => {
  it('вид поощрения: сыйлықақы / премия / bonus', () => {
    const text = render('hr-bonus-order', { employee: kim.id, kind: 'премия', reason: 'за проект' });
    expect(text).toContain('Көтермелеу түрі: сыйлықақы');
    expect(text).toContain('Вид поощрения: премия');
    expect(text).toContain('Type of award: bonus');
  });

  it('вид взыскания: сөгіс / выговор / reprimand', () => {
    const text = render('hr-discipline-order', { employee: kim.id, penalty: 'выговор' });
    expect(text).toContain('«сөгіс» түріндегі');
    expect(text).toContain('в виде «выговор»');
    expect(text).toContain('in the form of “reprimand”');
  });
});

describe('перевод по правилу поля, пока его не вписали руками', () => {
  it('город назначения – по словарю городов', () => {
    const text = render('hr-trip-order', { employee: kim.id, city: 'Уральск' });
    expect(text).toContain('Орал қаласына');
    expect(text).toContain('в г. Уральск');
    expect(text).toContain('business trip to Uralsk');
  });

  it('новое подразделение – по словарю подразделений', () => {
    const text = render('hr-transfer-order', { employee: kim.id, unit: 'Проектный отдел' });
    expect(text).toContain('Жобалау бөлімі');
    expect(text).toContain('Design Department');
  });

  it('вписанное руками главнее правила', () => {
    const text = render('hr-trip-order', {
      employee: kim.id,
      purpose: 'наладка оборудования',
      'purpose.kk': 'жабдықты баптау',
      'purpose.en': 'equipment setup',
    });
    expect(text).toContain('Іссапардың мақсаты: жабдықты баптау');
    expect(text).toContain('Цель командировки: наладка оборудования');
    expect(text).toContain('Purpose of the trip: equipment setup');
  });
});

describe('члены комиссии – выбором из персонала', () => {
  it('ФИО и должность каждого – на языке колонки', () => {
    const text = render('corporate-commission-order', {
      employee: kim.id,
      members: [kim.id, ospanov.id, 'Иванов Иван – эксперт'].join('\n'),
    });
    expect(text).toContain('Комиссия мүшелері: Ким Ирина Сергеевна – бухгалтер; Оспанов Нұрлан Ерболатович – сатып алу жөніндегі менеджер; Иванов Иван – эксперт');
    expect(text).toContain('Члены комиссии: Ким Ирина Сергеевна – бухгалтер; Оспанов Нурлан Ерболатович – менеджер по закупкам');
    expect(text).toContain('Members: Irina Kim, Accountant; Nurlan Ospanov, Procurement Manager; Иванов Иван – эксперт');
  });
});

describe('какие документы – выбором из списка', () => {
  it('выбранные виды – на языке колонки, в порядке списка', () => {
    const text = render('corporate-signature-right-order', {
      employee: kim.id,
      scope: ['договоры', 'накладные'].join('\n'),
    });
    expect(text).toContain('шарттар, жүкқұжаттар');
    expect(text).toContain('договоры, накладные');
    expect(text).toContain('contracts, waybills');
  });
});

describe('доверенность: на языках доверенности', () => {
  it('«МВД РК» – на английском само', () => {
    const text = render('legal-power-single', { employee: kim.id, idIssuer: 'МВД РК' });
    expect(text).toContain('Ministry of Internal Affairs of the Republic of Kazakhstan');
  });
});
