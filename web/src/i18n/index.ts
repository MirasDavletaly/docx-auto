/**
 * Точка доступа к строкам интерфейса.
 *
 * Экраны обращаются только к `t` и про язык ничего не знают. Переключение
 * подменяет словарь и перерисовывает дерево (`App` держит язык в состоянии),
 * поэтому ни один компонент при добавлении казахского не изменится. Экраны
 * при этом не пересоздаются: начатая правка переживает смену языка.
 *
 * Документы при этом не переводятся: приказ – юридический документ на том
 * языке, на котором он выпущен, и переводить его формулировки здесь значило
 * бы выпустить бумагу, которую нельзя подписать.
 */
import { en } from './en';
import { ru } from './ru';

import type { Dictionary } from './ru';

export type Lang = 'ru' | 'en';

const dictionaries: Record<Lang, Dictionary> = { ru, en };

const STORAGE_KEY = 'docflow.lang';

export function readLanguage(): Lang {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'en' || raw === 'ru') return raw;
  } catch {
    // Хранилище недоступно – остаёмся на русском.
  }
  return 'ru';
}

/**
 * Живой словарь.
 *
 * `export let` даёт связанным импортам живую привязку: после подмены
 * все компоненты при следующей отрисовке читают уже новый словарь.
 */
export let t: Dictionary = dictionaries[readLanguage()];

export let lang: Lang = readLanguage();

export function setLanguage(next: Lang): void {
  lang = next;
  t = dictionaries[next];

  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Не запомнилось – язык вернётся к русскому после перезагрузки.
  }

  document.documentElement.lang = next;
}

export type { Dictionary };
