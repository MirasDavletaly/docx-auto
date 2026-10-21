/**
 * Состояние документа.
 *
 * Не «пилюля», как в обычных админках, а штамп: прямоугольная рамка и
 * разрядка прописными. Состояние документа в жизни и есть штамп на бумаге,
 * и человеку понятнее видеть его таким.
 */
import { t } from '@/i18n';

import styles from './StatusStamp.module.css';

import type { DocumentStatus } from '@/api/types';

interface Props {
  status: DocumentStatus;
  size?: 'sm' | 'md';
}

export function StatusStamp({ status, size = 'md' }: Props) {
  return (
    <span className={`${styles.stamp} ${styles[status]} ${size === 'sm' ? styles.sm : ''}`}>
      {t.status[status]}
    </span>
  );
}
