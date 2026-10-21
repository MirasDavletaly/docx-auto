import { describe, expect, it } from 'vitest';

import { isPdf, sha256Hex } from './pdf';

const encode = (text: string) => new TextEncoder().encode(text);

describe('загрузка PDF', () => {
  it('узнаёт PDF по содержимому', () => {
    expect(isPdf(encode('%PDF-1.7\n%âãÏÓ\n1 0 obj'))).toBe(true);
  });

  it('не пускает переименованный файл другого типа', () => {
    expect(isPdf(encode('MZ\u0090\u0000 это исполняемый файл'))).toBe(false);
    expect(isPdf(encode('PK\u0003\u0004 это docx'))).toBe(false);
    expect(isPdf(new Uint8Array())).toBe(false);
  });

  it('считает SHA-256 так же, как все', async () => {
    const data = encode('abc');
    const copy = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    expect(await sha256Hex(copy)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
