/**
 * Скачивание документа файлом PDF без окна печати («Тест день 2»).
 *
 * В файле настоящий текст, а не картинка листа: его можно выделить,
 * скопировать и найти поиском (просьба 12.10: «когда скачиваешь документ,
 * там фото вместо текста»). Лист на экране уже свёрстан браузером – где
 * какое слово, где рвётся строка, где перенос, – поэтому PDF не верстается
 * заново: каждое слово ставится в PDF в ту же точку, где оно стоит на листе,
 * рамки таблиц и черты рисуются линиями, логотип – картинкой. Так файл
 * совпадает с листом, а бланк свёрстан один раз, в `DocumentSheet`.
 *
 * Шрифт в файле – Tinos, по меркам он совпадает с Times New Roman, которым
 * набран лист (`pdfFonts.ts`).
 *
 * Это копия для удобства, а не выпущенный документ. Настоящий PDF с
 * контрольной суммой собирает сервер из снимка значений (CLAUDE.md, п. 3.4) –
 * TODO(phase-04): финальный PDF на сервере. Почему так –
 * docs/adr/0003-pdf-s-tekstom.md.
 *
 * jsPDF грузится только по нажатию кнопки: в основной сборке его нет.
 */
import { PX_PER_MM } from '@/components/DocumentSheet/paginate';

import { addPdfFonts, PDF_FONT_FAMILY } from './pdfFonts';
import {
  baselineOf,
  charSpaceToFit,
  fontStyleOf,
  groupByLine,
  imageBox,
  intersect,
  isSoftHyphen,
  onWhite,
  parseRgb,
  placeChars,
  transformText,
  visibilityIn,
  visibleText,
  wordSpans,
} from './pdfLayout';

import type { Box, CharRects, PdfFontStyle } from './pdfLayout';
import type { jsPDF } from 'jspdf';

const A4_SHORT_MM = 210;
const A4_LONG_MM = 297;

/** Сколько ждать сборки, прежде чем сказать, что не получилось. */
const TIMEOUT_MS = 45_000;

type Rgb = [number, number, number];
type Orientation = 'portrait' | 'landscape';

/**
 * Что нарисовать на странице PDF. Координаты – миллиметры от левого верхнего
 * угла листа, кегль – в пунктах.
 */
type Mark =
  | { kind: 'fill'; box: Box; color: Rgb }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; color: Rgb }
  | { kind: 'image'; image: HTMLImageElement; box: Box; clip: Box | null }
  | {
      kind: 'text';
      text: string;
      x: number;
      baseline: number;
      /** Сколько слово занимает на листе: столько же оно займёт в PDF. */
      width: number;
      size: number;
      font: PdfFontStyle;
      color: Rgb;
      clip: Box | null;
    };

type TextMark = Extract<Mark, { kind: 'text' }>;

interface PageDrawing {
  orientation: Orientation;
  width: number;
  height: number;
  /** Фон, рамки и картинки – под текстом. */
  marks: Mark[];
  texts: TextMark[];
}

export async function exportPdf(root: HTMLElement, fileName: string, title: string): Promise<void> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error('сборка PDF не уложилась во время')), TIMEOUT_MS);
  });
  try {
    await Promise.race([build(root, fileName, title), timeout]);
  } finally {
    window.clearTimeout(timer);
  }
}

async function build(root: HTMLElement, fileName: string, title: string): Promise<void> {
  const pages = Array.from(root.querySelectorAll<HTMLElement>('[data-page]'));
  if (pages.length === 0) throw new Error('на странице нет листа документа');

  // Лист меряется, когда шрифты уже на месте: на компьютере без Times New
  // Roman запасной шрифт листа приходит не сразу, и строки ещё сдвинутся.
  await document.fonts.ready;
  // Всё снимается с листа сразу, до первой паузы: пока грузится jsPDF,
  // раскладка на экране может обновиться.
  const drawings = pages.map(readPage);

  const { jsPDF } = await import('jspdf');
  const first = drawings[0];
  const pdf = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: first === undefined ? 'portrait' : first.orientation,
    compress: true,
  });
  pdf.setProperties({ title, creator: 'DocFlow' });
  await addPdfFonts(
    pdf,
    drawings.flatMap((drawing) => drawing.texts.map((text) => text.font)),
  );
  // Без явного нуля промежуток между буквами одного слова перешёл бы на
  // следующее: jsPDF не пишет его, если он не задан.
  pdf.setCharSpace(0);

  const images = new Map<string, { data: string; alias: string }>();
  for (const [index, drawing] of drawings.entries()) {
    if (index > 0) pdf.addPage('a4', drawing.orientation);
    drawPage(pdf, drawing, images);
  }

  pdf.save(fileName);
}

