/**
 * Вкладка «Настройки»: адреса для входа в панель и сброс базы.
 *
 * Часть админ-панели (`AdminPage.tsx`): что в ней видно, решает политика по
 * правам, а не проверка роли на экране.
 */
import { useState } from 'react';

import { t } from '@/i18n';
import { resetDb } from '@/store/db';
import { useSession } from '@/store/session';
import { cx } from '@/utils/cx';
import { isValidAddress } from '@/utils/ip';

import styles from './AdminPage.module.css';

import type { AllowedAddress } from '@/api/types';

export function SettingsTab() {
  const { settings, saveSettings } = useSession();
  // Список «кому разрешено»: название и адрес в одной строке («Тест день 2»).
  const [rows, setRows] = useState<AllowedAddress[]>(settings.adminIpAllowList);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function change(index: number, patch: Partial<AllowedAddress>) {
    setSaved(false);
    setError(null);
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <section className={styles.section}>
      <p className={styles.sectionBody}>{t.admin.settingsBody}</p>

      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault();
          const filled = rows
            .map((row) => ({ ip: row.ip.trim(), name: row.name.trim() }))
            .filter((row) => row.ip !== '');
          const wrong = filled.find((row) => !isValidAddress(row.ip));
          if (wrong !== undefined) {
            setError(`${t.admin.ipInvalid} ${wrong.ip}`);
            return;
          }
          saveSettings({ adminIpAllowList: filled });
          setRows(filled);
          setSaved(true);
        }}
      >
        <div className={styles.fieldLabel}>{t.admin.ipTitle}</div>
        <p className={styles.fieldHint}>{t.admin.ipBody}</p>

        {rows.length === 0 ? <p className={styles.muted}>{t.admin.ipEmpty}</p> : null}

        {rows.map((row, index) => (
          <div key={index} className={styles.ipRow}>
            <input
              className={styles.input}
              value={row.name}
              placeholder={t.admin.ipNamePlaceholder}
              aria-label={t.admin.ipName}
              onChange={(e) => change(index, { name: e.target.value })}
            />
            <input
              className={cx(styles.input, 'tabular')}
              value={row.ip}
              placeholder={t.admin.ipPlaceholder}
              aria-label={t.admin.ipAddress}
              onChange={(e) => change(index, { ip: e.target.value })}
            />
            <button
              type="button"
              className={styles.danger}
              onClick={() => {
                setSaved(false);
                setRows((prev) => prev.filter((_, i) => i !== index));
              }}
            >
              {t.common.remove}
            </button>
          </div>
        ))}

        {error === null ? null : (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.rowActions}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              setSaved(false);
              setRows((prev) => [...prev, { ip: '', name: '' }]);
            }}
          >
            {t.admin.ipAdd}
          </button>
          {saved ? <span className={styles.ok}>{t.profile.saved}</span> : null}
          <button type="submit" className={styles.primary}>
            {t.common.save}
          </button>
        </div>
      </form>

      <div className={styles.dangerZone}>
        <div className={styles.fieldLabel}>{t.admin.resetTitle}</div>
        <p className={styles.sectionBody}>{t.admin.resetBody}</p>
        <button
          type="button"
          className={styles.danger}
          onClick={() => {
            if (window.confirm(t.admin.resetConfirm)) {
              resetDb();
              window.location.assign('/');
            }
          }}
        >
          {t.admin.resetAction}
        </button>
      </div>
    </section>
  );
}
