/**
 * Длинный список – по сто строк («Показать ещё»), оптимизация 01.10.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PAGE_SIZE, ShowMoreButton, useShowMore } from './ShowMore';

import type { Root } from 'react-dom/client';

let container: HTMLDivElement;
let root: Root;

function List({ count, resetKey }: { count: number; resetKey: string }) {
  const items = Array.from({ length: count }, (_, i) => i);
  const more = useShowMore(items, resetKey);
  return (
    <>
      <ul>
        {more.shown.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <ShowMoreButton {...more} />
    </>
  );
}

const shown = () => container.querySelectorAll('li').length;
const button = () => container.querySelector('button');

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('«Показать ещё»', () => {
  it('сто строк на странице – как в CLAUDE.md, п. 3.11', () => {
    expect(PAGE_SIZE).toBe(100);
  });

  it('короткий список – целиком и без кнопки', () => {
    act(() => root.render(<List count={40} resetKey="" />));
    expect(shown()).toBe(40);
    expect(button()).toBeNull();
  });

  it('длинный – первые сто, кнопка добавляет следующие и говорит, сколько осталось', () => {
    act(() => root.render(<List count={250} resetKey="" />));
    expect(shown()).toBe(100);
    expect(button()?.textContent).toContain('100');
    expect(button()?.textContent).toContain('150');

    act(() => button()?.click());
    expect(shown()).toBe(200);
    expect(button()?.textContent).toContain('50');

    act(() => button()?.click());
    expect(shown()).toBe(250);
    expect(button()).toBeNull();
  });

  it('новый поиск начинает снова с первых ста', () => {
    act(() => root.render(<List count={250} resetKey="а" />));
    act(() => button()?.click());
    expect(shown()).toBe(200);
    act(() => root.render(<List count={250} resetKey="аб" />));
    expect(shown()).toBe(100);
  });
});