// ── Снять лист ──────────────────────────────────────────────────────────────

function readPage(page: HTMLElement): PageDrawing {
  const frame = page.getBoundingClientRect();
  // На экране лист уменьшен под ширину окна (`SheetViewport`). Браузер
  // отдаёт размеры уменьшенные, а в PDF нужны настоящие.
  const scale = frame.width / page.offsetWidth || 1;
  const mm = (px: number) => px / scale / PX_PER_MM;
  const toMm = (box: Box): Box => ({
    x: mm(box.x - frame.left),
    y: mm(box.y - frame.top),
    w: mm(box.w),
    h: mm(box.h),
  });

  const pageBox = boxOf(frame);
  const clips = new Map<Element, Box | null>();

  /**
   * Окно, в котором видно содержимое элемента: лист и все предки с
   * `overflow: hidden` – часть строки, разорванной между листами, и черта
   * из подчёркиваний. `null` – не видно ничего.
   */
  function clipOf(element: Element): Box | null {
    if (element === page) return pageBox;
    const known = clips.get(element);
    if (known !== undefined) return known;
    const parent = element.parentElement;
    let clip = parent === null ? pageBox : clipOf(parent);
    const style = getComputedStyle(element);
    if (clip !== null && (style.overflowX !== 'visible' || style.overflowY !== 'visible')) {
      clip = intersect(clip, paddingBox(element, style, scale));
    }
    clips.set(element, clip);
    return clip;
  }

  const marks: Mark[] = [];
  const texts: TextMark[] = [];

  for (const element of page.querySelectorAll<HTMLElement>('*')) {
    const style = getComputedStyle(element);
    if (style.visibility !== 'visible' || element.getClientRects().length === 0) continue;
    const clip = clipOf(element.parentElement ?? page);
    if (clip === null) continue;

    // Фон: у строчного элемента – по куску на каждую строку.
    const background = colorOf(style.backgroundColor);
    if (background[3] > 0) {
      for (const rect of Array.from(element.getClientRects())) {
        const visible = intersect(boxOf(rect), clip);
        if (visible !== null) marks.push({ kind: 'fill', box: toMm(visible), color: onWhite(background) });
      }
    }

    const rect = boxOf(element.getBoundingClientRect());
    for (const line of borderLines(element, style, rect, scale, clip)) {
      marks.push({
        kind: 'line',
        x1: mm(line.x1 - frame.left),
        y1: mm(line.y1 - frame.top),
        x2: mm(line.x2 - frame.left),
        y2: mm(line.y2 - frame.top),
        width: mm(line.width),
        color: line.color,
      });
    }

    if (element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0) {
      const box = imageBox(contentBox(style, rect, scale), element.naturalWidth, element.naturalHeight, style.objectFit);
      const visible = intersect(box, clip);
      if (visible !== null) {
        const whole = visible.w >= box.w - 0.5 && visible.h >= box.h - 0.5;
        marks.push({ kind: 'image', image: element, box: toMm(box), clip: whole ? null : toMm(clip) });
      }
    }
  }

  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    if (parent === null) continue;
    const content = textNode.data;
    const spans = wordSpans(content);
    if (spans.length === 0) continue;

    const style = getComputedStyle(parent);
    if (style.visibility !== 'visible') continue;
    const clip = clipOf(parent);
    if (clip === null) continue;

    const fontPx = Number.parseFloat(style.fontSize);
    const font = fontStyleOf(style.fontWeight, style.fontStyle);
    const color = onWhite(colorOf(style.color));
    const lang = parent.closest('[lang]')?.getAttribute('lang') ?? 'ru';

    const push = (raw: string, rect: Box) => {
      const text = transformText(visibleText(raw), style.textTransform, lang);
      if (text === '') return;
      const visibility = visibilityIn(rect, clip);
      if (visibility === 'hidden') return;
      texts.push({
        kind: 'text',
        text,
        x: mm(rect.x - frame.left),
        baseline: mm(baselineOf(rect.y, rect.h) - frame.top),
        width: mm(rect.w),
        size: fontPx * 0.75,
        font,
        color,
        clip: visibility === 'clipped' ? toMm(clip) : null,
      });
    };

    for (const span of spans) {
      range.setStart(textNode, span.start);
      range.setEnd(textNode, span.end);
      const rects = drawnRects(range.getClientRects());
      const only = rects[0];
      if (only === undefined) continue;
      if (rects.length === 1) {
        push(content.slice(span.start, span.end), only);
        continue;
      }

      // Слово ушло на следующую строку: оно рисуется по строкам, а на месте
      // разрыва – дефис, если его поставил браузер.
      const lines = groupByLine(placeChars(charsOf(textNode, span, range)));
      for (const [index, line] of lines.entries()) {
        const head = line[0];
        const tail = line[line.length - 1];
        if (head === undefined || tail === undefined) continue;
        let raw = line.map((c) => c.char).join('');
        let right = tail.rect.x + tail.rect.w;
        if (index < lines.length - 1) {
          if (tail.hyphen !== null) {
            raw += '-';
            right = tail.hyphen.x + tail.hyphen.w;
          } else if (isSoftHyphen(tail.char)) {
            // Сработал мягкий перенос: дефис стоит на месте самого знака.
            raw += '-';
          }
        }
        push(raw, { x: head.rect.x, y: head.rect.y, w: right - head.rect.x, h: head.rect.h });
      }
    }
  }

  return {
    orientation: page.dataset['orientation'] === 'landscape' ? 'landscape' : 'portrait',
    width: mm(frame.width),
    height: mm(frame.height),
    marks,
    texts,
  };
}

