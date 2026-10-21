import { describe, expect, it } from 'vitest';

import { pdfFileName } from './exportPdf';

describe('имя файла PDF', () => {
  it('название и номер', () => {
    expect(pdfFileName('Приказ о приёме на работу', '12-К/2026')).toBe(
      'Приказ о приёме на работу № 12-К-2026.pdf',
    );
  });

  it('без номера – одно название', () => {
    expect(pdfFileName('Доверенность', null)).toBe('Доверенность.pdf');
  });

  it('знаки, запрещённые в именах файлов Windows, заменяются', () => {
    expect(pdfFileName('Акт: «сверка» *2026*?', null)).toBe('Акт- «сверка» -2026-.pdf');
  });
});
