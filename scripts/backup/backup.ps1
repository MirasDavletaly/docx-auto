<#
.SYNOPSIS
  Ночной бэкап исходного кода DocFlow на сервер.

.DESCRIPTION
  «Тест день 3»: «автобэкап на сервера: сохраняет копию, но не трогает
  оригинал, каждые 24 часа в 00:00, а старый автоматом удалять». 30.09:
  «пусть бэкап в самом сервере хранится, в случае чего вытащим его в другую
  папку или архивом».

  Снимок – всё, что лежит в папке проекта, с учётом .gitignore (без
  node_modules, dist, .env), включая ещё не закоммиченные правки. Он
  собирается во временном индексе git: рабочие файлы, настоящий индекс и
  текущая ветка не меняются. Снимок упаковывается в .tar.gz и уходит на
  сервер по SSH ключом бэкапа; сервер хранит 7 последних архивов, старые
  удаляет сам (deploy/backup/docflow-backup-receive.sh).

  Установка и восстановление – docs/backup.md.

.PARAMETER Server
  IP или домен сервера. По умолчанию – из настроек install-backup-task.ps1.

.PARAMETER DryRun
  Собрать архив и показать, что было бы отправлено, ничего не отправляя.
#>
param(
  [string]$Server = '',
  [int]$Port = 0,
  [switch]$DryRun,
  # Для проверки скрипта без сервера: другая программа вместо ssh.
  [string]$Ssh = 'ssh'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# Успех git решает код возврата. Предупреждения git пишет в поток ошибок, и
# Windows PowerShell 5.1 при $ErrorActionPreference = 'Stop' принял бы их за
# сбой, поэтому поток ошибок здесь только собирается для сообщения.
function Invoke-Git {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & git -C $repo @args 2>&1
  }
  finally {
    $ErrorActionPreference = $previous
  }
  $isError = { $_ -is [System.Management.Automation.ErrorRecord] }
  $stdout = @($output | Where-Object { -not (& $isError) } | ForEach-Object { "$_" })
  $stderr = @($output | Where-Object $isError | ForEach-Object { "$_" })
  if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' '): $($stderr -join ' ')" }
  return $stdout
}

$archive = Join-Path $env:TEMP ("docflow-backup-{0}.tar.gz" -f $PID)
try {
  $target = if ($DryRun -and $Server -eq '' -and -not (Test-Path $BackupConfig)) { $null } else { Get-BackupTarget $Server $Port }
  $stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'

  # Временный индекс: настоящий индекс и рабочие файлы не трогаются.
  $tempIndex = Join-Path $env:TEMP ("docflow-backup-index-{0}" -f $PID)
  $env:GIT_INDEX_FILE = $tempIndex
  try {
    Invoke-Git read-tree HEAD | Out-Null
    Invoke-Git add -A | Out-Null
    $tree = (Invoke-Git write-tree).Trim()
  }
  finally {
    Remove-Item Env:GIT_INDEX_FILE -ErrorAction SilentlyContinue
    Remove-Item $tempIndex -ErrorAction SilentlyContinue
  }

  # Внутри архива – папка docflow-src-ДАТА: распакованный архив не смешается
  # с другими файлами.
  Invoke-Git archive --format=tar.gz "--prefix=docflow-src-$stamp/" -o $archive $tree | Out-Null
  $size = (Get-Item $archive).Length
  $files = @(Invoke-Git ls-tree -r --name-only $tree).Count
  Write-Log ("снимок папки: {0} файлов, архив {1:N0} КБ" -f $files, ($size / 1KB))

  if ($DryRun) {
    $where = if ($null -eq $target) { 'сервер ещё не задан' } else { "сервер $($target.Server)" }
    Write-Log "проверка вхолостую ($where): ничего не отправлено"
    exit 0
  }

  $code = Invoke-BackupSsh -Target $target -Command @('put') -InFile $archive -Ssh $Ssh
  $reply = "$script:SshOutput".Trim()
  if ($code -ne 0 -or $reply -notmatch '^ok (\S+) (\d+)$') {
    throw ("сервер не принял архив (код {0}): {1} {2}" -f $code, $reply, "$script:SshError".Trim())
  }
  if ([int64]$Matches[2] -ne $size) {
    throw "сервер получил $($Matches[2]) байт вместо $size"
  }
  Write-Log "отправлено на $($target.Server): $($Matches[1])"
}
catch {
  Write-Log "ОШИБКА: $($_.Exception.Message)"
  exit 1
}
finally {
  Remove-Item $archive -ErrorAction SilentlyContinue
}
