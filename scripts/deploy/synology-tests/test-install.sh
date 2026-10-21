#!/bin/bash
# Проверка deploy/synology/install.sh без NAS: docker, docker-compose, id и
# curl подменены заглушками – они записывают вызовы и отвечают как
# настоящие на DSM 6.2 (Docker 20.10.3, docker-compose 1.28.5).
#
#   bash scripts/deploy/synology-tests/test-install.sh
#
# Чего здесь не проверить: настоящий Docker, ядро DSM, выпуск сертификата.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
pass=0
failed=0
ok() { pass=$((pass + 1)); printf '  ok   %s\n' "$*"; }
bad() { failed=$((failed + 1)); printf '  FAIL %s\n' "$*"; return 1; }
check() { if eval "$2"; then ok "$1"; else bad "$1"; fi; }

hex() { od -An -N"$1" -tx1 /dev/urandom | tr -d ' \n'; }

new_env() {
  T="$(mktemp -d "${TMPDIR:-/tmp}/docflow-install-test.XXXX")"
  DOCKER_DIR="$T/volume1/docker"
  PKG="$DOCKER_DIR/docflow"
  mkdir -p "$PKG/deploy/synology" "$PKG/site" "$PKG/import" "$PKG/bin/linux-amd64" "$PKG/bin/linux-arm64" "$T/stub" "$T/state"
  cp "$REPO"/deploy/synology/{install.sh,db.sh,docker-compose.yml,Caddyfile,web-start.sh,Dockerfile.web,Dockerfile.server} "$PKG/deploy/synology/"
  echo '<html>' >"$PKG/site/index.html"
  echo '*' >"$PKG/.dockerignore"
  echo 'abc1234 2026-10-15' >"$PKG/VERSION"
  for a in amd64 arm64; do for c in api migrate admin; do echo ELF >"$PKG/bin/linux-$a/$c"; done; done
  OWNER_PW="$(hex 24)" APP_PW="$(hex 24)" JWT="$(hex 32)" GATE="$(hex 32)" SITE_PW='Site-Pass-123$x'
  cat >"$PKG/deploy/synology/.env" <<EOF
COMPOSE_PROJECT_NAME=docflow
DOCFLOW_SITE_NAME=docflow.synology.me
DOCFLOW_HTTPS_PORT=8443
DOCFLOW_SITE_PASSWORD='$SITE_PW'
DOCFLOW_GATE_TOKEN=$GATE
DOCFLOW_DB_OWNER_PASSWORD=$OWNER_PW
DOCFLOW_DB_APP_PASSWORD=$APP_PW
DOCFLOW_JWT_SECRET=$JWT
EOF
  cp "$HERE/stub-docker.sh" "$T/stub/docker"
  cp "$HERE/stub-docker-compose.sh" "$T/stub/docker-compose"
  printf '#!/bin/bash\nif [ "$1" = "-u" ]; then echo "${STUB_UID:-0}"; else /usr/bin/id "$@"; fi\n' >"$T/stub/id"
  cat >"$T/stub/curl" <<'EOF'
#!/bin/bash
echo "curl $*" >>"$STUB_STATE/calls.log"
case " $* " in
  *" -k "*) printf %s "${STUB_CURL_INSECURE:-401}" ;;
  *) printf %s "${STUB_CURL_SECURE:-401}" ;;
esac
EOF
  chmod +x "$T/stub/"*
  export STUB_STATE="$T/state"
  export PATH="$T/stub:/usr/bin:/bin:/mingw64/bin"
  INSTALL="$PKG/deploy/synology/install.sh"
  LOG="$DOCKER_DIR/docflow-install.log"
  : >"$T/state/calls.log"
}

line_no() { grep -n -m1 -- "$1" "$T/state/calls.log" | cut -d: -f1; }
before() { local a b; a="$(line_no "$1")"; b="$(line_no "$2")"; [ -n "$a" ] && [ -n "$b" ] && [ "$a" -lt "$b" ]; }
no_secrets() { ! grep -qF -e "$OWNER_PW" -e "$APP_PW" -e "$JWT" -e "$GATE" -e "Site-Pass" "$1"; }

