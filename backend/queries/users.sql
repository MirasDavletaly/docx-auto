-- Учётные записи. Видимость – RLS: сам человек, люди текущей компании,
-- администратору платформы – все.

-- name: GetUserState :one
-- Для каждого запроса с токеном: действует ли ещё токен и какая роль.
SELECT u.id, u.token_version, u.blocked, u.deleted_at, u.role_id, r.scope
FROM users u JOIN roles r ON r.id = u.role_id
WHERE u.id = $1;

-- name: GetUser :one
SELECT id, login, display_name, role_id, section_ids, view_section_ids, granted_actions,
       profile, blocked, (password_hash IS NOT NULL)::boolean AS has_password, lock_version, created_at
FROM users
WHERE id = $1 AND deleted_at IS NULL;

-- name: ListUsers :many
SELECT id, login, display_name, role_id, section_ids, view_section_ids, granted_actions,
       profile, blocked, (password_hash IS NOT NULL)::boolean AS has_password, lock_version, created_at
FROM users
WHERE deleted_at IS NULL
ORDER BY display_name;

-- name: InsertUser :exec
INSERT INTO users (id, login, display_name, password_hash, role_id, section_ids, view_section_ids, granted_actions, profile, blocked, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);

-- name: UpdateUser :one
-- Смена роли или блокировка обнуляют выданные токены (token_version).
UPDATE users
SET display_name = $2, role_id = $3, section_ids = $4, view_section_ids = $5, granted_actions = $6,
    profile = $7, blocked = $8,
    token_version = CASE WHEN role_id <> $3 OR blocked <> $8 THEN token_version + 1 ELSE token_version END,
    lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND lock_version = $9 AND deleted_at IS NULL
RETURNING id, login, display_name, role_id, section_ids, view_section_ids, granted_actions,
          profile, blocked, (password_hash IS NOT NULL)::boolean AS has_password, lock_version, created_at;

-- name: UpdateOwnProfile :one
-- Своё: имя и профиль. Роль, доступ и блокировку человек себе не меняет.
UPDATE users
SET display_name = $2, profile = $3, lock_version = lock_version + 1, updated_at = now()
WHERE id = $1 AND lock_version = $4 AND deleted_at IS NULL
RETURNING id, lock_version;

-- name: UpdateUserLogin :exec
-- Смена логина (access.CanChangeLogin) – чужого при правке учётной записи,
-- своего – в профиле. Занятый логин, в любом регистре, отвергает индекс
-- users_login_key.
UPDATE users SET login = $2, updated_at = now() WHERE id = $1 AND deleted_at IS NULL;

-- name: SoftDeleteUser :execrows
-- Физического удаления нет (CLAUDE.md, п. 3.4): запись помечается, токены
-- перестают действовать, логин освобождается для новой учётной записи.
UPDATE users
SET deleted_at = now(), token_version = token_version + 1, updated_at = now()
WHERE id = $1 AND lock_version = $2 AND deleted_at IS NULL;

-- name: SetPassword :exec
-- Новый пароль: старые токены перестают действовать, блокировка снимается.
UPDATE users
SET password_hash = $2, token_version = token_version + 1, failed_attempts = 0, locked_until = NULL, updated_at = now()
WHERE id = $1 AND deleted_at IS NULL;

-- name: GetPasswordHash :one
SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL;

-- name: ListUserCompanyPairs :many
-- Доступы всех видимых людей одним запросом – без запроса на каждого (N+1).
-- Удалённые компании в доступах не показываются.
SELECT uc.user_id, uc.company_id
FROM user_companies uc JOIN companies c ON c.id = uc.company_id AND c.deleted_at IS NULL
ORDER BY uc.user_id, uc.company_id;

-- name: UserCompanyIDs :many
SELECT uc.company_id
FROM user_companies uc JOIN companies c ON c.id = uc.company_id AND c.deleted_at IS NULL
WHERE uc.user_id = $1
ORDER BY uc.company_id;

-- name: HasCompanyAccess :one
SELECT EXISTS (SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2);

-- name: AddUserCompany :exec
INSERT INTO user_companies (company_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;

-- name: RemoveUserCompany :exec
DELETE FROM user_companies WHERE company_id = $1 AND user_id = $2;

-- name: RolePermissions :many
SELECT permission FROM role_permissions WHERE role_id = $1 ORDER BY permission;

-- name: GetRole :one
SELECT id, title, scope FROM roles WHERE id = $1;
