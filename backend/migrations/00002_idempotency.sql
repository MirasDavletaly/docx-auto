-- Ключи идемпотентности для создающих POST (CLAUDE.md, п. 3.5).
--
-- Сайт отправляет с каждым созданием заголовок Idempotency-Key. Повтор того же
-- запроса (обрыв связи, двойной щелчок) получает сохранённый ответ, а не
-- второй созданный объект. Ключ живёт сутки.
--
-- Ключ принадлежит человеку в компании: company_id – первым в ключе
-- (п. 3.1); пусто – компания ещё не выбрана (администратор платформы).

-- +goose Up

CREATE TABLE idempotency_keys (
  company_id   text NOT NULL DEFAULT '',
  user_id      text NOT NULL REFERENCES users (id),
  key          text NOT NULL CHECK (length(key) BETWEEN 8 AND 200),
  -- SHA-256 метода, пути и тела: тот же ключ с другим запросом – ошибка.
  request_hash bytea NOT NULL,
  -- NULL – запрос ещё обрабатывается.
  status       integer,
  response     bytea,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id, key)
);
-- TODO(phase-02): удаление ключей старше суток фоновой задачей; пока старый
-- ключ просто перезаписывается при повторном использовании.

ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY idempotency_keys_own ON idempotency_keys
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON idempotency_keys TO docflow_app;

-- +goose Down

DROP POLICY idempotency_keys_own ON idempotency_keys;
DROP TABLE idempotency_keys;
