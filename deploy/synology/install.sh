#!/bin/bash
# Установка и обновление DocFlow на Synology с пакетом Docker (DSM 6.2) –
# docs/deploy-synology.md, «Установка» и «Обновление».
#
# Запуск – задачей DSM (Control Panel → Task Scheduler → Create → Scheduled
# Task → User-defined script, User: root), SSH не нужен:
#   bash /volume1/docker/docflow/deploy/synology/install.sh
# Ход работы – в docker/docflow-install.log (виден в File Station) и в
# письме DSM, если задача завершилась ошибкой. Паролей в выводе нет.
#
# Шаги: проверка Docker (20.10+), docker-compose (1.28+) и .env; сборка
# образов; база; docflow-init (db.sh init: пароль роли приложения, перенос
# копии из import/, копия базы перед миграциями); миграции; сервер и сайт;
# проверка. Порядок задаёт этот скрипт: docker-compose первой версии не
# умеет «дождаться завершения» контейнера.
#
# Повторный запуск – обновление: то же самое; настройки и данные остаются.
#
# DOCFLOW_TLS=off в .env – без проброса портов: HTTPS и адрес в интернете даёт
# Tailscale Funnel (пакет Tailscale в Package Center). Caddy отдаёт сайт по
# http на 127.0.0.1:DOCFLOW_LOCAL_PORT, этот скрипт включает Funnel на него.
set -euo pipefail

# Docker на DSM лежит в /usr/local/bin, а Task Scheduler запускает
# скрипты с коротким PATH.
export PATH="$PATH:/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin"

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$DEPLOY_DIR/../.." && pwd)"
DOCKER_DIR="$(dirname "$PKG_DIR")"
ENV_FILE="$DEPLOY_DIR/.env"
LOG="$DOCKER_DIR/docflow-install.log"

say() { printf '\n== %s\n' "$*"; }
note() { printf '   %s\n' "$*"; }
fail() {
  printf '\nОШИБКА: %s\n' "$*" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] || fail "запустите от root: в задаче Task Scheduler – General → User: root"

# Всё, что пишет установка, – и в журнал рядом с пакетом, и в вывод задачи.
# Файл заводится заранее: tee создаёт его не сразу. Права 644 – чтобы
# журнал открывался в File Station.
: >"$LOG"
chmod 644 "$LOG"
exec > >(tee -a "$LOG") 2>&1
trap 'printf "\nОШИБКА: установка прервана (install.sh, строка %s)\n" "$LINENO" >&2' ERR

# Версия a.b[.c] не меньше b1.b2.
version_ge() {
  local a1 a2 b1 b2
  IFS=. read -r a1 a2 _ <<<"${1#v}."
  IFS=. read -r b1 b2 _ <<<"$2."
  a1="${a1%%[!0-9]*}"
  a2="${a2%%[!0-9]*}"
  [ -n "$a1" ] || return 1
  [ "$a1" -gt "$b1" ] || { [ "$a1" -eq "$b1" ] && [ "${a2:-0}" -ge "$b2" ]; }
}

# Значение из .env без кавычек вокруг.
env_get() {
  local line
  line="$(grep -E "^$1=" "$ENV_FILE" | head -n 1 | tr -d '\r' || true)"
  line="${line#*=}"
  line="${line#\'}"
  printf '%s' "${line%\'}"
}

# ── 1. Что есть на NAS ──────────────────────────────────────────────────
say "DocFlow $(cat "$PKG_DIR/VERSION" 2>/dev/null || echo '?'): установка $(date '+%Y-%m-%d %H:%M')"
note "DSM: $( (. /etc.defaults/VERSION 2>/dev/null && echo "${productversion:-?}-${buildnumber:-?}") || echo '?')"
note "процессор: $(uname -m)"

command -v docker >/dev/null 2>&1 || fail "нет Docker: Package Center → Docker → Install"
docker_version="$(docker version --format '{{.Server.Version}}' 2>/dev/null || true)"
[ -n "$docker_version" ] || fail "Docker не отвечает: Package Center → Installed → Docker → Run"
note "Docker: $docker_version"
version_ge "$docker_version" 20.10 ||
  fail "Docker $docker_version старше 20.10 – образы DocFlow на нём не запустятся. Обновите пакет Docker до 20.10.3: сайт Synology → Download Center → модель NAS → Packages → Docker для DSM 6.2 (.spk) → Package Center → Manual Install; затем задачу снова → Run"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
  compose_version="$(docker compose version --short 2>/dev/null || docker compose version)"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
  compose_version="$(docker-compose version --short 2>/dev/null || true)"
  version_ge "$compose_version" 1.28 ||
    fail "docker-compose ${compose_version:-?} старше 1.28 – он не понимает docker-compose.yml DocFlow. Обновите пакет Docker до 20.10.3 (docs/deploy-synology.md, раздел 14)"
