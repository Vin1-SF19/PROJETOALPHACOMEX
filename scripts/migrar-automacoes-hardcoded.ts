import { migrarAutomacoesHardcodedBpm } from "../src/lib/bpm/automacoes/migracao-hardcoded";

async function main() {
  const aplicar = process.argv.includes("--apply");
  const userArg = process.argv.find((item) => item.startsWith("--user-id="));
  const userId = userArg ? Number(userArg.slice("--user-id=".length)) : undefined;
  if (userArg && (!Number.isInteger(userId) || Number(userId) <= 0)) throw new Error("--user-id precisa ser um inteiro positivo");
  const resultado = await migrarAutomacoesHardcodedBpm({ aplicar, userId });
  process.stdout.write(`${JSON.stringify({ ...resultado, definicoes: resultado.definicoes.map((item) => ({ origemChave: item.origemChave, nome: item.nome, pipelineId: item.pipelineId, etapaId: item.etapaId, gatilhoTipo: item.gatilhoTipo })) }, null, 2)}\n`);
  if (!aplicar) process.stdout.write("Plano somente leitura. Use --apply apenas após backup e aprovação específica.\n");
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