function boxOf(rect: DOMRect): Box {
  return { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
}

/** Прямоугольники, в которых что-то нарисовано: пустые бывают у пробелов на стыке строк. */
function drawnRects(list: DOMRectList): Box[] {
  return Array.from(list)
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map(boxOf);
}

/** Знаки слова и прямоугольники, которые браузер отдал для каждого. */
function charsOf(node: Text, span: { start: number; end: number }, range: Range): CharRects[] {
  const chars: CharRects[] = [];
  for (let i = span.start; i < span.end; ) {
    const code = node.data.codePointAt(i) ?? 0;
    const length = code > 0xffff ? 2 : 1;
    range.setStart(node, i);
    range.setEnd(node, i + length);
    chars.push({ char: node.data.slice(i, i + length), rects: drawnRects(range.getClientRects()) });
    i += length;
  }
  return chars;
}

function px(value: string): number {
  return Number.parseFloat(value) || 0;
}

function paddingBox(element: Element, style: CSSStyleDeclaration, scale: number): Box {
  const rect = boxOf(element.getBoundingClientRect());
  const left = px(style.borderLeftWidth) * scale;
  const top = px(style.borderTopWidth) * scale;
  const right = px(style.borderRightWidth) * scale;
  const bottom = px(style.borderBottomWidth) * scale;
  return { x: rect.x + left, y: rect.y + top, w: rect.w - left - right, h: rect.h - top - bottom };
}

function contentBox(style: CSSStyleDeclaration, rect: Box, scale: number): Box {
  const left = (px(style.borderLeftWidth) + px(style.paddingLeft)) * scale;
  const top = (px(style.borderTopWidth) + px(style.paddingTop)) * scale;
  const right = (px(style.borderRightWidth) + px(style.paddingRight)) * scale;
  const bottom = (px(style.borderBottomWidth) + px(style.paddingBottom)) * scale;
  return { x: rect.x + left, y: rect.y + top, w: rect.w - left - right, h: rect.h - top - bottom };
}

/**
 * Рамка элемента – отрезками. В таблице со слитыми рамками (`border-collapse`)
 * черта идёт посередине между ячейками, то есть по краю ячейки; у остальных
 * она лежит внутри элемента.
 */
function borderLines(
  element: Element,
  style: CSSStyleDeclaration,
  rect: Box,
  scale: number,
  clip: Box,
): Array<{ x1: number; y1: number; x2: number; y2: number; width: number; color: Rgb }> {
  const collapsed =
    (element.tagName === 'TD' || element.tagName === 'TH') &&
    element.closest('table') !== null &&
    getComputedStyle(element.closest('table') as Element).borderCollapse === 'collapse';

  const lines: Array<{ x1: number; y1: number; x2: number; y2: number; width: number; color: Rgb }> = [];
  const sides = [
    ['Top', 'h'],
    ['Bottom', 'h'],
    ['Left', 'v'],
    ['Right', 'v'],
  ] as const;

  for (const [side, direction] of sides) {
    const width = px(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) * scale;
    const kind = style.getPropertyValue(`border-${side.toLowerCase()}-style`);
    const color = colorOf(style.getPropertyValue(`border-${side.toLowerCase()}-color`));
    if (width <= 0 || kind === 'none' || kind === 'hidden' || color[3] === 0) continue;

    const inset = collapsed ? 0 : width / 2;
    if (direction === 'h') {
      const y = side === 'Top' ? rect.y + inset : rect.y + rect.h - inset;
      if (y < clip.y || y > clip.y + clip.h) continue;
      const x1 = Math.max(rect.x, clip.x);
      const x2 = Math.min(rect.x + rect.w, clip.x + clip.w);
      if (x2 > x1) lines.push({ x1, y1: y, x2, y2: y, width, color: onWhite(color) });
    } else {
      const x = side === 'Left' ? rect.x + inset : rect.x + rect.w - inset;
      if (x < clip.x || x > clip.x + clip.w) continue;
      const y1 = Math.max(rect.y, clip.y);
      const y2 = Math.min(rect.y + rect.h, clip.y + clip.h);
      if (y2 > y1) lines.push({ x1: x, y1, x2: x, y2, width, color: onWhite(color) });
    }
  }
  return lines;
}

const colors = new Map<string, [number, number, number, number]>();

/**
 * Цвет вычисленного стиля. Обычно это `rgb()`, но цвета темы заданы
 * современными функциями (`color-mix`, `oklch`) – их переводит в RGB сам
 * браузер, через холст.
 */
function colorOf(css: string): [number, number, number, number] {
  const parsed = parseRgb(css);
  if (parsed !== null) return parsed;
  const known = colors.get(css);
  if (known !== undefined) return known;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  let color: [number, number, number, number] = [0, 0, 0, 1];
  if (context !== null) {
    context.fillStyle = css;
    context.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0, a = 255] = context.getImageData(0, 0, 1, 1).data;
    color = [r, g, b, a / 255];
  }
  colors.set(css, color);
  return color;
}

