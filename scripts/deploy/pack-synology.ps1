<#
.SYNOPSIS
  Пакет DocFlow для Synology:
  dist-deploy\docflow-synology-ГГГГ-ММ-ДД-<коммит>.tar.gz.

.DESCRIPTION
    .\scripts\deploy\pack-synology.ps1

  На NAS ничего не компилируется (docs/adr/0004-synology.md): сайт и
  сервер собираются здесь, после проверок, и в пакет идут готовыми.

  1. Последний коммит (HEAD) выгружается во временную папку вне OneDrive.
     Незакоммиченные правки в пакет не попадают – собирается ровно то,
     что лежит в истории.
  2. Сайт: npm ci и npm run check (типы, тесты, сборка).
  3. Сервер: go vet, golangci-lint (если установлен), go test на базе
     разработки (scripts\dev\db.ps1 – запускается, если не запущена),
     затем api, migrate, admin для Linux amd64 и arm64.
  4. Архив: site/, bin/, deploy/synology/, import/ (пустая, с пояснением),
     docs/deploy-synology.md, .dockerignore. Без исходников, node_modules,
     .env и копий базы – их готовят make-env.ps1 и export-db.ps1 отдельно.

  Что делать с пакетом на NAS – docs/deploy-synology.md.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

# Успех внешней команды решает код возврата: npm, go и git пишут
# предупреждения в поток ошибок, и PowerShell 5.1 при 'Stop' принял бы их
# за сбой.
function Invoke-Native([scriptblock]$command) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & $command 2>&1 | ForEach-Object { "$_" } } finally { $ErrorActionPreference = $previous }
}

function Step([string]$text) { Write-Output ''; Write-Output "── $text" }

$sha = (& git rev-parse --short HEAD).Trim()
$date = Get-Date -Format 'yyyy-MM-dd'
$name = "docflow-synology-$date-$sha"
$tar = Join-Path $env:SystemRoot 'System32\tar.exe'

$dirty = Invoke-Native { git status --porcelain }
if ($dirty) {
  Write-Output "Незакоммиченные правки в пакет не попадут (собирается коммит $sha):"
  $dirty | ForEach-Object { Write-Output "  $_" }
}

# Временная папка – вне OneDrive: он синхронизирует node_modules и мешает
# сборке (PROGRESS.md, «Известные проблемы»).
$work = Join-Path $env:TEMP "docflow-pack-$sha"
if (Test-Path $work) { Remove-Item -Recurse -Force $work }
$src = Join-Path $work 'src'
$stage = Join-Path $work 'stage\docflow'
New-Item -ItemType Directory -Force -Path $src, $stage | Out-Null

