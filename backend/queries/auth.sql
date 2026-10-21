-- Вход и refresh-токены.

-- name: AuthFindUser :one
SELECT id, password_hash, token_version, locked_until, blocked FROM auth_find_user($1);

-- name: AuthRecordFailure :one
SELECT auth_record_failure($1, $2, $3)::timestamptz AS locked_until;

-- name: AuthRecordSuccess :exec
SELECT auth_record_success($1);

-- name: AuthFindRefresh :one
SELECT id, user_id, family_id, token_version, expires_at, used_at, revoked_at FROM auth_find_refresh($1);

-- name: InsertRefresh :exec
INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, token_version, expires_at) VALUES ($1, $2, $3, $4, $5, $6);

-- name: MarkRefreshUsed :execrows
-- Использовать можно один раз: второе использование – признак кражи.
UPDATE refresh_tokens SET used_at = now() WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL;

-- name: RevokeRefreshFamily :exec
UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL;

-- name: InsertAudit :exec
INSERT INTO audit_log (company_id, user_id, user_name, event, target, ip) VALUES ($1, $2, $3, $4, $5, $6);
