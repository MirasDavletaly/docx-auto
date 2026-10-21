# DocFlow на Synology (DSM 6.2, пакет Docker)

Инструкция по шагам: от NAS с пакетом Docker до работающего сайта
`https://имя.synology.me` с данными, перенесёнными с компьютера
разработчика. Всё – мышкой: **File Station**, **Task Scheduler** и
**Control Panel** DSM; SSH не нужен. На всё – около часа.

Названия меню, вкладок, полей и кнопок – как в английском интерфейсе DSM
6.2: **жирным**, стрелка – переход дальше по меню.

Как устроено и почему так – `docs/adr/0004-synology.md`.

```
Интернет ─TCP 443─► роутер ─► NAS:8443 ─► docflow-web: Caddy – HTTPS (Let's Encrypt),
                                                       пароль на сайт, сайт
                                                       │ /api →
                                          docflow-api: сервер DocFlow ──► docflow-db: PostgreSQL 18
   при установке и обновлении: docflow-init (пароли, перенос, копия) → docflow-migrate
```

DSM 6.2 из интернета не видна вовсе: роутер пропускает к NAS только
порт сайта, а HTTPS держит Caddy в контейнере.

На NAS в общей папке `docker` будет так (рядом с `tgviz`):

```
docker/
  docflow/                 пакет: сайт, сервер, настройки
    deploy/synology/       docker-compose.yml, .env, install.sh
    import/                копия базы для переноса (один раз)
  docflow-backups/         копии базы
  docflow-install.log      журнал последней установки
  tgviz/
```

## Без проброса портов: Tailscale Funnel

Если роутер не пускает входящие подключения к NAS (проброс 443 недоступен,
IP «серый») – шаги 2–4 не нужны: HTTPS и адрес в интернете даёт Tailscale
Funnel, а NAS сам подключается наружу.

1. Package Center → **Tailscale** → Install → Open → войти учётной записью
   Tailscale. В https://login.tailscale.com/admin/machines у NAS: **⋯ →
   Disable key expiry** (иначе через полгода сайт перестанет открываться).
2. https://login.tailscale.com/admin/dns: **MagicDNS** и **HTTPS
   Certificates** – Enable. Там же – имя tailnet (`tailXXXX.ts.net`).
3. В `.env`: `DOCFLOW_SITE_NAME=имя-nas.tailXXXX.ts.net`, `DOCFLOW_TLS=off`,
   `DOCFLOW_LOCAL_PORT=8088`.
4. DocFlow install → Run. Скрипт включит Funnel; если Tailscale попросит
   разрешить Funnel – в журнале будет ссылка: открыть, разрешить, снова Run.

Сайт: `https://имя-nas.tailXXXX.ts.net`. В первый раз имя и сертификат
появляются до 10 минут.

**Без пароля на сайт** (только вход в DocFlow): `DOCFLOW_SITE_AUTH=off` в
`.env`, затем DocFlow install → Run. Код сайта с реквизитами компаний тогда
скачает любой, кто знает адрес; данные из базы – только после входа.

## 0. Прочитать до начала

- **DSM 6.2 не получает исправлений безопасности с 1 октября 2024 года.**
  Поэтому DSM наружу не открывается: из интернета виден только сайт
  DocFlow. Но сам NAS остаётся на старой системе – стоит выяснить, можно ли
  перевести его на DSM 7.2, или запланировать замену.
- **Документы пока живут в браузере каждого человека.** На сервере общие
  учётные записи, компании и персонал. Документ, созданный одним
  сотрудником, другой не увидит; документы, созданные на этом компьютере
  на `localhost`, на сайт NAS не переедут. Общие документы появятся с
  серверным этапом документов.
- **Два пароля.** Сначала браузер спрашивает **пароль на сайт** (один на
  всех, логин `docflow`) – он закрывает код сайта, где лежат реквизиты
  компаний. Затем – вход в DocFlow своим логином и паролем. Пароль на
  сайт спрашивается в каждом браузере раз в 30 дней: после него браузер
  получает пропуск (cookie).
- **У перенесённых 23 сотрудников один пароль `A123456a`.** Сайт будет в
  интернете. Попросите сотрудников сменить пароль в профиле в первый день
  или задайте новые в админ-панели.
- **Персональные данные – на NAS в офисе**, то есть в Казахстане. Копии
  базы содержат те же данные: храните их только на своих дисках или в
  зашифрованном хранилище.

