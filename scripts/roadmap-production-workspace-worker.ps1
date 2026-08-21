[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$WorkspaceId,
  [Parameter(Mandatory = $true)]
  [string]$WorkerRoot
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$stateDirectory = Join-Path $WorkerRoot '.roadmap-production'
$logPath = Join-Path $stateDirectory 'worker.log'
$tsxPath = Join-Path $projectRoot 'node_modules\.bin\tsx.cmd'
$workerScript = Join-Path $projectRoot 'scripts\roadmap-production.mjs'

if (-not (Test-Path -LiteralPath $WorkerRoot)) {
  Write-Error "WorkerRoot nao existe: $WorkerRoot"
  exit 1
}

New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null

if (Test-Path -LiteralPath $logPath) {
  $logFile = Get-Item -LiteralPath $logPath
  if ($logFile.Length -gt 10MB) {
    $archiveName = 'worker-{0}.log' -f (Get-Date -Format 'yyyyMMdd-HHmmss')
    Move-Item -LiteralPath $logPath -Destination (Join-Path $stateDirectory $archiveName)
  }
}

# Mutex nomeado por workspace — permite N workers simultaneos, um por
# workspace, mas nunca dois workers para o MESMO workspace ao mesmo tempo.
$mutexName = 'Local\PainelAlphaRoadmapProductionWorker_{0}' -f $WorkspaceId
$createdNew = $false
$mutex = [System.Threading.Mutex]::new($true, $mutexName, [ref]$createdNew)
if (-not $createdNew) { exit 0 }

try {
  # Sempre roda a partir do PainelAlpha (onde o código do worker/CLI vive) —
  # ROADMAP_PRODUCTION_ROOT é quem decide onde o worker LÊ/ESCREVE estado e
  # arquivos do objetivo, não $projectRoot.
  Set-Location -LiteralPath $projectRoot
  $env:ROADMAP_PRODUCTION_SUPERVISOR_PID = [string]$PID
  $env:ROADMAP_PRODUCTION_ROOT = $WorkerRoot
  while ($true) {
    Add-Content -LiteralPath $logPath -Encoding utf8 -Value ('{0} supervisor=start workspace={1} root={2}' -f (Get-Date -Format o), $WorkspaceId, $WorkerRoot)
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
