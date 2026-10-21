<#
  Общее для бэкапа на сервер (docs/backup.md): настройки, ключ, вызов ssh.
  Подключается точкой: . "$PSScriptRoot\common.ps1".
#>

$BackupHome = Join-Path $env:LOCALAPPDATA 'DocFlow'
$BackupConfig = Join-Path $BackupHome 'backup.json'
$BackupKey = Join-Path $BackupHome 'backup_ed25519'
$BackupLog = Join-Path $BackupHome 'backup.log'
$BackupUser = 'docflow-backup'

New-Item -ItemType Directory -Force -Path $BackupHome | Out-Null

function Write-Log([string]$message) {
  $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $message
  Write-Output $line
  Add-Content -Path $BackupLog -Value $line -Encoding UTF8
}

<# Сервер из параметра или из сохранённых настроек. Нет нигде – ошибка с подсказкой. #>
function Get-BackupTarget([string]$Server, [int]$Port) {
  $saved = $null
  if (Test-Path $BackupConfig) { $saved = Get-Content $BackupConfig -Raw -Encoding UTF8 | ConvertFrom-Json }
  if ($Server -eq '' -and $null -ne $saved) { $Server = [string]$saved.server }
  if ($Port -eq 0) { $Port = if ($null -ne $saved -and $saved.port) { [int]$saved.port } else { 22 } }
  if ($Server -eq '') {
    throw 'сервер не задан: запустите scripts\backup\install-backup-task.ps1 -Server IP_СЕРВЕРА'
  }
  if ($Server -notmatch '^[A-Za-z0-9.-]+$') { throw "сервер задан неверно: $Server" }
  return @{ Server = $Server; Port = $Port }
}

function Save-BackupTarget([string]$Server, [int]$Port) {
  $json = @{ server = $Server; port = $Port } | ConvertTo-Json
  [IO.File]::WriteAllText($BackupConfig, $json, (New-Object Text.UTF8Encoding $false))
}

<# Аргумент командной строки в кавычках, если в нём пробел или кавычка. #>
function Format-Arg([string]$value) {
  if ($value -match '[\s"]') { return '"' + ($value -replace '"', '\"') + '"' }
  return $value
}

<#
  ssh на сервер ключом бэкапа. Сервер по этому ключу выполняет только
  приёмник: команда – put, list или get ИМЯ.

  Windows PowerShell 5.1 передаёт между программами текст, а не байты,
  поэтому архив идёт через файлы: -InFile – stdin, -OutFile – stdout.
  Возвращает код выхода; stderr – в $script:SshError.
#>
function Invoke-BackupSsh {
  param(
    [hashtable]$Target,
    [string[]]$Command,
    [string]$InFile = '',
    [string]$OutFile = '',
    [string]$Ssh = 'ssh'
  )
  $sshArgs = @(
    '-i', $BackupKey,
    '-p', [string]$Target.Port,
    '-o', 'BatchMode=yes',
    '-o', 'IdentitiesOnly=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-o', 'ConnectTimeout=20',
    '-o', 'ServerAliveInterval=15',
    ('{0}@{1}' -f $BackupUser, $Target.Server)
  ) + $Command

  $errFile = [IO.Path]::GetTempFileName()
  $outFile2 = if ($OutFile -ne '') { $OutFile } else { [IO.Path]::GetTempFileName() }
  $options = @{
    FilePath = $Ssh
    ArgumentList = (($sshArgs | ForEach-Object { Format-Arg $_ }) -join ' ')
    RedirectStandardOutput = $outFile2
    RedirectStandardError = $errFile
    NoNewWindow = $true
    Wait = $true
    PassThru = $true
  }
  if ($InFile -ne '') { $options.RedirectStandardInput = $InFile }
  try {
    $process = Start-Process @options
    $script:SshError = (Get-Content $errFile -Raw -Encoding UTF8)
    if ($OutFile -eq '') { $script:SshOutput = (Get-Content $outFile2 -Raw -Encoding UTF8) }
    return $process.ExitCode
  }
  finally {
    Remove-Item $errFile -ErrorAction SilentlyContinue
    if ($OutFile -eq '') { Remove-Item $outFile2 -ErrorAction SilentlyContinue }
  }
}
