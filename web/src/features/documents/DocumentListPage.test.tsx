/**
 * Реестр после оптимизации 01.10: поле поиска меняется сразу, список – вслед
 * за ним, запрос попадает в адрес после паузы, запомненные строки
 * переводятся при смене языка.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from '@/app/App';
import { setAccessToken } from '@/api/client';
import { loadDb, resetDb } from '@/store/db';
import { resetSync } from '@/store/documentsSync';
import { fakeApi } from '@/test/fakeApi';

import type { DocumentRecord } from '@/api/types';
import type { Root } from 'react-dom/client';

const A = 'c-knt';

function doc(id: string, subject: string): DocumentRecord {
  return {
    id,
    templateId: 'hr-trip-order',
    companyId: A,
    sectionId: 'hr',
    title: 'Приказ о направлении в командировку',
    description: 'настройка оборудования',
    subject,
    status: 'saved',
    number: `${id}-К`,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    values: {},
    authorId: 'director-a',
    authorName: 'Директор',
  };
}

let container: HTMLDivElement;
let root: Root;

async function settle(ms = 20) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function open() {
  window.history.pushState({}, '', '/documents');
  await act(async () => {
    root.render(<App />);
  });
  const deadline = Date.now() + 3_000;
  while (container.querySelector('tbody tr') === null && Date.now() < deadline) await settle(10);
}

const rows = () => [...container.querySelectorAll('tbody tr')];
const search = () => container.querySelector<HTMLInputElement>('input[type=search]');

function typeQuery(text: string) {
  const input = search();
  if (input === null) throw new Error('нет поля поиска');
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetDb();
  resetSync();
  setAccessToken(null);
  // Вход – на сервере: браузер уже вошёл, вход восстановится по cookie.
  fakeApi.install();
  for (const company of loadDb().companies) fakeApi.addCompany(company);
  fakeApi.addUser({ id: 'director-a', login: 'director-a', displayName: 'Директор', role: 'director', companyIds: [A] });
  fakeApi.signedIn('director-a', A);
  // Документы – на сервере: реестр получает их копией после входа.
  for (const d of [doc('1', 'Ким Ирина Сергеевна'), doc('2', 'Ахметов Асхат Каирович'), doc('3', 'Оспанов Нурлан')]) {
    fakeApi.addDocument(d);
  }
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.history.pushState({}, '', '/');
});

describe('реестр: поиск после оптимизации', () => {
  it('буква сразу в поле, список сужается, запрос – в адресе после паузы', async () => {
    await open();
    expect(rows()).toHaveLength(3);

    typeQuery('ким');
    expect(search()?.value).toBe('ким');
    await settle();
    expect(rows()).toHaveLength(1);
    expect(rows()[0]?.textContent).toContain('Ким Ирина');

    // Адрес меняется не на каждое нажатие, а после паузы в наборе.
    expect(new URLSearchParams(window.location.search).get('q')).toBeNull();
    await settle(500);
    expect(new URLSearchParams(window.location.search).get('q')).toBe('ким');

    typeQuery('');
    await settle();
    expect(rows()).toHaveLength(3);
  });

  it('запрос из адреса открывается уже найденным', async () => {
    window.history.pushState({}, '', '/documents?q=%D0%BE%D1%81%D0%BF%D0%B0%D0%BD%D0%BE%D0%B2');
    await act(async () => {
      root.render(<App />);
    });
    const deadline = Date.now() + 3_000;
    while (container.querySelector('tbody tr') === null && Date.now() < deadline) await settle(10);
    expect(search()?.value).toBe('оспанов');
    expect(rows()).toHaveLength(1);
  });

  it('длинный реестр – по сто строк, поиск по всем', async () => {
    fakeApi.documents().length = 0;
    for (let i = 0; i < 250; i += 1) {
      fakeApi.addDocument(doc(String(i + 1), i === 249 ? 'Самый Последний' : `Работник ${i + 1}`));
    }
    await open();
    expect(rows()).toHaveLength(100);
    expect(container.textContent).toContain('250');
    const more = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Показать ещё'));
    act(() => more?.click());
    expect(rows()).toHaveLength(200);

    // Найти можно и то, что ещё не показано.
    typeQuery('последний');
    await settle();
    expect(rows()).toHaveLength(1);
  });

  it('строки переводятся при смене языка', async () => {
    await open();
    expect(rows()[0]?.textContent).toContain('Приказ о направлении в командировку');
    const english = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'EN');
    expect(english).toBeDefined();
    act(() => english?.click());
    await settle();
    expect(rows()[0]?.textContent).not.toContain('Приказ о направлении в командировку');
    act(() => [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'RU')?.click());
    await settle();
  });
});
