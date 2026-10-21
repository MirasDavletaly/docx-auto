import { describe, expect, it } from 'vitest';

import { cutsBetweenLines, layoutPages, sameLayout } from './paginate';

/** Номера кусков по листам – без подробностей о разрывах. */
function indices(pages: ReturnType<typeof layoutPages>): number[][] {
  return pages.map((page) => page.map((slice) => slice.index));
}

describe('раскладка по листам A4 («Тест день 2»)', () => {
  it('всё помещается – один лист', () => {
    expect(indices(layoutPages([{ height: 100 }, { height: 200 }, { height: 300 }], 1000))).toEqual([
      [0, 1, 2],
    ]);
  });

  it('не поместилось – кусок уходит на следующий лист целиком', () => {
    expect(
      indices(layoutPages([{ height: 400 }, { height: 400 }, { height: 400 }], 1000)),
    ).toEqual([[0, 1], [2]]);
  });

  it('кусок выше листа, который нельзя резать, занимает свой лист', () => {
    expect(indices(layoutPages([{ height: 100 }, { height: 2500 }, { height: 100 }], 1000))).toEqual(
      [[0], [1], [2]],
    );
  });

  it('без посчитанной разметки – один лист со всем документом', () => {
    expect(indices(layoutPages([{ height: 0 }, { height: 0 }], 1000))).toEqual([[0, 1]]);
    expect(layoutPages([], 1000)).toEqual([[]]);
  });

  it('длинная строка разрывается между строками текста, как в Word', () => {
    // Строка из 30 строк текста по 20 пикселей, над ней уже занято 700.
    const lines = Array.from({ length: 30 }, (_, i) => ({ top: i * 20, bottom: i * 20 + 20 }));
    const pages = layoutPages(
      [{ height: 700 }, { height: 600, cuts: cutsBetweenLines(lines) }],
      1000,
    );

    // На первом листе осталось 300: помещаются ровно 15 строк.
    expect(pages[0]).toEqual([
      { index: 0, from: 0, to: 700 },
      { index: 1, from: 0, to: 300 },
    ]);
    // Продолжение – со следующей строки, ничего не потеряно.
    expect(pages[1]).toEqual([{ index: 1, from: 300, to: 600 }]);
  });

  it('очень длинная строка идёт через несколько листов', () => {
    const lines = Array.from({ length: 150 }, (_, i) => ({ top: i * 20, bottom: i * 20 + 20 }));
    const pages = layoutPages([{ height: 3000, cuts: cutsBetweenLines(lines) }], 1000);

    expect(pages.map((p) => p.map((s) => [s.from, s.to]))).toEqual([
      [[0, 1000]],
      [[1000, 2000]],
      [[2000, 3000]],
    ]);
  });

  it('строку текста пополам не режет', () => {
    // В соседней колонке строка сдвинута на 10: общих границ меньше.
    const left = [0, 20, 40].map((top) => ({ top, bottom: top + 20 }));
    const right = [10, 30].map((top) => ({ top, bottom: top + 20 }));
    const cuts = cutsBetweenLines([...left, ...right]);

    // Граница 20 проходит сквозь правую строку 10–30, граница 40 – сквозь 30–50.
    expect(cuts.map((c) => c.at)).toEqual([60]);
  });

  it('между абзацами продолжение начинается с верха следующей строки', () => {
    const cuts = cutsBetweenLines([
      { top: 0, bottom: 20 },
      { top: 40, bottom: 60 },
    ]);
    expect(cuts[0]).toEqual({ at: 20, resume: 40 });
  });

  it('разрывы те же, что у прямого перебора каждой строки против каждой', () => {
    // Прежняя реализация (до 12.10) – эталон: новая лишь быстрее.
    function reference(lines: Array<{ top: number; bottom: number }>) {
      const sorted = [...lines].sort((a, b) => a.bottom - b.bottom);
      const cuts: Array<{ at: number; resume: number }> = [];
      for (const line of sorted) {
        const at = line.bottom;
        const crossed = lines.some((other) => other.top < at - 0.5 && other.bottom > at + 0.5);
        if (crossed || cuts.some((c) => Math.abs(c.at - at) < 0.5)) continue;
        const next = lines.filter((other) => other.top >= at - 0.5).map((other) => other.top);
        cuts.push({ at, resume: next.length === 0 ? at : Math.min(...next) });
      }
      return cuts;
    }

    // Случайно, но повторяемо: колонки с общими и сдвинутыми строками,
    // разные высоты строк, совпадения на границе допуска в полпикселя.
    let seed = 12345;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let round = 0; round < 2000; round++) {
      const lines: Array<{ top: number; bottom: number }> = [];
      const columns = 1 + Math.floor(random() * 3);
      for (let column = 0; column < columns; column++) {
        let top = Math.floor(random() * 4) * 0.25;
        const count = Math.floor(random() * 25);
        for (let i = 0; i < count; i++) {
          const height = [13.33, 16.67, 15, 20][Math.floor(random() * 4)] ?? 15;
          lines.push({ top, bottom: top + height });
          top += height + (random() < 0.2 ? Math.floor(random() * 3) * 0.5 : 0);
        }
      }
      expect(cutsBetweenLines(lines), `набор ${round}`).toEqual(reference(lines));
    }
  });

  it('тысячи строк – без перебора каждой против каждой', () => {
    const lines = Array.from({ length: 20000 }, (_, i) => ({ top: i * 15, bottom: i * 15 + 15 }));
    const started = performance.now();
    expect(cutsBetweenLines(lines)).toHaveLength(20000);
    // Прямой перебор на 20 000 строках – миллиарды сравнений.
    expect(performance.now() - started).toBeLessThan(500);
  });

  it('одинаковую раскладку узнаёт, чтобы не перерисовывать', () => {
    const a = layoutPages([{ height: 400 }, { height: 700 }], 1000);
    expect(sameLayout(a, layoutPages([{ height: 400 }, { height: 700 }], 1000))).toBe(true);
    expect(sameLayout(a, layoutPages([{ height: 400 }, { height: 500 }], 1000))).toBe(false);
    expect(sameLayout(null, a)).toBe(false);
  });
});
