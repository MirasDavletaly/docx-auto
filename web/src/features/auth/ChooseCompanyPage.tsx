/**
 * Выбор компании.
 *
 * Отдельный шаг, а не выпадающий список в углу: работая в четырёх компаниях
 * группы, человек должен осознанно выбрать, от чьего имени он сейчас
 * выпускает документы.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { can } from '@/access/policy';
import { LanguageSwitch } from '@/components/LanguageSwitch/LanguageSwitch';
import { ImportCard } from '@/features/admin/ImportCard';
import { t } from '@/i18n';
import { companyCity, companyDirector, companyName } from '@/i18n/company';
import { useSession } from '@/store/session';
import { buildAccentPalette } from '@/theme/color';

import styles from './ChooseCompanyPage.module.css';

export default function ChooseCompanyPage() {
  // Список компаний берётся из учётной записи, а не из полного справочника:
  // компания, к которой человеку не выдали доступ, не должна даже
  // упоминаться на экране (CLAUDE.md, п. 3.1).
  const { selectCompany, companies, user, legacy } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Компанию закрепляет сервер: новый токен с ней. Без ответа сервера в
  // компанию не входим.
  async function choose(companyId: string) {
    setBusy(true);
    setError(null);
    const outcome = await selectCompany(companyId);
    setBusy(false);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <div className={styles.head}>
          <h1 className={styles.title}>{t.auth.companyTitle}</h1>
          <LanguageSwitch tone="light" />
        </div>
        <p className={styles.body}>{t.auth.companyBody}</p>

        {companies.length === 0 ? <p className={styles.body}>{t.auth.noCompanies}</p> : null}
        {/* Новый сервер пуст: компаний нет, и войти в админ-панель не в
            чем. Перенос из этого браузера – прямо здесь, пока он не сделан
            или не отклонён: после переноса компании появляются, а итог
            (кто пропущен) должен остаться на экране. Разрешает перенос только
            сервер (администратор платформы, пустая база). */}
        {legacy !== null && can({ user, companyId: null }, 'company.create') ? (
          <ImportCard legacy={legacy} />
        ) : null}
        {error === null ? null : (
          <p className={styles.body} role="alert">
            {error}
          </p>
        )}

        <ul className={styles.list}>
          {companies.map((company) => {
            const palette = buildAccentPalette(company.accent);
            return (
              <li key={company.id}>
                <button
                  type="button"
                  className={styles.card}
                  disabled={busy}
                  onClick={() => void choose(company.id)}
                  style={{ '--card-accent': palette.accent } as React.CSSProperties}
                >
                  {/* Компанию выбирают глазами: логотип узнают быстрее,
                      чем название. Букв хватает, пока логотипа нет. */}
                  <span
                    className={company.logo === undefined ? styles.mark : styles.markLogo}
                    aria-hidden="true"
                  >
                    {company.logo === undefined ? (
                      company.monogram
                    ) : (
                      <img className={styles.logo} src={company.logo} alt="" />
                    )}
                  </span>
                  <span className={styles.text}>
                    <span className={styles.name}>{companyName(company)}</span>
                    <span className={styles.meta}>
                      {companyCity(company)} · {companyDirector(company)}
                    </span>
                  </span>

                  {/* Вымышленные компании помечены здесь, а не только внутри:
                      выбор делается на этом экране, и знать про условные
                      реквизиты нужно до него, а не после. */}
                  {company.placeholder === true ? (
                    <span className={styles.placeholder} title={t.auth.companyPlaceholderHint}>
                      {t.auth.companyPlaceholder}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
