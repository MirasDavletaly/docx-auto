/**
 * Вход.
 *
 * Слева — «стол»: тёмная половина с именем системы. Справа — белый лист с
 * формой. Тот же приём, что и на рабочих экранах, поэтому человек узнаёт
 * систему ещё до того, как вошёл.
 *
 * Вход проверяет сервер. Ответ на неудачу всегда один и тот же: «неверный
 * логин или пароль» – и при блокировке после пяти попыток тоже: по разнице
 * в сообщениях подбирают существующие логины (CLAUDE.md, п. 3.8). Отдельно
 * называются только ограничение частоты и недоступный сервер – они не
 * говорят ничего о самой учётной записи.
 */
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { LanguageSwitch } from '@/components/LanguageSwitch/LanguageSwitch';
import { t } from '@/i18n';
import { useSession } from '@/store/session';

import styles from './LoginPage.module.css';

import type { FormEvent } from 'react';

export default function LoginPage() {
  const { signIn, signedOutForIdle, user, restoring } = useSession();
  const navigate = useNavigate();

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Вход восстановлен по refresh-cookie – на рабочий стол.
  if (restoring) return null;
  if (user !== null) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setBusy(true);
    setError(null);

    const result = await signIn(login, password);
    setBusy(false);

    if (result !== 'ok') {
      setError(
        result === 'throttled'
          ? t.auth.throttled
          : result === 'unavailable'
            ? t.auth.unavailable
            : t.auth.failed,
      );
      return;
    }

    navigate('/', { replace: true });
  }

  return (
    <main className={styles.page}>
      <aside className={styles.desk}>
        <div className={styles.deskTop}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              DF
            </span>
            <span className={styles.brandName}>{t.app.name}</span>
          </div>
          {/* Язык выбирают до входа: человеку, который не читает по-русски,
              экран входа тоже должен быть понятен («Тест день 2»). */}
          <LanguageSwitch />
        </div>
        <p className={styles.deskLine}>{t.auth.subtitle}</p>
        <div className={styles.deskFoot}>{t.app.tagline}</div>
      </aside>

      <section className={styles.sheet}>
        <form className={styles.form} onSubmit={(e) => void handleSubmit(e)} noValidate>
          <h1 className={styles.title}>{t.auth.title}</h1>

          {signedOutForIdle && error === null ? (
            <p className={styles.notice} role="status">
              {t.auth.idleSignedOut}
            </p>
          ) : null}

          <label className={styles.field}>
            <span className={styles.label}>{t.auth.login}</span>
            <input
              className={styles.input}
              type="text"
              name="login"
              autoComplete="username"
              autoFocus
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
            <span className={styles.hint}>{t.auth.loginHint}</span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>{t.auth.password}</span>
            <input
              className={styles.input}
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error === null ? null : (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button className={styles.submit} type="submit" disabled={busy}>
            {busy ? t.auth.submitting : t.auth.submit}
          </button>
        </form>
      </section>
    </main>
  );
}
