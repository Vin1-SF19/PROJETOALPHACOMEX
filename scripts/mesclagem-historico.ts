import { config } from "dotenv";
import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

config({ path: ".env.local" });

type Opcoes = Record<string, string>;

function lerOpcoes(args: string[]): Opcoes {
  const opcoes: Opcoes = {};
  for (let indice = 0; indice < args.length; indice += 2) {
    const chave = args[indice];
    const valor = args[indice + 1];
    if (!chave?.startsWith("--") || !valor) throw new Error(`Opção inválida: ${chave ?? ""}`);
    opcoes[chave.slice(2)] = valor;
  }
  return opcoes;
}

function inteiroPositivo(valor: string | undefined, nome: string): number {
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero <= 0) throw new Error(`Informe --${nome} com um inteiro positivo.`);
  return numero;
}

function semChavesStorage<T extends Record<string, unknown>>(registro: T) {
  return Object.fromEntries(Object.entries(registro).filter(([chave]) => !chave.endsWith("StorageKey")));
}

async function main() {
  const [comando = "help", ...args] = process.argv.slice(2);
  const opcoes = lerOpcoes(args);

  if (comando === "help") {
    console.info([
      "Uso:",
      "  npm run mesclagem:historico -- doctor",
      "  npm run mesclagem:historico -- list --actor-id <id>",
      "  npm run mesclagem:historico -- detail --actor-id <id> --id <uuid>",
      "  npm run mesclagem:historico -- download --actor-id <id> --id <uuid> --tipo <principal|complementar|resultado> --output <arquivo>",
    ].join("\n"));
    return;
  }

  const [{ default: db }, historico, storage] = await Promise.all([
    import("@/lib/prisma"),
    import("@/lib/mesclagem/historico"),
    import("@/lib/mesclagem/storage"),
  ]);

  try {
  if (comando === "doctor") {
    await db.mesclagemHistorico.findFirst({ select: { id: true } });
    await storage.diagnosticarStorageMesclagem();
    console.info(JSON.stringify({ ok: true, tabela: "MesclagemHistorico", storage: "privado" }));
  } else if (comando === "list") {
    const actorId = inteiroPositivo(opcoes["actor-id"], "actor-id");
    const registros = await historico.listarHistoricoMesclagem(actorId);
    console.info(JSON.stringify(registros, null, 2));
  } else if (comando === "detail") {
    const actorId = inteiroPositivo(opcoes["actor-id"], "actor-id");
    if (!opcoes.id) throw new Error("Informe --id.");
    const registro = await historico.obterHistoricoMesclagem(actorId, opcoes.id);
    if (!registro) throw new Error("Mesclagem não encontrada ou sem acesso.");
    console.info(JSON.stringify(semChavesStorage(registro), null, 2));
  } else if (comando === "download") {
    const actorId = inteiroPositivo(opcoes["actor-id"], "actor-id");
    const tipo = opcoes.tipo;
    if (!opcoes.id || !opcoes.output) throw new Error("Informe --id e --output.");
    if (tipo !== "principal" && tipo !== "complementar" && tipo !== "resultado") throw new Error("Informe --tipo válido.");
    const arquivo = await historico.obterArquivoHistoricoMesclagem(actorId, opcoes.id, tipo);
    if (!arquivo) throw new Error("Mesclagem não encontrada ou sem acesso.");
    try {
      await pipeline(Readable.from(arquivo.conteudo), createWriteStream(opcoes.output, { flags: "wx" }));
    } catch (error) {
      await unlink(opcoes.output).catch(() => undefined);
      throw error;
    }
    console.info(JSON.stringify({ ok: true, tipo, output: opcoes.output, bytes: arquivo.tamanho }));
  } else {
    throw new Error(`Comando desconhecido: ${comando}`);
  }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
