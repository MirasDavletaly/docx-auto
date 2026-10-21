-- Архив загруженных PDF (docs/plans/phase-01c-documents.md). Компании –
-- RLS; кто что видит – фильтр здесь, как access.CanViewArchiveFile.

-- name: ListArchive :many
SELECT company_id, id, section_id, title, number, document_date, description, file_name, size,
       sha256, uploaded_by, uploaded_by_name, uploaded_at, deleted_at, deleted_by
FROM archive_files f
WHERE f.state = 'ready'
  AND (sqlc.narg('company_ids')::text[] IS NULL OR f.company_id = ANY (sqlc.narg('company_ids')::text[]))
  AND EXISTS (SELECT 1 FROM companies c WHERE c.id = f.company_id AND c.deleted_at IS NULL)
  AND (f.deleted_at IS NULL OR sqlc.arg('with_deleted')::boolean)
  AND (
    sqlc.arg('view_all')::boolean
    OR f.uploaded_by = sqlc.arg('user_id')::text
    OR f.section_id = ANY (sqlc.arg('view_sections')::text[])
  )
  AND (
    sqlc.narg('cursor_date')::date IS NULL
    OR (f.document_date, f.id) < (sqlc.narg('cursor_date')::date, sqlc.arg('cursor_id')::text)
  )
ORDER BY f.document_date DESC, f.id DESC
LIMIT sqlc.arg('lim')::integer;

-- name: GetArchiveFile :one
SELECT company_id, id, section_id, title, number, document_date, description, file_name, size,
       sha256, state, uploaded_by, uploaded_by_name, uploaded_at, deleted_at, deleted_by
FROM archive_files
WHERE company_id = $1 AND id = $2
FOR UPDATE;

-- name: FindArchiveFile :one
-- По одному идентификатору – для действий из корзины админ-панели, где
-- компания файла может быть не той, что в токене; RLS пускает только к
-- своим компаниям.
SELECT company_id FROM archive_files WHERE id = $1;

-- name: InsertArchiveFile :exec
INSERT INTO archive_files (company_id, id, section_id, title, number, document_date, description,
                           file_name, size, sha256, uploaded_by, uploaded_by_name, uploaded_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);

-- name: ArchiveDuplicate :one
SELECT EXISTS (
  SELECT 1 FROM archive_files
  WHERE company_id = $1 AND sha256 = $2 AND state = 'ready' AND deleted_at IS NULL
) AS duplicate;

-- name: PutArchivePart :exec
INSERT INTO archive_file_parts (company_id, file_id, part, data) VALUES ($1, $2, $3, $4)
ON CONFLICT (company_id, file_id, part) DO UPDATE SET data = EXCLUDED.data;

-- name: ArchiveParts :many
-- Части по порядку – для сверки при завершении загрузки.
SELECT part, data FROM archive_file_parts WHERE company_id = $1 AND file_id = $2 ORDER BY part;

-- name: GetArchivePart :one
SELECT data FROM archive_file_parts WHERE company_id = $1 AND file_id = $2 AND part = $3;

-- name: MarkArchiveReady :exec
UPDATE archive_files SET state = 'ready' WHERE company_id = $1 AND id = $2;

-- name: DeleteArchiveUpload :exec
-- Незавершённая загрузка, которую отказались принять.
DELETE FROM archive_files WHERE company_id = $1 AND id = $2 AND state = 'uploading';

-- name: DeleteStaleUploads :exec
-- Брошенные загрузки старше суток.
DELETE FROM archive_files WHERE company_id = $1 AND state = 'uploading' AND uploaded_at < $2;

-- name: SoftDeleteArchiveFile :execrows
UPDATE archive_files SET deleted_at = $3, deleted_by = $4
WHERE company_id = $1 AND id = $2 AND state = 'ready' AND deleted_at IS NULL;

-- name: RestoreArchiveFile :execrows
UPDATE archive_files SET deleted_at = NULL, deleted_by = ''
WHERE company_id = $1 AND id = $2 AND deleted_at IS NOT NULL;

-- name: PurgeArchiveFile :execrows
DELETE FROM archive_files WHERE company_id = $1 AND id = $2 AND deleted_at IS NOT NULL;
