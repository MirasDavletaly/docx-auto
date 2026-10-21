/**
 * Хранилище файлов архива.
 *
 * Описание файла лежит в общей базе (`localStorage`), а сам файл – в
 * IndexedDB: `localStorage` вмещает несколько мегабайт на весь сайт, а один
 * скан приказа весит столько же.
 *
 * Это временное место. На сервере файлы поедут в MinIO по подписанной ссылке
 * мимо API, с проверкой размера, SHA-256 и антивирусом до выдачи
 * (CLAUDE.md, п. 3.7) – TODO(phase-05): загрузка в MinIO по подписанной ссылке.
 */

const DB_NAME = 'docflow.files';
const STORE = 'files';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB недоступна'));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB не открылась'));
  });
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? new Error('запись файла не удалась'));
      tx.onabort = () => reject(tx.error ?? new Error('запись файла прервана'));
    });
  } finally {
    db.close();
  }
}

/** Кладёт файл под идентификатором записи архива. */
export async function putFile(id: string, blob: Blob): Promise<void> {
  await run('readwrite', (store) => store.put(blob, id));
}

/** Стирает файл. Файла и так нет – не ошибка. */
export async function deleteFile(id: string): Promise<void> {
  await run('readwrite', (store) => store.delete(id));
}

/** Достаёт файл. Нет – `undefined`: запись в базе есть, а файл потерян. */
export async function getFile(id: string): Promise<Blob | undefined> {
  const found = await run<unknown>('readonly', (store) => store.get(id));
  return found instanceof Blob ? found : undefined;
}