## 1. Что нужно

| Что | Как проверить |
|---|---|
| Пакет Docker **20.10.3** или новее | **Package Center → Installed → Docker** – версия. Старше – раздел 14, первая строка |
| Учётная запись DSM из группы administrators | – |
| Доступ к настройкам роутера офиса | – |
| «Белый» внешний IP | Шаг 2 |
| 2 ГБ свободной памяти и 3 ГБ на диске | **Resource Monitor** |
| Свободный порт 8443 на NAS | Занят – шаг 6, «Порт» |

## 2. Проверить «белый» IP

Проброс портов работает, только если у роутера свой внешний адрес, а не
общий на весь квартал (CGNAT).

1. В настройках роутера найдите **WAN IP** (внешний адрес).
2. С компьютера в офисе откройте <https://2ip.kz>.

Адреса совпадают – всё в порядке. Не совпадают, или WAN IP начинается с
`10.`, `100.64`–`100.127`, `172.16`–`172.31`, `192.168.` – адрес «серый»:
попросите у провайдера «белый» статический IP (обычно платная услуга) или
скажите разработчику – есть путь через Cloudflare Tunnel без проброса
портов.

## 3. Имя synology.me

**Control Panel → External Access → DDNS → Add**:

| Поле | Значение |
|---|---|
| **Service provider** | Synology |
| **Hostname** | например `docflow` → `docflow.synology.me` |
| **External address (IPv4)** | Auto |
| **External address (IPv6)** | **Disabled** |
| **Get a certificate from Let's Encrypt and set it as default certificate** | **не отмечать** – сертификат получит сам сайт |

IPv6 отключён намеренно: проброс порта на роутере (шаг 4) – для IPv4, а
с записью IPv6 часть посетителей пошла бы по IPv6 мимо него.

**Test Connection** → **OK**. DSM сама сообщает новый адрес, если
провайдер его сменит.

## 4. Роутер: проброс порта

1. Закрепите за NAS постоянный внутренний адрес (в роутере – «DHCP
   reservation» / «резервирование DHCP» по MAC-адресу NAS), например
   `192.168.1.10`.
2. Проброс (Port Forwarding / Virtual Server): **внешний TCP 443 →
   `192.168.1.10`, внутренний порт 8443**.

Больше ничего не пробрасывайте: ни 80, ни 5000/5001 (вход в DSM), ни 22.
Если сейчас что-то из этого проброшено – уберите: DSM 6.2 из интернета
должна быть не видна.

Сертификат сайт получает через этот же порт 443 – проброс нужен **до**
установки (шаг 6).

## 5. На этом компьютере: три файла

В PowerShell из папки проекта:

```powershell
.\scripts\deploy\make-env.ps1
.\scripts\deploy\export-db.ps1
.\scripts\deploy\pack-synology.ps1
```

| Скрипт | Что даёт | Где |
|---|---|---|
| `make-env.ps1` | `.env` – настройки с паролями. Спросит **имя сайта** (из шага 3) и **пароль на сайт** (дважды; не короче 12 знаков, латиница, цифры и знаки). Остальные пароли и ключи – случайные | `%LOCALAPPDATA%\DocFlow\for-nas\` |
| `export-db.ps1` | `docflow-data-ДАТА.dump` – копия базы этого компьютера: учётные записи, компании, персонал | там же |
| `pack-synology.ps1` | `docflow-synology-ДАТА-КОММИТ.tar.gz` – пакет. Проверяет сайт и сервер (около 5 минут); в пакет идёт последний коммит | `dist-deploy\` |

`.env` и копия базы – не в папке проекта: проект лежит в OneDrive, и
пароли с персональными данными ушли бы в облако. Открыть их папку:

```powershell
explorer "$env:LOCALAPPDATA\DocFlow\for-nas"
```

`make-env.ps1` – один раз. Повторно он откажется: пароль базы на NAS
запоминается при первом запуске, и новый `.env` к ней не подойдёт.

## 6. Установка

**Файлы.** **File Station**, папка `docker`:

1. **Upload** → пакет `docflow-synology-….tar.gz`.
2. Правой кнопкой по пакету → **Extract** → **Extract here**. Появится
   папка `docflow`. Сам архив можно удалить (**Delete**).
3. Откройте `docflow/deploy/synology` → **Upload** → `.env`.
4. Откройте `docflow/import` → **Upload** → `docflow-data-….dump`.

**Задача установки.** **Control Panel → Task Scheduler → Create →
Scheduled Task → User-defined script**:

| Вкладка | Поле | Значение |
|---|---|---|
| **General** | **Task** | `DocFlow install` |
| | **User** | **root** |
| | **Enabled** | снять галочку – задача запускается только вручную |
| **Schedule** | | любое (не используется) |
| **Task Settings** | **Send run details by email** | ✔, если почта в DSM настроена (раздел 9) |
| | **User-defined script** | `bash /volume1/docker/docflow/deploy/synology/install.sh` |

**OK** → выберите задачу в списке → **Run**. Первый раз – 5–15 минут:
скачиваются `postgres`, `caddy`, `distroless`, `busybox`, собираются
образы, переносится база, выпускается сертификат.

**Проверка.** В **File Station** откройте `docker/docflow-install.log`:
правой кнопкой → **Download** (или **Open with Text Editor**, если стоит
пакет Text Editor). В конце должно быть:

```
   перенесено: учётных записей – 24.
   ...
   HTTPS работает: сертификат Let's Encrypt выдан, пароль на сайт спрашивается
