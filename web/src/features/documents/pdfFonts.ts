/**
 * Шрифт текста в PDF – Tinos.
 *
 * Лист набран Times New Roman, но положить его в файл нельзя: шрифт
 * принадлежит Microsoft и не распространяется вместе с сайтом. Tinos – свободный
 * (SIL Open Font License) и сделан по меркам Times New Roman: ширина каждого
 * знака и высота строки совпадают, поэтому строки в PDF рвутся там же, где на
 * листе. Казахские буквы в нём есть (тест `pdfFonts.test.ts`).
 *
 * Файлы те же, что подключены листу запасным шрифтом в `styles/fonts.css`:
 * браузер скачивает их один раз. Грузятся только те начертания, что есть в
 * документе, и только по нажатию «Скачать PDF».
 */
import boldItalicUrl from '@/assets/fonts/tinos-bold-italic.ttf?url';
import boldUrl from '@/assets/fonts/tinos-bold.ttf?url';
import italicUrl from '@/assets/fonts/tinos-italic.ttf?url';
import regularUrl from '@/assets/fonts/tinos-regular.ttf?url';

import type { PdfFontStyle } from './pdfLayout';
import type { jsPDF } from 'jspdf';

/** Имя семейства внутри PDF. */
export const PDF_FONT_FAMILY = 'Tinos';

const URLS: Record<PdfFontStyle, string> = {
  normal: regularUrl,
  bold: boldUrl,
  italic: italicUrl,
  bolditalic: boldItalicUrl,
};

/** Скачанные шрифты в base64 – так их принимает jsPDF. Живут до перезагрузки. */
const cache = new Map<PdfFontStyle, Promise<string>>();

function load(style: PdfFontStyle): Promise<string> {
  let pending = cache.get(style);
  if (pending === undefined) {
    pending = fetch(URLS[style])
      .then((response) => {
        if (!response.ok) throw new Error(`шрифт ${style} не загрузился: ${response.status}`);
        return response.arrayBuffer();
      })
      .then(toBase64);
    // Неудачная загрузка не запоминается: следующее нажатие попробует снова.
    pending.catch(() => cache.delete(style));
    cache.set(style, pending);
  }
  return pending;
}

/** Загружает нужные начертания и подключает их к документу. */
export async function addPdfFonts(pdf: jsPDF, styles: Iterable<PdfFontStyle>): Promise<void> {
  const wanted = [...new Set(styles)];
  const files = await Promise.all(wanted.map(async (style) => [style, await load(style)] as const));
  for (const [style, base64] of files) {
    const file = `${PDF_FONT_FAMILY}-${style}.ttf`;
    pdf.addFileToVFS(file, base64);
    pdf.addFont(file, PDF_FONT_FAMILY, style);
  }
}

export function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // По кускам: строка из полумегабайта аргументов переполнила бы стек.
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
