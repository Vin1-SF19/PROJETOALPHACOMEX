import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

// Seed dos 3 pipelines do MVP do Alpha BPM (D-019/D-023/D-029): Comercial, Financeiro, Radar.
// Idempotente: usa nome do pipeline como chave lógica, não recria se já existir.
async function main() {
  const { default: db } = await import("../src/lib/prisma.ts");

  const setores = await db.setor.findMany({
    where: { nome: { in: ["COMERCIAL", "FINANCEIRO", "OPERACIONAL"] } },
    select: { id: true, nome: true },
  });
  const setorPorNome = Object.fromEntries(setores.map((s) => [s.nome, s.id]));

  for (const nome of ["COMERCIAL", "FINANCEIRO", "OPERACIONAL"]) {
    if (!setorPorNome[nome]) {
      throw new Error(`Setor "${nome}" não encontrado na tabela Setor — aborta o seed.`);
    }
  }

  const pipelinesConfig = [
    {
      nome: "Comercial",
      setorNome: "COMERCIAL",
      // Réplica exata das 7 etapas hoje fixas em crm_oportunidades.etapa (EtapaKanban),
      // para permitir migração 1:1 dos dados existentes sem perda.
      etapas: [
        "Prospecção",
        "Qualificação",
        "Reunião",
        "Proposta",
        "Negociação",
        "Fechado Ganho",
        "Fechado Perdido",
      ],
    },
    {
      nome: "Financeiro",
      setorNome: "FINANCEIRO",
      // Etapas simplificadas do ciclo de contrato (D-010/D-038) — versão MVP simplificada (D-029).
      etapas: ["Ativo", "Em Cobrança", "Encerrado"],
    },
    {
      nome: "Radar",
      setorNome: "OPERACIONAL",
      // Etapas simplificadas de monitoramento (D-006) — versão MVP simplificada (D-029).
      etapas: ["Em Monitoramento", "Pendência", "Concluído"],
    },
  ];

  for (const config of pipelinesConfig) {
    const existente = await db.bpmPipeline.findFirst({ where: { nome: config.nome } });
    if (existente) {
      console.log(`Pipeline "${config.nome}" já existe (id ${existente.id}) — pulando.`);
      continue;
    }

    const pipeline = await db.bpmPipeline.create({
      data: {
        nome: config.nome,
        setores: { create: { setorId: setorPorNome[config.setorNome] } },
        etapas: {
          create: config.etapas.map((nomeEtapa, index) => ({
            nome: nomeEtapa,
            ordem: index,
          })),
        },
      },
      include: { etapas: true },
    });

    console.log(`Pipeline "${pipeline.nome}" criado (id ${pipeline.id}) com ${pipeline.etapas.length} etapas.`);
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
