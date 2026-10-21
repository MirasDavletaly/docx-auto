-- Документы (docs/plans/phase-01c-documents.md). Компании – RLS
-- (app_row_company); кто что видит внутри компании – фильтр здесь, те же
-- правила, что access.CanViewDocument (CLAUDE.md, п. 3.2: дважды).

-- name: ListDocuments :many
-- Видимые документы. company_ids NULL – все видимые компании (администратор
-- платформы). Курсор – (updated_at, id) последней строки прошлой страницы.
SELECT d.company_id, d.id, d.template_id, d.section_id, d.title, d.status, d.number, d.subject,
       d.author_id, d.author_name, d.body, d.lock_version, d.created_at, d.updated_at,
       d.deleted_at, d.deleted_by
FROM documents d
WHERE (sqlc.narg('company_ids')::text[] IS NULL OR d.company_id = ANY (sqlc.narg('company_ids')::text[]))
  -- Документы удалённой компании в списки не попадают (остаются в базе).
  AND EXISTS (SELECT 1 FROM companies c WHERE c.id = d.company_id AND c.deleted_at IS NULL)
  AND (d.deleted_at IS NULL OR sqlc.arg('with_deleted')::boolean)
  AND (
    sqlc.arg('view_all')::boolean
    OR d.author_id = sqlc.arg('user_id')::text
    OR EXISTS (
      SELECT 1 FROM document_grants g
      WHERE g.company_id = d.company_id AND g.document_id = d.id AND g.user_id = sqlc.arg('user_id')::text
    )
    OR (d.status = 'saved' AND d.section_id <> '' AND d.section_id = ANY (sqlc.arg('view_sections')::text[]))
  )
  AND (
    sqlc.narg('cursor_at')::timestamptz IS NULL
    OR (d.updated_at, d.id) < (sqlc.narg('cursor_at')::timestamptz, sqlc.arg('cursor_id')::text)
  )
ORDER BY d.updated_at DESC, d.id DESC
LIMIT sqlc.arg('lim')::integer;

-- name: GetDocument :one
-- Поштучно – с блокировкой строки: правка, смена состояния, удаление
-- (CLAUDE.md, п. 3.5).
SELECT company_id, id, template_id, section_id, title, status, number, subject,
       author_id, author_name, body, lock_version, created_at, updated_at, deleted_at, deleted_by
FROM documents
WHERE id = $1
FOR UPDATE;

-- name: InsertDocument :exec
INSERT INTO documents (company_id, id, template_id, section_id, title, status, number, number_key,
                       subject, author_id, author_name, body, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13);

-- name: UpdateDocument :execrows
UPDATE documents
SET template_id = $3, section_id = $4, title = $5, status = $6, number = $7, number_key = $8,
    subject = $9, body = $10, updated_at = $11, lock_version = lock_version + 1
WHERE company_id = $1 AND id = $2 AND lock_version = $12 AND deleted_at IS NULL;

-- name: SoftDeleteDocument :execrows
-- Удаление – пометка: документ уходит в корзину (CLAUDE.md, п. 3.4).
UPDATE documents
SET deleted_at = $3, deleted_by = $4, lock_version = lock_version + 1
WHERE company_id = $1 AND id = $2 AND lock_version = $5 AND deleted_at IS NULL;

-- name: RestoreDocument :execrows
UPDATE documents
SET deleted_at = NULL, deleted_by = '', lock_version = lock_version + 1
WHERE company_id = $1 AND id = $2 AND lock_version = $3 AND deleted_at IS NOT NULL;

-- name: PurgeDocument :execrows
-- Стереть навсегда – только из корзины (решение человека, «Тест день 3»).
DELETE FROM documents
WHERE company_id = $1 AND id = $2 AND lock_version = $3 AND deleted_at IS NOT NULL;

-- name: NumberHolder :one
-- Занят ли номер другим сохранённым документом компании – по всем
-- документам, не только видимым; наружу уходит только «занят».
SELECT EXISTS (
  SELECT 1 FROM documents
  WHERE company_id = $1 AND number_key = $2 AND id <> $3
    AND status = 'saved' AND deleted_at IS NULL AND number_key <> ''
) AS taken;

-- ── Выданный доступ ──────────────────────────────────────────────────────

-- name: ListGrants :many
-- Доступы документов страницы одним запросом (без N+1).
SELECT company_id, document_id, user_id, level, granted_by, granted_at
FROM document_grants
WHERE document_id = ANY (sqlc.arg('document_ids')::text[])
ORDER BY document_id, granted_at, user_id;

-- name: GetGrant :one
SELECT level FROM document_grants WHERE company_id = $1 AND document_id = $2 AND user_id = $3;

-- name: UpsertGrant :exec
INSERT INTO document_grants (company_id, document_id, user_id, level, granted_by, granted_at)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (company_id, document_id, user_id)
DO UPDATE SET level = EXCLUDED.level, granted_by = EXCLUDED.granted_by, granted_at = EXCLUDED.granted_at;

-- name: DeleteGrant :execrows
DELETE FROM document_grants WHERE company_id = $1 AND document_id = $2 AND user_id = $3;

-- name: GrantTarget :one
-- Кому выдают доступ: человек должен работать в компании документа.
SELECT u.id, u.role_id, u.blocked, u.display_name
FROM users u
JOIN user_companies uc ON uc.user_id = u.id AND uc.company_id = $1
WHERE u.id = $2 AND u.deleted_at IS NULL;

-- ── Картинки снимков ─────────────────────────────────────────────────────

-- name: InsertImage :exec
INSERT INTO document_images (company_id, ref, data) VALUES ($1, $2, $3)
ON CONFLICT (company_id, ref) DO NOTHING;

-- name: ImageExists :one
SELECT EXISTS (SELECT 1 FROM document_images WHERE company_id = $1 AND ref = $2) AS found;

-- name: ListImages :many
SELECT company_id, ref, data FROM document_images
WHERE company_id = ANY (sqlc.arg('company_ids')::text[]) AND ref = ANY (sqlc.arg('refs')::text[]);
