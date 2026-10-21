#!/bin/bash
# Заглушка docker для test-install.sh: записывает вызов и отвечает как
# Docker на DSM 6.2. STUB_DOCKER_VERSION – версия сервера; STUB_COMPOSE_V2=1 –
# есть «docker compose»; STUB_FAIL_ON – часть вызова, на которой ответить ошибкой.
S="${STUB_STATE:?}"
echo "docker $*" >>"$S/calls.log"
if [ -n "${STUB_FAIL_ON:-}" ] && [[ "docker $*" == *"$STUB_FAIL_ON"* ]]; then exit 1; fi
case "$1" in
  version)
    case "$*" in
      *Server.Version*) echo "${STUB_DOCKER_VERSION:-20.10.3}" ;;
      *) echo "Server: Docker Engine ${STUB_DOCKER_VERSION:-20.10.3}" ;;
    esac
    exit 0 ;;
  compose)
    [ -n "${STUB_COMPOSE_V2:-}" ] || { echo "docker: 'compose' is not a docker command." >&2; exit 1; }
    [ "${2:-}" = version ] && { echo "Docker Compose version v2.20.1"; exit 0; }
    exit 0 ;;
  inspect) echo healthy; exit 0 ;;
  exec) exit 0 ;;
  image) exit 0 ;;
  ps) echo "docflow-web Up"; exit 0 ;;
esac
echo "stub: не знаю docker $*" >&2
exit 99