echo "1. Установка: Docker 20.10.3, docker-compose 1.28.5"
new_env
out="$(bash "$INSTALL" 2>&1)"; code=$?
check "код 0" '[ $code -eq 0 ]' || echo "$out"
check "docker-compose первой версии" 'grep -q "^docker-compose .*build --pull" "$T/state/calls.log"'
check "порядок: сборка → база → init → migrate → сервер и сайт" 'before "build --pull" "up -d db" && before "up -d db" "run --rm init" && before "run --rm init" "run --rm migrate" && before "run --rm migrate" "up -d api web"'
check "init и migrate – с профилем setup" 'grep -q -- "--profile setup run --rm init" "$T/state/calls.log" && grep -q -- "--profile setup run --rm migrate" "$T/state/calls.log"'
check "ждал готовности базы" 'before "inspect" "run --rm init"'
check "проверил сервер API изнутри сети" 'grep -q "exec docflow-web wget .*api:8080/readyz" "$T/state/calls.log"'
check "проверил HTTPS по имени сайта" 'grep -q "curl .*--resolve docflow.synology.me:8443:127.0.0.1 https://docflow.synology.me:8443/" "$T/state/calls.log"'
check "папка копий создана рядом с пакетом" '[ -d "$DOCKER_DIR/docflow-backups" ]'
check "журнал в docker/docflow-install.log" '[ -s "$LOG" ] && grep -q "Готово" "$LOG"'
check "в журнале версии Docker и docker-compose" 'grep -q "20.10.3" "$LOG" && grep -q "1.28.5" "$LOG"'
check "в журнале нет паролей и ключей" 'no_secrets "$LOG"'
check "сказано, что сертификат выдан" 'grep -q "сертификат" <<<"$out"'

echo "2. docker compose второй версии"
new_env
out="$(STUB_COMPOSE_V2=1 bash "$INSTALL" 2>&1)"; code=$?
check "код 0" '[ $code -eq 0 ]' || echo "$out"
check "использован docker compose" 'grep -q "^docker compose .*build --pull" "$T/state/calls.log" && ! grep -q "^docker-compose .*build" "$T/state/calls.log"'

echo "3. Docker 18.09 – отказ до сборки"
new_env
out="$(STUB_DOCKER_VERSION=18.09.0 bash "$INSTALL" 2>&1)"; code=$?
check "код не 0" '[ $code -ne 0 ]'
check "сказано обновить Docker" 'grep -q "20.10" <<<"$out"'
check "ничего не собиралось" '! grep -q "build" "$T/state/calls.log"'

echo "4. docker-compose 1.24 – отказ"
new_env
out="$(STUB_COMPOSE_VERSION=1.24.0 bash "$INSTALL" 2>&1)"; code=$?
check "код не 0 и сказано про 1.28" '[ $code -ne 0 ] && grep -q "1.28" <<<"$out"'
check "ничего не собиралось" '! grep -q "build" "$T/state/calls.log"'

echo "5. Нет .env"
new_env
rm "$PKG/deploy/synology/.env"
out="$(bash "$INSTALL" 2>&1)"; code=$?
check "код не 0 и сказано про make-env.ps1" '[ $code -ne 0 ] && grep -q "make-env.ps1" <<<"$out"'

echo "6. Ключ пропуска испорчен"
new_env
sed -i 's/^DOCFLOW_GATE_TOKEN=.*/DOCFLOW_GATE_TOKEN=abc/' "$PKG/deploy/synology/.env"
out="$(bash "$INSTALL" 2>&1)"; code=$?
check "код не 0 и названа переменная" '[ $code -ne 0 ] && grep -q "DOCFLOW_GATE_TOKEN" <<<"$out"'
check "значение в журнал не попало" '! grep -q "=abc" "$LOG"'

echo "7. Сбой init – миграции и запуск не идут"
new_env
out="$(STUB_FAIL_ON="run --rm init" bash "$INSTALL" 2>&1)"; code=$?
check "код не 0" '[ $code -ne 0 ]'
check "migrate не запускался" '! grep -q "run --rm migrate" "$T/state/calls.log"'
check "сервер и сайт не запускались" '! grep -q "up -d api web" "$T/state/calls.log"'
check "сказано смотреть журнал docflow-init" 'grep -q "init" <<<"$out"'

echo "8. Не root"
new_env
out="$(STUB_UID=1026 bash "$INSTALL" 2>&1)"; code=$?
check "отказ" '[ $code -ne 0 ] && grep -q "root" <<<"$out"'

echo "9. Сертификат ещё не выпущен"
new_env
out="$(STUB_CURL_SECURE=000 STUB_CURL_INSECURE=000 bash "$INSTALL" 2>&1)"; code=$?
check "код 0 – это не ошибка установки" '[ $code -eq 0 ]' || echo "$out"
check "сказано про сертификат и проброс 443" 'grep -q "443" <<<"$out" && grep -q "сертификат" <<<"$out"'

echo
echo "Итого: $pass ok, $failed FAIL"
rm -rf "${TMPDIR:-/tmp}"/docflow-install-test.*
[ "$failed" -eq 0 ]
