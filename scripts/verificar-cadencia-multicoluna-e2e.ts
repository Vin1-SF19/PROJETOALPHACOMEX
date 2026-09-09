import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
// Node 24 fornece node:sqlite; a versão de @types/node do projeto ainda não o declara.
// @ts-expect-error módulo nativo disponível no ambiente de verificação
import { DatabaseSync } from "node:sqlite";

const [backupArg, migrationArg] = process.argv.slice(2);
if (!backupArg || !migrationArg) {
  throw new Error(
    "Uso: verificar-cadencia-multicoluna-e2e.ts <backup.sql> <migration.sql>",
  );
}

async function main() {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "cadencia-multicoluna-e2e."),
  );
  const databasePath = path.join(temporaryDirectory, "restore.db");
  const sqlite = new DatabaseSync(databasePath);

  try {
    sqlite.exec(await readFile(path.resolve(backupArg), "utf8"));
    sqlite.exec(await readFile(path.resolve(migrationArg), "utf8"));
  } finally {
    sqlite.close();
  }

  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  delete process.env.TURSO_AUTH_TOKEN;

  const [{ default: db }, { ativarCadenciasNaEntradaBpm }] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/lib/bpm/cadencias/ativacao-automatica"),
  ]);

  function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
  }

  try {
    const [cliente, usuario] = await Promise.all([
      db.cliente.findFirst({ select: { id: true } }),
      db.usuarios.findFirst({ select: { id: true } }),
    ]);
    assert(cliente && usuario, "FIXTURE_BASE_AUSENTE");

    const pipelineId = "rm6f3c54-pipeline";
    const etapa1 = "rm6f3c54-etapa-1";
    const etapa2 = "rm6f3c54-etapa-2";
    const etapa3 = "rm6f3c54-etapa-3";
    const cadenciaId = "rm6f3c54-cadencia-multi";
    const cadenciaPipelineId = "rm6f3c54-cadencia-pipeline";

    await db.bpmPipeline.create({
      data: { id: pipelineId, nome: "RM E2E multicoluna", ativo: true },
    });
    await db.bpmEtapa.createMany({
      data: [
        {
          id: etapa1,
          pipelineId,
          nome: "Coluna A",
          ordem: 1,
          ativo: true,
          ehInicial: true,
        },
        { id: etapa2, pipelineId, nome: "Coluna B", ordem: 2, ativo: true },
        {
          id: etapa3,
          pipelineId,
          nome: "Coluna não selecionada",
          ordem: 3,
          ativo: true,
          ehFinal: true,
        },
      ],
    });
    await db.bpmCadencia.create({
      data: {
        id: cadenciaId,
        nome: "Cadência duas colunas",
        pipelineId,
        etapaId: etapa1,
        ativa: true,
        criadoPorId: usuario.id,
      },
    });
    await db.bpmCadenciaEtapa.createMany({
      data: [
        { cadenciaId, etapaId: etapa1 },
        { cadenciaId, etapaId: etapa2 },
      ],
    });
    await db.bpmCadenciaPasso.create({
      data: {
        id: "rm6f3c54-passo-multi",
        cadenciaId,
        ordem: 1,
        intervaloDias: 1,
        titulo: "Contato multicoluna",
        ativo: true,
      },
    });

    const criarCard = (id: string, etapaId: string) =>
      db.bpmCard.create({
        data: {
          id,
          empresaId: cliente.id,
          pipelineId,
          etapaId,
          responsavelId: usuario.id,
          status: "ATIVO",
        },
      });
    await Promise.all([
      criarCard("rm6f3c54-card-a", etapa1),
      criarCard("rm6f3c54-card-b", etapa2),
      criarCard("rm6f3c54-card-c", etapa3),
    ]);

    const entrar = (
      cardId: string,
      etapaDestinoId: string,
      etapaAnteriorId: string | null = null,
    ) =>
      db.$transaction((tx) =>
        ativarCadenciasNaEntradaBpm(
          {
            cardId,
            pipelineAnteriorId: etapaAnteriorId ? pipelineId : null,
            etapaAnteriorId,
            pipelineDestinoId: pipelineId,
            etapaDestinoId,
            evento: etapaAnteriorId ? "CARD_MOVIDO" : "CARD_CRIADO",
            agora: new Date("2026-09-08T21:00:00.000Z"),
          },
          tx,
        ),
      );

    const primeira = await entrar("rm6f3c54-card-a", etapa1);
    const segunda = await entrar("rm6f3c54-card-b", etapa2);
    const naoSelecionada = await entrar("rm6f3c54-card-c", etapa3);
    assert(
      primeira.cadenciaIds.includes(cadenciaId),
      "PRIMEIRA_COLUNA_NAO_ATIVOU",
    );
    assert(
      segunda.cadenciaIds.includes(cadenciaId),
      "SEGUNDA_COLUNA_NAO_ATIVOU",
    );
    assert(
      !naoSelecionada.cadenciaIds.includes(cadenciaId),
      "COLUNA_NAO_SELECIONADA_ATIVOU",
    );

    const repetida = await entrar("rm6f3c54-card-a", etapa1, etapa3);
    assert(repetida.criadas === 0, "REATIVACAO_DUPLICOU_VINCULO");

    await db.$transaction(async (tx) => {
      await tx.bpmCadenciaEtapa.delete({ where: { etapaId: etapa2 } });
      await tx.bpmCadencia.update({
        where: { id: cadenciaId },
        data: { etapaId: etapa1 },
      });
    });
    await criarCard("rm6f3c54-card-d", etapa2);
    const depoisRemocao = await entrar("rm6f3c54-card-d", etapa2);
    assert(
      !depoisRemocao.cadenciaIds.includes(cadenciaId),
      "ASSOCIACAO_REMOVIDA_AINDA_ATIVOU",
    );
    const vinculoAnterior = await db.bpmCardCadencia.count({
      where: { cardId: "rm6f3c54-card-b", cadenciaId },
    });
    assert(vinculoAnterior === 1, "REMOCAO_ALTEROU_CICLO_EXISTENTE");

    await db.bpmCadencia.create({
      data: {
        id: cadenciaPipelineId,
        nome: "Cadência de pipeline",
        pipelineId,
        etapaId: null,
        ativa: true,
        criadoPorId: usuario.id,
      },
    });
    await db.bpmCadenciaPasso.create({
      data: {
        id: "rm6f3c54-passo-pipeline",
        cadenciaId: cadenciaPipelineId,
        ordem: 1,
        intervaloDias: 1,
        titulo: "Entrada pipeline",
        ativo: true,
      },
    });
    await criarCard("rm6f3c54-card-e", etapa3);
    const entradaPipeline = await entrar("rm6f3c54-card-e", etapa3);
    assert(
      entradaPipeline.cadenciaIds.includes(cadenciaPipelineId),
      "ESCOPO_PIPELINE_REGREDIU",
    );

    const associacoes = await db.bpmCadenciaEtapa.count({
      where: { cadenciaId },
    });
    const violacoes = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      "PRAGMA foreign_key_check",
    );
    assert(associacoes === 1, "DIFF_DE_ASSOCIACOES_INVALIDO");
    assert(violacoes.length === 0, "FOREIGN_KEY_VIOLATION");

    console.info(
      JSON.stringify({
        verified: true,
        selectedColumnsActivated: 2,
        unselectedColumnActivations: naoSelecionada.criadas,
        duplicateReentryActivations: repetida.criadas,
        removedColumnFutureActivations: depoisRemocao.criadas,
        existingCyclePreserved: vinculoAnterior,
        pipelineScopeActivated:
          entradaPipeline.cadenciaIds.includes(cadenciaPipelineId),
        finalAssociations: associacoes,
        foreignKeyViolations: violacoes.length,
      }),
    );
  } finally {
    await db.$disconnect();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

void main();
