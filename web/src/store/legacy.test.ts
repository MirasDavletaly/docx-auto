import { beforeEach, describe, expect, it } from 'vitest';

import { buildImport, captureLegacy, clearLegacy, readLegacy } from './legacy';

import type { Company, User } from '@/api/types';

const company = (id: string, logo?: string): Company =>
  ({
    id,
    name: id,
    legalName: id,
    bin: '000000000000',
    address: '',
    directorName: '',
    directorTitle: '',
    directorTitleGenitive: '',
    grantedAt: '',
    ...(logo === undefined ? {} : { logo }),
  }) as unknown as Company;

const user = (id: string, role: User['role'], companyIds: string[], extra: Partial<User> = {}): User => ({
  id,
  login: id,
  displayName: id,
  role,
  companyIds,
  sectionIds: [],
  createdAt: '2026-09-01T00:00:00.000Z',
  ...extra,
});

beforeEach(() => {
  localStorage.clear();
});

describe('прежние данные браузера', () => {
  it('откладываются один раз и стираются после переноса', () => {
    captureLegacy([company('c-a')], [user('miras', 'platform-admin', [])]);
    captureLegacy([], []);
    expect(readLegacy()?.users.map((u) => u.id)).toEqual(['miras']);
    clearLegacy();
    expect(readLegacy()).toBeNull();
  });

  it('перенос: картинки отдельно, лишних полей нет, без компании – не переносится', () => {
    const plan = buildImport({
      capturedAt: '',
      companies: [company('c-a', 'data:image/png;base64,AAAA'), company('c-b', '/assets/b.png')],
      users: [
        user('miras', 'platform-admin', ['c-a']),
        user('worker', 'employee', ['c-a', 'c-gone'], {
          avatar: 'data:image/png;base64,BBBB',
          position: 'Юрист',
        }),
        user('orphan', 'employee', ['c-gone']),
      ],
    });

    expect(plan.logos).toEqual({ 'c-a': 'data:image/png;base64,AAAA' });
    expect(plan.data.companies[0]).not.toHaveProperty('logo');
    expect(plan.data.companies[1]?.logo).toBe('/assets/b.png');

    expect(plan.avatars).toEqual({ worker: 'data:image/png;base64,BBBB' });
    const worker = plan.data.users.find((u) => u.id === 'worker');
    expect(worker).not.toHaveProperty('avatar');
    expect(worker?.companyIds).toEqual(['c-a']);
    expect(worker?.position).toBe('Юрист');
    expect(plan.data.users.find((u) => u.id === 'miras')?.companyIds).toEqual([]);

    expect(plan.dropped).toEqual(['orphan']);
    // Хешей паролей и счётчиков попыток в переносе нет.
    expect(JSON.stringify(plan.data)).not.toMatch(/password|failedAttempts/);
  });
});
