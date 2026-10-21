#!/bin/sh
# Запуск Caddy с сайтом DocFlow (Dockerfile.web).
#
# Пароль на сайт приходит из .env открытым (DOCFLOW_SITE_PASSWORD): он и так
# один на всех и сообщается сотрудникам. Хеш для basic_auth считается
# здесь, при каждом запуске – на компьютере разработчика для этого ничего
# не нужно. Пароль идёт в caddy hash-password через стандартный ввод.
#
# Пустой ключ пропуска открыл бы сайт без пароля (Caddyfile) – без 64 знаков
# hex Caddy не запускается.
set -eu

CADDYFILE="${DOCFLOW_CADDYFILE:-/etc/caddy/Caddyfile}"

fail() {
  echo "web-start: $*" >&2
  exit 1
}

printf '%s' "${DOCFLOW_SITE_NAME:-}" | grep -Eqx '[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?' ||
  fail "DOCFLOW_SITE_NAME в .env пуст или не похож на имя сайта (scripts/deploy/make-env.ps1)"
case "${DOCFLOW_SITE_AUTH:-on}" in
  on | off) ;;
  *) fail "DOCFLOW_SITE_AUTH в .env – on или off" ;;
esac
export DOCFLOW_SITE_AUTH="${DOCFLOW_SITE_AUTH:-on}"
password="${DOCFLOW_SITE_PASSWORD:-}"
if [ "$DOCFLOW_SITE_AUTH" = on ]; then
  [ "${#password}" -ge 12 ] || fail "DOCFLOW_SITE_PASSWORD в .env пуст или короче 12 знаков (scripts/deploy/make-env.ps1)"
  printf '%s' "${DOCFLOW_GATE_TOKEN:-}" | grep -Eqx '[0-9a-f]{64}' ||
    fail "DOCFLOW_GATE_TOKEN в .env – не 64 знака hex (scripts/deploy/make-env.ps1)"
fi

# Кто держит HTTPS (Caddyfile, DOCFLOW_TLS).
case "${DOCFLOW_TLS:-acme}" in
  acme | internal)
    DOCFLOW_SITE_ADDR="$DOCFLOW_SITE_NAME"
    DOCFLOW_TRUSTED_PROXIES="127.0.0.1/32"
    ;;
  off)
    # Порт 80 контейнера открыт только на 127.0.0.1 NAS (docker-compose.yml):
    # подключиться может лишь посредник на самом NAS – через сеть Docker,
    # поэтому ему (частным адресам) и верим в X-Forwarded-For.
    DOCFLOW_SITE_ADDR="http://:80"
    DOCFLOW_TRUSTED_PROXIES="private_ranges"
    ;;
  *) fail "DOCFLOW_TLS в .env – acme или off" ;;
esac
export DOCFLOW_TLS="${DOCFLOW_TLS:-acme}" DOCFLOW_SITE_ADDR DOCFLOW_TRUSTED_PROXIES

if [ "$DOCFLOW_SITE_AUTH" = on ]; then
  DOCFLOW_AUTH_HASH="$(printf '%s\n' "$password" | caddy hash-password)"
  case "$DOCFLOW_AUTH_HASH" in
    '$2'*) ;;
    *) fail "не получился хеш пароля на сайт" ;;
  esac
  export DOCFLOW_AUTH_HASH
fi
unset password DOCFLOW_SITE_PASSWORD

exec caddy run --config "$CADDYFILE" --adapter caddyfile
