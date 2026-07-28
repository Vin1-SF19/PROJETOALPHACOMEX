# Sincroniza o branch main com o repositorio interno da empresa (remote "servidor",
# bare repo em \\ALPHACOMEX\desenvolvimento\PainelAlpha.git). Roda via Task Scheduler
# toda segunda e sexta. NAO mexe no remote "origin" (GitHub) — push la continua manual.
#
# Se nao houver nada para commitar, o autocommit e pulado e so o push roda (idempotente
# quando o servidor ja esta em dia).

$projectPath = "C:\Users\TI\Desktop\PainelAlpha"
$logDir = "C:\Users\TI\Desktop\PainelAlpha\.sync-logs"
$logFile = Join-Path $logDir "sync-$(Get-Date -Format 'yyyy-MM-dd_HHmmss').log"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Write-Output $line
    Add-Content -Path $logFile -Value $line
}

Set-Location $projectPath

Log "Iniciando sync para o servidor..."

$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne "main") {
    Log "AVISO: branch atual e '$branch', nao 'main'. Abortando para evitar sync da branch errada."
    exit 1
}

# --untracked-files=all --ignore-submodules ignora o estado "dirty" de submodules
# (ex: bibblesquad), que nao e commitavel via `git add -A` normal e nao deve
# disparar autocommit.
$status = git status --porcelain --ignore-submodules
if ($status) {
    Log "Alteracoes pendentes detectadas, criando autocommit..."
    git add -A
    git commit -m "chore: sync automatico [$(Get-Date -Format 'yyyy-MM-dd HH:mm')]" | ForEach-Object { Log $_ }
    if ($LASTEXITCODE -ne 0) {
        Log "ERRO: git commit retornou codigo $LASTEXITCODE"
        exit 1
    }
    Log "Commit criado."
} else {
    Log "Nenhuma alteracao pendente. Pulando commit."
}

Log "Enviando para o remote 'servidor'..."
$pushOutput = git push servidor main 2>&1
$pushOutput | ForEach-Object { Log $_ }

if ($LASTEXITCODE -ne 0) {
    Log "ERRO: git push retornou codigo $LASTEXITCODE"
    exit 1
}

Log "Sync concluido com sucesso."
exit 0
