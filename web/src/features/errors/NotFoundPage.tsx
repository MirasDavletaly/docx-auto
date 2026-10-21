import { Link } from 'react-router-dom';

import { t } from '@/i18n';

import styles from './NotFoundPage.module.css';

export default function NotFoundPage() {
  return (
    <main className={styles.page}>
      <div className={styles.code} aria-hidden="true">404</div>
      <h1 className={styles.title}>{t.errors.notFoundTitle}</h1>
      <p className={styles.body}>{t.errors.notFoundBody}</p>
      <Link className={styles.action} to="/">{t.errors.notFoundAction}</Link>
    </main>
  );
}
