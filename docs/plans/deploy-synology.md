# Публикация DocFlow на Synology – план

Просьба человека 2026-10-14: «хочу выложить на сервер Synology, настрой его».
Ответы человека: Container Manager на NAS есть; сайт открывают из интернета
по имени `*.synology.me`; установку запускает человек по инструкции; данные
переносятся из `docflow_dev` этого компьютера. Вариант A (сборка здесь, NAS
только запускает) одобрен.

**Цель:** сайт, сервер API и база DocFlow работают в контейнерах на Synology
по адресу `https://имя.synology.me`, с данными, перенесёнными из базы
разработки, и ночной копией базы.

**Устройство:**

```
Интернет ─443─► роутер ─► DSM nginx (Let's Encrypt на имя.synology.me)
                             │ обратный прокси DSM → 127.0.0.1:8480
                             ▼
                    [web]  Caddy: сайт, пароль на сайт (кроме /api), заголовки
                             │ /api/* → api:8080
                    [api]  сервер на Go ──► [db] PostgreSQL 18 (том Docker)
                    [migrate] миграции при каждом запуске установки
```

Сайт и сервер собираются на этом компьютере (`scripts/deploy/pack-synology.ps1`)
из последнего коммита, после тестов. На NAS образы только копируют готовые
файлы: Caddy + статика, distroless + бинарники (`amd64` и `arm64`, нужный
выбирает установка по `uname -m`), стандартный `postgres:18-alpine`.

## Глобальные ограничения

- `CLAUDE.md`, п. 3.1: приложение подключается ролью `docflow_app` без
  `BYPASSRLS`; миграции – ролью-владельцем (`postgres`).
- `CLAUDE.md`, п. 3.8: refresh-cookie `Secure` – сайт только по HTTPS
  (`AUTH_COOKIE_SECURE=true`, `APP_ENV=prod`).
- `CLAUDE.md`, п. 3.10: секреты только в `deploy/synology/.env` на NAS
  (права 600), создаются установкой; в репозитории и пакете их нет.
- `CLAUDE.md`, п. 3.11: ограничение частоты входа – по настоящему адресу
  клиента; подделать его из сети нельзя.
- Порт Caddy открыт только на `127.0.0.1` NAS; база и API наружу не
  публикуются.
- Версии образов: `caddy:2.11-alpine` (как в `deploy/`), `postgres:18-alpine`
  (база разработки – PostgreSQL 18; копия из 18 в 16 не ложится),
  `gcr.io/distroless/static-debian12:nonroot`.
- Изменения в `web/`, не закоммиченные человеком, не трогаются; пакет
  собирается из `HEAD`.

## Решения по умолчанию (`docs/questions.md`)

1. **Пароль на весь сайт остаётся**, кроме `/api/*`: у API свой вход по
   токену в том же заголовке `Authorization`. Причины: в коде сайта –
   реквизиты компаний; у 23 учётных записей один известный пароль.
2. **Без PgBouncer, Redis и MinIO**: один процесс API (пул 10 соединений),
   очередей и файлов на сервере ещё нет. Появятся с этапами, где нужны.
   PgBouncer к тому же не пропускает `statement_timeout` в параметрах
   подключения – понадобится правка `db.Open`.
3. **Адрес клиента** – из `X-Real-IP`, который ставит nginx DSM
   (`trusted_proxies static private_ranges`, `client_ip_headers X-Real-IP`);
   серверу API Caddy передаёт `X-Forwarded-For: {client_ip}` одним
   адресом. `X-Forwarded-For` от DSM не используется: nginx дописывает
   адрес к присланному клиентом, левую часть подделает кто угодно.
4. **Журнал Caddy – в журнал контейнера** (stdout, ротация Docker), не в
   файл: fail2ban на DSM нет. Защита от подбора: блокировка входа после 5
   неудач и ограничение частоты в API; пароль на сайт – bcrypt.
5. **Ночная копия базы** – `pg_dump` из «Планировщика задач» DSM в
   `../docflow-backups` рядом с папкой установки, 14 последних. Перед
   каждым обновлением установка делает копию сама.
6. **Перенос данных** – копия `docflow_dev` без `refresh_tokens` и
   `idempotency_keys`, загружается только в пустую базу.

## Файлы

