-- Этап 1а: компании, роли, учётные записи, вход (docs/plans/phase-01a-users-db.md).
--
-- Изоляция компаний – в самой базе (CLAUDE.md, п. 3.1): на таблицах включён
-- Row-Level Security, приложение подключается ролью docflow_app без
-- BYPASSRLS и в каждой транзакции ставит
--   SET LOCAL app.user_id, app.company_id, app.platform_admin
-- из токена. Ошибка в запросе приложения не вернёт чужую строку.
--
-- Вход идёт до того, как известен человек, поэтому поиск по логину и учёт
-- неудачных попыток – узкие функции SECURITY DEFINER: приложению не нужен
-- доступ ко всей таблице учётных записей.

-- +goose Up

-- +goose StatementBegin
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'docflow_app') THEN
    -- Пароль роли задаёт установка (deploy), в миграции секретов нет.
    CREATE ROLE docflow_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;
-- +goose StatementEnd

-- Текущий человек и компания транзакции. Пусто – не задано: политика тогда
-- ничего не пропускает (по умолчанию запрещено).
-- +goose StatementBegin
CREATE FUNCTION app_user_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.user_id', true), '')
$$;
-- +goose StatementEnd
-- +goose StatementBegin
CREATE FUNCTION app_company_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.company_id', true), '')
$$;
-- +goose StatementEnd
-- +goose StatementBegin
CREATE FUNCTION app_platform_admin() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.platform_admin', true), '') = 'on'
$$;
-- +goose StatementEnd

-- ── Роли как данные (CLAUDE.md, п. 3.2) ──────────────────────────────────

CREATE TABLE roles (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  -- platform – все компании; company – только свои.
  scope       text NOT NULL CHECK (scope IN ('platform', 'company')),
  description text NOT NULL DEFAULT ''
);

CREATE TABLE role_permissions (
  role_id    text NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
  permission text NOT NULL,
  PRIMARY KEY (role_id, permission)
);

INSERT INTO roles (id, title, scope, description) VALUES
  ('platform-admin', 'Администратор', 'platform', 'Заводит компании и людей, видит и правит документы всех компаний, ведёт журнал действий.'),
  ('director', 'Директор', 'company', 'Всё, что может работник, плюс управление своей компанией: сотрудники и их доступ, персонал, реквизиты и все её документы.'),
  ('employee', 'Работник', 'company', 'Создаёт документы в разрешённых ему разделах.');

INSERT INTO role_permissions (role_id, permission)
SELECT 'platform-admin', p FROM unnest(ARRAY[
  'admin.panel', 'company.create', 'company.edit', 'people.manage', 'documents.viewAll',
  'documents.editAny', 'documents.delete', 'documents.restore', 'documents.purge',
  'documents.grant', 'templates.create', 'settings.manage', 'audit.view'
]) AS p
UNION ALL
SELECT 'director', p FROM unnest(ARRAY[
  'admin.panel', 'company.edit', 'people.manage', 'documents.viewAll', 'documents.editAny',
  'documents.delete', 'documents.restore', 'documents.purge', 'documents.grant',
  'templates.create', 'audit.view'
]) AS p;

-- ── Компании ─────────────────────────────────────────────────────────────

