#!/bin/bash
# Проверка deploy/synology/db.sh на настоящем PostgreSQL – без Docker и NAS.
#
#   bash scripts/deploy/synology-tests/test-db.sh
#
# Заводит временный кластер PostgreSQL с входом по паролю (scram, как в
# контейнере postgres:18-alpine), прогоняет db.sh init/backup так, как их
# запускают контейнеры init и db, затем миграции (cmd/migrate) и вход через
# сервер API ролью docflow_app по паролю из «.env». Кластер удаляется.
#
# Нужны: PostgreSQL 18 (PGBIN, по умолчанию C:\Program Files\PostgreSQL\18\bin
# или из PATH), Go, curl. Порт – DOCFLOW_TEST_PG_PORT (55498).
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
DB_SH="$REPO/deploy/synology/db.sh"
if [ -z "${PGBIN:-}" ] && [ -d "/c/Program Files/PostgreSQL/18/bin" ]; then PGBIN="/c/Program Files/PostgreSQL/18/bin"; fi
[ -n "${PGBIN:-}" ] && export PATH="$PGBIN:$PATH"
PORT="${DOCFLOW_TEST_PG_PORT:-55498}"
API_PORT=18099

pass=0
failed=0
ok() { pass=$((pass + 1)); printf '  ok   %s\n' "$*"; }
bad() { failed=$((failed + 1)); printf '  FAIL %s\n' "$*"; return 1; }
check() { if eval "$2"; then ok "$1"; else bad "$1"; fi; }

T="$(mktemp -d "${TMPDIR:-/tmp}/docflow-db-test.XXXX")"
OWNER_PW="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
APP_PW="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
api_pid=""
cleanup() {
  [ -n "$api_pid" ] && kill "$api_pid" 2>/dev/null
  pg_ctl -D "$T/data" -m immediate stop >/dev/null 2>&1
  rm -rf "$T"
}
trap cleanup EXIT

echo "Временный кластер PostgreSQL (порт $PORT, вход по паролю)…"
printf '%s\n' "$OWNER_PW" >"$T/pw"
initdb -D "$T/data" -U postgres --auth=scram-sha-256 --pwfile="$T/pw" -E UTF8 --locale=C >/dev/null || { echo "initdb не выполнился"; exit 1; }
rm -f "$T/pw"
pg_ctl -D "$T/data" -o "-p $PORT -c listen_addresses=127.0.0.1" -l "$T/pg.log" -w start >/dev/null 2>&1 || { cat "$T/pg.log"; exit 1; }

# Как в контейнере init (docker-compose.yml).
export PGHOST=127.0.0.1 PGPORT="$PORT" PGUSER=postgres PGPASSWORD="$OWNER_PW" PGDATABASE=docflow
export DOCFLOW_DB_APP_PASSWORD="$APP_PW" DOCFLOW_IMPORT_DIR="$T/import" DOCFLOW_BACKUP_DIR="$T/backups"
mkdir -p "$T/import"
OWNER_URL="postgres://postgres:$OWNER_PW@127.0.0.1:$PORT/docflow?sslmode=disable"
SRC_URL="postgres://postgres:$OWNER_PW@127.0.0.1:$PORT/src?sslmode=disable"

q() { psql -X -tA "$@" 2>&1 | tr -d '\r'; }
recreate() { psql -X -q -d postgres -c "DROP DATABASE IF EXISTS docflow WITH (FORCE)" -c "CREATE DATABASE docflow" >/dev/null; }
dumps() { ls "$T/backups"/docflow-*.dump 2>/dev/null | wc -l | tr -d ' '; }

