/**
 * Проверка загружаемого PDF.
 *
 * Тип файла определяется по содержимому, а не по расширению и не по тому,
 * что сообщил браузер (CLAUDE.md, п. 3.7): переименованный в «.pdf»
 * исполняемый файл иначе попал бы в архив как документ.
 */

/** Предел размера одного файла. Скан многостраничного приказа укладывается. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** PDF начинается с «%PDF-» – допускается немного мусора перед ним, как у Acrobat. */
export function isPdf(bytes: Uint8Array): boolean {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  return head.includes('%PDF-');
}

/** SHA-256 содержимого шестнадцатеричной строкой. */
export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Содержимое файла. `Blob.arrayBuffer` есть не везде (Safari до 14), поэтому
 * запасной путь – `FileReader`.
 */
export function readBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error('файл не прочитался'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('файл не прочитался'));
    reader.readAsArrayBuffer(blob);
  });
}
