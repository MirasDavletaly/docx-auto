/**
 * Поля подписи из реквизитов компании (19.10): пока их не правили руками,
 * черновик показывает текущего директора.
 */
import { describe, expect, it } from 'vitest';

import { releaseCompanyDefaults, withCompanyDefaults } from './companyDefaults';

import type { Company, FieldDef } from '@/api/types';

const fields: FieldDef[] = [
  { id: 'executorName', label: 'Расшифровка подписи', kind: 'text', group: 'Подписи', required: true, defaultFrom: '@company.directorNameShort' },
  { id: 'executorPosition', label: 'Должность', kind: 'text', group: 'Подписи', required: true, defaultFrom: '@company.directorTitle' },
  { id: 'reason', label: 'Основание', kind: 'text', group: 'Основание', required: false },
];

const card = (directorNameShort: string) =>
  ({ id: 'c-a', directorNameShort, directorTitle: 'Директор' }) as unknown as Company;

describe('withCompanyDefaults', () => {
  it('нетронутое поле – из текущей карточки: сменили директора – новый', () => {
    const values = { reason: 'заявление' };
    expect(withCompanyDefaults(fields, values, card('Иванов И.'))).toEqual({
      reason: 'заявление',
      executorName: 'Иванов И.',
      executorPosition: 'Директор',
    });
    expect(withCompanyDefaults(fields, values, card('Петров П.')).executorName).toBe('Петров П.');
  });

  it('правленное руками – остаётся, даже пустое', () => {
    const values = { executorName: 'Сидоров С.', executorPosition: '' };
    expect(withCompanyDefaults(fields, values, card('Петров П.'))).toEqual(values);
  });

  it('в карточке пусто – поле не появляется; без компании значения как есть', () => {
    const values = { reason: 'x' };
    expect(withCompanyDefaults(fields, values, card(''))).toEqual({ reason: 'x', executorPosition: 'Директор' });
    expect(withCompanyDefaults(fields, values, null)).toBe(values);
  });

  it('подставлять нечего – тот же объект: лист не перерисовывается зря', () => {
    const values = { executorName: 'a', executorPosition: 'b' };
    expect(withCompanyDefaults(fields, values, card('Петров П.'))).toBe(values);
  });
});

describe('releaseCompanyDefaults – черновики, записанные раньше', () => {
  it('значение совпадает с карточкой – поле снова следует карточке', () => {
    const released = releaseCompanyDefaults(fields, { executorName: 'Иванов И.', executorPosition: 'Директор', reason: 'x' }, card('Иванов И.'));
    expect(released).toEqual({ reason: 'x' });
    expect(withCompanyDefaults(fields, released, card('Петров П.')).executorName).toBe('Петров П.');
  });

  it('отличается – ручная правка или прежний директор: остаётся', () => {
    const values = { executorName: 'Сидоров С.' };
    expect(releaseCompanyDefaults(fields, values, card('Иванов И.'))).toBe(values);
  });
});
