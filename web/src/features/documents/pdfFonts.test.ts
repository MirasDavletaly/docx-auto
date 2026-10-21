/**
 * Казахские буквы в PDF (CLAUDE.md, п. 2): у каждого начертания шрифта PDF
 * есть все буквы документов группы, и в файле они остаются текстом – у
 * каждой есть запись в карте Unicode, по которой текст выделяется, копируется
 * и ищется.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';

import { toBase64 } from './pdfFonts';

const FONTS = resolve(__dirname, '..', '..', 'assets', 'fonts');

const STYLES = [
  ['normal', 'tinos-regular.ttf'],
  ['bold', 'tinos-bold.ttf'],
  ['italic', 'tinos-italic.ttf'],
  ['bolditalic', 'tinos-bold-italic.ttf'],
] as const;

const KAZAKH = 'әғқңөұүһіӘҒҚҢӨҰҮҺІ';
const RUSSIAN = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
// Длинное тире – кодом: в строках проекта его нет, но человек может вписать
// его в поле, и в PDF оно должно выйти.
const SIGNS = '№«»–—…“”„’ ,.;:!?()[]/%-_*0123456789';

function fileOf(name: string): string {
  const bytes = readFileSync(resolve(FONTS, name));
  return toBase64(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
}

function documentWith(style: string, file: string): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.addFileToVFS(file, fileOf(file));
  pdf.addFont(file, 'Tinos', style);
  pdf.setFont('Tinos', style);
  return pdf;
}

describe('шрифт PDF', () => {
  it.each(STYLES)('%s: есть все казахские и русские буквы и знаки документов', (style, file) => {
    const pdf = documentWith(style, file);
    const font = pdf.getFont() as unknown as { metadata: { characterToGlyph(code: number): number } };
    const missing = [...(KAZAKH + RUSSIAN + SIGNS + 'ABCxyz')].filter(
      (char) => char !== ' ' && font.metadata.characterToGlyph(char.codePointAt(0) ?? 0) === 0,
    );
    expect(missing).toEqual([]);
  });

  it.each(STYLES)('%s: казахские буквы в файле – текст с картой Unicode', (style, file) => {
    const pdf = documentWith(style, file);
    pdf.text(`Бұйрық ${KAZAKH}`, 20, 20);
    const output = pdf.output();
    for (const char of KAZAKH) {
      const code = (char.codePointAt(0) ?? 0).toString(16).padStart(4, '0');
      // Запись «номер знака в шрифте → буква». Номер 0 – пустой знак.
      expect(output, `нет буквы ${char} в карте Unicode`).toMatch(new RegExp(`<(?!0000)[0-9a-f]{4}><${code}>`, 'u'));
    }
  });

  it('в файл кладутся только использованные знаки, а не весь шрифт', () => {
    const pdf = documentWith('normal', 'tinos-regular.ttf');
    pdf.text('Бұйрық', 20, 20);
    const size = pdf.output('arraybuffer').byteLength;
    expect(size).toBeLessThan(readFileSync(resolve(FONTS, 'tinos-regular.ttf')).byteLength / 2);
  });
});
