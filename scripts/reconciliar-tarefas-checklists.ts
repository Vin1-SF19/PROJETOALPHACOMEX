#!/usr/bin/env node
import { config } from "dotenv";

config({ path: ".env.local", override: true, quiet: true });

type Contadores = {
  examinados: number;
  criados: number;
  atualizados: number;
  reabertos: number;
  concluidos: number;
  ignorados: number;
  falhas: number;
};

function flag(nome: string) {
  return process.argv.includes(`--${nome}`);
}

function valorFlag(nome: string, padrao: string) {
  const prefixo = `--${nome}=`;
  return process.argv.find((argumento) => argumento.startsWith(prefixo))?.slice(prefixo.length) ?? padrao;
}

function incrementar(contadores: Contadores, acao: string) {
  if (acao === "CRIADA") contadores.criados += 1;
  else if (acao === "ATUALIZADA") contadores.atualizados += 1;
  else if (acao === "REABERTA") contadores.reabertos += 1;
  else if (acao === "CONCLUIDA") contadores.concluidos += 1;
  else contadores.ignorados += 1;
}

async function main() {
  const dryRun = flag("dry-run");
  const aplicar = flag("apply");
  if (dryRun === aplicar) {
    throw new Error("Informe exatamente um modo: --dry-run ou --apply.");
  }
  const batchSize = Math.min(Math.max(Number(valorFlag("batch-size", "100")), 1), 500);
  if (!Number.isInteger(batchSize)) throw new Error("--batch-size deve ser um inteiro entre 1 e 500.");

  const [{ default: db }, reconciliacao, { notificarPipelineBpm }] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/lib/bpm/checklists/reconciliacao-tarefa"),
    import("../src/lib/bpm/realtime-server"),
  ]);
  const contadores: Contadores = {
    examinados: 0, criados: 0, atualizados: 0, reabertos: 0,
    concluidos: 0, ignorados: 0, falhas: 0,
  };
  let cursor: string | undefined;

  console.info(JSON.stringify({ evento: "INICIO", modo: dryRun ? "DRY_RUN" : "APPLY", batchSize }));
  do {
    const pagina = await db.bpmCardChecklist.findMany({
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true },
    });
    for (const { id: checklistId } of pagina) {
      contadores.examinados += 1;
      try {
        const resultado = dryRun
          ? await reconciliacao.inspecionarTarefaChecklist(checklistId, db)
          : await db.$transaction((tx) => reconciliacao.reconciliarTarefaChecklist({ checklistId }, tx));
        incrementar(contadores, resultado.acao);
        if (resultado.acao !== "IGNORADA") {
          console.info(JSON.stringify({ evento: "RECONCILIACAO", modo: dryRun ? "DRY_RUN" : "APPLY", ...resultado }));
          if (aplicar) {
            await notificarPipelineBpm({
              pipelineId: resultado.pipelineId ?? undefined,
              cardId: resultado.cardId ?? undefined,
              tipo: "TAREFA_ALTERADA",
            });
          }
        }
      } catch (error) {
        contadores.falhas += 1;
        const detalhes = error instanceof Error
          ? { tipo: error.name, mensagem: error.message }
          : { tipo: typeof error };
        console.error(JSON.stringify({
          evento: "FALHA",
          checklistId,
          ...detalhes,
        }));
      }
    }
    cursor = pagina.at(-1)?.id;
    console.info(JSON.stringify({ evento: "LOTE", cursor: cursor ?? null, contadores }));
    if (pagina.length < batchSize) break;
  } while (cursor);

  console.info(JSON.stringify({ evento: "FIM", modo: dryRun ? "DRY_RUN" : "APPLY", contadores }));
  if (contadores.falhas > 0) process.exitCode = 1;
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
