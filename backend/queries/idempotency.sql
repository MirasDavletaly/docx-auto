-- Ключи идемпотентности. Видны только свои (RLS).

-- name: IdempotencyBegin :one
-- Занять ключ. Строка вернётся, если ключ новый, устарел (старше суток) или
-- завис в обработке дольше 5 минут; иначе – нет строк, ключ уже занят.
INSERT INTO idempotency_keys (company_id, user_id, key, request_hash)
VALUES ($1, $2, $3, $4)
ON CONFLICT (company_id, user_id, key) DO UPDATE
SET request_hash = excluded.request_hash, status = NULL, response = NULL, created_at = now()
WHERE idempotency_keys.created_at < now() - interval '24 hours'
   OR (idempotency_keys.status IS NULL AND idempotency_keys.created_at < now() - interval '5 minutes')
RETURNING created_at;

-- name: IdempotencyGet :one
SELECT request_hash, status, response
FROM idempotency_keys
WHERE company_id = $1 AND user_id = $2 AND key = $3;

-- name: IdempotencyFinish :exec
UPDATE idempotency_keys SET status = $4, response = $5
WHERE company_id = $1 AND user_id = $2 AND key = $3;

-- name: IdempotencyAbort :exec
-- Сбой сервера: ключ освобождается, повтор выполнит запрос заново.
DELETE FROM idempotency_keys WHERE company_id = $1 AND user_id = $2 AND key = $3;
