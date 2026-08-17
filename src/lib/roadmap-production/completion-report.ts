import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { ProductionExecution } from "@/lib/roadmap-production/contracts";

function safeSegment(value: string): string {
  return (
    value
      .toLocaleLowerCase("pt-BR")
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "roadmap"
  );
}

export function buildCompletionReport(execution: ProductionExecution): {
  relativePath: string;
  markdown: string;
} {
  const revision = `r${String(execution.sourceVersion).padStart(4, "0")}`;
  const relativePath = `prompt-phases/roadmap-alpha/${safeSegment(execution.moduleKey)}/${safeSegment(execution.objectiveCode)}/${revision}/99-relatorio-conclusao.md`;
  const changedFiles = Array.from(
    new Set(execution.phases.flatMap((phase) => phase.changedFiles)),
  ).sort();
  const closure = [...execution.phases]
    .reverse()
    .find((phase) => phase.kind === "CLOSURE" && phase.summary)?.summary;
  const reportedErrors = execution.manualFeedback;
  const phaseRows = execution.phases.map(
    (phase) =>
      `| ${phase.phaseNumber} | ${phase.title.replaceAll("|", "\\|")} | @${phase.resolvedAgent} | ${phase.status} | ${phase.attemptCount} |`,
  );
  const details = execution.phases.map((phase) =>
    [
      `## Fase ${phase.phaseNumber} — ${phase.title}`,
      "",
      `- Agente: \`@${phase.resolvedAgent}\``,
      `- Tipo: \`${phase.kind}\``,
      `- Tentativas: ${phase.attemptCount}`,
      phase.changedFiles.length
        ? `- Arquivos: ${phase.changedFiles.map((file) => `\`${file}\``).join(", ")}`
        : "- Arquivos: nenhum",
      "",
      phase.summary ?? "Fase concluída sem resumo textual.",
    ].join("\n"),
  );

  const markdown = [
    `# Relatório de conclusão — ${execution.objectiveCode}`,
    "",
    `**Objetivo:** ${execution.objectiveTitle}`,
    `**Projeto:** ${execution.moduleKey}`,
    `**Revisão:** ${revision}`,
    `**Cérebro de desenvolvimento:** ${execution.developmentProvider === "claude" ? "Claude (fallback Codex)" : "Codex (fallback Claude)"}`,
    `**Status:** CONCLUÍDO`,
    `**Objetivo refeito por relato:** ${execution.reworkCount} ${execution.reworkCount === 1 ? "vez" : "vezes"}`,
    `**Concluído em:** ${execution.finishedAt ?? new Date().toISOString()}`,
    "",
    "## Resultado final",
    "",
    closure ?? "Todas as fases documentadas foram executadas e aprovadas.",
    "",
    "## O que foi feito",
    "",
    changedFiles.length
      ? changedFiles.map((file) => `- \`${file}\``).join("\n")
      : "- Nenhum arquivo foi alterado por esta execução.",
    "",
    "## Correções solicitadas pelo administrador",
    "",
    reportedErrors.length
      ? reportedErrors
          .map((feedback, index) =>
            [
              `### ${index + 1}. Relato sobre o objetivo completo`,
              "",
              `- Relatado em: ${feedback.reportedAt}`,
              `- Melhorado com IA: ${feedback.improvedWithAi ? "sim" : "não"}`,
              `- Correção concluída em: ${feedback.resolvedAt ?? "pendente"}`,
              "",
              feedback.content
                .split("\n")
                .map((line) => `> ${line}`)
                .join("\n"),
            ].join("\n"),
          )
          .join("\n\n")
      : "Nenhum retrabalho manual foi solicitado nesta execução.",
    "",
    "## Como foi feito",
    "",
    "| Fase | Atividade | Agente | Resultado | Tentativas |",
    "|---:|---|---|---|---:|",
    ...phaseRows,
    "",
    ...details,
    "",
    "---",
    "Relatório final gerado automaticamente pelo Roadmap Alpha. Aprovação e commit permanecem manuais.",
    "",
  ].join("\n");
  return { relativePath, markdown };
}

export async function writeCompletionReport(
  execution: ProductionExecution,
  root = process.cwd(),
): Promise<{ relativePath: string; markdown: string }> {
  const report = buildCompletionReport(execution);
  const target = path.resolve(root, report.relativePath);
  const normalizedRoot = path.resolve(root);
  if (!target.startsWith(`${normalizedRoot}${path.sep}`))
    throw new Error("UNSAFE_COMPLETION_REPORT_PATH");
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${randomUUID()}`;
  await fs.writeFile(temporary, report.markdown, {
    encoding: "utf8",
    flag: "wx",
  });
  try {
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
  return report;
}