else
  fail "нет docker-compose: обновите пакет Docker до 20.10.3 (docs/deploy-synology.md, раздел 14)"
fi
note "docker-compose: $compose_version"

# ── 2. Пакет и настройки ────────────────────────────────────────────────
[ -f "$PKG_DIR/site/index.html" ] && [ -f "$PKG_DIR/.dockerignore" ] && [ -d "$PKG_DIR/bin" ] ||
  fail "пакет распакован не целиком: в $PKG_DIR нет site/, bin/ или .dockerignore"
[ -f "$ENV_FILE" ] ||
  fail "нет $ENV_FILE: загрузите в docker/docflow/deploy/synology/ файл .env, который сделал scripts/deploy/make-env.ps1"

need() {
  [[ "$(env_get "$1")" =~ $2 ]] ||
    fail "$1 в .env пуст или неверного вида – возьмите .env, который сделал scripts/deploy/make-env.ps1"
}
need COMPOSE_PROJECT_NAME '^[a-z0-9][a-z0-9_-]*$'
need DOCFLOW_SITE_NAME '^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$'
need DOCFLOW_HTTPS_PORT '^[0-9]{2,5}$'
need DOCFLOW_SITE_AUTH '^(on|off)?$'
SITE_AUTH="$(env_get DOCFLOW_SITE_AUTH)"
SITE_AUTH="${SITE_AUTH:-on}"
if [ "$SITE_AUTH" = on ]; then
  need DOCFLOW_SITE_PASSWORD '^.{12,}$'
  need DOCFLOW_GATE_TOKEN '^[0-9a-f]{64}$'
fi
need DOCFLOW_DB_OWNER_PASSWORD '^[0-9a-f]{32,}$'
need DOCFLOW_DB_APP_PASSWORD '^[0-9a-f]{32,}$'
need DOCFLOW_JWT_SECRET '^[0-9a-f]{64,}$'
need DOCFLOW_TLS '^(acme|off)?$'
need DOCFLOW_LOCAL_PORT '^([0-9]{2,5})?$'
SITE="$(env_get DOCFLOW_SITE_NAME)"
PORT="$(env_get DOCFLOW_HTTPS_PORT)"
TLS="$(env_get DOCFLOW_TLS)"
TLS="${TLS:-acme}"
LOCAL_PORT="$(env_get DOCFLOW_LOCAL_PORT)"
LOCAL_PORT="${LOCAL_PORT:-8088}"
if [ "$TLS" = off ]; then
  note "сайт: https://$SITE (Tailscale Funnel → 127.0.0.1:$LOCAL_PORT NAS)"
else
  note "сайт: https://$SITE (порт NAS $PORT)"
fi

# Tailscale (для DOCFLOW_TLS=off): пакет из Package Center.
TS=""
if [ "$TLS" = off ]; then
  for c in "$(command -v tailscale 2>/dev/null || true)" /var/packages/Tailscale/target/bin/tailscale; do
    [ -n "$c" ] && [ -x "$c" ] && { TS="$c"; break; }
  done
  [ -n "$TS" ] ||
    fail "DOCFLOW_TLS=off, но нет Tailscale: Package Center → Tailscale → Install, войти в учётную запись, затем задачу снова → Run"
  "$TS" status >/dev/null 2>&1 ||
    fail "Tailscale не подключён: Package Center → Tailscale → Open → войти (Reauthenticate), затем задачу снова → Run"
  note "Tailscale: $("$TS" version 2>/dev/null | head -n 1)"
fi

# Копии базы – рядом с пакетом: обновление пакета их не заденет.
mkdir -p "$DOCKER_DIR/docflow-backups"
chmod 700 "$DOCKER_DIR/docflow-backups"

# docker-compose читает .env и docker-compose.yml из текущей папки.
cd "$DEPLOY_DIR"
dc() { "${COMPOSE[@]}" "$@"; }

# ── 3. Образы и база ────────────────────────────────────────────────────
say "Сборка образов (первый раз – 5–10 минут)…"
dc build --pull || fail "сборка образов не удалась – причина выше. Есть ли у NAS выход в интернет?"

say "База…"
dc up -d db || fail "база не запустилась – причина выше"
for i in $(seq 1 90); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' docflow-db 2>/dev/null || true)" = healthy ] && break
  [ "$i" -lt 90 ] || fail "база не готова за 3 минуты: Docker → Container → docflow-db → Details → Log"
  sleep 2
