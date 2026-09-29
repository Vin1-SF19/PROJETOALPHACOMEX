/** Inventário read-only da etapa de Alinhamento Estratégico, sem dados pessoais. */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const { default: db } = await import("../src/lib/prisma");
const OPERACIONAL = "cmuih4tnh000409gm5z34jvss";
const ALINHAMENTO = "draft-stage-fea7d252-8276-439f-9b39-c676c15d7cf9";

try {
  const [pipeline, etapa, campos, analistas] = await Promise.all([
    db.bpmPipeline.findUnique({ where: { id: OPERACIONAL }, select: { configVersion: true } }),
    db.bpmEtapa.findUnique({ where: { id: ALINHAMENTO }, select: { nome: true,
      _count: { select: { cards: true } },
      formulario: { select: { id: true, versao: true,
        secoes: { select: { componentes: { select: { campoId: true } } } } } },
    } }),
    db.bpmCampo.findMany({ where: { nome: { in: ["Responsável pelo processo", "CPF do responsável",
      "Resumo da reunião", "Link do resumo da reunião"] } }, select: { id: true, chave: true,
      nome: true, tipo: true, pipelineId: true, escopo: true, fonteEntidade: true,
      fonteAtributo: true, etapaConfiguracoes: { where: { etapaId: ALINHAMENTO }, select: {
        visivel: true, obrigatorioSaida: true, editavel: true } },
    } }),
    db.usuarios.findMany({ where: { id: { in: [15, 32, 34] } }, select: { id: true, cpf: true } }),
  ]);
  console.log(JSON.stringify({ versao: pipeline?.configVersion, etapa: etapa?.nome,
    cards: etapa?._count.cards, formularioVersao: etapa?.formulario?.versao,
    componentes: etapa?.formulario?.secoes.flatMap((secao) => secao.componentes).length,
    campos, analistas: analistas.map((item) => ({ id: item.id, cpfPreenchido: Boolean(item.cpf) })) }, null, 2));
} finally {
  await db.$disconnect();
}
