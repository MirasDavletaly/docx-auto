/**
 * Длинный список – по сто строк, кнопка «Показать ещё».
 *
 * Реестр, архив и документы в админ-панели рисовали все строки сразу: при
 * 300 документах браузер на каждое нажатие в поиске заново раскладывал и
 * рисовал всю таблицу, и буква в поле появлялась через секунду-три на
 * среднем ноутбуке (замер 01.10). Поиск и счётчик по-прежнему идут по всему
 * списку – ограничено только то, что нарисовано. Сто строк – тот же размер
 * страницы, что у будущего API (CLAUDE.md, п. 3.11).
 */
import { useState } from 'react';

import { t } from '@/i18n';

import styles from './ShowMore.module.css';

export const PAGE_SIZE = 100;

export interface ShowMore<T> {
  shown: T[];
  /** Сколько строк ещё не показано. */
  rest: number;
  showMore: () => void;
}

/**
 * Первые `PAGE_SIZE` строк и ещё по стольку же по кнопке. Сменился
 * `resetKey` (новый поиск, другой фильтр) – снова первые сто.
 */
export function useShowMore<T>(items: T[], resetKey: string): ShowMore<T> {
  const [state, setState] = useState({ key: resetKey, limit: PAGE_SIZE });
  // Новый поиск – с начала. Состояние правится прямо при отрисовке, как
  // советует React для значений, зависящих от пропсов: без лишнего прохода.
  if (state.key !== resetKey) setState({ key: resetKey, limit: PAGE_SIZE });
  const limit = state.key === resetKey ? state.limit : PAGE_SIZE;

  return {
    shown: items.length <= limit ? items : items.slice(0, limit),
    rest: Math.max(0, items.length - limit),
    showMore: () => setState((prev) => ({ key: prev.key, limit: prev.limit + PAGE_SIZE })),
  };
}

/** Кнопка под списком: «Показать ещё 100 (осталось 150)». Всё показано – её нет. */
export function ShowMoreButton({ rest, showMore }: { rest: number; showMore: () => void }) {
  if (rest === 0) return null;
  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.button} onClick={showMore}>
        {t.common.showMore} <span className="tabular">{Math.min(rest, PAGE_SIZE)}</span> ({t.common.remaining}{' '}
        <span className="tabular">{rest}</span>)
      </button>
    </div>
  );
}
