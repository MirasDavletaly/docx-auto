<#
.SYNOPSIS
  Запуск DocFlow на этом компьютере одной командой: база, сервер API, сайт.

.DESCRIPTION
    .\scripts\dev\run.ps1

  1. Запускает базу для разработки (scripts\dev\db.ps1, порт 55432, база
     docflow_dev).
  2. Открывает окно «DocFlow – сервер API» (порт 8098: 8080 на этом
     компьютере занят другой программой).
  3. Открывает окно «DocFlow – сайт» (Vite, порт 5173) и браузер.

  Остановить: закрыть оба окна; базу – .\scripts\dev\db.ps1 stop.

  Ключ подписи токенов (AUTH_JWT_SECRET) создаётся случайно при каждом
  запуске и живёт только в окружении окна сервера: в файлы и в командную
  строку он не попадает. После перезапуска все входят заново.

  Это запуск для разработки на одном компьютере: refresh-cookie без
  Secure (сайт открыт по http), база без пароля только с 127.0.0.1.
#>
$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$apiPort = 8098
$webPort = 5173

function Test-Port([int]$port) {
  $null -ne (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

# Открывает окно с командой. Окно получает переменные окружения этого
# процесса, поэтому они ставятся только на время запуска и сразу убираются:
# ключ подписи не виден в командной строке и не остаётся в вашем окне.
function Start-Window([string]$title, [string]$dir, [string]$command, [hashtable]$vars) {
  $before = @{}
  foreach ($name in $vars.Keys) {
    $before[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $vars[$name], 'Process')
  }
  try {
    Start-Process powershell -WorkingDirectory $dir -ArgumentList @(
      '-NoExit', '-Command', "`$Host.UI.RawUI.WindowTitle = '$title'; $command"
    )
  } finally {
    foreach ($name in $vars.Keys) { [Environment]::SetEnvironmentVariable($name, $before[$name], 'Process') }
  }
}

function Wait-Url([string]$url, [int]$seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
      return $true
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  return $false
}

Write-Host '1/3 База...'
& (Join-Path $PSScriptRoot 'db.ps1') start | Select-Object -First 1

if (Test-Port $apiPort) {
  Write-Host "2/3 Сервер API уже запущен (порт $apiPort)."
} else {
  Write-Host '2/3 Сервер API... (сборка – около полуминуты)'
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  Start-Window 'DocFlow – сервер API' (Join-Path $root 'backend') 'go run ./cmd/api' @{
    AUTH_JWT_SECRET    = -join ($bytes | ForEach-Object { $_.ToString('x2') })
    APP_ENV            = 'dev'
    HTTP_ADDR          = ":$apiPort"
    METRICS_ADDR       = '127.0.0.1:9098'
    AUTH_COOKIE_SECURE = 'false'
    DATABASE_URL       = 'postgres://docflow_app@127.0.0.1:55432/docflow_dev?sslmode=disable'
  }
  if (-not (Wait-Url "http://localhost:$apiPort/healthz" 180)) {
    throw "Сервер API не ответил за 3 минуты – посмотрите окно «DocFlow – сервер API»."
  }
}

if (Test-Port $webPort) {
  Write-Host "3/3 Сайт уже запущен (порт $webPort)."
} else {
  Write-Host '3/3 Сайт...'
  Start-Window 'DocFlow – сайт' (Join-Path $root 'web') 'npm run dev' @{
    DOCFLOW_API_URL = "http://127.0.0.1:$apiPort"
  }
  if (-not (Wait-Url "http://localhost:$webPort/" 60)) {
    throw "Сайт не открылся за минуту – посмотрите окно «DocFlow – сайт»."
  }
}

Start-Process "http://localhost:$webPort/"
Write-Host "Готово: http://localhost:$webPort/"
