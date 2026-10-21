/**
 * Переключатель языка интерфейса.
 *
 * Стоит и в боковой панели, и на экранах входа: язык выбирают до того, как
 * вошли, а не только после («Тест день 2»). Выбор запоминается в браузере и
 * переживает выход из системы.
 */
import { useLanguage } from '@/app/App';
import { t } from '@/i18n';
import { cx } from '@/utils/cx';

import styles from './LanguageSwitch.module.css';

import type { Lang } from '@/i18n';

const LANGS: Lang[] = ['ru', 'en'];

interface Props {
  /** `dark` – на тёмной боковой панели, `light` – на светлом листе входа. */
  tone?: 'dark' | 'light';
}

export function LanguageSwitch({ tone = 'dark' }: Props) {
  const { lang, switchTo } = useLanguage();

  return (
    <div
      className={cx(styles.switch, tone === 'light' && styles.light)}
      role="group"
      aria-label={t.nav.language}
    >
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          className={cx(styles.button, lang === code && styles.active)}
          onClick={() => switchTo(code)}
          aria-pressed={lang === code}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
