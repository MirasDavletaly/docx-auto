#!/usr/bin/env bash
# Установка и обновление сайта DocFlow на сервере одной командой.
#
#   sudo bash /opt/docflow/deploy/setup-server.sh
#
# Первый запуск: ставит Docker, открывает порты 80 и 443, спрашивает домен,
# почту и пароль на сайт, записывает deploy/.env, собирает и запускает сайт,
# включает защиту от подбора пароля (fail2ban), ждёт сертификат HTTPS.
# Повторный запуск (после распаковки нового пакета): настройки уже есть –
# пересобирает сайт на свежих базовых образах и перезапускает его.
#
# Подробно и вручную, по шагам – docs/deploy.md.

set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DEPLOY_DIR/.env"
# Та же версия, что в deploy/Dockerfile.
CADDY_IMAGE="caddy:2.11-alpine"
LOG_DIR="$DEPLOY_DIR/logs"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mОшибка: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "запустите от root: sudo bash $0"

# ── 1. Docker ───────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  say "Ставлю Docker…"
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || fail "нет docker compose; поставьте Docker заново: curl -fsSL https://get.docker.com | sh"

# ── 2. Порты ────────────────────────────────────────────────────────────
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  say "Открываю порты 80 и 443 в ufw…"
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
fi

# ── 3. Настройки ────────────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  say "Настройки сайта"

  read -r -p "Домен сайта (например docs.company.kz) или IP сервера, если домена нет: " DOMAIN
  DOMAIN="${DOMAIN#http://}"
  DOMAIN="${DOMAIN#https://}"
  DOMAIN="${DOMAIN%%/*}"
  [ -n "$DOMAIN" ] || fail "домен не указан"

  # Домена нет – только IP. По http://IP сайт не работает: без HTTPS браузер
  # не даёт проверять пароли. Бесплатное имя 1-2-3-4.sslip.io указывает на
  # этот IP, и на него Let's Encrypt выдаёт настоящий сертификат – без
  # предупреждений в браузере (docs/deploy.md, «Если домена нет»).
  if [[ "$DOMAIN" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
    DOMAIN="${DOMAIN//./-}.sslip.io"
    echo "Домена нет – сайт будет по адресу https://$DOMAIN (бесплатное имя для IP)."
  fi

  read -r -p "Почта для писем о сертификате HTTPS: " EMAIL
  [ -n "$EMAIL" ] || fail "почта не указана"

  read -r -p "Логин пароля на сайт [docflow]: " SITE_USER
  SITE_USER="${SITE_USER:-docflow}"

  while true; do
    read -r -s -p "Пароль на сайт (не короче 12 знаков): " SITE_PASS; echo
    read -r -s -p "Ещё раз: " SITE_PASS2; echo
    if [ "${#SITE_PASS}" -lt 12 ]; then echo "Слишком короткий."; continue; fi
    if [ "$SITE_PASS" != "$SITE_PASS2" ]; then echo "Не совпадают."; continue; fi
    break
  done

  say "Считаю хеш пароля…"
  # Пароль идёт через stdin, а не аргументом: так его не видно в списке
  # процессов. Если эта версия Caddy так не умеет – через аргумент.
  HASH="$(printf '%s\n' "$SITE_PASS" | docker run --rm -i "$CADDY_IMAGE" caddy hash-password 2>/dev/null | tail -n 1 || true)"
  case "$HASH" in
    '$2'*) ;;
    *) HASH="$(docker run --rm "$CADDY_IMAGE" caddy hash-password --plaintext "$SITE_PASS" | tail -n 1)" ;;
  esac
  case "$HASH" in
    '$2'*) ;;
    *) fail "не удалось получить хеш пароля" ;;
  esac
  unset SITE_PASS SITE_PASS2

  # Хеш – в одинарных кавычках: в нём знаки $, и docker compose иначе
  # принял бы их за переменные.
  umask 077
  cat > "$ENV_FILE" <<EOF
DOCFLOW_DOMAIN=$DOMAIN
DOCFLOW_ACME_EMAIL=$EMAIL
DOCFLOW_AUTH_USER=$SITE_USER
DOCFLOW_AUTH_HASH='$HASH'
EOF
  chmod 600 "$ENV_FILE"
  echo "Записано: $ENV_FILE"
else
  say "Настройки уже есть ($ENV_FILE) – обновляю сайт."
fi

DOMAIN="$(grep '^DOCFLOW_DOMAIN=' "$ENV_FILE" | cut -d= -f2-)"

