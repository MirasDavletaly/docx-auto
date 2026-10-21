/**
 * Рабочий стол.
 *
 * Первое, что видит человек после входа: счётчики и последние документы.
 * Блок «Частые документы» убран по просьбе человека («Тест день 2»): создать
 * документ можно из каталога, а повторять его на рабочем столе незачем.
 *
 * Все числа здесь настоящие: они считаются по документам, которые человеку
 * видны в текущей компании.
 */
import { Link } from 'react-router-dom';

import { can } from '@/access/policy';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { StatusStamp } from '@/components/StatusStamp/StatusStamp';
import { t } from '@/i18n';
import { documentTitle } from '@/i18n/content';
import { documentSubject, personName } from '@/i18n/person';
import { useSession } from '@/store/session';
import { formatShortDate, partOfDay } from '@/utils/format';

import styles from './DashboardPage.module.css';

import type { DocumentRecord } from '@/api/types';

/** Сколько последних документов показываем. */
const RECENT_LIMIT = 8;

export default function DashboardPage() {
  const { user, company, documents } = useSession();

  const greeting = {
    morning: t.dashboard.subtitleMorning,
    day: t.dashboard.subtitleDay,
    evening: t.dashboard.subtitleEvening,
  }[partOfDay()];

  // Удалённых документов в списке сессии уже нет: их место – корзина
  // админ-панели (`visibleDocuments`).
  const alive = documents;
  const seesAll = can({ user, companyId: company?.id ?? null }, 'documents.viewAll');

  const counters = [
    { key: 'drafts', label: t.dashboard.counters.drafts, value: countBy(alive, 'draft') },
    { key: 'saved', label: t.dashboard.counters.saved, value: countBy(alive, 'saved') },
    {
      key: 'mine',
      label: t.dashboard.counters.mine,
      value: alive.filter((d) => d.authorId === user?.id).length,
    },
  ];

  const recent = alive.slice(0, RECENT_LIMIT);

  return (
    <div className={styles.page}>
      <PageHeader eyebrow={greeting} title={user === null ? t.dashboard.title : personName(user.displayName)} />

      <div className={styles.body}>
        <section className={styles.counters} aria-label={t.dashboard.title}>
          {counters.map((counter) => (
            <div key={counter.key} className={styles.counter}>
              <div className={`${styles.counterValue} tabular`}>{counter.value}</div>
              <div className={styles.counterLabel}>{counter.label}</div>
            </div>
          ))}
        </section>

        <section className={styles.block}>
          <div className={styles.blockHead}>
            <h2 className={styles.blockTitle}>{t.dashboard.recentTitle}</h2>
            {alive.length === 0 ? null : (
              <Link className={styles.blockLink} to="/documents">
                {seesAll ? t.nav.companyDocuments : t.dashboard.recentAll}
              </Link>
            )}
          </div>

          {recent.length === 0 ? (
            <p className={styles.blockBody}>{t.dashboard.recentEmpty}</p>
          ) : (
            <ul className={styles.recentList}>
              {recent.map((doc) => (
                <li key={doc.id}>
                  <Link className={styles.recentItem} to={`/documents/${doc.id}`}>
                    <span className={styles.recentTitle}>{documentTitle(doc)}</span>
                    <span className={styles.recentSubject}>{documentSubject(doc)}</span>
                    <StatusStamp status={doc.status} size="sm" />
                    <span className={`${styles.recentDate} tabular`}>
                      {formatShortDate(doc.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function countBy(documents: DocumentRecord[], status: DocumentRecord['status']): number {
  return documents.filter((d) => d.status === status).length;
}
