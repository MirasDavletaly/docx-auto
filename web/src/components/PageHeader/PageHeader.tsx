/** Шапка рабочего экрана: заголовок, пояснение и место под действия. */
import styles from './PageHeader.module.css';

import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, eyebrow, actions }: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        {eyebrow === undefined ? null : <div className={styles.eyebrow}>{eyebrow}</div>}
        <h1 className={styles.title}>{title}</h1>
        {subtitle === undefined ? null : <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions === undefined ? null : <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
