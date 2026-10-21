<#
.SYNOPSIS
  Отдельная база PostgreSQL для разработки и тестов сервера DocFlow.

.DESCRIPTION
  Docker на машине разработчика не работает (PROGRESS.md, «Известные
  проблемы»), поэтому интеграционные тесты идут на отдельном кластере
  PostgreSQL, заведённом из установленного на компьютере PostgreSQL:

    - данные – в %LOCALAPPDATA%\DocFlow\pgdata (не в OneDrive);
    - порт 55432, только 127.0.0.1;
    - вход без пароля только с этого компьютера (trust для 127.0.0.1) –
      это база для тестов, рабочих данных в ней нет;
    - установленные на компьютере базы не трогаются.

    .\scripts\dev\db.ps1 start    # завести (первый раз) и запустить
    .\scripts\dev\db.ps1 stop
    .\scripts\dev\db.ps1 status
    .\scripts\dev\db.ps1 url      # строка подключения для тестов

  Тесты сервера берут адрес из DOCFLOW_TEST_DATABASE_URL.
#>
param([ValidateSet('start', 'stop', 'status', 'url')][string]$Command = 'start')

$ErrorActionPreference = 'Stop'
$port = 55432
$data = Join-Path $env:LOCALAPPDATA 'DocFlow\pgdata'
$log = Join-Path $env:LOCALAPPDATA 'DocFlow\pgdata.log'
$url = "postgres://postgres@127.0.0.1:$port/postgres?sslmode=disable"

$bin = Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
  Sort-Object { [int]($_.Name -replace '\D', '') } -Descending |
  ForEach-Object { Join-Path $_.FullName 'bin' } |
  Where-Object { Test-Path (Join-Path $_ 'pg_ctl.exe') } |
  Select-Object -First 1
if ($null -eq $bin) { throw 'PostgreSQL не найден в C:\Program Files\PostgreSQL' }

function Invoke-Native([string]$exe, [string[]]$arguments) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & (Join-Path $bin $exe) @arguments 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $previous }
}

switch ($Command) {
  'url' { Write-Output $url }
  'status' { Invoke-Native 'pg_ctl.exe' @('-D', $data, 'status') }
  'stop' { Invoke-Native 'pg_ctl.exe' @('-D', $data, '-m', 'fast', 'stop') }
  'start' {
    if (-not (Test-Path (Join-Path $data 'PG_VERSION'))) {
      New-Item -ItemType Directory -Force -Path (Split-Path $data) | Out-Null
      Invoke-Native 'initdb.exe' @('-D', $data, '-U', 'postgres', '--auth=trust', '--encoding=UTF8', '--locale=C') | Out-Null
      Add-Content -Path (Join-Path $data 'postgresql.conf') -Value @(
        "port = $port",
        "listen_addresses = '127.0.0.1'",
        'max_connections = 50'
      ) -Encoding ASCII
      Write-Output "Заведена база для разработки: $data"
    }
    # Запуск – отдельным процессом (Start-Process без перенаправлений), а не
    # из этой консоли: иначе запущенный PostgreSQL наследует поток вывода и
    # держит его открытым, и тот, кто читает вывод скрипта (pack-synology.ps1,
    # `db.ps1 start | Out-Null`), ждёт его конца вечно. `cmd /c ... >nul`
    # этого не лечит: перенаправляется вывод pg_ctl, а сам поток cmd
    # по-прежнему наследуется. Ждём только pg_ctl (-w – до готовности базы):
    # `-Wait` в PowerShell 5.1 ждал бы и PostgreSQL, то есть всегда.
    # Уже запущенную не трогаем: pg_ctl start на ней полминуты ждёт вторую
    # копию, которая не поднимется. `pg_ctl status`: 0 – работает.
    Invoke-Native 'pg_ctl.exe' @('-D', $data, 'status') | Out-Null
    if ($LASTEXITCODE -ne 0) {
      $pgctl = Start-Process -FilePath (Join-Path $bin 'pg_ctl.exe') `
        -ArgumentList ('-D "{0}" -l "{1}" -w start' -f $data, $log) `
        -WindowStyle Hidden -PassThru
      $pgctl.WaitForExit()
    }
    Invoke-Native 'pg_ctl.exe' @('-D', $data, 'status') | Select-Object -First 1
    Write-Output "DOCFLOW_TEST_DATABASE_URL=$url"
  }
}
