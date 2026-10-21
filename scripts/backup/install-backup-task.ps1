<#
.SYNOPSIS
  Ставит ночной бэкап DocFlow на сервер: каждый день в 00:00.

.DESCRIPTION
  Первый запуск:  .\scripts\backup\install-backup-task.ps1 -Server IP_СЕРВЕРА
    - заводит ключ бэкапа на этом компьютере (без пароля: задача ночью
      работает без человека; на сервере этим ключом можно только отдать и
      забрать архив);
    - печатает команду, которую нужно один раз выполнить на сервере.
  Второй запуск (после команды на сервере) проверяет связь, ставит задачу
  в планировщик Windows и сразу снимает первый архив.

  Задача работает от имени текущего пользователя, пока он вошёл в Windows.
  Если в 00:00 компьютер выключен или спит, бэкап запустится при следующем
  включении. Снять задачу: -Remove. Подробно – docs/backup.md.
#>
param(
  [string]$Server = '',
  [int]$Port = 22,
  [switch]$Remove
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'common.ps1')
$name = 'DocFlow nightly backup'

if ($Remove) {
  Unregister-ScheduledTask -TaskName $name -Confirm:$false
  Write-Output "Задача «$name» снята. Архивы на сервере остались."
  exit 0
}

$target = Get-BackupTarget $Server $Port
Save-BackupTarget $target.Server $target.Port

if (-not (Test-Path $BackupKey)) {
  # Пустая строка пароля: Windows PowerShell 5.1 пустой аргумент не передаёт,
  # '""' доходит до ssh-keygen как пустая строка.
  & ssh-keygen -q -t ed25519 -N '""' -C ("docflow-backup@{0}" -f $env:COMPUTERNAME) -f $BackupKey
  if ($LASTEXITCODE -ne 0) { throw 'не удалось создать ключ бэкапа (ssh-keygen)' }
  Write-Output "Ключ бэкапа создан: $BackupKey"
}
$publicKey = (Get-Content "$BackupKey.pub" -Raw).Trim()

$code = Invoke-BackupSsh -Target $target -Command @('list')
if ($code -ne 0) {
  Write-Output ''
  Write-Output 'Сервер пока не принимает этот ключ. Один раз выполните на сервере (ssh root@СЕРВЕР):'
  Write-Output ''
  Write-Output "  sudo bash /opt/docflow/deploy/backup/setup-backup.sh '$publicKey'"
  Write-Output ''
  Write-Output 'Затем запустите этот скрипт ещё раз.'
  Write-Output ("(ответ сервера: {0})" -f "$script:SshError".Trim())
  exit 1
}

$script = Join-Path $PSScriptRoot 'backup.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $script)
$trigger = New-ScheduledTaskTrigger -Daily -At '00:00'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings `
  -Description "Архив исходного кода DocFlow на сервер $($target.Server); сервер хранит 7 последних." `
  -Force | Out-Null

Write-Output "Задача «$name» поставлена: каждый день в 00:00. Журнал: $BackupLog"
Write-Output 'Первый архив – сейчас:'
& $script