try {
  Step "Коммит $sha → $src"
  # deploy целиком: тест сайта сверяет политику содержимого и с deploy/Caddyfile.
  $paths = @('web', 'backend', 'deploy', 'docs/deploy-synology.md')
  foreach ($p in $paths) {
    Invoke-Native { git cat-file -e "HEAD:$p" } | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "В коммите $sha нет $p" }
  }
  $archive = Join-Path $work 'src.tar'
  Invoke-Native { git archive --format=tar -o $archive HEAD @paths }
  if ($LASTEXITCODE -ne 0) { throw 'git archive не выполнился' }
  Invoke-Native { & $tar -xf $archive -C $src }
  if ($LASTEXITCODE -ne 0) { throw 'Распаковка выгрузки не удалась' }

  Step 'Сайт: npm ci, npm run check'
  Push-Location (Join-Path $src 'web')
  try {
    Invoke-Native { npm ci --no-audit --no-fund } | Select-Object -Last 2
    if ($LASTEXITCODE -ne 0) { throw 'npm ci не выполнился' }
    Invoke-Native { npm run check } | Select-String -Pattern 'Test Files|Tests |built in|error|FAIL' | ForEach-Object { $_.Line }
    if ($LASTEXITCODE -ne 0) { throw 'Проверка сайта не прошла: пакет не собран.' }
  } finally { Pop-Location }

  Step 'Сервер: go vet, golangci-lint, go test'
  if (-not $env:DOCFLOW_TEST_DATABASE_URL) {
    & (Join-Path $root 'scripts\dev\db.ps1') start | Out-Null
    $env:DOCFLOW_TEST_DATABASE_URL = (& (Join-Path $root 'scripts\dev\db.ps1') url)
  }
  Push-Location (Join-Path $src 'backend')
  try {
    Invoke-Native { go vet ./... }
    if ($LASTEXITCODE -ne 0) { throw 'go vet нашёл ошибки' }
    if (Get-Command golangci-lint -ErrorAction SilentlyContinue) {
      Invoke-Native { golangci-lint run ./... } | Select-Object -Last 5
      if ($LASTEXITCODE -ne 0) { throw 'golangci-lint нашёл ошибки' }
    } else {
      Write-Output 'golangci-lint не установлен – пропущен.'
    }
    Invoke-Native { go test ./... } | Select-String -Pattern '^(ok|FAIL|---)' | ForEach-Object { $_.Line }
    if ($LASTEXITCODE -ne 0) { throw 'Тесты сервера не прошли: пакет не собран.' }

    Step 'Сервер: сборка для Linux amd64 и arm64'
    $ldflags = "-s -w -X docflow/internal/buildinfo.Version=$sha -X docflow/internal/buildinfo.Commit=$sha -X docflow/internal/buildinfo.Date=$date"
    $saved = @{ GOOS = $env:GOOS; GOARCH = $env:GOARCH; CGO_ENABLED = $env:CGO_ENABLED }
    try {
      $env:GOOS = 'linux'
      $env:CGO_ENABLED = '0'
      foreach ($arch in 'amd64', 'arm64') {
        $env:GOARCH = $arch
        foreach ($cmd in 'api', 'migrate', 'admin') {
          $binary = Join-Path $stage "bin\linux-$arch\$cmd"
          Invoke-Native { go build -trimpath -ldflags $ldflags -o $binary "./cmd/$cmd" }
          if ($LASTEXITCODE -ne 0) { throw "Сборка $cmd для $arch не удалась" }
        }
        Write-Output "  linux-${arch}: api, migrate, admin"
      }
    } finally {
      foreach ($k in $saved.Keys) {
        if ($null -eq $saved[$k]) { Remove-Item "env:$k" -ErrorAction SilentlyContinue } else { Set-Item "env:$k" $saved[$k] }
      }
    }
  } finally { Pop-Location }

  # Бинарник – ELF нужной архитектуры: поле e_machine (байты 18–19).
  $machines = @{ amd64 = 0x3E; arm64 = 0xB7 }
  foreach ($arch in $machines.Keys) {
    foreach ($cmd in 'api', 'migrate', 'admin') {
      $bytes = [IO.File]::ReadAllBytes((Join-Path $stage "bin\linux-$arch\$cmd"))
      $isElf = $bytes[0] -eq 0x7F -and $bytes[1] -eq 0x45 -and $bytes[2] -eq 0x4C -and $bytes[3] -eq 0x46
      if (-not $isElf -or $bytes[18] -ne $machines[$arch]) { throw "bin/linux-$arch/$cmd – не Linux-программа для $arch" }
    }
  }

  Step 'Пакет'
  Copy-Item -Recurse (Join-Path $src 'web\dist') (Join-Path $stage 'site')
  New-Item -ItemType Directory -Force -Path (Join-Path $stage 'deploy'), (Join-Path $stage 'docs') | Out-Null
  Copy-Item -Recurse (Join-Path $src 'deploy\synology') (Join-Path $stage 'deploy\synology')
  Move-Item (Join-Path $stage 'deploy\synology\package.dockerignore') (Join-Path $stage '.dockerignore')
  # Папка для копии базы (docker-compose.yml, init): есть в пакете сразу,
  # чтобы её не создавать руками в File Station.
  New-Item -ItemType Directory -Force -Path (Join-Path $stage 'import') | Out-Null
  Move-Item (Join-Path $stage 'deploy\synology\import-README.txt') (Join-Path $stage 'import\README.txt')
  Copy-Item (Join-Path $src 'docs\deploy-synology.md') (Join-Path $stage 'docs\deploy-synology.md')
  [IO.File]::WriteAllText((Join-Path $stage 'VERSION'), "$sha $date`n")

  $outDir = Join-Path $root 'dist-deploy'
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $out = Join-Path $outDir "$name.tar.gz"
  Invoke-Native { & $tar -czf $out -C (Split-Path $stage) docflow }
  if ($LASTEXITCODE -ne 0) { throw 'Архив не собран' }
} finally {
  Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}

$size = [math]::Round((Get-Item $out).Length / 1MB, 1)
Write-Output ''
Write-Output "Пакет готов: $out ($size МБ, коммит $sha)"
Write-Output 'Дальше – docs/deploy-synology.md, раздел 6: File Station и задача DocFlow install в Task Scheduler.'
