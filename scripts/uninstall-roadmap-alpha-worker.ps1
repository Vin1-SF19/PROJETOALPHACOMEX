[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
$taskName = 'PainelAlpha-RoadmapWorker'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task -and $PSCmdlet.ShouldProcess($taskName, 'Parar e remover tarefa agendada')) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 7
  $projectRoot = Split-Path -Parent $PSScriptRoot
  $workerScript = Join-Path $projectRoot 'scripts\roadmap-alpha.mjs'
  $orphanWorkers = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.Contains($workerScript) -and $_.CommandLine.Contains(' worker')
  }
  foreach ($worker in $orphanWorkers) {
    Stop-Process -Id $worker.ProcessId -Force -ErrorAction SilentlyContinue
  }
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}
