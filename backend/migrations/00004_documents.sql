-- Этап 1б, часть 2: документы, шаблоны компании и архив – в базе
-- (docs/plans/phase-01c-documents.md).
--
-- Изоляция компаний (CLAUDE.md, п. 3.1): строка видна, только если у
-- человека есть доступ к её компании (app_has_company) или он администратор
-- платформы. Документы читаются во всех компаниях человека: корзина
-- админ-панели показывает их все; компания нового документа – из токена
-- (сервис). Кто что видит внутри компании – фильтр в запросах и политика
-- сервиса (internal/access).
--
-- Уникальный индекс по одному id у documents и custom_templates –
-- исключение из правила «company_id первым»: идентификатор заводит сайт, и
-- без такого индекса запись с тем же id можно было бы завести в другой
-- компании.

-- +goose Up

-- Доступна ли компания строки: администратор платформы – все.
-- +goose StatementBegin
CREATE FUNCTION app_row_company(p_company text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_platform_admin() OR app_has_company(p_company)
$$;
-- +goose StatementEnd

-- ── Документы ────────────────────────────────────────────────────────────

CREATE TABLE documents (
  company_id  text NOT NULL REFERENCES companies (id),
  id          text NOT NULL CHECK (id ~ '^[A-Za-z0-9_-]{3,80}$'),
  template_id text NOT NULL CHECK (template_id <> '' AND length(template_id) <= 200),
  -- Раздел каталога: по нему работнику открыт просмотр сохранённых.
  section_id  text NOT NULL DEFAULT '' CHECK (length(section_id) <= 100),
  title       text NOT NULL CHECK (length(title) <= 500),
  status      text NOT NULL CHECK (status IN ('draft', 'saved')),
  -- Номер вводит человек (docs/questions.md, Q17); number_key – он же для
  -- сравнения: без «№», лишних пробелов и регистра (store/documentNumber.ts).
  number      text CHECK (length(number) <= 100),
  number_key  text NOT NULL DEFAULT '',
  subject     text NOT NULL DEFAULT '' CHECK (length(subject) <= 500),
  author_id   text NOT NULL,
  author_name text NOT NULL DEFAULT '',
  -- Описание, значения полей и снимки реквизитов, людей и шаблона.
  body        jsonb NOT NULL,
  lock_version integer NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  deleted_by  text NOT NULL DEFAULT '',
  PRIMARY KEY (company_id, id)
);
CREATE UNIQUE INDEX documents_id_key ON documents (id);
CREATE INDEX documents_company_updated ON documents (company_id, updated_at DESC, id);
CREATE INDEX documents_company_author ON documents (company_id, author_id);
-- Номер сохранённого документа уникален в компании; черновик номер не
-- занимает, удалённый – освобождает (CLAUDE.md, п. 3.5).
CREATE UNIQUE INDEX documents_number_key ON documents (company_id, number_key)
  WHERE status = 'saved' AND deleted_at IS NULL AND number_key <> '';

-- Доступ к документу поверх роли («Тест день 2»).
CREATE TABLE document_grants (
  company_id  text NOT NULL,
  document_id text NOT NULL,
  user_id     text NOT NULL REFERENCES users (id),
  level       text NOT NULL CHECK (level IN ('view', 'edit')),
  granted_by  text NOT NULL DEFAULT '',
  granted_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, document_id, user_id),
  FOREIGN KEY (company_id, document_id) REFERENCES documents (company_id, id) ON DELETE CASCADE
);
CREATE INDEX document_grants_user ON document_grants (company_id, user_id);

-- Картинки снимков (логотип компании на момент сохранения): одна копия на
-- компанию, в снимке – ссылка «image:s<sha256>».
CREATE TABLE document_images (
  company_id text NOT NULL REFERENCES companies (id),
  ref        text NOT NULL CHECK (ref ~ '^image:s[0-9a-f]{64}$'),
  data       text NOT NULL CHECK (data LIKE 'data:image/%' AND length(data) <= 1000000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, ref)
);

-- ── Шаблоны из конструктора ──────────────────────────────────────────────

