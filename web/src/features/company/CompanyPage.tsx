/**
 * Реквизиты компании — отдельной страницей.
 *
 * Эти значения подставляются в каждый документ, поэтому смотреть на них
 * нужно спокойно и целиком, а не сбоку на рабочем столе.
 *
 * Правка доступна директору и администратору. Уже сохранённые документы от
 * неё не меняются: у каждого из них лежит снимок реквизитов на момент
 * сохранения (CLAUDE.md, п. 3.4). Шаблоны, наоборот, всегда показывают
 * текущие значения — это и просил человек.
 */
import { useRef, useState } from 'react';

import { can } from '@/access/policy';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { lang, t } from '@/i18n';
import { companyBasis, companyDirector, companyDirectorTitle } from '@/i18n/company';
import { tc } from '@/i18n/content';
import { englishAddress } from '@/utils/address';
import { useSession } from '@/store/session';
import { missingCases, withCompanyTranslations } from '@/utils/companyTranslations';
import { cx } from '@/utils/cx';
import { formatShortDate } from '@/utils/format';

import styles from './CompanyPage.module.css';

import type { Company, HeadOffice } from '@/api/types';

/** Логотип лежит в хранилище строкой data:URL, поэтому размер ограничен. */
const MAX_LOGO_BYTES = 512 * 1024;

