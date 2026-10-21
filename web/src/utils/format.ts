/**
 * Приведение значений к виду, принятому в документах.
 *
 * Деньги и даты в документе имеют юридические последствия, поэтому
 * форматирование собрано в одном месте, а не повторяется по экранам.
 */

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
] as const;

/** Дата в документе: «21 сентября 2026 г.» */
export function formatDocumentDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const month = MONTHS_GENITIVE[date.getMonth()] ?? '';
  return `${date.getDate()} ${month} ${date.getFullYear()} г.`;
}

/** Дата в списках: «21.09.2026» */
export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/**
 * Смещение Казахстана от UTC в минутах.
 *
 * С 1 марта 2024 года вся страна живёт по UTC+5. Считаем от UTC сами, а не
 * через часовой пояс браузера: у компьютера с устаревшей базой часовых поясов
 * «Asia/Almaty» до сих пор UTC+6, и время создания документа уехало бы на
 * час. Когда появится сервер, пояс будет браться из настроек компании
 * (CLAUDE.md, п. 3.9).
 */
const KZ_UTC_OFFSET_MINUTES = 5 * 60;

/** Момент времени в списках и карточке документа: «21.09.2026, 14:05». */
export function formatDateTime(iso: string): string {
  const moment = Date.parse(iso);
  if (Number.isNaN(moment)) return iso;

  const local = new Date(moment + KZ_UTC_OFFSET_MINUTES * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    `${pad(local.getUTCDate())}.${pad(local.getUTCMonth() + 1)}.${local.getUTCFullYear()}, ` +
    `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`
  );
}

/**
 * Сумма с разделением разрядов неразрывным пробелом: «450 000».
 *
 * Значение приходит строкой и строкой же остаётся: числа с плавающей точкой
 * для денег запрещены (CLAUDE.md, п. 3.9), и сайт их не вводит даже временно.
 */
export function formatMoney(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits === '') return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}

/** Время суток для приветствия на рабочем столе. */
export function partOfDay(now: Date = new Date()): 'morning' | 'day' | 'evening' {
  const h = now.getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'day';
  return 'evening';
}

/**
 * Казахские месяцы в той форме, в какой они стоят в дате решения:
 * «2026 жылғы 24 тамызындағы шешіміне сәйкес».
 *
 * ПРОВЕРИТЬ КАЗАХОЯЗЫЧНОМУ ЮРИСТУ. Достоверно известны две формы – «тамызындағы»
 * из приказа «Order EA Dinara Kakimova» и «қыркүйегіндегі» из правки человека.
 * Остальные десять записаны по тому же правилу и могут быть неверны. Это
 * закрытый список из двенадцати слов: поправить его – одна строка на месяц.
 */
const MONTHS_KK_IN_DATE = [
  'қаңтарындағы',
  'ақпанындағы',
  'наурызындағы',
  'сәуіріндегі',
  'мамырындағы',
  'маусымындағы',
  'шілдесіндегі',
  'тамызындағы',
  'қыркүйегіндегі',
  'қазанындағы',
  'қарашасындағы',
  'желтоқсанындағы',
] as const;

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/**
 * Дата словами на языке колонки.
 *
 * Нужна там, где в документах группы дата написана прописью, а не числами:
 * «2026 жылғы 24 тамызындағы» / «24 августа 2026» / «August 24, 2026».
 * Слова вокруг («жылғы шешіміне», «года», «dated») ставит сам шаблон.
 */
export function formatLongDate(iso: string, lang: 'kk' | 'ru' | 'en'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  const day = date.getDate();
  const year = date.getFullYear();
  const index = date.getMonth();

  if (lang === 'kk') return `${year} жылғы ${day} ${MONTHS_KK_IN_DATE[index] ?? ''}`;
  if (lang === 'en') return `${MONTHS_EN[index] ?? ''} ${day}, ${year}`;
  return `${day} ${MONTHS_GENITIVE[index] ?? ''} ${year}`;
}
