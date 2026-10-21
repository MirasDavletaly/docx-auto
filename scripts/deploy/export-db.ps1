<#
.SYNOPSIS
  Копия базы разработки для переноса на сервер:
  %LOCALAPPDATA%\DocFlow\for-nas\docflow-data-ГГГГ-ММ-ДД.dump.

.DESCRIPTION
    .\scripts\deploy\export-db.ps1

  Снимает docflow_dev (scripts\dev\db.ps1, порт 55432) в формате pg_dump
  custom. На NAS файл кладётся в папку docker/docflow/import: служебный
  контейнер init загрузит его в пустую базу при первой установке
  (docs/deploy-synology.md, deploy/synology/db.sh).

  Без данных:
    - refresh_tokens   – сессии этого компьютера; на сервере другой ключ
                         подписи, они там всё равно недействительны;
    - idempotency_keys – сохранённые ответы на повторы запросов.
  Учётные записи, компании, персонал и журнал действий переносятся.

  В файле хеши паролей и персональные данные работников. Поэтому он – в
  %LOCALAPPDATA%, а не в папке проекта: проект лежит в OneDrive, и копия
  ушла бы в облако. После переноса его надо удалить – и здесь, и на NAS.

.PARAMETER Database
  Какую базу снимать (по умолчанию docflow_dev).
#>
param([string]$Database = 'docflow_dev')

$ErrorActionPreference = 'Stop'
$port = 55432

$bin = Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
  Sort-Object { [int]($_.Name -replace '\D', '') } -Descending |
  ForEach-Object { Join-Path $_.FullName 'bin' } |
  Where-Object { Test-Path (Join-Path $_ 'pg_dump.exe') } |
  Select-Object -First 1
if ($null -eq $bin) { throw 'PostgreSQL не найден в C:\Program Files\PostgreSQL' }

# Успех внешней команды решает код возврата: pg_dump пишет замечания в
# поток ошибок, и PowerShell 5.1 при 'Stop' принял бы их за сбой.
function Invoke-Native([string]$exe, [string[]]$arguments) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & (Join-Path $bin $exe) @arguments 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $previous }
}

$outDir = Join-Path $env:LOCALAPPDATA 'DocFlow\for-nas'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$out = Join-Path $outDir ("docflow-data-{0}.dump" -f (Get-Date -Format 'yyyy-MM-dd'))
$partial = "$out.partial"

Invoke-Native 'pg_dump.exe' @(
  '-h', '127.0.0.1', '-p', "$port", '-U', 'postgres', '-d', $Database,
  '--format=custom',
  '--exclude-table-data=refresh_tokens',
  '--exclude-table-data=idempotency_keys',
  '-f', $partial
)
if ($LASTEXITCODE -ne 0) {
  Remove-Item -Force -ErrorAction SilentlyContinue $partial
  throw "pg_dump не выполнился. База запущена? .\scripts\dev\db.ps1 start"
}
# Готовый файл появляется только целиком: оборванная копия не выдаёт себя
# за полную.
Move-Item -Force $partial $out

# Запрос – без кириллицы: аргументы командной строки Windows идут в
# кодировке системы, а не в UTF-8, и база отвергла бы такой текст.
$counts = Invoke-Native 'psql.exe' @(
  '-h', '127.0.0.1', '-p', "$port", '-U', 'postgres', '-d', $Database, '-tA', '-F', ' ',
  '-c', 'SELECT (SELECT count(*) FROM users WHERE deleted_at IS NULL), (SELECT count(*) FROM companies), (SELECT max(version_id) FROM goose_db_version WHERE is_applied)'
)
if ($LASTEXITCODE -ne 0) { throw "Копия снята, но сводка не прочиталась: $counts" }
$users, $companies, $migration = "$counts".Trim() -split ' '

$size = [math]::Round((Get-Item $out).Length / 1KB)
Write-Output "Копия базы: $out ($size КБ)"
Write-Output "  учётных записей: $users, компаний: $companies, последняя миграция: $migration"
Write-Output ''
Write-Output "Открыть папку: explorer `"$outDir`""
Write-Output 'В файле хеши паролей и персональные данные. Не отправляйте его почтой и'
Write-Output 'мессенджером; после установки на NAS удалите и здесь, и там.'
