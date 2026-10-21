/**
 * Профиль.
 *
 * Здесь человек заполняет то, что относится к нему самому: фотография, имя,
 * должность, связь. Логин и роль показываются, но не правятся: их выдаёт
 * администратор, и человек не должен уметь расширить себе доступ.
 *
 * Пароль меняется тут же. В открытом виде он нигде не хранится: в хранилище
 * лежат соль и хеш (см. `store/password.ts`), в исходном коде пароля нет ни
 * одного. Настоящая проверка — на сервере, argon2id, этап 1.
 */
import { useRef, useState } from 'react';

import { can } from '@/access/policy';
import { findRole } from '@/api/mock/roles';
import { sections } from '@/api/mock/sections';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { t } from '@/i18n';
import { companyName } from '@/i18n/company';
import { tc } from '@/i18n/content';
import { personName } from '@/i18n/person';
import { positionName } from '@/i18n/position';
import { MIN_PASSWORD_LENGTH } from '@/store/password';
import { useSession } from '@/store/session';

import styles from './ProfilePage.module.css';

/** Больше не пропускаем: аватар лежит в хранилище строкой data:URL. */
const MAX_AVATAR_BYTES = 512 * 1024;

export default function ProfilePage() {
  const { user, companies, updateProfile, changePassword } = useSession();
  const fileInput = useRef<HTMLInputElement>(null);

  const [login, setLogin] = useState(user?.login ?? '');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDone, setPasswordDone] = useState(false);
  const [changing, setChanging] = useState(false);

  if (user === null) return null;

  // Свой логин меняет тот, у кого право users.login (16.10 – администратор
  // платформы); остальным – строка «Логин меняет администратор».
  const canChangeLogin = can({ user, companyId: null }, 'users.login');
  const role = findRole(user.role);
  const myCompanies =
    user.role === 'platform-admin'
      ? t.common.all
      : companies
          .filter((c) => user.companyIds.includes(c.id))
          .map(companyName)
          .join(', ');

  const mySections =
    user.role === 'employee'
      ? user.sectionIds.length === 0
        ? t.profile.sectionsNone
        : sections
            .filter((s) => user.sectionIds.includes(s.id))
            .map((s) => tc(s.title))
            .join(', ')
      : t.profile.sectionsAll;

  function pickAvatar(file: File | undefined) {
    setAvatarError(null);
    if (file === undefined) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError(t.profile.avatarWrongType);
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError(t.profile.avatarTooBig);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      void updateProfile({ avatar: reader.result }).then((outcome) => {
        if (!outcome.ok) setAvatarError(outcome.message);
      });
    };
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    if (user === null) return;
    setProfileSaved(false);
    setProfileError(null);
    const newLogin = canChangeLogin && login.trim() !== user.login;
    if (newLogin && login.trim().length < 4) {
      setProfileError(t.auth.loginTooShort);
      return;
    }
    setSaving(true);
    const outcome = await updateProfile({
      displayName: displayName.trim(),
      phone,
      email,
      ...(newLogin ? { login: login.trim() } : {}),
    });
    setSaving(false);
    if (!outcome.ok) {
      setProfileError(outcome.field === 'login' ? t.auth.loginTaken : outcome.message);
      return;
    }
    setProfileSaved(true);
  }

  async function submitPassword() {
    setPasswordError(null);
    setPasswordDone(false);

    if (next.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(t.auth.passwordTooShort);
      return;
    }
    if (next !== repeat) {
      setPasswordError(t.auth.passwordMismatch);
      return;
    }

    setChanging(true);
    const outcome = await changePassword(current, next);
    setChanging(false);

    if (!outcome.ok) {
      setPasswordError(
        outcome.field === 'currentPassword' ? t.profile.wrongPassword : outcome.message,
      );
      return;
    }

    setCurrent('');
    setNext('');
    setRepeat('');
    setPasswordDone(true);
  }

  return (
    <div className={styles.page}>
      <PageHeader title={t.profile.title} subtitle={t.profile.subtitle} />

      <div className={styles.body}>
        <section className={styles.block}>
          <div className={styles.avatarRow}>
            <span className={styles.avatar}>
              {user.avatar === undefined ? (
                <span className={styles.avatarLetters} aria-hidden="true">
                  {initials(personName(user.displayName))}
                </span>
              ) : (
                <img className={styles.avatarImage} src={user.avatar} alt="" />
              )}
            </span>

            <div className={styles.avatarText}>
              <div className={styles.avatarTitle}>{t.profile.avatar}</div>
              <p className={styles.avatarHint}>{t.profile.avatarHint}</p>

              <div className={styles.avatarActions}>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => fileInput.current?.click()}
                >
                  {t.profile.avatarChoose}
                </button>
                {user.avatar === undefined ? null : (
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() =>
                      void updateProfile({ avatar: undefined }).then((outcome) => {
                        if (!outcome.ok) setAvatarError(outcome.message);
                      })
                    }
                  >
                    {t.profile.avatarRemove}
                  </button>
                )}
              </div>

              {avatarError === null ? null : (
                <p className={styles.error} role="alert">
                  {avatarError}
                </p>
              )}

              <input
                ref={fileInput}
                className={styles.fileInput}
                type="file"
                accept="image/*"
                onChange={(e) => pickAvatar(e.target.files?.[0])}
              />
            </div>
          </div>
        </section>

        <section className={styles.block}>
          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              void saveProfile();
            }}
          >
            <div className={styles.grid}>
              {canChangeLogin ? <Text label={t.profile.login} value={login} onChange={setLogin} /> : null}
              <Text label={t.profile.displayName} value={displayName} onChange={setDisplayName} />
              <Text label={t.profile.phone} value={phone} onChange={setPhone} />
              <Text label={t.profile.email} value={email} onChange={setEmail} />
            </div>

            <dl className={styles.facts}>
              {canChangeLogin ? null : (
                <Fact label={t.profile.login} value={user.login} note={t.profile.loginNote} />
              )}
              <Fact
                label={t.profile.position}
                value={user.position === undefined || user.position === '' ? '–' : positionName(user.position)}
                note={t.profile.positionNote}
              />
              <Fact label={t.profile.role} value={tc(role?.title ?? user.role)} />
              <Fact label={t.profile.companies} value={myCompanies} />
              <Fact label={t.profile.sectionsTitle} value={mySections} />
            </dl>

            <div className={styles.actions}>
              {profileSaved ? <span className={styles.ok}>{t.profile.saved}</span> : null}
              {profileError === null ? null : (
                <span className={styles.error} role="alert">
                  {profileError}
                </span>
              )}
              <button type="submit" className={styles.primary} disabled={saving}>
                {t.profile.save}
              </button>
            </div>
          </form>
        </section>

        <section className={styles.block}>
          <h2 className={styles.blockTitle}>{t.profile.passwordTitle}</h2>
          <p className={styles.blockBody}>{t.profile.passwordBody}</p>

          <form
            className={styles.form}
            onSubmit={(e) => {
              e.preventDefault();
              void submitPassword();
            }}
          >
            <div className={styles.grid}>
              <Text
                label={t.profile.currentPassword}
                value={current}
                type="password"
                onChange={setCurrent}
              />
              <Text
                label={t.profile.newPassword}
                value={next}
                type="password"
                onChange={setNext}
              />
              <Text
                label={t.auth.passwordRepeat}
                value={repeat}
                type="password"
                onChange={setRepeat}
              />
            </div>

            {passwordError === null ? null : (
              <p className={styles.error} role="alert">
                {passwordError}
              </p>
            )}

            <div className={styles.actions}>
              {passwordDone ? <span className={styles.ok}>{t.profile.changed}</span> : null}
              <button type="submit" className={styles.primary} disabled={changing}>
                {t.profile.change}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

interface TextProps {
  label: string;
  value: string;
  type?: 'text' | 'password';
  onChange: (value: string) => void;
}

function Text({ label, value, type = 'text', onChange }: TextProps) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={styles.input}
        type={type}
        value={value}
        autoComplete={type === 'password' ? 'new-password' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={styles.fact}>
      <dt className={styles.factLabel}>{label}</dt>
      <dd className={styles.factValue}>
        {value}
        {note === undefined ? null : <span className={styles.factNote}>{note}</span>}
      </dd>
    </div>
  );
}

/** Буквы в кружке, пока фотографии нет. Имя и фамилия, не больше двух букв. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
