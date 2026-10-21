import { describe, expect, it } from 'vitest';

import {
  ASCENT,
  DESCENT,
  baselineOf,
  charSpaceToFit,
  fontStyleOf,
  groupByLine,
  imageBox,
  intersect,
  onWhite,
  parseRgb,
  placeChars,
  transformText,
  visibilityIn,
  visibleText,
  wordSpans,
} from './pdfLayout';

describe('слова текстового узла', () => {
  it('режутся по пробелам, переводам строки и неразрывным пробелам', () => {
    const text = ' Бұйрық  № 12\nOrder ';
    expect(wordSpans(text).map(({ start, end }) => text.slice(start, end))).toEqual(['Бұйрық', '№', '12', 'Order']);
  });

  it('у пустой строки и строки из пробелов слов нет', () => {
    expect(wordSpans('')).toEqual([]);
    expect(wordSpans(' \n  ')).toEqual([]);
  });

  it('мягкий перенос не попадает в текст PDF', () => {
    expect(visibleText('жауап­кершілігі')).toBe('жауапкершілігі');
  });
});

describe('начертание', () => {
  it.each([
    ['400', 'normal', 'normal'],
    ['700', 'normal', 'bold'],
    ['600', 'normal', 'bold'],
    ['500', 'normal', 'normal'],
    ['400', 'italic', 'italic'],
    ['700', 'italic', 'bolditalic'],
    ['400', 'oblique 10deg', 'italic'],
  ] as const)('вес %s, стиль %s → %s', (weight, style, expected) => {
    expect(fontStyleOf(weight, style)).toBe(expected);
  });
});

describe('базовая линия', () => {
  it('делит высоту слова в пропорции верхних и нижних выносных', () => {
    // 10 пунктов – 13,33 пикселя; прямоугольник слова – от верха до низа выносных.
    const height = 13.333 * (ASCENT + DESCENT);
    expect(baselineOf(100, height)).toBeCloseTo(100 + 13.333 * ASCENT, 6);
  });
});

describe('ширина слова в PDF', () => {
  it('совпадает с листом – промежутка нет', () => {
    expect(charSpaceToFit(20, 20, 5)).toBe(0);
    expect(charSpaceToFit(20, 20.00001, 5)).toBe(0);
  });

  it('разрядка делится на все знаки, как в CSS', () => {
    // 48 подчёркиваний, сжатых на 0,5 пт каждое.
    expect(charSpaceToFit(100 - 48 * 0.176, 100, 48)).toBeCloseTo(-0.176, 6);
  });

  it('пустая строка не делит на ноль', () => {
    expect(charSpaceToFit(10, 0, 0)).toBe(0);
  });
});

describe('окно обрезки', () => {
  const clip = { x: 0, y: 0, w: 100, h: 50 };

  it('пересечение и его отсутствие', () => {
    expect(intersect(clip, { x: 90, y: 40, w: 20, h: 20 })).toEqual({ x: 90, y: 40, w: 10, h: 10 });
    expect(intersect(clip, { x: 100, y: 0, w: 10, h: 10 })).toBeNull();
  });

  it('строка, ушедшая на прошлый лист, не видна', () => {
    expect(visibilityIn({ x: 10, y: -14, w: 30, h: 13 }, clip)).toBe('hidden');
  });

  it('строка в окне видна целиком', () => {
    expect(visibilityIn({ x: 10, y: 10, w: 30, h: 13 }, clip)).toBe('inside');
    // Полпикселя за краем – округление, а не выход за окно.
    expect(visibilityIn({ x: -0.3, y: 10, w: 100.5, h: 13 }, clip)).toBe('inside');
  });

  it('черта длиннее колонки обрезается', () => {
    expect(visibilityIn({ x: 10, y: 10, w: 200, h: 13 }, clip)).toBe('clipped');
  });

  it('по высоте решает середина строки', () => {
    expect(visibilityIn({ x: 10, y: 43, w: 30, h: 13 }, clip)).toBe('inside');
    expect(visibilityIn({ x: 10, y: 45, w: 30, h: 13 }, clip)).toBe('hidden');
  });
});

describe('логотип в рамке', () => {
  it('contain: вписан с пропорциями и стоит по центру', () => {
    expect(imageBox({ x: 0, y: 0, w: 40, h: 16 }, 400, 100, 'contain')).toEqual({ x: 0, y: 3, w: 40, h: 10 });
    expect(imageBox({ x: 0, y: 0, w: 40, h: 16 }, 100, 100, 'contain')).toEqual({ x: 12, y: 0, w: 16, h: 16 });
  });

  it('без contain – вся рамка', () => {
    expect(imageBox({ x: 1, y: 2, w: 40, h: 16 }, 400, 100, 'fill')).toEqual({ x: 1, y: 2, w: 40, h: 16 });
  });
});

