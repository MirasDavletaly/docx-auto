/**
 * Общее для вкладок админ-панели.
 */
import { t } from '@/i18n';

import styles from './AdminPage.module.css';

import type { Subject } from '@/access/policy';

export interface TabProps {
  subject: Subject;
  query: string;
}

export function NothingFound() {
  return <p className={styles.muted}>{t.admin.nothingFound}</p>;
}