# ── 4. Домен смотрит на этот сервер? ────────────────────────────────────
SERVER_IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
DOMAIN_IP="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1 {print $1}' || true)"
if [ -n "$SERVER_IP" ] && [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
  say "Внимание: домен $DOMAIN указывает на '${DOMAIN_IP:-никуда}', а IP этого сервера – $SERVER_IP."
  echo "Сертификат HTTPS выдадут, только когда A-запись домена укажет на этот сервер (docs/deploy.md, шаг 2)."
  echo "Сайт всё равно запускается: Caddy будет пробовать получить сертификат сам."
fi

# ── 5. Сборка и запуск ──────────────────────────────────────────────────
# Журнал запросов: пишет Caddy из контейнера, читает fail2ban. Файл создаём
# заранее – fail2ban не включает защиту для журнала, которого ещё нет.
mkdir -p "$LOG_DIR"
chmod 750 "$LOG_DIR"
touch "$LOG_DIR/access.log"
chmod 640 "$LOG_DIR/access.log"

say "Собираю и запускаю сайт (первый раз – несколько минут)…"
cd "$DEPLOY_DIR"
# --pull: базовые образы (Node, Caddy) – свежие, с исправлениями уязвимостей.
docker compose build --pull
docker compose up -d

# ── 6. Защита от подбора пароля на сайт ─────────────────────────────────
# fail2ban читает журнал Caddy и закрывает адрес после 10 неверных паролей
# за 10 минут (deploy/fail2ban). Заодно включается его стандартная защита
# SSH. Если поставить не вышло – сайт всё равно работает, скрипт скажет.
# Внутри функции, вызванной в if, set -e не действует – поэтому || return.
setup_fail2ban() {
  if ! command -v fail2ban-client >/dev/null 2>&1; then
    command -v apt-get >/dev/null 2>&1 || return 1
    DEBIAN_FRONTEND=noninteractive apt-get update -qq >/dev/null || return 1
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban >/dev/null || return 1
  fi
  install -m 644 "$DEPLOY_DIR/fail2ban/docflow-caddy.filter.conf" \
    /etc/fail2ban/filter.d/docflow-caddy.conf || return 1
  sed "s#@LOGPATH@#$LOG_DIR/access.log#" "$DEPLOY_DIR/fail2ban/docflow-caddy.jail.conf" \
    > /etc/fail2ban/jail.d/docflow-caddy.local || return 1
  # Блокировки ставятся в цепочку Docker – fail2ban стартует после Docker.
  mkdir -p /etc/systemd/system/fail2ban.service.d || return 1
  printf '[Unit]\nAfter=docker.service\n' > /etc/systemd/system/fail2ban.service.d/docflow.conf || return 1
  systemctl daemon-reload || return 1
  systemctl enable fail2ban >/dev/null 2>&1 || return 1
  systemctl restart fail2ban || return 1
  for _ in $(seq 1 10); do
    fail2ban-client status docflow-caddy >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

say "Включаю защиту от подбора пароля (fail2ban)…"
if setup_fail2ban; then
  echo "Включена: 10 неверных паролей за 10 минут – адрес закрыт на час."
  echo "Кто закрыт сейчас: fail2ban-client status docflow-caddy"
else
  say "Внимание: защита от подбора пароля не включилась – сайт работает без неё."
  echo "Причина – в журнале: journalctl -u fail2ban -n 30"
  echo "Настроить вручную – docs/deploy.md, «Защита от подбора пароля»."
fi

# ── 7. Проверка ─────────────────────────────────────────────────────────
say "Жду сертификат HTTPS…"
for _ in $(seq 1 36); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://$DOMAIN/" || true)"
  # 401 – сайт отвечает и спрашивает пароль на сайт: HTTPS работает.
  if [ "$CODE" = "401" ] || [ "$CODE" = "200" ]; then
    say "Готово: https://$DOMAIN"
    echo "1. Откройте адрес, введите логин и пароль на сайт."
    echo "2. На экране «Первый запуск» заведите администратора системы."
    echo "Обновление: распакуйте новый пакет в /opt и запустите этот скрипт снова."
    exit 0
  fi
  sleep 5
done

say "Сайт запущен, но по https://$DOMAIN пока не отвечает."
echo "Частая причина – домен ещё не указывает на сервер или закрыт порт 80."
echo "Журнал сайта: cd $DEPLOY_DIR && docker compose logs --tail 50 web"
exit 1
