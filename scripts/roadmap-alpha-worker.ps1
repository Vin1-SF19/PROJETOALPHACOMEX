[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$stateDirectory = Join-Path $projectRoot '.roadmap-worker'
$logPath = Join-Path $stateDirectory 'worker.log'
$tsxPath = Join-Path $projectRoot 'node_modules\.bin\tsx.cmd'
$workerScript = Join-Path $projectRoot 'scripts\roadmap-alpha.mjs'

New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null

if (Test-Path -LiteralPath $logPath) {
  $logFile = Get-Item -LiteralPath $logPath
  if ($logFile.Length -gt 10MB) {
    $archiveName = 'worker-{0}.log' -f (Get-Date -Format 'yyyyMMdd-HHmmss')
    Move-Item -LiteralPath $logPath -Destination (Join-Path $stateDirectory $archiveName)
  }
}

$createdNew = $false
$mutex = [System.Threading.Mutex]::new($true, 'Local\PainelAlphaRoadmapWorker', [ref]$createdNew)
if (-not $createdNew) {
  exit 0
}

try {
  Set-Location -LiteralPath $projectRoot
  $env:ROADMAP_SUPERVISOR_PID = [string]$PID
  while ($true) {
    $startedAt = Get-Date -Format o
    Add-Content -LiteralPath $logPath -Encoding utf8 -Value ('{0} supervisor=start' -f $startedAt)
    & $tsxPath $workerScript worker 2>&1 | ForEach-Object {
      Add-Content -LiteralPath $logPath -Encoding utf8 -Value ([string]$_)
    }
    $exitCode = $LASTEXITCODE
    Add-Content -LiteralPath $logPath -Encoding utf8 -Value ('{0} supervisor=restart exitCode={1}' -f (Get-Date -Format o), $exitCode)
    Start-Sleep -Seconds 10
  }
} finally {
  if ($createdNew) {
    $mutex.ReleaseMutex()
  }
  $mutex.Dispose()
}
