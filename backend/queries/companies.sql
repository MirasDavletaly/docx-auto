-- Компании. Какие видны – решает RLS (доступ человека), здесь фильтра нет:
-- запрос без контекста транзакции не вернёт ничего.

-- name: ListCompanies :many
SELECT id, name, bin, requisites, lock_version, updated_at
FROM companies
WHERE deleted_at IS NULL
ORDER BY name;

-- name: GetCompany :one
SELECT id, name, bin, requisites, lock_version, updated_at
FROM companies
WHERE id = $1 AND deleted_at IS NULL;

-- name: UpdateCompany :one
-- Оптимистичная блокировка: правка поверх чужой правки – конфликт (CLAUDE.md, п. 3.5).
UPDATE companies
SET name = $2, bin = $3, requisites = $4, lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND lock_version = $5 AND deleted_at IS NULL
RETURNING id, name, bin, requisites, lock_version, updated_at;

-- name: InsertCompany :exec
INSERT INTO companies (id, name, bin, requisites) VALUES ($1, $2, $3, $4);

-- name: SoftDeleteCompany :execrows
-- Физического удаления нет (CLAUDE.md, п. 3.4): компания помечается.
UPDATE companies SET deleted_at = now(), lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND lock_version = $2 AND deleted_at IS NULL;

-- name: CountCompanies :one
SELECT count(*) FROM companies;
