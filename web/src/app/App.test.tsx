/**
 * Приложение вообще запускается.
 *
 * Тест дешёвый и ловит дорогое: сломанный порядок хуков, неверный элемент
 * разметки, обращение к словарю, которого нет. Ни сборка, ни `tsc` этого
 * не видят – они проверяют типы, а не то, что страница отрисовалась.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { setAccessToken } from '@/api/client';
import { loadDb, resetDb } from '@/store/db';
import { fakeApi } from '@/test/fakeApi';

import type { Root } from 'react-dom/client';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetDb();
  setAccessToken(null);
  // Сервер без входа: cookie нет, вход не восстанавливается.
  fakeApi.install();

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/**
 * Отрисовка и ожидание.
 *
 * Каждый экран грузится лениво, поэтому после первого прохода страница ещё
 * пуста: ждём, пока часть кода доедет и отрисуется.
 */
async function render() {
  await act(async () => {
    root.render(<App />);
  });

  // Срок по часам, а не по числу попыток: при полном прогоне файлы
  // тестов идут параллельно, и ленивый экран грузится дольше полсекунды.
  const deadline = Date.now() + 3_000;
  while (container.textContent === '' && Date.now() < deadline) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

describe('запуск', () => {
  it('на чистом браузере ведёт на вход: экрана первого запуска больше нет', async () => {
    window.history.pushState({}, '', '/');
    await render();

    expect(container.textContent).toContain('Вход в систему');
    expect(container.textContent).not.toContain('Первый запуск');
    // Ни одного логина и ни одного пароля в собранной странице нет.
    expect(container.textContent).not.toContain('Демонстрационный вход');
  });

  it('прежний адрес первого запуска – «не найдено», а не форма заведения администратора', async () => {
    window.history.pushState({}, '', '/setup');
    await render();

    expect(container.textContent).toContain('Страница не найдена');
  });

  it('не говорит, что документы в браузере: они на сервере (16.10)', async () => {
    window.history.pushState({}, '', '/login');
    await render();

    expect(container.textContent).not.toContain('хранятся в браузере');
    expect(container.textContent).not.toContain('лежат в этом браузере');
  });

  it('по адресу без HTTPS говорит, что нужен защищённый адрес, а не падает при входе', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    try {
      window.history.pushState({}, '', '/login');
      await render();
      expect(container.textContent).toContain('Откройте сайт по защищённому адресу');
      expect(container.textContent).not.toContain('Вход в систему');
    } finally {
      Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    }
  });

  it('неизвестный адрес не роняет страницу', async () => {
    window.history.pushState({}, '', '/такого-адреса-нет');
    await render();

    expect(container.textContent).toContain('Страница не найдена');
  });
});

/**
 * Кнопка компании вверху (16.10): у кого компаний несколько – меняет
 * компанию, кто бы это ни был; у кого одна – ведёт на её реквизиты.
 */
describe('кнопка компании вверху', () => {
  const A = 'c-knt';
  const B = 'c-algoritmi';

  async function openAs(companyIds: string[]) {
    for (const company of loadDb().companies) fakeApi.addCompany(company);
    fakeApi.addUser({ id: 'worker', login: 'worker', displayName: 'worker', role: 'employee', companyIds });
    fakeApi.signedIn('worker', A);
    window.history.pushState({}, '', '/');
    await render();

    const deadline = Date.now() + 3_000;
    while (container.querySelector('button[title]') === null && Date.now() < deadline) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }

  async function clickCompany(title: string) {
    const button = container.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
    expect(button).not.toBeNull();
    await act(async () => {
      button?.click();
    });
    // Следующий экран тоже ленивый: ждём и смены адреса, и отрисовки.
    const deadline = Date.now() + 3_000;
    while ((window.location.pathname === '/' || container.textContent === '') && Date.now() < deadline) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
  }

  it('сотрудник двух компаний выбирает компанию заново', async () => {
    await openAs([A, B]);
    await clickCompany('Сменить компанию');

    expect(window.location.pathname).toBe('/choose-company');
    expect(container.textContent).toContain('Выберите компанию');
  });

  it('сотрудник одной компании попадает на её реквизиты', async () => {
    await openAs([A]);
    await clickCompany('Реквизиты компании');

    expect(window.location.pathname).toBe('/company');
  });
});

/** Ждёт, пока на странице сбудется условие (ленивые экраны, ответы сервера). */
async function until(check: () => boolean) {
  const deadline = Date.now() + 3_000;
  while (!check() && Date.now() < deadline) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

/**
 * Поля подписи из реквизитов (19.10): пока их не правили, форма берёт
 * текущего директора и подхватывает правку карточки на другом компьютере.
 */
describe('поля подписи из реквизитов в форме', () => {
  const A = 'c-knt';

  // Рамка листа следит за своим размером; в jsdom ResizeObserver нет, а в
  // браузерах он есть всегда – здесь хватает пустого.
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('открытая форма показывает директора из карточки, а после правки на другом компьютере – нового', async () => {
    for (const company of loadDb().companies) fakeApi.addCompany(company);
    fakeApi.addUser({ id: 'boss', login: 'boss', displayName: 'boss', role: 'director', companyIds: [A] });
    fakeApi.signedIn('boss', A);
    window.history.pushState({}, '', '/create/finance-act-r1');
    await render();

    const field = () => container.querySelector<HTMLInputElement>('#field-executorName');
    await until(() => field() !== null);
    const director = loadDb().companies.find((c) => c.id === A)?.directorNameShort;
    expect(director).toBeTruthy();
    expect(field()?.value).toBe(director);

    fakeApi.patchCompany(A, { directorNameShort: 'Новый Д.Д.', lockVersion: 1 });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await until(() => field()?.value === 'Новый Д.Д.');

    expect(field()?.value).toBe('Новый Д.Д.');
  });
});
