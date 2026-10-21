/**
 * Таблица Excel (.xlsx) без сторонних библиотек.
 *
 * «Тест день 3»: «выгружать в архиве реестр документов в Excel. Таблица
 * чёрно-белая, без цветов, без стикеров и стилей». Поэтому здесь ровно
 * столько, сколько нужно для такой таблицы: текст в ячейках, тонкая чёрная
 * рамка, заголовок полужирным, ширина колонок. Ни заливки, ни цвета шрифта,
 * ни условного форматирования.
 *
 * Файл .xlsx – это zip из нескольких XML. Архив собирается без сжатия
 * (метод «stored»): Excel, LibreOffice и Google Таблицы его открывают, а
 * библиотека сжатия ради реестра на сотню строк не нужна (новая зависимость –
 * только через ADR, CLAUDE.md, п. 2).
 *
 * Все значения пишутся текстом (`inlineStr`): номер «07-К» не должен
 * превратиться в число, а дата – в дату другого формата. Формул в файле нет
 * вовсе; текст, который начинается как формула («=», «+», «-», «@»), ещё и
 * помечен «префиксом кавычки» – см. `looksLikeFormula`.
 */

const encoder = new TextEncoder();

/* ── XML ───────────────────────────────────────────────────────────────── */

/** Символы, которых не может быть в XML 1.0, и экранирование разметки. */
function escapeXml(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/gu, '')
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;');
}

/** Номер колонки буквами: 0 – A, 25 – Z, 26 – AA. */
export function columnName(index: number): string {
  let name = '';
  let n = index + 1;
  while (n > 0) {
    const rest = (n - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/** Имя листа: не длиннее 31 знака и без знаков, запрещённых в Excel. */
function sheetName(name: string): string {
  const clean = name.replace(/[[\]:*?/\\]/gu, ' ').trim().slice(0, 31);
  return clean === '' ? 'Sheet1' : clean;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

/**
 * Оформление: 0 – по умолчанию, 1 – ячейка с тонкой чёрной рамкой,
 * 2 – то же полужирным (заголовок), 3 – как 1, но с «префиксом кавычки»
 * (`quotePrefix`). Цвет везде чёрный, заливки нет.
 */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1" quotePrefix="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

const STYLE_CELL = 1;
const STYLE_HEADER = 2;
const STYLE_QUOTED = 3;

/**
 * Текст, который Excel принял бы за формулу, если ячейку открыть и нажать
 * Enter (проверка безопасности 29.09, OWASP «CSV injection»). В реестр
 * попадают названия и описания, которые ввёл пользователь, – строка
 * `=HYPERLINK(…)` не должна стать ссылкой у того, кто открыл выгрузку.
 * Такой ячейке ставится «префикс кавычки»: Excel держит её текстом и после
 * правки, а сам текст не меняется. Полноширинные ＝＋－ – на случай
 * восточноазиатского ввода, где Excel приравнивает их к обычным.
 */
export function looksLikeFormula(value: string): boolean {
  return /^[=+\-@\t\r\uFF1D\uFF0B\uFF0D]/u.test(value);
}

function workbook(name: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName(name))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
}

function worksheet(header: string[], rows: string[][], widths: number[]): string {
  const cols = widths
    .map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`)
    .join('');

  const line = (cells: string[], rowIndex: number, style: number) =>
    `<row r="${rowIndex + 1}">${cells
      .map(
        (value, col) =>
          `<c r="${columnName(col)}${rowIndex + 1}" s="${style === STYLE_CELL && looksLikeFormula(value) ? STYLE_QUOTED : style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`,
      )
      .join('')}</row>`;

  const body = [line(header, 0, STYLE_HEADER), ...rows.map((cells, i) => line(cells, i + 1, STYLE_CELL))].join('');

  // Заголовок закреплён: при прокрутке длинного реестра видно, где какая колонка.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols === '' ? '' : `<cols>${cols}</cols>`}<sheetData>${body}</sheetData></worksheet>`;
}

/* ── ZIP без сжатия ────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (IEEE 802.3), как его считает zip. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

interface Entry {
  name: Uint8Array;
  data: Uint8Array;
  crc: number;
  offset: number;
}

/** Время файла в формате DOS: для архива внутри .xlsx оно не важно. */
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

export function zipStored(files: Array<{ name: string; content: string }>): Uint8Array<ArrayBuffer> {
  const entries: Entry[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const entry: Entry = { name, data, crc: crc32(data), offset };

    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true); // подпись локального заголовка
    header.setUint16(4, 20, true); // версия для распаковки
    header.setUint16(6, 0x0800, true); // имена в UTF-8
    header.setUint16(8, 0, true); // без сжатия
    header.setUint16(10, DOS_TIME, true);
    header.setUint16(12, DOS_DATE, true);
    header.setUint32(14, entry.crc, true);
    header.setUint32(18, data.length, true);
    header.setUint32(22, data.length, true);
    header.setUint16(26, name.length, true);
    header.setUint16(28, 0, true);

    chunks.push(new Uint8Array(header.buffer), name, data);
    offset += 30 + name.length + data.length;
    entries.push(entry);
  }

  const directoryStart = offset;
  for (const entry of entries) {
    const record = new DataView(new ArrayBuffer(46));
    record.setUint32(0, 0x02014b50, true); // подпись записи оглавления
    record.setUint16(4, 20, true);
    record.setUint16(6, 20, true);
    record.setUint16(8, 0x0800, true);
    record.setUint16(10, 0, true);
    record.setUint16(12, DOS_TIME, true);
    record.setUint16(14, DOS_DATE, true);
    record.setUint32(16, entry.crc, true);
    record.setUint32(20, entry.data.length, true);
    record.setUint32(24, entry.data.length, true);
    record.setUint16(28, entry.name.length, true);
    record.setUint32(42, entry.offset, true);

    chunks.push(new Uint8Array(record.buffer), entry.name);
    offset += 46 + entry.name.length;
  }

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // конец оглавления
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, offset - directoryStart, true);
  end.setUint32(16, directoryStart, true);
  chunks.push(new Uint8Array(end.buffer));

  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/* ── Книга ─────────────────────────────────────────────────────────────── */

export interface Sheet {
  name: string;
  header: string[];
  rows: string[][];
  /** Ширина колонок в знаках. */
  widths?: number[];
}

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Книга из одного листа: заголовок и строки, всё текстом. */
export function buildXlsx(sheet: Sheet): Uint8Array<ArrayBuffer> {
  return zipStored([
    { name: '[Content_Types].xml', content: CONTENT_TYPES },
    { name: '_rels/.rels', content: ROOT_RELS },
    { name: 'xl/workbook.xml', content: workbook(sheet.name) },
    { name: 'xl/_rels/workbook.xml.rels', content: WORKBOOK_RELS },
    { name: 'xl/styles.xml', content: STYLES },
    { name: 'xl/worksheets/sheet1.xml', content: worksheet(sheet.header, sheet.rows, sheet.widths ?? []) },
  ]);
}