echo "Копия для переноса: база src с миграциями и администратором…"
psql -X -q -d postgres -c "CREATE DATABASE src" >/dev/null
(cd "$REPO/backend" && DATABASE_OWNER_URL="$SRC_URL" go run ./cmd/migrate >/dev/null) || { echo "миграции src не прошли"; exit 1; }
(cd "$REPO/backend" && printf 'test-pass-123\n' | DATABASE_OWNER_URL="$SRC_URL" go run ./cmd/admin create-admin -login tester -name 'Проверка' >/dev/null) || { echo "create-admin не прошёл"; exit 1; }
pg_dump -d src --format=custom --exclude-table-data=refresh_tokens --exclude-table-data=idempotency_keys -f "$T/src.dump" || { echo "pg_dump src не прошёл"; exit 1; }

echo "1. init: пустая база, копии нет"
recreate
out="$(bash "$DB_SH" init 2>&1)"; code=$?
check "код 0" '[ $code -eq 0 ]' || echo "$out"
check "роль docflow_app: вход по паролю из .env" '[ "$(PGUSER=docflow_app PGPASSWORD="$APP_PW" q -c "SELECT current_user")" = docflow_app ]'
check "роль без BYPASSRLS и не суперпользователь" '[ "$(q -c "SELECT rolbypassrls::text || rolsuper::text FROM pg_roles WHERE rolname = '"'"'docflow_app'"'"'")" = falsefalse ]'
check "чужой пароль роли не подходит" '[ "$(PGUSER=docflow_app PGPASSWORD=wrong q -c "SELECT 1" | grep -c "password authentication failed")" -ge 1 ]'
check "копии не делались (база пустая)" '[ "$(dumps)" -eq 0 ]'
check "сказано, что база пустая" 'grep -q "пустая" <<<"$out"'

echo "2. init: пароль роли меняется вместе с .env"
APP_PW2="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
out="$(DOCFLOW_DB_APP_PASSWORD="$APP_PW2" bash "$DB_SH" init 2>&1)"; code=$?
check "код 0" '[ $code -eq 0 ]' || echo "$out"
check "новый пароль подходит" '[ "$(PGUSER=docflow_app PGPASSWORD="$APP_PW2" q -c "SELECT 1")" = 1 ]'
check "старый – нет" '[ "$(PGUSER=docflow_app PGPASSWORD="$APP_PW" q -c "SELECT 1" | grep -c "password authentication failed")" -ge 1 ]'
bash "$DB_SH" init >/dev/null 2>&1

echo "3. init: две копии в import/ – отказ"
cp "$T/src.dump" "$T/import/a.dump"; cp "$T/src.dump" "$T/import/b.dump"
out="$(bash "$DB_SH" init 2>&1)"; code=$?
check "код не 0" '[ $code -ne 0 ]'
check "сказано оставить одну" 'grep -q "несколько" <<<"$out"'
check "база осталась пустой" '[ "$(q -c "SELECT to_regclass('"'"'public.users'"'"') IS NULL")" = t ]'
rm -f "$T/import/b.dump"

echo "4. init: перенос копии в пустую базу"
out="$(bash "$DB_SH" init 2>&1)"; code=$?
check "код 0" '[ $code -eq 0 ]' || echo "$out"
check "администратор перенесён" '[ "$(q -c "SELECT count(*) FROM users WHERE login = '"'"'tester'"'"'")" = 1 ]'
check "сказано, сколько учётных записей" 'grep -q "учётных записей – 1" <<<"$out"'
check "напомнено удалить копию" 'grep -q "Удалите" <<<"$out"'
check "права docflow_app перенесены" '[ "$(q -c "SELECT has_table_privilege('"'"'docflow_app'"'"', '"'"'users'"'"', '"'"'SELECT'"'"')")" = t ]'

