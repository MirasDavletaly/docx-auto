#!/usr/bin/env bash
# Приёмник ночного бэкапа исходного кода DocFlow на сервере (docs/backup.md).
#
# Запускается только ключом бэкапа: в authorized_keys пользователя
# docflow-backup ключ записан с `restrict,command="…"`. Этим ключом нельзя
# ни войти в оболочку, ни запустить другую команду, ни пробросить порт –
# только этот скрипт. Что сделать, компьютер просит в SSH_ORIGINAL_COMMAND:
#
#   put        архив .tar.gz со stdin → docflow-src-ГГГГ-ММ-ДД_ЧЧММСС.tar.gz;
#              архивы сверх --keep, самые старые, удаляются
#   list       архивы от новых к старым: «имя размер»
#   get ИМЯ    архив в stdout – для восстановления
#
# Ставится как /usr/local/bin/docflow-backup-receive (setup-backup.sh).

set -euo pipefail

DIR="${DOCFLOW_BACKUP_DIR:-/var/backups/docflow/source}"
KEEP=7
MAX_MB=300
NAME_RE='^docflow-src-[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6}\.tar\.gz$'

fail() { printf '%s\n' "$*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --keep) KEEP="${2:-}"; shift 2 ;;
    --max-mb) MAX_MB="${2:-}"; shift 2 ;;
    *) fail "неизвестный параметр: $1" ;;
  esac
done
[[ "$KEEP" =~ ^[1-9][0-9]*$ ]] || fail "--keep: нужно число от 1"
[[ "$MAX_MB" =~ ^[1-9][0-9]*$ ]] || fail "--max-mb: нужно число от 1"
MAX_BYTES=$((MAX_MB * 1024 * 1024))

umask 077
mkdir -p "$DIR"

# Архивы от новых к старым: время – в имени.
archives() {
  local path name
  for path in "$DIR"/docflow-src-*.tar.gz; do
    [ -f "$path" ] || continue
    name="${path##*/}"
    if [[ "$name" =~ $NAME_RE ]]; then printf '%s\n' "$name"; fi
  done | sort -r
}

read -r -a request <<< "${SSH_ORIGINAL_COMMAND:-}"

case "${request[0]:-}" in
  put)
    name="docflow-src-$(date +%Y-%m-%d_%H%M%S).tar.gz"
    while [ -e "$DIR/$name" ]; do
      sleep 1
      name="docflow-src-$(date +%Y-%m-%d_%H%M%S).tar.gz"
    done
    tmp="$(mktemp "$DIR/.incoming.XXXXXX")"
    trap 'rm -f "$tmp"' EXIT
    # Больше предела не читаем: переполнить диск этим ключом нельзя.
    head -c "$((MAX_BYTES + 1))" > "$tmp"
    size="$(wc -c < "$tmp" | tr -d ' ')"
    [ "$size" -le "$MAX_BYTES" ] || fail "архив больше ${MAX_MB} МБ – не принят"
    [ "$size" -gt 0 ] || fail "пустой архив – не принят"
    gzip -t "$tmp" 2>/dev/null || fail "это не архив .tar.gz – не принят"
    mv "$tmp" "$DIR/$name"
    trap - EXIT
    archives | tail -n +"$((KEEP + 1))" | while read -r old; do rm -f -- "$DIR/$old"; done
    printf 'ok %s %s\n' "$name" "$size"
    ;;
  list)
    archives | while read -r name; do
      printf '%s %s\n' "$name" "$(wc -c < "$DIR/$name" | tr -d ' ')"
    done
    ;;
  get)
    name="${request[1]:-}"
    # Только имя архива из этой папки: «../» и чужие файлы не пройдут.
    [[ "$name" =~ $NAME_RE ]] && [ -f "$DIR/$name" ] || fail "нет такого архива: $name"
    cat -- "$DIR/$name"
    ;;
  *)
    fail "этим ключом можно только: put, list, get ИМЯ"
    ;;
esac
