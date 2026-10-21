/**
 * Выход после бездействия (проверка безопасности 29.09): компьютер, который
 * оставили открытым, через 30 минут без действий не держит вход.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IDLE_LIMIT_MS } from './idle';
import { SessionProvider, useSession } from './session';
import { setAccessToken } from '@/api/client';
import { resetDb } from '@/store/db';
import { fakeApi } from '@/test/fakeApi';

import type { Root } from 'react-dom/client';

const MINUTE = 60_000;

let container: HTMLDivElement;
let root: Root;
let session: ReturnType<typeof useSession>;

function Probe() {
  session = useSession();
  return null;
}

/** Открывает сайт и ждёт ответа сервера: вход восстанавливается по cookie. */
async function open() {
  act(() => {
    root.render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
}

function signedIn() {
  fakeApi.signedIn('worker-a', 'c-knt');
}

function wait(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-30T09:00:00Z'));
  localStorage.clear();
  sessionStorage.clear();
  resetDb();
  setAccessToken(null);
  fakeApi.install();
  fakeApi.addUser({ id: 'worker-a', login: 'worker-a', displayName: 'worker-a', role: 'employee', companyIds: ['c-knt'] });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('выход после бездействия', () => {
  it('лимит – 30 минут', () => {
    expect(IDLE_LIMIT_MS).toBe(30 * MINUTE);
  });

  it('30 минут без действий – вход завершён, и экран входа знает почему', async () => {
    signedIn();
    await open();
    wait(29 * MINUTE);
    expect(session.user?.id).toBe('worker-a');

    wait(MINUTE);
    expect(session.user).toBeNull();
    expect(session.signedOutForIdle).toBe(true);
    expect(sessionStorage.getItem('docflow.session')).toBeNull();
  });

  it('нажатие клавиши или мыши отодвигает срок', async () => {
    signedIn();
    await open();
    wait(20 * MINUTE);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown'));
    });
    wait(25 * MINUTE);
    expect(session.user?.id).toBe('worker-a');

    act(() => {
      document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });
    wait(29 * MINUTE);
    expect(session.user?.id).toBe('worker-a');
    wait(2 * MINUTE);
    expect(session.user).toBeNull();
  });

  it('перезагрузка после долгой паузы не возвращает вход', async () => {
    signedIn();
    sessionStorage.setItem('docflow.activity', String(Date.now() - 31 * MINUTE));
    await open();
    expect(session.user).toBeNull();
    expect(session.signedOutForIdle).toBe(true);
  });

  it('перезагрузка вскоре после работы вход сохраняет', async () => {
    signedIn();
    sessionStorage.setItem('docflow.activity', String(Date.now() - 5 * MINUTE));
    await open();
    expect(session.user?.id).toBe('worker-a');
    wait(24 * MINUTE);
    expect(session.user?.id).toBe('worker-a');
    wait(2 * MINUTE);
    expect(session.user).toBeNull();
  });

  it('после выхода отметка о работе стирается – следующий вход не выбросит сразу', async () => {
    signedIn();
    await open();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown'));
    });
    act(() => session.signOut());
    expect(sessionStorage.getItem('docflow.activity')).toBeNull();
    expect(session.signedOutForIdle).toBe(false);
  });
});
