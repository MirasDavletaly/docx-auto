-- Шаблоны из конструктора (docs/plans/phase-01c-documents.md). Шаблон
-- виден только в своей компании – той, что в токене; раздел – фильтр здесь
-- (access.CanSeeTemplate).

-- name: ListTemplates :many
SELECT company_id, id, section_id, title, author_id, author_name, body, lock_version,
       created_at, updated_at, deleted_at, deleted_by
FROM custom_templates
WHERE company_id = $1 AND deleted_at IS NULL
  AND (sqlc.arg('all_sections')::boolean OR section_id = ANY (sqlc.arg('sections')::text[]))
ORDER BY title, id;

-- name: GetTemplate :one
SELECT company_id, id, section_id, title, author_id, author_name, body, lock_version,
       created_at, updated_at, deleted_at, deleted_by
FROM custom_templates
WHERE id = $1
FOR UPDATE;

-- name: InsertTemplate :exec
INSERT INTO custom_templates (company_id, id, section_id, title, author_id, author_name, body, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8);

-- name: UpdateTemplate :execrows
UPDATE custom_templates
SET section_id = $3, title = $4, body = $5, updated_at = $6, lock_version = lock_version + 1
WHERE company_id = $1 AND id = $2 AND lock_version = $7 AND deleted_at IS NULL;

-- name: SoftDeleteTemplate :execrows
-- Шаблон убирается из каталога; созданные по нему документы держат снимок.
UPDATE custom_templates
SET deleted_at = $3, deleted_by = $4, lock_version = lock_version + 1
WHERE company_id = $1 AND id = $2 AND lock_version = $5 AND deleted_at IS NULL;
