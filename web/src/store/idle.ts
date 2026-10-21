/**
 * Выход после бездействия.
 *
 * Компьютер кадровика или бухгалтера оставили открытым – через 30 минут без
 * нажатий, движения мыши и прокрутки вход завершается сам, и следующему
 * человеку за этим столом нужен пароль (проверка безопасности 29.09; OWASP
 * ASVS 5.0, V7.3.1). Черновики формы сохраняются по ходу ввода, поэтому
 * выход работу не теряет.
 *
 * Отметка о последнем действии лежит в `sessionStorage` рядом со входом:
 * перезагрузка страницы после долгой паузы вход не возвращает. Проверка –
 * раз в 15 секунд и при возврате на вкладку: пока компьютер спал, таймеры
 * стояли, а часы шли.
 *
 * ЧЕГО ЭТО НЕ ДЕЛАЕТ. Срок бездействия считает сайт, и через инструменты
 * разработчика его продлят. Сервер ограничивает вход своими сроками: access
 * – 10 минут, refresh – 12 часов (CLAUDE.md, п. 3.8); выход по бездействию
 * отзывает refresh на сервере.
 */
import { useEffect, useRef } from 'react';

/** Сколько можно не работать, прежде чем вход завершится. */
export const IDLE_LIMIT_MS = 30 * 60_000;

const CHECK_EVERY_MS = 15_000;
/** Отметка в хранилище – не чаще раза в 10 секунд: мышь двигается постоянно. */
const WRITE_EVERY_MS = 10_000;
const ACTIVITY_KEY = 'docflow.activity';
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

function readActivity(): number | null {
  try {
    const raw = sessionStorage.getItem(ACTIVITY_KEY);
    const at = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(at) ? at : null;
  } catch {
    return null;
  }
}

function writeActivity(at: number): void {
  try {
    sessionStorage.setItem(ACTIVITY_KEY, String(at));
  } catch {
    // Хранилище недоступно – срок считается в памяти до перезагрузки.
  }
}

/** Стирает отметку: при выходе, чтобы следующий вход начинался с нуля. */
export function forgetActivity(): void {
  try {
    sessionStorage.removeItem(ACTIVITY_KEY);
  } catch {
    // Нечего чистить.
  }
}

/**
 * Пока `active`, следит за действиями человека и вызывает `onIdle`, когда
 * с последнего прошло `IDLE_LIMIT_MS`. Сразу при включении – тоже: страницу
 * могли перезагрузить после долгой паузы.
 */
export function useIdleTimeout(active: boolean, onIdle: () => void): void {
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!active) return undefined;

    let last = readActivity() ?? Date.now();
    let written = 0;
    const touch = () => {
      last = Date.now();
      if (last - written >= WRITE_EVERY_MS) {
        writeActivity(last);
        written = last;
      }
    };
    const check = () => {
      if (Date.now() - last >= IDLE_LIMIT_MS) onIdleRef.current();
    };

    if (readActivity() === null) writeActivity(last);
    check();

    // capture: прокрутка внутри таблицы до window не всплывает.
    const options = { capture: true, passive: true } as const;
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, touch, options);
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, CHECK_EVERY_MS);

    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, touch, options);
      document.removeEventListener('visibilitychange', check);
      window.clearInterval(timer);
    };
  }, [active]);
}