CREATE TABLE custom_templates (
  company_id   text NOT NULL REFERENCES companies (id),
  id           text NOT NULL CHECK (id ~ '^[A-Za-z0-9_-]{3,80}$'),
  section_id   text NOT NULL CHECK (section_id <> '' AND length(section_id) <= 100),
  title        text NOT NULL CHECK (title <> '' AND length(title) <= 500),
  author_id    text NOT NULL,
  author_name  text NOT NULL DEFAULT '',
  body         jsonb NOT NULL,
  lock_version integer NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  deleted_by   text NOT NULL DEFAULT '',
  PRIMARY KEY (company_id, id)
);
CREATE UNIQUE INDEX custom_templates_id_key ON custom_templates (id);

-- ── Архив загруженных PDF ────────────────────────────────────────────────

CREATE TABLE archive_files (
  company_id       text NOT NULL REFERENCES companies (id),
  id               text NOT NULL,
  section_id       text NOT NULL CHECK (section_id <> '' AND length(section_id) <= 100),
  title            text NOT NULL CHECK (title <> '' AND length(title) <= 500),
  number           text CHECK (length(number) <= 100),
  document_date    date NOT NULL,
  description      text NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  file_name        text NOT NULL CHECK (file_name <> '' AND length(file_name) <= 255),
  size             bigint NOT NULL CHECK (size > 0 AND size <= 20971520),
  -- SHA-256 содержимого: при завершении загрузки сервер сверяет его с
  -- частями (CLAUDE.md, п. 3.7), при выдаче сайт сверяет ещё раз.
  sha256           text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  -- uploading – части ещё идут; в списках и выдаче только ready.
  state            text NOT NULL DEFAULT 'uploading' CHECK (state IN ('uploading', 'ready')),
  uploaded_by      text NOT NULL,
  uploaded_by_name text NOT NULL DEFAULT '',
  uploaded_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  deleted_by       text NOT NULL DEFAULT '',
  PRIMARY KEY (company_id, id)
);
CREATE INDEX archive_files_company_date ON archive_files (company_id, document_date DESC, id);
-- Один и тот же файл дважды в архиве компании – дубль.
CREATE UNIQUE INDEX archive_files_sha ON archive_files (company_id, sha256)
  WHERE state = 'ready' AND deleted_at IS NULL;

CREATE TABLE archive_file_parts (
  company_id text NOT NULL,
  file_id    text NOT NULL,
  part       integer NOT NULL CHECK (part >= 0 AND part < 64),
  data       bytea NOT NULL CHECK (length(data) BETWEEN 1 AND 786432),
  PRIMARY KEY (company_id, file_id, part),
  FOREIGN KEY (company_id, file_id) REFERENCES archive_files (company_id, id) ON DELETE CASCADE
);

-- ── Row-Level Security ───────────────────────────────────────────────────

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE archive_file_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_company ON documents
  USING (app_row_company(company_id)) WITH CHECK (app_row_company(company_id));
CREATE POLICY document_grants_company ON document_grants
  USING (app_row_company(company_id)) WITH CHECK (app_row_company(company_id));
CREATE POLICY document_images_company ON document_images
  USING (app_row_company(company_id)) WITH CHECK (app_row_company(company_id));
CREATE POLICY custom_templates_company ON custom_templates
  USING (app_row_company(company_id)) WITH CHECK (app_row_company(company_id));
CREATE POLICY archive_files_company ON archive_files
  USING (app_row_company(company_id)) WITH CHECK (app_row_company(company_id));
CREATE POLICY archive_file_parts_company ON archive_file_parts
  USING (app_row_company(company_id)) WITH CHECK (app_row_company(company_id));

-- ── Права роли приложения ────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION app_row_company(text) TO docflow_app;
-- DELETE – только для «удалить навсегда» из корзины (решение человека,
-- docs/questions.md, «Тест день 3») и снятия выданного доступа.
GRANT SELECT, INSERT, UPDATE, DELETE ON documents, document_grants, archive_files, archive_file_parts TO docflow_app;
GRANT SELECT, INSERT, UPDATE ON custom_templates TO docflow_app;
GRANT SELECT, INSERT ON document_images TO docflow_app;

-- +goose Down

REVOKE ALL ON documents, document_grants, document_images, custom_templates, archive_files, archive_file_parts FROM docflow_app;
DROP TABLE archive_file_parts;
DROP TABLE archive_files;
DROP TABLE custom_templates;
DROP TABLE document_images;
DROP TABLE document_grants;
DROP TABLE documents;
DROP FUNCTION app_row_company(text);
