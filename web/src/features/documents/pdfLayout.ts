/**
 * Расчёты для PDF с настоящим текстом (`exportPdf.ts`): где стоит слово,
 * каким начертанием его набрать, видно ли оно, нужен ли перенос.
 *
 * Здесь нет обращения к странице: всё, что меряет браузер, приходит сюда
 * числами. Поэтому правила проверяются тестами без браузера.
 */

/** Прямоугольник: левый верхний угол, ширина и высота. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PdfFontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

/**
 * Высота строчных знаков над и под базовой линией в долях кегля.
 *
 * У Times New Roman и Tinos они одни: 1825 и 443 единицы из 2048. Браузер
 * отдаёт прямоугольник слова от верха выносных до низа нижних выносных, и по
 * этим долям в нём находится базовая линия.
 */
export const ASCENT = 1825 / 2048;
export const DESCENT = 443 / 2048;

/** Мягкий перенос: на листе не виден, пока строка на нём не рвётся. */
const SOFT_HYPHEN = '­';

/** Куски текста без пробелов – слова – с их местом в строке узла. */
export function wordSpans(text: string): Array<{ start: number; end: number }> {
  const spans: Array<{ start: number; end: number }> = [];
  // \s ловит и неразрывный пробел: им держат пустую строку подписи, рисовать
  // в нём нечего.
  for (const match of text.matchAll(/\S+/gu)) {
    spans.push({ start: match.index, end: match.index + match[0].length });
  }
  return spans;
}

/** Текст для PDF: без мягких переносов, они на листе не видны. */
export function visibleText(text: string): string {
  return text.replaceAll(SOFT_HYPHEN, '');
}

export function isSoftHyphen(char: string): boolean {
  return char === SOFT_HYPHEN;
}

/** Начертание по вычисленному стилю: полужирный – от 600. */
export function fontStyleOf(weight: string, style: string): PdfFontStyle {
  const bold = Number.parseInt(weight, 10) >= 600;
  const italic = style === 'italic' || style.startsWith('oblique');
  if (bold && italic) return 'bolditalic';
  if (bold) return 'bold';
  return italic ? 'italic' : 'normal';
}

/** Базовая линия строки по прямоугольнику слова. */
export function baselineOf(top: number, height: number): number {
  return top + (height * ASCENT) / (ASCENT + DESCENT);
}

/**
 * Межбуквенный промежуток, при котором слово займёт в PDF ровно столько же,
 * сколько на листе.
 *
 * Шрифты по ширине совпадают с Times New Roman, и разница почти всегда
 * нулевая. Она появляется от разрядки (черта из подчёркиваний сжата на
 * пол-пункта) и от кернинга. Промежуток ставится после каждого знака –
 * так же считает разрядку браузер.
 */
export function charSpaceToFit(target: number, natural: number, count: number): number {
  if (count === 0) return 0;
  const space = (target - natural) / count;
  return Math.abs(space) < 1e-4 ? 0 : space;
}

/** Пересечение двух прямоугольников; `null` – не пересекаются. */
export function intersect(a: Box, b: Box): Box | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  if (right <= x || bottom <= y) return null;
  return { x, y, w: right - x, h: bottom - y };
}

/**
 * Видно ли слово в окне обрезки.
 *
 * По высоте решает середина слова: строка, разорванная между листами,
 * режется между строками текста, и строка целиком либо в окне, либо нет.
 * По ширине слово может выходить за окно – так у черты из подчёркиваний,
 * которая длиннее своей колонки. Тогда его нужно обрезать в PDF.
 */
export function visibilityIn(rect: Box, clip: Box): 'hidden' | 'inside' | 'clipped' {
  const middle = rect.y + rect.h / 2;
  if (middle < clip.y || middle > clip.y + clip.h) return 'hidden';
  if (rect.x + rect.w <= clip.x || rect.x >= clip.x + clip.w) return 'hidden';
  // Полпикселя – округление браузера, а не выход за окно.
  const slack = 0.5;
  return rect.x < clip.x - slack || rect.x + rect.w > clip.x + clip.w + slack ? 'clipped' : 'inside';
}

