<#
.SYNOPSIS
  Настройки DocFlow для Synology: %LOCALAPPDATA%\DocFlow\for-nas\.env.

.DESCRIPTION
    .\scripts\deploy\make-env.ps1

  Один раз, перед первой установкой (docs/deploy-synology.md). Спрашивает
  имя сайта и пароль на сайт; пароли базы, ключ токенов и ключ пропуска –
  случайные.

  Файл – в %LOCALAPPDATA%, а не в папке проекта: проект лежит в OneDrive,
  и пароли ушли бы в облако. Загрузите .env через File Station в
  docker/docflow/deploy/synology/ (рядом с docker-compose.yml) и удалите
  здесь.

  Повторно – только с -Force и только до первого запуска на NAS: пароль
  владельца база запоминает при создании, и новый .env к ней не подойдёт.

.PARAMETER SiteName
  Имя сайта (docflow.synology.me). Не задано – спросит.

.PARAMETER SitePassword
  Пароль на сайт. Не задан – спросит дважды.

.PARAMETER Force
  Заменить уже созданный файл.
#>
param(
  [string]$SiteName,
  [Security.SecureString]$SitePassword,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$outDir = Join-Path $env:LOCALAPPDATA 'DocFlow\for-nas'
$out = Join-Path $outDir '.env'

if ((Test-Path $out) -and -not $Force) {
  throw "Уже есть $out. Новый файл с новыми паролями к уже созданной базе не подойдёт. Заменить – с -Force, и только если база на NAS ещё не создавалась."
}

function New-Hex([int]$bytes) {
  $buffer = New-Object byte[] $bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  -join ($buffer | ForEach-Object { $_.ToString('x2') })
}

function ConvertTo-Plain([Security.SecureString]$secure) {
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

if (-not $SiteName) { $SiteName = Read-Host 'Имя сайта, как в DDNS DSM (например docflow.synology.me)' }
$SiteName = ($SiteName.Trim() -replace '^https?://', '') -replace '/.*$', ''
if ($SiteName -notmatch '^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$') { throw "Имя сайта не похоже на адрес: $SiteName" }

if (-not $SitePassword) {
  Write-Output 'Пароль на сайт браузер спрашивает до входа в DocFlow – один на всех, логин docflow.'
  Write-Output 'Не короче 12 знаков: латиница, цифры, знаки; без пробелов и одинарной кавычки.'
  $SitePassword = Read-Host 'Пароль на сайт' -AsSecureString
  $again = Read-Host 'Ещё раз' -AsSecureString
  if ((ConvertTo-Plain $SitePassword) -cne (ConvertTo-Plain $again)) { throw 'Пароли не совпали' }
}
$password = ConvertTo-Plain $SitePassword
# Латиница и знаки ASCII: браузеры кодируют не-ASCII в пароле basic auth
# по-разному. Без одинарной кавычки: значение в .env – в одинарных кавычках.
if ($password -cnotmatch '^[\x21-\x26\x28-\x7E]{12,}$') {
  throw 'Пароль на сайт: не короче 12 знаков; латиница, цифры и знаки, без пробелов и одинарной кавычки.'
}

$lines = @(
  "# Настройки DocFlow на Synology. Создано scripts/deploy/make-env.ps1 $(Get-Date -Format 'yyyy-MM-dd HH:mm').",
  '# Пароли – только здесь. Загрузить в docker/docflow/deploy/synology/ и удалить с компьютера.',
  'COMPOSE_PROJECT_NAME=docflow',
  "DOCFLOW_SITE_NAME=$SiteName",
  'DOCFLOW_HTTPS_PORT=8443',
  "DOCFLOW_SITE_PASSWORD='$password'",
  "DOCFLOW_GATE_TOKEN=$(New-Hex 32)",
  "DOCFLOW_DB_OWNER_PASSWORD=$(New-Hex 24)",
  "DOCFLOW_DB_APP_PASSWORD=$(New-Hex 24)",
  "DOCFLOW_JWT_SECRET=$(New-Hex 32)"
)
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
# UTF-8 без BOM и переводы строк LF: docker compose читает .env построчно,
# и BOM прилип бы к имени первой переменной.
[IO.File]::WriteAllText($out, (($lines -join "`n") + "`n"), (New-Object Text.UTF8Encoding($false)))

Write-Output ''
Write-Output "Готово: $out"
Write-Output "Открыть папку: explorer `"$outDir`""
Write-Output 'Загрузите .env через File Station в docker/docflow/deploy/synology/ и удалите здесь.'