echo "5. Миграции и вход через сервер API ролью docflow_app"
(cd "$REPO/backend" && DATABASE_OWNER_URL="$OWNER_URL" go run ./cmd/migrate >"$T/migrate.log" 2>&1); code=$?
check "migrate после переноса – код 0" '[ $code -eq 0 ]' || cat "$T/migrate.log"
(cd "$REPO/backend" && go build -o "$T/api" ./cmd/api) || bad "сборка api"
AUTH_JWT_SECRET="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')" APP_ENV=prod LOG_JSON=true HTTP_ADDR="127.0.0.1:$API_PORT" \
  METRICS_ADDR=127.0.0.1:0 AUTH_COOKIE_SECURE=true \
  DATABASE_URL="postgres://docflow_app:$APP_PW@127.0.0.1:$PORT/docflow?sslmode=disable" "$T/api" >"$T/api.log" 2>&1 &
api_pid=$!
for _ in $(seq 1 40); do curl -s -o /dev/null "http://127.0.0.1:$API_PORT/readyz" && break; sleep 0.5; done
check "/readyz – 200 (база доступна по паролю)" '[ "$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$API_PORT/readyz")" = 200 ]'
check "вход перенесённого администратора – 200" '[ "$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "{\"login\":\"tester\",\"password\":\"test-pass-123\"}" "http://127.0.0.1:$API_PORT/api/auth/login")" = 200 ]'
kill "$api_pid" 2>/dev/null; api_pid=""

echo "6. init: база не пустая – копия перед миграциями, перенос не повторяется"
out="$(bash "$DB_SH" init 2>&1)"; code=$?
check "код 0" '[ $code -eq 0 ]' || echo "$out"
check "копия снята" '[ "$(dumps)" -eq 1 ] && ls "$T/backups" | grep -q before-update'
check "копия – архив pg_dump" '[ "$(head -c5 "$(ls -t "$T/backups"/docflow-*.dump | head -1)")" = PGDMP ]'
check "администратор не задвоился" '[ "$(q -c "SELECT count(*) FROM users")" = 1 ]'
check "сказано удалить лишнюю копию из import/" 'grep -q "не загружается" <<<"$out"'
rm -f "$T/import/a.dump"

echo "7. backup: хранится 14 последних"
for i in $(seq -w 1 16); do echo old >"$T/backups/docflow-2026-09-$i-000000.dump"; touch -d "2026-09-$i 00:00" "$T/backups/docflow-2026-09-$i-000000.dump"; done
out="$(bash "$DB_SH" backup 2>&1)"; code=$?
check "код 0" '[ $code -eq 0 ]' || echo "$out"
check "осталось 14" '[ "$(dumps)" -eq 14 ]'
check "старейшие удалены, новые на месте" '[ ! -e "$T/backups/docflow-2026-09-01-000000.dump" ] && [ ! -e "$T/backups/docflow-2026-09-04-000000.dump" ] && [ -e "$T/backups/docflow-2026-09-05-000000.dump" ]'

echo "8. backup: сбой pg_dump – ни копии, ни обрывка"
before="$(ls -A "$T/backups" | sort)"
out="$(PGDATABASE=no_such_db bash "$DB_SH" backup 2>&1)"; code=$?
check "код не 0" '[ $code -ne 0 ]'
check "в папке ничего не прибавилось" '[ "$(ls -A "$T/backups" | sort)" = "$before" ]'

echo "9. init: пароль владельца в .env не тот"
out="$(PGPASSWORD=wrong bash "$DB_SH" init 2>&1)"; code=$?
check "код не 0" '[ $code -ne 0 ]'
check "сказано про DOCFLOW_DB_OWNER_PASSWORD" 'grep -q "DOCFLOW_DB_OWNER_PASSWORD" <<<"$out"'

echo "10. init: пароль роли приложения пуст"
out="$(DOCFLOW_DB_APP_PASSWORD= bash "$DB_SH" init 2>&1)"; code=$?
check "код не 0 и сказано про DOCFLOW_DB_APP_PASSWORD" '[ $code -ne 0 ] && grep -q "DOCFLOW_DB_APP_PASSWORD" <<<"$out"'

echo
echo "Итого: $pass ok, $failed FAIL"
[ "$failed" -eq 0 ]