| Файл | Что делает |
|---|---|
| `deploy/synology/Caddyfile` | Сайт на `:8480` без TLS, пароль на сайт кроме `/api`, `/api/*` → `api:8080`, заголовки безопасности как в `deploy/Caddyfile` |
| `deploy/synology/Dockerfile.web` | `caddy:2.11-alpine` + `Caddyfile` + `site/` |
| `deploy/synology/Dockerfile.server` | distroless + `bin/linux-$ARCH/{api,migrate,admin}` |
| `deploy/synology/docker-compose.yml` | `db`, `migrate`, `api`, `web`; ограничения контейнеров |
| `deploy/synology/.env.example` | Переменные, которые заполняет установка |
| `deploy/synology/package.dockerignore` | В пакете становится `.dockerignore`: в контекст сборки – только `site`, `bin`, `Caddyfile` |
| `deploy/synology/setup.sh` | Установка и обновление одной командой; `--import ФАЙЛ` – перенос данных |
| `deploy/synology/backup-db.sh` | Копия базы, 14 последних; для «Планировщика задач» |
| `scripts/deploy/pack-synology.ps1` | `HEAD` → временная папка → тесты сайта и сервера, сборка → `dist-deploy/docflow-synology-ДАТА-КОММИТ.tar.gz` |
| `scripts/deploy/export-db.ps1` | Копия `docflow_dev` → `dist-deploy/docflow-data-ДАТА.dump` |
| `web/src/security/csp.test.ts` | Та же политика – и в `deploy/synology/Caddyfile` |
| `docs/deploy-synology.md` | Инструкция для человека: DSM, роутер, установка, обновление, копии, вход по SSH |
| `docs/adr/0004-synology.md` | Почему DSM-прокси, сборка на компьютере, без PgBouncer |
| `docs/deploy.md` | Пометка: вариант для VPS – только сайт, без сервера API |

## Задачи

### 1. Caddyfile и проверка политики

- [ ] Тест: `csp.test.ts` проверяет и `deploy/synology/Caddyfile` → падает
  (файла нет).
- [ ] `deploy/synology/Caddyfile`:
  ```
  {
  	admin off
  	auto_https off
  	servers {
  		trusted_proxies static private_ranges
  		client_ip_headers X-Real-IP
  		timeouts { read_header 10s; read_body 10s; write 60s; idle 2m }
  	}
  }
  :{$DOCFLOW_LISTEN_PORT:8480} {
  	@site not path /api/*
  	basic_auth @site { {$DOCFLOW_AUTH_USER} {$DOCFLOW_AUTH_HASH} }
  	handle /api/* {
  		reverse_proxy {$DOCFLOW_API_UPSTREAM:api:8080} {
  			header_up X-Forwarded-For {client_ip}
  		}
  	}
  	... заголовки, /assets/*, try_files – как в deploy/Caddyfile
  }
  ```
- [ ] `npx vitest run src/security/csp.test.ts` – зелёный.
- [ ] Caddy 2.11 для Windows во временной папке: `caddy validate` и
  запуск с `DOCFLOW_SITE_ROOT=web/dist`, `DOCFLOW_API_UPSTREAM=127.0.0.1:8098`.
  Проверки `curl`:
  - `/` без пароля → 401, с паролем → 200 и заголовки безопасности;
  - `/api/me` без пароля сайта → 401 от API (JSON), не от Caddy;
  - `POST /api/auth/login` с `X-Real-IP: 203.0.113.7` и подделанным
    `X-Forwarded-For: 1.1.1.1` – API видит `203.0.113.7` (21 вход за минуту
    с одного `X-Real-IP` → 429, с другого `X-Real-IP` → не 429).
- [ ] Коммит `feat(deploy): Caddy для Synology – сайт и /api за прокси DSM`.

### 2. Образы и docker-compose

- [ ] `Dockerfile.web`, `Dockerfile.server`, `docker-compose.yml`,
  `.env.example`, `package.dockerignore`.
  - `db`: `postgres:18-alpine`, том на `/var/lib/postgresql` (с 18-й версии
    данные там), `POSTGRES_PASSWORD` из `.env`, `pg_isready` как проверка,
    без опубликованных портов.
  - `migrate`: образ сервера, `command: ["/migrate"]`,
    `DATABASE_OWNER_URL`, после здоровой `db`.
  - `api`: `/api`, `APP_ENV=prod`, `HTTP_TRUST_PROXY=true`,
    `AUTH_COOKIE_SECURE=true`, `DATABASE_URL` ролью `docflow_app`;
    `read_only`, `cap_drop: ALL`, `no-new-privileges`.
  - `admin`: профиль `tools`, `/admin` – сброс пароля с NAS.
  - `web`: `127.0.0.1:8480:8480`, `read_only`, `cap_drop: ALL` +
    `NET_BIND_SERVICE` (у `caddy` файловые права – без них не запустится).
- [ ] Проверка без Docker: `docker compose config` здесь не работает (нет
  демона – клиент есть, `config` демона не требует) → `docker compose -f
  ... config` с образцом `.env` – файл разбирается, переменные подставлены.