describe('слово, разорванное между строками', () => {
  const char = (c: string, x: number, y: number) => ({ char: c, rect: { x, y, w: 5, h: 13 } });

  it('знаки делятся по строкам', () => {
    const lines = groupByLine([char('а', 90, 0), char('б', 95, 0), char('в', 0, 16), char('г', 5, 16)]);
    expect(lines.map((line) => line.map((c) => c.char).join(''))).toEqual(['аб', 'вг']);
  });

  it('слово на одной строке – одна группа', () => {
    expect(groupByLine([char('а', 0, 0), char('б', 5, 0.4)])).toHaveLength(1);
  });

  // Так Chrome отдал «Трудо-вого», перенесённое в русской колонке приказа:
  // дефис [523.6, w4.45] приписан и «о», и «в».
  const box = (x: number, y: number, w: number) => ({ x, y, w, h: 13 });
  const hyphen = box(523.6, 1070.4, 4.45);
  const trudovogo = [
    { char: 'Т', rects: [box(490.2, 1070.4, 7.66)] },
    { char: 'р', rects: [box(497.8, 1070.4, 6.5)] },
    { char: 'у', rects: [box(504.3, 1070.4, 5.84)] },
    { char: 'д', rects: [box(510.2, 1070.4, 6.8)] },
    { char: 'о', rects: [box(516.9, 1070.4, 6.69), hyphen] },
    { char: 'в', rects: [hyphen, box(305.6, 1087.1, 6.2)] },
    { char: 'о', rects: [box(311.8, 1087.1, 6.69)] },
    { char: 'г', rects: [box(318.5, 1087.1, 5.16)] },
    { char: 'о', rects: [box(323.6, 1087.1, 6.67)] },
  ];

  it('дефис переноса – общий прямоугольник двух соседних букв', () => {
    const placed = placeChars(trudovogo);
    expect(placed.map((c) => c.hyphen)).toEqual([null, null, null, null, hyphen, null, null, null, null]);
  });

  it('у буквы после переноса – её собственное место на новой строке', () => {
    const placed = placeChars(trudovogo);
    expect(placed[5]?.rect).toEqual(box(305.6, 1087.1, 6.2));
    expect(groupByLine(placed).map((line) => line.map((c) => c.char).join(''))).toEqual(['Трудо', 'вого']);
  });

  it('разрыв без переноса (длинная строка без пробелов) – без дефиса', () => {
    const placed = placeChars([
      { char: 'f', rects: [box(90, 0, 5)] },
      { char: 's', rects: [box(0, 16, 5)] },
    ]);
    expect(placed.map((c) => c.hyphen)).toEqual([null, null]);
    expect(groupByLine(placed)).toHaveLength(2);
  });

  it('знак без прямоугольника пропускается', () => {
    expect(placeChars([{ char: '­', rects: [] }, { char: 'а', rects: [box(0, 0, 5)] }]).map((c) => c.char)).toEqual(['а']);
  });
});

describe('цвет', () => {
  it('rgb и rgba из вычисленного стиля', () => {
    expect(parseRgb('rgb(0, 0, 0)')).toEqual([0, 0, 0, 1]);
    expect(parseRgb('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30, 0.5]);
    expect(parseRgb('rgba(0, 0, 0, 0)')).toEqual([0, 0, 0, 0]);
    expect(parseRgb('rgb(10 20 30 / 50%)')).toEqual([10, 20, 30, 0.5]);
  });

  it('другую запись разбирает браузер', () => {
    expect(parseRgb('oklch(0.7 0.1 250)')).toBeNull();
    expect(parseRgb('color(srgb 1 0 0)')).toBeNull();
  });

  it('полупрозрачный цвет на белом листе', () => {
    expect(onWhite([0, 0, 0, 1])).toEqual([0, 0, 0]);
    expect(onWhite([0, 0, 0, 0.5])).toEqual([128, 128, 128]);
  });
});

describe('прописные в шапке', () => {
  it('казахские буквы становятся прописными', () => {
    expect(transformText('жауапкершілігі шектеулі серіктестік', 'uppercase', 'kk')).toBe(
      'ЖАУАПКЕРШІЛІГІ ШЕКТЕУЛІ СЕРІКТЕСТІК',
    );
    expect(transformText('әғқңөұүһ', 'uppercase', 'kk')).toBe('ӘҒҚҢӨҰҮҺ');
  });

  it('без преобразования текст как есть', () => {
    expect(transformText('ТОО «ExLumen»', 'none', 'ru')).toBe('ТОО «ExLumen»');
  });
});
