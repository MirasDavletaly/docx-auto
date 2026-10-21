# Сайт DocFlow: сборка и выдача через Caddy с HTTPS (docs/deploy.md).
#
# Контекст сборки – корень проекта: docker compose -f deploy/docker-compose.yml.
# Что попадает в контекст, решает .dockerignore в корне.

# ── 1. Сборка ────────────────────────────────────────────────────────────
# bookworm, а не alpine: в package-lock.json записаны сборки rollup и esbuild
# для glibc, и npm ci ставит ровно их.
FROM node:22-bookworm-slim AS build
WORKDIR /app/web

COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY web/ ./
# Проверка типов и сборка. Тесты идут до упаковки (scripts/deploy/pack.ps1):
# на сервере с одним процессором тесты со сроками по часам могут не успеть.
RUN npm run build

# ── 2. Выдача ────────────────────────────────────────────────────────────
# Та же версия – в setup-server.sh (CADDY_IMAGE). 2.11: в 2.8 есть
# известные уязвимости (проверка безопасности 29.09.2026).
FROM caddy:2.11-alpine

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/web/dist /srv
