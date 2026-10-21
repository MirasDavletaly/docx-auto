-- Персонал: пользователи компании с карточкой (docs/plans/phase-01b-personnel.md).
-- Видимость – RLS: люди текущей компании, администратору платформы – все;
-- компания запроса – ещё и фильтром здесь (CLAUDE.md, п. 3.2).

-- name: ListPersonnel :many
-- company_id – из токена; NULL – все видимые (администратор платформы).
SELECT u.id, uc.company_id, u.display_name, u.name_genitive, u.name_kk, u.name_kk_dative, u.name_en,
       uc.position, uc.position_kk, uc.position_en, uc.unit, uc.unit_kk, uc.unit_en, u.lock_version
FROM user_companies uc
JOIN users u ON u.id = uc.user_id AND u.deleted_at IS NULL
JOIN companies c ON c.id = uc.company_id AND c.deleted_at IS NULL
WHERE (sqlc.narg('company_id')::text IS NULL OR uc.company_id = sqlc.narg('company_id')::text)
ORDER BY uc.company_id, u.display_name, u.id;

-- name: GetPersonnelCard :one
SELECT u.id, uc.company_id, u.display_name, u.name_genitive, u.name_kk, u.name_kk_dative, u.name_en,
       uc.position, uc.position_kk, uc.position_en, uc.unit, uc.unit_kk, uc.unit_en, u.lock_version
FROM user_companies uc
JOIN users u ON u.id = uc.user_id AND u.deleted_at IS NULL
JOIN companies c ON c.id = uc.company_id AND c.deleted_at IS NULL
WHERE uc.company_id = $1 AND uc.user_id = $2;

-- name: CompanyPositions :many
-- Должности людей в компании – для «Пользователей» одним запросом (без N+1).
SELECT user_id, position FROM user_companies WHERE company_id = $1;

-- name: UpdatePersonName :one
-- Имя и его формы; версия записи растёт и при правке одной карточки.
UPDATE users
SET display_name = $2, name_genitive = $3, name_kk = $4, name_kk_dative = $5, name_en = $6,
    lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND lock_version = $7 AND deleted_at IS NULL
RETURNING lock_version;

-- name: SetPersonNames :exec
-- Формы имени нового человека – сразу после INSERT, версия не растёт.
UPDATE users
SET name_genitive = $2, name_kk = $3, name_kk_dative = $4, name_en = $5
WHERE id = $1 AND deleted_at IS NULL;

-- name: UpdatePersonnelCard :execrows
UPDATE user_companies
SET position = $3, position_kk = $4, position_en = $5, unit = $6, unit_kk = $7, unit_en = $8
WHERE company_id = $1 AND user_id = $2;

-- name: BumpUserVersion :one
-- Проверка версии перед действием без правки полей (уход из персонала).
UPDATE users
SET lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND lock_version = $2 AND deleted_at IS NULL
RETURNING lock_version;

-- name: UserCompanyCount :one
-- Число компаний человека мимо RLS (функция app_user_company_count).
SELECT app_user_company_count($1)::integer AS n;