export default function CompanyPage() {
  const { company, user, saveCompany } = useSession();
  const [draft, setDraft] = useState<Company | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (company === null) return null;

  const editable = can({ user, companyId: company.id }, 'company.edit');

  function startEdit() {
    setSaved(false);
    setDraft({ ...(company as Company) });
  }

  // Правка уходит на сервер с версией, которую видел человек: поверх чужой
  // правки она не ляжет – черновик остаётся открытым с объяснением.
  async function commit() {
    if (draft === null || company === null) return;
    setError(null);
    // Сменили руководителя или должность – падеж прежнего человека очищен,
    // и без нового в каждом документе встал бы пропуск.
    if (missingCases(company, draft).length > 0) {
      setError(t.company.genitiveNeeded);
      return;
    }
    const outcome = await saveCompany(draft);
    if (!outcome.ok) {
      setError(outcome.message);
      return;
    }
    setDraft(null);
    setSaved(true);
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={t.company.title}
        actions={
          editable && draft === null ? (
            <button type="button" className={styles.action} onClick={startEdit}>
              {t.company.editAction}
            </button>
          ) : null
        }
      />

      <div className={styles.body}>
        {company.placeholder === true ? (
          <div className={styles.warn} role="note">
            <div className={styles.warnTitle}>{t.company.placeholderTitle}</div>
            <p className={styles.warnBody}>{t.company.placeholderBody}</p>
          </div>
        ) : null}

        {saved ? (
          <div className={styles.saved} role="status">
            <div className={styles.savedTitle}>{t.company.saved}</div>
            <p className={styles.savedBody}>{t.company.snapshotNote}</p>
          </div>
        ) : null}

        {error === null ? null : (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        {draft === null ? (
          <ReadView company={company} />
        ) : (
          <EditView
            original={company}
            draft={draft}
            onChange={setDraft}
            onCancel={() => setDraft(null)}
            onSave={() => void commit()}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Реквизиты на языке интерфейса.
 *
 * На английском в строках стоят английские значения карточки: наименование,
 * адрес, руководитель («Тест день 2»: «реквизиты не переводятся»). Отдельные
 * строки «…на английском» тогда не нужны – они повторили бы то же самое.
 * Строки на казахском на английском экране тоже не показываются: они
 * повторяли бы английское наименование и должность казахскими словами.
 * На русском экране они есть – это реквизиты для казахской колонки бланка.
 */
function ReadView({ company }: { company: Company }) {
  const en = lang === 'en';

  return (
    <>
      {company.logo === undefined ? null : (
        <div className={styles.logoRow}>
          <img className={styles.logo} src={company.logo} alt="" />
          <span className={styles.logoCaption}>{t.company.logo}</span>
        </div>
      )}

      <dl className={styles.requisites}>
        <Requisite
          label={t.company.legalName}
          value={en ? (company.legalNameEn ?? company.legalName) : company.legalName}
        />
        {en ? null : <Requisite label={t.company.legalNameKk} value={company.legalNameKk} />}
        {en ? null : <Requisite label={t.company.legalNameEn} value={company.legalNameEn} />}
        <Requisite label={t.company.bin} value={company.bin} mono />
        <Requisite label={t.company.kbe} value={company.kbe} mono />
        {/* Адрес без английского в карточке собирается по словарю адресных
            слов («город» – «city»), а не показывается по-русски. */}
        <Requisite label={t.company.address} value={en ? addressLineEn(company) : addressLine(company)} />
        {en ? null : <Requisite label={t.company.addressEn} value={company.addressEn} />}
        <Requisite
          label={t.company.actualAddress}
          value={
            en && company.actualAddress !== undefined
              ? (company.actualAddressEn ?? englishAddress(company.actualAddress))
              : company.actualAddress
          }
        />
        <Requisite
          label={t.company.phone}
          // «вн. 144» – добавочный номер; на английском это «ext. 144».
          value={en ? company.phone?.replace(/(^|\s)вн\.\s*/u, '$1ext. ') : company.phone}
        />
        <Requisite label={t.company.email} value={company.email} />
        <Requisite
          label={t.company.director}
          value={`${companyDirectorTitle(company)}, ${companyDirector(company)}`}
        />
        <Requisite label={t.company.directorNameShort} value={company.directorNameShort} />
        {en ? null : <Requisite label={t.company.directorEn} value={company.directorNameEn} />}
        {en ? null : (
          <Requisite label={t.company.directorTitleKk} value={company.directorTitleKk} />
        )}
        {en ? null : (
          <Requisite label={t.company.directorTitleEn} value={company.directorTitleEn} />
        )}
        <Requisite label={t.company.basis} value={companyBasis(company)} />
        <Requisite
          label={t.company.bank}
          value={company.bank === undefined ? undefined : tc(company.bank.name)}
        />
        <Requisite label={t.company.bik} value={company.bank?.bik} mono />
        <Requisite
          label={t.company.taxOffice}
          value={company.taxOffice === undefined ? undefined : tc(company.taxOffice.name)}
        />
        <Requisite label={t.company.taxOfficeBin} value={company.taxOffice?.bin} mono />
        <Requisite label={t.company.vat} value={vatLine(company)} />

        {/* Головной офис есть не у всех: строки появляются только там,
            где он действительно есть. */}
        {company.headOffice === undefined ? null : (
          <>
            <Requisite label={t.company.headOffice} value={company.headOffice.address} />
            <Requisite
              label={t.company.headOfficeContacts}
              value={headOfficeContacts(company.headOffice)}
            />
          </>
        )}
      </dl>

      {company.bank === undefined ? null : (
        <>
          <div className={styles.accountsTitle}>{t.company.accounts}</div>
          <ul className={styles.accounts}>
            {company.bank.accounts.map((account) => (
              <li key={account.iban} className={styles.account}>
                <span className={cx(styles.accountIban, 'tabular')}>{account.iban}</span>
                <span className={styles.accountCurrency}>{account.currency}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

interface EditProps {
  /** Карточка до правки: вернули ФИО как было – зависимое тоже прежнее. */
  original: Company;
  draft: Company;
  onChange: (next: Company) => void;
  onCancel: () => void;
  onSave: () => void;
}

/**
 * Правка реквизитов.
 *
 * Правятся только те поля, которые действительно меняются в жизни компании:
 * наименование, адреса, связь и руководитель. Банк, налоговый орган и НДС
 * приходят выписками и правятся в админ-панели целиком, а не по буквам.
 */
function EditView({ original, draft, onChange, onCancel, onSave }: EditProps) {
  // Казахские и английские реквизиты заполняются сами по правилам
  // (docs/translation-rules.md); поправленное руками не затирается.
  // Руководитель – на всех языках следом за ФИО и должностью, кроме того,
  // что поправили в этой правке (19.10).
  const edited = useRef(new Set<string>());
  const set = (patch: Partial<Company>) => {
    for (const key of Object.keys(patch)) edited.current.add(key);
    onChange(withCompanyTranslations(draft, patch, { original, edited: edited.current }));
  };
  const missing = missingCases(original, draft);
  const fileInput = useRef<HTMLInputElement>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  function pickLogo(file: File | undefined) {
    setLogoError(null);
    if (file === undefined) return;

    if (!file.type.startsWith('image/')) {
      setLogoError(t.company.logoWrongType);
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(t.company.logoTooBig);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') set({ logo: reader.result });
    };
    reader.readAsDataURL(file);
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <div className={styles.logoEdit}>
        <div className={styles.logoBox}>
          {draft.logo === undefined ? (
            <span className={styles.logoMonogram} aria-hidden="true">
              {draft.monogram}
            </span>
          ) : (
            <img className={styles.logo} src={draft.logo} alt="" />
          )}
        </div>

        <div className={styles.logoText}>
          <div className={styles.fieldLabel}>{t.company.logo}</div>
          <p className={styles.fieldHint}>{t.company.logoHint}</p>

          <div className={styles.logoActions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => fileInput.current?.click()}
            >
              {t.company.logoChoose}
            </button>
            {draft.logo === undefined ? null : (
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => {
                  // Логотип именно убирается, а не остаётся пустой строкой:
                  // пустая строка в src даёт сломанную картинку на бланке.
                  const { logo: _logo, ...rest } = draft;
                  onChange(rest);
                }}
              >
                {t.company.logoRemove}
              </button>
            )}
          </div>

          {logoError === null ? null : (
            <p className={styles.error} role="alert">
              {logoError}
            </p>
          )}

          <input
            ref={fileInput}
            className={styles.fileInput}
            type="file"
            accept="image/*"
            onChange={(e) => pickLogo(e.target.files?.[0])}
          />
        </div>
      </div>

      <p className={styles.fieldHint}>{t.company.autoTranslateHint}</p>

      <div className={styles.formGrid}>
        <Text label={t.company.shortName} value={draft.name} onChange={(v) => set({ name: v })} />
        <Text
          label={t.company.shortNameEn}
          value={draft.nameEn ?? ''}
          hint={t.company.shortNameEnHint}
          onChange={(v) => set({ nameEn: v })}
        />
        <Text
          label={t.company.legalName}
          value={draft.legalName}
          onChange={(v) => set({ legalName: v })}
        />
        <Text
          label={t.company.legalNameKk}
          value={draft.legalNameKk ?? ''}
          hint={t.company.legalNameKkHint}
          onChange={(v) => set({ legalNameKk: v })}
        />
        <Text
          label={t.company.legalNameEn}
          value={draft.legalNameEn ?? ''}
          onChange={(v) => set({ legalNameEn: v })}
        />
        <Text label={t.company.bin} value={draft.bin} onChange={(v) => set({ bin: v })} />
        <Text label={t.company.kbe} value={draft.kbe ?? ''} onChange={(v) => set({ kbe: v })} />
        <Text
          label={t.company.postalCode}
          value={draft.postalCode ?? ''}
          onChange={(v) => set({ postalCode: v })}
        />
        <Text
          label={t.company.address}
          value={draft.address}
          onChange={(v) => set({ address: v })}
        />
        <Text
          label={t.company.addressEn}
          value={draft.addressEn ?? ''}
          onChange={(v) => set({ addressEn: v })}
        />
        <Text
          label={t.company.actualAddress}
          value={draft.actualAddress ?? ''}
          onChange={(v) => set({ actualAddress: v })}
        />
        <Text
          label={t.company.actualAddressEn}
          value={draft.actualAddressEn ?? ''}
          onChange={(v) => set({ actualAddressEn: v })}
        />
        <Text label={t.company.city} value={draft.city} onChange={(v) => set({ city: v })} />
        <Text
          label={t.company.cityKk}
          value={draft.cityKk ?? ''}
          onChange={(v) => set({ cityKk: v })}
        />
        <Text
          label={t.company.cityEn}
          value={draft.cityEn ?? ''}
          onChange={(v) => set({ cityEn: v })}
        />
        <Text label={t.company.phone} value={draft.phone ?? ''} onChange={(v) => set({ phone: v })} />
        <Text label={t.company.email} value={draft.email ?? ''} onChange={(v) => set({ email: v })} />
        <Text
          label={t.company.directorTitle}
          value={draft.directorTitle}
          onChange={(v) => set({ directorTitle: v })}
        />
        <Text
          label={t.company.directorName}
          value={draft.directorName}
          onChange={(v) => set({ directorName: v })}
        />
        {/* Подпись в документах и поля подписи в формах, латиница – в
            английской колонке (19.10). Пересчитываются сами при смене ФИО. */}
        <Text
          label={t.company.directorNameShort}
          value={draft.directorNameShort ?? ''}
          onChange={(v) => set({ directorNameShort: v })}
        />
        <Text
          label={t.company.directorEn}
          value={draft.directorNameEn ?? ''}
          onChange={(v) => set({ directorNameEn: v })}
        />
        <Text
          label={t.company.directorTitleKk}
          value={draft.directorTitleKk ?? ''}
          onChange={(v) => set({ directorTitleKk: v })}
        />
        <Text
          label={t.company.directorTitleEn}
          value={draft.directorTitleEn ?? ''}
          onChange={(v) => set({ directorTitleEn: v })}
        />
        <Text
          label={t.company.directorTitleGenitive}
          value={draft.directorTitleGenitive}
          hint={missing.includes('directorTitleGenitive') ? t.company.genitiveNeeded : t.company.genitiveHint}
          onChange={(v) => set({ directorTitleGenitive: v })}
        />
        <Text
          label={t.company.directorNameGenitive}
          value={draft.directorNameGenitive}
          {...(missing.includes('directorNameGenitive') ? { hint: t.company.genitiveNeeded } : {})}
          onChange={(v) => set({ directorNameGenitive: v })}
        />
        <Text
          label={t.company.basis}
          value={draft.directorBasis}
          onChange={(v) => set({ directorBasis: v })}
        />
        <Text
          label={t.company.monogram}
          value={draft.monogram}
          onChange={(v) => set({ monogram: v.slice(0, 3) })}
        />
        <label className={styles.field}>
          <span className={styles.fieldLabel}>{t.company.accent}</span>
          <input
            className={styles.color}
            type="color"
            value={draft.accent}
            onChange={(e) => set({ accent: e.target.value })}
          />
        </label>
      </div>

      <p className={styles.note}>{t.company.snapshotNote}</p>

      <div className={styles.formActions}>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          {t.common.cancel}
        </button>
        <button type="submit" className={styles.primary}>
          {t.common.save}
        </button>
      </div>
    </form>
  );
}

interface TextProps {
  label: string;
  value: string;
  hint?: string;
  onChange: (value: string) => void;
}

function Text({ label, value, hint, onChange }: TextProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input className={styles.input} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint === undefined ? null : <span className={styles.fieldHint}>{hint}</span>}
    </label>
  );
}

/** Индекс и адрес одной строкой. Без индекса запятая не появляется. */
function addressLine(company: Company): string {
  return [company.postalCode, company.address].filter(isFilled).join(', ');
}

/** То же на английском: адрес из карточки, а если его нет – собранный. */
function addressLineEn(company: Company): string {
  const address = isFilled(company.addressEn) ? company.addressEn : englishAddress(company.address);
  return [company.postalCode, address].filter(isFilled).join(', ');
}

/** Телефон, почта и PEC головного офиса одной строкой. */
function headOfficeContacts(office: HeadOffice): string | undefined {
  const parts = [office.phone, office.email, office.pec].filter(isFilled);
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/** Свидетельство НДС: «серия 27001 № 1010058». */
function vatLine(company: Company): string | undefined {
  const vat = company.vat;
  if (vat === undefined) return undefined;

  const issued = isFilled(vat.issuedAt) ? ` ${t.company.vatDated} ${formatShortDate(vat.issuedAt)}` : '';
  return `${t.company.vatSeries} ${vat.series} № ${vat.number}${issued}`;
}

function isFilled(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== '';
}

interface RequisiteProps {
  label: string;
  value: string | undefined;
  /** Номера показываем моноширинным: так видно, что цифра пропущена. */
  mono?: boolean;
}

/**
 * Строка реквизита.
 *
 * Незаполненный реквизит не прячется, а показывается словами «не заполнено»:
 * пустое место читается как «здесь ничего и не должно быть», а это не так —
 * это данные, которых у системы пока нет.
 */
function Requisite({ label, value, mono = false }: RequisiteProps) {
  const filled = isFilled(value);

  return (
    <div className={styles.requisite}>
      <dt className={styles.requisiteLabel}>{label}</dt>
      <dd
        className={cx(styles.requisiteValue, filled ? mono && 'tabular' : styles.requisiteMissing)}
        title={filled ? undefined : t.company.missingHint}
      >
        {filled ? value : t.company.missing}
      </dd>
    </div>
  );
}
