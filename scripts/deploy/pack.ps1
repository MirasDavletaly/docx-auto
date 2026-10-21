<#
.SYNOPSIS
  Пакет DocFlow для сервера: dist-deploy/docflow-ГГГГ-ММ-ДД-<коммит>.tar.gz.

.DESCRIPTION
  1. Проверяет, что в web/ и deploy/ нет незакоммиченных правок: в пакет
     идёт закоммиченное состояние, и оно должно совпадать с проверенным.
  2. Прогоняет проверку сайта: типы, тесты, сборка (npm run check).
  3. Собирает архив git archive: web/, deploy/, .dockerignore и инструкцию
     docs/deploy.md. Без node_modules, dist и .env.

  Что делать с архивом на сервере – docs/deploy.md.

.PARAMETER SkipCheck
  Не прогонять проверку (только если она только что прошла).
#>
param([switch]$SkipCheck)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

# Успех внешней команды решает код возврата. Тесты и git пишут предупреждения
# в поток ошибок, и Windows PowerShell 5.1 при 'Stop' принял бы их за сбой.
function Invoke-Native([scriptblock]$command) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $command 2>&1 | ForEach-Object { "$_" }
  }
  finally {
    $ErrorActionPreference = $previous
  }
}

$dirty = Invoke-Native { git status --porcelain -- web deploy .dockerignore docs/deploy.md }
if ($LASTEXITCODE -ne 0) { throw 'git status не выполнился' }
if ($dirty) {
  Write-Output $dirty
  throw 'Есть незакоммиченные правки в web/ или deploy/: они не попали бы в пакет. Закоммитьте их и запустите снова.'
}

if (-not $SkipCheck) {
  Push-Location (Join-Path $root 'web')
  try {
    Invoke-Native { npm run check } | Select-String -Pattern 'Test Files|Tests|built in|error|FAIL' |
      ForEach-Object { $_.Line }
    if ($LASTEXITCODE -ne 0) { throw 'Проверка сайта не прошла: пакет не собран.' }
  }
  finally {
    Pop-Location
  }
}

$sha = (& git rev-parse --short HEAD).Trim()
$date = Get-Date -Format 'yyyy-MM-dd'
$name = "docflow-$date-$sha"
$outDir = Join-Path $root 'dist-deploy'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$out = Join-Path $outDir "$name.tar.gz"

Invoke-Native { git archive --format=tar.gz --prefix=docflow/ -o $out HEAD web deploy .dockerignore docs/deploy.md }
if ($LASTEXITCODE -ne 0) { throw 'git archive не выполнился' }

$size = [math]::Round((Get-Item $out).Length / 1KB)
Write-Output ''
Write-Output "Пакет готов: $out ($size КБ, коммит $sha)"
Write-Output 'Дальше – docs/deploy.md, шаг 4: скопировать пакет на сервер.'
