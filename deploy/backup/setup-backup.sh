#!/usr/bin/env bash
# Сервер: принимать ночной бэкап исходного кода с компьютера (docs/backup.md).
#
#   sudo bash /opt/docflow/deploy/backup/setup-backup.sh 'ssh-ed25519 AAAA… docflow-backup@ПК' [--keep 7]
#
# Строку ключа печатает на компьютере scripts/backup/install-backup-task.ps1.
#
# Что делает:
#   - заводит пользователя docflow-backup без пароля: войти можно только
#     ключом, и этим ключом – только отдать или забрать архив;
#   - ставит приёмник /usr/local/bin/docflow-backup-receive;
#   - папка архивов /var/backups/docflow/source (доступ – только у
#     docflow-backup и root), хранятся --keep последних (по умолчанию 7).
#
# Повторный запуск с другим ключом заменяет ключ: бэкап принимается с одного
# компьютера.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_NAME='docflow-backup'
HOME_DIR='/var/backups/docflow'
RECEIVER='/usr/local/bin/docflow-backup-receive'

fail() { printf '\nОшибка: %s\n' "$*" >&2; exit 1; }

KEY="${1:-}"
shift || true
KEEP=7
while [ $# -gt 0 ]; do
  case "$1" in
    --keep) KEEP="${2:-}"; shift 2 ;;
    *) fail "неизвестный параметр: $1" ;;
  esac
done

[ "$(id -u)" -eq 0 ] || fail "запустите от root: sudo bash $0 '<ключ>'"
[[ "$KEEP" =~ ^[1-9][0-9]*$ ]] || fail "--keep: нужно число от 1"
# Только открытый ключ ed25519 одной строкой: никаких опций и кавычек, чтобы
# в authorized_keys не попало ничего, кроме ключа.
[[ "$KEY" =~ ^ssh-ed25519\ [A-Za-z0-9+/]+=*(\ [A-Za-z0-9@._-]+)?$ ]] ||
  fail "это не открытый ключ ssh-ed25519. Скопируйте строку, которую напечатал install-backup-task.ps1"

if ! id -u "$USER_NAME" >/dev/null 2>&1; then
  useradd --system --home-dir "$HOME_DIR" --shell /bin/sh "$USER_NAME"
fi
# Пароля нет вовсе («*»): войти по паролю нельзя, по ключу – можно. «!»
# (заблокирован) sshd не пустил бы и по ключу.
usermod -p '*' "$USER_NAME"

install -m 755 "$HERE/docflow-backup-receive.sh" "$RECEIVER"
install -d -m 700 -o "$USER_NAME" -g "$USER_NAME" "$HOME_DIR" "$HOME_DIR/source" "$HOME_DIR/.ssh"

umask 077
printf 'restrict,command="%s --keep %s" %s\n' "$RECEIVER" "$KEEP" "$KEY" > "$HOME_DIR/.ssh/authorized_keys"
chown "$USER_NAME:$USER_NAME" "$HOME_DIR/.ssh/authorized_keys"
chmod 600 "$HOME_DIR/.ssh/authorized_keys"

printf '\nГотово: сервер принимает бэкап от этого ключа.\n'
printf 'Архивы: %s/source, хранятся %s последних.\n' "$HOME_DIR" "$KEEP"
printf 'Теперь на компьютере снова запустите install-backup-task.ps1 – он проверит связь и поставит задачу на 00:00.\n'