== Готово: DocFlow запущен – https://docflow.synology.me
```

Если в журнале `ОШИБКА:` – причина написана рядом; раздел 14. В приложении
**Docker → Container**: `docflow-db`, `docflow-api`, `docflow-web` –
**Running**.

**Удалите копию базы** – она больше не нужна, а в ней хеши паролей и
персональные данные:

- на NAS: `docker/docflow/import/docflow-data-….dump` → **Delete**;
- на компьютере: всю папку `%LOCALAPPDATA%\DocFlow\for-nas` (и `.env` –
  на NAS он остаётся, это рабочая копия).

Задачу `DocFlow install` не удаляйте: ею же ставятся обновления
(раздел 11).

**Порт.** Если 8443 на NAS занят, в журнале будет `port is already
allocated`. Поменяйте `DOCFLOW_HTTPS_PORT=8443` в `.env` на свободный
(например 8444), загрузите `.env` заново, поменяйте внутренний порт в
пробросе роутера и снова **Run**.

## 7. Первая проверка

1. **С телефона по мобильному интернету** (Wi-Fi выключен – так
   проверяется проброс) откройте `https://docflow.synology.me`. Браузер
   спросит пароль на сайт: логин `docflow` и пароль из шага 5.
2. Войдите своей учётной записью DocFlow, выберите компанию, откройте
   «Персонал» – там сотрудники, перенесённые с компьютера.
3. **Адрес посетителя виден серверу.** **Docker → Container** → выберите
   `docflow-web` → **Details** → вкладка **Log**: в последних строках
   `"client_ip":"…"` – это должен быть внешний адрес телефона. Если там
   `172.…` – Docker на NAS подменяет адрес; скажите разработчику: тогда
   ограничение частоты входа общее на всех.
4. **DSM снаружи не видна.** С телефона по мобильному интернету:
   `http://ВНЕШНИЙ-IP:5000` и `https://ВНЕШНИЙ-IP:5001` не должны
   открываться.
5. **Из офиса.** С компьютера в офисной сети откройте
   `https://docflow.synology.me`. Не открывается, хотя с телефона
   открывается, – роутер не умеет «NAT loopback»; раздел 14.

## 8. Ночная копия базы

Копия снимается и сама – при каждой установке и обновлении, до миграций.
Ночная копия – ещё одной задачей.

**Control Panel → Task Scheduler → Create → Scheduled Task →
User-defined script**:

| Вкладка | Поле | Значение |
|---|---|---|
| **General** | **Task** | `DocFlow backup` |
| | **User** | **root** |
| **Schedule** | | **Run on the following days**: **Daily**; **First run time**: 02:00 |
| **Task Settings** | **Send run details by email** | ✔ и **Send run details only when the script terminates abnormally** |
| | **User-defined script** | `/usr/local/bin/docker exec docflow-db bash /docflow/db.sh backup` |

**OK** → выберите задачу → **Run**. В `docker/docflow-backups` появится
`docflow-ДАТА-ВРЕМЯ.dump` (время в имени – UTC, на 5 часов меньше
местного). Хранятся 14 последних – и ночные, и перед установками.

