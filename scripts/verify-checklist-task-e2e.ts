#!/usr/bin/env node
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

import { reconciliarTarefaChecklist } from "../src/lib/bpm/checklists/reconciliacao-tarefa";

async function main() {
  const [dumpArg, migrationArg] = process.argv.slice(2);
  if (!dumpArg || !migrationArg) {
    throw new Error("Uso: verify-checklist-task-e2e.ts <backup.sql> <migration.sql>");
  }

  const diretorio = await mkdtemp(path.join(os.tmpdir(), "bpm-checklist-task-e2e."));
  const databasePath = path.join(diretorio, "restore.db");
  const sqlite = new DatabaseSync(databasePath);

  try {
    sqlite.exec(await readFile(path.resolve(dumpArg), "utf8"));
    sqlite.exec(await readFile(path.resolve(migrationArg), "utf8"));
  } finally {
    sqlite.close();
  }

  const db = new PrismaClient({ adapter: new PrismaLibSql({ url: `file:${databasePath}` }) });
  try {
  const checklist = await db.bpmCardChecklist.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (!checklist) throw new Error("Backup sem checklist para o cenário E2E");

  const criado = await db.$transaction((tx) => reconciliarTarefaChecklist({ checklistId: checklist.id }, tx));
  if (criado.acao !== "CRIADA" || !criado.tarefaId) throw new Error("Tarefa não foi criada no cenário E2E");
  const tarefaId = criado.tarefaId;

  const concluido = await db.$transaction(async (tx) => {
    await tx.bpmCardChecklistItem.updateMany({
      where: { cardChecklistId: checklist.id },
      data: { status: "CONCLUIDO", concluidoEm: new Date() },
    });
    await tx.bpmCardChecklist.update({
      where: { id: checklist.id },
      data: { status: "CONCLUIDO", concluidoEm: new Date() },
    });
    return reconciliarTarefaChecklist({ checklistId: checklist.id }, tx);
  });
  if (concluido.acao !== "CONCLUIDA" || concluido.tarefaId !== tarefaId) {
    throw new Error("A mesma tarefa não foi concluída no cenário E2E");
  }

  const reaberto = await db.$transaction(async (tx) => {
    const primeiroItem = await tx.bpmCardChecklistItem.findFirst({
      where: { cardChecklistId: checklist.id },
      orderBy: [{ ordem: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    if (!primeiroItem) throw new Error("Checklist sem item para reabertura E2E");
    await tx.bpmCardChecklistItem.update({
      where: { id: primeiroItem.id },
      data: { status: "PENDENTE", concluidoEm: null },
    });
    await tx.bpmCardChecklist.update({
      where: { id: checklist.id },
      data: { status: "PENDENTE", concluidoEm: null },
    });
    return reconciliarTarefaChecklist({ checklistId: checklist.id }, tx);
  });
  if (reaberto.acao !== "REABERTA" || reaberto.tarefaId !== tarefaId) {
    throw new Error("A mesma tarefa não foi reaberta no cenário E2E");
  }

  const repetido = await db.$transaction((tx) => reconciliarTarefaChecklist({ checklistId: checklist.id }, tx));
  const tarefas = await db.bpmTarefa.findMany({
    where: { cardChecklistId: checklist.id },
    select: { id: true, status: true },
  });
  if (repetido.acao !== "IGNORADA" || tarefas.length !== 1 || tarefas[0]?.id !== tarefaId || tarefas[0]?.status !== "PENDENTE") {
    throw new Error("Reconciliação repetida não foi idempotente no cenário E2E");
  }

  const verificacao = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const integrity = verificacao.prepare("PRAGMA integrity_check").get() as { integrity_check: string };
    const foreignKeys = verificacao.prepare("PRAGMA foreign_key_check").all();
    if (integrity.integrity_check !== "ok" || foreignKeys.length !== 0) {
      throw new Error("Integridade do banco falhou após o cenário E2E");
    }
    console.info(JSON.stringify({
      verified: true,
      checklistId: checklist.id,
      tarefaId,
      fluxo: [criado.acao, concluido.acao, reaberto.acao, repetido.acao],
      quantidadeFinal: tarefas.length,
      integrity: integrity.integrity_check,
      foreignKeyIssues: foreignKeys.length,
    }));
  } finally {
    verificacao.close();
  }
  } finally {
    await db.$disconnect();
    await rm(diretorio, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
