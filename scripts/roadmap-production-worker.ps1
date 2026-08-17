[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$stateDirectory = Join-Path $projectRoot '.roadmap-production'
$logPath = Join-Path $stateDirectory 'worker.log'
$tsxPath = Join-Path $projectRoot 'node_modules\.bin\tsx.cmd'
$workerScript = Join-Path $projectRoot 'scripts\roadmap-production.mjs'

New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null

if (Test-Path -LiteralPath $logPath) {
  $logFile = Get-Item -LiteralPath $logPath
  if ($logFile.Length -gt 10MB) {
    $archiveName = 'worker-{0}.log' -f (Get-Date -Format 'yyyyMMdd-HHmmss')
    Move-Item -LiteralPath $logPath -Destination (Join-Path $stateDirectory $archiveName)
  }
}

$createdNew = $false
$mutex = [System.Threading.Mutex]::new($true, 'Local\PainelAlphaRoadmapProductionWorker', [ref]$createdNew)
if (-not $createdNew) { exit 0 }

try {
  Set-Location -LiteralPath $projectRoot
  $env:ROADMAP_PRODUCTION_SUPERVISOR_PID = [string]$PID
  while ($true) {
    Add-Content -LiteralPath $logPath -Encoding utf8 -Value ('{0} supervisor=start' -f (Get-Date -Format o))
    & $tsxPath $workerScript worker 2>&1 | ForEach-Object {
      Add-Content -LiteralPath $logPath -Encoding utf8 -Value ([string]$_)
    }
    Add-Content -LiteralPath $logPath -Encoding utf8 -Value ('{0} supervisor=restart exitCode={1}' -f (Get-Date -Format o), $LASTEXITCODE)
    Start-Sleep -Seconds 10
  }
} finally {
  if ($createdNew) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
