import db from "../src/lib/prisma";
import { diagnosticarConfiguracaoPipeline, formatarDiagnosticoPipeline } from "../src/lib/bpm/pipeline-config-diagnostico";

function argumento(nome: string): string | undefined {
  const prefixo = `--${nome}=`;
  return process.argv.find((item) => item.startsWith(prefixo))?.slice(prefixo.length);
}

async function main() {
  const pipelineId = argumento("pipeline") ?? process.argv.find((item, indice) => indice > 1 && !item.startsWith("--"));
  if (!pipelineId) throw new Error("Informe --pipeline=<id>.");

  const diagnostico = await diagnosticarConfiguracaoPipeline(pipelineId);
  if (!diagnostico) {
    process.stderr.write("Pipeline não encontrado.\n");
    process.exitCode = 2;
    return;
  }

  process.stdout.write(process.argv.includes("--json")
    ? `${JSON.stringify(diagnostico, null, 2)}\n`
    : `${formatarDiagnosticoPipeline(diagnostico)}\n`);

  if (process.argv.includes("--check-schema") && !diagnostico.schema.compativel) process.exitCode = 3;
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Falha no diagnóstico."}\n`);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
