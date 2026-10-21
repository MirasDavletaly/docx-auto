#!/bin/bash
# База DocFlow на Synology (docs/deploy-synology.md). Запускается внутри
# контейнеров с образом postgres:18-alpine, не на самом NAS.
#
#   init    – служебный контейнер init при каждой установке и обновлении,
#             до миграций (install.sh, docker-compose.yml):
#               • пароль роли docflow_app – по .env; роль без BYPASSRLS
#                 (CLAUDE.md, п. 3.1);
#               • база пустая и в import/ одна копия – перенести её;
#               • база не пустая – копия перед миграциями.
#   backup  – копия базы. Каждую ночь – задача DocFlow backup в Task Scheduler DSM:
#               docker exec docflow-db bash /docflow/db.sh backup
#
# Подключение – обычными переменными PostgreSQL (PGHOST, PGUSER,
# PGPASSWORD, PGDATABASE). Без PGHOST – через сокет: так db.sh работает
# внутри контейнера базы.
#
# Настройки: DOCFLOW_DB_APP_PASSWORD – пароль роли приложения;
# DOCFLOW_IMPORT_DIR (/import), DOCFLOW_BACKUP_DIR (/backups),
# DOCFLOW_BACKUP_KEEP (14) – сколько копий хранить.
set -euo pipefail

export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-docflow}"
IMPORT_DIR="${DOCFLOW_IMPORT_DIR:-/import}"
BACKUP_DIR="${DOCFLOW_BACKUP_DIR:-/backups}"
KEEP="${DOCFLOW_BACKUP_KEEP:-14}"

say() { printf 'db.sh: %s\n' "$*"; }
fail() {
  printf 'db.sh: ошибка: %s\n' "$*" >&2
  exit 1
}

value() { psql -X -tA -v ON_ERROR_STOP=1 -c "$1" | tr -d '\r'; }

# Копия базы: pg_dump во временный файл, проверка, переименование. Обрыв не
# остаётся и не выдаёт себя за копию. Время в имени – UTC.
backup() {
  local suffix="$1" name partial count old
  [[ "$KEEP" =~ ^[1-9][0-9]*$ ]] || fail "DOCFLOW_BACKUP_KEEP – число от 1"
  # Копии – персональные данные и хеши паролей: только для владельца.
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"
  name="docflow-$(date -u +%Y-%m-%d-%H%M%S)${suffix:+-$suffix}.dump"
  partial="$BACKUP_DIR/.$name.partial"
  trap 'rm -f "$partial"' EXIT
  (umask 077 && pg_dump --format=custom --file="$partial") || fail "pg_dump не выполнился, копия не сделана"
  pg_restore --list "$partial" >/dev/null || fail "копия не читается (pg_restore --list), не сохранена"
  mv "$partial" "$BACKUP_DIR/$name"
  trap - EXIT

  count=0
  while IFS= read -r old; do
    count=$((count + 1))
    [ "$count" -le "$KEEP" ] || rm -f -- "$old"
  done < <(ls -1t "$BACKUP_DIR"/docflow-*.dump 2>/dev/null)
  say "копия базы: $BACKUP_DIR/$name ($(wc -c <"$BACKUP_DIR/$name" | tr -d ' ') байт), хранится последних: $KEEP"
}

init() {
  local i err empty users dumps
  [[ "${DOCFLOW_DB_APP_PASSWORD:-}" =~ ^[0-9a-f]{32,}$ ]] ||
    fail "DOCFLOW_DB_APP_PASSWORD в .env пуст или не шестнадцатеричный (scripts/deploy/make-env.ps1)"

  for i in $(seq 1 90); do
    pg_isready -q && break
    [ "$i" -lt 90 ] || fail "база не отвечает 3 минуты: журнал контейнера docflow-db"
    sleep 2
  done
  # Образ postgres задаёт пароль владельца только при создании тома: .env,
  # созданный заново при живом томе, сюда не пустит.
  if ! err="$(psql -X -tA -c 'SELECT 1' 2>&1 >/dev/null)"; then
    fail "не удаётся войти в базу владельцем: DOCFLOW_DB_OWNER_PASSWORD в .env не тот, с которым база создана – верните прежний .env ($err)"
  fi

  # Пароль роли – через стандартный ввод psql, не аргументом.
  psql -X -q -v ON_ERROR_STOP=1 >/dev/null <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'docflow_app') THEN
    CREATE ROLE docflow_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
\$\$;
ALTER ROLE docflow_app WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '$DOCFLOW_DB_APP_PASSWORD';
SQL
  say "роль docflow_app: пароль из .env"

  empty="$(value "SELECT to_regclass('public.users') IS NULL")"
  shopt -s nullglob
  dumps=("$IMPORT_DIR"/*.dump)
  shopt -u nullglob

  if [ "$empty" != t ]; then
    backup before-update
    if [ "${#dumps[@]}" -gt 0 ]; then
      say "в import/ лежит копия, но база не пустая – копия не загружается. Удалите её: в ней хеши паролей и персональные данные."
    fi
    return
  fi

  case "${#dumps[@]}" in
    0)
      say "база пустая, копии в import/ нет – миграции создадут пустую базу"
      ;;
    1)
      say "перенос данных из ${dumps[0]##*/}…"
      # Одной транзакцией: при любой ошибке база остаётся пустой.
      pg_restore --no-owner --exit-on-error --single-transaction --dbname="$PGDATABASE" "${dumps[0]}" ||
        fail "копия не загрузилась; база осталась пустой"
      users="$(value "SELECT count(*) FROM users WHERE deleted_at IS NULL")"
      say "перенесено: учётных записей – $users. Удалите файл копии из import/: в нём хеши паролей и персональные данные."
      ;;
    *)
      fail "в import/ несколько копий (${dumps[*]##*/}) – оставьте одну"
      ;;
  esac
}

case "${1:-}" in
  init) init ;;
  backup) backup "" ;;
  *)
    echo "Использование: db.sh init | backup" >&2
    exit 2
    ;;
esac
