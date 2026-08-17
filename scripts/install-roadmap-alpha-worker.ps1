[CmdletBinding()]
param(
  [switch]$Start
)

$ErrorActionPreference = 'Stop'
$taskName = 'PainelAlpha-RoadmapWorker'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runnerPath = Join-Path $PSScriptRoot 'roadmap-alpha-worker.ps1'
$powerShellPath = Join-Path $PSHOME 'powershell.exe'
$currentUser = '{0}\{1}' -f $env:USERDOMAIN, $env:USERNAME

if (-not (Test-Path -LiteralPath $runnerPath -PathType Leaf)) {
  throw 'Runner do Roadmap Alpha não encontrado.'
}

$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 7
  $workerScript = Join-Path $projectRoot 'scripts\roadmap-alpha.mjs'
  $orphanWorkers = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.Contains($workerScript) -and $_.CommandLine.Contains(' worker')
  }
  foreach ($worker in $orphanWorkers) {
    Stop-Process -Id $worker.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

$actionArguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $runnerPath
$action = New-ScheduledTaskAction -Execute $powerShellPath -Argument $actionArguments -WorkingDirectory $projectRoot
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$watchdogTrigger = New-ScheduledTaskTrigger `
  -Once `
  -At ((Get-Date).AddMinutes(1)) `
  -RepetitionInterval (New-TimeSpan -Minutes 5) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -MultipleInstances IgnoreNew `
  -RestartCount 999 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries

$task = New-ScheduledTask -Action $action -Trigger @($logonTrigger, $watchdogTrigger) -Principal $principal -Settings $settings -Description 'Worker contínuo do Roadmap Alpha: fila Qwen e projeção prompt-phases.'
Register-ScheduledTask -TaskName $taskName -InputObject $task -Force | Out-Null

if ($Start) {
  Start-ScheduledTask -TaskName $taskName
  Start-Sleep -Seconds 2
}

Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State, TaskPath
