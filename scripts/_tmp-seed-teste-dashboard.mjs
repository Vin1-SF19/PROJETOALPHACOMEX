import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

async function main() {
  const { default: db } = await import("../src/lib/prisma.ts");

  const pipeline = await db.bpmPipeline.findFirst({ where: { nome: "Comercial" }, include: { etapas: { orderBy: { ordem: "asc" } } } });
  const empresa = await db.clientes.findFirst({ select: { id: true, razaoSocial: true } });
  const usuario = await db.usuarios.findFirst({ select: { id: true, nome: true } });

  if (!pipeline || !empresa || !usuario) {
    console.log("Faltando dados base:", { pipeline: !!pipeline, empresa: !!empresa, usuario: !!usuario });
    return;
  }

  const card = await db.bpmCard.create({
    data: {
      empresaId: empresa.id,
      pipelineId: pipeline.id,
      etapaId: pipeline.etapas[0].id,
      responsavelId: usuario.id,
      membros: { create: { userId: usuario.id, role: "RESPONSAVEL" } },
    },
  });

  await db.bpmTarefa.create({
    data: {
      cardId: card.id,
      titulo: "Tarefa de teste — dashboard Fase 3",
      prazo: new Date(Date.now() - 24 * 60 * 60 * 1000),
      prioridade: "ALTA",
      status: "PENDENTE",
    },
  });

  await db.bpmCardHistorico.create({
    data: { cardId: card.id, acao: "CARD_CRIADO", usuarioId: usuario.id },
  });

  console.log("Card criado:", card.id, "empresa:", empresa.razaoSocial);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