- [ ] Коммит `feat(deploy): контейнеры DocFlow для Synology`.

### 3. Сборка пакета

- [ ] `scripts/deploy/pack-synology.ps1`:
  1. `git archive HEAD` → временная папка (незакоммиченное не попадает).
  2. Сайт: `npm ci`, `npm run check` (типы, тесты, сборка).
  3. Сервер: `go vet ./...`, `go test ./...` (интеграционные – на базе
     разработки, если `DOCFLOW_TEST_DATABASE_URL` задан; иначе отказ с
     подсказкой `scripts\dev\db.ps1 start`), затем для `amd64` и `arm64`:
     `CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags "-s -w -X
     docflow/internal/buildinfo.Version=… Commit=… Date=…"` для `api`,
     `migrate`, `admin`.
  4. Пакет: `docflow/{site,bin,deploy/synology,docs/deploy-synology.md,.dockerignore}`
     → `dist-deploy/docflow-synology-ДАТА-КОММИТ.tar.gz`.
- [ ] Запуск: пакет собран; в архиве нет `.env`, исходников, `node_modules`;
  бинарники – ELF нужной архитектуры (первые байты и поле `e_machine`).
- [ ] Коммит `feat(deploy): пакет для Synology – готовые сайт и сервер`.

### 4. Перенос данных

- [ ] `scripts/deploy/export-db.ps1`: `pg_dump -Fc` из `docflow_dev`
  (порт 55432) без данных `refresh_tokens`, `idempotency_keys` →
  `dist-deploy/docflow-data-ДАТА.dump`; предупреждение: в файле хеши
  паролей и персональные данные – удалить после переноса.
- [ ] Проверка той же процедурой, что в `setup.sh`: новая база
  `docflow_restore_check` на кластере разработки → `pg_restore --no-owner
  --exit-on-error --single-transaction` → `migrate` (ничего не применяет)
  → сервер API на ней → вход Кабешовой и Мирас через Caddy → 200; число
  строк `users`, `companies`, `user_companies`, `audit_log` совпадает с
  `docflow_dev`. Базу проверки удалить.
- [ ] Коммит `feat(deploy): копия базы разработки для переноса на сервер`.

### 5. Установка и копии на NAS

- [ ] `deploy/synology/setup.sh` (bash, `set -euo pipefail`, root):
  1. Docker и `docker compose`/`docker-compose`; архитектура → `DOCFLOW_ARCH`.
  2. Нет `.env` – спросить имя сайта (`*.synology.me`) и пароль на сайт
     (дважды, не короче 12), хеш – `caddy hash-password` в контейнере,
     пароли базы и ключ токенов – `openssl rand -hex`; `.env` с правами 600.
     Есть – обновление: сначала `backup-db.sh`.
  3. Сборка образов, `up -d db`, ожидание готовности.
  4. Роль `docflow_app`: создать или сменить пароль на тот, что в `.env`.
  5. `--import ФАЙЛ`: только если в базе нет таблицы `users` →
     `pg_restore` из файла.
  6. `run --rm migrate`, `up -d api web`.
  7. Проверки: `web` → `wget http://api:8080/readyz` = 200;
     `curl http://127.0.0.1:8480/` = 401 (пароль на сайт).
  8. Итог: что настроить в DSM дальше (ссылка на инструкцию).
- [ ] `deploy/synology/backup-db.sh`: `PATH` с `/usr/local/bin`,
  `pg_dump -Fc` во временный файл → переименование, права 600, 14
  последних, ненулевой код при сбое (DSM пришлёт письмо).
- [ ] Проверка без NAS: `bash -n`; прогон `setup.sh` и `backup-db.sh` в Git
  Bash с заглушкой `docker` (пишет вызовы в файл, отвечает как настоящий):
  первая установка с `--import`, повтор (обновление: копия до миграций),
  `--import` в непустую базу – отказ, сбой `pg_dump` – ненулевой код и
  нет обрезанного файла.
- [ ] Коммит `feat(deploy): установка на Synology одной командой и ночная копия базы`.

### 6. Инструкция и документы

- [ ] `docs/deploy-synology.md`: что публикуется (документы – в браузерах),
  проверка «белого» IP, DDNS и сертификат, проброс портов, Container
  Manager и SSH, пакет и копия базы, установка, обратный прокси DSM и
  сертификат, первая проверка, «Планировщик задач», Hyper Backup,
  обновление, сброс пароля, восстановление из копии, неполадки.
- [ ] `docs/adr/0004-synology.md`, пометка в `docs/deploy.md`,
  `docs/questions.md` (решения по умолчанию), `PROGRESS.md`.
