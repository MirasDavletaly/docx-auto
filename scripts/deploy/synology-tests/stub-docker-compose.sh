#!/bin/bash
# Заглушка docker-compose первой версии для test-install.sh.
# STUB_COMPOSE_VERSION – версия; STUB_FAIL_ON – часть вызова для ошибки.
S="${STUB_STATE:?}"
echo "docker-compose $*" >>"$S/calls.log"
if [ "${1:-}" = version ]; then echo "${STUB_COMPOSE_VERSION:-1.28.5}"; exit 0; fi
if [ -n "${STUB_FAIL_ON:-}" ] && [[ "docker-compose $*" == *"$STUB_FAIL_ON"* ]]; then exit 1; fi
exit 0