// ── Нарисовать в PDF ────────────────────────────────────────────────────────

function drawPage(pdf: jsPDF, drawing: PageDrawing, images: Map<string, { data: string; alias: string }>): void {
  const landscape = drawing.orientation === 'landscape';
  const pageWidth = landscape ? A4_LONG_MM : A4_SHORT_MM;
  const pageHeight = landscape ? A4_SHORT_MM : A4_LONG_MM;

  // Лист ровно A4. Если одна строка оказалась выше листа, лист вытянут –
  // тогда он вписывается в страницу целиком, а не обрезается.
  const k = Math.min(1, pageHeight / drawing.height, pageWidth / drawing.width);
  const dx = (pageWidth - drawing.width * k) / 2;
  const x = (value: number) => dx + value * k;
  const y = (value: number) => value * k;
  const size = (value: number) => value * k;

  const withClip = (clip: Box | null, draw: () => void) => {
    if (clip === null) {
      draw();
      return;
    }
    pdf.saveGraphicsState();
    pdf.rect(x(clip.x), y(clip.y), size(clip.w), size(clip.h), null);
    pdf.clip();
    pdf.discardPath();
    draw();
    pdf.restoreGraphicsState();
  };

  // Квадратные концы закрывают углы рамки, где сходятся две черты.
  pdf.setLineCap('square');

  for (const mark of drawing.marks) {
    if (mark.kind === 'fill') {
      pdf.setFillColor(...mark.color);
      pdf.rect(x(mark.box.x), y(mark.box.y), size(mark.box.w), size(mark.box.h), 'F');
    } else if (mark.kind === 'line') {
      pdf.setDrawColor(...mark.color);
      pdf.setLineWidth(size(mark.width));
      pdf.line(x(mark.x1), y(mark.y1), x(mark.x2), y(mark.y2), 'S');
    } else if (mark.kind === 'image') {
      const { image, box } = mark;
      // Один логотип на всех листах – одна картинка в файле.
      const source = image.currentSrc || image.src;
      let stored = images.get(source);
      if (stored === undefined) {
        stored = { data: pngOf(image), alias: `image-${images.size}` };
        images.set(source, stored);
      }
      const { data, alias } = stored;
      withClip(mark.clip, () => pdf.addImage(data, 'PNG', x(box.x), y(box.y), size(box.w), size(box.h), alias));
    }
  }

  for (const text of drawing.texts) {
    pdf.setFont(PDF_FONT_FAMILY, text.font);
    pdf.setFontSize(text.size * k);
    pdf.setTextColor(...text.color);
    const charSpace = charSpaceToFit(size(text.width), pdf.getTextWidth(text.text), [...text.text].length);
    withClip(text.clip, () => pdf.text(text.text, x(text.x), y(text.baseline), { baseline: 'alphabetic', charSpace }));
  }
}

/**
 * Картинка в PNG в её собственном размере: логотип ложится в файл без потери
 * чёткости и с прозрачным фоном.
 */
function pngOf(image: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('браузер не дал холст для логотипа');
  context.drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}

/** Имя файла из названия и номера: без знаков, которые запрещены в Windows. */
export function pdfFileName(title: string, number: string | null): string {
  const base = [title, number === null ? '' : `№ ${number}`].filter(Boolean).join(' ');
  const safe = base.replace(/[\\/:*?"<>|]+/gu, '-').replace(/\s+/gu, ' ').trim();
  return `${safe === '' ? 'document' : safe}.pdf`;
}