- [ ] Коммит `docs: публикация на Synology – инструкция, ADR, PROGRESS`.

## Что не проверяется на этом компьютере

Docker здесь не работает (нет WSL), поэтому **не проверяются**: сборка
образов, запуск контейнеров, ограничения контейнеров на ядре DSM,
`pg_restore` внутри контейнера `postgres:18-alpine`, обратный прокси DSM
и выпуск сертификата. Всё это проверяется при установке на NAS по разделу
инструкции «Первая проверка».

## Риски

- **Документы – в браузерах.** На сервере общие только учётные записи,
  компании и персонал.
- **Один пароль `A123456a` у 23 учётных записей** при выходе в интернет.
- **«Серый» IP** – проброс портов не сработает; нужен «белый» IP или
  Cloudflare Tunnel.
- **Ограничение тела запроса nginx DSM** – если меньше 1 МБ, большие
  запросы (аватар, импорт) получат 413 от DSM.
- **Вариант для VPS (`deploy/`) устарел**: он публикует только сайт, вход
  без сервера API не работает.

## Изменение 2026-10-14: установка через Container Manager, без SSH

Человек: «я загрузил тг бота и работает через docker, можно так же
сделать» → выбрал «как бота: Container Manager, без SSH».

- `setup.sh`, `lib.sh`, `backup-db.sh` и их тесты-заглушки убираются.
- `deploy/synology/db.sh` – работа с базой из контейнера `postgres:18-alpine`:
  `init` (служебный контейнер `init` при каждом запуске проекта, до
  `migrate`): пароль роли `docflow_app` по `.env`; база пустая и в
  `import/` одна копия – загрузить; база не пустая – копия в
  `docflow-backups` перед миграциями. `backup` – ночная копия:
  «Планировщик задач» DSM → `docker exec docflow-db bash /docflow/db.sh backup`.
- `.env` готовит `scripts/deploy/make-env.ps1` на этом компьютере (имя
  сайта, пароль на сайт, случайные пароли и ключи); человек загружает его
  в `docker/docflow/deploy/synology/` и удаляет здесь.
- Пароль на сайт лежит в `.env` открытым (он и так один на всех);
  хеш считает `web-start.sh` при запуске Caddy.
- Архитектура NAS – при сборке образа (`uname -m` в промежуточном образе
  busybox); там же бинарникам ставится признак «исполняемый».
- Имена контейнеров постоянные (`docflow-db`, `docflow-api`, …), сеть –
  `docflow`: команды из инструкции не зависят от имени проекта.
- Сброс пароля администратора – одной командой `docker exec … admin` в
  «Планировщике задач».
- Проверка: `scripts/deploy/synology-tests/test-db.sh` – `db.sh` на
  настоящем PostgreSQL 18 (временный кластер с паролями scram), миграции и
  вход через сервер API ролью `docflow_app` по паролю; Caddy через
  `web-start.sh` и сценарий в Chrome; `docker compose config` с `.env` из
  `make-env.ps1`; пакет.

## Изменение 2026-10-14: DSM 6.2 и пакет Docker

Человек: «у меня docker а не container manager»; DSM 6.2, обновлять DSM –
нет. DSM 6.2 без обновлений безопасности с 01.10.2024; «Проектов» в пакете
Docker нет; его docker-compose – первой версии.

- **HTTPS держит Caddy**, а не DSM: сертификат Let's Encrypt на имя
  synology.me (проверка TLS-ALPN, HTTP-проверка выключена), роутер:
  внешний 443 → NAS 8443 → Caddy. Обратный прокси и сертификат DSM не
  нужны; DSM 6.2 из интернета не видна. Адрес клиента – само соединение,
  `X-Real-IP` больше не принимается. HTTP/3 выключен (UDP не пробрасывается).
- **`docker-compose.yml` – для docker-compose 1.28+**: без `name:` (имя
  проекта – `COMPOSE_PROJECT_NAME` в `.env`), без
  `service_completed_successfully`; `init` и `migrate` – в профиле `setup`,
  чтобы простой `up` их не запускал.
- **`deploy/synology/install.sh`** – установка и обновление разовой
  задачей «Планировщика задач» от root: проверка версий (Docker 20.10+,
  docker-compose 1.28+) и `.env`, сборка, база, `init`, `migrate`,
  сервер и сайт, проверка; журнал – `docker/docflow-install.log`
  (виден в File Station).
- Проверка: `docker-compose` 1.28.5 (сборка для Windows) – `config`;
  Caddy с HTTPS на `localhost` (внутренний сертификат вместо Let's
  Encrypt – переменная только для проверки); сценарий в Chrome по HTTPS;
  `install.sh` с заглушками `docker`/`docker-compose`.
