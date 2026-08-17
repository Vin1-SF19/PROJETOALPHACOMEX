[CmdletBinding()]
param([switch]$Start)

$ErrorActionPreference = 'Stop'
$taskName = 'PainelAlpha-RoadmapProductionWorker'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runnerPath = Join-Path $PSScriptRoot 'roadmap-production-worker.ps1'
$powerShellPath = Join-Path $PSHOME 'powershell.exe'
$currentUser = '{0}\{1}' -f $env:USERDOMAIN, $env:USERNAME

if (-not (Test-Path -LiteralPath $runnerPath -PathType Leaf)) { throw 'Runner de Produção do Roadmap não encontrado.' }

$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 7
}

$arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $runnerPath
$action = New-ScheduledTaskAction -Execute $powerShellPath -Argument $arguments -WorkingDirectory $projectRoot
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$watchdogTrigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$task = New-ScheduledTask -Action $action -Trigger @($logonTrigger, $watchdogTrigger) -Principal $principal -Settings $settings -Description 'Execução local dos prompts do Roadmap por agentes Bibble.'
Register-ScheduledTask -TaskName $taskName -InputObject $task -Force | Out-Null
if ($Start) { Start-ScheduledTask -TaskName $taskName; Start-Sleep -Seconds 2 }
Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State, TaskPath
