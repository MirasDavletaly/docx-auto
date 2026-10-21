<#
.SYNOPSIS
  Достаёт бэкап исходного кода DocFlow с сервера в отдельную папку.

.DESCRIPTION
  Рабочую папку проекта не трогает: архив скачивается в -To (по умолчанию
  – папка «DocFlow-восстановление» на рабочем столе) и распаковывается
  рядом с ним в папку docflow-src-ДАТА. С -ArchiveOnly – только архив.

    .\scripts\backup\restore.ps1 -List            # какие архивы есть на сервере
    .\scripts\backup\restore.ps1                  # последний – в папку
    .\scripts\backup\restore.ps1 -Name docflow-src-2026-10-01_000012.tar.gz -ArchiveOnly

  Подробно – docs/backup.md.
#>
param(
  [switch]$List,
  [string]$Name = '',
  [string]$To = '',
  [switch]$ArchiveOnly,
  [string]$Server = '',
  [int]$Port = 0,
  # Для проверки скрипта без сервера: другая программа вместо ssh.
  [string]$Ssh = 'ssh'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')

try {
  $target = Get-BackupTarget $Server $Port

  $code = Invoke-BackupSsh -Target $target -Command @('list') -Ssh $Ssh
  if ($code -ne 0) { throw ("сервер не ответил (код {0}): {1}" -f $code, "$script:SshError".Trim()) }
  $archives = @("$script:SshOutput" -split "`r?`n" | Where-Object { $_ -match '^docflow-src-\S+ \d+$' } | ForEach-Object {
      $parts = $_ -split ' '
      [pscustomobject]@{ Name = $parts[0]; Size = [int64]$parts[1] }
    })

  if ($List) {
    if ($archives.Count -eq 0) { Write-Output 'На сервере архивов пока нет.' }
    $archives | ForEach-Object { '{0}  {1,8:N0} КБ' -f $_.Name, ($_.Size / 1KB) }
    exit 0
  }

  if ($archives.Count -eq 0) { throw 'на сервере архивов пока нет' }
  $chosen = if ($Name -eq '') { $archives[0] } else { $archives | Where-Object { $_.Name -eq $Name } | Select-Object -First 1 }
  if ($null -eq $chosen) { throw "на сервере нет архива $Name. Список: restore.ps1 -List" }

  if ($To -eq '') { $To = Join-Path ([Environment]::GetFolderPath('Desktop')) 'DocFlow-восстановление' }
  New-Item -ItemType Directory -Force -Path $To | Out-Null
  $file = Join-Path $To $chosen.Name

  $code = Invoke-BackupSsh -Target $target -Command @('get', $chosen.Name) -OutFile $file -Ssh $Ssh
  if ($code -ne 0) { throw ("не удалось скачать (код {0}): {1}" -f $code, "$script:SshError".Trim()) }
  if ((Get-Item $file).Length -ne $chosen.Size) { throw "архив скачан не полностью: $file" }
  Write-Output "Архив: $file"

  if (-not $ArchiveOnly) {
    $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
    if (-not (Test-Path $tar)) { $tar = 'tar' }
    & $tar -xzf $file -C $To
    if ($LASTEXITCODE -ne 0) { throw "не удалось распаковать $file" }
    $folder = Join-Path $To ($chosen.Name -replace '\.tar\.gz$', '')
    Write-Output "Распакован в: $folder"
  }
}
catch {
  Write-Output "Ошибка: $($_.Exception.Message)"
  exit 1
}
