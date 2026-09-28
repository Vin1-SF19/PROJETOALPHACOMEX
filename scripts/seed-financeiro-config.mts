/**
 * Seed unificado do pipeline Financeiro.
 *
 * Orquestra os scripts de configuração existentes em ordem segura:
 *   1. financeiro-elaboracao-config.mts
 *   2. financeiro-formalizacao-config.mts
 *   3. financeiro-contrato-radar-config.mts
 *   4. financeiro-pagamento-config.mts
 *   5. financeiro-conclusao-operacional-config.mts
 *   6. bpm-handoff-config.mts
 *
 * Sem --apply: somente leitura (PLAN) em cada etapa.
 * Com --apply: exige variáveis de aprovação específicas + backup pre-change válido.
 *
 * Uso:
 *   node --import tsx scripts/seed-financeiro-config.mts
 *   node --import tsx scripts/seed-financeiro-config.mts --apply --admin-id=1 --backup-manifest=database-backups/pre-change/xxx.json
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const adminId = args.find((a) => a.startsWith("--admin-id="))?.split("=")[1];
const backupManifest = args.find((a) => a.startsWith("--backup-manifest="))?.split("=")[1];

const ETAPAS_SEED = [
  {
    nome: "Elaboração do Contrato",
    script: "scripts/financeiro-elaboracao-config.mts",
    envAprovacao: "FINANCEIRO_ELABORACAO_APROVADO",
    valorAprovacao: "SIM_PUBLICAR_SEGUNDA_ETAPA",
  },
  {
    nome: "Formalização da Contratação",
    script: "scripts/financeiro-formalizacao-config.mts",
    envAprovacao: "FINANCEIRO_FORMALIZACAO_APROVADO",
    valorAprovacao: "SIM_PUBLICAR_FORMALIZACAO_FINANCEIRO",
  },
  {
    nome: "Contrato Radar",
    script: "scripts/financeiro-contrato-radar-config.mts",
    envAprovacao: "FINANCEIRO_CONTRATO_RADAR_APROVADO",
    valorAprovacao: "SIM_PUBLICAR_CONTRATO_RADAR",
  },
  {
    nome: "Pagamento / Nota Fiscal / Conclusão",
    script: "scripts/financeiro-pagamento-config.mts",
    envAprovacao: "FINANCEIRO_PAGAMENTO_APROVADO",
    valorAprovacao: "SIM_PUBLICAR_PAGAMENTO_FINANCEIRO",
  },
  {
    nome: "Conclusão Operacional",
    script: "scripts/financeiro-conclusao-operacional-config.mts",
    envAprovacao: "FINANCEIRO_CONCLUSAO_APROVADO",
    valorAprovacao: "SIM_PUBLICAR_CONCLUSAO_OPERACIONAL",
  },
  {
    nome: "Handoff Financeiro → Operacional",
    script: "scripts/bpm-handoff-config.mts",
    envAprovacao: "BPM_HANDOFF_APROVADO",
    valorAprovacao: "SIM_PUBLICAR_HANDOFF",
  },
] as const;

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

function executarScript(script: string, argList: string[], env: Record<string, string>): Promise<{ ok: boolean; exitCode: number; output: string }> {
  return new Promise((resolvePromise) => {
    const caminho = resolve(script);
    const proc = spawn("node", ["--import", "tsx", caminho, ...argList], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on("close", (code) => {
      resolvePromise({ ok: code === 0, exitCode: code ?? 1, output: stdout + stderr });
    });
    proc.on("error", (err) => {
      resolvePromise({ ok: false, exitCode: 1, output: `ERRO: ${err.message}` });
    });
  });
}

async function main() {
  log("=== Seed Financeiro — Pipeline de Configuração ===");
  log(`Modo: ${apply ? "APPLY (escrita)" : "PLAN (somente leitura)"}`);
  if (apply) {
    log(`Admin ID: ${adminId ?? "(ausente)"}`);
    log(`Backup manifest: ${backupManifest ?? "(ausente)"}`);
  }
  log("");

  const resultados: Array<{ etapa: string; ok: boolean; exitCode: number; resumo: string }> = [];

  for (const etapa of ETAPAS_SEED) {
    log(`▶ ${etapa.nome}`);
    log(`  Script: ${etapa.script}`);

    const argList: string[] = [];
    const env: Record<string, string> = {};

    if (apply) {
      argList.push("--apply");
      if (adminId) argList.push(`--admin-id=${adminId}`);
      if (backupManifest) argList.push(`--backup-manifest=${backupManifest}`);
      env[etapa.envAprovacao] = etapa.valorAprovacao;
    }

    const resultado = await executarScript(etapa.script, argList, env);

    if (resultado.ok) {
      const linhas = resultado.output.trim().split("\n");
      const resumo = linhas.slice(0, 3).join(" | ").slice(0, 200);
      log(`  ✓ OK (exit ${resultado.exitCode})`);
      if (resumo) log(`  ${resumo}`);
      resultados.push({ etapa: etapa.nome, ok: true, exitCode: resultado.exitCode, resumo });
    } else {
      const linhas = resultado.output.trim().split("\n");
      const erro = linhas.slice(-3).join(" | ").slice(0, 300);
      log(`  ✗ FALHOU (exit ${resultado.exitCode})`);
      if (erro) log(`  ${erro}`);
      resultados.push({ etapa: etapa.nome, ok: false, exitCode: resultado.exitCode, resumo: erro });
      log("");
      log("⚠ Seed interrompido: etapa anterior falhou.");
      break;
    }
    log("");
  }

  log("=== Resumo ===");
  for (const r of resultados) {
    log(`  ${r.ok ? "✓" : "✗"} ${r.etapa}: exit ${r.exitCode}`);
  }
  const todasOk = resultados.length === ETAPAS_SEED.length && resultados.every((r) => r.ok);
  log(todasOk ? "Seed concluído com sucesso." : "Seed concluído com falhas.");
  process.exit(todasOk ? 0 : 1);
}

main().catch((err) => {
  console.error("ERRO CRÍTICO:", err);
  process.exit(1);
});
