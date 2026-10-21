/**
 * Перенос из этого браузера на сервер (этап 1а).
 *
 * Виден, пока в браузере лежат учётные записи и компании прежней версии
 * (`store/legacy.ts`). Переносит администратор платформы, один раз и только
 * в пустую базу – это решает сервер; здесь только кнопка и итог.
 */
import { useState } from 'react';

import { t } from '@/i18n';
import { useSession } from '@/store/session';

import styles from './AdminPage.module.css';

import type { ImportOutcome } from '@/store/accounts';
import type { LegacySnapshot } from '@/store/legacy';

export function ImportCard({ legacy }: { legacy: LegacySnapshot }) {
  const { importLegacy, forgetLegacy } = useSession();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);

  async function run() {
    setBusy(true);
    setOutcome(await importLegacy());
    setBusy(false);
  }

  return (
    <section className={styles.form} aria-labelledby="import-title">
      <div className={styles.fieldLabel} id="import-title">
        {t.admin.importTitle}
      </div>
      <p className={styles.sectionBody}>{t.admin.importBody}</p>
      <p className={styles.sectionBody}>
        {t.admin.importCompanies}: <span className="tabular">{legacy.companies.length}</span>
        {' · '}
        {t.admin.importUsers}: <span className="tabular">{legacy.users.length}</span>
      </p>

      {outcome === null ? null : outcome.ok ? (
        <div role="status">
          <p className={styles.ok}>{t.admin.importDone}</p>
          <p className={styles.sectionBody}>
            {t.admin.importCompanies}: <span className="tabular">{outcome.result.companies}</span>
            {' · '}
            {t.admin.importUsers}: <span className="tabular">{outcome.result.users}</span>
          </p>
          {outcome.result.skipped.length === 0 ? null : (
            <p className={styles.sectionBody}>
              {t.admin.importSkipped}: {outcome.result.skipped.join(', ')}
            </p>
          )}
          {outcome.dropped.length === 0 ? null : (
            <p className={styles.sectionBody}>
              {t.admin.importDropped}: {outcome.dropped.join(', ')}
            </p>
          )}
          {outcome.imagesFailed ? <p className={styles.error}>{t.admin.importImagesFailed}</p> : null}
        </div>
      ) : (
        <p className={styles.error} role="alert">
          {outcome.message}
        </p>
      )}

      {outcome?.ok === true ? null : (
        <div className={styles.rowActions}>
          <button type="button" className={styles.primary} disabled={busy} onClick={() => void run()}>
            {busy ? t.admin.importRunning : t.admin.importSubmit}
          </button>
          <button
            type="button"
            className={styles.secondary}
            disabled={busy}
            onClick={() => {
              if (window.confirm(t.admin.importForgetConfirm)) forgetLegacy();
            }}
          >
            {t.admin.importForget}
          </button>
        </div>
      )}
    </section>
  );
}
