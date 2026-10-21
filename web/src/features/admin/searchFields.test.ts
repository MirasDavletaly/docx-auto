/**
 * Поиск в админ-панели на любом языке («Тест день 3»: «поиск работает, но
 * некорректно, на английском невозможно поискать»).
 */
import { describe, expect, it } from 'vitest';

import { auditSearchFields, employeeSearchFields, userSearchFields } from './searchFields';
import { matchesQuery } from '@/utils/search';

import type { AuditEntry, Company, EmployeeBrief, User } from '@/api/types';

const kim: EmployeeBrief = {
  id: 'e-2',
  companyId: 'c-a',
  fullName: 'Ким Ирина Сергеевна',
  fullNameGenitive: 'Ким Ирину Сергеевну',
  position: 'Бухгалтер',
  unit: 'Бухгалтерия',
};

const nurlan: EmployeeBrief = {
  id: 'e-4',
  companyId: 'c-a',
  fullName: 'Оспанов Нурлан Ерболатович',
  fullNameGenitive: 'Оспанова Нурлана Ерболатовича',
  fullNameKk: 'Оспанов Нұрлан Ерболатович',
  position: 'Менеджер по закупкам',
  unit: 'Отдел снабжения',
};

describe('персонал', () => {
  it.each([
    ['Accountant', kim],
    ['Accounting Department', kim],
    ['Irina Kim', kim],
    ['бухгалтер', kim],
    ['Nurlan', nurlan],
    ['Нұрлан', nurlan],
    ['Нурлан', nurlan],
    ['Procurement', nurlan],
  ])('«%s» находит карточку', (query, person) => {
    expect(matchesQuery(query, employeeSearchFields(person))).toBe(true);
  });

  it('чужую карточку не находит', () => {
    expect(matchesQuery('Accountant', employeeSearchFields(nurlan))).toBe(false);
  });
});

describe('сотрудники', () => {
  const company = { id: 'c-a', name: 'ТОО «ExLumen»', nameEn: 'ExLumen LLP' } as Company;
  const director: User = {
    id: 'u-1',
    login: 'boss',
    displayName: 'Мирас',
    role: 'director',
    companyIds: ['c-a'],
    sectionIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('роль и компания – на обоих языках', () => {
    for (const query of ['Director', 'Директор', 'ExLumen LLP', 'Miras']) {
      expect(matchesQuery(query, userSearchFields(director, [company])), query).toBe(true);
    }
  });
});

describe('журнал', () => {
  const entry: AuditEntry = {
    id: 'a-1',
    at: '2026-09-24T06:00:00.000Z',
    userId: 'u-1',
    userName: 'Мирас',
    companyId: 'c-a',
    event: 'document.create',
    target: 'Приказ о дисциплинарном взыскании',
  };

  it('событие и документ – на обоих языках', () => {
    for (const query of ['Created a document', 'Создал документ', 'Miras']) {
      expect(matchesQuery(query, auditSearchFields(entry, [])), query).toBe(true);
    }
  });
});