/**
 * Где на самом деле нарисована картинка в своей рамке: `object-fit: contain`
 * вписывает её с сохранением пропорций и ставит по центру.
 */
export function imageBox(box: Box, naturalWidth: number, naturalHeight: number, fit: string): Box {
  if (fit !== 'contain' || naturalWidth <= 0 || naturalHeight <= 0) return box;
  const scale = Math.min(box.w / naturalWidth, box.h / naturalHeight);
  const w = naturalWidth * scale;
  const h = naturalHeight * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/** Знак слова и все прямоугольники, которые браузер отдал для него. */
export interface CharRects {
  char: string;
  rects: Box[];
}

/** Знак на листе; `hyphen` – дефис переноса, нарисованный после него. */
export interface PlacedChar {
  char: string;
  rect: Box;
  hyphen: Box | null;
}

function sameBox(a: Box, b: Box): boolean {
  const near = (x: number, y: number) => Math.abs(x - y) < 0.01;
  return near(a.x, b.x) && near(a.y, b.y) && near(a.w, b.w) && near(a.h, b.h);
}

/**
 * Место каждого знака слова, разорванного между строками, и дефисы переноса.
 *
 * Дефиса переноса нет в тексте страницы: его рисует браузер, когда у колонки
 * `hyphens: auto` (тело приказа и доверенности). Chrome отдаёт его отдельным
 * прямоугольником и приписывает обеим соседним буквам – последней на строке
 * («о» → [о, дефис]) и первой на следующей («в» → [дефис, в]). Общий
 * прямоугольник двух соседних букв и есть дефис; у каждой буквы остаётся её
 * собственный. Слово, разорванное без переноса (`overflow-wrap: anywhere`),
 * общих прямоугольников не даёт – дефиса нет.
 */
export function placeChars(chars: CharRects[]): PlacedChar[] {
  const hyphens = chars.map(
    (char, index) => char.rects.find((rect) => chars[index + 1]?.rects.some((next) => sameBox(rect, next))) ?? null,
  );
  const placed: PlacedChar[] = [];
  for (const [index, char] of chars.entries()) {
    const after = hyphens[index] ?? null;
    const before = hyphens[index - 1] ?? null;
    const own = char.rects.find(
      (rect) => !(after !== null && sameBox(rect, after)) && !(before !== null && sameBox(rect, before)),
    );
    if (own !== undefined) placed.push({ char: char.char, rect: own, hyphen: after });
  }
  return placed;
}

/** Знаки слова, разбитые по строкам: слово, разорванное переносом. */
export function groupByLine<T extends { rect: Box }>(chars: T[]): T[][] {
  const lines: T[][] = [];
  let current: T[] = [];
  let lineTop = Number.NaN;
  for (const char of chars) {
    const top = char.rect.y;
    if (current.length > 0 && Math.abs(top - lineTop) > char.rect.h / 2) {
      lines.push(current);
      current = [];
    }
    if (current.length === 0) lineTop = top;
    current.push(char);
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

/** Цвет из `rgb()`/`rgba()` вычисленного стиля; другой записи здесь не разобрать. */
export function parseRgb(css: string): [number, number, number, number] | null {
  const match = css.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/u);
  if (match === null) return null;
  const alphaRaw = match[4];
  const alpha =
    alphaRaw === undefined
      ? 1
      : alphaRaw.endsWith('%')
        ? Number.parseFloat(alphaRaw) / 100
        : Number.parseFloat(alphaRaw);
  return [Number(match[1]), Number(match[2]), Number(match[3]), alpha];
}

/** Полупрозрачный цвет на белом листе – непрозрачный цвет того же вида. */
export function onWhite([r, g, b, a]: [number, number, number, number]): [number, number, number] {
  const mix = (channel: number) => Math.round(channel * a + 255 * (1 - a));
  return [mix(r), mix(g), mix(b)];
}

/** `text-transform` листа: шапка набрана прописными. */
export function transformText(text: string, transform: string, lang: string): string {
  if (transform === 'uppercase') return text.toLocaleUpperCase(lang);
  if (transform === 'lowercase') return text.toLocaleLowerCase(lang);
  return text;
}
