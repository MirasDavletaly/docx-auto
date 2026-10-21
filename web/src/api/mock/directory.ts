/**
 * Условный справочник контрагентов.
 *
 * Людей здесь больше нет (13.10): персонал компании – её пользователи на
 * сервере (`GET /api/personnel`, docs/plans/phase-01b-personnel.md).
 */
import type { Counterparty } from '@/api/types';

export const counterparties: Counterparty[] = [
  {
    id: 'k-1',
    name: 'ТОО «Тұлпар Сервис»',
    bin: '000000000011',
    address: 'г. Алматы, ул. Розыбакиева, 200',
  },
  {
    id: 'k-2',
    name: 'ТОО «Бәйтерек Строй»',
    bin: '000000000012',
    address: 'г. Астана, ул. Сыганак, 25',
  },
  {
    id: 'k-3',
    name: 'ИП Каримов Р. А.',
    bin: '000000000013',
    address: 'г. Шымкент, ул. Байтурсынова, 8',
  },
];

export function findCounterparty(id: string): Counterparty | undefined {
  return counterparties.find((c) => c.id === id);
}