Копии на том же NAS не спасут, если откажут его диски. Добавьте папку
`docker/docflow-backups` в **Hyper Backup** с копированием на внешний
диск или в облако, с шифрованием (**Enable client-side encryption**).

## 9. Почта DSM

Чтобы знать о сбоях копии и установки: **Control Panel → Notification →
Email** → **Enable email notifications**, указать почту и **Apply**.

## 10. Работа круглосуточно

Сайт работает на самом NAS: компьютер, с которого его ставили, после
установки можно выключать.

**Уже заложено:**

- `docflow-db`, `docflow-api`, `docflow-web` перезапускаются сами – после
  сбоя и после перезагрузки NAS. Сервер API не падает, если поднялся раньше
  базы: подключится, когда она будет готова. Не останавливайте эти
  контейнеры в приложении Docker (**Stop**) – остановленный останется
  остановленным.
- Сертификат Let's Encrypt Caddy продлевает сам (за месяц до конца); DDNS
  сам сообщает новый адрес, если провайдер его сменит.
- Журналы контейнеров ограничены по размеру, копий базы – 14: место на
  дисках не кончится.

**Настроить в DSM один раз** – **Control Panel → Hardware & Power**:

| Вкладка | Что |
|---|---|
| **General** | ✔ **Restart automatically when power supply issue is fixed** |
| **Power Schedule** | Нет задач выключения и перезагрузки |
| **HDD Hibernation** | **Never**: иначе после простоя первый запрос ждёт 10–30 секунд, пока раскрутятся диски |
| **UPS** (если есть ИБП) | ✔ **Enable UPS support**: при отключении света NAS выключится аккуратно, и база не повредится. Роутеру тоже нужен ИБП – без него сайт снаружи недоступен, даже если NAS работает |

**Проверка извне.** Бесплатный монитор (например, UptimeRobot): проверка
`https://docflow.synology.me` каждые 5 минут, HTTP basic auth – логин
`docflow` и пароль на сайт. Письмо придёт, если сайт перестанет отвечать.

**После отключения света или перезагрузки** ничего делать не нужно:
через 2–3 минуты после загрузки DSM сайт работает.

## 11. Обновление

1. На компьютере – новый пакет: `.\scripts\deploy\pack-synology.ps1`
   (`.env` и копию базы заново **не** делать).
2. **File Station**, `docker` → **Upload** пакет → правой кнопкой →
   **Extract** → **Extract here** → на вопрос о замене – **Overwrite**.
   `.env` и копии базы не затрагиваются: их в пакете нет.
3. **Control Panel → Task Scheduler** → `DocFlow install` → **Run**.

Задача снимет копию базы до миграций, пересоберёт образы и перезапустит
сайт; журнал – снова `docker/docflow-install.log`. После обновления
браузер может показывать старую версию – Ctrl+F5.

## 12. Обслуживание

**Журналы:** **Docker → Container** → нужный → **Details** → **Log**.
Сервер – `docflow-api`, сайт и сертификат – `docflow-web`, база –
`docflow-db`. Журнал установки – `docker/docflow-install.log`.

Разовые действия ниже – задачей: **Control Panel → Task Scheduler →
Create → Scheduled Task → User-defined script**, **User**: root,
**Enabled** снято; затем выбрать задачу → **Run**. После – **Delete**
задачу: в ней пароль или имя копии.

**Забыт пароль администратора DocFlow** (`ЛОГИН` и новый пароль – свои):

```bash
P='Новый-пароль-123'
printf '%s\n' "$P" | /usr/local/bin/docker exec -i \
  -e DATABASE_OWNER_URL="postgres://postgres:$(grep '^DOCFLOW_DB_OWNER_PASSWORD=' /volume1/docker/docflow/deploy/synology/.env | cut -d= -f2)@db:5432/docflow?sslmode=disable" \
  docflow-api /usr/local/bin/admin reset-password -login ЛОГИН
```

Войдите с этим паролем и смените его в профиле. Пароли остальных
сотрудников меняются в админ-панели.

**Восстановить базу из копии** (всё, что сделано после копии, пропадёт;
`ДАТА` – имя файла из `docker/docflow-backups`):

```bash
D=/usr/local/bin/docker
$D stop docflow-web docflow-api
$D exec docflow-db psql -U postgres -d postgres -c 'DROP DATABASE docflow WITH (FORCE)' -c 'CREATE DATABASE docflow'
$D exec docflow-db pg_restore -U postgres -d docflow --no-owner --exit-on-error --single-transaction /backups/docflow-ДАТА.dump
$D start docflow-api docflow-web
```

