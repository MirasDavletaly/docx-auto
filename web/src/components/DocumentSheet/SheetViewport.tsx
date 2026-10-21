/**
 * Окно просмотра листа.
 *
 * Лист имеет настоящую ширину — 210 мм. Он не «подгоняется» под экран
 * резиновой вёрсткой, потому что тогда строка документа на экране и на бумаге
 * будет разной длины, и предпросмотр перестанет быть честным. Вместо этого
 * лист целиком уменьшается, как если отодвинуть бумагу от глаз.
 *
 * При печати уменьшение снимается: на бумагу идёт настоящий размер.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import styles from './SheetViewport.module.css';

import type { ReactNode } from 'react';

export function SheetViewport({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | null>(null);

  const measure = useCallback(() => {
    const frame = frameRef.current;
    const inner = innerRef.current;
    if (frame === null || inner === null) return;

    const available = frame.clientWidth;
    const natural = inner.offsetWidth;
    if (natural === 0) return;

    // Увеличивать лист не нужно: крупнее бумаги он выглядеть не должен.
    const next = Math.min(1, available / natural);
    setScale(next);
    setHeight(inner.offsetHeight * next);
  }, []);

  useLayoutEffect(() => {
    measure();

    const observer = new ResizeObserver(measure);
    if (frameRef.current !== null) observer.observe(frameRef.current);
    if (innerRef.current !== null) observer.observe(innerRef.current);

    return () => observer.disconnect();
  }, [measure]);

  return (
    <div className={styles.frame} ref={frameRef}>
      <div
        className={styles.spacer}
        style={height === null ? undefined : { height: `${Math.round(height)}px` }}
      >
        <div
          className={styles.inner}
          data-sheet-viewport=""
          ref={innerRef}
          style={{ transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
