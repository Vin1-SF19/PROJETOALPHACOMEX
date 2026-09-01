import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql/web";

const url = (process.env.TURSO_DATABASE_URL ?? "").replace(/^libsql:\/\//, "https://");
const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.TURSO_AUTH_TOKEN }) });
const pipelineId = "cmsd9yvb90000dzggt1gjl980";
const etapaId = "cmsd9yvb90003dzgg34vyurim";

async function main() {
  const [etapa, ocultos, visiveis, confirmar, foraDaEtapa, cards, valores] = await Promise.all([
    prisma.bpmEtapa.findUnique({ where: { id: etapaId }, select: { id: true, nome: true, pipelineId: true } }),
    prisma.bpmCampoOcultoEtapa.findMany({ where: { etapaId }, select: { campoId: true, campo: { select: { nome: true } } }, orderBy: { campoId: "asc" } }),
    prisma.bpmCampo.findMany({ where: { pipelineId, etapaId: null, ocultoEmEtapas: { none: { etapaId } } }, select: { id: true, nome: true }, orderBy: { nome: "asc" } }),
    prisma.bpmCampoObrigatorioEtapa.findMany({ where: { etapaId, campo: { nome: { contains: "Confirmar serviço" } } }, select: { id: true, campoId: true } }),
    prisma.bpmCampoOcultoEtapa.count({ where: { etapaId: { not: etapaId } } }),
    prisma.bpmCard.findMany({ where: { pipelineId, etapaId, status: "ATIVO" }, select: { id: true, empresa: { select: { cnpj: true } } }, orderBy: { id: "asc" } }),
    prisma.bpmCardCampoValor.count({ where: { card: { pipelineId, etapaId } } }),
  ]);
  console.log(JSON.stringify({ etapa, ocultos, visiveis, confirmarObrigatorio: confirmar, ocultosForaDaEtapa: foraDaEtapa, cardsAtivos: cards, valoresPersistidosNaEtapa: valores }, null, 2));
}
main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exitCode = 1; });