CREATE TABLE companies (
  id           text PRIMARY KEY,
  name         text NOT NULL CHECK (name <> ''),
  bin          text NOT NULL,
  -- Реквизиты целиком (банк, директор, адреса, логотип) – как карточка
  -- компании на сайте. Поиск по ним не нужен, правятся они целиком.
  requisites   jsonb NOT NULL DEFAULT '{}'::jsonb,
  lock_version integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

-- ── Учётные записи ───────────────────────────────────────────────────────

CREATE TABLE users (
  id               text PRIMARY KEY,
  login            text NOT NULL CHECK (length(login) >= 3),
  display_name     text NOT NULL,
  -- argon2id; NULL – пароль ещё не задан (перенесённая учётная запись):
  -- войти нельзя, пока администратор не задаст пароль.
  password_hash    text,
  role_id          text NOT NULL REFERENCES roles (id),
  section_ids      text[] NOT NULL DEFAULT '{}',
  view_section_ids text[] NOT NULL DEFAULT '{}',
  granted_actions  text[] NOT NULL DEFAULT '{}',
  -- Должность, телефон, почта, аватар, карточка в персонале.
  profile          jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Растёт при блокировке, смене роли и пароля: все выданные токены
  -- перестают действовать сразу (CLAUDE.md, п. 3.8).
  token_version    integer NOT NULL DEFAULT 1,
  failed_attempts  integer NOT NULL DEFAULT 0,
  locked_until     timestamptz,
  blocked          boolean NOT NULL DEFAULT false,
  lock_version     integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE UNIQUE INDEX users_login_key ON users (lower(login)) WHERE deleted_at IS NULL;

-- Доступ человека к компаниям. company_id – первым в индексе (CLAUDE.md, п. 3.1).
CREATE TABLE user_companies (
  company_id text NOT NULL REFERENCES companies (id),
  user_id    text NOT NULL REFERENCES users (id),
  PRIMARY KEY (company_id, user_id)
);
CREATE INDEX user_companies_user ON user_companies (user_id, company_id);

-- ── Refresh-токены: цепочки с ротацией (CLAUDE.md, п. 3.8) ───────────────

CREATE TABLE refresh_tokens (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users (id),
  -- Цепочка: повторное использование старого токена отзывает её целиком.
  family_id   text NOT NULL,
  -- Только SHA-256 токена: сам токен живёт в cookie браузера.
  token_hash  bytea NOT NULL UNIQUE,
  -- Версия токенов человека при выдаче: сменили пароль, роль или
  -- заблокировали – цепочка больше не продлевается.
  token_version integer NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  used_at     timestamptz,
  revoked_at  timestamptz
);
CREATE INDEX refresh_tokens_family ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_user ON refresh_tokens (user_id);

-- ── Журнал действий ──────────────────────────────────────────────────────

CREATE TABLE audit_log (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- NULL – событие платформы (вход, учётные записи без компании).
  company_id text,
  at         timestamptz NOT NULL DEFAULT now(),
  user_id    text,
  user_name  text NOT NULL DEFAULT '',
  event      text NOT NULL,
  target     text NOT NULL DEFAULT '',
  ip         text NOT NULL DEFAULT ''
);
CREATE INDEX audit_log_company_at ON audit_log (company_id, at DESC);
-- TODO(phase-01): секционирование audit_log по месяцам (CLAUDE.md, п. 6, SQL)
-- – когда журнал начнёт расти; сейчас записей – десятки в день.

-- ── Row-Level Security ───────────────────────────────────────────────────

-- Текущая компания – только если у человека к ней есть доступ. Иначе пусто:
-- приложение, поставившее по ошибке чужую компанию, не увидит ни её людей,
-- ни журнала. SECURITY DEFINER – чтобы проверка доступа не упиралась в
-- политику самой таблицы доступа.
-- +goose StatementBegin
CREATE FUNCTION app_current_company() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN app_company_id() = '' THEN ''
    WHEN app_platform_admin() THEN app_company_id()
    WHEN EXISTS (SELECT 1 FROM user_companies uc WHERE uc.user_id = app_user_id() AND uc.company_id = app_company_id())
      THEN app_company_id()
    ELSE ''
  END
$$;
-- +goose StatementEnd

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Есть ли у текущего человека доступ к компании – для политик самой таблицы
-- доступа (запрос к ней из её же политики зациклился бы).
-- +goose StatementBegin
CREATE FUNCTION app_has_company(p_company text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_companies uc WHERE uc.user_id = app_user_id() AND uc.company_id = p_company)
$$;
-- +goose StatementEnd

-- Доступ к компаниям: свои строки и строки компаний человека; выдать и
-- снять доступ можно только к своей компании; администратору – ко всем.
CREATE POLICY user_companies_access ON user_companies
  USING (app_platform_admin() OR user_id = app_user_id() OR app_has_company(company_id))
  WITH CHECK (app_platform_admin() OR app_has_company(company_id));

-- Компания видна, если у человека к ней есть доступ.
CREATE POLICY companies_access ON companies
  USING (
    app_platform_admin()
    OR EXISTS (SELECT 1 FROM user_companies uc WHERE uc.company_id = companies.id AND uc.user_id = app_user_id())
  )
  WITH CHECK (
    app_platform_admin()
    OR EXISTS (SELECT 1 FROM user_companies uc WHERE uc.company_id = companies.id AND uc.user_id = app_user_id())
  );

-- Учётная запись видна самому человеку, людям текущей компании и
-- администратору платформы. Человек без компании (администратор) другим
-- не виден.
CREATE POLICY users_access ON users
  USING (
    app_platform_admin()
    OR id = app_user_id()
    OR EXISTS (SELECT 1 FROM user_companies uc WHERE uc.user_id = users.id AND uc.company_id = app_current_company())
  )
  WITH CHECK (
    app_platform_admin()
    OR id = app_user_id()
    OR app_current_company() <> ''
  );

CREATE POLICY refresh_tokens_own ON refresh_tokens
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id());

CREATE POLICY audit_log_read ON audit_log FOR SELECT
  USING (app_platform_admin() OR (company_id IS NOT NULL AND company_id = app_current_company()));
CREATE POLICY audit_log_write ON audit_log FOR INSERT
  WITH CHECK (true);

-- ── Вход: узкие функции до того, как известен человек ───────────────────

-- +goose StatementBegin
-- Возвращает строку таблицы целиком (SETOF users): так её поля видит sqlc;
-- приложение берёт из неё только нужное для входа.
CREATE FUNCTION auth_find_user(p_login text)
RETURNS SETOF users
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.* FROM users u
  WHERE lower(u.login) = lower(p_login) AND u.deleted_at IS NULL
$$;
-- +goose StatementEnd

-- Неудачная попытка: после p_max подряд вход закрыт на p_lock.
-- +goose StatementBegin
CREATE FUNCTION auth_record_failure(p_user_id text, p_max integer, p_lock interval)
RETURNS timestamptz
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE users
  SET failed_attempts = CASE WHEN failed_attempts + 1 >= p_max THEN 0 ELSE failed_attempts + 1 END,
      locked_until    = CASE WHEN failed_attempts + 1 >= p_max THEN now() + p_lock ELSE locked_until END
  WHERE id = p_user_id
  RETURNING locked_until
$$;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE FUNCTION auth_record_success(p_user_id text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = p_user_id
$$;
-- +goose StatementEnd

-- Refresh-токен по его хешу – до того, как известен человек.
-- +goose StatementBegin
CREATE FUNCTION auth_find_refresh(p_hash bytea)
RETURNS SETOF refresh_tokens
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.* FROM refresh_tokens t WHERE t.token_hash = p_hash
$$;
-- +goose StatementEnd

-- ── Права роли приложения ────────────────────────────────────────────────

GRANT USAGE ON SCHEMA public TO docflow_app;
GRANT SELECT ON roles, role_permissions TO docflow_app;
GRANT SELECT, INSERT, UPDATE ON companies, users, refresh_tokens TO docflow_app;
GRANT SELECT, INSERT, DELETE ON user_companies TO docflow_app;
-- Журнал только дописывается: ни правки, ни удаления (CLAUDE.md, п. 3.4).
GRANT SELECT, INSERT ON audit_log TO docflow_app;
GRANT EXECUTE ON FUNCTION app_user_id(), app_company_id(), app_platform_admin(), app_current_company(), app_has_company(text),
  auth_find_user(text), auth_record_failure(text, integer, interval),
  auth_record_success(text), auth_find_refresh(bytea) TO docflow_app;

-- +goose Down

DROP POLICY audit_log_write ON audit_log;
DROP POLICY audit_log_read ON audit_log;
DROP POLICY refresh_tokens_own ON refresh_tokens;
DROP POLICY users_access ON users;
DROP POLICY companies_access ON companies;
DROP POLICY user_companies_access ON user_companies;
DROP FUNCTION app_has_company(text);
DROP FUNCTION app_current_company();
DROP FUNCTION auth_find_refresh(bytea);
DROP FUNCTION auth_record_success(text);
DROP FUNCTION auth_record_failure(text, integer, interval);
DROP FUNCTION auth_find_user(text);
DROP TABLE audit_log;
DROP TABLE refresh_tokens;
DROP TABLE user_companies;
DROP TABLE users;
DROP TABLE companies;
DROP TABLE role_permissions;
DROP TABLE roles;
DROP FUNCTION app_platform_admin();
DROP FUNCTION app_company_id();
DROP FUNCTION app_user_id();
REVOKE USAGE ON SCHEMA public FROM docflow_app;
-- Роль docflow_app не удаляется: она общая для кластера и может владеть
-- подключениями других баз.
