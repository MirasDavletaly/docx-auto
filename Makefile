# DocFlow — точки входа для разработки и проверок.
#
# Правило: всё, что называется «проверено», запускается отсюда (CLAUDE.md, п. 5).
# Цели, которые ещё не реализованы, останавливаются с внятным сообщением —
# молча делать вид, что всё хорошо, им нельзя.

SHELL := /bin/sh

BACKEND := backend
WEB     := web

# Гонки обязательны (CLAUDE.md, п. 5), но детектор гонок собирается не под все
# платформы: на windows/386 его нет. Переопределяется только осознанно:
#   make test GOTESTFLAGS=
GOTESTFLAGS ?= -race

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
COMMIT  ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
DATE    ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ)

LDFLAGS := -X docflow/internal/buildinfo.Version=$(VERSION) \
           -X docflow/internal/buildinfo.Commit=$(COMMIT) \
           -X docflow/internal/buildinfo.Date=$(DATE)

# Версии инструментов закреплены: иначе проверки у разных людей и в CI
# расходятся, и «у меня всё зелёное» перестаёт что-либо значить.
GOLANGCI_VERSION ?= v2.6.1
GOVULNCHECK_VERSION ?= latest

.DEFAULT_GOAL := help

.PHONY: help
help: ## Показать список целей
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## /{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ── Сборка и запуск ──────────────────────────────────────────────────────────

.PHONY: build
build: ## Собрать серверные процессы
	cd $(BACKEND) && go build -ldflags "$(LDFLAGS)" -o bin/ ./cmd/...

.PHONY: run-api
run-api: ## Запустить api локально (нужен .env)
	cd $(BACKEND) && go run -ldflags "$(LDFLAGS)" ./cmd/api

.PHONY: dev
dev: ## Поднять всё окружение разработки
	@echo "не реализовано: инфраструктура появится на шаге 0.4 (infra/docker-compose.yml)" >&2
	@exit 1

# ── Проверки ─────────────────────────────────────────────────────────────────

.PHONY: test
test: ## Тесты сервера
	cd $(BACKEND) && go test $(GOTESTFLAGS) ./...

.PHONY: vet
vet: ## go vet
	cd $(BACKEND) && go vet ./...

.PHONY: lint
lint: ## Линтер сервера
	cd $(BACKEND) && go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@$(GOLANGCI_VERSION) run

.PHONY: vuln
vuln: ## Известные уязвимости в зависимостях
	cd $(BACKEND) && go run golang.org/x/vuln/cmd/govulncheck@$(GOVULNCHECK_VERSION) ./...

.PHONY: tidy-check
tidy-check: ## Проверить, что go.mod и go.sum в порядке
	cd $(BACKEND) && go mod tidy -diff

.PHONY: check
check: lint vet vuln test tidy-check web-check check-catalog gen-check migrate-check ## Всё, что должно быть зелёным перед словом «готово»
	@echo "проверки пройдены"

# ── Сайт ─────────────────────────────────────────────────────────────────────

.PHONY: web-check
web-check: ## Типы, тесты и сборка сайта
	cd $(WEB) && npm run typecheck && npm run test && npx vite build

.PHONY: web-test
web-test: ## Только тесты сайта
	cd $(WEB) && npm run test

# ── Каталог, генерация, миграции ─────────────────────────────────────────────

.PHONY: check-catalog
check-catalog: ## Проверить каталог документов
	@echo "не реализовано: появится на шаге 0.11, полные правила — на этапе 3" >&2
	@exit 1

.PHONY: gen
gen: ## Сгенерировать код из openapi.yaml и SQL
	@echo "не реализовано: появится на шаге 0.7" >&2
	@exit 1

.PHONY: gen-check
gen-check: ## Убедиться, что сгенерированный код совпадает с исходниками
	@echo "не реализовано: появится на шаге 0.7" >&2
	@exit 1

.PHONY: migrate
migrate: ## Применить миграции
	@echo "не реализовано: появится на шаге 0.5" >&2
	@exit 1

.PHONY: migrate-check
migrate-check: ## Прогнать миграции up -> down -> up
	@echo "не реализовано: появится на шаге 0.5" >&2
	@exit 1

.PHONY: seed
seed: ## Загрузить справочные данные
	@echo "не реализовано: появится на этапе 1" >&2
	@exit 1

.PHONY: load-test
load-test: ## Нагрузочный тест k6
	@echo "не реализовано: появится на этапе 9" >&2
	@exit 1

.PHONY: clean
clean: ## Удалить артефакты сборки
	rm -rf $(BACKEND)/bin $(WEB)/dist
