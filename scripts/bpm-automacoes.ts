#!/usr/bin/env node
import "dotenv/config";

import db from "../src/lib/prisma";
import { materializarAgendasAutomacoesBpm, materializarGatilhosTemporaisBpm } from "../src/lib/bpm/automacoes/agenda";
import { materializarExecucoesEventosBpm } from "../src/lib/bpm/automacoes/eventos";
import { processarFilaAutomacoesCentraisBpm, reprocessarExecucaoAutomacaoCentral } from "../src/lib/bpm/automacoes/central-runtime";

function valorFlag(nome: string, padrao?: string) {
  const item = process.argv.find((arg) => arg.startsWith(`--${nome}=`));
  return item ? item.slice(nome.length + 3) : padrao;
}

async function status() {
  const filtro = valorFlag("status");
  const limite = Math.min(Math.max(Number(valorFlag("limit", "25")), 1), 100);
  const itens = await db.bpmAutomacaoExecucao.findMany({
    where: { automacaoVersaoId: { not: null }, ...(filtro ? { status: filtro } : {}) },
    orderBy: { createdAt: "desc" }, take: limite,
    select: { id: true, automacaoId: true, cardId: true, status: true, tentativas: true, mensagemErro: true, createdAt: true, executadoEm: true },
  });
  console.table(itens.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), executadoEm: item.executadoEm?.toISOString() ?? "-" })));
}

async function run() {
  const limite = Math.min(Math.max(Number(valorFlag("limit", "20")), 1), 50);
  const agenda = await materializarAgendasAutomacoesBpm(limite * 5);
  const temporais = await materializarGatilhosTemporaisBpm(limite * 5);
  const eventos = await materializarExecucoesEventosBpm(limite * 5);
  const fila = await processarFilaAutomacoesCentraisBpm(limite);
  console.log(JSON.stringify({ agenda, temporais, eventos, fila }, null, 2));
}

async function retry() {
  const id = process.argv[3];
  if (!id) throw new Error("Uso: npm run bpm:automacoes -- retry <execucaoId>");
  if (!await reprocessarExecucaoAutomacaoCentral(id)) throw new Error("Execução não encontrada ou não está em FALHA");
  console.log(`Execução ${id} devolvida à fila.`);
}

async function main() {
  const comando = process.argv[2] ?? "status";
  if (comando === "status") await status();
  else if (comando === "run") await run();
  else if (comando === "retry") await retry();
  else throw new Error("Comando inválido. Use: status | run | retry");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