**Сменить пароль на сайт.** **File Station** →
`docker/docflow/deploy/synology` → `.env` → **Download**, открыть в
Блокноте:

- `DOCFLOW_SITE_PASSWORD='…'` – новый пароль в одинарных кавычках;
- `DOCFLOW_GATE_TOKEN=…` – новый ключ, иначе браузеры, где пароль уже
  вводили, пустит старый пропуск до 30 дней. Ключ – из PowerShell:

  ```powershell
  $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); -join ($b | % { $_.ToString('x2') })
  ```

Сохранить, **Upload** обратно с заменой (**Overwrite**), `DocFlow install`
→ **Run**. Остальные строки `.env` **не менять**: пароль базы она
запомнила при первом запуске.

## 13. Безопасность NAS

- Из интернета – только порт сайта (шаг 4). **Control Panel → QuickConnect**
  – снять **Enable QuickConnect**, если он не нужен; проброс 5000/5001 на
  роутере – убрать.
- Двухэтапная проверка: **Control Panel → User → Advanced** →
  **Enforce 2-step verification** для администраторов.
- **Control Panel → Security → Account** → ✔ **Enable auto block**.
- SSH не нужен: **Control Panel → Terminal & SNMP** – **Enable SSH
  service** снято.
- Выяснить, поддерживает ли модель NAS DSM 7.2 (сайт Synology, **Download
  Center** модели). Если да – обновиться: Docker станет Container Manager,
  DocFlow продолжит работать.

## 14. Если что-то не так

Сначала – журнал установки `docker/docflow-install.log` и журнал нужного
контейнера (**Docker → Container → Details → Log**).

Где ниже «задачей» – разовая задача **User-defined script** от root, как
в разделе 12.

| Что видно | Причина | Что сделать |
|---|---|---|
| `Docker … старше 20.10` | Старый пакет Docker | Сайт Synology → **Download Center** → модель NAS → **Packages** → Docker 20.10.3 для DSM 6.2 (`.spk`) → **Package Center → Manual Install**. Затем снова `DocFlow install` → **Run** |
| `docker-compose … старше 1.28` / `нет docker-compose` | То же | То же |
| `нет …/.env` / `… в .env пуст или неверного вида` | `.env` не загружен, не в той папке или испорчен | Шаг 6, п. 3; сравнить с `deploy/synology/.env.example` |
| `сборка образов не удалась` | У NAS нет выхода в интернет или Docker Hub недоступен | Проверить сеть NAS, снова **Run** |
| `docflow-init …`: «не удаётся войти в базу владельцем» | `.env` заменён после первой установки | Вернуть прежний `.env`. Если база ещё не нужна – удалить её (строка ниже, «Начать базу заново») и установить заново |
| `docflow-init …`: «в import/ несколько копий» | В `docflow/import` больше одного `.dump` | Оставить один, снова **Run** |
| В базе нет перенесённых данных, в журнале «база пустая, копии нет» | Копию не положили до первой установки | Если базу ещё не использовали: «Начать базу заново» (ниже), положить копию в `import`, `DocFlow install` → **Run** |
| Начать базу заново (**стирает все данные DocFlow на NAS**) | – | Задачей: `D=/usr/local/bin/docker; $D rm -f docflow-web docflow-api docflow-db; $D volume rm docflow_pgdata` |
| `port is already allocated` | Порт 8443 занят | Шаг 6, «Порт» |
| `HTTPS пока не отвечает` дольше 10 минут | Нет проброса 443 → 8443, «серый» IP или DDNS указывает не туда | Шаги 2–4; журнал `docflow-web`, строки с `certificate` |
| С телефона открывается, из офиса по имени – нет | Роутер не умеет NAT loopback | Включить в роутере NAT loopback (hairpin NAT); нет такого – на роутере или в DNS офиса имя `docflow.synology.me` → внутренний адрес NAS, и тогда из офиса – `https://docflow.synology.me:8443` |
| Вход в DocFlow: «Слишком много обращений, повторите позже» у всех сразу | Docker подменяет адрес посетителя | Шаг 7, п. 3 |
| После обновления – старая версия | Кеш браузера | Ctrl+F5 |
| Человек на другом компьютере не видит документ | Документы пока в браузерах | Раздел 0 |