done
note "база готова"

say "Пароль базы, перенос данных, копия (docflow-init)…"
dc --profile setup run --rm init ||
  fail "docflow-init завершился с ошибкой – причина в строках выше. Миграции и запуск не выполнялись"

say "Миграции…"
dc --profile setup run --rm migrate ||
  fail "миграции не прошли – причина выше. Копия базы до них – в docker/docflow-backups"

say "Сервер и сайт…"
dc up -d api web || fail "сервер или сайт не запустились – причина выше"

# ── 4. Проверка ─────────────────────────────────────────────────────────
# Без пароля на сайт главная страница отвечает 200, с паролем – 401.
OK_CODE=401
[ "$SITE_AUTH" = on ] || OK_CODE=200
say "Проверка…"
ready=0
for _ in $(seq 1 30); do
  if docker exec docflow-web wget -q -O /dev/null http://api:8080/readyz >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
[ "$ready" -eq 1 ] || fail "сервер API не готов за минуту: Docker → Container → docflow-api → Details → Log"
note "сервер API готов, база доступна"

if [ "$TLS" = off ]; then
  # Caddy после пересоздания стартует не сразу: хеш пароля на сайт на
  # процессоре NAS считается несколько секунд. Ждём до 90 секунд.
  code=""
  for _ in $(seq 1 45); do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$LOCAL_PORT/" || true)"
    [ "$code" = "$OK_CODE" ] && break
    sleep 2
  done
  if [ "$code" != "$OK_CODE" ]; then
    note "журнал docflow-web (последние строки):"
    docker logs --tail 30 docflow-web 2>&1 | sed 's/^/   | /' || true
    docker ps -a --filter name=docflow-web --format '   docflow-web: {{.Status}} {{.Ports}}' 2>/dev/null || true
    fail "сайт на 127.0.0.1:$LOCAL_PORT не отвечает (код ${code:-нет}) – причина в журнале выше. Если там «address already in use» – поменяйте DOCFLOW_LOCAL_PORT в .env"
  fi
  note "сайт отвечает на NAS ($([ "$SITE_AUTH" = on ] && echo 'пароль на сайт спрашивается' || echo 'без пароля на сайт'))"

  say "Tailscale Funnel → 127.0.0.1:$LOCAL_PORT…"
  # --bg: Funnel запоминается в Tailscale и сам включается после перезагрузки.
  # Если Funnel не разрешён в учётной записи, Tailscale печатает ссылку и
  # ждёт – ждём не дольше 2 минут.
  if timeout 120 "$TS" funnel --bg "http://127.0.0.1:$LOCAL_PORT"; then
    note "Funnel включён"
  else
    fail "Funnel не включился. Если выше ссылка https://login.tailscale.com/… – откройте её, разрешите Funnel (и HTTPS Certificates в DNS), затем задачу снова → Run"
  fi
  "$TS" funnel status 2>&1 | sed 's/^/   /' || true
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$SITE/" || true)"
  if [ "$code" = "$OK_CODE" ]; then
    note "HTTPS через Funnel работает"
  else
    note "https://$SITE пока не отвечает с самого NAS (код ${code:-нет}) – в первый раз"
    note "имя и сертификат Funnel появляются до 10 минут. Проверьте с телефона."
  fi
elif command -v curl >/dev/null 2>&1; then
  url="https://$SITE:$PORT/"
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 --resolve "$SITE:$PORT:127.0.0.1" "$url" || true)"
  if [ "$code" = "$OK_CODE" ]; then
    note "HTTPS работает: сертификат Let's Encrypt выдан"
  else
    code="$(curl -s -k -o /dev/null -w '%{http_code}' --max-time 15 --resolve "$SITE:$PORT:127.0.0.1" "$url" || true)"
    if [ "$code" = "$OK_CODE" ]; then
      note "сайт отвечает, но сертификат Let's Encrypt ещё не выпущен – обычно до нескольких минут"
    else
      note "HTTPS пока не отвечает: сертификат выпускается (до нескольких минут)."
    fi
    note "Не появился через 10 минут – проверьте проброс внешнего TCP 443 на порт $PORT NAS"
    note "и журнал: Docker → Container → docflow-web → Details → Log (строки про certificate)."
  fi
fi

# Старые образы после пересборки занимают место на дисках NAS.
docker image prune -f >/dev/null 2>&1 || true

say "Готово: DocFlow запущен – https://$SITE"
docker ps --filter name=docflow- --format '   {{.Names}}: {{.Status}}' 2>/dev/null || true
